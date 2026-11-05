import { activityActor, activityTransaction } from "@/lib/activity-context";
import { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
export type Tx = Prisma.TransactionClient;
export class FinanceError extends Error {}
export function money(
  value: unknown,
  field = "Amount",
  allowZero = true,
): number {
  const number = Number(value);
  if (
    value === null ||
    value === undefined ||
    value === "" ||
    !Number.isFinite(number) ||
    number < 0 ||
    (!allowZero && number === 0) ||
    number > 1e12
  )
    throw new FinanceError(
      `${field} must be a valid ${allowZero ? "non-negative" : "positive"} amount`,
    );
  return Math.round((number + Number.EPSILON) * 100) / 100;
}
export function date(value: unknown): Date {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}/.test(value))
    throw new FinanceError("A valid date is required");
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new FinanceError("Invalid date");
  return parsed;
}
function isTransactionConflict(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  // Prisma errors can cross runtime/module boundaries, so inspect the stable
  // error codes instead of depending on a particular generated class instance.
  if ("code" in error && error.code === "P2034") return true;
  return (
    "name" in error &&
    error.name === "DriverAdapterError" &&
    "cause" in error &&
    typeof error.cause === "object" &&
    error.cause !== null &&
    "kind" in error.cause &&
    error.cause.kind === "TransactionWriteConflict"
  );
}
export async function financialTransaction<T>(
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      const actor = await activityActor();
      return await prisma.$transaction(
        async (tx) => {
          await tx.$executeRaw`SELECT set_config('garments.actor', ${actor}, true)`;
          return activityTransaction.run(true, () => fn(tx));
        },
        {
          isolationLevel: "Serializable",
          timeout: 25000,
        },
      );
    } catch (error) {
      if (isTransactionConflict(error) && attempt < 3) continue;
      throw error;
    }
  }
}
export function financeError(error: unknown, fallback: string) {
  if (isTransactionConflict(error))
    return NextResponse.json(
      {
        error:
          "The payment balance changed while saving. Refresh and try again.",
      },
      { status: 409 },
    );
  if (error instanceof FinanceError)
    return NextResponse.json({ error: error.message }, { status: 400 });
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  )
    return NextResponse.json(
      {
        error:
          "This record already exists or was already processed. Refresh before trying again.",
      },
      { status: 409 },
    );
  console.error(fallback, error);
  return NextResponse.json({ error: fallback }, { status: 500 });
}
export async function resolveMethod(tx: Tx, name: unknown, id?: unknown) {
  if (typeof id !== "string" && (typeof name !== "string" || !name.trim()))
    throw new FinanceError("Select a payment method");
  const method =
    typeof id === "string" && id
      ? await tx.paymentMethod.findUnique({ where: { id } })
      : await tx.paymentMethod.findUnique({
          where: { name: String(name).trim() },
        });
  if (!method || !method.active)
    throw new FinanceError("Select an active payment method");
  return method;
}
export async function methodBalance(tx: Tx, id: string): Promise<number> {
  const method = await tx.paymentMethod.findUniqueOrThrow({ where: { id } });
  const entries = await tx.cashBookEntry.groupBy({
    by: ["type"],
    where: { paymentMethodId: id },
    _sum: { amount: true },
  });
  return (
    Math.round(
      (Number(method.openingBalance) +
        entries.reduce(
          (sum, entry) =>
            sum + (entry.type === "credit" ? 1 : -1) * (entry._sum.amount ?? 0),
          0,
        )) *
        100,
    ) / 100
  );
}
