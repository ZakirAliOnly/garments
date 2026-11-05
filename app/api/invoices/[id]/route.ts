import { requireModuleAccess } from "@/lib/auth/require-admin";
import {
  financialTransaction,
  financeError,
  FinanceError,
  money,
  date,
  resolveMethod,
} from "@/lib/finance/core";
import { NextRequest, NextResponse } from "next/server";
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await requireModuleAccess("invoice");
  if (denied) return denied;
  try {
    const { id } = await params;
    return await financialTransaction(async (tx) => {
      const invoice = await tx.invoice.findUnique({ where: { id } });
      if (!invoice) throw new FinanceError("Invoice not found");
      if (
        invoice.amountPaid > 0 ||
        (await tx.cashBookEntry.count({ where: { invoiceId: id } })) ||
        invoice.isRefunded
      )
        throw new FinanceError(
          "Paid or refunded invoices cannot be deleted. Use Refund & Replace to record a money return.",
        );
      if (invoice.customerId)
        await tx.customer.update({
          where: { id: invoice.customerId },
          data: { balance: { decrement: invoice.balanceDue } },
        });
      await tx.workerTask.deleteMany({ where: { invoiceId: id } });
      await tx.invoice.delete({ where: { id } });
      return NextResponse.json({ success: true });
    });
  } catch (error) {
    return financeError(error, "Failed to delete invoice");
  }
}
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await requireModuleAccess("invoice");
  if (denied) return denied;
  try {
    const { id } = await params,
      b = await req.json();
    return await financialTransaction(async (tx) => {
      const old = await tx.invoice.findUnique({ where: { id } });
      if (!old) throw new FinanceError("Invoice not found");
      if (old.status === "returned")
        throw new FinanceError("Fully returned invoices are locked");
      const total = b.total === undefined ? old.total : money(b.total, "Total"),
        paid =
          b.amountPaid === undefined
            ? old.amountPaid
            : money(b.amountPaid, "Paid amount");
      if (paid < old.amountPaid)
        throw new FinanceError(
          "Use Refund & Replace to return money; paid amounts cannot be reduced by editing an invoice",
        );
      if (total < old.amountPaid)
        throw new FinanceError(
          "Use Refund & Replace to reduce an invoice below its paid amount",
        );
      const delta = Math.round((paid - old.amountPaid) * 100) / 100;
      const method =
        delta > 0 ||
        b.paymentMethod !== undefined ||
        b.paymentMethodId !== undefined
          ? await resolveMethod(
              tx,
              b.paymentMethod || old.paymentMethod || "Cash",
              b.paymentMethodId,
            )
          : null;
      const due = Math.max(0, Math.round((total - paid) * 100) / 100);
      const updated = await tx.invoice.update({
        where: { id },
        data: {
          total,
          amountPaid: paid,
          balanceDue: due,
          status: due <= 0 ? "paid" : paid > 0 ? "partial" : "pending",
          ...(method ? { paymentMethod: method.name } : {}),
          ...(b.customerName !== undefined
            ? {
                customerName:
                  String(b.customerName).trim() || "Walk-in Customer",
              }
            : {}),
          ...(b.phone !== undefined ? { phone: b.phone || null } : {}),
          ...(b.invoiceDate !== undefined
            ? { invoiceDate: date(b.invoiceDate) }
            : {}),
          ...(b.deliveryDate !== undefined
            ? { deliveryDate: b.deliveryDate ? date(b.deliveryDate) : null }
            : {}),
          ...(b.description !== undefined
            ? { description: b.description || null }
            : {}),
          ...(b.items !== undefined ? { items: b.items } : {}),
          ...(b.subtotal !== undefined
            ? { subtotal: money(b.subtotal, "Subtotal") }
            : {}),
          ...(b.discount !== undefined
            ? { discount: money(b.discount, "Discount") }
            : {}),
        },
      });
      if (old.customerId) {
        const balanceChange = total - old.total - delta;
        if (balanceChange)
          await tx.customer.update({
            where: { id: old.customerId },
            data: { balance: { increment: balanceChange } },
          });
      }
      if (delta > 0)
        await tx.cashBookEntry.create({
          data: {
            paymentMethodId: method!.id,
            entryDate: new Date(),
            type: "credit",
            amount: delta,
            description: `Payment received — ${updated.invNumber}`,
            invoiceId: id,
            customerId: old.customerId,
            sourceType: "invoice",
            sourceId: id,
          },
        });
      return NextResponse.json(updated);
    });
  } catch (error) {
    return financeError(error, "Failed to update invoice");
  }
}
