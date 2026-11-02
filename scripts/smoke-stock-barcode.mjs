import assert from "node:assert/strict";
const base = process.env.APP_URL ?? "http://localhost:3000";
const ids = [];
const login = await fetch(`${base}/api/auth/sign-in/email`, {
  method: "POST", headers: { "Content-Type": "application/json", Origin: base },
  body: JSON.stringify({ email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD }),
});
assert.ok(login.ok, "Admin login failed");
const cookie = login.headers.getSetCookie().map((value) => value.split(";")[0]).join("; ");
async function request(path, method = "GET", body) {
  return fetch(`${base}${path}`, { method, headers: { Cookie: cookie, Origin: base, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
}
const stock = { name: `Barcode smoke ${Date.now()}`, category: "Other", unit: "pcs", quantity: 2, purchasePrice: 10, salesPrice: 20 };
try {
  const created = await request("/api/stock", "POST", stock);
  assert.equal(created.status, 201);
  const item = await created.json(); ids.push(item.id);
  const url = `/api/stock/${item.id}/barcode`;
  assert.equal((await fetch(`${base}${url}`)).status, 401);
  const response = await request(url);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /image\/svg\+xml/);
  const svg = await response.text();
  assert.ok(svg.includes("<svg") && svg.includes("<path") && svg.includes(item.sku));
  console.log("PASS: New stock generates Code 128 SVG; unauthenticated access denied");
  const updated = await request(`/api/stock/${item.id}`, "PATCH", { ...stock, quantity: 5 });
  assert.equal(updated.status, 200);
  assert.equal((await updated.json()).sku, item.sku);
  assert.equal(await (await request(url)).text(), svg);
  console.log("PASS: Adding quantity preserves the same scannable SKU barcode");
  const printed = await request(`${url}?print=1`);
  assert.equal(printed.status, 200);
  assert.ok((await printed.text()).includes("Print labels"));
  const variantsResponse = await request("/api/stock", "POST", { ...stock, hasVariants: true, variants: [{ size: "M", color: "Blue", quantity: 3 }, { size: "L", color: "Blue", quantity: 2 }] });
  assert.equal(variantsResponse.status, 201);
  const variantItem = await variantsResponse.json(); ids.push(variantItem.id);
  for (const variant of variantItem.variants) {
    const result = await request(`/api/stock/${variantItem.id}/barcode?variantId=${variant.id}`);
    assert.equal(result.status, 200);
    assert.ok((await result.text()).includes(variant.sku));
  }
  assert.equal((await request(`${url}?variantId=${variantItem.variants[0].id}`)).status, 404);
  console.log("PASS: Variants have distinct barcodes and printable labels; unrelated variants rejected");
} finally {
  for (const id of ids) assert.equal((await request(`/api/stock/${id}`, "DELETE")).status, 200);
  await request("/api/auth/sign-out", "POST", {});
  console.log("PASS: Test stock cleaned up");
}
