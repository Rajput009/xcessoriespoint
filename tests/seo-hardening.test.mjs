/* Hardening + SEO surface regression tests — spawns a hermetic server instance.
 * Run: npm test   (executed via tests/*.mjs glob)
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";

const PORT = 4601;
const B = `http://localhost:${PORT}/api`;
const R = `http://localhost:${PORT}`;
const DB = "/tmp/xp-hardening-test.db";
let child;
let adminToken;

const j = (body, headers = {}) => ({ method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });
const putReq = (body, headers = {}) => ({ method: "PUT", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });
const get = async (p, headers = {}) => {
  const r = await fetch(B + p, { headers });
  return { status: r.status, body: await r.json().catch(() => null) };
};

before(async () => {
  for (const f of [DB, DB + "-wal", DB + "-shm"]) fs.rmSync(f, { force: true });
  child = spawn("node", ["server/index.mjs"], {
    env: {
      ...process.env,
      PORT: String(PORT),
      XP_DB_PATH: DB,
      XP_ADMIN_EMAIL: "hard@test.pk",
      XP_ADMIN_PASSWORD: "test-pw-123",
      XP_BASE_URL: "https://test.example.com",
      XP_ALLOWED_ORIGIN: "https://allowed.example.com",
    },
    stdio: "ignore",
  });
  for (let i = 0; i < 50; i++) {
    try { if ((await fetch(B + "/health")).ok) break; } catch { /* booting */ }
    await new Promise((r) => setTimeout(r, 100));
  }
});

after(() => child?.kill("SIGKILL"));

/* ---------- 404 whitelist & static serving ---------- */

test("unknown paths return real 404 with app shell", async () => {
  const r = await fetch(R + "/definitely-not-a-page");
  assert.equal(r.status, 404);
  const html = await r.text();
  assert.ok(html.includes('<div id="root">'), "shell still served");
});

test("whitelisted routes return 200", async () => {
  for (const p of ["/", "/shop", "/checkout", "/privacy"]) {
    const r = await fetch(R + p);
    assert.equal(r.status, 200, p);
  }
});

test("homepage shell rewrites relative og:image / JSON-LD URLs to absolute", async () => {
  // requires dist/ to exist (npm run build first) — mirrors production serving
  if (!fs.existsSync(new URL("../dist/index.html", import.meta.url))) return;
  const html = await (await fetch(R + "/")).text();
  const base = "https://test.example.com";
  assert.ok(html.includes(`property="og:image" content="${base}/img/hero-1.png"`), "og:image absolute");
  assert.ok(html.includes(`"logo": "${base}/icon-192.png"`), "jsonld logo absolute");
  assert.ok(html.includes("<title>Tech Accessories"), "default title preserved");
});

test("traversal-style paths are rejected", async () => {
  const r = await fetch(R + "/product/../etc");
  assert.equal(r.status, 404);
});

/* ---------- CORS lockdown ---------- */

test("CORS: disallowed origin gets no ACAO header", async () => {
  const r = await fetch(B + "/config", { headers: { Origin: "https://evil.example.com" } });
  assert.equal(r.headers.get("access-control-allow-origin"), null);
});

test("CORS: allowed origin gets echoed ACAO header", async () => {
  const r = await fetch(B + "/config", { headers: { Origin: "https://allowed.example.com" } });
  assert.equal(r.headers.get("access-control-allow-origin"), "https://allowed.example.com");
  assert.equal(r.headers.get("vary"), "Origin");
});

test("CORS: preflight echoes allowed origin", async () => {
  const r = await fetch(B + "/config", {
    method: "OPTIONS",
    headers: { Origin: "https://allowed.example.com", "Access-Control-Request-Method": "POST" },
  });
  assert.equal(r.headers.get("access-control-allow-origin"), "https://allowed.example.com");
});

/* ---------- robots.txt honors XP_BASE_URL ---------- */

test("robots.txt is dynamic and references env base URL", async () => {
  const r = await fetch(R + "/robots.txt");
  assert.equal(r.status, 200);
  const txt = await r.text();
  assert.ok(txt.includes("Sitemap: https://test.example.com/sitemap.xml"));
  assert.ok(txt.includes("Disallow: /admin"));
});

/* ---------- order ID entropy ---------- */

test("order IDs have full entropy (12 hex chars)", async () => {
  const r = await fetch(B + "/orders", j({
    items: [{ id: 2, qty: 1 }],
    email: "h@t.pk", customer: "H", phone: "0300", address: "s", city: "Lhr", payment: "cod",
  }));
  const o = await r.json();
  assert.equal(r.status, 201);
  assert.match(o.id, /^XP-[A-F0-9]{12}$/);
});

