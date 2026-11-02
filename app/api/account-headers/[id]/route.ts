import { requireAdmin } from "@/lib/auth/require-admin";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { revalidateTag } from "next/cache";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const { id } = await params;
    const count = await prisma.customer.count({ where: { headerId: id } });
    if (count > 0)
      return NextResponse.json({ error: `Cannot delete: ${count} account(s) use this header` }, { status: 400 });
    await prisma.accountHeader.delete({ where: { id } });
    revalidateTag("account-headers", "default");
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete header" }, { status: 500 });
  }
}
