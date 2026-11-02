import { requireAdmin } from "@/lib/auth/require-admin";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/reports/refunds?from=YYYY-MM-DD&to=YYYY-MM-DD
export async function GET(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const where: Record<string, unknown> = {};
    if (from || to) {
      where.createdAt = {
        ...(from ? { gte: new Date(from) } : {}),
        ...(to ? { lte: new Date(to + "T23:59:59.999Z") } : {}),
      };
    }

    const refunds = await prisma.refundRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: {
        rrNumber: true,
        invoiceNumber: true,
        customerName: true,
        type: true,
        reason: true,
        amount: true,
        items: true,
        createdAt: true,
      },
    });

    const totalAmount = refunds.reduce((s, r) => s + r.amount, 0);
    const byType = { refund: 0, replace: 0 };
    refunds.forEach((r) => {
      byType[r.type as keyof typeof byType]++;
    });

    return NextResponse.json({
      refunds,
      summary: {
        total: refunds.length,
        totalAmount,
        ...byType,
      },
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to fetch refund report" }, { status: 500 });
  }
}
