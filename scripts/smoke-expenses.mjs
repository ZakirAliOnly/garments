// Creates test records. Run only against a local server backed by an isolated database.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
const base = process.env.APP_URL ?? "http://127.0.0.1:3000";
assert.ok(
  ["localhost", "127.0.0.1"].includes(new URL(base).hostname),
  "Use a local isolated test server",
);
assert.ok(
  process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD,
  "Set test admin credentials",
);
let cookie = "";
async function api(path, method = "GET", body, status = 200) {
  const r = await fetch(base + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  if (path === "/api/auth/login")
    cookie = r.headers
      .getSetCookie()
      .map((s) => s.split(";")[0])
      .join("; ");
  assert.equal(r.status, status, `${method} ${path}: ${JSON.stringify(data)}`);
  return data;
}
await api("/api/expenses", "GET", undefined, 401);
await api("/api/expenses", "POST", {}, 401);
await api("/api/auth/login", "POST", {
  email: process.env.ADMIN_EMAIL,
  password: process.env.ADMIN_PASSWORD,
});
const tag = "EXP-" + Date.now(),
  day = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Karachi" });
const createMethod = async (name, openingBalance) =>
  api(
    "/api/payment-methods",
    "POST",
    { name: tag + " " + name, openingBalance },
    201,
  );
const a = await createMethod("Cash", 1800),
  b = await createMethod("Bank", 500);
const balance = async (id) =>
  (await api("/api/payment-methods")).methods.find((m) => m.id === id).balance;
const list = async (id) =>
  api(`/api/expenses?from=${day}&to=${day}&methodId=${id}`);
const body = {
  entryDate: day,
  description: tag + " Daily supplies",
  amount: 2000,
  paymentMethodId: a.id,
  requestKey: randomUUID(),
};
const denied = await api("/api/expenses", "POST", body, 400);
assert.match(denied.error, /insufficient funds/);
assert.equal(await balance(a.id), 1800);
assert.equal((await list(a.id)).summary.count, 0);
await api(
  "/api/cashbook",
  "POST",
  {
    entryDate: day,
    type: "debit",
    description: tag + " manual expense",
    amount: 2000,
    paymentMethodId: a.id,
  },
  400,
);
assert.equal(await balance(a.id), 1800);
const expense = await api(
  "/api/expenses",
  "POST",
  { ...body, amount: 1800 },
  201,
);
assert.equal(await balance(a.id), 0);
await api("/api/expenses", "POST", { ...body, amount: 1800 });
assert.equal(await balance(a.id), 0);
assert.equal((await list(a.id)).summary.count, 1);
await api("/api/cashbook/" + expense.id, "DELETE", undefined, 400);
await api(
  "/api/expenses/" + expense.id,
  "PATCH",
  { ...body, amount: 2000, updatedAt: expense.updatedAt },
  400,
);
assert.equal(await balance(a.id), 0);
let updated = await api("/api/expenses/" + expense.id, "PATCH", {
  ...body,
  amount: 1600,
  updatedAt: expense.updatedAt,
});
assert.equal(await balance(a.id), 200);
await api(
  "/api/expenses/" + expense.id,
  "PATCH",
  {
    ...body,
    amount: 1600,
    paymentMethodId: b.id,
    updatedAt: updated.updatedAt,
  },
  400,
);
assert.equal(await balance(a.id), 200);
assert.equal(await balance(b.id), 500);
updated = await api("/api/expenses/" + expense.id, "PATCH", {
  ...body,
  amount: 400,
  paymentMethodId: b.id,
  updatedAt: updated.updatedAt,
});
assert.equal(await balance(a.id), 1800);
assert.equal(await balance(b.id), 100);
await api(
  "/api/expenses/" + expense.id,
  "PATCH",
  { ...body, amount: 100, updatedAt: expense.updatedAt },
  400,
);
assert.equal(await balance(b.id), 100);
await api("/api/expenses/" + expense.id, "DELETE", {
  updatedAt: updated.updatedAt,
});
assert.equal(await balance(b.id), 500);
for (const amount of [0, -1, 0.001, "abc"])
  await api(
    "/api/expenses",
    "POST",
    { ...body, amount, requestKey: randomUUID() },
    400,
  );
await api(
  "/api/expenses",
  "POST",
  { ...body, entryDate: "2026-02-30", requestKey: randomUUID() },
  400,
);
await api("/api/expenses?from=2026-11-10&to=2026-11-01", "GET", undefined, 400);
await api("/api/payment-methods/" + b.id, "PATCH", { active: false });
await api(
  "/api/expenses",
  "POST",
  { ...body, amount: 1, paymentMethodId: b.id, requestKey: randomUUID() },
  400,
);
const concurrent = await createMethod("Concurrent", 1800);
const results = await Promise.all(
  [1, 2].map((i) =>
    fetch(base + "/api/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({
        ...body,
        description: tag + " concurrent " + i,
        amount: 1000,
        paymentMethodId: concurrent.id,
        requestKey: randomUUID(),
      }),
    }),
  ),
);
assert.deepEqual(results.map((r) => r.status).sort(), [201, 400]);
assert.equal(await balance(concurrent.id), 800);
assert.equal((await list(concurrent.id)).summary.count, 1);
const retryMethod = await createMethod("Retry", 1800),
  retryBody = {
    ...body,
    amount: 1800,
    paymentMethodId: retryMethod.id,
    requestKey: randomUUID(),
  };
const retries = await Promise.all(
  [1, 2].map(() =>
    fetch(base + "/api/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify(retryBody),
    }),
  ),
);
assert.deepEqual(retries.map((r) => r.status).sort(), [200, 201]);
assert.equal(await balance(retryMethod.id), 0);
assert.equal((await list(retryMethod.id)).summary.count, 1);
const cashbook = await api(`/api/cashbook?paymentMethodId=${retryMethod.id}`);
assert.equal(
  cashbook.entries.filter((e) => e.sourceType === "expense").length,
  1,
);
assert.equal(cashbook.totals.totalExpense, 1800);
console.log(
  "PASS: 1800/2000 rejection, exact-balance expense, duplicate protection, edits/method changes/delete reversals, stale-edit protection, invalid amounts/dates, archived methods, concurrent funds checks and shared cashbook totals",
);
// Exercise commit-time adapter conflicts repeatedly, not just a single race.
for (let round = 0; round < 5; round++) {
  const method = await createMethod("Race " + round, 1800);
  const sameRequest = round % 2 === 0;
  const firstKey = randomUUID();
  const responses = await Promise.all(
    [1, 2].map((i) =>
      fetch(base + "/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({
          ...body,
          amount: sameRequest ? 1800 : 1000,
          paymentMethodId: method.id,
          requestKey: sameRequest ? firstKey : randomUUID(),
          description: sameRequest
            ? tag + " retry race"
            : tag + " spending race " + i,
        }),
      }),
    ),
  );
  assert.deepEqual(
    responses.map((r) => r.status).sort(),
    sameRequest ? [200, 201] : [201, 400],
  );
  assert.equal(await balance(method.id), sameRequest ? 0 : 800);
  assert.equal((await list(method.id)).summary.count, 1);
}
console.log("PASS: repeated concurrent duplicate and competing-spend races");
