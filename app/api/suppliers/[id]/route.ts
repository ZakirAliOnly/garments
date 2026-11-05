import { requireModuleAccess } from "@/lib/auth/require-admin";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireModuleAccess("purchase");
  if (denied) return denied;
  try {
    const { id } = await params;
    const body = await req.json();
    const { name, phone, city, category, notes } = body;

    if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 });

    const supplier = await prisma.supplier.update({
      where: { id },
      data: {
        name,
        phone: phone || null,
        city: city || null,
        category: category || null,
        notes: notes || null,
      },
    });
    return NextResponse.json(supplier);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to update supplier" }, { status: 500 });
  }
}
