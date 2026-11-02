import { requireAdmin } from "@/lib/auth/require-admin";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// DELETE /api/invoices/[id] — delete invoice and cascade dependencies
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await params;
  try {
    await prisma.$transaction(async (tx) => {
      // WorkerTask has no onDelete cascade so must be removed first
      await tx.workerTask.deleteMany({ where: { invoiceId: id } });
      await tx.invoice.delete({ where: { id } });
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to delete invoice" }, { status: 500 });
  }
}

// PATCH /api/invoices/[id] — update invoice fields
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await params;
  try {
    const body = await req.json();
    const {
      amountPaid, balanceDue, status,
      customerName, phone, invoiceDate, deliveryDate,
      description, items, subtotal, discount, total, paymentMethod,
    } = body;

    // ── Fetch old invoice state before mutating ─────────────────────────────
    const oldInvoice = await prisma.invoice.findUnique({
      where: { id },
      select: { amountPaid: true, balanceDue: true, total: true, customerId: true, invNumber: true, customerName: true, invoiceDate: true },
    });

    const invoice = await prisma.invoice.update({
      where: { id },
      data: {
        ...(amountPaid   !== undefined && { amountPaid: Number(amountPaid) }),
        ...(balanceDue   !== undefined && { balanceDue: Number(balanceDue) }),
        ...(status       !== undefined && { status }),
        ...(customerName !== undefined && { customerName }),
        ...(phone        !== undefined && { phone: phone || null }),
        ...(invoiceDate  !== undefined && { invoiceDate: new Date(invoiceDate) }),
        ...(deliveryDate !== undefined && { deliveryDate: deliveryDate ? new Date(deliveryDate) : null }),
        ...(description  !== undefined && { description: description || null }),
        ...(items        !== undefined && { items }),
        ...(subtotal     !== undefined && { subtotal: Number(subtotal) }),
        ...(discount     !== undefined && { discount: Number(discount) }),
        ...(total        !== undefined && { total: Number(total) }),
        ...(paymentMethod !== undefined && { paymentMethod }),
      },
    });

    // ── Sync customer balance when payment amounts change ──────────────────
    // balanceDelta = new balanceDue − old balanceDue
    //   negative → customer paid more → balance decreases (may flip to CR)
    //   positive → customer owes more  → balance increases
    if (oldInvoice?.customerId && (amountPaid !== undefined || balanceDue !== undefined || total !== undefined)) {
      const newBalanceDue = balanceDue !== undefined ? Number(balanceDue) : invoice.balanceDue;
      const oldBalanceDue = oldInvoice.balanceDue;
      const balanceDelta = newBalanceDue - oldBalanceDue;

      if (balanceDelta !== 0) {
        await prisma.customer.update({
          where: { id: oldInvoice.customerId },
          data: { balance: { increment: balanceDelta } },
        });
      }

      // ── Cashbook: record newly received cash ──────────────────────────────
      // paymentDelta = increase in amountPaid since last save
      const newAmountPaid = amountPaid !== undefined ? Number(amountPaid) : invoice.amountPaid;
      const paymentDelta = newAmountPaid - (oldInvoice.amountPaid ?? 0);

      if (paymentDelta > 0) {
        await prisma.cashBookEntry.create({
          data: {
            entryDate: invoice.invoiceDate,
            type: "credit",
            description: `Payment received — ${invoice.invNumber}`,
            amount: paymentDelta,
            invoice: { connect: { id } },
            customer: { connect: { id: oldInvoice.customerId } },
            notes: `Invoice ${invoice.invNumber} · ${invoice.customerName}`,
          },
        });
      }
    }

    return NextResponse.json(invoice);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to update invoice" }, { status: 500 });
  }
}
