import {
  financialTransaction,
  financeError,
  FinanceError,
  money,
  date,
  resolveMethod,
} from "@/lib/finance/core";
import { requireModuleAccess } from "@/lib/auth/require-admin";
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

interface BulkItem {
  stockItemId?: string | null;
  stockName: string;
  stockCode?: string | null;
  qty: number;
  unitPrice: number;
  category?: string;
  unit?: string;
}

export async function POST(req: NextRequest) {
  const denied = await requireModuleAccess("purchase");
  if (denied) return denied;
  try {
    const body = await req.json();
    return await financialTransaction(async (prisma) => {
      const { supplierId, dateTime, items, advancePaid, paymentMode, notes } =
        body;

      if (!supplierId || !Array.isArray(items) || items.length === 0) {
        return NextResponse.json(
          { error: "Required fields missing" },
          { status: 400 },
        );
      }

      for (const item of items as BulkItem[]) {
        money(item.qty, "Quantity", false);
        money(item.unitPrice, "Unit price", false);
        if (!item.stockName || !item.qty || !item.unitPrice) {
          return NextResponse.json(
            { error: "Each item requires name, qty and rate" },
            { status: 400 },
          );
        }
      }

      const selectedMethod = await resolveMethod(
        prisma,
        paymentMode || "Cash",
        body.paymentMethodId,
      );
      money(advancePaid ?? 0, "Advance paid");
      date(dateTime);
      const all = await prisma.purchase.findMany({
        select: { poNumber: true },
      });
      const poNumber = nextPoNumber(all);

      const totalAdvance = Number(advancePaid || 0);
      const grandTotal = (items as BulkItem[]).reduce(
        (s, i) => s + Number(i.qty) * Number(i.unitPrice),
        0,
      );

      if (totalAdvance > grandTotal)
        throw new FinanceError("Advance exceeds purchase total");
      const purchases = [];
      let advanceDistributed = 0;

      for (let idx = 0; idx < (items as BulkItem[]).length; idx++) {
        const item = (items as BulkItem[])[idx];
        const itemTotal = Number(item.qty) * Number(item.unitPrice);

        // Last item gets any remaining advance to avoid rounding drift
        const isLast = idx === (items as BulkItem[]).length - 1;
        const itemAdvance = isLast
          ? totalAdvance - advanceDistributed
          : grandTotal > 0
            ? Math.round((itemTotal / grandTotal) * totalAdvance * 100) / 100
            : 0;
        advanceDistributed += itemAdvance;

        const itemBalance = itemTotal - itemAdvance;
        const status: string =
          itemBalance <= 0 ? "paid" : itemAdvance > 0 ? "partial" : "pending";

        let remaining: number | null = null;
        if (item.stockItemId) {
          const stock = await prisma.stockItem.findUnique({
            where: { id: item.stockItemId },
          });
          if (stock) {
            remaining = stock.quantity + Number(item.qty);
            await prisma.stockItem.update({
              where: { id: item.stockItemId },
              data: { quantity: remaining },
            });
          }
        }

        const purchase = await prisma.purchase.create({
          data: {
            poNumber: `PO-${String(parseInt(poNumber.slice(3), 10) + idx).padStart(4, "0")}`,
            supplierId,
            stockItemId: item.stockItemId || null,
            stockName: item.stockName,
            stockCode: item.stockCode || null,
            qty: Number(item.qty),
            unitPrice: Number(item.unitPrice),
            total: itemTotal,
            remaining,
            transactionType: "sold",
            dateTime: new Date(dateTime),
            amountPaid: itemAdvance,
            balanceDue: itemBalance,
            status,
            notes: notes || null,
          },
        });

        purchases.push(purchase);

        if (item.stockItemId) {
          const batchNumber = await nextBatchNumber(prisma);
          await prisma.stockBatch.create({
            data: {
              batchNumber,
              purchaseId: purchase.id,
              stockItemId: item.stockItemId,
              qty: Number(item.qty),
              remaining: Number(item.qty),
              costPrice: Number(item.unitPrice),
              purchasedAt: new Date(dateTime),
            },
          });
        }
      }

      // Update supplier totals once for the whole order
      const totalBalance = grandTotal - totalAdvance;
      await prisma.supplier.update({
        where: { id: supplierId },
        data: {
          totalPurchased: { increment: grandTotal },
          balanceDue: { increment: Math.max(0, totalBalance) },
        },
      });

      // Single cashbook entry for the advance paid
      if (totalAdvance > 0) {
        const supplier = await prisma.supplier.findUnique({
          where: { id: supplierId },
          select: { name: true },
        });
        const modeNote = paymentMode ? ` via ${paymentMode}` : "";
        const itemNames = (items as BulkItem[])
          .map((i) => i.stockName)
          .join(", ");
        await prisma.cashBookEntry.create({
          data: {
            entryDate: new Date(dateTime),
            paymentMethodId: selectedMethod.id,
            sourceType: "purchase",
            sourceId: purchases[0]?.id,
            type: "debit",
            description: `Purchase ${poNumber} — ${itemNames}`,
            amount: totalAdvance,
            notes: `Supplier: ${supplier?.name ?? supplierId} | PO: ${poNumber}${modeNote}`,
          },
        });
      }

      return NextResponse.json(purchases, { status: 201 });
    });
  } catch (err) {
    console.error(err);
    return financeError(err, "Failed to create purchase order");
  }
}
