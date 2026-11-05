// Run only against an isolated local database/server. Creates labelled fixtures.
import assert from "node:assert/strict";
const base = process.env.APP_URL ?? "http://127.0.0.1:3000";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(base).hostname));
assert.ok(process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD);
function client() {
  let cookie = "";
  return async (path, method = "GET", body, status = 200) => {
    const r = await fetch(base + path, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(cookie ? { Cookie: cookie } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (r.headers.getSetCookie().length)
      cookie = r.headers
        .getSetCookie()
        .map((s) => s.split(";")[0])
        .join("; ");
    const d = await r.json().catch(() => ({}));
    assert.equal(r.status, status, `${path}: ${JSON.stringify(d)}`);
    return d;
  };
}
const admin = client(),
  staff = client(),
  anon = client();
await anon("/api/activity", "GET", undefined, 401);
await admin("/api/auth/login", "POST", {
  email: process.env.ADMIN_EMAIL,
  password: process.env.ADMIN_PASSWORD,
});
const me = (await admin("/api/auth/session")).user;
const tag = Date.now(),
  name = "Activity Staff " + tag,
  password = "Activity-test-only-123";
let user = await admin(
  "/api/users",
  "POST",
  {
    name,
    email: `activity-${tag}@example.test`,
    password,
    allowedModules: ["expenses"],
  },
  201,
);
await staff("/api/auth/login", "POST", { email: user.email, password });
await staff("/api/activity", "GET", undefined, 403);
const method = await admin(
  "/api/payment-methods",
  "POST",
  { name: "Activity Funds " + tag, openingBalance: 1800 },
  201,
);
const methods = await admin("/api/payment-methods");
const methodId =
  method.id ??
  methods.methods.find((m) => m.name === "Activity Funds " + tag).id;
const entry = {
  description: "Activity expense " + tag,
  amount: 2000,
  entryDate: "2026-11-05",
  paymentMethodId: methodId,
  requestKey: "activity-failed-" + tag,
};
await staff("/api/expenses", "POST", entry, 400);
let all = await admin("/api/activity?range=all&type=payments");
assert.equal(
  all.events.some((e) => e.description === entry.description),
  false,
  "Failed expense has no activity",
);
const expense = await staff(
  "/api/expenses",
  "POST",
  { ...entry, amount: 1000, requestKey: "activity-ok-" + tag },
  201,
);
all = await admin("/api/activity?range=today&type=payments");
const event = all.events.find((e) => e.description === entry.description);
assert.ok(event, "Successful expense is logged");
assert.equal(event.actorId, user.id);
assert.equal(event.actorName, name);
assert.equal(event.actorEmail, user.email);
assert.equal(Number(event.amount), 1000);
assert.equal(event.direction, "out");
assert.equal(event.method, "Activity Funds " + tag);
assert.ok(all.summary.cashOut >= 1000);
assert.equal(all.summary.invoices, 0);
assert.equal(all.summary.tasks, 0);
await staff(
  "/api/expenses",
  "POST",
  { ...entry, amount: 1000, requestKey: "activity-ok-" + tag },
  200,
);
all = await admin("/api/activity?range=all&type=payments");
assert.equal(
  all.events.filter(
    (e) => e.entityId === expense.id && e.type === "Payment Made",
  ).length,
  1,
  "Idempotent retry has no duplicate event",
);
user = await admin("/api/users/" + user.id, "PATCH", {
  updatedAt: user.updatedAt,
  allowedModules: ["activity"],
});
await staff("/api/activity");
await staff("/api/expenses", "GET", undefined, 403);
const users = await admin("/api/activity?range=all&type=users");
const created = users.events.find(
  (e) => e.entityId === user.id && e.type === "User Created",
);
assert.ok(created);
assert.equal(created.actorId, me.id);
assert.equal(JSON.stringify(created).includes("passwordHash"), false);
assert.equal(JSON.stringify(created).includes(password), false);
user = await admin("/api/users/" + user.id, "PATCH", {
  updatedAt: user.updatedAt,
  allowedModules: [],
});
await staff("/api/activity", "GET", undefined, 403);
for (const query of ["range=bad", "type=bad", "page=-1", "page=1.5"])
  await admin("/api/activity?" + query, "GET", undefined, 400);
const empty = await admin("/api/activity?page=100000");
assert.deepEqual(empty.events, []);
assert.ok(empty.total > 0);
console.log(
  "PASS: activity actor attribution, permission enforcement/revocation, expense rejection rollback, idempotency, payment amount/method, filtered summaries, safe fields and pagination",
);
