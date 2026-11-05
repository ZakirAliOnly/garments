import { requireExpenseFunds } from "@/lib/finance/expenses";
import {
  financialTransaction,
  financeError,
  FinanceError,
  money,
  date,
  resolveMethod,
} from "@/lib/finance/core";
import { requireAdmin } from "@/lib/auth/require-admin";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/cashbook — list all entries with running balance
export async function GET(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { searchParams } = new URL(req.url);
  const paymentMethodId = searchParams.get("paymentMethodId");
  const type = searchParams.get("type"); // "credit" | "debit" | null (all)
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");

  const where: Record<string, unknown> = {};
  if (type && type !== "all") where.type = type;
  if (dateFrom || dateTo) {
    where.entryDate = {};
    if (dateFrom)
      (where.entryDate as Record<string, unknown>).gte = new Date(dateFrom);
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      (where.entryDate as Record<string, unknown>).lte = end;
    }
  }

  // Fetch ALL entries sorted by date asc for running balance calculation
  const allEntries = await prisma.cashBookEntry.findMany({
    where: paymentMethodId ? { paymentMethodId } : {},
    orderBy: [{ entryDate: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    include: {
      paymentMethod: { select: { id: true, name: true } },
      customer: { select: { cid: true, name: true } },
      invoice: {
        select: {
          invNumber: true,
          total: true,
          amountPaid: true,
          balanceDue: true,
          status: true,
          customerName: true,
          items: true,
          invoiceDate: true,
          subtotal: true,
          discount: true,
          phone: true,
          address: true,
        },
      },
    },
  });

  // Compute running balance for all entries
  const methods = await prisma.paymentMethod.findMany({
    where: paymentMethodId ? { id: paymentMethodId } : {},
    select: { openingBalance: true },
  });
  const openingBalance = methods.reduce(
    (sum, m) => sum + Number(m.openingBalance),
    0,
  );
  let runningBalance = openingBalance;
  const withBalance = allEntries.map((entry) => {
    if (entry.type === "credit") runningBalance += entry.amount;
    else runningBalance -= entry.amount;
    return { ...entry, balance: runningBalance };
  });

  // Apply filters AFTER computing balance (so balance reflects full history)
  const filtered = withBalance.filter((e) => {
    if (type && type !== "all" && e.type !== type) return false;
    if (dateFrom && e.entryDate < new Date(dateFrom)) return false;
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      if (e.entryDate > end) return false;
    }
    return true;
  });

  // Totals (always over the full dataset)
  const totalIncome = allEntries
    .filter((e) => e.type === "credit" && e.sourceType !== "transfer")
    .reduce((s, e) => s + e.amount, 0);
  const totalExpense = allEntries
    .filter((e) => e.type === "debit" && e.sourceType !== "transfer")
    .reduce((s, e) => s + e.amount, 0);
  const netBalance = runningBalance;

  return NextResponse.json({
    entries: filtered.reverse(), // newest first for display
    totals: { totalIncome, totalExpense, netBalance },
  });
}

// POST /api/cashbook — one atomic manual ledger movement
export async function POST(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const b = await req.json();
    return await financialTransaction(async (tx) => {
      if (
        !["credit", "debit"].includes(b.type) ||
        typeof b.description !== "string" ||
        !b.description.trim()
      )
        throw new FinanceError("A type and description are required");
      if (b.invoiceId)
        throw new FinanceError("Record invoice payments from the Invoice page");
      const amount = money(b.amount, "Amount", false),
        entryDate = date(b.entryDate),
        method = await resolveMethod(
          tx,
          b.paymentMethod || "Cash",
          b.paymentMethodId,
        );
      if (b.type === "debit") await requireExpenseFunds(tx, method, amount);
      const entry = await tx.cashBookEntry.create({
        data: {
          paymentMethodId: method.id,
          entryDate,
          type: b.type,
          description: b.description.trim(),
          amount,
          notes: typeof b.notes === "string" ? b.notes.trim() : null,
          customerId: b.customerId || null,
        },
        include: {
          customer: { select: { cid: true, name: true } },
          paymentMethod: { select: { id: true, name: true } },
        },
      });
      if (b.customerId)
        await tx.customer.update({
          where: { id: b.customerId },
          data: {
            balance: { increment: b.type === "credit" ? -amount : amount },
          },
        });
      return NextResponse.json(entry, { status: 201 });
    });
  } catch (error) {
    return financeError(error, "Failed to create cashbook entry");
  }
}
