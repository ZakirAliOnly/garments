// Run against an isolated test database/server. Creates labelled test records; does not delete financial history.
// APP_URL=http://localhost:3000 ADMIN_EMAIL=... ADMIN_PASSWORD=... node scripts/smoke-finance.mjs
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
const base = process.env.APP_URL ?? "http://127.0.0.1:3000";
assert.ok(
  ["127.0.0.1", "localhost"].includes(new URL(base).hostname),
  "Finance smoke tests must target a local isolated test server",
);
assert.ok(
  process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD,
  "Set test admin credentials",
);
let cookie = "";
async function request(path, method = "GET", body, expected = 200) {
  const response = await fetch(base + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (path === "/api/auth/login")
    cookie = response.headers
      .getSetCookie()
      .map((s) => s.split(";")[0])
      .join("; ");
  assert.equal(
    response.status,
    expected,
    `${method} ${path}: ${JSON.stringify(data)}`,
  );
  return data;
}
await request("/api/payment-methods", "GET", undefined, 401);
await request("/api/auth/login", "POST", {
  email: process.env.ADMIN_EMAIL,
  password: process.env.ADMIN_PASSWORD,
});
const tag = `FIN-${Date.now()}`,
  day = "2026-11-05",
  month = "2026-11";
const a = await request(
  "/api/payment-methods",
  "POST",
  { name: tag + " Cash", openingBalance: 100000 },
  201,
);
const b = await request(
  "/api/payment-methods",
  "POST",
  { name: tag + " Bank", openingBalance: 1000 },
  201,
);
const balances = async () =>
  Object.fromEntries(
    (await request("/api/payment-methods")).methods.map((m) => [
      m.id,
      m.balance,
    ]),
  );
let expectedA = 100000,
  expectedB = 1000;
const check = async () => {
  const actual = await balances();
  assert.equal(actual[a.id], expectedA);
  assert.equal(actual[b.id], expectedB);
};
const beforeTransfers = (await request("/api/cashbook")).totals;
const transfer = {
  fromId: a.id,
  toId: b.id,
  amount: 1000,
  entryDate: day,
  requestKey: randomUUID(),
};
await request("/api/payment-methods/transfers", "POST", transfer, 201);
expectedA -= 1000;
expectedB += 1000;
await check();
await request("/api/payment-methods/transfers", "POST", transfer);
await check();
const afterTransfers = (await request("/api/cashbook")).totals;
assert.equal(beforeTransfers.totalIncome, afterTransfers.totalIncome);
assert.equal(beforeTransfers.totalExpense, afterTransfers.totalExpense);
await request(
  "/api/payment-methods/transfers",
  "POST",
  { ...transfer, amount: 999999, requestKey: randomUUID() },
  400,
);
await check();
await request(
  "/api/cashbook",
  "POST",
  {
    entryDate: day,
    type: "debit",
    description: tag + " expense",
    amount: 250,
    paymentMethodId: a.id,
  },
  201,
);
expectedA -= 250;
const manual = await request(
  "/api/cashbook",
  "POST",
  {
    entryDate: day,
    type: "credit",
    description: tag + " income",
    amount: 500,
    paymentMethodId: b.id,
  },
  201,
);
expectedB += 500;
await check();
await request(`/api/cashbook/${manual.id}`, "PATCH", {
  entryDate: day,
  type: "debit",
  description: tag + " corrected",
  amount: 100,
  paymentMethod: a.name,
});
expectedB -= 500;
expectedA -= 100;
await check();
await request(`/api/cashbook/${manual.id}`, "DELETE");
expectedA += 100;
await check();
await request(
  "/api/cashbook",
  "POST",
  {
    entryDate: day,
    type: "debit",
    description: "invalid",
    amount: -10,
    paymentMethodId: a.id,
  },
  400,
);
await check();
const invBody = {
  type: "walk",
  customerName: tag,
  invoiceDate: day,
  items: [{ dt: "Test service", q: 1, r: 1000, a: 1000 }],
  subtotal: 1000,
  total: 1000,
  discount: 0,
  amountPaid: 0,
  balanceDue: 1000,
  paymentMethod: a.name,
};
const invoice = await request("/api/invoices", "POST", invBody, 201);
await check();
await request(`/api/invoices/${invoice.id}`, "PATCH", {
  amountPaid: 1000,
  paymentMethod: b.name,
});
expectedB += 1000;
await check();
await request(`/api/invoices/${invoice.id}`, "PATCH", {
  amountPaid: 1000,
  paymentMethod: b.name,
});
await check();
const ledger = (await request("/api/cashbook")).entries.find(
  (e) => e.invoiceId === invoice.id,
);
await request(`/api/cashbook/${ledger.id}`, "DELETE", undefined, 400);
await check();
await request(`/api/invoices/${invoice.id}`, "DELETE", undefined, 400);
await check();
const count = (await request("/api/invoices")).length;
await request(
  "/api/invoices",
  "POST",
  { ...invBody, paymentMethod: "nonexistent-method" },
  400,
);
assert.equal(
  (await request("/api/invoices")).length,
  count,
  "Invalid method must roll back invoice creation",
);
await request(
  "/api/refunds",
  "POST",
  {
    invNumber: invoice.invNumber,
    type: "refund",
    settlement: "cash",
    paymentMethod: a.name,
    items: [{ dt: "Test service", q: 1, r: 1, a: 1 }],
  },
  201,
);
expectedA -= 1000;
await check();
await request(
  "/api/refunds",
  "POST",
  {
    invNumber: invoice.invNumber,
    type: "refund",
    settlement: "cash",
    paymentMethod: a.name,
    items: [{ dt: "Test service", q: 1, r: 1000, a: 1000 }],
  },
  400,
);
await check();
const unpaid = await request("/api/invoices", "POST", invBody, 201);
await request(
  "/api/refunds",
  "POST",
  {
    invNumber: unpaid.invNumber,
    type: "refund",
    settlement: "cash",
    paymentMethod: a.name,
    items: [{ dt: "Test service", q: 1, r: 1000, a: 1000 }],
  },
  201,
);
await check();
const supplier = await request(
  "/api/suppliers",
  "POST",
  { name: tag + " Supplier" },
  201,
);
const orders = await request(
  "/api/purchases/bulk",
  "POST",
  {
    supplierId: supplier.id,
    dateTime: day,
    items: [
      { stockName: "Fabric 1", qty: 1, unitPrice: 500 },
      { stockName: "Fabric 2", qty: 1, unitPrice: 500 },
    ],
    advancePaid: 300,
    paymentMode: a.name,
  },
  201,
);
expectedA -= 300;
await check();
assert.equal(orders.length, 2);
assert.notEqual(orders[0].poNumber, orders[1].poNumber);
await request(`/api/purchases/${orders[0].id}`, "PATCH", {
  additionalPayment: 200,
  paymentMethod: b.name,
});
expectedB -= 200;
await check();
const worker = await request(
  "/api/workers",
  "POST",
  {
    name: tag + " Worker",
    role: "Tailor",
    salaryType: "monthly",
    rate: 30000,
    extraHoursRate: 100,
    status: "active",
  },
  201,
);
const payroll = async (action, body = {}, expected = 201) =>
  request(
    `/api/workers/${worker.id}/payroll`,
    "POST",
    {
      month,
      entryDate: day,
      requestKey: randomUUID(),
      action,
      paymentMethod: a.name,
      ...body,
    },
    expected,
  );
await payroll("extra", { hours: 2, rate: 100 });
await check();
const advanceKey = randomUUID();
await payroll("advance", { amount: 5000, requestKey: advanceKey });
expectedA -= 5000;
await check();
await payroll("advance", { amount: 5000, requestKey: advanceKey }, 400);
await check();
await payroll("pay", { absentDays: 1 });
expectedA -= 24200;
await check();
await payroll("pay", { absentDays: 1 }, 400);
await payroll("extra", { hours: 2, rate: 100 }, 400);
await check();
const current = (await request(`/api/payroll?month=${month}`)).workers.find(
  (w) => w.id === worker.id,
);
assert.equal(Number(current.payroll.paidAmount), 24200);
const next = (await request("/api/payroll?month=2026-12")).workers.find(
  (w) => w.id === worker.id,
);
assert.equal(next.totals.advances, 0);
assert.equal(next.totals.extra, 0);
assert.equal(next.payroll, null);
assert.equal(next.totals.net, 30000);
await request(`/api/payment-methods/${b.id}`, "PATCH", { active: false });
await request(
  "/api/cashbook",
  "POST",
  {
    entryDate: day,
    type: "credit",
    description: "archived method",
    amount: 100,
    paymentMethodId: b.id,
  },
  400,
);
await check();
await request(
  `/api/payment-methods/${a.id}`,
  "PATCH",
  { openingBalance: 999 },
  400,
);
await check();
console.log(
  "PASS: authentication, transfers/idempotence, cashbook edit/delete reversals, invoice create/payment retry, refunds and unpaid refunds, bulk purchases/top-ups, payroll extra/advance/absence/payment, duplicate protection, month isolation, archived methods and opening locks",
);

// Customer advances must not be counted again when applied to an invoice.
await request(`/api/payment-methods/${b.id}`, "PATCH", { active: true });
const header = await request(
  "/api/account-headers",
  "POST",
  { name: tag + " customers", prefix: String(Date.now()).slice(-6) },
  201,
);
const customer = await request(
  "/api/customers",
  "POST",
  {
    name: tag + " Account",
    phone: "03000000000",
    headerId: header.id,
    balance: -1000,
    paymentMethod: a.name,
  },
  201,
);
expectedA += 1000;
await check();
const regular = await request(
  "/api/invoices",
  "POST",
  {
    ...invBody,
    type: "regular",
    customerId: customer.id,
    total: 2000,
    subtotal: 2000,
    items: [{ dt: "Account service", q: 1, r: 2000, a: 2000 }],
    amountPaid: 1000,
    balanceDue: 1000,
    paymentMethod: b.name,
  },
  201,
);
await check();
await request(`/api/invoices/${regular.id}`, "PATCH", {
  amountPaid: 1500,
  paymentMethod: b.name,
});
expectedB += 500;
await check();
await request(
  "/api/refunds",
  "POST",
  {
    invNumber: regular.invNumber,
    type: "refund",
    settlement: "cash",
    paymentMethod: a.name,
    items: [{ dt: "Account service", q: 0.5, r: 2000, a: 1000 }],
  },
  201,
);
expectedA -= 500;
await check();
const regularRefunded = (await request("/api/invoices")).find(
  (i) => i.id === regular.id,
);
assert.equal(
  regularRefunded.balanceDue,
  0,
  "Refund cancels unpaid amount before paying cash",
);
const paidInvoice = await request(
  "/api/invoices",
  "POST",
  { ...invBody, amountPaid: 1000, balanceDue: 0 },
  201,
);
expectedA += 1000;
await check();
await request(
  "/api/refunds",
  "POST",
  {
    invNumber: paidInvoice.invNumber,
    type: "replace",
    settlement: "cash",
    paymentMethod: b.name,
    items: [{ dt: "Test service", q: 1, r: 1000, a: 1000 }],
    replacementItems: [{ dt: "Replacement service", q: 1, r: 1500, a: 1500 }],
  },
  201,
);
expectedB += 500;
await check();
const badCount = (await request("/api/invoices")).length;
await request(
  "/api/invoices",
  "POST",
  {
    ...invBody,
    items: [
      {
        dt: "Missing stock",
        q: 1,
        r: 1000,
        a: 1000,
        stockId: "not-a-real-stock-id",
      },
    ],
    amountPaid: 1000,
    balanceDue: 0,
  },
  500,
);
assert.equal((await request("/api/invoices")).length, badCount);
await check();
const purchaseCount = (await request("/api/purchases")).length;
await request(
  "/api/purchases/bulk",
  "POST",
  {
    supplierId: supplier.id,
    dateTime: day,
    items: [
      { stockName: "First valid item", qty: 1, unitPrice: 10 },
      {
        stockName: "Missing stock",
        stockItemId: "not-a-real-stock-id",
        qty: 1,
        unitPrice: 10,
      },
    ],
    advancePaid: 20,
    paymentMode: a.name,
  },
  500,
);
assert.equal((await request("/api/purchases")).length, purchaseCount);
await check();
const key = randomUUID(),
  concurrent = {
    fromId: a.id,
    toId: b.id,
    amount: 10,
    entryDate: day,
    requestKey: key,
  };
const transferResults = await Promise.all(
  [1, 2].map(() =>
    fetch(base + "/api/payment-methods/transfers", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify(concurrent),
    }),
  ),
);
assert.ok(transferResults.some((r) => r.status === 201));
assert.ok(transferResults.every((r) => [200, 201, 409].includes(r.status)));
expectedA -= 10;
expectedB += 10;
await check();
console.log(
  "PASS: customer-advance reuse, refund debt/cash split, replacement receipts, failed stock/purchase rollback, concurrent transfer protection",
);
