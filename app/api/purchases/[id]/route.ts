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

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await requireModuleAccess("purchase");
  if (denied) return denied;
  try {
    const body = await req.json();
    return await financialTransaction(async (prisma) => {
      const { id } = await params;
      const { additionalPayment } = body;

      const selectedMethod = await resolveMethod(
        prisma,
        body.paymentMethod || body.paymentMode || "Cash",
        body.paymentMethodId,
      );
      money(additionalPayment, "Payment", false);
      const purchase = await prisma.purchase.findUnique({ where: { id } });
      if (!purchase)
        return NextResponse.json(
          { error: "Purchase not found" },
          { status: 404 },
        );

      const payment = Number(additionalPayment || 0);
      if (payment <= 0)
        return NextResponse.json(
          { error: "Invalid payment amount" },
          { status: 400 },
        );
      if (payment > purchase.balanceDue)
        return NextResponse.json(
          { error: "Payment exceeds balance due" },
          { status: 400 },
        );

      const newPaid = purchase.amountPaid + payment;
      const newBalance = purchase.total - newPaid;
      const newStatus = newBalance <= 0 ? "paid" : "partial";

      const updated = await prisma.purchase.update({
        where: { id },
        data: {
          amountPaid: newPaid,
          balanceDue: newBalance,
          status: newStatus,
        },
      });

      // Update supplier balance due
      await prisma.supplier.update({
        where: { id: purchase.supplierId },
        data: { balanceDue: { decrement: payment } },
      });

      // Cashbook: record this payment as a debit (cash out)
      const supplier = await prisma.supplier.findUnique({
        where: { id: purchase.supplierId },
        select: { name: true },
      });
      await prisma.cashBookEntry.create({
        data: {
          entryDate: new Date(),
          paymentMethodId: selectedMethod.id,
          sourceType: "purchase",
          sourceId: id,
          type: "debit",
          description: `Purchase Payment — ${purchase.poNumber}`,
          amount: payment,
          notes: `Supplier: ${supplier?.name ?? purchase.supplierId} | PO: ${purchase.poNumber}`,
        },
      });

      return NextResponse.json(updated);
    });
  } catch (err) {
    console.error(err);
    return financeError(err, "Failed to record payment");
  }
}
