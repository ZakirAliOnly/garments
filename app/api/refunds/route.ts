import {
  financialTransaction,
  financeError,
  FinanceError,
  money,
  resolveMethod,
  type Tx,
} from "@/lib/finance/core";
import { requireModuleAccess } from "@/lib/auth/require-admin";
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
  const denied = await requireModuleAccess("refund");
  if (denied) return denied;
  try {
    const rows = await prisma.refundRequest.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(rows);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch refund requests" },
      { status: 500 },
    );
  }
}

// POST /api/refunds — process a refund/replace request
export async function POST(req: NextRequest) {
  const denied = await requireModuleAccess("refund");
  if (denied) return denied;
  try {
    const body = await req.json();
    return await financialTransaction(async (prisma) => {
      const {
        invNumber,
        type, // "refund" | "replace"
        reason,
        amount,
        items,
        replacementItems,
      } = body;

      if (!invNumber?.trim()) {
        return NextResponse.json(
          { error: "Invoice number is required" },
          { status: 400 },
        );
      }
      if (type !== "refund" && type !== "replace") {
        return NextResponse.json(
          { error: "Type must be refund or replace" },
          { status: 400 },
        );
      }

      const invoice = await prisma.invoice.findUnique({
        where: { invNumber: invNumber.trim() },
        include: { customer: { select: { id: true, name: true } } },
      });
      if (!invoice) {
        return NextResponse.json(
          { error: "Invoice not found" },
          { status: 404 },
        );
      }
      if (invoice.isRefunded) {
        return NextResponse.json(
          {
            error:
              "This invoice has already been refunded and cannot be refunded again.",
          },
          { status: 400 },
        );
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
        return NextResponse.json(
          { error: "Add at least one item with return quantity" },
          { status: 400 },
        );
      }

      const repItems: RefundItem[] = Array.isArray(replacementItems)
        ? replacementItems
        : [];
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
        return NextResponse.json(
          { error: "Select at least one replacement item" },
          { status: 400 },
        );
      }
      const sold = Array.isArray(invoice.items)
        ? (invoice.items as unknown as RefundItem[])
        : [];
      const used = new Map<number, number>();
      const discountFactor =
        invoice.subtotal > 0
          ? Math.min(1, invoice.total / invoice.subtotal)
          : 1;
      let returnAmount = 0;
      for (const item of normalizedReturns) {
        const index = sold.findIndex((line) =>
          item.variantId
            ? line.variantId === item.variantId
            : item.stockId
              ? line.stockId === item.stockId && !line.variantId
              : line.dt === item.dt,
        );
        if (index < 0)
          throw new FinanceError(
            "A returned item was not sold on this invoice",
          );
        const quantity = (used.get(index) ?? 0) + item.q;
        used.set(index, quantity);
        if (quantity > Number(sold[index].q))
          throw new FinanceError("Return quantity exceeds the quantity sold");
        item.r = Number(sold[index].r) || 0;
        item.a = money(item.q * item.r * discountFactor, "Return amount");
        returnAmount += item.a;
      }
      returnAmount = money(returnAmount, "Refund value");
      if (returnAmount > invoice.total + 0.01)
        throw new FinanceError("Refund value exceeds invoice total");
      const replacementAmount = normalizedReplacements.reduce(
        (s, i) => s + (Number(i.a) || Number(i.q) * Number(i.r) || 0),
        0,
      );
      // For refund: positive amount means money/credit goes back to customer.
      // For replace: positive means customer owes extra; negative means customer should be credited.
      const netAmount =
        type === "refund" ? returnAmount : replacementAmount - returnAmount;

      const result = await (async (tx: Tx) => {
        // Generate RR number
        const last = await tx.refundRequest.findFirst({
          orderBy: { createdAt: "desc" },
        });
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

        const signedChange = type === "refund" ? -netAmount : netAmount;
        const newTotal = money(
          Math.max(0, invoice.total + signedChange),
          "Adjusted invoice total",
        );
        const settleCash =
          body.settlement === "cash" ||
          (!invoice.customerId && body.settlement !== "account");
        if (body.settlement === "account" && !invoice.customerId)
          throw new FinanceError(
            "Walk-in refunds must be settled using a payment method",
          );
        const cashOut = settleCash
          ? money(
              Math.min(
                Math.max(0, invoice.amountPaid - newTotal),
                Math.max(0, -signedChange),
              ),
              "Cash refund",
            )
          : 0;
        const cashIn =
          settleCash && type === "replace"
            ? money(
                Math.min(
                  Math.max(0, signedChange),
                  Math.max(0, newTotal - invoice.amountPaid),
                ),
                "Replacement payment",
              )
            : 0;
        const method =
          cashOut > 0 || cashIn > 0
            ? await resolveMethod(
                tx,
                body.paymentMethod || invoice.paymentMethod || "Cash",
                body.paymentMethodId,
              )
            : null;
        if (invoice.customerId)
          await tx.customer.update({
            where: { id: invoice.customerId },
            data: { balance: { increment: signedChange + cashOut - cashIn } },
          });

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
                ? {
                    returns: normalizedReturns,
                    replacements: normalizedReplacements,
                  }
                : normalizedReturns,
          },
        });

        const newPaid = money(
          invoice.amountPaid + cashIn - cashOut,
          "Amount paid",
        );
        const newDue = money(Math.max(0, newTotal - newPaid), "Balance due");
        await tx.invoice.update({
          where: { id: invoice.id },
          data: {
            isRefunded: true,
            total: newTotal,
            amountPaid: newPaid,
            balanceDue: newDue,
            status:
              newTotal === 0
                ? "returned"
                : newDue === 0
                  ? "paid"
                  : newPaid > 0
                    ? "partial"
                    : "pending",
          },
        });
        if (method) {
          const isOutgoing = cashOut > 0;
          await tx.cashBookEntry.create({
            data: {
              paymentMethodId: method.id,
              type: isOutgoing ? "debit" : "credit",
              amount: isOutgoing ? cashOut : cashIn,
              entryDate: new Date(),
              description: `${isOutgoing ? "Refund paid" : "Replacement payment"} — ${rrNumber}`,
              invoiceId: invoice.id,
              customerId: invoice.customerId,
              sourceType: "refund",
              sourceId: created.id,
            },
          });
        }
        return created;
      })(prisma);

      return NextResponse.json(result, { status: 201 });
    });
  } catch (err) {
    console.error(err);
    return financeError(err, "Failed to process refund/replace request");
  }
}
