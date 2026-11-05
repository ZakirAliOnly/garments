import { requireAdmin } from "@/lib/auth/require-admin";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Generate a unique SKU: 3-char name prefix + 5-char random alphanumeric
async function generateSku(name: string): Promise<string> {
  const prefix = name.replace(/[^A-Za-z0-9]/g, "").substring(0, 3).toUpperCase().padEnd(3, "X");
  for (let i = 0; i < 20; i++) {
    const rand = Math.random().toString(36).substring(2, 7).toUpperCase();
    const sku = `${prefix}-${rand}`;
    const exists = await prisma.stockItem.findUnique({ where: { sku } });
    if (!exists) return sku;
  }
  // Fallback: use timestamp
  return `${prefix}-${Date.now().toString(36).toUpperCase().slice(-5)}`;
}

export async function GET(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const lean = req.nextUrl.searchParams.get("lean") === "1";
    if (lean) {
      const items = await prisma.stockItem.findMany({
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          code: true,
          sku: true,
          salesPrice: true,
          unit: true,
          hasVariants: true,
          variants: {
            orderBy: { createdAt: "asc" as const },
            select: { id: true, sku: true, size: true, color: true, quantity: true, salesPrice: true },
          },
        },
      });
      return NextResponse.json(items);
    }
    const items = await prisma.stockItem.findMany({
      orderBy: { createdAt: "desc" },
      include: { variants: { orderBy: { createdAt: "asc" } } },
    });
    return NextResponse.json(items);
  } catch {
    return NextResponse.json({ error: "Failed to fetch stock" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const body = await req.json();
    const { name, category, quantity, unit, purchasePrice, salesPrice, lowStockThreshold, hasVariants, variants } = body;

    if (!name?.trim() || !category?.trim() || !unit?.trim()) {
      return NextResponse.json({ error: "Name, category, and unit are required" }, { status: 400 });
    }

    const lastItem = await prisma.stockItem.findFirst({
      orderBy: { code: "desc" },
      select: { code: true },
    });
    const nextNum = lastItem ? (parseInt(lastItem.code.replace("STK-", ""), 10) + 1) : 1;
    const code = `STK-${String(nextNum).padStart(3, "0")}`;
    const sku = await generateSku(name);

    // Total qty = sum of variant quantities when hasVariants, otherwise direct input
    const variantList: {
      size?: string;
      color?: string;
      quantity: number;
      salesPrice?: number | string | null;
      purchasePrice?: number | string | null;
    }[] = hasVariants && Array.isArray(variants) ? variants : [];
    const totalQty = hasVariants && variantList.length > 0
      ? variantList.reduce((s, v) => s + (parseFloat(String(v.quantity)) || 0), 0)
      : parseFloat(quantity) || 0;

    const item = await prisma.stockItem.create({
      data: {
        code,
        sku,
        name: name.trim(),
        category: category.trim(),
        quantity: totalQty,
        unit: unit.trim(),
        purchasePrice: parseFloat(purchasePrice) || 0,
        salesPrice: parseFloat(salesPrice) || 0,
        lowStockThreshold: parseFloat(lowStockThreshold) || 5,
        hasVariants: !!hasVariants,
        variants: hasVariants && variantList.length > 0 ? {
          create: variantList.map((v) => {
            const sizePart = v.size ? `-${v.size.replace(/[^A-Za-z0-9]/g, "").toUpperCase().substring(0, 4)}` : "";
            const colorPart = v.color ? `-${v.color.replace(/[^A-Za-z0-9]/g, "").toUpperCase().substring(0, 4)}` : "";
            return {
              sku: `${sku}${sizePart}${colorPart}`,
              size: v.size || null,
              color: v.color || null,
              quantity: parseFloat(String(v.quantity)) || 0,
              salesPrice: v.salesPrice != null && v.salesPrice !== "" ? parseFloat(String(v.salesPrice)) : null,
              purchasePrice: v.purchasePrice != null && v.purchasePrice !== "" ? parseFloat(String(v.purchasePrice)) : null,
            };
          }),
        } : undefined,
      },
      include: { variants: true },
    });

    return NextResponse.json(item, { status: 201 });
  } catch (err) {
    console.error("[POST /api/stock]", err);
    return NextResponse.json({ error: "Failed to add stock item" }, { status: 500 });
  }
}
