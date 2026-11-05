import { requireExpenseFunds } from "@/lib/finance/expenses";
import { requireModuleAccess } from "@/lib/auth/require-admin";
import {
  financialTransaction,
  financeError,
  FinanceError,
  money,
  date,
  resolveMethod,
} from "@/lib/finance/core";
import { NextRequest, NextResponse } from "next/server";
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await requireModuleAccess("cashbook");
  if (denied) return denied;
  try {
    const { id } = await params,
      b = await req.json();
    return await financialTransaction(async (tx) => {
      const old = await tx.cashBookEntry.findUnique({ where: { id } });
      if (!old) throw new FinanceError("Entry not found");
      if (old.invoiceId || old.sourceType !== "manual")
        throw new FinanceError(
          "This entry is managed by its transaction page and cannot be edited here",
        );
      if (
        !["credit", "debit"].includes(b.type) ||
        typeof b.description !== "string" ||
        !b.description.trim()
      )
        throw new FinanceError("A valid type and description are required");
      const amount = money(b.amount, "Amount", false),
        method =
          b.paymentMethod !== undefined || b.paymentMethodId !== undefined
            ? await resolveMethod(tx, b.paymentMethod, b.paymentMethodId)
            : await resolveMethod(tx, null, old.paymentMethodId);
      if (b.type === "debit")
        await requireExpenseFunds(
          tx,
          method,
          amount,
          method.id === old.paymentMethodId
            ? old.type === "debit"
              ? old.amount
              : -old.amount
            : 0,
        );
      if (old.customerId)
        await tx.customer.update({
          where: { id: old.customerId },
          data: {
            balance: {
              increment: old.type === "credit" ? old.amount : -old.amount,
            },
          },
        });
      if (b.customerId)
        await tx.customer.update({
          where: { id: b.customerId },
          data: {
            balance: { increment: b.type === "credit" ? -amount : amount },
          },
        });
      const updated = await tx.cashBookEntry.update({
        where: { id },
        data: {
          entryDate: date(b.entryDate),
          type: b.type,
          description: b.description.trim(),
          amount,
          notes: typeof b.notes === "string" ? b.notes.trim() : null,
          customerId: b.customerId || null,
          paymentMethodId: method.id,
        },
      });
      return NextResponse.json(updated);
    });
  } catch (error) {
    return financeError(error, "Failed to update entry");
  }
}
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await requireModuleAccess("cashbook");
  if (denied) return denied;
  try {
    const { id } = await params;
    return await financialTransaction(async (tx) => {
      const old = await tx.cashBookEntry.findUnique({ where: { id } });
      if (!old) throw new FinanceError("Entry not found");
      if (old.invoiceId || old.sourceType !== "manual")
        throw new FinanceError(
          "This entry is managed by its transaction page and cannot be deleted here",
        );
      if (old.customerId)
        await tx.customer.update({
          where: { id: old.customerId },
          data: {
            balance: {
              increment: old.type === "credit" ? old.amount : -old.amount,
            },
          },
        });
      await tx.cashBookEntry.delete({ where: { id } });
      return NextResponse.json({ success: true });
    });
  } catch (error) {
    return financeError(error, "Failed to delete entry");
  }
}
