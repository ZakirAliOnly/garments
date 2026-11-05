import { requireModuleAccess } from "@/lib/auth/require-admin";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/reports/purchases?from=YYYY-MM-DD&to=YYYY-MM-DD
export async function GET(req: NextRequest) {
  const denied = await requireModuleAccess("reports");
  if (denied) return denied;
  try {
    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const dateFilter: Record<string, unknown> = {};
    if (from || to) {
      dateFilter.dateTime = {
        ...(from ? { gte: new Date(from) } : {}),
        ...(to ? { lte: new Date(to + "T23:59:59.999Z") } : {}),
      };
    }

    const purchases = await prisma.purchase.findMany({
      where: {
        ...dateFilter,
        transactionType: "sold",
      },
      include: {
        supplier: { select: { name: true, supplierId: true } },
      },
      orderBy: { dateTime: "asc" },
    });

    const rows = purchases.map((p) => ({
      id: p.id,
      poNumber: p.poNumber,
      supplierName: p.supplier.name,
      supplierId: p.supplier.supplierId,
      stockName: p.stockName,
      stockCode: p.stockCode,
      qty: p.qty,
      unitPrice: p.unitPrice,
      total: p.total,
      amountPaid: p.amountPaid,
      balanceDue: p.balanceDue,
      status: p.status,
      dateTime: p.dateTime.toISOString(),
      notes: p.notes,
    }));

    const totalOrders = new Set(rows.map((r) => r.poNumber)).size;
    const grandTotal = rows.reduce((s, r) => s + r.total, 0);
    const totalPaid = rows.reduce((s, r) => s + r.amountPaid, 0);
    const totalDue = rows.reduce((s, r) => s + r.balanceDue, 0);
    const paid = rows.filter((r) => r.status === "paid").length;
    const partial = rows.filter((r) => r.status === "partial").length;
    const pending = rows.filter((r) => r.status === "pending").length;

    return NextResponse.json({
      purchases: rows,
      summary: {
        totalItems: rows.length,
        totalOrders,
        grandTotal,
        totalPaid,
        totalDue,
        paid,
        partial,
        pending,
      },
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to fetch purchase report" }, { status: 500 });
  }
}
