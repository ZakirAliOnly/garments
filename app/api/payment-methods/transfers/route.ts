import { requireAdmin } from "@/lib/auth/require-admin";
import {
  financialTransaction,
  financeError,
  FinanceError,
  money,
  date,
  resolveMethod,
  methodBalance,
} from "@/lib/finance/core";
import { NextRequest, NextResponse } from "next/server";
export async function POST(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const b = await req.json();
    const amount = money(b.amount, "Transfer amount", false);
    const entryDate = date(b.entryDate);
    if (typeof b.requestKey !== "string" || b.requestKey.length < 16)
      throw new FinanceError("A transfer request key is required");
    if (b.fromId === b.toId)
      throw new FinanceError("Choose two different payment methods");
    return await financialTransaction(async (tx) => {
      const prior = await tx.paymentTransfer.findUnique({
        where: { requestKey: b.requestKey },
      });
      if (prior) {
        if (
          prior.fromId !== b.fromId ||
          prior.toId !== b.toId ||
          Number(prior.amount) !== amount ||
          prior.entryDate.getTime() !== entryDate.getTime()
        )
          throw new FinanceError("This transfer key has already been used");
        return NextResponse.json(prior);
      }
      const from = await resolveMethod(tx, null, b.fromId),
        to = await resolveMethod(tx, null, b.toId);
      if ((await methodBalance(tx, from.id)) < amount)
        throw new FinanceError(
          "The source method has insufficient funds for this transfer",
        );
      const transfer = await tx.paymentTransfer.create({
        data: {
          fromId: from.id,
          toId: to.id,
          amount,
          entryDate,
          notes: typeof b.notes === "string" ? b.notes.trim() : null,
          requestKey: b.requestKey,
        },
      });
      await tx.cashBookEntry.createMany({
        data: [
          {
            paymentMethodId: from.id,
            type: "debit",
            amount,
            entryDate,
            description: `Transfer to ${to.name}`,
            sourceType: "transfer",
            sourceId: transfer.id,
          },
          {
            paymentMethodId: to.id,
            type: "credit",
            amount,
            entryDate,
            description: `Transfer from ${from.name}`,
            sourceType: "transfer",
            sourceId: transfer.id,
          },
        ],
      });
      return NextResponse.json(transfer, { status: 201 });
    });
  } catch (error) {
    return financeError(error, "Unable to transfer funds");
  }
}
