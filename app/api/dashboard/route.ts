import { requireModuleAccess } from "@/lib/auth/require-admin";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const denied = await requireModuleAccess("dashboard");
  if (denied) return denied;
  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const [totalCustomers, stockItems, recentCustomers, walkInMonthly, regularMonthly, dailyInvoices] =
      await Promise.all([
        prisma.customer.count(),
        prisma.stockItem.findMany({
          select: { quantity: true, purchasePrice: true, lowStockThreshold: true },
        }),
        prisma.customer.findMany({
          orderBy: { createdAt: "desc" },
          take: 5,
          select: { cid: true, name: true, createdAt: true },
        }),
        prisma.invoice.aggregate({
          where: { type: "walk", invoiceDate: { gte: monthStart, lte: monthEnd } },
          _sum: { total: true },
          _count: true,
        }),
        prisma.invoice.aggregate({
          where: { type: "regular", invoiceDate: { gte: monthStart, lte: monthEnd } },
          _sum: { total: true },
          _count: true,
        }),
        prisma.invoice.findMany({ where: { invoiceDate: { gte: monthStart, lte: monthEnd } }, select: { invoiceDate: true, total: true } }),
      ]);

    const salesByDay = Array.from({ length: monthEnd.getDate() }, (_, i) => ({ day: i + 1, total: 0 }));
    for (const invoice of dailyInvoices) salesByDay[invoice.invoiceDate.getDate() - 1].total += invoice.total;

    const lowStock = stockItems.filter(
      (i) => i.quantity > 0 && i.quantity <= i.lowStockThreshold,
    ).length;
    const outOfStock = stockItems.filter((i) => i.quantity <= 0).length;
    const stockValue = stockItems.reduce((sum, i) => sum + i.quantity * i.purchasePrice, 0);

    const walkInSales = walkInMonthly._sum.total ?? 0;
    const regularSales = regularMonthly._sum.total ?? 0;
    const totalMonthlySales = walkInSales + regularSales;

    return NextResponse.json({
      salesByDay,
      totalCustomers,
      lowStock,
      outOfStock,
      stockValue,
      recentCustomers,
      monthlySales: {
        walkIn: walkInSales,
        walkInCount: walkInMonthly._count,
        regular: regularSales,
        regularCount: regularMonthly._count,
        total: totalMonthlySales,
      },
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch dashboard data" }, { status: 500 });
  }
}
