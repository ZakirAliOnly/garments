import { requireModuleAccess } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
export async function GET() {
  const denied = await requireModuleAccess("stock");
  if (denied) return denied;
  return NextResponse.json(
    await prisma.invoice.findMany({
      orderBy: { invoiceDate: "desc" },
      select: {
        id: true,
        invNumber: true,
        type: true,
        customerName: true,
        invoiceDate: true,
        items: true,
        status: true,
      },
    }),
  );
}
