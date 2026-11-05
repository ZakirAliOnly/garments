// Run only against a local isolated server with an existing administrator.
import assert from "node:assert/strict";
const base = process.env.APP_URL ?? "http://127.0.0.1:3000";
assert.ok(
  ["localhost", "127.0.0.1"].includes(new URL(base).hostname),
  "Use an isolated local server",
);
assert.ok(
  process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD,
  "Set test admin credentials",
);
function client(initial = "") {
  let cookie = initial;
  return {
    get cookie() {
      return cookie;
    },
    async api(path, method = "GET", body, status = 200) {
      const r = await fetch(base + path, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...(cookie ? { Cookie: cookie } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const d = await r.json().catch(() => ({}));
      if (r.headers.getSetCookie().length)
        cookie = r.headers
          .getSetCookie()
          .map((s) => s.split(";")[0])
          .join("; ");
      assert.equal(r.status, status, `${method} ${path}: ${JSON.stringify(d)}`);
      return d;
    },
  };
}
const anon = client();
await anon.api("/api/users", "GET", undefined, 401);
const admin = client();
await admin.api("/api/auth/login", "POST", {
  email: process.env.ADMIN_EMAIL,
  password: process.env.ADMIN_PASSWORD,
});
const me = (await admin.api("/api/auth/session")).user;
assert.equal(
  me.role,
  "admin",
  "The pre-migration administrator must retain full access",
);
const tag = Date.now(),
  email = `staff-${tag}@example.test`,
  password = "User-tests-only-123";
let user = await admin.api(
  "/api/users",
  "POST",
  { name: "Access test " + tag, email, password },
  201,
);
assert.equal(user.role, "user");
assert.deepEqual(user.allowedModules, []);
assert.equal("passwordHash" in user, false);
assert.equal("sessionVersion" in user, false);
const staff = client();
await staff.api("/api/auth/login", "POST", { email, password });
const deniedRoutes = [
  "/api/users",
  "/api/dashboard",
  "/api/stock",
  "/api/invoices",
  "/api/purchases",
  "/api/refunds",
  "/api/expenses",
  "/api/cashbook",
  "/api/payment-methods",
  "/api/payroll?month=2026-11",
  "/api/reports/invoices",
  "/api/customers",
  "/api/account-headers",
  "/api/worker-tasks",
];
for (const path of deniedRoutes) await staff.api(path, "GET", undefined, 403);
for (const [path, method] of [
  ["/api/users", "POST"],
  ["/api/users/" + user.id, "PATCH"],
  ["/api/stock", "POST"],
  ["/api/invoices", "POST"],
  ["/api/invoices/not-real", "PATCH"],
  ["/api/payment-methods/transfers", "POST"],
  ["/api/auth/change-password", "POST"],
])
  await staff.api(
    path,
    method,
    { role: "admin", allowedModules: ["user-management"] },
    403,
  );
await admin.api(
  "/api/users/" + user.id,
  "PATCH",
  { updatedAt: user.updatedAt, allowedModules: ["user-management"] },
  400,
);
await admin.api(
  "/api/users",
  "POST",
  { name: "duplicate", email: email.toUpperCase(), password },
  409,
);
user = await admin.api("/api/users/" + user.id, "PATCH", {
  updatedAt: user.updatedAt,
  allowedModules: ["expenses"],
});
await staff.api("/api/expenses");
await staff.api("/api/expenses", "POST", {}, 400);
for (const path of [
  "/api/cashbook",
  "/api/payment-methods",
  "/api/users",
  "/api/stock",
  "/api/invoices",
])
  await staff.api(path, "GET", undefined, 403);
const lookup = await staff.api("/api/lookups/payment-methods");
assert.ok(lookup.methods.length);
assert.deepEqual(lookup.transfers, []);
const stale = user.updatedAt;
user = await admin.api("/api/users/" + user.id, "PATCH", {
  updatedAt: user.updatedAt,
  allowedModules: [],
});
await staff.api("/api/expenses", "GET", undefined, 403);
assert.deepEqual(
  (await staff.api("/api/auth/session")).user.allowedModules,
  [],
);
await admin.api(
  "/api/users/" + user.id,
  "PATCH",
  { updatedAt: stale, allowedModules: ["expenses"] },
  409,
);
user = await admin.api("/api/users/" + user.id, "PATCH", {
  updatedAt: user.updatedAt,
  allowedModules: ["invoice"],
});
await admin.api(
  "/api/stock",
  "POST",
  {
    name: "Access lookup fixture " + tag,
    category: "Fabric",
    quantity: 2,
    unit: "mtr",
    purchasePrice: 100,
    salesPrice: 150,
  },
  201,
);
await staff.api("/api/invoices");
await staff.api("/api/stock", "GET", undefined, 403);
const stock = await staff.api("/api/lookups/stock?purpose=invoice");
assert.ok(stock.length);
assert.equal("purchasePrice" in stock[0], false);
assert.equal("lowStockThreshold" in stock[0], false);
await staff.api("/api/lookups/stock?purpose=purchase", "GET", undefined, 403);
await staff.api("/api/lookups/customers");
const methods = await staff.api("/api/lookups/payment-methods");
assert.ok(
  methods.methods.every((m) => m.balance === 0),
  "Invoice-only lookup must not reveal method balances",
);
const oldSession = client(staff.cookie);
user = await admin.api("/api/users/" + user.id, "PATCH", {
  updatedAt: user.updatedAt,
  active: false,
});
await staff.api("/api/auth/session", "GET", undefined, 401);
await staff.api("/api/auth/login", "POST", { email, password }, 401);
user = await admin.api("/api/users/" + user.id, "PATCH", {
  updatedAt: user.updatedAt,
  active: true,
});
await oldSession.api("/api/auth/session", "GET", undefined, 401);
await staff.api("/api/auth/login", "POST", { email, password });
const beforeReset = client(staff.cookie);
user = await admin.api("/api/users/" + user.id, "PATCH", {
  updatedAt: user.updatedAt,
  password: "Reset-tests-only-456",
});
await beforeReset.api("/api/auth/session", "GET", undefined, 401);
await staff.api("/api/auth/login", "POST", { email, password }, 401);
await staff.api("/api/auth/login", "POST", {
  email,
  password: "Reset-tests-only-456",
});
const self = (await admin.api("/api/users")).find((u) => u.id === me.id);
await admin.api(
  "/api/users/" + me.id,
  "PATCH",
  { updatedAt: self.updatedAt, active: false },
  400,
);
await admin.api(
  "/api/users/" + me.id,
  "PATCH",
  { updatedAt: self.updatedAt, role: "user" },
  400,
);
assert.equal((await admin.api("/api/auth/session")).user.role, "admin");
const beforeRole = client(staff.cookie);
user = await admin.api("/api/users/" + user.id, "PATCH", {
  updatedAt: user.updatedAt,
  role: "admin",
});
await beforeRole.api("/api/auth/session", "GET", undefined, 401);
await staff.api("/api/auth/login", "POST", {
  email,
  password: "Reset-tests-only-456",
});
await staff.api("/api/users");
user = await admin.api("/api/users/" + user.id, "PATCH", {
  updatedAt: user.updatedAt,
  role: "user",
  allowedModules: ["settings"],
});
await staff.api("/api/auth/session", "GET", undefined, 401);
await staff.api("/api/auth/login", "POST", {
  email,
  password: "Reset-tests-only-456",
});
await staff.api("/api/auth/change-password", "POST", {
  currentPassword: "Reset-tests-only-456",
  newPassword: "Own-change-tests-789",
});
await staff.api("/api/auth/session");
await staff.api("/api/users", "GET", undefined, 403);
for (const row of await admin.api("/api/users")) {
  assert.equal("passwordHash" in row, false);
  assert.equal("sessionVersion" in row, false);
}
console.log(
  "PASS: admin preservation, deny-by-default users, page/API permissions, privilege-escalation denial, scoped lookups, live permission revocation, stale updates, disable/re-enable session revocation, password resets, role changes, self-protection and safe user DTOs",
);
