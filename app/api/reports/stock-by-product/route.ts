import { requireModuleAccess } from "@/lib/auth/require-admin";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/reports/stock-by-product?from=YYYY-MM-DD&to=YYYY-MM-DD&ids=id1,id2
export async function GET(req: NextRequest) {
  const denied = await requireModuleAccess("reports");
  if (denied) return denied;
  try {
    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const idsParam = searchParams.get("ids"); // comma-separated stockItem ids

    const fromDate = from ? new Date(from) : undefined;
    const toDate = to ? new Date(to + "T23:59:59.999Z") : undefined;
    const selectedIds = idsParam ? idsParam.split(",").filter(Boolean) : [];

    const stockWhere: Record<string, unknown> = {};
    if (selectedIds.length > 0) {
      stockWhere.id = { in: selectedIds };
    }

    const stockItems = await prisma.stockItem.findMany({
      where: stockWhere,
      orderBy: { name: "asc" },
      select: {
        id: true,
        code: true,
        name: true,
        category: true,
        unit: true,
        quantity: true,
        purchasePrice: true,
        salesPrice: true,
        hasVariants: true,
        variants: {
          select: {
            id: true,
            sku: true,
            size: true,
            color: true,
            quantity: true,
            purchasePrice: true,
            salesPrice: true,
          },
        },
      },
    });

    const itemIds = stockItems.map((s) => s.id);

    // Purchases in date range for selected items
    const purchaseDateFilter: Record<string, unknown> = {};
    if (fromDate || toDate) {
      purchaseDateFilter.dateTime = {
        ...(fromDate ? { gte: fromDate } : {}),
        ...(toDate ? { lte: toDate } : {}),
      };
    }
    const purchases = await prisma.purchase.findMany({
      where: {
        ...purchaseDateFilter,
        transactionType: "sold",
        ...(itemIds.length > 0 ? { stockItemId: { in: itemIds } } : {}),
      },
      select: { stockItemId: true, qty: true },
    });

    const addedMap: Record<string, number> = {};
    for (const p of purchases) {
      if (p.stockItemId) {
        addedMap[p.stockItemId] = (addedMap[p.stockItemId] ?? 0) + p.qty;
      }
    }

    // Invoices in date range — parse items JSON
    const invoiceDateFilter: Record<string, unknown> = {};
    if (fromDate || toDate) {
      invoiceDateFilter.invoiceDate = {
        ...(fromDate ? { gte: fromDate } : {}),
        ...(toDate ? { lte: toDate } : {}),
      };
    }
    const invoices = await prisma.invoice.findMany({
      where: invoiceDateFilter,
      select: { items: true },
    });

    type InvItem = { dt: string; q: number; r: number; a: number; stockId?: string; variantId?: string };
    const soldMap: Record<string, number> = {};
    const variantSoldMap: Record<string, number> = {};
    for (const inv of invoices) {
      const items = inv.items as InvItem[];
      if (!Array.isArray(items)) continue;
      for (const item of items) {
        const sid = item.stockId;
        if (sid && (itemIds.length === 0 || itemIds.includes(sid))) {
          soldMap[sid] = (soldMap[sid] ?? 0) + (Number(item.q) || 0);
        }
        const vid = item.variantId;
        if (vid) {
          variantSoldMap[vid] = (variantSoldMap[vid] ?? 0) + (Number(item.q) || 0);
        }
      }
    }

    // Refunds in date range
    const refundDateFilter: Record<string, unknown> = {};
    if (fromDate || toDate) {
      refundDateFilter.createdAt = {
        ...(fromDate ? { gte: fromDate } : {}),
        ...(toDate ? { lte: toDate } : {}),
      };
    }
    const refunds = await prisma.refundRequest.findMany({
      where: refundDateFilter,
      select: { items: true },
    });

    type RefItem = { dt: string; q: number; r: number; a: number; stockId?: string; variantId?: string };
    const returnedMap: Record<string, number> = {};
    const variantReturnedMap: Record<string, number> = {};
    for (const ref of refunds) {
      const items = ref.items as RefItem[];
      if (!Array.isArray(items)) continue;
      for (const item of items) {
        const sid = item.stockId;
        if (sid && (itemIds.length === 0 || itemIds.includes(sid))) {
          returnedMap[sid] = (returnedMap[sid] ?? 0) + (Number(item.q) || 0);
        }
        const vid = item.variantId;
        if (vid) {
          variantReturnedMap[vid] = (variantReturnedMap[vid] ?? 0) + (Number(item.q) || 0);
        }
      }
    }

    const rows = stockItems.map((s) => {
      const stockAdded = addedMap[s.id] ?? 0;
      const stockSold = soldMap[s.id] ?? 0;
      const stockReturned = returnedMap[s.id] ?? 0;
      const closingStock = s.quantity;
      const openingStock = closingStock - stockAdded + stockSold - stockReturned;
      const costValue = closingStock * s.purchasePrice;
      const salesValue = closingStock * s.salesPrice;

      const variants = s.hasVariants
        ? s.variants.map((v) => {
            const vSold = variantSoldMap[v.id] ?? 0;
            const vReturned = variantReturnedMap[v.id] ?? 0;
            const vClosing = v.quantity;
            const vOpening = vClosing + vSold - vReturned;
            const effectiveSalesPrice = v.salesPrice ?? s.salesPrice;
            const effectiveCostPrice = v.purchasePrice ?? s.purchasePrice;
            return {
              id: v.id,
              sku: v.sku,
              size: v.size,
              color: v.color,
              quantity: v.quantity,
              stockSold: vSold,
              stockReturned: vReturned,
              openingStock: vOpening,
              closingStock: vClosing,
              stockValue: vClosing * effectiveSalesPrice,
              costValue: vClosing * effectiveCostPrice,
              salesValue: vClosing * effectiveSalesPrice,
            };
          })
        : [];

      return {
        id: s.id,
        code: s.code,
        name: s.name,
        category: s.category,
        unit: s.unit,
        purchasePrice: s.purchasePrice,
        salesPrice: s.salesPrice,
        hasVariants: s.hasVariants,
        openingStock,
        stockAdded,
        stockSold,
        stockReturned,
        closingStock,
        costValue,
        salesValue,
        variants,
      };
    });

    // All stock items for the product selector dropdown
    const allStockItems = await prisma.stockItem.findMany({
      orderBy: { name: "asc" },
      select: { id: true, code: true, name: true, category: true },
    });

    return NextResponse.json({
      items: rows,
      allStockItems,
      summary: {
        totalProducts: rows.length,
        totalCurrentStock: rows.reduce((s, r) => s + r.closingStock, 0),
        totalSold: rows.reduce((s, r) => s + r.stockSold, 0),
        totalReturned: rows.reduce((s, r) => s + r.stockReturned, 0),
        totalCostValue: rows.reduce((s, r) => s + r.costValue, 0),
        totalSalesValue: rows.reduce((s, r) => s + r.salesValue, 0),
      },
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to fetch stock-by-product report" }, { status: 500 });
  }
}
