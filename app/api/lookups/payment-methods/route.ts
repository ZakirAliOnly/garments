import { requireModuleAccess } from "@/lib/auth/require-admin";
import { getSessionUser } from "@/lib/auth/session";
import { hasPage } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
export async function GET() {
  const denied = await requireModuleAccess([
    "invoice",
    "purchase",
    "refund",
    "expenses",
    "cashbook",
    "workers",
    "payment-methods",
  ]);
  if (denied) return denied;
  const user = await getSessionUser(),
    showBalances =
      hasPage(user, "expenses") || hasPage(user, "payment-methods");
  const [methods, sums] = await Promise.all([
    prisma.paymentMethod.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        active: true,
        ...(showBalances ? { openingBalance: true } : {}),
      },
    }),
    showBalances
      ? prisma.cashBookEntry.groupBy({
          by: ["paymentMethodId", "type"],
          _sum: { amount: true },
        })
      : [],
  ]);
  return NextResponse.json({
    methods: methods.map((m) => ({
      id: m.id,
      name: m.name,
      active: m.active,
      openingBalance: 0,
      _count: { entries: 0 },
      balance: showBalances
        ? Math.round(
            (Number(m.openingBalance ?? 0) +
              sums
                .filter((s) => s.paymentMethodId === m.id)
                .reduce(
                  (v, s) =>
                    v + (s.type === "credit" ? 1 : -1) * (s._sum.amount ?? 0),
                  0,
                )) *
              100,
          ) / 100
        : 0,
    })),
    transfers: [],
  });
}
