import { requireAdmin } from "@/lib/auth/require-admin";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type RefundItem = {
  dt: string;
  q: number;
  r?: number;
  a?: number;
  stockId?: string;
  variantId?: string;
};

// GET /api/refunds — list refund/replace requests
export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const rows = await prisma.refundRequest.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(rows);
  } catch {
    return NextResponse.json({ error: "Failed to fetch refund requests" }, { status: 500 });
  }
}

// POST /api/refunds — process a refund/replace request
export async function POST(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const body = await req.json();
    const {
      invNumber,
      type, // "refund" | "replace"
      reason,
      amount,
      items,
      replacementItems,
    } = body;

    if (!invNumber?.trim()) {
      return NextResponse.json({ error: "Invoice number is required" }, { status: 400 });
    }
    if (type !== "refund" && type !== "replace") {
      return NextResponse.json({ error: "Type must be refund or replace" }, { status: 400 });
    }

    const invoice = await prisma.invoice.findUnique({
      where: { invNumber: invNumber.trim() },
      include: { customer: { select: { id: true, name: true } } },
    });
    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }
    if (invoice.isRefunded) {
      return NextResponse.json({ error: "This invoice has already been refunded and cannot be refunded again." }, { status: 400 });
    }

    const reqItems: RefundItem[] = Array.isArray(items) ? items : [];
    const normalizedReturns = reqItems
      .map((i) => ({
        dt: i.dt ?? "",
        q: Number(i.q) || 0,
        r: Number(i.r) || 0,
        a: Number(i.a) || 0,
        stockId: i.stockId || undefined,
        variantId: i.variantId || undefined,
      }))
      .filter((i) => i.q > 0);

    if (normalizedReturns.length === 0) {
      return NextResponse.json({ error: "Add at least one item with return quantity" }, { status: 400 });
    }

    const repItems: RefundItem[] = Array.isArray(replacementItems) ? replacementItems : [];
    const normalizedReplacements = repItems
      .map((i) => ({
        dt: i.dt ?? "",
        q: Number(i.q) || 0,
        r: Number(i.r) || 0,
        a: Number(i.a) || 0,
        stockId: i.stockId || undefined,
        variantId: i.variantId || undefined,
      }))
      .filter((i) => i.q > 0);

    if (type === "replace" && normalizedReplacements.length === 0) {
      return NextResponse.json({ error: "Select at least one replacement item" }, { status: 400 });
    }
    const returnAmount = normalizedReturns.reduce((s, i) => s + (Number(i.a) || Number(i.q) * Number(i.r) || 0), 0);
    const replacementAmount = normalizedReplacements.reduce((s, i) => s + (Number(i.a) || Number(i.q) * Number(i.r) || 0), 0);
    // For refund: positive amount means money/credit goes back to customer.
    // For replace: positive means customer owes extra; negative means customer should be credited.
    const netAmount =
      type === "refund"
        ? Math.max(0, Number(amount) || returnAmount)
        : replacementAmount - returnAmount;

    const result = await prisma.$transaction(async (tx) => {
      // Generate RR number
      const last = await tx.refundRequest.findFirst({ orderBy: { createdAt: "desc" } });
      let nextNum = 1;
      if (last) {
        const m = last.rrNumber.match(/RR-(\d+)/);
        if (m) nextNum = parseInt(m[1], 10) + 1;
      }
      const rrNumber = `RR-${String(nextNum).padStart(4, "0")}`;

      // Helper: restore returned qty to batches newest-first (reverse-FIFO)
      async function restoreBatchQty(stockItemId: string, qty: number) {
        const batches = await tx.stockBatch.findMany({
          where: { stockItemId },
          orderBy: { purchasedAt: "desc" }, // newest first for returns
        });
        let toRestore = qty;
        for (const batch of batches) {
          if (toRestore <= 0) break;
          const space = batch.qty - batch.remaining; // how much was taken from this batch
          const restore = Math.min(toRestore, space);
          if (restore > 0) {
            await tx.stockBatch.update({
              where: { id: batch.id },
              data: { remaining: { increment: restore } },
            });
            toRestore -= restore;
          }
        }
      }

      // Helper: FIFO deduct from batches oldest-first
      async function deductBatchQty(stockItemId: string, qty: number) {
        const batches = await tx.stockBatch.findMany({
          where: { stockItemId, remaining: { gt: 0 } },
          orderBy: { purchasedAt: "asc" },
        });
        let needed = qty;
        for (const batch of batches) {
          if (needed <= 0) break;
          const deduct = Math.min(needed, batch.remaining);
          await tx.stockBatch.update({
            where: { id: batch.id },
            data: { remaining: { decrement: deduct } },
          });
          needed -= deduct;
        }
      }

      // Returned items go back to stock
      const touchedVariantParentIds = new Set<string>();
      for (const it of normalizedReturns) {
        if (it.variantId) {
          const variant = await tx.stockVariant.findUnique({
            where: { id: it.variantId },
            select: { stockItemId: true },
          });
          if (!variant) continue;
          await tx.stockVariant.update({
            where: { id: it.variantId },
            data: { quantity: { increment: it.q } },
          });
          touchedVariantParentIds.add(variant.stockItemId);
          await restoreBatchQty(variant.stockItemId, it.q);
        } else if (it.stockId) {
          await tx.stockItem.update({
            where: { id: it.stockId },
            data: { quantity: { increment: it.q } },
          });
          await restoreBatchQty(it.stockId, it.q);
        }
      }

      // Replacement items are issued to customer (decrement stock + FIFO batches)
      for (const it of normalizedReplacements) {
        if (it.variantId) {
          const variant = await tx.stockVariant.findUnique({
            where: { id: it.variantId },
            select: { stockItemId: true },
          });
          if (!variant) continue;
          await tx.stockVariant.update({
            where: { id: it.variantId },
            data: { quantity: { decrement: it.q } },
          });
          touchedVariantParentIds.add(variant.stockItemId);
          await deductBatchQty(variant.stockItemId, it.q);
        } else if (it.stockId) {
          await tx.stockItem.update({
            where: { id: it.stockId },
            data: { quantity: { decrement: it.q } },
          });
          await deductBatchQty(it.stockId, it.q);
        }
      }

      // Recalculate parent quantity for all touched variant products
      for (const stockItemId of touchedVariantParentIds) {
        const vars = await tx.stockVariant.findMany({
          where: { stockItemId },
          select: { quantity: true },
        });
        const totalQty = vars.reduce((s, v) => s + v.quantity, 0);
        await tx.stockItem.update({
          where: { id: stockItemId },
          data: { quantity: totalQty },
        });
      }

      // Balance effect:
      // - refund: decrease balance by refund amount
      // - replace: apply signed net difference (extra payable increases balance, extra credit decreases it)
      if (invoice.customerId && netAmount !== 0) {
        if (type === "refund") {
          await tx.customer.update({
            where: { id: invoice.customerId },
            data: { balance: { decrement: netAmount } },
          });
        } else {
          if (netAmount > 0) {
            await tx.customer.update({
              where: { id: invoice.customerId },
              data: { balance: { increment: netAmount } },
            });
          } else {
            await tx.customer.update({
              where: { id: invoice.customerId },
              data: { balance: { decrement: Math.abs(netAmount) } },
            });
          }
        }
      }

      const created = await tx.refundRequest.create({
        data: {
          rrNumber,
          invoiceId: invoice.id,
          invoiceNumber: invoice.invNumber,
          customerId: invoice.customerId,
          customerName: invoice.customerName,
          type,
          reason: reason?.trim() || null,
          amount: netAmount,
          items:
            type === "replace"
              ? { returns: normalizedReturns, replacements: normalizedReplacements }
              : normalizedReturns,
        },
      });

      await tx.invoice.update({
        where: { id: invoice.id },
        data: { isRefunded: true, status: "returned", amountPaid: Math.max(0, invoice.amountPaid - returnAmount), balanceDue: 0 },
      });

      return created;
    });

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to process refund/replace request" }, { status: 500 });
  }
}

