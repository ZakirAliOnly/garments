import { requireAdmin } from "@/lib/auth/require-admin";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/reports/stock?from=YYYY-MM-DD&to=YYYY-MM-DD
export async function GET(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const fromDate = from ? new Date(from) : undefined;
    const toDate = to ? new Date(to + "T23:59:59.999Z") : undefined;

    // All stock items with current quantities
    const stockItems = await prisma.stockItem.findMany({
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

    // Purchases in date range (stock added)
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
        transactionType: "sold", // supplier sold to us (stock came in)
      },
      select: { stockItemId: true, qty: true },
    });

    // Map: stockItemId -> total qty added
    const addedMap: Record<string, number> = {};
    for (const p of purchases) {
      if (p.stockItemId) {
        addedMap[p.stockItemId] = (addedMap[p.stockItemId] ?? 0) + p.qty;
      }
    }

    // Invoices in date range — parse items JSON for sold quantities
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

    // Map: stockItemId -> total qty sold; variantId -> total qty sold
    const soldMap: Record<string, number> = {};
    const variantSoldMap: Record<string, number> = {};
    type InvItem = { dt: string; q: number; r: number; a: number; stockId?: string; variantId?: string };
    for (const inv of invoices) {
      const items = inv.items as InvItem[];
      if (!Array.isArray(items)) continue;
      for (const item of items) {
        const sid = item.stockId;
        if (sid) {
          soldMap[sid] = (soldMap[sid] ?? 0) + (Number(item.q) || 0);
        }
        const vid = item.variantId;
        if (vid) {
          variantSoldMap[vid] = (variantSoldMap[vid] ?? 0) + (Number(item.q) || 0);
        }
      }
    }

    // Refunds in date range — parse items JSON for returned quantities
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

    // Map: stockItemId -> total qty returned; variantId -> total qty returned
    const returnedMap: Record<string, number> = {};
    const variantReturnedMap: Record<string, number> = {};
    type RefItem = { dt: string; q: number; r: number; a: number; stockId?: string; variantId?: string };
    for (const ref of refunds) {
      const items = ref.items as RefItem[];
      if (!Array.isArray(items)) continue;
      for (const item of items) {
        const sid = item.stockId;
        if (sid) {
          returnedMap[sid] = (returnedMap[sid] ?? 0) + (Number(item.q) || 0);
        }
        const vid = item.variantId;
        if (vid) {
          variantReturnedMap[vid] = (variantReturnedMap[vid] ?? 0) + (Number(item.q) || 0);
        }
      }
    }

    // Build report rows
    const rows = stockItems.map((s) => {
      const stockAdded = addedMap[s.id] ?? 0;
      const stockSold = soldMap[s.id] ?? 0;
      const stockReturned = returnedMap[s.id] ?? 0;
      // Opening stock = closing - added + sold - returned (back-calculated)
      const closingStock = s.quantity;
      const openingStock = closingStock - stockAdded + stockSold - stockReturned;
      const stockValue = closingStock * s.salesPrice;

      const variants = s.hasVariants
        ? s.variants.map((v) => {
            const vSold = variantSoldMap[v.id] ?? 0;
            const vReturned = variantReturnedMap[v.id] ?? 0;
            const vClosing = v.quantity;
            const vOpening = vClosing + vSold - vReturned;
            const effectiveSalesPrice = v.salesPrice ?? s.salesPrice;
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
        stockValue,
        variants,
      };
    });

    const totalItems = rows.length;
    const totalStockValue = rows.reduce((s, r) => s + r.stockValue, 0);
    const totalSold = rows.reduce((s, r) => s + r.stockSold, 0);
    const totalAdded = rows.reduce((s, r) => s + r.stockAdded, 0);

    return NextResponse.json({
      items: rows,
      summary: {
        totalItems,
        totalStockValue,
        totalSold,
        totalAdded,
      },
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to fetch stock report" }, { status: 500 });
  }
}
