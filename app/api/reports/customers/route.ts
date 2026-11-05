import { requireModuleAccess } from "@/lib/auth/require-admin";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/reports/customers
export async function GET(_req: NextRequest) {
  const denied = await requireModuleAccess("reports");
  if (denied) return denied;
  try {
    const customers = await prisma.customer.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        cid: true,
        name: true,
        phone: true,
        address: true,
        balance: true,
        createdAt: true,
        invoices: {
          select: {
            total: true,
            amountPaid: true,
            invoiceDate: true,
            status: true,
          },
          orderBy: { invoiceDate: "desc" },
        },
      },
    });

    const rows = customers.map((c) => {
      const totalOrders = c.invoices.length;
      const totalSpent = c.invoices.reduce((s, i) => s + i.total, 0);
      const lastPurchase = c.invoices.length > 0 ? c.invoices[0].invoiceDate : null;
      // balance > 0 means customer owes (DR); < 0 means shop owes customer (CR/advance)
      const outstandingBalance = c.balance;

      return {
        cid: c.cid,
        name: c.name,
        phone: c.phone,
        address: c.address ?? "",
        totalOrders,
        totalSpent,
        lastPurchase,
        outstandingBalance,
        createdAt: c.createdAt,
      };
    });

    const totalCustomers = rows.length;
    const activeCustomers = rows.filter((r) => r.totalOrders > 0).length;
    const totalOutstanding = rows.reduce((s, r) => s + Math.max(0, r.outstandingBalance), 0);
    const totalRevenue = rows.reduce((s, r) => s + r.totalSpent, 0);

    return NextResponse.json({
      customers: rows,
      summary: {
        totalCustomers,
        activeCustomers,
        newCustomers: totalCustomers - activeCustomers,
        totalOutstanding,
        totalRevenue,
      },
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to fetch customer report" }, { status: 500 });
  }
}
