import {
  FinanceError,
  money,
  date,
  methodBalance,
  resolveMethod,
  type Tx,
} from "./core";

export function expenseDate(value: unknown): Date {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    throw new FinanceError("Select a valid expense date");
  const result = date(value);
  if (result.toISOString().slice(0, 10) !== value)
    throw new FinanceError("Select a valid expense date");
  return result;
}
export function expenseDetails(body: Record<string, unknown>) {
  if (
    typeof body.description !== "string" ||
    !body.description.trim() ||
    body.description.trim().length > 160
  )
    throw new FinanceError(
      "Enter an expense description (maximum 160 characters)",
    );
  if (
    body.notes !== undefined &&
    body.notes !== null &&
    (typeof body.notes !== "string" || body.notes.length > 2000)
  )
    throw new FinanceError("Notes must be 2,000 characters or fewer");
  const amount = money(body.amount, "Expense amount", false);
  if (amount <= 0)
    throw new FinanceError("Expense amount must be at least Rs 0.01");
  return {
    description: body.description.trim(),
    amount,
    entryDate: expenseDate(body.entryDate),
    notes: typeof body.notes === "string" ? body.notes.trim() || null : null,
  };
}
export async function expenseMethod(tx: Tx, id: unknown, oldMethodId?: string) {
  // An archived method can retain its own historical expense during a correction.
  if (typeof id === "string" && id === oldMethodId)
    return tx.paymentMethod.findUniqueOrThrow({ where: { id } });
  return resolveMethod(tx, null, id);
}
export async function requireExpenseFunds(
  tx: Tx,
  method: { id: string; name: string },
  amount: number,
  restoredAmount = 0,
) {
  const available =
    Math.round(((await methodBalance(tx, method.id)) + restoredAmount) * 100) /
    100;
  if (Math.round(amount * 100) > Math.round(available * 100))
    throw new FinanceError(
      `You can’t record this expense because ${method.name} has insufficient funds. Available: Rs ${available.toLocaleString("en-PK", { maximumFractionDigits: 2 })}; required: Rs ${amount.toLocaleString("en-PK", { maximumFractionDigits: 2 })}.`,
    );
}
