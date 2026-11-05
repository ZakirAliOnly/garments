import { requireModuleAccess } from "@/lib/auth/require-admin";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/reports/invoices?from=YYYY-MM-DD&to=YYYY-MM-DD
export async function GET(req: NextRequest) {
  const denied = await requireModuleAccess("reports");
  if (denied) return denied;
  try {
    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const where: Record<string, unknown> = {};
    if (from || to) {
      where.invoiceDate = {
        ...(from ? { gte: new Date(from) } : {}),
        ...(to ? { lte: new Date(to + "T23:59:59.999Z") } : {}),
      };
    }

    const invoices = await prisma.invoice.findMany({
      where,
      orderBy: { invoiceDate: "desc" },
      select: {
        invNumber: true,
        type: true,
        customerName: true,
        phone: true,
        invoiceDate: true,
        items: true,
        subtotal: true,
        discount: true,
        total: true,
        amountPaid: true,
        balanceDue: true,
        paymentMethod: true,
        status: true,
      },
    });

    const totalRevenue = invoices.reduce((s, i) => s + i.total, 0);
    const totalCollected = invoices.reduce((s, i) => s + i.amountPaid, 0);
    const totalOutstanding = invoices.reduce((s, i) => s + i.balanceDue, 0);
    const byStatus = { paid: 0, pending: 0, partial: 0 };
    invoices.forEach((i) => {
      byStatus[i.status as keyof typeof byStatus]++;
    });

    return NextResponse.json({
      invoices,
      summary: {
        total: invoices.length,
        totalRevenue,
        totalCollected,
        totalOutstanding,
        ...byStatus,
      },
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to fetch invoice report" }, { status: 500 });
  }
}
