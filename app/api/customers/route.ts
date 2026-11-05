import {
  financialTransaction,
  financeError,
  FinanceError,
  money,
  date,
  resolveMethod,
} from "@/lib/finance/core";
import { requireAdmin } from "@/lib/auth/require-admin";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { unstable_cache, revalidateTag } from "next/cache";

function nextSupplierId(suppliers: { supplierId: string }[]) {
  const nums = suppliers.map((s) => {
    const m = s.supplierId.match(/SUP-(\d+)/);
    return m ? parseInt(m[1]) : 0;
  });
  return `SUP-${String((nums.length ? Math.max(...nums) : 0) + 1).padStart(3, "0")}`;
}

// Cached full lean list — used by dropdowns across Cashbook and Invoice
const fetchCustomersLean = unstable_cache(
  async () =>
    prisma.customer.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        cid: true,
        name: true,
        phone: true,
        address: true,
        balance: true,
      },
    }),
  ["customers-lean"],
  { revalidate: 60, tags: ["customers-lean"] },
);

export async function GET(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const search = req.nextUrl.searchParams.get("search");
    const lean = req.nextUrl.searchParams.get("lean") === "1";

    if (lean) {
      // Use cache only when no search filter (dropdown use-case)
      if (!search) {
        const customers = await fetchCustomersLean();
        return NextResponse.json(customers);
      }
      // With search: hit DB directly (dynamic, not worth caching)
      const customers = await prisma.customer.findMany({
        where: {
          OR: [
            { cid: { contains: search, mode: "insensitive" } },
            { name: { contains: search, mode: "insensitive" } },
          ],
        },
        orderBy: { name: "asc" },
        select: {
          id: true,
          cid: true,
          name: true,
          phone: true,
          address: true,
          balance: true,
        },
      });
      return NextResponse.json(customers);
    }

    // Full customer list (Accounts page) — not cached, always fresh
    const where = search
      ? {
          OR: [
            { cid: { contains: search, mode: "insensitive" as const } },
            { name: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {};
    const customers = await prisma.customer.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { header: { select: { name: true, prefix: true } } },
    });
    return NextResponse.json(customers);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch customers" },
      { status: 500 },
    );
  }
}

// Returns the next CID for a given headerId (query param)
export async function HEAD(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const headerId = req.nextUrl.searchParams.get("headerId");
    if (!headerId) {
      return new NextResponse(null, {
        headers: { "x-next-cid": "Select a type first" },
      });
    }
    const header = await prisma.accountHeader.findUnique({
      where: { id: headerId },
    });
    if (!header) return new NextResponse(null, { status: 404 });
    const count = await prisma.customer.count({ where: { headerId } });
    const nextCid = `${header.prefix}-${String(count + 1).padStart(4, "0")}`;
    return new NextResponse(null, { headers: { "x-next-cid": nextCid } });
  } catch {
    return new NextResponse(null, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const body = await req.json();
    return await financialTransaction(async (prisma) => {
      const {
        name,
        phone,
        address,
        whatsapp,
        reference,
        notes,
        balance,
        headerId,
        taxIdType,
        taxIdNumber,
      } = body;

      if (!name?.trim())
        return NextResponse.json(
          { error: "Full name is required" },
          { status: 400 },
        );
      if (!phone?.trim())
        return NextResponse.json(
          { error: "Phone number is required" },
          { status: 400 },
        );
      if (!headerId)
        return NextResponse.json(
          { error: "Account type is required" },
          { status: 400 },
        );

      const header = await prisma.accountHeader.findUnique({
        where: { id: headerId },
      });
      if (!header)
        return NextResponse.json(
          { error: "Invalid account type" },
          { status: 400 },
        );

      const count = await prisma.customer.count({ where: { headerId } });
      const cid = `${header.prefix}-${String(count + 1).padStart(4, "0")}`;

      if(!Number.isFinite(Number(balance ?? 0)))throw new FinanceError("Opening balance must be a finite number");
      const selectedMethod =
        Number(balance) < 0
          ? await resolveMethod(
              prisma,
              body.paymentMethod || "Cash",
              body.paymentMethodId,
            )
          : null;
      const customer = await prisma.customer.create({
        data: {
          cid,
          name: name.trim(),
          phone: phone.trim(),
          address: address?.trim() || null,
          whatsapp: whatsapp?.trim() || null,
          reference: reference?.trim() || null,
          notes: notes?.trim() || null,
          balance: parseFloat(balance) || 0,
          taxIdType: taxIdType?.trim() || null,
          taxIdNumber: taxIdNumber?.trim() || null,
          headerId,
        },
        include: { header: { select: { name: true, prefix: true } } },
      });

      revalidateTag("customers-lean", "default");
      revalidateTag("account-headers", "default"); // customer count on headers changes

      // ── Cashbook entry for opening balance ─────────────────────────────────
      // A credit opening balance (negative) means advance already received — record it.
      // A debit opening balance (positive) means they already owe us — no cash moved.
      if (customer.balance < 0) {
        await prisma.cashBookEntry.create({
          data: {
            entryDate: new Date(),
            paymentMethod: { connect: { id: selectedMethod!.id } },
            sourceType: "customer-opening",
            sourceId: customer.id,
            type: "credit",
            description: `Opening advance — ${customer.cid} ${customer.name}`,
            amount: Math.abs(customer.balance),
            customer: { connect: { id: customer.id } },
            notes: `Opening balance (advance) recorded at account creation`,
          },
        });
      }

      // Mirror into Purchase module: create a Supplier when this account is under the SUP header
      if (header.prefix === "SUP") {
        try {
          const allSuppliers = await prisma.supplier.findMany({
            select: { supplierId: true },
          });
          const supplierId = nextSupplierId(allSuppliers);
          await prisma.supplier.create({
            data: {
              supplierId,
              name: customer.name,
              phone: customer.phone !== "N/A" ? customer.phone : null,
              city: customer.address || null,
              notes: customer.notes || null,
            },
          });
        } catch (mirrorErr) {
          console.error(
            "Failed to mirror SUP account into suppliers:",
            mirrorErr,
          );
          // Non-fatal: customer was created, just the supplier mirror failed
        }
      }

      return NextResponse.json(customer, { status: 201 });
    });
  } catch (error) {
    return financeError(error, "Failed to create account");
  }
}
