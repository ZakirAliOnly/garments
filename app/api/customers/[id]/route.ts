import { requireAdmin } from "@/lib/auth/require-admin";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { revalidateTag } from "next/cache";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const { id } = await params;
    await prisma.customer.delete({ where: { id } });
    revalidateTag("customers-lean", "default");
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete customer" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const { id } = await params;
    const { name, phone, address, whatsapp, reference, notes, balance, taxIdType, taxIdNumber } = await req.json();
    if (!name?.trim()) return NextResponse.json({ error: "Full name is required" }, { status: 400 });
    if (!phone?.trim()) return NextResponse.json({ error: "Phone number is required" }, { status: 400 });
    const customer = await prisma.customer.update({
      where: { id },
      data: {
        name: name.trim(),
        phone: phone.trim(),
        address: address?.trim() || null,
        whatsapp: whatsapp?.trim() || null,
        reference: reference?.trim() || null,
        notes: notes?.trim() || null,
        balance: parseFloat(balance) || 0,
        taxIdType: taxIdType?.trim() || null,
        taxIdNumber: taxIdNumber?.trim() || null,
      },
      include: { header: { select: { name: true, prefix: true } } },
    });
    revalidateTag("customers-lean", "default");
    return NextResponse.json(customer);
  } catch {
    return NextResponse.json({ error: "Failed to update account" }, { status: 500 });
  }
}
