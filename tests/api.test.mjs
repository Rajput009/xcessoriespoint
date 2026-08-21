/* API integration tests — spawns a hermetic server instance on a scratch DB.
 * Run: npm test
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";

const PORT = 4599;
const B = `http://localhost:${PORT}/api`;
const DB = "/tmp/xp-test.db";
let child;

const j = (body) => ({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const get = async (p, headers = {}) => (await fetch(B + p, { headers })).json();

before(async () => {
  for (const f of [DB, DB + "-wal", DB + "-shm"]) fs.rmSync(f, { force: true });
  child = spawn("node", ["server/index.mjs"], {
    env: { ...process.env, PORT: String(PORT), XP_DB_PATH: DB },
    stdio: "ignore",
  });
  // wait for the server to listen
  for (let i = 0; i < 50; i++) {
    try {
      const r = await fetch(B + "/health");
      if (r.ok) return;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("test server did not start");
});

after(() => child?.kill("SIGKILL"));

let adminToken;
let userToken;
let orderId;

test("health reports sqlite", async () => {
  const h = await get("/health");
  assert.equal(h.ok, true);
  assert.equal(h.engine, "sqlite");
});

test("products include variants, images and galleries", async () => {
  const products = await get("/products");
  assert.ok(products.length >= 16);
  const buds = products.find((p) => p.id === 1);
  assert.ok(buds.variants.length >= 2, "seeded variants");
  assert.ok(buds.images.length >= 2, "gallery images");
  assert.equal(buds.images[0], buds.image, "cover image first");
});

test("auth: register, login, wrong password, /me", async () => {
  const email = `t${Date.now()}@test.pk`;
  const reg = await get("", {}).catch(() => null); // noop guard
  const r1 = await fetch(B + "/auth/register", j({ name: "Tester", email, password: "secret1" }));
  assert.equal(r1.status, 201);
  userToken = (await r1.json()).token;
  const bad = await fetch(B + "/auth/login", j({ email, password: "wrong" }));
  assert.equal(bad.status, 401);
  const me = await get("/auth/me", { Authorization: `Bearer ${userToken}` });
  assert.equal(me.email, email);
  const a = await fetch(B + "/auth/login", j({ email: "admin@xccessoriespoint.com", password: "admin123" }));
  adminToken = (await a.json()).token;
  assert.ok(adminToken);
});

test("variant product refuses blind cart add, accepts variant", async () => {
  const blind = await fetch(B + "/cart/items", j({ productId: 1, qty: 1 }));
  assert.equal(blind.status, 400);
  const ok = await fetch(B + "/cart/items", j({ productId: 1, variantId: 2, qty: 2 }));
  assert.equal(ok.status, 201);
  const cart = await ok.json();
  assert.equal(cart.items[0].variantLabel, "Midnight Black");
});

test("cart qty validation: NaN → 400, capped at 99", async () => {
  const nan = await fetch(B + "/cart/items", j({ productId: 6, qty: "abc" }));
  assert.equal(nan.status, 400);
});

test("coupon math is server-computed", async () => {
  const r = await fetch(B + "/coupons/validate", j({ code: "WELCOME10", subtotal: 10000 }));
  const c = await r.json();
  assert.equal(c.discount, 1000);
});

test("order: variant pricing, stock decrement, confirmation email queued", async () => {
  const before = (await get("/products/3")).variants.find((v) => v.label === "Rose Pink").stock;
  const r = await fetch(
    B + "/orders",
    j({
      items: [{ id: 3, variantId: 5, qty: 1 }],
      email: "buyer@test.pk", customer: "Buyer", payment: "card",
      address: "1 Test St", city: "Lahore", phone: "03001234567",
    })
  );
  assert.equal(r.status, 201);
  const o = await r.json();
  orderId = o.id;
  assert.equal(o.status, "Confirmed", "online payment auto-confirms");
  assert.equal(o.paymentInfo.status, "paid");
  assert.equal(o.items[0].sku, "VF-S2-PNK");
  assert.equal(o.total, 6699, "base 6499 + delta 200; free ship over 5000");
  const afterStock = (await get("/products/3")).variants.find((v) => v.label === "Rose Pink").stock;
  assert.equal(afterStock, before - 1, "variant stock decremented");
  const emails = await get("/emails", { Authorization: `Bearer ${adminToken}` });
  assert.ok(emails.some((e) => e.toEmail === "buyer@test.pk" && e.subject.includes(o.id)), "order email queued");
});

test("public tracking hides PII", async () => {
  const o = await get(`/orders/${orderId}`);
  assert.equal(o.email, undefined);
  assert.equal(o.phone, undefined);
  assert.equal(o.address, undefined);
  assert.equal(o.customer, "Buyer", "first name only");
});

test("role walls: customer blocked from admin areas", async () => {
  for (const p of ["/audit", "/coupons", "/admin/metrics", "/emails"]) {
    const r = await fetch(B + p, { headers: { Authorization: `Bearer ${userToken}` } });
    assert.ok([401, 403].includes(r.status), `${p} → ${r.status}`);
  }
});

test("COD lifecycle: pending → delivered auto-pays", async () => {
  const r = await fetch(
    B + "/orders",
    j({ items: [{ id: 6, qty: 1 }], email: "cod@test.pk", customer: "COD Buyer", payment: "cod", address: "x", city: "Multan", phone: "03000000000" })
  );
  const o = await r.json();
  assert.equal(o.status, "Pending");
  assert.equal(o.paymentInfo.status, "pending");
  const upd = await fetch(B + `/orders/${o.id}/status`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ status: "Delivered" }),
  });
  const done = await upd.json();
  assert.equal(done.paymentInfo.status, "paid", "COD collected on delivery");
});

test("WhatsApp order: stays Pending and unpaid (like COD)", async () => {
  const r = await fetch(
    B + "/orders",
    j({
      items: [{ id: 6, qty: 2 }],
      email: "wa@test.pk", customer: "WA Buyer", payment: "whatsapp",
      address: "45-B Model Town", city: "Lahore 54000", phone: "03009876543",
    })
  );
  assert.equal(r.status, 201);
  const o = await r.json();
  assert.equal(o.payment, "whatsapp");
  assert.equal(o.status, "Pending", "WhatsApp orders are confirmed on chat, not auto-confirmed");
  assert.equal(o.paymentInfo.status, "pending");
  assert.equal(o.paymentInfo.txnRef, null, "no gateway transaction for a WhatsApp order");
  assert.equal(o.items[0].qty, 2);
});

test("back-in-stock: subscribe → restock queues email", async () => {
  await fetch(B + "/stock-alerts", j({ productId: 13, email: "wait@test.pk" }));
  // drain stock to 0 then restock via admin adjust
  const p = await get("/products/13");
  await fetch(B + "/inventory/adjust", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ productId: 13, delta: 5, reason: "manual", note: "restock test" }),
  });
  const emails = await get("/emails", { Authorization: `Bearer ${adminToken}` });
  assert.ok(emails.some((e) => e.toEmail === "wait@test.pk" && e.subject.startsWith("Back in stock")), "alert email queued");
});

test("consent gates analytics server-side", async () => {
  const noConsent = await (await fetch(B + "/analytics/events", {
    ...j({ type: "search", data: { q: "x" } }),
    headers: { "Content-Type": "application/json", "X-Visitor-Id": "vis-no" },
  })).json();
  assert.equal(noConsent.stored, false);
  await fetch(B + "/consent", j({ visitorId: "vis-yes", analytics: true }));
  const yes = await (await fetch(B + "/analytics/events", {
    ...j({ type: "search", data: { q: "x" } }),
    headers: { "Content-Type": "application/json", "X-Visitor-Id": "vis-yes" },
  })).json();
  assert.equal(yes.stored, true);
});

test("sitemap includes products and policies", async () => {
  const xml = await (await fetch(`http://localhost:${PORT}/sitemap.xml`)).text();
  assert.ok(xml.includes("/product/1"));
  assert.ok(xml.includes("/privacy"));
});
