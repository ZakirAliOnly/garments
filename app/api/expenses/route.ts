import { requireAdmin } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/prisma";
import {
  financialTransaction,
  financeError,
  FinanceError,
} from "@/lib/finance/core";
import {
  expenseDate,
  expenseDetails,
  expenseMethod,
  requireExpenseFunds,
} from "@/lib/finance/expenses";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const params = req.nextUrl.searchParams;
    const from = params.get("from"),
      to = params.get("to"),
      methodId = params.get("methodId"),
      search = (params.get("search") ?? "").trim();
    const start = from ? expenseDate(from) : undefined,
      end = to ? expenseDate(to) : undefined;
    if (start && end && start > end)
      throw new FinanceError("From date must be before the To date");
    if (end) end.setUTCHours(23, 59, 59, 999);
    const scope = {
      sourceType: "expense",
      ...(methodId ? { paymentMethodId: methodId } : {}),
    };
    const where = {
      ...scope,
      ...(start || end
        ? {
            entryDate: {
              ...(start ? { gte: start } : {}),
              ...(end ? { lte: end } : {}),
            },
          }
        : {}),
      ...(search
        ? {
            OR: [
              {
                description: { contains: search, mode: "insensitive" as const },
              },
              { notes: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };
    const today = new Date().toLocaleDateString("en-CA", {
      timeZone: "Asia/Karachi",
    });
    const todayStart = expenseDate(today),
      todayEnd = expenseDate(today);
    todayEnd.setUTCHours(23, 59, 59, 999);
    const monthStart = expenseDate(today.slice(0, 7) + "-01"),
      monthEnd = new Date(monthStart);
    monthEnd.setUTCMonth(monthEnd.getUTCMonth() + 1);
    const [entries, filtered, day, month] = await Promise.all([
      prisma.cashBookEntry.findMany({
        where,
        orderBy: [{ entryDate: "desc" }, { createdAt: "desc" }],
        take: 250,
        include: {
          paymentMethod: { select: { id: true, name: true, active: true } },
        },
      }),
      prisma.cashBookEntry.aggregate({
        where,
        _sum: { amount: true },
        _count: true,
      }),
      prisma.cashBookEntry.aggregate({
        where: { ...scope, entryDate: { gte: todayStart, lte: todayEnd } },
        _sum: { amount: true },
      }),
      prisma.cashBookEntry.aggregate({
        where: { ...scope, entryDate: { gte: monthStart, lt: monthEnd } },
        _sum: { amount: true },
      }),
    ]);
    return NextResponse.json({
      entries,
      summary: {
        today: day._sum.amount ?? 0,
        month: month._sum.amount ?? 0,
        filtered: filtered._sum.amount ?? 0,
        count: filtered._count,
      },
      limit: 250,
    });
  } catch (error) {
    return financeError(error, "Unable to load expenses");
  }
}
export async function POST(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const body = await req.json(),
      details = expenseDetails(body);
    if (
      typeof body.requestKey !== "string" ||
      !/^[-a-zA-Z0-9]{16,100}$/.test(body.requestKey)
    )
      throw new FinanceError("An expense request key is required");
    return await financialTransaction(async (tx) => {
      const prior = await tx.cashBookEntry.findFirst({
        where: { sourceType: "expense", sourceId: body.requestKey },
        include: {
          paymentMethod: { select: { id: true, name: true, active: true } },
        },
      });
      if (prior) {
        if (
          prior.paymentMethodId !== body.paymentMethodId ||
          prior.amount !== details.amount ||
          prior.entryDate.getTime() !== details.entryDate.getTime() ||
          prior.description !== details.description ||
          prior.notes !== details.notes
        )
          throw new FinanceError(
            "This request key has already been used. Refresh before trying again.",
          );
        return NextResponse.json(prior);
      }
      const method = await expenseMethod(tx, body.paymentMethodId);
      await requireExpenseFunds(tx, method, details.amount);
      const entry = await tx.cashBookEntry.create({
        data: {
          ...details,
          type: "debit",
          sourceType: "expense",
          sourceId: body.requestKey,
          paymentMethodId: method.id,
        },
        include: {
          paymentMethod: { select: { id: true, name: true, active: true } },
        },
      });
      return NextResponse.json(entry, { status: 201 });
    });
  } catch (error) {
    return financeError(error, "Unable to record expense");
  }
}
