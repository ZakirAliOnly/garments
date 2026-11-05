import { requireModuleAccess } from "@/lib/auth/require-admin";
import {
  financialTransaction,
  financeError,
  FinanceError,
} from "@/lib/finance/core";
import {
  expenseDetails,
  expenseMethod,
  requireExpenseFunds,
} from "@/lib/finance/expenses";
import { NextRequest, NextResponse } from "next/server";
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await requireModuleAccess("expenses");
  if (denied) return denied;
  try {
    const { id } = await params,
      body = await req.json(),
      details = expenseDetails(body);
    return await financialTransaction(async (tx) => {
      const old = await tx.cashBookEntry.findUnique({ where: { id } });
      if (!old || old.sourceType !== "expense" || old.type !== "debit")
        throw new FinanceError("Expense not found");
      if (body.updatedAt !== old.updatedAt.toISOString())
        throw new FinanceError(
          "This expense has changed. Refresh and reopen it before editing.",
        );
      const method = await expenseMethod(
        tx,
        body.paymentMethodId,
        old.paymentMethodId,
      );
      await requireExpenseFunds(
        tx,
        method,
        details.amount,
        method.id === old.paymentMethodId ? old.amount : 0,
      );
      return NextResponse.json(
        await tx.cashBookEntry.update({
          where: { id },
          data: { ...details, paymentMethodId: method.id },
          include: {
            paymentMethod: { select: { id: true, name: true, active: true } },
          },
        }),
      );
    });
  } catch (error) {
    return financeError(error, "Unable to update expense");
  }
}
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await requireModuleAccess("expenses");
  if (denied) return denied;
  try {
    const { id } = await params,
      body = await req.json();
    return await financialTransaction(async (tx) => {
      const old = await tx.cashBookEntry.findUnique({ where: { id } });
      if (!old || old.sourceType !== "expense" || old.type !== "debit")
        throw new FinanceError("Expense not found");
      if (body.updatedAt !== old.updatedAt.toISOString())
        throw new FinanceError(
          "This expense has changed. Refresh before deleting it.",
        );
      await tx.cashBookEntry.delete({ where: { id } });
      return NextResponse.json({ success: true });
    });
  } catch (error) {
    return financeError(error, "Unable to delete expense");
  }
}
