import { requireAdmin } from "@/lib/auth/require-admin";
import {
  financialTransaction,
  financeError,
  FinanceError,
  money,
} from "@/lib/finance/core";
import { NextRequest, NextResponse } from "next/server";
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const { id } = await params;
    const body = await req.json();
    return await financialTransaction(async (tx) => {
      const method = await tx.paymentMethod.findUnique({
        where: { id },
        include: { _count: { select: { entries: true } } },
      });
      if (!method) throw new FinanceError("Payment method not found");
      if (body.active !== undefined && typeof body.active !== "boolean")
        throw new FinanceError("Invalid status");
      const name =
        body.name === undefined ? method.name : String(body.name).trim();
      if (!name || name.length > 80)
        throw new FinanceError("Enter a valid name (maximum 80 characters)");
      if (
        await tx.paymentMethod.findFirst({
          where: {
            id: { not: id },
            name: { equals: name, mode: "insensitive" },
          },
        })
      )
        throw new FinanceError("This name is already used");
      const opening =
        body.openingBalance === undefined
          ? Number(method.openingBalance)
          : money(body.openingBalance, "Opening balance");
      if (method._count.entries && opening !== Number(method.openingBalance))
        throw new FinanceError(
          "Opening balance is locked after the first transaction. Record an adjustment in Cashbook instead.",
        );
      if (
        body.active === false &&
        (await tx.paymentMethod.count({ where: { active: true } })) <= 1 &&
        method.active
      )
        throw new FinanceError("Keep at least one active payment method");
      return NextResponse.json(
        await tx.paymentMethod.update({
          where: { id },
          data: {
            name,
            openingBalance: opening,
            ...(body.active !== undefined ? { active: body.active } : {}),
          },
        }),
      );
    });
  } catch (error) {
    return financeError(error, "Unable to update payment method");
  }
}