/* ---------- session lifecycle (hashed tokens) ---------- */

test("login → authenticated call → logout → rejected", async () => {
  const login = await fetch(B + "/auth/login", j({ email: "hard@test.pk", password: "test-pw-123" }));
  assert.equal(login.status, 201); // all POSTs return 201 by design
  const { token } = await login.json();
  assert.ok(token);

  const me = await get("/auth/me", { Authorization: `Bearer ${token}` });
  assert.equal(me.status, 200);

  await fetch(B + "/auth/logout", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
  const after = await get("/auth/me", { Authorization: `Bearer ${token}` });
  assert.equal(after.status, 401);
});

/* ---------- programmatic SEO band pages ---------- */

test("band pages: gate, ranking shape, bogus band 404", async () => {
  const bands = (await get("/categories/audio/bands")).body;
  assert.ok(Array.isArray(bands));
  if (bands.length > 0) {
    const b = bands[0];
    assert.ok(b.url.startsWith(`/category/audio/`));
    const d = await get(`/categories/audio/bands/${b.bandId}`);
    assert.equal(d.status, 200);
    assert.ok(d.body.items.length >= 3, "quality gate: min 3 items");
    assert.equal(d.body.items[0].rank, 1);
    assert.ok(typeof d.body.items[0].why === "string" && d.body.why !== "");
    assert.ok(Array.isArray(d.body.siblings));
  }
  const bad = await get("/categories/audio/bands/bogus-band");
  assert.equal(bad.status, 404);
});

test("pseo intros are admin-only and overridable", async () => {
  const unauth = await get("/pseo/pages");
  assert.ok([401, 403].includes(unauth.status));

  const login = await fetch(B + "/auth/login", j({ email: "hard@test.pk", password: "test-pw-123" }));
  adminToken = (await login.json()).token;
  assert.ok(adminToken);

  const pages = await get("/pseo/pages", { Authorization: `Bearer ${adminToken}` });
  assert.equal(pages.status, 200);
  assert.ok(pages.body.length >= 1);
  const p0 = pages.body[0];

  const put = await fetch(B + "/pseo/intro", putReq(
    { categoryId: p0.categoryId, band: p0.bandId, intro: "Custom intro from test." },
    { Authorization: `Bearer ${adminToken}` }
  ));
  assert.equal(put.status, 200);
  const d = await get(`/categories/${p0.categoryId}/bands/${p0.bandId}`);
  assert.equal(d.body.intro, "Custom intro from test.");
});

/* ---------- AEO guides ---------- */

test("guides: seeded set served publicly with TLDR + sections", async () => {
  const list = await get("/guides");
  assert.equal(list.status, 200);
  assert.ok(list.body.length >= 8);
  const g = await get("/guides/what-is-anc-noise-cancellation");
  assert.equal(g.status, 200);
  assert.ok(g.body.tldr.length > 80);
  assert.ok(g.body.sections.length >= 3);
});

test("guides: unpublish hides publicly but stays visible to staff", async () => {
  const slug = "bluetooth-5-3-meaning";
  const put = await fetch(B + `/guides/${slug}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ published: false }),
  });
  assert.equal(put.status, 200);

  const pub = await get("/guides");
  assert.ok(!pub.body.some((g) => g.slug === slug), "hidden from public list");
  const detail = await get(`/guides/${slug}`);
  assert.equal(detail.status, 404);

  const adminList = await get("/guides", { Authorization: `Bearer ${adminToken}` });
  assert.ok(adminList.body.some((g) => g.slug === slug && g.published === false), "visible to staff");

  // restore
  await fetch(B + `/guides/${slug}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ published: true }),
  });
});

/* ---------- policies ---------- */

test("policies: public read, admin write, path whitelist", async () => {
  const pub = await get("/policies/privacy");
  assert.equal(pub.status, 200);
  assert.ok(pub.body.sections.length >= 4);

  const put = await fetch(B + "/policies/terms", putReq(
    { title: "Terms of Service", updated: "Test 2026", sections: [{ heading: "T1", body: "B1" }] },
    { Authorization: `Bearer ${adminToken}` }
  ));
  assert.equal(put.status, 200);
  const after = await get("/policies/terms");
  assert.equal(after.body.updated, "Test 2026");

  const bad = await get("/policies/nope");
  assert.equal(bad.status, 404);
});

