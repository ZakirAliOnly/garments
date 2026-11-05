import { requireModuleAccess } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
export async function GET(req: NextRequest) {
  const purpose = req.nextUrl.searchParams.get("purpose");
  if (!["invoice", "refund", "purchase"].includes(purpose ?? ""))
    return NextResponse.json(
      { error: "Choose a valid lookup purpose" },
      { status: 400 },
    );
  const denied = await requireModuleAccess(
    purpose as "invoice" | "refund" | "purchase",
  );
  if (denied) return denied;
  return NextResponse.json(
    await prisma.stockItem.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        code: true,
        sku: true,
        unit: true,
        salesPrice: true,
        hasVariants: true,
        ...(purpose === "purchase"
          ? { purchasePrice: true, quantity: true, category: true }
          : {}),
        variants: {
          select: {
            id: true,
            sku: true,
            size: true,
            color: true,
            quantity: true,
            salesPrice: true,
            ...(purpose === "purchase" ? { purchasePrice: true } : {}),
          },
        },
      },
    }),
  );
}
