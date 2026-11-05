import { requireModuleAccess } from "@/lib/auth/require-admin";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/refunds/lookup?invNumber=INV-0001
export async function GET(req: NextRequest) {
  const denied = await requireModuleAccess("refund");
  if (denied) return denied;
  try {
    const invNumber = req.nextUrl.searchParams.get("invNumber")?.trim();
    if (!invNumber) {
      return NextResponse.json({ error: "invNumber is required" }, { status: 400 });
    }

    const invoice = await prisma.invoice.findUnique({
      where: { invNumber },
      include: { customer: { select: { id: true, cid: true, name: true, balance: true } } },
    });
    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    const stats = await prisma.refundRequest.aggregate({
      where: { invoiceId: invoice.id },
      _sum: { amount: true },
      _count: { _all: true },
    });

    return NextResponse.json({
      invoice,
      refundStats: {
        totalAmount: stats._sum.amount ?? 0,
        totalRequests: stats._count._all ?? 0,
      },
    });
  } catch {
    return NextResponse.json({ error: "Failed to lookup invoice" }, { status: 500 });
  }
}

