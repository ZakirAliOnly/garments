import { requireAdmin } from "@/lib/auth/require-admin";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/cashbook — list all entries with running balance
export async function GET(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type"); // "credit" | "debit" | null (all)
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");

  const where: Record<string, unknown> = {};
  if (type && type !== "all") where.type = type;
  if (dateFrom || dateTo) {
    where.entryDate = {};
    if (dateFrom) (where.entryDate as Record<string, unknown>).gte = new Date(dateFrom);
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      (where.entryDate as Record<string, unknown>).lte = end;
    }
  }

  // Fetch ALL entries sorted by date asc for running balance calculation
  const allEntries = await prisma.cashBookEntry.findMany({
    orderBy: { entryDate: "asc" },
    include: {
      customer: { select: { cid: true, name: true } },
      invoice: { select: { invNumber: true, total: true, amountPaid: true, balanceDue: true, status: true, customerName: true, items: true, invoiceDate: true, subtotal: true, discount: true, phone: true, address: true } },
    },
  });

  // Compute running balance for all entries
  let runningBalance = 0;
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
  const totalIncome = allEntries.filter(e => e.type === "credit").reduce((s, e) => s + e.amount, 0);
  const totalExpense = allEntries.filter(e => e.type === "debit").reduce((s, e) => s + e.amount, 0);
  const netBalance = totalIncome - totalExpense;

  return NextResponse.json({
    entries: filtered.reverse(), // newest first for display
    totals: { totalIncome, totalExpense, netBalance },
  });
}

// POST /api/cashbook — create a manual entry
export async function POST(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const body = await req.json();
    const { entryDate, type, description, amount, notes, customerId, invoiceId } = body;

    if (!entryDate || !type || !description || !amount) {
      return NextResponse.json({ error: "entryDate, type, description, and amount are required" }, { status: 400 });
    }
    if (!["credit", "debit"].includes(type)) {
      return NextResponse.json({ error: "type must be 'credit' or 'debit'" }, { status: 400 });
    }

    const entryD = new Date(entryDate);

    const entry = await prisma.cashBookEntry.create({
      data: {
        entryDate: entryD,
        type,
        description,
        amount: Number(amount),
        notes: notes || null,
        customer: customerId ? { connect: { id: customerId } } : undefined,
        invoice: invoiceId ? { connect: { id: invoiceId } } : undefined,
      },
      include: {
        customer: { select: { cid: true, name: true } },
        invoice: { select: { invNumber: true } },
      },
    });

    // ── Sync customer balance for manual (non-invoice-linked) entries ──────
    // credit → customer paid us → balance decreases (they owe less / advance builds up)
    // debit  → we paid customer → balance increases (they owe more / advance reduced)
    if (customerId && !invoiceId) {
      const balanceChange = type === "credit" ? -Number(amount) : Number(amount);
      await prisma.customer.update({
        where: { id: customerId },
        data: { balance: { increment: balanceChange } },
      });
    }

    return NextResponse.json(entry, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to create cashbook entry" }, { status: 500 });
  }
}