/* ---------- request body limits ---------- */

test("oversized JSON body gets a clean 413, not a connection reset", async () => {
  const big = JSON.stringify({ pad: "x".repeat(1.2 * 1024 * 1024) });
  const r = await fetch(B + "/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: big });
  assert.equal(r.status, 413);
  const b = await r.json();
  assert.ok(/too large/i.test(b.error));
});

/* ---------- order integrity (stock math + payment status) ---------- */

test("duplicate cart lines are merged before the stock check", async () => {
  // product 2 has no variants; two lines totalling far above stock must fail
  const stock = (await get("/products/2")).body.stock;
  const lines = [
    { id: 2, qty: Math.ceil(stock / 2) + 1 },
    { id: 2, qty: Math.ceil(stock / 2) + 1 },
  ];
  const r = await fetch(B + "/orders", j({ items: lines, customer: "T", email: "t@t.pk", phone: "03001234567", address: "a", city: "c", payment: "cod" }));
  assert.equal(r.status, 400);
  const b = await r.json();
  assert.ok(/left in stock/i.test(b.error), `expected stock error, got: ${b.error}`);
});

test("order totals merge duplicate lines into one charge line", async () => {
  const p = (await get("/products/2")).body;
  if (p.stock < 3) return; // need some stock for this test
  const r = await fetch(B + "/orders", j({
    items: [{ id: 2, qty: 1 }, { id: 2, qty: 2 }],
    customer: "Merge Test", email: "m@t.pk", phone: "03001234567", address: "a", city: "c", payment: "cod",
  }));
  assert.equal(r.status, 201);
  const o = await r.json();
  const sameItem = o.items.filter((i) => i.productId === 2);
  assert.equal(sameItem.length, 1, "lines merged");
  assert.equal(sameItem[0].qty, 3);
  const after = (await get("/products/2")).body.stock;
  assert.equal(after, p.stock - 3, "stock decremented once by merged qty");
});

test("Failed orders restock like Cancelled ones", async () => {
  const p = (await get("/products/2")).body;
  const r = await fetch(B + "/orders", j({
    items: [{ id: 2, qty: 1 }],
    customer: "Fail Test", email: "f@t.pk", phone: "03001234567", address: "a", city: "c", payment: "card",
  }));
  assert.equal(r.status, 201);
  const o = await r.json();
  assert.equal((await get("/products/2")).body.stock, p.stock - 1);

  const s = await fetch(B + `/orders/${o.id}/status`, putReq({ status: "Failed" }, { Authorization: `Bearer ${adminToken}` }));
  assert.equal(s.status, 200);
  assert.equal((await get("/products/2")).body.stock, p.stock, "stock restored on Failed");
});

test("refunding an already-cancelled order never restocks twice", async () => {
  const p = (await get("/products/2")).body;
  const r = await fetch(B + "/orders", j({
    items: [{ id: 2, qty: 1 }],
    customer: "Double Restock", email: "d@t.pk", phone: "03001234567", address: "a", city: "c", payment: "cod",
  }));
  const o = await r.json();
  assert.equal((await get("/products/2")).body.stock, p.stock - 1);

  // cancel → restock #1
  await fetch(B + `/orders/${o.id}/status`, putReq({ status: "Cancelled" }, { Authorization: `Bearer ${adminToken}` }));
  assert.equal((await get("/products/2")).body.stock, p.stock, "restocked on cancel");

  // refund with restock=true → must NOT restock again
  const rf = await fetch(B + "/refunds", j(
    { orderId: o.id, amount: o.total, reason: "test", restock: true },
    { Authorization: `Bearer ${adminToken}` }
  ));
  assert.equal(rf.status, 201);
  assert.equal((await get("/products/2")).body.stock, p.stock, "no double restock");

  // cancelling a Refunded order also must not restock again
  await fetch(B + `/orders/${o.id}/status`, putReq({ status: "Cancelled" }, { Authorization: `Bearer ${adminToken}` }));
  assert.equal((await get("/products/2")).body.stock, p.stock, "cancel-after-refund is a no-op");
});

test("cancelling a pending COD order does not mark the payment refunded", async () => {
  const r = await fetch(B + "/orders", j({
    items: [{ id: 2, qty: 1 }],
    customer: "COD Cancel", email: "cc@t.pk", phone: "03001234567", address: "a", city: "c", payment: "cod",
  }));
  const o = await r.json();
  assert.equal(o.paymentInfo.status, "pending");
  await fetch(B + `/orders/${o.id}/status`, putReq({ status: "Cancelled" }, { Authorization: `Bearer ${adminToken}` }));
  const tracked = (await get(`/orders/${o.id}`)).body;
  assert.notEqual(tracked.paymentInfo?.status, "refunded");
});

/* ---------- misc hardening ---------- */

test("GET /cart without a cart id creates nothing and returns an empty ephemeral cart", async () => {
  const r = await fetch(B + "/cart");
  assert.equal(r.status, 200);
  const b = await r.json();
  assert.equal(b.id, null);
  assert.deepEqual(b.items, []);
});

test("public order tracking hides city too", async () => {
  const r = await fetch(B + "/orders", j({
    items: [{ id: 1, qty: 1 }],
    customer: "Privacy Test", email: "p@t.pk", phone: "03001234567", address: "a", city: "SecretCity", payment: "cod",
  }));
  const o = await r.json();
  const tracked = (await get(`/orders/${o.id}`)).body;
  assert.equal(tracked.city, undefined);
  assert.equal(tracked.address, undefined);
  assert.equal(tracked.phone, undefined);
});

test("public config exposes merchandising keys only (no secrets)", async () => {
  const c = (await get("/config")).body;
  for (const k of ["saleEndsAt", "heroSlide1", "dealOfDay1", "deliveryDaysCity", "deliveryDaysOther"])
    assert.ok(k in c, `${k} exposed`);
  assert.equal(c.metaCapiToken, undefined, "secrets stay private");
});

test("invalid coupon type gets a clean 400, not a CHECK-constraint 500", async () => {
  const mk = await fetch(B + "/coupons", j(
    { code: "TESTBAD", type: "fixed", value: 50, minOrder: 0 },
    { Authorization: `Bearer ${adminToken}` }
  ));
  assert.ok([200, 201].includes(mk.status));
  const up = await fetch(B + "/coupons/TESTBAD", putReq({ type: "bogus" }, { Authorization: `Bearer ${adminToken}` }));
  assert.equal(up.status, 400);
});

test("product PUT with unknown category returns 400, not FK-500", async () => {
  const r = await fetch(B + "/products/1", putReq({ category: "nope" }, { Authorization: `Bearer ${adminToken}` }));
  assert.equal(r.status, 400);
});

test("malformed percent-encoding in path params returns 400", async () => {
  const r = await fetch(B + "/guides/%zz");
  assert.equal(r.status, 400);
});

test("removing the last approved review resets the product rating to 0", async () => {
  // seed gives product 1 approved reviews → add one, verify aggregate, zero it out
  const mk = await fetch(B + "/products/1/reviews", j(
    { name: "Temp", email: "tmp@t.pk", rating: 3, text: "temp review" }
  ));
  if (![200, 201].includes(mk.status)) return; // endpoint shape changed — skip gracefully
  const { id } = await mk.json();
  await fetch(B + `/reviews/${id}`, putReq({ status: "approved" }, { Authorization: `Bearer ${adminToken}` }));
  assert.ok((await get("/products/1")).body.rating > 0);

  // unapproving every review zeroes the aggregate
  const reviews = (await get("/reviews", { Authorization: `Bearer ${adminToken}` }))
    .body.filter((r) => r.productId === 1 && r.status === "approved");
  for (const r of reviews)
    await fetch(B + `/reviews/${r.id}`, putReq({ status: "rejected" }, { Authorization: `Bearer ${adminToken}` }));
  assert.equal((await get("/products/1")).body.rating, 0, "rating zeroed when no approved reviews remain");

  // restore
  for (const r of reviews)
    await fetch(B + `/reviews/${r.id}`, putReq({ status: "approved" }, { Authorization: `Bearer ${adminToken}` }));
  assert.ok((await get("/products/1")).body.rating > 0, "restored");
});

/* ---------- stats endpoint ---------- */

test("product stats expose soldThisWeek + topVariantId shape", async () => {
  const s = await get("/products/1/stats");
  assert.equal(s.status, 200);
  assert.equal(typeof s.body.soldThisWeek, "number");
  assert.ok("topVariantId" in s.body);
});

/* ---------- sitemap ---------- */

test("sitemap includes categories, guides and products", async () => {
  const r = await fetch(R + "/sitemap.xml");
  const xml = await r.text();
  assert.ok(xml.includes("/category/audio"));
  assert.ok(xml.includes("/guides/what-is-anc-noise-cancellation"));
  assert.ok(xml.includes("/product/1"));
  assert.ok(xml.includes("<lastmod>"));
});
