import { requireModuleAccess } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
export async function GET() {
  const denied = await requireModuleAccess(["invoice", "cashbook", "reports"]);
  if (denied) return denied;
  return NextResponse.json(
    await prisma.customer.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        cid: true,
        name: true,
        phone: true,
        address: true,
        balance: true,
      },
    }),
  );
}
