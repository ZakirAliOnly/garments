import { FinanceError, money } from "./core";
export function payrollMonth(value: unknown): string {
  if (typeof value !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value))
    throw new FinanceError("Select a payroll month (YYYY-MM)");
  return value;
}
export function payrollTotals(
  wage: number,
  adjustments: { kind: string; amount: unknown }[],
  absentDays: number,
) {
  if (!Number.isFinite(absentDays) || absentDays < 0 || absentDays > 30)
    throw new FinanceError("Absent days must be between 0 and 30");
  const extra = money(
    adjustments
      .filter((a) => a.kind === "extra")
      .reduce((s, a) => s + Number(a.amount), 0),
  );
  const advances = money(
    adjustments
      .filter((a) => a.kind === "advance")
      .reduce((s, a) => s + Number(a.amount), 0),
  );
  const absence = money((wage / 30) * absentDays);
  const gross = Math.round((wage + extra - absence) * 100) / 100;
  return {
    wage,
    extra,
    advances,
    absence,
    gross,
    net: Math.round((gross - advances) * 100) / 100,
  };
}
