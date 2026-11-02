import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

const base = process.env.APP_URL ?? "http://localhost:3000";
let cookie = "";
const denied = await fetch(`${base}/api/dashboard`);
assert.equal(denied.status, 401);
console.log("PASS: Unauthenticated data access denied (HTTP 401)");
if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
  const invalid = await fetch(`${base}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: base },
    body: JSON.stringify({ email: process.env.ADMIN_EMAIL, password: "incorrect-test-password" }),
  });
  assert.equal(invalid.status, 401);
  console.log("PASS: Incorrect password rejected (HTTP 401)");
  const response = await fetch(`${base}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: base },
    body: JSON.stringify({ email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD }),
  });
  assert.ok(response.ok, `Sign-in: HTTP ${response.status}`);
  cookie = response.headers.getSetCookie().map((value) => value.split(";")[0]).join("; ");
  assert.ok(cookie, "Sign-in must set a session cookie");
  console.log("PASS: Neon email/password sign-in");
}
const marker = `Neon smoke ${Date.now()}`;
let id;
async function request(path, options) {
  const response = await fetch(`${base}${path}`, {
    ...options,
    headers: { ...options?.headers, Cookie: cookie, Origin: base },
  });
  const body = await response.json();
  const jar = new Map(cookie.split("; ").filter(Boolean).map((value) => {
    const index = value.indexOf("=");
    return [value.slice(0, index), value.slice(index + 1)];
  }));
  for (const value of response.headers.getSetCookie()) {
    const pair = value.split(";")[0];
    const index = pair.indexOf("=");
    const name = pair.slice(0, index);
    if (/max-age=0/i.test(value) || !pair.slice(index + 1)) jar.delete(name);
    else jar.set(name, pair.slice(index + 1));
  }
  cookie = [...jar].map(([name, value]) => `${name}=${value}`).join("; ");
  assert.ok(response.ok, `${path}: HTTP ${response.status}`);
  console.log(`${options?.method ?? "GET"} ${path}: HTTP ${response.status}`);
  return body;
}
try {
  const created = await request("/api/account-headers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: marker, prefix: `Z${Date.now().toString(36).slice(-5)}` }),
  });
  id = created.id;
  assert.ok(id);
  let headers = await request("/api/account-headers");
  for (let attempt = 0; attempt < 10 && !headers.some((header) => header.id === id); attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 200));
    headers = await request("/api/account-headers");
  }
  assert.ok(headers.some((header) => header.id === id && header.name === marker));
  await request("/api/dashboard");
  const session = await request("/api/auth/get-session");
  assert.ok(session.user);
  console.log("PASS: Session restored through a separate HTTP request");
  console.log("PASS: App API -> Prisma -> Neon write/read and dashboard queries");
  if (process.env.TEST_PASSWORD_CHANGE === "1") {
    const temporary = `${randomUUID()}Aa1!`;
    await request("/api/auth/change-password", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: process.env.ADMIN_PASSWORD, newPassword: temporary }),
    });
    try {
      console.log("PASS: Authenticated password change");
    } finally {
      await request("/api/auth/change-password", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: temporary, newPassword: process.env.ADMIN_PASSWORD }),
      });
      console.log("PASS: Original admin password restored");
    }
  }
} finally {
  if (id) {
    await request(`/api/account-headers/${id}`, { method: "DELETE" });
    let headers = await request("/api/account-headers");
    for (let attempt = 0; attempt < 10 && headers.some((header) => header.id === id); attempt++) {
      // The existing list cache uses stale-while-revalidate invalidation.
      await new Promise((resolve) => setTimeout(resolve, 200));
      headers = await request("/api/account-headers");
    }
    assert.ok(!headers.some((header) => header.id === id));
    console.log("PASS: Test record deleted and absence verified");
  }
  if (cookie) {
    await request("/api/auth/sign-out", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    console.log("PASS: Sign-out");
    const expired = await fetch(`${base}/api/auth/get-session`, { headers: { Cookie: cookie } });
    assert.ok(!(await expired.json())?.user, "Signed-out browser must have no session");
    console.log("PASS: Signed-out session no longer restores");
  }
}
