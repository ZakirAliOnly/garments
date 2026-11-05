import { requireAdmin } from "@/lib/auth/require-admin";
import { getSessionUser } from "@/lib/auth/session";
import { hashPassword } from "@/lib/auth/password";
import {
  publicUserSelect,
  parseProfile,
  parseModules,
  validNewPassword,
  userError,
  UserError,
} from "@/lib/auth/user-management";
import { financialTransaction } from "@/lib/finance/core";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  return NextResponse.json(
    await prisma.adminUser.findMany({
      select: publicUserSelect,
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    }),
  );
}
export async function POST(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const actor = await getSessionUser();
  try {
    const body = await req.json();
    const profile = parseProfile({
      ...body,
      role: body.role ?? "user",
      active: body.active ?? true,
    });
    const allowedModules = parseModules(body.allowedModules ?? []);
    validNewPassword(body.password);
    const passwordHash = await hashPassword(body.password);
    return await financialTransaction(async (tx) => {
      const admin = await tx.adminUser.findUnique({ where: { id: actor!.id } });
      if (!admin?.active || admin.role !== "admin")
        throw new UserError("Administrator access is required", 403);
      if (
        await tx.adminUser.findFirst({
          where: { email: { equals: profile.email, mode: "insensitive" } },
        })
      )
        throw new UserError("This email is already registered", 409);
      return NextResponse.json(
        await tx.adminUser.create({
          data: {
            ...profile,
            passwordHash,
            allowedModules: profile.role === "admin" ? [] : allowedModules,
          },
          select: publicUserSelect,
        }),
        { status: 201 },
      );
    });
  } catch (error) {
    return userError(error);
  }
}
