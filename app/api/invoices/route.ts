import {
  financialTransaction,
  financeError,
  FinanceError,
  money,
  date,
  resolveMethod,
} from "@/lib/finance/core";
import { requireAdmin } from "@/lib/auth/require-admin";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/invoices — list all invoices
export async function GET(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type"); // "regular" | "walk" | null (all)

  const where = type ? { type } : {};

  const takeParam = searchParams.get("take");
  const take = takeParam ? parseInt(takeParam, 10) : undefined;

  const invoices = await prisma.invoice.findMany({
    where,
    orderBy: { createdAt: "desc" },
    ...(take ? { take } : {}),
    include: {
      customer: { select: { cid: true, name: true } },
      accountHeader: { select: { id: true, name: true, prefix: true } },
    },
  });

  return NextResponse.json(invoices);
}

// POST /api/invoices — create invoice
export async function POST(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const body = await req.json();
    return await financialTransaction(async (prisma) => {
      const {
        type,
        customerId,
        customerName,
        phone,
        address,
        invoiceDate,
        deliveryDate,
        description,
        items,
        subtotal,
        discount = 0,
        total,
        amountPaid = 0,
        balanceDue,
        paymentMethod,
      } = body;

      if (!type) {
        return NextResponse.json(
          { error: "type is required" },
          { status: 400 },
        );
      }

      const selectedMethod = await resolveMethod(
        prisma,
        paymentMethod || "Cash",
        body.paymentMethodId,
      );
      money(subtotal,"Subtotal");
      money(total, "Invoice total");
      money(amountPaid ?? 0, "Amount paid");
      if (!["walk", "regular"].includes(type))
        throw new FinanceError("Invalid invoice type");
      if (!Array.isArray(items) || !items.length)
        throw new FinanceError("Add at least one invoice item");
      const calculatedSubtotal = money(
        items.reduce(
          (sum, item) =>
            sum + money(item.q, "Quantity", false) * money(item.r, "Rate"),
          0,
        ),
        "Subtotal",
      );
      const discountValue = money(discount, "Discount");
      if (
        discountValue > calculatedSubtotal ||
        Math.abs(Number(subtotal) - calculatedSubtotal) > 0.01 ||
        Math.abs(Number(total) - (calculatedSubtotal - discountValue)) > 0.01
      )
        throw new FinanceError(
          "Invoice totals do not match its items and discount",
        );
      if (!customerId && Number(amountPaid) > Number(total))
        throw new FinanceError(
          "Walk-in payment cannot exceed the invoice total",
        );
      date(invoiceDate);
      // For walk-in invoices the name is optional — default to "Walk-in Customer"
      const finalCustomerName =
        customerName?.trim() || (type === "walk" ? "Walk-in Customer" : null);

      if (!finalCustomerName) {
        return NextResponse.json(
          { error: "customerName is required for regular invoices" },
          { status: 400 },
        );
      }

      // ── Resolve account header ──────────────────────────────────────────────
      let accountHeaderId: string | null = null;

      if (type === "walk") {
        // Auto-link walk-in invoices to the "Retail Customer" account head
        const retailHead = await prisma.accountHeader.findFirst({
          where: { name: { contains: "retail", mode: "insensitive" } },
        });
        if (retailHead) accountHeaderId = retailHead.id;
      } else if (type === "regular" && customerId) {
        // Inherit the account head from the customer's header
        const cust = await prisma.customer.findUnique({
          where: { id: customerId },
          select: { headerId: true },
        });
        if (cust?.headerId) accountHeaderId = cust.headerId;
      }

      // ── Invoice number ──────────────────────────────────────────────────────
      const last = await prisma.invoice.findFirst({
        orderBy: { createdAt: "desc" },
      });
      let nextNum = 1;
      if (last) {
        const match = last.invNumber.match(/INV-(\d+)/);
        if (match) nextNum = parseInt(match[1]) + 1;
      }
      const invNumber = `INV-${String(nextNum).padStart(4, "0")}`;

      const status =
        Number(total) - Number(amountPaid) <= 0
          ? "paid"
          : amountPaid > 0
            ? "partial"
            : "pending";

      const invoice = await prisma.invoice.create({
        data: {
          invNumber,
          type,
          customer: customerId ? { connect: { id: customerId } } : undefined,
          customerName: finalCustomerName,
          phone: phone || null,
          address: address || null,
          accountHeader: accountHeaderId
            ? { connect: { id: accountHeaderId } }
            : undefined,
          invoiceDate: new Date(invoiceDate),
          deliveryDate: deliveryDate ? new Date(deliveryDate) : null,
          description: description || null,
          items: items ?? [],
          subtotal: Number(subtotal),
          discount: Number(discount || 0),
          total: Number(total),
          amountPaid: Number(amountPaid || 0),
          balanceDue: Math.max(0, Number(total) - Number(amountPaid)),
          paymentMethod: selectedMethod.name,
          status,
        },
      });

      // ── Update customer balance + cashbook (advance-aware) ────────────────
      // Balance rule:
      //   balanceChange = total - freshCash
      // where freshCash = amountPaid minus whatever portion was drawn from an
      // existing credit balance (advance). This prevents double-counting:
      //   • advance already reduced the balance when it was received
      //   • only truly new cash further reduces the balance
      //   • overpayment naturally flips balance negative (we owe them)
      let freshCashForCashbook = Number(amountPaid); // default for walk-ins
      if (customerId) {
        const custForBalance = await prisma.customer.findUnique({
          where: { id: customerId },
          select: { balance: true },
        });
        const priorBalance = custForBalance?.balance ?? 0;
        const availableAdvance = Math.max(0, -priorBalance);
        const advanceApplied = Math.min(
          availableAdvance,
          Math.min(Number(amountPaid), Number(total)),
        );
        freshCashForCashbook = Number(amountPaid) - advanceApplied;
        const balanceChange = Number(total) - freshCashForCashbook;
        await prisma.customer.update({
          where: { id: customerId },
          data: { balance: { increment: balanceChange } },
        });
      }

      // ── Deduct stock quantities for each line item (FIFO per batch) ────────
      const lineItems = Array.isArray(items) ? items : [];
      for (const item of lineItems) {
        const qty = Number(item.q) || 0;
        if (qty <= 0) continue;

        // Resolve the stockItemId regardless of whether a variant was selected
        let resolvedStockItemId: string | null = item.stockId || null;

        if (item.variantId) {
          // Decrement the specific variant quantity
          await prisma.stockVariant.update({
            where: { id: item.variantId },
            data: { quantity: { decrement: qty } },
          });
          // Resolve the parent stockItemId so we can do FIFO on its batches
          const variant = await prisma.stockVariant.findUnique({
            where: { id: item.variantId },
            select: { stockItemId: true },
          });
          if (variant) {
            resolvedStockItemId = variant.stockItemId;
            // Re-sum parent quantity from all its variants
            const allVariants = await prisma.stockVariant.findMany({
              where: { stockItemId: variant.stockItemId },
              select: { quantity: true },
            });
            const newTotal = allVariants.reduce((s, v) => s + v.quantity, 0);
            await prisma.stockItem.update({
              where: { id: variant.stockItemId },
              data: { quantity: newTotal },
            });
          }
        } else if (item.stockId) {
          // Decrement the parent item directly (no variants)
          await prisma.stockItem.update({
            where: { id: item.stockId },
            data: { quantity: { decrement: qty } },
          });
        }

        // FIFO: drain oldest batches first for the resolved stockItem
        if (resolvedStockItemId) {
          const batches = await prisma.stockBatch.findMany({
            where: { stockItemId: resolvedStockItemId, remaining: { gt: 0 } },
            orderBy: { purchasedAt: "asc" }, // oldest first
          });
          let needed = qty;
          for (const batch of batches) {
            if (needed <= 0) break;
            const deduct = Math.min(needed, batch.remaining);
            await prisma.stockBatch.update({
              where: { id: batch.id },
              data: { remaining: { decrement: deduct } },
            });
            needed -= deduct;
          }
        }
      }

      // ── Auto-create cashbook credit entry for fresh cash received ───────────
      // Advance-drawn payments are excluded — they were already entered when the
      // advance was originally received.
      if (freshCashForCashbook > 0) {
        await prisma.cashBookEntry.create({
          data: {
            paymentMethod: { connect: { id: selectedMethod.id } },
            sourceType: "invoice",
            sourceId: invoice.id,
            entryDate: new Date(invoiceDate),
            type: "credit",
            description: `Payment received — ${invNumber}`,
            amount: freshCashForCashbook,
            invoice: { connect: { id: invoice.id } },
            customer: customerId ? { connect: { id: customerId } } : undefined,
            notes: `Invoice ${invNumber} · ${finalCustomerName}`,
          },
        });
      }

      return NextResponse.json(invoice, { status: 201 });
    });
  } catch (err: unknown) {
    console.error(err);
    return financeError(err, "Failed to create invoice");
  }
}
