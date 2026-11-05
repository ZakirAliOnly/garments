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

function nextPoNumber(purchases: { poNumber: string }[]) {
  const nums = purchases.map((p) => {
    const m = p.poNumber.match(/PO-(\d+)/);
    return m ? parseInt(m[1]) : 0;
  });
  return `PO-${String((nums.length ? Math.max(...nums) : 0) + 1).padStart(4, "0")}`;
}

async function nextBatchNumber(prisma: import("@/lib/finance/core").Tx) {
  const last = await prisma.stockBatch.findFirst({
    orderBy: { createdAt: "desc" },
    select: { batchNumber: true },
  });
  const num = last ? parseInt(last.batchNumber.replace("BATCH-", "")) + 1 : 1;
  return `BATCH-${String(num).padStart(4, "0")}`;
}

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  const purchases = await prisma.purchase.findMany({
    include: { supplier: { select: { name: true, supplierId: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(purchases);
}

export async function POST(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const body = await req.json();
    return await financialTransaction(async (prisma) => {
      const {
        supplierId,
        stockItemId,
        stockName,
        stockCode,
        qty,
        unitPrice,
        transactionType,
        dateTime,
        amountPaid,
        paymentMode,
        notes,
      } = body;

      if (!supplierId || !stockName || !qty || !unitPrice) {
        return NextResponse.json(
          { error: "Required fields missing" },
          { status: 400 },
        );
      }

      const selectedMethod = await resolveMethod(
        prisma,
        paymentMode || "Cash",
        body.paymentMethodId,
      );
      money(qty, "Quantity", false);
      money(unitPrice, "Unit price", false);
      money(amountPaid ?? 0, "Amount paid");
      date(dateTime);
      if (!["sold", "return", "exchange"].includes(transactionType))
        throw new FinanceError("Invalid purchase transaction type");
      if (Number(amountPaid || 0) > Number(qty) * Number(unitPrice))
        throw new FinanceError("Payment exceeds purchase total");
      const all = await prisma.purchase.findMany({
        select: { poNumber: true },
      });
      const poNumber = nextPoNumber(all);

      const total = Number(qty) * Number(unitPrice);
      const paid = Number(amountPaid || 0);
      const balanceDue = total - paid;
      const status =
        balanceDue <= 0 ? "paid" : paid > 0 ? "partial" : "pending";

      // Calculate remaining stock and update StockItem
      let remaining: number | null = null;
      if (stockItemId) {
        const stock = await prisma.stockItem.findUnique({
          where: { id: stockItemId },
        });
        if (stock) {
          if (transactionType === "sold")
            remaining = stock.quantity + Number(qty); // purchased = stock increases
          else if (transactionType === "return")
            remaining = stock.quantity - Number(qty); // return = stock decreases
          else remaining = stock.quantity; // exchange = net zero

          await prisma.stockItem.update({
            where: { id: stockItemId },
            data: { quantity: remaining },
          });
        }
      }

      const purchase = await prisma.purchase.create({
        data: {
          poNumber,
          supplierId,
          stockItemId: stockItemId || null,
          stockName,
          stockCode: stockCode || null,
          qty: Number(qty),
          unitPrice: Number(unitPrice),
          total,
          remaining,
          transactionType,
          dateTime: new Date(dateTime),
          amountPaid: paid,
          balanceDue,
          status,
          notes: notes || null,
        },
      });

      // Create a stock batch for every inbound purchase so FIFO tracking works
      if (transactionType === "sold" && stockItemId) {
        const batchNumber = await nextBatchNumber(prisma);
        await prisma.stockBatch.create({
          data: {
            batchNumber,
            purchaseId: purchase.id,
            stockItemId,
            qty: Number(qty),
            remaining: Number(qty),
            costPrice: Number(unitPrice),
            purchasedAt: new Date(dateTime),
          },
        });
      }

      // Update supplier running totals for purchases
      if (transactionType === "sold") {
        await prisma.supplier.update({
          where: { id: supplierId },
          data: {
            totalPurchased: { increment: total },
            balanceDue: { increment: balanceDue },
          },
        });
      }

      // Cashbook: record advance payment as a debit (cash out) if any was paid upfront
      if (paid > 0) {
        const supplier = await prisma.supplier.findUnique({
          where: { id: supplierId },
          select: { name: true },
        });
        const modeNote = paymentMode ? ` via ${paymentMode}` : "";
        await prisma.cashBookEntry.create({
          data: {
            entryDate: new Date(dateTime),
            paymentMethodId: selectedMethod.id,
            sourceType: "purchase",
            sourceId: purchase.id,
            type: transactionType === "return" ? "credit" : "debit",
            description: `Purchase ${poNumber} — ${stockName}`,
            amount: paid,
            notes: `Supplier: ${supplier?.name ?? supplierId} | PO: ${poNumber}${modeNote}`,
          },
        });
      }

      return NextResponse.json(purchase, { status: 201 });
    });
  } catch (err) {
    console.error(err);
    return financeError(err, "Failed to create purchase");
  }
}
