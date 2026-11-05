import { requireModuleAccess } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/prisma";
import { financeError } from "@/lib/finance/core";
import { payrollMonth, payrollTotals } from "@/lib/finance/payroll";
import { NextRequest, NextResponse } from "next/server";
export async function GET(req: NextRequest) {
  const denied = await requireModuleAccess("workers");
  if (denied) return denied;
  try {
    const month = payrollMonth(req.nextUrl.searchParams.get("month"));
    const workers = await prisma.worker.findMany({
      orderBy: { createdAt: "asc" },
      include: {
        payrolls: {
          where: { month },
          include: { adjustments: { orderBy: { createdAt: "desc" } } },
        },
      },
    });
    return NextResponse.json({
      month,
      workers: workers.map((w) => {
        const payroll = w.payrolls[0];
        return {
          ...w,
          extraHoursRate: Number(w.extraHoursRate),
          payroll: payroll ?? null,
          totals: payrollTotals(
            payroll
              ? Number(payroll.monthlyWage)
              : w.salaryType === "monthly"
                ? w.rate
                : 0,
            payroll?.adjustments ?? [],
            Number(payroll?.absentDays ?? 0),
          ),
        };
      }),
    });
  } catch (error) {
    return financeError(error, "Unable to load payroll");
  }
}
