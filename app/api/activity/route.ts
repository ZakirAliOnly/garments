import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireModuleAccess } from "@/lib/auth/require-admin";
export async function GET(req: NextRequest) {
  const denied = await requireModuleAccess("activity");
  if (denied) return denied;
  const params = req.nextUrl.searchParams;
  const range = params.get("range") ?? "30";
  if (!["today", "7", "30", "90", "all"].includes(range))
    return NextResponse.json({ error: "Invalid date range" }, { status: 400 });
  const kind = params.get("type") ?? "all";
  const kinds: Record<string, string[]> = {
    invoices: ["Invoice"],
    payments: ["CashBookEntry"],
    tasks: ["WorkerTask"],
    payroll: ["WorkerPayroll", "PayrollAdjustment"],
    stock: ["StockItem"],
    purchases: ["Purchase", "Supplier"],
    refunds: ["RefundRequest"],
    methods: ["PaymentMethod", "PaymentTransfer"],
    users: ["AdminUser"],
    workers: ["Worker"],
    customers: ["Customer"],
  };
  if (kind !== "all" && !kinds[kind])
    return NextResponse.json(
      { error: "Invalid activity type" },
      { status: 400 },
    );
  const page = Number(params.get("page") ?? "1");
  if (!Number.isSafeInteger(page) || page < 1 || page > 100000)
    return NextResponse.json({ error: "Invalid page" }, { status: 400 });
  const now = new Date();
  // Shop dates use Pakistan time; Today starts at midnight in Asia/Karachi.
  const start =
    range === "all"
      ? undefined
      : range === "today"
        ? new Date(
            new Date(now.getTime() + 5 * 3600000).toISOString().slice(0, 10) +
              "T00:00:00+05:00",
          )
        : new Date(now.getTime() - Number(range) * 86400000);
  const where: Prisma.ActivityEventWhereInput = {
    ...(start ? { createdAt: { gte: start } } : {}),
    ...(kind === "all" ? {} : { entityType: { in: kinds[kind] } }),
  };
  try {
    const [total, events, invoice, incoming, outgoing, tasks] =
      await prisma.$transaction(
        [
          prisma.activityEvent.count({ where }),
          prisma.activityEvent.findMany({
            where,
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            skip: (page - 1) * 50,
            take: 50,
          }),
          prisma.activityEvent.aggregate({
            where: { ...where, type: "Invoice Created" },
            _count: true,
            _sum: { amount: true },
          }),
          prisma.activityEvent.aggregate({
            where: { ...where, direction: "in" },
            _sum: { amount: true },
          }),
          prisma.activityEvent.aggregate({
            where: { ...where, direction: "out" },
            _sum: { amount: true },
          }),
          prisma.activityEvent.count({
            where: { AND: [where, { entityType: "WorkerTask" }] },
          }),
        ],
        { isolationLevel: "RepeatableRead" },
      );
    return NextResponse.json({
      events,
      total,
      page,
      pageSize: 50,
      summary: {
        invoices: invoice._count,
        invoiceAmount: Number(invoice._sum.amount ?? 0),
        cashIn: Number(incoming._sum.amount ?? 0),
        cashOut: Number(outgoing._sum.amount ?? 0),
        tasks,
      },
    });
  } catch (error) {
    console.error("Activity log failed", error);
    return NextResponse.json(
      { error: "Unable to load activity log" },
      { status: 500 },
    );
  }
}
