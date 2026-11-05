import { requireModuleAccess } from "@/lib/auth/require-admin";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireModuleAccess("stock");
  if (denied) return denied;
  try {
    const { id } = await params;
    await prisma.stockItem.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete stock item" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireModuleAccess("stock");
  if (denied) return denied;
  try {
    const { id } = await params;
    const { name, category, unit, purchasePrice, salesPrice, lowStockThreshold, quantity, variantQuantities, variantPrices, newVariants } = await req.json();
    if (!name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 });

    // Update variant quantities if provided
    if (variantQuantities && typeof variantQuantities === "object") {
      await Promise.all(
        Object.entries(variantQuantities as Record<string, string>).map(([variantId, qty]) =>
          prisma.stockVariant.update({
            where: { id: variantId },
            data: { quantity: parseFloat(qty) || 0 },
          })
        )
      );
    }

    // Update per-variant prices if provided
    if (variantPrices && typeof variantPrices === "object") {
      await Promise.all(
        Object.entries(variantPrices as Record<string, { sales: string; purchase: string }>).map(([variantId, prices]) =>
          prisma.stockVariant.update({
            where: { id: variantId },
            data: {
              salesPrice: prices.sales !== "" ? parseFloat(prices.sales) : null,
              purchasePrice: prices.purchase !== "" ? parseFloat(prices.purchase) : null,
            },
          })
        )
      );
    }

    // Create new variants if provided
    if (newVariants && Array.isArray(newVariants) && newVariants.length > 0) {
      const parent = await prisma.stockItem.findUnique({ where: { id } });
      const parentSku = parent?.sku ?? parent?.code ?? id;
      for (const v of newVariants as Array<{ size?: string; color?: string; quantity: number; salesPrice?: string | null; purchasePrice?: string | null }>) {
        const sizePart = v.size ? `-${v.size.replace(/[^A-Za-z0-9]/g, "").toUpperCase().substring(0, 4)}` : "";
        const colorPart = v.color ? `-${v.color.replace(/[^A-Za-z0-9]/g, "").toUpperCase().substring(0, 4)}` : "";
        let variantSku = `${parentSku}${sizePart}${colorPart}`;
        const collision = await prisma.stockVariant.findUnique({ where: { sku: variantSku } });
        if (collision) {
          variantSku = `${variantSku}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`;
        }
        await prisma.stockVariant.create({
          data: {
            sku: variantSku,
            size: v.size || null,
            color: v.color || null,
            quantity: parseFloat(String(v.quantity)) || 0,
            salesPrice: v.salesPrice != null && v.salesPrice !== "" ? parseFloat(String(v.salesPrice)) : null,
            purchasePrice: v.purchasePrice != null && v.purchasePrice !== "" ? parseFloat(String(v.purchasePrice)) : null,
            stockItemId: id,
          },
        });
      }
      // Enable hasVariants on the parent if it wasn't already
      await prisma.stockItem.update({ where: { id }, data: { hasVariants: true } });
    }

    // For variant items, recalculate total quantity from variants
    const existing = await prisma.stockItem.findUnique({ where: { id }, include: { variants: true } });
    const totalQty = existing?.hasVariants && existing.variants.length > 0
      ? existing.variants.reduce((s, v) => s + v.quantity, 0)
      : parseFloat(quantity) || 0;

    const item = await prisma.stockItem.update({
      where: { id },
      data: {
        name: name.trim(),
        category: category?.trim() || "Other",
        unit: unit?.trim() || "pcs",
        purchasePrice: parseFloat(purchasePrice) || 0,
        salesPrice: parseFloat(salesPrice) || 0,
        lowStockThreshold: parseFloat(lowStockThreshold) || 5,
        quantity: totalQty,
      },
      include: { variants: true },
    });
    return NextResponse.json(item);
  } catch {
    return NextResponse.json({ error: "Failed to update stock item" }, { status: 500 });
  }
}
