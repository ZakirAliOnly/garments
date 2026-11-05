import { requireAdmin } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/prisma";
import {
  financialTransaction,
  financeError,
  FinanceError,
  money,
} from "@/lib/finance/core";
import { NextRequest, NextResponse } from "next/server";
export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const [methods, sums, transfers] = await Promise.all([
      prisma.paymentMethod.findMany({
        orderBy: { createdAt: "asc" },
        include: { _count: { select: { entries: true } } },
      }),
      prisma.cashBookEntry.groupBy({
        by: ["paymentMethodId", "type"],
        _sum: { amount: true },
      }),
      prisma.paymentTransfer.findMany({
        orderBy: { createdAt: "desc" },
        take: 100,
        include: {
          from: { select: { name: true } },
          to: { select: { name: true } },
        },
      }),
    ]);
    return NextResponse.json({
      methods: methods.map((m) => ({
        ...m,
        openingBalance: Number(m.openingBalance),
        balance:
          Math.round(
            (Number(m.openingBalance) +
              sums
                .filter((s) => s.paymentMethodId === m.id)
                .reduce(
                  (sum, s) =>
                    sum + (s.type === "credit" ? 1 : -1) * (s._sum.amount ?? 0),
                  0,
                )) *
              100,
          ) / 100,
      })),
      transfers,
    });
  } catch (error) {
    return financeError(error, "Unable to load payment methods");
  }
}
export async function POST(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const body = await req.json();
    return await financialTransaction(async (tx) => {
      if (
        typeof body.name !== "string" ||
        !body.name.trim() ||
        body.name.length > 80
      )
        throw new FinanceError(
          "Payment method name is required (maximum 80 characters)",
        );
      if (
        await tx.paymentMethod.findFirst({
          where: { name: { equals: body.name.trim(), mode: "insensitive" } },
        })
      )
        throw new FinanceError(
          "A payment method with this name already exists",
        );
      const method = await tx.paymentMethod.create({
        data: {
          name: body.name.trim(),
          openingBalance: money(body.openingBalance ?? 0, "Opening balance"),
        },
      });
      return NextResponse.json(method, { status: 201 });
    });
  } catch (error) {
    return financeError(error, "Unable to create payment method");
  }
}
