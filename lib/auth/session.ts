import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export const SESSION_COOKIE = "garments_session";
const SHORT_TTL = 60 * 60 * 12; // 12 hours (browser-session cookie)
const LONG_TTL = 60 * 60 * 24 * 30; // 30 days ("remember me")

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16)
    throw new Error("AUTH_SECRET must be set (16+ characters)");
  return s;
}

const b64 = (s: string) => Buffer.from(s).toString("base64url");
const sign = (data: string) =>
  createHmac("sha256", secret()).update(data).digest("base64url");
/** Changes whenever the password changes, so old sessions stop working. */
const pwVersion = (passwordHash: string) =>
  createHash("sha256").update(passwordHash).digest("hex").slice(0, 12);

const sessionVersion = (user: {
  passwordHash: string;
  sessionVersion?: number;
}) =>
  user.sessionVersion
    ? pwVersion(`${user.passwordHash}:${user.sessionVersion}`)
    : pwVersion(user.passwordHash);

interface Payload {
  uid: string;
  v: string;
  exp: number;
}

export function createToken(
  user: { id: string; passwordHash: string; sessionVersion?: number },
  remember: boolean,
) {
  const ttl = remember ? LONG_TTL : SHORT_TTL;
  const payload: Payload = {
    uid: user.id,
    v: sessionVersion(user),
    exp: Math.floor(Date.now() / 1000) + ttl,
  };
  const body = b64(JSON.stringify(payload));
  return { token: `${body}.${sign(body)}`, ttl };
}

export async function setSessionCookie(
  user: { id: string; passwordHash: string; sessionVersion?: number },
  remember: boolean,
) {
  const { token, ttl } = createToken(user, remember);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    ...(remember ? { maxAge: ttl } : {}),
  });
}

export async function clearSessionCookie() {
  (await cookies()).delete(SESSION_COOKIE);
}

/** Returns the signed-in admin, or null. */
export async function getSessionUser() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = sign(body);
  if (
    sig.length !== expected.length ||
    !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
  )
    return null;
  let payload: Payload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString());
  } catch {
    return null;
  }
  if (!payload.exp || payload.exp < Date.now() / 1000) return null;
  const user = await prisma.adminUser.findUnique({
    where: { id: payload.uid },
  });
  if (!user || !user.active || sessionVersion(user) !== payload.v) return null;
  return user;
}
