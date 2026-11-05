import { requireModuleAccess } from "@/lib/auth/require-admin";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function nextSupplierId(suppliers: { supplierId: string }[]) {
  const nums = suppliers.map(s => {
    const m = s.supplierId.match(/SUP-(\d+)/);
    return m ? parseInt(m[1]) : 0;
  });
  return `SUP-${String((nums.length ? Math.max(...nums) : 0) + 1).padStart(3, "0")}`;
}

export async function GET() {
  const denied = await requireModuleAccess("purchase");
  if (denied) return denied;
  const suppliers = await prisma.supplier.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json(suppliers);
}

export async function POST(req: NextRequest) {
  const denied = await requireModuleAccess("purchase");
  if (denied) return denied;
  try {
    const body = await req.json();
    const { name, phone, city, category, notes } = body;
    if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 });

    const all = await prisma.supplier.findMany({ select: { supplierId: true } });
    const supplierId = nextSupplierId(all);

    const supplier = await prisma.supplier.create({
      data: {
        supplierId,
        name,
        phone: phone || null,
        city: city || null,
        category: category || null,
        notes: notes || null,
      },
    });

    // Mirror into Accounts: create a Customer under the "SUP" AccountHeader
    try {
      const supHeader = await prisma.accountHeader.findFirst({ where: { prefix: "SUP" } });
      if (supHeader) {
        const count = await prisma.customer.count({ where: { headerId: supHeader.id } });
        const cid = `SUP-${String(count + 1).padStart(4, "0")}`;
        await prisma.customer.create({
          data: {
            cid,
            name,
            phone: phone?.trim() || "N/A",
            address: city?.trim() || null,
            notes: notes?.trim() || null,
            headerId: supHeader.id,
            balance: 0,
          },
        });
      }
    } catch (mirrorErr) {
      console.error("Failed to mirror supplier into accounts:", mirrorErr);
      // Non-fatal: supplier was created, just the account mirror failed
    }

    return NextResponse.json(supplier, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to create supplier" }, { status: 500 });
  }
}
