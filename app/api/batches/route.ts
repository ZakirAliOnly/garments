import { requireModuleAccess } from "@/lib/auth/require-admin";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/batches?stockItemId=xxx&batchNumber=BATCH-0001
// Returns all batches for a product ordered oldest-first (FIFO order).
// Includes depleted batches so callers can show full history.
export async function GET(req: NextRequest) {
  const denied = await requireModuleAccess(["stock","purchase","reports"]);
  if (denied) return denied;
  const { searchParams } = new URL(req.url);
  const stockItemId = searchParams.get("stockItemId");
  const batchNumber = searchParams.get("batchNumber");

  const where: Record<string, unknown> = {};
  if (stockItemId) where.stockItemId = stockItemId;
  if (batchNumber) where.batchNumber = { contains: batchNumber, mode: "insensitive" };

  const batches = await prisma.stockBatch.findMany({
    where,
    orderBy: { purchasedAt: "asc" },
    include: {
      stockItem: { select: { name: true, code: true, unit: true } },
    },
  });

  return NextResponse.json(batches);
}
