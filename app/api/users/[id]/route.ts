import { requireAdmin } from "@/lib/auth/require-admin";
import { getSessionUser, setSessionCookie } from "@/lib/auth/session";
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
import { NextRequest, NextResponse } from "next/server";
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const actor = await getSessionUser();
  try {
    const { id } = await params,
      body = await req.json();
    let passwordHash: string | undefined;
    if (body.password !== undefined && body.password !== "") {
      validNewPassword(body.password);
      passwordHash = await hashPassword(body.password);
    }
    const result = await financialTransaction(async (tx) => {
      const admin = await tx.adminUser.findUnique({ where: { id: actor!.id } });
      if (!admin?.active || admin.role !== "admin")
        throw new UserError("Administrator access is required", 403);
      const old = await tx.adminUser.findUnique({ where: { id } });
      if (!old) throw new UserError("User not found", 404);
      if (body.updatedAt !== old.updatedAt.toISOString())
        throw new UserError(
          "This user was changed by another update. Refresh before saving.",
          409,
        );
      const profile = parseProfile({ ...old, ...body });
      const modules =
        body.allowedModules === undefined
          ? old.allowedModules
          : parseModules(body.allowedModules);
      if (id === actor!.id && (!profile.active || profile.role !== "admin"))
        throw new UserError(
          "You cannot disable your own account or remove your own administrator access",
        );
      if (
        old.role === "admin" &&
        old.active &&
        (!profile.active || profile.role !== "admin") &&
        (await tx.adminUser.count({
          where: { role: "admin", active: true },
        })) <= 1
      )
        throw new UserError("At least one active administrator must remain");
      if (
        await tx.adminUser.findFirst({
          where: {
            id: { not: id },
            email: { equals: profile.email, mode: "insensitive" },
          },
        })
      )
        throw new UserError("This email is already registered", 409);
      const revoke =
        profile.active !== old.active ||
        profile.role !== old.role ||
        passwordHash !== undefined;
      const updated = await tx.adminUser.update({
        where: { id },
        data: {
          ...profile,
          allowedModules: profile.role === "admin" ? [] : modules,
          ...(passwordHash ? { passwordHash } : {}),
          ...(revoke ? { sessionVersion: { increment: 1 } } : {}),
        },
      });
      return updated;
    });
    if (id === actor!.id && passwordHash) await setSessionCookie(result, false);
    return NextResponse.json(
      Object.fromEntries(
        Object.keys(publicUserSelect).map((key) => [
          key,
          result[key as keyof typeof result],
        ]),
      ),
    );
  } catch (error) {
    return userError(error);
  }
}
