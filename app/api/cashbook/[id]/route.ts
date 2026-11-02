import { requireAdmin } from "@/lib/auth/require-admin";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// PATCH /api/cashbook/[id] — edit a manual entry
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await params;
  try {
    const existing = await prisma.cashBookEntry.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    if (existing.invoiceId) return NextResponse.json({ error: "Cannot edit invoice-linked entries" }, { status: 403 });

    const body = await req.json();
    const { entryDate, type, description, amount, notes, customerId } = body;

    if (!entryDate || !type || !description || amount == null) {
      return NextResponse.json({ error: "entryDate, type, description, and amount are required" }, { status: 400 });
    }
    if (!["credit", "debit"].includes(type)) {
      return NextResponse.json({ error: "type must be 'credit' or 'debit'" }, { status: 400 });
    }

    const entryD = new Date(entryDate);

    const updated = await prisma.cashBookEntry.update({
      where: { id },
      data: {
        entryDate: entryD,
        type,
        description: description.trim(),
        amount: Number(amount),
        notes: notes?.trim() || null,
        customerId: customerId || null,
      },
      include: {
        customer: { select: { cid: true, name: true } },
        invoice: { select: { invNumber: true } },
      },
    });

    // ── Reverse old balance effect, apply new one ──────────────────────────
    // Only manual (non-invoice-linked) entries that involve a customer affect balance.
    const oldCustomerId = existing.customerId;
    const newCustomerId = customerId || null;

    // Reverse old effect
    if (oldCustomerId) {
      const oldBalanceChange = existing.type === "credit" ? existing.amount : -existing.amount;
      await prisma.customer.update({
        where: { id: oldCustomerId },
        data: { balance: { increment: oldBalanceChange } }, // reverse: credit was -amount, so add back
      });
    }
    // Apply new effect
    if (newCustomerId) {
      const newBalanceChange = type === "credit" ? -Number(amount) : Number(amount);
      await prisma.customer.update({
        where: { id: newCustomerId },
        data: { balance: { increment: newBalanceChange } },
      });
    }

    return NextResponse.json(updated);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to update entry" }, { status: 500 });
  }
}

// DELETE /api/cashbook/[id]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await params;
  try {
    const existing = await prisma.cashBookEntry.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Entry not found" }, { status: 404 });

    await prisma.cashBookEntry.delete({ where: { id } });

    // ── Reverse balance effect for manual customer-linked entries ──────────
    if (existing.customerId && !existing.invoiceId) {
      // Reverse: credit had decremented balance, so increment to restore
      const reverseChange = existing.type === "credit" ? existing.amount : -existing.amount;
      await prisma.customer.update({
        where: { id: existing.customerId },
        data: { balance: { increment: reverseChange } },
      });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Entry not found" }, { status: 404 });
  }
}
