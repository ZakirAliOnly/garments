import { requireAdmin } from "@/lib/auth/require-admin";
import {
  financialTransaction,
  financeError,
  FinanceError,
  money,
  date,
  resolveMethod,
} from "@/lib/finance/core";
import { payrollMonth, payrollTotals } from "@/lib/finance/payroll";
import { NextRequest, NextResponse } from "next/server";
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const { id } = await params,
      b = await req.json(),
      month = payrollMonth(b.month),
      entryDate = date(b.entryDate);
    if (!["advance", "extra", "pay"].includes(b.action))
      throw new FinanceError("Choose a valid payroll action");
    if (typeof b.requestKey !== "string" || b.requestKey.length < 16)
      throw new FinanceError("A payment request key is required");
    return await financialTransaction(async (tx) => {
      const worker = await tx.worker.findUnique({ where: { id } });
      if (!worker || worker.status !== "active")
        throw new FinanceError("Select an active worker");
      if (worker.salaryType !== "monthly")
        throw new FinanceError(
          "Set a monthly wage for this worker before using monthly payroll",
        );
      let payroll = await tx.workerPayroll.findUnique({
        where: { workerId_month: { workerId: id, month } },
        include: { adjustments: true },
      });
      if (!payroll)
        payroll = await tx.workerPayroll.create({
          data: { workerId: id, month, monthlyWage: worker.rate },
          include: { adjustments: true },
        });
      if (payroll.paidAt)
        throw new FinanceError(
          "Wages for this month are already paid. This month is locked.",
        );
      if (
        await tx.payrollAdjustment.findUnique({
          where: { requestKey: b.requestKey },
        })
      )
        throw new FinanceError("This adjustment has already been recorded");
      if (b.action === "pay") {
        const absentDays = money(b.absentDays ?? 0, "Absent days");
        const totals = payrollTotals(
          Number(payroll.monthlyWage),
          payroll.adjustments,
          absentDays,
        );
        if (totals.net < 0)
          throw new FinanceError(
            "Advances exceed adjusted wages. Review and resolve the excess advance before finalizing this month.",
          );
        const method = await resolveMethod(
          tx,
          b.paymentMethod,
          b.paymentMethodId,
        );
        const updated = await tx.workerPayroll.update({
          where: { id: payroll.id },
          data: {
            absentDays,
            paidAmount: totals.net,
            paidAt: entryDate,
            paymentMethodName: method.name,
            notes: typeof b.notes === "string" ? b.notes.trim() : null,
          },
        });
        if (totals.net > 0)
          await tx.cashBookEntry.create({
            data: {
              paymentMethodId: method.id,
              entryDate,
              type: "debit",
              amount: totals.net,
              description: `Wages — ${worker.name} · ${month}`,
              sourceType: "payroll",
              sourceId: payroll.id,
              notes: updated.notes,
            },
          });
        return NextResponse.json(updated, { status: 201 });
      }
      let amount: number;
      let hours: number | undefined, rate: number | undefined;
      let method;
      if (b.action === "extra") {
        hours = money(b.hours, "Extra hours", false);
        rate = money(b.rate, "Hourly rate", false);
        amount = money(hours * rate, "Extra-hours amount", false);
      } else {
        amount = money(b.amount, "Advance", false);
        method = await resolveMethod(tx, b.paymentMethod, b.paymentMethodId);
        const totals = payrollTotals(
          Number(payroll.monthlyWage),
          payroll.adjustments,
          Number(payroll.absentDays),
        );
        if (amount > totals.net)
          throw new FinanceError(
            "Advance exceeds the remaining wages for this month",
          );
      }
      const adjustment = await tx.payrollAdjustment.create({
        data: {
          payrollId: payroll.id,
          kind: b.action,
          amount,
          hours,
          rate,
          entryDate,
          paymentMethodName: method?.name,
          notes: typeof b.notes === "string" ? b.notes.trim() : null,
          requestKey: b.requestKey,
        },
      });
      if (method)
        await tx.cashBookEntry.create({
          data: {
            paymentMethodId: method.id,
            entryDate,
            type: "debit",
            amount,
            description: `Worker advance — ${worker.name} · ${month}`,
            sourceType: "payroll-advance",
            sourceId: adjustment.id,
            notes: adjustment.notes,
          },
        });
      return NextResponse.json(adjustment, { status: 201 });
    });
  } catch (error) {
    return financeError(error, "Unable to record payroll transaction");
  }
}
