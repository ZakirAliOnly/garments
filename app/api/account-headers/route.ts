import { requireAdmin } from "@/lib/auth/require-admin";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { unstable_cache, revalidateTag } from "next/cache";

const DEFAULTS = [
  { name: "Regular Customer", prefix: "CUS" },
  { name: "Government", prefix: "GID" },
  { name: "Supplier", prefix: "SUP" },
];

const fetchAccountHeaders = unstable_cache(
  async () => {
    const headers = await prisma.accountHeader.findMany({ orderBy: { createdAt: "asc" } });
    const counts = await prisma.customer.groupBy({ by: ["headerId"], _count: { _all: true } });
    const countMap = Object.fromEntries(counts.map((c) => [c.headerId, c._count._all]));
    return headers.map((h) => ({ ...h, customerCount: countMap[h.id] ?? 0 }));
  },
  ["account-headers"],
  { revalidate: 300, tags: ["account-headers"] }
);

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    // Seed defaults on first run (cheap check, outside cache)
    const count = await prisma.accountHeader.count();
    if (count === 0) {
      await prisma.accountHeader.createMany({ data: DEFAULTS });
      revalidateTag("account-headers", "default");
    }
    const headers = await fetchAccountHeaders();
    return NextResponse.json(headers);
  } catch {
    return NextResponse.json({ error: "Failed to fetch headers" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const { name, prefix } = await req.json();
    if (!name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 });
    if (!prefix?.trim()) return NextResponse.json({ error: "Prefix is required" }, { status: 400 });
    const clean = prefix.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (clean.length < 2 || clean.length > 6)
      return NextResponse.json({ error: "Prefix must be 2–6 letters/numbers" }, { status: 400 });

    const header = await prisma.accountHeader.create({ data: { name: name.trim(), prefix: clean } });
    revalidateTag("account-headers", "default");
    return NextResponse.json(header, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error && e.message.includes("Unique") ? "Prefix already exists" : "Failed to create header";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
