import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { setSessionCookie } from "@/lib/auth/session";

// Used to keep timing similar when the email doesn't exist
const DUMMY_HASH = hashPassword("dummy-password-for-timing");

export async function POST(req: NextRequest) {
  const { email, password, rememberMe } = await req.json().catch(() => ({}));
  if (typeof email !== "string" || typeof password !== "string") {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  }
  const user = await prisma.adminUser.findUnique({ where: { email: email.trim().toLowerCase() } });
  const ok = await verifyPassword(password, user?.passwordHash ?? (await DUMMY_HASH));
  if (!user || !ok) return NextResponse.json({ error: "Incorrect email or password" }, { status: 401 });
  await setSessionCookie(user, !!rememberMe);
  return NextResponse.json({ ok: true });
}
