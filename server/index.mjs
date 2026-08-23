/* XccessoriesPoint API — complete backend (Node http + SQLite) */
import http from "node:http";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  db, seed, notify, getSetting, hashPassword, verifyPassword,
  audit, moveStock, latestConsent, sendEmail,
} from "./db.mjs";
import { PSEO_BANDS, resolveBand, liveBandPages, siblingBands, bandIntro } from "./pseo.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = parseInt(process.env.PORT || "4173", 10);
seed();

/* ================= roles & permissions ================= */
export const STAFF_ROLES = [
  "superadmin", "manager", "order-manager", "inventory-manager",
  "marketing-manager", "support", "content-editor", "reports-viewer",
];
const ROLE_AREAS = {
  superadmin: null, // all areas
  manager: new Set(["products", "orders", "inventory", "customers", "coupons", "reviews", "returns", "tickets", "notifications", "settings", "analytics", "payments", "refunds"]),
  "order-manager": new Set(["orders", "returns", "customers", "payments", "refunds", "notifications"]),
  "inventory-manager": new Set(["products", "inventory", "notifications"]),
  "marketing-manager": new Set(["coupons", "analytics", "notifications", "customers"]),
  support: new Set(["tickets", "returns", "orders", "customers", "notifications"]),
  "content-editor": new Set(["products", "reviews", "notifications"]),
  "reports-viewer": new Set(["analytics", "notifications"]),
};
const isStaff = (u) => u && STAFF_ROLES.includes(u.role);
const canAccess = (u, area) => {
  if (!isStaff(u)) return false;
  const areas = ROLE_AREAS[u.role];
  return areas === null || areas.has(area);
};

const publicUser = (u) => ({
  id: u.id, name: u.name, email: u.email,
  isAdmin: isStaff(u), role: u.role || "customer",
});

const productRow = (p, includeInactiveVariants = false) => {
  if (!p) return p;
  const extraImages = db
    .prepare("SELECT id, url FROM product_images WHERE productId = ? ORDER BY sortOrder, id")
    .all(p.id);
  const variants = db
    .prepare(
      `SELECT id, label, sku, priceDelta, stock, image, swatch, active FROM product_variants
       WHERE productId = ?${includeInactiveVariants ? "" : " AND active = 1"} ORDER BY id`
    )
    .all(p.id)
    .map((v) => ({ ...v, active: !!v.active }));
  return {
    ...p,
    featured: !!p.featured,
    bestSeller: !!p.bestSeller,
    newArrival: !!p.newArrival,
    dealOfDay: !!p.dealOfDay,
    active: !!p.active,
    variants,
    images: [p.image, ...extraImages.map((i) => i.url)].filter(Boolean),
    imageRecords: extraImages,
  };
};

/* resolve + validate a variant for a product (variantId 0/null = simple product) */
function resolveVariant(product, variantId) {
  if (!variantId) return null;
  const v = db
    .prepare("SELECT * FROM product_variants WHERE id = ? AND productId = ? AND active = 1")
    .get(variantId, product.id);
  if (!v) throw bad(`Invalid variant for "${product.name}"`);
  return v;
}

function orderWithItems(o) {
  if (!o) return null;
  const items = db
    .prepare("SELECT productId, variantId, variantLabel, sku, name, price, qty FROM order_items WHERE orderId = ?")
    .all(o.id);
  const payment = db
    .prepare("SELECT method, status, amount, txnRef FROM payments WHERE orderId = ? ORDER BY id DESC LIMIT 1")
    .get(o.id);
  return { ...o, items, paymentInfo: payment ?? null };
}

function sha256Hex(v) {
  return crypto.createHash("sha256").update(String(v)).digest("hex");
}

function sessionUser(req) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return null;
  // tokens are stored hashed; the plaintext fallback covers sessions created
  // before hashing was introduced (they expire naturally)
  const row = db
    .prepare(
      `SELECT u.* FROM sessions s JOIN users u ON u.id = s.userId
       WHERE s.token IN (?, ?) AND (s.expiresAt IS NULL OR s.expiresAt > datetime('now'))`
    )
    .get(sha256Hex(token), token);
  return row || null;
}

function createSession(userId) {
  // opportunistic cleanup of expired sessions
  db.prepare("DELETE FROM sessions WHERE expiresAt IS NOT NULL AND expiresAt <= datetime('now')").run();
  const token = crypto.randomBytes(32).toString("hex");
  // store only the hash — a DB leak no longer yields usable sessions
  db.prepare("INSERT INTO sessions (token, userId, expiresAt) VALUES (?,?,datetime('now','+30 days'))")
    .run(sha256Hex(token), userId);
  return token;
}

class HttpError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}
const bad = (m) => new HttpError(400, m);
const requireAuth = (ctx) => {
  if (!ctx.user) throw new HttpError(401, "Authentication required");
  return ctx.user;
};
const requireAdmin = (ctx) => {
  requireAuth(ctx);
  if (!isStaff(ctx.user)) throw new HttpError(403, "Staff access required");
  return ctx.user;
};
const requireArea = (ctx, area) => {
  requireAuth(ctx);
  if (!canAccess(ctx.user, area))
    throw new HttpError(403, `Your role (${ctx.user.role}) has no access to ${area}`);
  return ctx.user;
};
const requireSuper = (ctx) => {
  requireAuth(ctx);
  if (ctx.user.role !== "superadmin") throw new HttpError(403, "Super admin only");
  return ctx.user;
};

/* ================= rate limiting (anti-abuse) ================= */
const RATE_LIMITS = {
  global:     { windowMs: 60_000,      max: 100 }, // everything, per IP
  auth:       { windowMs: 5 * 60_000,  max: 10 },  // login/register brute force
  orders:     { windowMs: 10 * 60_000, max: 10 },  // checkout spam / stock exhaustion
  couponTry:  { windowMs: 5 * 60_000,  max: 20 },  // coupon-code brute forcing
  reviews:    { windowMs: 10 * 60_000, max: 3 },   // review flooding
  returns:    { windowMs: 10 * 60_000, max: 3 },
  tickets:    { windowMs: 10 * 60_000, max: 5 },
  newsletter: { windowMs: 10 * 60_000, max: 3 },
  consent:    { windowMs: 5 * 60_000,  max: 10 },
  analytics:  { windowMs: 60_000,      max: 60 },  // event floods
  cartWrite:  { windowMs: 60_000,      max: 60 },
};
const rateBuckets = new Map(); // "bucket:ip" -> { count, resetAt }

function clientIp(req) {
  // Production (Railway, and Cloudflare in front of it) always sits behind a
  // proxy, so X-Forwarded-For is trusted BY DEFAULT. Set XP_TRUST_PROXY=0 only
  // when exposing the server directly to the internet — otherwise clients
  // could spoof the header to rotate identities past every rate limit.
  if (process.env.XP_TRUST_PROXY !== "0") {
    const xff = req.headers["x-forwarded-for"];
    if (xff) return String(xff).split(",")[0].trim();
  }
  return req.socket.remoteAddress || "unknown";
}

function rateLimit(ctx, bucket) {
  const cfg = RATE_LIMITS[bucket];
  if (!cfg) return;
  const key = bucket + ":" + clientIp(ctx.req);
  const now = Date.now();
  let rec = rateBuckets.get(key);
  if (!rec || now > rec.resetAt) {
    rec = { count: 0, resetAt: now + cfg.windowMs };
    rateBuckets.set(key, rec);
  }
  rec.count += 1;
  if (rec.count > cfg.max) {
    const retryAfter = Math.max(1, Math.ceil((rec.resetAt - now) / 1000));
    const err = new HttpError(429, `Too many requests — please try again in ${retryAfter}s`);
    err.retryAfter = retryAfter;
    throw err;
  }
}

// bound memory: sweep expired buckets every minute
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of rateBuckets) if (now > v.resetAt) rateBuckets.delete(k);
}, 60_000).unref();

/* input sanitizer — clamp string length to stop payload stuffing */
const clamp = (v, n = 200) => String(v ?? "").slice(0, n);

/* numeric coercion for admin input — SQLite's dynamic typing will happily
 * store "abc" in an INTEGER column otherwise, corrupting all downstream math */
const toInt = (v, fallback = 0) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
};
const clampInt = (v, min, max, fallback = min) => Math.min(max, Math.max(min, toInt(v, fallback)));

/* escape LIKE wildcards so user input like "50%" matches literally */
const likeEsc = (v) => String(v).replace(/[\\%_]/g, (m) => "\\" + m);

/* ================= cart helpers ================= */
/* locate the caller's cart WITHOUT creating one: logged-in user's cart
   (adopting/merging any guest cart sent in X-Cart-Id), else the guest cart */
function findCart(ctx) {
  const headerId = ctx.req.headers["x-cart-id"];
  if (ctx.user) {
    let cart = db.prepare("SELECT * FROM carts WHERE userId = ?").get(ctx.user.id);
    if (!cart && headerId) {
      // adopt the guest cart directly if one was sent
      const guest = db.prepare("SELECT * FROM carts WHERE id = ? AND userId IS NULL").get(headerId);
      if (guest) {
        db.prepare("UPDATE carts SET userId = ? WHERE id = ?").run(ctx.user.id, guest.id);
        return { ...guest, userId: ctx.user.id };
      }
    } else if (cart && headerId && headerId !== cart.id) {
      // merge a guest cart into the user's cart, then discard it
      const guest = db.prepare("SELECT * FROM carts WHERE id = ? AND userId IS NULL").get(headerId);
      if (guest) {
        // NB: cart_items is keyed on (cartId, productId, variantId) — merging must carry
        // the variant through, otherwise the upsert has no matching unique index (500).
        db.prepare(
          `INSERT INTO cart_items (cartId, productId, variantId, qty)
           SELECT ?, productId, variantId, qty FROM cart_items WHERE cartId = ?
           ON CONFLICT(cartId, productId, variantId) DO UPDATE SET qty = qty + excluded.qty`
        ).run(cart.id, guest.id);
        db.prepare("DELETE FROM carts WHERE id = ?").run(guest.id);
      }
    }
    return cart ?? null;
  }
  if (headerId) {
    // guests can only access carts that still belong to no one
    const cart = db.prepare("SELECT * FROM carts WHERE id = ? AND userId IS NULL").get(headerId);
    if (cart) return cart;
  }
  return null;
}

function getOrCreateCart(ctx) {
  return findCart(ctx) ?? (() => {
    const id = "cart_" + crypto.randomBytes(8).toString("hex");
    db.prepare("INSERT INTO carts (id, userId) VALUES (?,?)").run(id, ctx.user?.id ?? null);
    return { id, userId: ctx.user?.id ?? null };
  })();
}

function cartPayload(cart) {
  const items = db
    .prepare(
      `SELECT ci.productId, ci.variantId, ci.qty, p.name, p.price AS basePrice, p.image AS baseImage, p.stock AS baseStock,
              v.label AS variantLabel, v.priceDelta, v.stock AS variantStock, v.image AS variantImage
       FROM cart_items ci
       JOIN products p ON p.id = ci.productId
       LEFT JOIN product_variants v ON v.id = ci.variantId AND ci.variantId != 0
       WHERE ci.cartId = ?`
    )
    .all(cart.id)
    .map((r) => ({
      productId: r.productId,
      variantId: r.variantId || 0,
      variantLabel: r.variantLabel ?? null,
      qty: r.qty,
      name: r.name,
      price: r.basePrice + (r.priceDelta ?? 0),
      image: r.variantImage || r.baseImage,
      stock: r.variantId ? r.variantStock : r.baseStock,
    }));
  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
  return { id: cart.id, items, subtotal };
}

/* ================= order placement ================= */
function computeCoupon(code, subtotal) {
  if (!code) return { discount: 0, freeShip: false, coupon: null };
  const c = db.prepare("SELECT * FROM coupons WHERE code = ? COLLATE NOCASE").get(code.trim());
  if (!c || !c.active) throw bad("Invalid or inactive coupon code");
  if (c.expiresAt && new Date(c.expiresAt) < new Date()) throw bad("This coupon has expired");
  if (subtotal < c.minOrder) throw bad(`Coupon requires a minimum order of Rs ${c.minOrder}`);
  if (c.type === "percent") return { discount: Math.round((subtotal * c.value) / 100), freeShip: false, coupon: c };
  if (c.type === "fixed") return { discount: Math.min(c.value, subtotal), freeShip: false, coupon: c };
  return { discount: 0, freeShip: true, coupon: c };
}

const placeOrder = db.transaction((body, user, visitorId) => {
  const rawItems = Array.isArray(body.items) ? body.items : [];
  if (rawItems.length === 0) throw bad("Order must contain at least one item");
  if (rawItems.length > 30) throw bad("Too many distinct items in one order (max 30)");

  // Validate items against catalog; server-side pricing (variant-aware).
  // Duplicate lines of the same product+variant are merged FIRST so their
  // combined quantity is checked against stock once (two lines ×5 with 6
  // in stock must fail, not both pass a per-line check).
  const merged = new Map(); // key -> { product, variant, qty, ... }
  for (const it of rawItems) {
    const p = db.prepare("SELECT * FROM products WHERE id = ? AND active = 1").get(it.id ?? it.productId);
    if (!p) throw bad(`Product ${it.id ?? it.productId} not found`);
    const variant = resolveVariant(p, parseInt(it.variantId, 10) || 0);
    const hasVariants = db.prepare("SELECT 1 FROM product_variants WHERE productId = ? AND active = 1").get(p.id);
    if (hasVariants && !variant) throw bad(`Please choose an option for "${p.name}"`);
    const qty = Math.max(1, Math.min(99, parseInt(it.qty, 10) || 1));
    const key = `${p.id}:${variant?.id ?? 0}`;
    const prev = merged.get(key);
    const combined = (prev?.qty ?? 0) + qty;
    if (combined > 99) throw bad(`Maximum 99 units of "${p.name}" per order`);
    merged.set(key, {
      product: p, variant,
      qty: combined,
      unitPrice: p.price + (variant?.priceDelta ?? 0),
      displayName: variant ? `${p.name} — ${variant.label}` : p.name,
    });
  }
  const items = [...merged.values()];
  for (const it of items) {
    const available = it.variant ? it.variant.stock : it.product.stock;
    if (available < it.qty) throw bad(`Only ${Math.max(0, available)} left in stock for "${it.displayName}"`);
  }

  const subtotal = items.reduce((s, i) => s + i.unitPrice * i.qty, 0);
  const { discount, freeShip, coupon } = computeCoupon(body.coupon, subtotal);

  const threshold = parseInt(getSetting("freeShippingThreshold", "5000"), 10);
  const fee = parseInt(getSetting("shippingFee", "250"), 10);
  const shipping = freeShip || subtotal >= threshold ? 0 : fee;
  const total = subtotal - discount + shipping;

  const method = String(body.payment || "cod");
  // COD / WhatsApp orders start Pending (need confirmation); online payments are Confirmed
  const payLater = method === "cod" || method === "whatsapp";
  const initialStatus = payLater ? "Pending" : "Confirmed";

  let id;
  do {
    // 6 random bytes (≈2.8e14 space) — public order tracking must resist brute force
    id = "XP-" + crypto.randomBytes(6).toString("hex").toUpperCase();
  } while (db.prepare("SELECT 1 FROM orders WHERE id = ?").get(id));
  db.prepare(
    `INSERT INTO orders (id, userId, email, customer, phone, address, city, payment, subtotal, shipping, discount, couponCode, total, status)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).run(
    id, user?.id ?? null,
    clamp(body.email, 120), clamp(body.customer, 80), clamp(body.phone, 30),
    clamp(body.address, 300), clamp(body.city, 60), clamp(method, 20),
    subtotal, shipping, discount, coupon?.code ?? null, total, initialStatus
  );

  // payment record — online methods are captured immediately (demo gateway)
  db.prepare("INSERT INTO payments (orderId, method, status, amount, txnRef) VALUES (?,?,?,?,?)").run(
    id, method, payLater ? "pending" : "paid", total,
    payLater ? null : "TXN-" + crypto.randomBytes(4).toString("hex").toUpperCase()
  );

  const insItem = db.prepare(
    "INSERT INTO order_items (orderId, productId, variantId, variantLabel, sku, name, price, qty) VALUES (?,?,?,?,?,?,?,?)"
  );
  const lowThreshold = parseInt(getSetting("lowStockThreshold", "15"), 10);

  for (const { product, variant, qty, unitPrice, displayName } of items) {
    insItem.run(id, product.id, variant?.id ?? null, variant?.label ?? null, variant?.sku ?? null, displayName, unitPrice, qty);
    moveStock(product.id, -qty, "sale", "order", id, user?.email ?? "guest", "", variant?.id ?? null);
    const left = (variant ? variant.stock : product.stock) - qty;
    if (left <= lowThreshold)
      notify("stock", "Low stock alert", `"${displayName}" is down to ${left} units`);
  }
  if (coupon) db.prepare("UPDATE coupons SET usedCount = usedCount + 1 WHERE code = ?").run(coupon.code);

  // save address book entry for logged-in customers
  if (user && body.address && body.city) {
    const addr = clamp(body.address, 300), city = clamp(body.city, 60);
    const exists = db
      .prepare("SELECT 1 FROM addresses WHERE userId = ? AND address = ? AND city = ?")
      .get(user.id, addr, city);
    if (!exists)
      db.prepare("INSERT INTO addresses (userId, name, phone, address, city) VALUES (?,?,?,?,?)")
        .run(user.id, clamp(body.customer || user.name, 80), clamp(body.phone || "", 30), addr, city);
  }

  // consent-aware purchase analytics
  if (visitorId) {
    const consent = latestConsent(visitorId);
    if (consent?.analytics)
      db.prepare("INSERT INTO analytics_events (visitorId, type, data) VALUES (?,?,?)").run(
        visitorId, "purchase",
        JSON.stringify({ orderId: id, total, items: items.length, method })
      );
  }

  notify("order", "New order placed", `${id} · Rs ${total.toLocaleString()} · ${body.customer || body.email || "guest"} · ${method.toUpperCase()}`);
  if (body.email)
    sendEmail(
      String(body.email),
      `Order ${id} confirmed — XccessoriesPoint`,
      `Salam ${body.customer || ""}!\n\nYour order ${id} (Rs ${total.toLocaleString()}) is ${initialStatus.toLowerCase()}.\n` +
        items.map((i) => `• ${i.displayName} × ${i.qty} — Rs ${(i.unitPrice * i.qty).toLocaleString()}`).join("\n") +
        `\n\nTrack anytime with your order ID at our website.\n— XccessoriesPoint`
    );
  return orderWithItems(db.prepare("SELECT * FROM orders WHERE id = ?").get(id));
});

/* ================= routes ================= */
const routes = [];
const route = (method, pattern, handler) => {
  const keys = [];
  const regex = new RegExp(
    "^" + pattern.replace(/:[^/]+/g, (m) => (keys.push(m.slice(1)), "([^/]+)")) + "$"
  );
  routes.push({ method, regex, keys, handler });
};

/* ---- health ---- */
route("GET", "/health", () => ({ ok: true, engine: "sqlite", time: new Date().toISOString() }));

/* ---- public storefront config (non-sensitive settings only) ---- */
const PUBLIC_SETTINGS = [
  "storeName", "supportEmail", "supportPhone", "currency", "freeShippingThreshold", "shippingFee", "facebookPixelId",
  // merchandising: sale deadline + which products power hero/deal sections
  "saleEndsAt", "heroSlide1", "heroSlide2", "heroSlide3", "dealOfDay1", "dealOfDay2",
  // delivery estimates shown at checkout / thank-you
  "deliveryDaysCity", "deliveryDaysOther",
];
route("GET", "/config", () => {
  const out = {};
  for (const k of PUBLIC_SETTINGS) out[k] = getSetting(k, null);
  return out;
});

/* ---- categories (admin CRUD) ---- */
const slugify = (v) =>
  String(v).toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 30);

route("GET", "/categories", () =>
  db.prepare("SELECT * FROM categories ORDER BY sortOrder, name").all()
);
route("POST", "/categories", (ctx) => {
  const user = requireArea(ctx, "products");
  const name = clamp(ctx.body.name ?? "", 60).trim();
  if (!name) throw bad("name is required");
  const id = slugify(ctx.body.id || name);
  if (!id) throw bad("Could not derive an id from that name — use letters or numbers");
  if (db.prepare("SELECT 1 FROM categories WHERE id = ?").get(id))
    throw bad(`Category "${id}" already exists`);
  const image = clamp(ctx.body.image ?? "", 300).trim();
  if (image && !/^(\/|https?:\/\/)/.test(image)) throw bad("image must be a path (/img/…) or http(s) URL");
  const next = db.prepare("SELECT COALESCE(MAX(sortOrder), 0) + 1 n FROM categories").get().n;
  db.prepare("INSERT INTO categories (id, name, icon, image, description, sortOrder) VALUES (?,?,?,?,?,?)")
    .run(id, name, clamp(ctx.body.icon ?? "", 8), image, clamp(ctx.body.description ?? "", 600), next);
  audit(user, "category.create", "category", id, name);
  return db.prepare("SELECT * FROM categories WHERE id = ?").get(id);
});
route("PUT", "/categories/:id", (ctx) => {
  const user = requireArea(ctx, "products");
  const cat = db.prepare("SELECT * FROM categories WHERE id = ?").get(ctx.params.id);
  if (!cat) throw new HttpError(404, "Category not found");
  const b = { ...cat, ...ctx.body };
  const name = clamp(b.name ?? "", 60).trim();
  if (!name) throw bad("name is required");
  const image = clamp(b.image ?? "", 300).trim();
  if (image && !/^(\/|https?:\/\/)/.test(image)) throw bad("image must be a path (/img/…) or http(s) URL");
  const description = clamp(b.description ?? "", 600);
  // NB: sortOrder 0 is legitimate ("pin to front"), so only fall back when it is absent
  const rawOrder = ctx.body.sortOrder;
  const sortOrder =
    rawOrder === undefined || rawOrder === null || rawOrder === ""
      ? cat.sortOrder
      : parseInt(rawOrder, 10) || 0;
  db.prepare("UPDATE categories SET name = ?, icon = ?, image = ?, description = ?, sortOrder = ? WHERE id = ?")
    .run(name, clamp(b.icon ?? "", 8), image, description, sortOrder, ctx.params.id);
  audit(user, "category.update", "category", ctx.params.id, JSON.stringify(ctx.body).slice(0, 200));
  return db.prepare("SELECT * FROM categories WHERE id = ?").get(ctx.params.id);
});
route("DELETE", "/categories/:id", (ctx) => {
  const user = requireArea(ctx, "products");
  const cat = db.prepare("SELECT * FROM categories WHERE id = ?").get(ctx.params.id);
  if (!cat) throw new HttpError(404, "Category not found");
  // products still reference it → refuse, so nothing is orphaned.
  // (archived products keep the foreign key too, so they block the delete as well)
  const live = db.prepare("SELECT COUNT(*) c FROM products WHERE category = ? AND active = 1").get(ctx.params.id).c;
  const archived = db.prepare("SELECT COUNT(*) c FROM products WHERE category = ? AND active = 0").get(ctx.params.id).c;
  if (live > 0)
    throw bad(`${live} product${live === 1 ? " still uses" : "s still use"} this category — move ${live === 1 ? "it" : "them"} first`);
  if (archived > 0)
    throw bad(`${archived} archived product${archived === 1 ? "" : "s"} still reference this category — move ${archived === 1 ? "it" : "them"} to another category first`);
  db.prepare("DELETE FROM categories WHERE id = ?").run(ctx.params.id);
  audit(user, "category.delete", "category", ctx.params.id, cat.name);
  return { ok: true };
});

/* ---- programmatic SEO band pages (/category/:id/:band) ---- */
const POLICY_PATHS = ["/privacy", "/returns", "/terms"];

/* hub → spoke links: which bands are live for a category */
route("GET", "/categories/:id/bands", (ctx) =>
  siblingBands(ctx.params.id).map((b) => ({ ...b, url: `/category/${b.categoryId}/${b.bandId}` }))
);

/* spoke page data — 404 when the quality gate fails (never publish thin pages) */
route("GET", "/categories/:id/bands/:band", (ctx) => {
  const r = resolveBand(ctx.params.id, ctx.params.band);
  if (!r) throw new HttpError(404, "No curation page for that category/budget yet");
  return {
    categoryId: r.category.id,
    categoryName: r.category.name,
    bandId: r.band.id,
    bandLabel: r.band.label,
    intro: bandIntro(r.category.id, r.band.id, r.category, r.band, r.total),
    total: r.total,
    items: r.items,
    siblings: siblingBands(r.category.id, r.band.id).map((b) => ({ ...b, url: `/category/${b.categoryId}/${b.bandId}` })),
  };
});

/* admin: list live pages + editable intros */
route("GET", "/pseo/pages", (ctx) => {
  requireArea(ctx, "settings");
  return liveBandPages().map((p) => ({
    ...p,
    url: `/category/${p.categoryId}/${p.bandId}`,
    intro: getSetting(`pseo_intro_${p.categoryId}_${p.bandId}`, ""),
    autoIntro: bandIntro(
      p.categoryId, p.bandId,
      db.prepare("SELECT name FROM categories WHERE id = ?").get(p.categoryId),
      PSEO_BANDS.find((b) => b.id === p.bandId), p.productCount
    ),
  }));
});
route("PUT", "/pseo/intro", (ctx) => {
  const user = requireArea(ctx, "settings");
  const { categoryId, band, intro } = ctx.body;
  if (!PSEO_BANDS.some((b) => b.id === band)) throw bad("invalid band");
  if (!db.prepare("SELECT 1 FROM categories WHERE id = ?").get(categoryId)) throw bad("unknown category");
  const key = `pseo_intro_${categoryId}_${band}`;
  db.prepare("INSERT INTO settings (key, value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
    .run(key, clamp(intro ?? "", 600));
  audit(user, "pseo.intro", "category", `${categoryId}/${band}`, String(intro || "").slice(0, 100));
  return { ok: true, key };
});

/* ---- AEO buying guides (public read, admin-editable) ---- */
const GUIDE_SLUG_RE = /^[a-z0-9-]{1,80}$/;
const shapeGuide = (g) => ({ ...g, published: !!g.published, sections: JSON.parse(g.sections || "[]") });

route("GET", "/guides", (ctx) => {
  // staff (settings area) gets full rows incl. drafts; public gets live summaries
  if (canAccess(ctx.user, "settings"))
    return db.prepare("SELECT * FROM guides ORDER BY updatedAt DESC").all().map(shapeGuide);
  return db
    .prepare("SELECT slug, title, tldr, relatedCategory, relatedBand, updatedAt FROM guides WHERE published = 1 ORDER BY updatedAt DESC")
    .all();
});
route("GET", "/guides/:slug", (ctx) => {
  if (!GUIDE_SLUG_RE.test(ctx.params.slug)) throw new HttpError(404, "Unknown guide");
  const g = db.prepare("SELECT * FROM guides WHERE slug = ? AND published = 1").get(ctx.params.slug);
  if (!g) throw new HttpError(404, "Guide not found");
  return shapeGuide(g);
});
route("PUT", "/guides/:slug", (ctx) => {
  const user = requireArea(ctx, "settings");
  if (!GUIDE_SLUG_RE.test(ctx.params.slug)) throw bad("invalid slug");
  const g = db.prepare("SELECT * FROM guides WHERE slug = ?").get(ctx.params.slug);
  if (!g) throw new HttpError(404, "Guide not found");
  const b = { ...shapeGuide(g), ...ctx.body };
  const clean = Array.isArray(b.sections)
    ? b.sections.filter((s) => s && String(s.heading || "").trim()).slice(0, 15)
        .map((s) => ({ heading: clamp(s.heading, 120), body: clamp(s.body, 3000) }))
    : [];
  db.prepare(
    `UPDATE guides SET title=?, tldr=?, sections=?, relatedCategory=?, relatedBand=?, published=?, updatedAt=datetime('now') WHERE slug=?`
  ).run(clamp(b.title, 160), clamp(b.tldr ?? "", 1000), JSON.stringify(clean),
        clamp(b.relatedCategory ?? "", 60), clamp(b.relatedBand ?? "", 40),
        b.published === false ? 0 : 1, ctx.params.slug);
  audit(user, "guide.update", "guide", ctx.params.slug, b.title);
  return shapeGuide(db.prepare("SELECT * FROM guides WHERE slug = ?").get(ctx.params.slug));
});

/* ---- policies (public read, admin-editable without redeploy) ---- */
route("GET", "/policies", (ctx) => {
  requireArea(ctx, "settings");
  return db.prepare("SELECT path, title, updated FROM policies ORDER BY path").all();
});
route("GET", "/policies/:path", (ctx) => {
  const pathName = "/" + String(ctx.params.path || "").replace(/[^a-z]/g, "");
  if (!POLICY_PATHS.includes(pathName)) throw new HttpError(404, "Unknown policy");
  const row = db.prepare("SELECT * FROM policies WHERE path = ?").get(pathName);
  if (!row) throw new HttpError(404, "Policy not found");
  return { ...row, sections: JSON.parse(row.sections || "[]") };
});
route("PUT", "/policies/:path", (ctx) => {
  const user = requireArea(ctx, "settings");
  const pathName = "/" + String(ctx.params.path || "").replace(/[^a-z]/g, "");
  if (!POLICY_PATHS.includes(pathName)) throw bad("unknown policy path");
  const { title, updated, sections } = ctx.body;
  if (!title || !Array.isArray(sections)) throw bad("title and sections are required");
  const clean = sections
    .filter((s) => s && String(s.heading || "").trim())
    .slice(0, 20)
    .map((s) => ({ heading: clamp(s.heading, 120), body: clamp(s.body, 2000) }));
  db.prepare(
    `INSERT INTO policies (path, title, updated, sections) VALUES (?,?,?,?)
     ON CONFLICT(path) DO UPDATE SET title = excluded.title, updated = excluded.updated, sections = excluded.sections`
  ).run(pathName, clamp(title, 120), clamp(updated ?? "", 40), JSON.stringify(clean));
  audit(user, "policy.update", "policy", pathName, title);
  const row = db.prepare("SELECT * FROM policies WHERE path = ?").get(pathName);
  return { ...row, sections: JSON.parse(row.sections || "[]") };
});

/* ---- products (public) ---- */
route("GET", "/products", (ctx) => {
  const { cat, q, sort, includeInactive } = ctx.query;
  let sql = "SELECT * FROM products";
  const where = [], args = [];
  if (!(includeInactive === "1" && ctx.user?.isAdmin)) where.push("active = 1");
  if (cat) { where.push("category = ?"); args.push(cat); }
  if (q) { where.push("(name LIKE ? ESCAPE '\\' OR description LIKE ? ESCAPE '\\')"); args.push(`%${likeEsc(q)}%`, `%${likeEsc(q)}%`); }
  if (where.length) sql += " WHERE " + where.join(" AND ");
  const sorts = {
    "price-asc": " ORDER BY price ASC",
    "price-desc": " ORDER BY price DESC",
    rating: " ORDER BY rating DESC",
    name: " ORDER BY name COLLATE NOCASE ASC",
  };
  sql += sorts[sort] ?? " ORDER BY id ASC";
  const admin = includeInactive === "1" && ctx.user?.isAdmin;
  return db.prepare(sql).all(...args).map((p) => productRow(p, admin));
});
route("GET", "/products/:id", (ctx) => {
  const p = db.prepare("SELECT * FROM products WHERE id = ?").get(ctx.params.id);
  if (!p) throw new HttpError(404, "Product not found");
  return productRow(p);
});
/* real social proof — units sold recently + best-selling variant (from actual orders) */
route("GET", "/products/:id/stats", (ctx) => {
  const row = db.prepare(
    `SELECT COALESCE(SUM(oi.qty), 0) v FROM order_items oi
     JOIN orders o ON o.id = oi.orderId
     WHERE oi.productId = ? AND o.status NOT IN ('Cancelled','Failed')
       AND o.createdAt > datetime('now', '-7 days')`
  ).get(ctx.params.id);
  // 30-day window for variant popularity — weekly is too sparse per-variant
  const topVariant = db.prepare(
    `SELECT oi.variantId, SUM(oi.qty) v FROM order_items oi
     JOIN orders o ON o.id = oi.orderId
     WHERE oi.productId = ? AND oi.variantId IS NOT NULL
       AND o.status NOT IN ('Cancelled','Failed')
       AND o.createdAt > datetime('now', '-30 days')
     GROUP BY oi.variantId ORDER BY v DESC LIMIT 1`
  ).get(ctx.params.id);
  return { soldThisWeek: row.v, topVariantId: topVariant?.variantId ?? null };
});

/* ---- products (admin CRUD) ---- */
route("POST", "/products", (ctx) => {
  const user = requireArea(ctx, "products");
  const b = ctx.body;
  const name = clamp(b.name ?? "", 200).trim();
  const category = clamp(b.category ?? "", 60).trim();
  if (!name || !category || b.price === undefined || b.price === null || b.price === "")
    throw bad("name, category and price are required");
  if (!db.prepare("SELECT 1 FROM categories WHERE id = ?").get(category))
    throw bad(`Category "${category}" does not exist`);
  const image = clamp(b.image ?? "", 300).trim();
  if (image && !/^(\/|https?:\/\/)/.test(image)) throw bad("image must be a path (/img/…) or http(s) URL");
  const info = db.prepare(
    `INSERT INTO products (name, category, price, compareAt, rating, reviews, stock, image, badge, featured, bestSeller, newArrival, dealOfDay, description, updatedAt)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'))`
  ).run(
    name, category,
    clampInt(b.price, 0, 10_000_000),
    b.compareAt == null || b.compareAt === "" ? null : clampInt(b.compareAt, 0, 10_000_000),
    Math.min(5, Math.max(0, Number(b.rating) || 0)),
    clampInt(b.reviews ?? 0, 0, 1_000_000),
    clampInt(b.stock ?? 0, 0, 1_000_000),
    image, clamp(b.badge ?? "", 30).trim() || null,
    b.featured ? 1 : 0, b.bestSeller ? 1 : 0, b.newArrival ? 1 : 0, b.dealOfDay ? 1 : 0,
    clamp(b.description ?? "", 5000)
  );
  audit(user, "product.create", "product", info.lastInsertRowid, b.name);
  return productRow(db.prepare("SELECT * FROM products WHERE id = ?").get(info.lastInsertRowid));
});
route("PUT", "/products/:id", (ctx) => {
  const user = requireArea(ctx, "products");
  const p = db.prepare("SELECT * FROM products WHERE id = ?").get(ctx.params.id);
  if (!p) throw new HttpError(404, "Product not found");
  const b = { ...p, ...ctx.body };
  // validate/coerce — a typo'd price or unknown category must be a clean 400,
  // not text in an INTEGER column or an FK violation
  if (!b.name || !String(b.name).trim()) throw bad("name is required");
  if (!db.prepare("SELECT 1 FROM categories WHERE id = ?").get(b.category)) throw bad(`unknown category: ${b.category}`);
  const image = clamp(b.image ?? "", 300);
  db.prepare(
    `UPDATE products SET name=?, category=?, price=?, compareAt=?, rating=?, reviews=?, stock=?, image=?, badge=?, featured=?, bestSeller=?, newArrival=?, dealOfDay=?, description=?, active=?, updatedAt=datetime('now') WHERE id=?`
  ).run(
    clamp(b.name, 120), b.category,
    clampInt(b.price, 0, 10_000_000),
    b.compareAt == null || b.compareAt === "" ? null : clampInt(b.compareAt, 0, 10_000_000),
    Math.min(5, Math.max(0, Number(b.rating) || 0)),
    clampInt(b.reviews ?? 0, 0, 1_000_000),
    clampInt(b.stock ?? 0, 0, 1_000_000),
    image, clamp(b.badge ?? "", 30).trim() || null,
    b.featured ? 1 : 0, b.bestSeller ? 1 : 0, b.newArrival ? 1 : 0, b.dealOfDay ? 1 : 0,
    clamp(b.description ?? "", 5000), b.active === false ? 0 : 1,
    ctx.params.id
  );
  if ((clampInt(ctx.body.stock ?? 0, 0, 1_000_000)) > (p.stock ?? 0)) checkStockAlerts(parseInt(ctx.params.id, 10));
  audit(user, "product.update", "product", ctx.params.id, JSON.stringify(ctx.body).slice(0, 300));
  return productRow(db.prepare("SELECT * FROM products WHERE id = ?").get(ctx.params.id));
});
route("DELETE", "/products/:id", (ctx) => {
  const user = requireArea(ctx, "products");
  db.prepare("UPDATE products SET active = 0 WHERE id = ?").run(ctx.params.id);
  audit(user, "product.delete", "product", ctx.params.id);
  return { ok: true, softDeleted: true };
});

/* ---- product variants (admin CRUD) ---- */
route("POST", "/products/:id/variants", (ctx) => {
  const user = requireArea(ctx, "products");
  const p = db.prepare("SELECT * FROM products WHERE id = ?").get(ctx.params.id);
  if (!p) throw new HttpError(404, "Product not found");
  const { label, sku = null, priceDelta = 0, stock = 0, swatch = null, image = null } = ctx.body;
  if (!label) throw bad("label is required");
  const info = db.prepare(
    "INSERT INTO product_variants (productId, label, sku, priceDelta, stock, swatch, image) VALUES (?,?,?,?,?,?,?)"
  ).run(ctx.params.id, clamp(label, 60), sku ? clamp(sku, 40) : null, parseInt(priceDelta, 10) || 0, Math.max(0, parseInt(stock, 10) || 0),
        swatch ? clamp(swatch, 30) : null, image ? clamp(image, 300) : null);
  // keep product stock as the aggregate
  db.prepare("UPDATE products SET stock = (SELECT COALESCE(SUM(stock),0) FROM product_variants WHERE productId = ? AND active = 1) WHERE id = ?")
    .run(ctx.params.id, ctx.params.id);
  audit(user, "variant.create", "product", ctx.params.id, label);
  return productRow(db.prepare("SELECT * FROM products WHERE id = ?").get(ctx.params.id), true);
});
route("PUT", "/variants/:id", (ctx) => {
  const user = requireArea(ctx, "products");
  const v = db.prepare("SELECT * FROM product_variants WHERE id = ?").get(ctx.params.id);
  if (!v) throw new HttpError(404, "Variant not found");
  const b = { ...v, ...ctx.body };
  db.prepare("UPDATE product_variants SET label=?, sku=?, priceDelta=?, stock=?, swatch=?, image=?, active=? WHERE id=?")
    .run(clamp(b.label, 60), b.sku ? clamp(b.sku, 40) : null, parseInt(b.priceDelta, 10) || 0,
         Math.max(0, parseInt(b.stock, 10) || 0), b.swatch ? clamp(b.swatch, 30) : null,
         b.image ? clamp(b.image, 300) : null, b.active === false ? 0 : 1, ctx.params.id);
  db.prepare("UPDATE products SET stock = (SELECT COALESCE(SUM(stock),0) FROM product_variants WHERE productId = ? AND active = 1) WHERE id = ?")
    .run(v.productId, v.productId);
  if ((parseInt(b.stock, 10) || 0) > v.stock) checkStockAlerts(v.productId);
  audit(user, "variant.update", "variant", ctx.params.id, JSON.stringify(ctx.body).slice(0, 200));
  return productRow(db.prepare("SELECT * FROM products WHERE id = ?").get(v.productId), true);
});
route("DELETE", "/variants/:id", (ctx) => {
  const user = requireArea(ctx, "products");
  const v = db.prepare("SELECT * FROM product_variants WHERE id = ?").get(ctx.params.id);
  if (!v) throw new HttpError(404, "Variant not found");
  db.prepare("UPDATE product_variants SET active = 0 WHERE id = ?").run(ctx.params.id);
  db.prepare("UPDATE products SET stock = (SELECT COALESCE(SUM(stock),0) FROM product_variants WHERE productId = ? AND active = 1) WHERE id = ?")
    .run(v.productId, v.productId);
  audit(user, "variant.delete", "variant", ctx.params.id, v.label);
  return { ok: true };
});

/* ---- product images (admin CRUD) ---- */
route("POST", "/products/:id/images", (ctx) => {
  const user = requireArea(ctx, "products");
  const p = db.prepare("SELECT * FROM products WHERE id = ?").get(ctx.params.id);
  if (!p) throw new HttpError(404, "Product not found");
  const url = clamp(ctx.body.url, 300).trim();
  if (!url || !/^(\/|https?:\/\/)/.test(url)) throw bad("url must be a path (/img/…) or http(s) URL");
  const max = db.prepare("SELECT COALESCE(MAX(sortOrder), -1) m FROM product_images WHERE productId = ?").get(p.id).m;
  db.prepare("INSERT INTO product_images (productId, url, sortOrder) VALUES (?,?,?)").run(p.id, url, max + 1);
  audit(user, "image.add", "product", p.id, url);
  return productRow(db.prepare("SELECT * FROM products WHERE id = ?").get(p.id), true);
});
route("DELETE", "/images/:id", (ctx) => {
  const user = requireArea(ctx, "products");
  const img = db.prepare("SELECT * FROM product_images WHERE id = ?").get(ctx.params.id);
  if (!img) throw new HttpError(404, "Image not found");
  db.prepare("DELETE FROM product_images WHERE id = ?").run(ctx.params.id);
  audit(user, "image.delete", "product", img.productId, img.url);
  return { ok: true };
});

/* ---- auth ---- */
route("POST", "/auth/register", (ctx) => {
  rateLimit(ctx, "auth");
  const { name, email, password } = ctx.body;
  if (!name || !email || !password) throw bad("All fields are required");
  if (String(password).length < 6) throw bad("Password must be at least 6 characters");
  const norm = String(email).toLowerCase().trim();
  if (db.prepare("SELECT 1 FROM users WHERE email = ?").get(norm))
    throw new HttpError(409, "An account with this email already exists");
  const { salt, hash } = hashPassword(String(password));
  const info = db.prepare("INSERT INTO users (name, email, passHash, passSalt) VALUES (?,?,?,?)")
    .run(String(name).trim(), norm, hash, salt);
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(info.lastInsertRowid);
  notify("user", "New customer registered", `${user.name} <${user.email}>`);
  return { token: createSession(user.id), user: publicUser(user) };
});
route("POST", "/auth/login", (ctx) => {
  rateLimit(ctx, "auth");
  const { email, password } = ctx.body;
  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(String(email || "").toLowerCase().trim());
  if (!user || !verifyPassword(String(password || ""), user.passSalt, user.passHash))
    throw new HttpError(401, "Invalid email or password");
  return { token: createSession(user.id), user: publicUser(user) };
});
route("POST", "/auth/logout", (ctx) => {
  const auth = ctx.req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (token) db.prepare("DELETE FROM sessions WHERE token IN (?, ?)").run(sha256Hex(token), token);
  return { ok: true };
});
route("GET", "/auth/me", (ctx) => publicUser(requireAuth(ctx)));

/* ---- cart ---- */
route("GET", "/cart", (ctx) => {
  // read-only lookup: never INSERT a row. Bots/crawlers hit GET /cart without
  // a cart id — creating a row per hit grows the table without bound.
  // (findCart still performs the login-time guest-cart merge when applicable)
  const cart = findCart(ctx);
  return cart ? cartPayload(cart) : { id: null, items: [], subtotal: 0 };
});
route("POST", "/cart/items", (ctx) => {
  rateLimit(ctx, "cartWrite");
  const cart = getOrCreateCart(ctx);
  const { productId } = ctx.body;
  const qty = parseInt(ctx.body.qty ?? 1, 10);
  if (Number.isNaN(qty)) throw bad("qty must be a number");
  const p = db.prepare("SELECT * FROM products WHERE id = ? AND active = 1").get(productId);
  if (!p) throw bad("Product not found");
  const variant = resolveVariant(p, parseInt(ctx.body.variantId, 10) || 0);
  // products WITH variants require picking one
  const hasVariants = db.prepare("SELECT 1 FROM product_variants WHERE productId = ? AND active = 1").get(p.id);
  if (hasVariants && !variant) throw bad(`Please choose an option for "${p.name}"`);
  const distinct = db.prepare("SELECT COUNT(*) c FROM cart_items WHERE cartId = ?").get(cart.id).c;
  if (distinct >= 50) throw bad("Cart is full (max 50 different products)");
  db.prepare(
    `INSERT INTO cart_items (cartId, productId, variantId, qty) VALUES (?,?,?,?)
     ON CONFLICT(cartId, productId, variantId) DO UPDATE SET qty = MIN(99, qty + excluded.qty)`
  ).run(cart.id, productId, variant?.id ?? 0, Math.min(99, Math.max(1, qty)));
  db.prepare("UPDATE carts SET updatedAt = datetime('now') WHERE id = ?").run(cart.id);
  return cartPayload(cart);
});
route("PUT", "/cart/items/:productId", (ctx) => {
  rateLimit(ctx, "cartWrite");
  const cart = getOrCreateCart(ctx);
  const qty = parseInt(ctx.body.qty, 10);
  const variantId = parseInt(ctx.body.variantId, 10) || 0;
  if (Number.isNaN(qty)) throw bad("qty must be a number");
  if (qty > 99) throw bad("qty cannot exceed 99");
  if (qty <= 0)
    db.prepare("DELETE FROM cart_items WHERE cartId = ? AND productId = ? AND variantId = ?")
      .run(cart.id, ctx.params.productId, variantId);
  else
    db.prepare("UPDATE cart_items SET qty = ? WHERE cartId = ? AND productId = ? AND variantId = ?")
      .run(qty, cart.id, ctx.params.productId, variantId);
  return cartPayload(cart);
});
route("DELETE", "/cart/items/:productId", (ctx) => {
  const cart = getOrCreateCart(ctx);
  const variantId = parseInt(ctx.query.variantId, 10) || 0;
  db.prepare("DELETE FROM cart_items WHERE cartId = ? AND productId = ? AND variantId = ?")
    .run(cart.id, ctx.params.productId, variantId);
  return cartPayload(cart);
});
route("DELETE", "/cart", (ctx) => {
  const cart = getOrCreateCart(ctx);
  db.prepare("DELETE FROM cart_items WHERE cartId = ?").run(cart.id);
  return cartPayload(cart);
});

/* ---- addresses (customer address book) ---- */
route("GET", "/addresses", (ctx) => {
  const user = requireAuth(ctx);
  return db.prepare("SELECT * FROM addresses WHERE userId = ? ORDER BY createdAt DESC").all(user.id);
});
route("DELETE", "/addresses/:id", (ctx) => {
  const user = requireAuth(ctx);
  db.prepare("DELETE FROM addresses WHERE id = ? AND userId = ?").run(ctx.params.id, user.id);
  return { ok: true };
});

/* ---- coupons ---- */
route("POST", "/coupons/validate", (ctx) => {
  rateLimit(ctx, "couponTry");
  const { code, subtotal = 0 } = ctx.body;
  const { discount, freeShip, coupon } = computeCoupon(code, subtotal);
  return { code: coupon.code, type: coupon.type, discount, freeShip };
});
route("GET", "/coupons", (ctx) => {
  requireArea(ctx, "coupons");
  return db.prepare("SELECT * FROM coupons ORDER BY code").all().map((c) => ({ ...c, active: !!c.active }));
});
route("POST", "/coupons", (ctx) => {
  const user = requireArea(ctx, "coupons");
  const { code, type } = ctx.body;
  if (!code || !["percent", "fixed", "freeship"].includes(type)) throw bad("code and valid type required");
  let expiresAt = null;
  if (ctx.body.expiresAt != null && ctx.body.expiresAt !== "") {
    const d = new Date(ctx.body.expiresAt);
    if (Number.isNaN(d.getTime())) throw bad("expiresAt must be a valid date (e.g. 2026-12-31)");
    expiresAt = d.toISOString();
  }
  const value = ctx.body.value ?? 0;
  if (type === "percent" && (!Number.isFinite(Number(value)) || Number(value) < 0 || Number(value) > 100))
    throw bad("percent coupon value must be between 0 and 100");
  const valueInt = clampInt(value, 0, 10_000_000);
  const minOrder = clampInt(ctx.body.minOrder ?? 0, 0, 10_000_000);
  const normCode = String(code).toUpperCase().trim();
  if (db.prepare("SELECT 1 FROM coupons WHERE code = ?").get(normCode))
    throw new HttpError(409, `Coupon ${normCode} already exists`);
  db.prepare("INSERT INTO coupons (code, type, value, minOrder, active, expiresAt) VALUES (?,?,?,?,1,?)")
    .run(normCode, type, valueInt, minOrder, expiresAt);
  audit(user, "coupon.create", "coupon", normCode);
  return db.prepare("SELECT * FROM coupons WHERE code = ?").get(normCode);
});
route("PUT", "/coupons/:code", (ctx) => {
  const user = requireArea(ctx, "coupons");
  const c = db.prepare("SELECT * FROM coupons WHERE code = ?").get(ctx.params.code);
  if (!c) throw new HttpError(404, "Coupon not found");
  const b = { ...c, ...ctx.body };
  // validate — invalid type would trip the CHECK constraint as a raw 500
  if (!["percent", "fixed", "freeship"].includes(b.type)) throw bad("type must be percent, fixed or freeship");
  const value = clampInt(b.value, 0, b.type === "percent" ? 100 : 10_000_000);
  const minOrder = clampInt(b.minOrder ?? 0, 0, 10_000_000);
  db.prepare("UPDATE coupons SET type=?, value=?, minOrder=?, active=?, expiresAt=? WHERE code=?")
    .run(b.type, value, minOrder, b.active ? 1 : 0, b.expiresAt ?? null, ctx.params.code);
  audit(user, "coupon.update", "coupon", ctx.params.code, JSON.stringify(ctx.body));
  return db.prepare("SELECT * FROM coupons WHERE code = ?").get(ctx.params.code);
});
route("DELETE", "/coupons/:code", (ctx) => {
  const user = requireArea(ctx, "coupons");
  db.prepare("DELETE FROM coupons WHERE code = ?").run(ctx.params.code);
  audit(user, "coupon.delete", "coupon", ctx.params.code);
  return { ok: true };
});

/* ---- orders ---- */
/* Meta Conversions API — server-side Purchase event deduplicated against the
 * browser pixel via the shared event_id. Fire-and-forget: never blocks or
 * fails checkout, no-ops unless both pixel ID and CAPI token are configured.
 * (sha256Hex is defined near the top, shared with session hashing) */
function fireMetaCapi(order, eventId, req) {
  try {
    const pixelId = getSetting("facebookPixelId", "");
    const token = getSetting("metaCapiToken", "");
    if (!pixelId || !token || !eventId) return;
    const em = order.email ? sha256Hex(order.email.trim().toLowerCase()) : undefined;
    const ph = order.phone ? sha256Hex(String(order.phone).replace(/\D/g, "")) : undefined;
    const payload = {
      data: [
        {
          event_name: "Purchase",
          event_time: Math.floor(Date.now() / 1000),
          event_id: String(eventId),
          action_source: "website",
          user_data: {
            ...(em ? { em } : {}),
            ...(ph ? { ph } : {}),
            client_ip_address: clientIp(req),
            client_user_agent: req.headers["user-agent"] || "",
          },
          custom_data: {
            currency: "PKR",
            value: order.total,
            num_items: order.items.reduce((s, i) => s + i.qty, 0),
            contents: order.items.map((i) => ({
              id: String(i.productId ?? i.name),
              quantity: i.qty,
              item_price: i.price,
            })),
          },
        },
      ],
    };
    fetch(`https://graph.facebook.com/v19.0/${encodeURIComponent(pixelId)}/events?access_token=${encodeURIComponent(token)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then(async (r) => {
        if (r.ok) console.log(`[capi] Purchase sent for ${order.id}`);
        else console.error(`[capi] failed (${r.status}):`, await r.text());
      })
      .catch((e) => console.error("[capi] error:", e.message));
  } catch (e) {
    console.error("[capi] unexpected:", e.message);
  }
}

route("POST", "/orders", (ctx) => {
  rateLimit(ctx, "orders");
  const order = placeOrder(ctx.body, ctx.user, ctx.req.headers["x-visitor-id"] || null);
  fireMetaCapi(order, ctx.body.eventId, ctx.req);
  return order;
});
route("GET", "/orders", (ctx) => {
  if (canAccess(ctx.user, "orders"))
    return db.prepare("SELECT * FROM orders ORDER BY createdAt DESC").all().map(orderWithItems);
  const user = requireAuth(ctx);
  return db.prepare("SELECT * FROM orders WHERE userId = ? OR email = ? ORDER BY createdAt DESC")
    .all(user.id, user.email).map(orderWithItems);
});
route("GET", "/orders/:id", (ctx) => {
  const o = db.prepare("SELECT * FROM orders WHERE id = ? COLLATE NOCASE").get(ctx.params.id);
  if (!o) throw new HttpError(404, "Order not found");
  const full = orderWithItems(o);
  // public tracking: hide personal details unless admin/owner
  if (canAccess(ctx.user, "orders") || (ctx.user && ctx.user.id === o.userId)) return full;
  const { phone, address, email, userId, customer, city, ...safe } = full;
  // expose only a masked first name publicly
  const first = String(customer || "").trim().split(/\s+/)[0] || null;
  return { ...safe, customer: first };
});
const ORDER_STATUSES = [
  "Pending", "Confirmed", "Processing", "Packed", "Shipped", "Delivered",
  "Cancelled", "Failed", "Returned", "Refunded",
];
route("PUT", "/orders/:id/status", (ctx) => {
  const user = requireArea(ctx, "orders");
  const { status } = ctx.body;
  if (!ORDER_STATUSES.includes(status)) throw bad(`status must be one of: ${ORDER_STATUSES.join(", ")}`);
  const before = db.prepare("SELECT * FROM orders WHERE id = ?").get(ctx.params.id);
  if (!before) throw new HttpError(404, "Order not found");

  db.prepare("UPDATE orders SET status = ? WHERE id = ?").run(status, ctx.params.id);

  // COD is collected on delivery
  if (status === "Delivered" && before.payment === "cod")
    db.prepare("UPDATE payments SET status = 'paid', updatedAt = datetime('now') WHERE orderId = ? AND status = 'pending'")
      .run(ctx.params.id);

  // cancelling / failing an unfulfilled order returns its items to stock.
  // Shipped/Delivered have physically left; Cancelled/Returned/Refunded were
  // already restocked once (by this handler or a refund) — never restock twice.
  const restockStatuses = ["Cancelled", "Failed"];
  const alreadyRestocked = ["Shipped", "Delivered", "Cancelled", "Failed", "Returned", "Refunded"];
  if (restockStatuses.includes(status) && !alreadyRestocked.includes(before.status)) {
    db.transaction(() => {
      const items = db.prepare("SELECT productId, variantId, qty FROM order_items WHERE orderId = ?").all(ctx.params.id);
      for (const it of items)
        if (it.productId) moveStock(it.productId, it.qty, "return-restock", "order", ctx.params.id, user.email, `order ${status.toLowerCase()}`, it.variantId);
    })();
  }

  // payment side effects — only touch money that actually moved:
  // a cancelled COD order was never paid, so nothing gets marked refunded
  if (["Cancelled", "Failed"].includes(status)) {
    if (before.payment === "cod" || before.payment === "whatsapp")
      db.prepare("UPDATE payments SET status = 'cancelled', updatedAt = datetime('now') WHERE orderId = ? AND status = 'pending'")
        .run(ctx.params.id);
    else
      db.prepare("UPDATE payments SET status = 'refunded', updatedAt = datetime('now') WHERE orderId = ? AND status = 'paid'")
        .run(ctx.params.id);
  }

  audit(user, "order.status", "order", ctx.params.id, `${before.status} → ${status}`);
  return orderWithItems(db.prepare("SELECT * FROM orders WHERE id = ?").get(ctx.params.id));
});

/* ---- payments ---- */
route("GET", "/payments", (ctx) => {
  requireArea(ctx, "payments");
  return db.prepare(
    `SELECT p.*, o.customer, o.status AS orderStatus FROM payments p
     JOIN orders o ON o.id = p.orderId ORDER BY p.createdAt DESC LIMIT 200`
  ).all();
});
route("PUT", "/payments/:orderId", (ctx) => {
  const user = requireArea(ctx, "payments");
  const { status } = ctx.body;
  if (!["pending", "paid", "failed", "refunded", "cancelled"].includes(status)) throw bad("invalid payment status");
  const r = db.prepare("UPDATE payments SET status = ?, updatedAt = datetime('now') WHERE orderId = ?")
    .run(status, ctx.params.orderId);
  if (r.changes === 0) throw new HttpError(404, "Payment not found");
  audit(user, "payment.status", "payment", ctx.params.orderId, status);
  return db.prepare("SELECT * FROM payments WHERE orderId = ? ORDER BY id DESC LIMIT 1").get(ctx.params.orderId);
});

/* ---- refunds ---- */
route("GET", "/refunds", (ctx) => {
  requireArea(ctx, "refunds");
  return db.prepare("SELECT * FROM refunds ORDER BY createdAt DESC").all();
});
const issueRefund = db.transaction((order, returnId, amt, reason, restock, actorEmail) => {
  const info = db.prepare("INSERT INTO refunds (orderId, returnId, amount, reason) VALUES (?,?,?,?)")
    .run(order.id, returnId, amt, reason);
  db.prepare("UPDATE orders SET status = 'Refunded' WHERE id = ?").run(order.id);
  db.prepare("UPDATE payments SET status = 'refunded', updatedAt = datetime('now') WHERE orderId = ?").run(order.id);
  if (returnId)
    db.prepare("UPDATE returns SET status = 'Refunded' WHERE id = ?").run(returnId);
  if (restock && !["Cancelled", "Failed"].includes(order.status)) {
    // Cancelled/Failed orders already had their items returned to stock by the
    // status handler — restocking again here would double-count inventory
    const items = db.prepare("SELECT productId, variantId, qty FROM order_items WHERE orderId = ?").all(order.id);
    for (const it of items)
      if (it.productId) moveStock(it.productId, it.qty, "return-restock", "return", returnId ?? order.id, actorEmail, "refund restock", it.variantId);
  }
  return info.lastInsertRowid;
});

route("POST", "/refunds", (ctx) => {
  const user = requireArea(ctx, "refunds");
  const { orderId, returnId = null, amount, reason = "", restock = false } = ctx.body;
  const order = db.prepare("SELECT * FROM orders WHERE id = ? COLLATE NOCASE").get(orderId || "");
  if (!order) throw new HttpError(404, "Order not found");
  if (db.prepare("SELECT 1 FROM refunds WHERE orderId = ?").get(order.id))
    throw new HttpError(409, "A refund has already been issued for this order");
  const amt = Math.min(parseInt(amount, 10) || order.total, order.total);

  const refundId = issueRefund(order, returnId, amt, reason, restock, user.email);
  audit(user, "refund.issue", "order", order.id, `Rs ${amt} — ${reason}`);
  notify("return", "Refund issued", `${order.id} · Rs ${amt.toLocaleString()}`);
  return db.prepare("SELECT * FROM refunds WHERE id = ?").get(refundId);
});

/* ---- back-in-stock alerts ---- */
function checkStockAlerts(productId) {
  const pending = db.prepare(
    `SELECT sa.*, p.name, v.label FROM stock_alerts sa
     JOIN products p ON p.id = sa.productId
     LEFT JOIN product_variants v ON v.id = sa.variantId
     WHERE sa.productId = ? AND sa.notified = 0`
  ).all(productId);
  for (const a of pending) {
    const stock = a.variantId
      ? db.prepare("SELECT stock FROM product_variants WHERE id = ?").get(a.variantId)?.stock ?? 0
      : db.prepare("SELECT stock FROM products WHERE id = ?").get(a.productId)?.stock ?? 0;
    if (stock > 0) {
      db.prepare("UPDATE stock_alerts SET notified = 1 WHERE id = ?").run(a.id);
      const itemName = `${a.name}${a.label ? ` — ${a.label}` : ""}`;
      sendEmail(a.email, `Back in stock: ${itemName}`, `Good news! "${itemName}" is available again at XccessoriesPoint. Grab it before it sells out again.`);
      notify("stock", "Back-in-stock email queued", `${a.email} → "${itemName}"`);
    }
  }
}

route("POST", "/stock-alerts", (ctx) => {
  rateLimit(ctx, "newsletter");
  const email = String(ctx.body.email || "").toLowerCase().trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw bad("Please provide a valid email");
  const p = db.prepare("SELECT id FROM products WHERE id = ?").get(ctx.body.productId);
  if (!p) throw new HttpError(404, "Product not found");
  const variantId = parseInt(ctx.body.variantId, 10) || null;
  const dup = db.prepare(
    "SELECT 1 FROM stock_alerts WHERE productId = ? AND email = ? AND notified = 0 AND COALESCE(variantId,0) = COALESCE(?,0)"
  ).get(p.id, email, variantId);
  if (!dup)
    db.prepare("INSERT INTO stock_alerts (productId, variantId, email) VALUES (?,?,?)").run(p.id, variantId, email);
  return { ok: true };
});
route("GET", "/stock-alerts", (ctx) => {
  requireArea(ctx, "inventory");
  return db.prepare(
    `SELECT sa.*, p.name AS productName, v.label AS variantLabel FROM stock_alerts sa
     JOIN products p ON p.id = sa.productId
     LEFT JOIN product_variants v ON v.id = sa.variantId
     ORDER BY sa.createdAt DESC LIMIT 100`
  ).all();
});

/* ---- inventory ---- */
route("GET", "/inventory/moves", (ctx) => {
  requireArea(ctx, "inventory");
  return db.prepare(
    `SELECT sm.*, p.name AS productName FROM stock_moves sm
     JOIN products p ON p.id = sm.productId ORDER BY sm.createdAt DESC, sm.id DESC LIMIT 200`
  ).all();
});
route("POST", "/inventory/adjust", (ctx) => {
  const user = requireArea(ctx, "inventory");
  const { productId, delta, reason = "manual", note = "" } = ctx.body;
  const p = db.prepare("SELECT * FROM products WHERE id = ?").get(productId);
  if (!p) throw new HttpError(404, "Product not found");
  const d = parseInt(delta, 10);
  if (!d) throw bad("delta must be a non-zero integer");
  if (!["manual", "damaged", "correction", "return-restock"].includes(reason)) throw bad("invalid reason");
  const variantId = parseInt(ctx.body.variantId, 10) || null;
  moveStock(productId, d, reason, "admin", null, user.email, note, variantId);
  if (d > 0) checkStockAlerts(parseInt(productId, 10));
  audit(user, "inventory.adjust", "product", productId, `${d > 0 ? "+" : ""}${d} (${reason}) ${note}`);
  return productRow(db.prepare("SELECT * FROM products WHERE id = ?").get(productId));
});

/* ---- staff & roles (superadmin) ---- */
route("GET", "/staff", (ctx) => {
  requireSuper(ctx);
  return db.prepare("SELECT id, name, email, role, createdAt FROM users ORDER BY createdAt DESC").all();
});
route("PUT", "/staff/:id/role", (ctx) => {
  const user = requireSuper(ctx);
  const { role } = ctx.body;
  if (![...STAFF_ROLES, "customer"].includes(role)) throw bad("invalid role");
  const target = db.prepare("SELECT * FROM users WHERE id = ?").get(ctx.params.id);
  if (!target) throw new HttpError(404, "User not found");
  if (target.id === user.id && role !== "superadmin") throw bad("You cannot demote yourself");
  if (target.role === "superadmin" && role !== "superadmin") {
    const supers = db.prepare("SELECT COUNT(*) c FROM users WHERE role = 'superadmin'").get().c;
    if (supers <= 1) throw bad("Cannot demote the last super admin");
  }
  db.prepare("UPDATE users SET role = ?, isAdmin = ? WHERE id = ?")
    .run(role, STAFF_ROLES.includes(role) ? 1 : 0, ctx.params.id);
  audit(user, "staff.role", "user", ctx.params.id, `${target.role} → ${role}`);
  return db.prepare("SELECT id, name, email, role FROM users WHERE id = ?").get(ctx.params.id);
});

/* ---- audit log (superadmin) ---- */
route("GET", "/audit", (ctx) => {
  requireSuper(ctx);
  return db.prepare("SELECT * FROM audit_logs ORDER BY createdAt DESC, id DESC LIMIT 200").all();
});

/* ---- email outbox (admin) ---- */
route("GET", "/emails", (ctx) => {
  requireAdmin(ctx);
  return db.prepare("SELECT * FROM emails ORDER BY createdAt DESC, id DESC LIMIT 100").all();
});

/* ---- consent (public) ---- */
const CONSENT_VERSION = "1.0";
route("POST", "/consent", (ctx) => {
  rateLimit(ctx, "consent");
  const visitorId = clamp(ctx.body.visitorId || ctx.req.headers["x-visitor-id"] || "", 64).trim();
  if (!visitorId) throw bad("visitorId is required");
  db.prepare("INSERT INTO consents (visitorId, essential, analytics, marketing, version) VALUES (?,?,?,?,?)")
    .run(visitorId, 1, ctx.body.analytics ? 1 : 0, ctx.body.marketing ? 1 : 0, CONSENT_VERSION);
  return latestConsent(visitorId);
});
route("GET", "/consent/:visitorId", (ctx) => {
  return latestConsent(ctx.params.visitorId) ?? { visitorId: ctx.params.visitorId, essential: true, analytics: false, marketing: false, version: null };
});

/* ---- analytics events (consent-gated) ---- */
const EVENT_TYPES = ["page_view", "product_view", "search", "add_to_cart", "checkout_start", "purchase"];
route("POST", "/analytics/events", (ctx) => {
  rateLimit(ctx, "analytics");
  const visitorId = clamp(ctx.req.headers["x-visitor-id"] || ctx.body.visitorId || "", 64).trim();
  if (!visitorId) throw bad("visitor id required");
  const consent = latestConsent(visitorId);
  if (!consent?.analytics) return { stored: false, reason: "no analytics consent" };
  const { type, data = {} } = ctx.body;
  if (!EVENT_TYPES.includes(type)) throw bad("invalid event type");
  // reject oversized payloads rather than truncating — a sliced JSON string is
  // invalid JSON and json_extract() would silently return NULL in dashboards
  const serialized = JSON.stringify(data ?? {});
  if (serialized.length > 2000) return { stored: false, reason: "payload too large" };
  db.prepare("INSERT INTO analytics_events (visitorId, type, data) VALUES (?,?,?)")
    .run(visitorId, type, serialized);
  return { stored: true };
});

/* ---- admin analytics dashboard ---- */
route("GET", "/admin/analytics", (ctx) => {
  requireArea(ctx, "analytics");
  const counts = Object.fromEntries(
    db.prepare("SELECT type, COUNT(*) c FROM analytics_events GROUP BY type").all().map((r) => [r.type, r.c])
  );
  const topSearches = db.prepare(
    `SELECT json_extract(data,'$.q') q, COUNT(*) c FROM analytics_events
     WHERE type='search' AND json_extract(data,'$.q') IS NOT NULL GROUP BY q ORDER BY c DESC LIMIT 8`
  ).all();
  const zeroResultSearches = db.prepare(
    `SELECT json_extract(data,'$.q') q, COUNT(*) c FROM analytics_events
     WHERE type='search' AND json_extract(data,'$.results') = 0 AND json_extract(data,'$.q') IS NOT NULL
     GROUP BY q ORDER BY c DESC LIMIT 8`
  ).all();
  const topCarted = db.prepare(
    `SELECT json_extract(data,'$.name') name, COUNT(*) c FROM analytics_events
     WHERE type='add_to_cart' GROUP BY name ORDER BY c DESC LIMIT 8`
  ).all();
  const funnel = {
    add_to_cart: counts.add_to_cart ?? 0,
    checkout_start: counts.checkout_start ?? 0,
    purchase: counts.purchase ?? 0,
  };
  const visitors = db.prepare("SELECT COUNT(DISTINCT visitorId) v FROM analytics_events").get().v;
  const consentStats = db.prepare(
    `SELECT SUM(analytics) analyticsYes, SUM(marketing) marketingYes, COUNT(*) total FROM (
       SELECT visitorId, analytics, marketing,
              ROW_NUMBER() OVER (PARTITION BY visitorId ORDER BY createdAt DESC, id DESC) rn
       FROM consents
     ) WHERE rn = 1`
  ).get();
  const abandonedCarts = db.prepare(
    `SELECT COUNT(*) v FROM carts c WHERE EXISTS (SELECT 1 FROM cart_items ci WHERE ci.cartId = c.id)
     AND c.updatedAt < datetime('now', '-1 hour')`
  ).get().v;
  const revenueByMethod = db.prepare(
    "SELECT payment AS method, COUNT(*) orders, SUM(total) revenue FROM orders WHERE status != 'Cancelled' GROUP BY payment"
  ).all();
  const revenueByCategory = db.prepare(
    `SELECT p.category, SUM(oi.qty * oi.price) revenue FROM order_items oi
     JOIN products p ON p.id = oi.productId GROUP BY p.category ORDER BY revenue DESC`
  ).all();
  return { counts, topSearches, zeroResultSearches, topCarted, funnel, visitors, consentStats, abandonedCarts, revenueByMethod, revenueByCategory };
});

/* ---- reviews ---- */
route("GET", "/products/:id/reviews", (ctx) =>
  db.prepare("SELECT id, name, rating, text, createdAt FROM reviews WHERE productId = ? AND status = 'approved' ORDER BY createdAt DESC")
    .all(ctx.params.id)
);
route("POST", "/products/:id/reviews", (ctx) => {
  rateLimit(ctx, "reviews");
  const { name, email = "", rating, text = "" } = ctx.body;
  if (!name || !rating) throw bad("name and rating are required");
  const p = db.prepare("SELECT 1 FROM products WHERE id = ?").get(ctx.params.id);
  if (!p) throw new HttpError(404, "Product not found");
  const info = db.prepare("INSERT INTO reviews (productId, name, email, rating, text) VALUES (?,?,?,?,?)")
    .run(ctx.params.id, clamp(name, 60), clamp(email, 120), Math.max(1, Math.min(5, parseInt(rating, 10) || 1)), clamp(text, 1000));
  notify("review", "New review pending approval", `${name} rated product #${ctx.params.id}: ${rating}★`);
  return { id: info.lastInsertRowid, status: "pending" };
});
route("GET", "/reviews", (ctx) => {
  requireArea(ctx, "reviews");
  return db.prepare(
    `SELECT r.*, p.name AS productName FROM reviews r JOIN products p ON p.id = r.productId ORDER BY r.createdAt DESC`
  ).all();
});
route("PUT", "/reviews/:id", (ctx) => {
  const user = requireArea(ctx, "reviews");
  const { status } = ctx.body;
  if (!["approved", "pending", "rejected"].includes(status)) throw bad("invalid status");
  db.prepare("UPDATE reviews SET status = ? WHERE id = ?").run(status, ctx.params.id);
  // keep product aggregate rating in sync with approved reviews
  const rev = db.prepare("SELECT productId FROM reviews WHERE id = ?").get(ctx.params.id);
  if (rev) {
    const agg = db.prepare(
      "SELECT COUNT(*) c, AVG(rating) a FROM reviews WHERE productId = ? AND status = 'approved'"
    ).get(rev.productId);
    if (agg.c > 0)
      db.prepare("UPDATE products SET rating = ROUND(?, 1) WHERE id = ?").run(agg.a, rev.productId);
    else
      db.prepare("UPDATE products SET rating = 0 WHERE id = ?").run(rev.productId); // last review gone
  }
  audit(user, "review.moderate", "review", ctx.params.id, status);
  return db.prepare("SELECT * FROM reviews WHERE id = ?").get(ctx.params.id);
});
route("DELETE", "/reviews/:id", (ctx) => {
  const user = requireArea(ctx, "reviews");
  const rev = db.prepare("SELECT productId FROM reviews WHERE id = ?").get(ctx.params.id);
  db.prepare("DELETE FROM reviews WHERE id = ?").run(ctx.params.id);
  // keep product aggregate rating in sync (same as moderation PUT)
  if (rev) {
    const agg = db.prepare(
      "SELECT COUNT(*) c, AVG(rating) a FROM reviews WHERE productId = ? AND status = 'approved'"
    ).get(rev.productId);
    if (agg.c > 0)
      db.prepare("UPDATE products SET rating = ROUND(?, 1) WHERE id = ?").run(agg.a, rev.productId);
    else
      db.prepare("UPDATE products SET rating = 0 WHERE id = ?").run(rev.productId); // last review gone
  }
  audit(user, "review.delete", "review", ctx.params.id);
  return { ok: true };
});

/* ---- returns ---- */
route("POST", "/returns", (ctx) => {
  rateLimit(ctx, "returns");
  const { orderId, email = "", reason } = ctx.body;
  if (!orderId || !reason) throw bad("orderId and reason are required");
  const o = db.prepare("SELECT 1 FROM orders WHERE id = ? COLLATE NOCASE").get(orderId);
  if (!o) throw new HttpError(404, "Order not found");
  const info = db.prepare("INSERT INTO returns (orderId, email, reason) VALUES (?,?,?)")
    .run(clamp(orderId, 20).toUpperCase(), clamp(email, 120), clamp(reason, 500));
  notify("return", "New return request", `${orderId.toUpperCase()} — ${reason}`);
  return db.prepare("SELECT * FROM returns WHERE id = ?").get(info.lastInsertRowid);
});
route("GET", "/returns", (ctx) => {
  requireArea(ctx, "returns");
  return db.prepare("SELECT * FROM returns ORDER BY createdAt DESC").all()
    .map((r) => ({
      ...r,
      order: orderWithItems(
        db.prepare("SELECT * FROM orders WHERE id = ? COLLATE NOCASE").get(r.orderId)
      ),
    }));
});
route("PUT", "/returns/:id", (ctx) => {
  const user = requireArea(ctx, "returns");
  const { status } = ctx.body;
  if (!["Requested", "Inspecting", "Approved", "Refunded", "Rejected"].includes(status)) throw bad("invalid status");
  db.prepare("UPDATE returns SET status = ? WHERE id = ?").run(status, ctx.params.id);
  audit(user, "return.status", "return", ctx.params.id, status);
  return db.prepare("SELECT * FROM returns WHERE id = ?").get(ctx.params.id);
});

/* ---- tickets ---- */
route("POST", "/tickets", (ctx) => {
  rateLimit(ctx, "tickets");
  const { subject, message = "", email = "" } = ctx.body;
  if (!subject) throw bad("subject is required");
  const info = db.prepare("INSERT INTO tickets (subject, message, email) VALUES (?,?,?)")
    .run(clamp(subject, 150), clamp(message, 2000), clamp(email, 120));
  notify("ticket", "New support ticket", subject);
  return db.prepare("SELECT * FROM tickets WHERE id = ?").get(info.lastInsertRowid);
});
route("GET", "/tickets", (ctx) => {
  requireArea(ctx, "tickets");
  return db.prepare("SELECT * FROM tickets ORDER BY createdAt DESC").all();
});
route("PUT", "/tickets/:id", (ctx) => {
  const user = requireArea(ctx, "tickets");
  const t = db.prepare("SELECT * FROM tickets WHERE id = ?").get(ctx.params.id);
  if (!t) throw new HttpError(404, "Ticket not found");
  const status = ctx.body.status ?? t.status;
  const reply = ctx.body.reply ?? t.reply;
  if (!["Open", "In Progress", "Resolved", "Closed"].includes(status)) throw bad("invalid status");
  db.prepare("UPDATE tickets SET status = ?, reply = ? WHERE id = ?").run(status, reply, ctx.params.id);
  audit(user, "ticket.update", "ticket", ctx.params.id, status);
  return db.prepare("SELECT * FROM tickets WHERE id = ?").get(ctx.params.id);
});

/* ---- notifications ---- */
route("GET", "/notifications", (ctx) => {
  requireArea(ctx, "notifications");
  return db.prepare("SELECT * FROM notifications ORDER BY createdAt DESC LIMIT 100").all()
    .map((n) => ({ ...n, read: !!n.read }));
});
route("PUT", "/notifications/:id/read", (ctx) => {
  requireArea(ctx, "notifications");
  db.prepare("UPDATE notifications SET read = 1 WHERE id = ?").run(ctx.params.id);
  return { ok: true };
});
route("PUT", "/notifications/read-all", (ctx) => {
  requireArea(ctx, "notifications");
  db.prepare("UPDATE notifications SET read = 1").run();
  return { ok: true };
});

/* ---- customers (admin) ---- */
route("GET", "/customers", (ctx) => {
  requireArea(ctx, "customers");
  return db.prepare(
    `SELECT u.id, u.name, u.email, u.isAdmin, u.role, u.createdAt,
            COUNT(o.id) AS orderCount, COALESCE(SUM(o.total), 0) AS totalSpent,
            MAX(o.createdAt) AS lastOrderAt
     FROM users u LEFT JOIN orders o ON o.userId = u.id
     GROUP BY u.id ORDER BY u.createdAt DESC`
  ).all().map((u) => ({ ...u, isAdmin: !!u.isAdmin }));
});
route("GET", "/customers/:id", (ctx) => {
  requireArea(ctx, "customers");
  const u = db.prepare("SELECT id, name, email, role, createdAt FROM users WHERE id = ?").get(ctx.params.id);
  if (!u) throw new HttpError(404, "Customer not found");
  const orders = db.prepare("SELECT * FROM orders WHERE userId = ? ORDER BY createdAt DESC").all(u.id).map(orderWithItems);
  const addresses = db.prepare("SELECT * FROM addresses WHERE userId = ?").all(u.id);
  const tickets = db.prepare("SELECT * FROM tickets WHERE email = ? ORDER BY createdAt DESC").all(u.email);
  const totalSpent = orders.filter((o) => o.status !== "Cancelled").reduce((s, o) => s + o.total, 0);
  const avgOrder = orders.length ? Math.round(totalSpent / orders.length) : 0;
  // simple segmentation
  const segments = [];
  if (orders.length === 0) segments.push("new");
  if (orders.length >= 2) segments.push("repeat");
  if (totalSpent >= 20000) segments.push("high-value");
  if (orders.some((o) => o.payment === "cod")) segments.push("cod");
  const lastOrder = orders[0]?.createdAt;
  if (lastOrder && Date.now() - new Date(lastOrder + "Z").getTime() > 60 * 86400000) segments.push("inactive");
  return { ...u, orders, addresses, tickets, totalSpent, avgOrder, segments };
});

/* ---- settings ---- */
route("GET", "/settings", (ctx) => {
  requireArea(ctx, "settings");
  return Object.fromEntries(db.prepare("SELECT key, value FROM settings").all().map((r) => [r.key, r.value]));
});
route("PUT", "/settings", (ctx) => {
  const user = requireArea(ctx, "settings"); audit(user, "settings.update", "settings", "", JSON.stringify(ctx.body).slice(0,300));
  const up = db.prepare(
    "INSERT INTO settings (key, value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  );
  for (const [k, v] of Object.entries(ctx.body || {})) up.run(k, String(v));
  return Object.fromEntries(db.prepare("SELECT key, value FROM settings").all().map((r) => [r.key, r.value]));
});

/* ---- newsletter ---- */
route("POST", "/newsletter", (ctx) => {
  rateLimit(ctx, "newsletter");
  const email = String(ctx.body.email || "").toLowerCase().trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw bad("Please provide a valid email");
  db.prepare("INSERT INTO newsletter (email) VALUES (?) ON CONFLICT(email) DO NOTHING").run(email);
  return { ok: true };
});

/* ---- admin dashboard metrics ---- */
route("GET", "/admin/metrics", (ctx) => {
  requireAdmin(ctx);
  const revenue = db.prepare("SELECT COALESCE(SUM(total),0) v FROM orders WHERE status != 'Cancelled'").get().v;
  const orderCount = db.prepare("SELECT COUNT(*) v FROM orders").get().v;
  const customerCount = db.prepare("SELECT COUNT(*) v FROM users WHERE isAdmin = 0").get().v;
  const productCount = db.prepare("SELECT COUNT(*) v FROM products WHERE active = 1").get().v;
  const pendingReviews = db.prepare("SELECT COUNT(*) v FROM reviews WHERE status = 'pending'").get().v;
  const openTickets = db.prepare("SELECT COUNT(*) v FROM tickets WHERE status IN ('Open','In Progress')").get().v;
  const unreadNotifs = db.prepare("SELECT COUNT(*) v FROM notifications WHERE read = 0").get().v;
  const lowThreshold = parseInt(getSetting("lowStockThreshold", "15"), 10);
  const lowStock = db.prepare("SELECT id, name, stock FROM products WHERE active = 1 AND stock <= ? ORDER BY stock ASC").all(lowThreshold);
  const topProducts = db.prepare(
    `SELECT oi.name, SUM(oi.qty) sold, SUM(oi.qty * oi.price) revenue
     FROM order_items oi GROUP BY oi.name ORDER BY sold DESC LIMIT 5`
  ).all();
  const recentOrders = db.prepare("SELECT * FROM orders ORDER BY createdAt DESC LIMIT 5").all().map(orderWithItems);
  const statusBreakdown = db.prepare("SELECT status, COUNT(*) c FROM orders GROUP BY status").all();
  const subscribers = db.prepare("SELECT COUNT(*) v FROM newsletter").get().v;
  return {
    revenue, orderCount, customerCount, productCount, pendingReviews,
    openTickets, unreadNotifs, lowStock, topProducts, recentOrders, statusBreakdown, subscribers,
  };
});

/* ================= http server ================= */
// When XP_ALLOWED_ORIGIN is set (comma-separated), only those origins receive
// CORS headers. Unset keeps the permissive default for backwards compatibility.
const ALLOWED_ORIGINS = (process.env.XP_ALLOWED_ORIGIN || "")
  .split(",").map((s) => s.trim()).filter(Boolean);

function corsHeaders(req) {
  const base = {
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Cart-Id, X-Visitor-Id",
  };
  if (!ALLOWED_ORIGINS.length) return { ...base, "Access-Control-Allow-Origin": "*" };
  // allowlist mode: the response varies by Origin even when this particular
  // origin is denied, so no intermediary caches an origin-specific miss
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin))
    return { ...base, Vary: "Origin", "Access-Control-Allow-Origin": origin };
  return { ...base, Vary: "Origin" }; // same-origin or disallowed: no ACAO header
}

function send(req, res, code, body, extra = {}) {
  res.writeHead(code, {
    "Content-Type": "application/json",
    ...corsHeaders(req),
    ...extra,
  });
  res.end(JSON.stringify(body));
}

/* ---------- production static serving (vite build output) ---------- */
const DIST = path.join(__dirname, "..", "dist");
// routes that legitimately render the app shell — everything else is a 404,
// even though we still serve the friendly NotFound UI from the same shell
const SPA_ROUTES = /^\/(?:$|shop|checkout|admin(?:\/.*)?$|privacy|returns|terms|product\/\d+$|category\/[a-z0-9-]+(?:\/[a-z0-9-]+)?$|guides\/[a-z0-9-]+$)/;
const MIME = {
  ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json", ".txt": "text/plain", ".ico": "image/x-icon", ".woff2": "font/woff2",
};
function serveStatic(req, res, urlPath) {
  if (!fs.existsSync(DIST)) return false;
  // the homepage is always served through the shell renderer so relative
  // og:image / JSON-LD URLs get rewritten to absolute — don't short-circuit
  // to the raw index.html below
  if (urlPath === "/") {
    const html = renderHomeShell();
    if (html) {
      res.writeHead(200, { "Content-Type": "text/html", "Cache-Control": "no-cache" });
      res.end(html);
      return true;
    }
  }
  let filePath = path.normalize(path.join(DIST, urlPath === "/" ? "index.html" : urlPath));
  // traversal guard: resolved path must stay inside DIST (relative() beats a
  // prefix check, which would also match a hypothetical sibling "dist-extra")
  const rel = path.relative(DIST, filePath);
  if (rel.startsWith("..") || path.isAbsolute(rel)) return false;
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    // SPA fallback for clean URLs
    if (urlPath.startsWith("/api")) return false;
    const shellPath = path.join(DIST, "index.html");
    if (!fs.existsSync(shellPath)) return false;

    const sendShell = (status, html) => {
      res.writeHead(status, { "Content-Type": "text/html", "Cache-Control": "no-cache" });
      if (html) res.end(html);
      else fs.createReadStream(shellPath).pipe(res);
      return true;
    };

    if (!SPA_ROUTES.test(urlPath)) {
      // unknown URL: real 404 status (same friendly UI) so crawlers don't index soft-404s
      return sendShell(404);
    }

    // product + category URLs get server-injected OG/Twitter meta (WhatsApp/FB crawlers don't run JS)
    if (urlPath === "/") {
      const html = renderHomeShell();
      if (html) return sendShell(200, html);
    }
    const productMatch = urlPath.match(/^\/product\/(\d+)$/);
    if (productMatch) {
      const html = renderProductShell(productMatch[1]);
      if (html !== null) return sendShell(200, html);
    }
    const categoryMatch = urlPath.match(/^\/category\/([a-z0-9-]+)$/);
    if (categoryMatch) {
      const html = renderCategoryShell(categoryMatch[1]);
      if (html !== null) return sendShell(200, html);
    }
    return sendShell(200);
  }
  const ext = path.extname(filePath);
  const stat = fs.statSync(filePath);
  const immutable = urlPath.startsWith("/assets/");
  const isMedia = /\.(png|jpe?g|webp|gif|svg|ico|woff2?)$/i.test(ext);
  // Hashed /assets/* bundles are immutable (cached 1 year). Static media (un-hashed,
  // e.g. /img/hero-1.png) is cached for a day and revalidated via ETag/Last-Modified.
  // HTML stays no-cache so new releases and clean-URL fallbacks are always fresh.
  const cacheControl = immutable
    ? "public, max-age=31536000, immutable"
    : isMedia
    ? "public, max-age=86400"
    : "no-cache";
  const etag = `"${stat.size.toString(16)}-${Math.floor(stat.mtimeMs).toString(16)}"`;
  const lastModified = stat.mtime.toUTCString();
  const notModified =
    req.headers["if-none-match"] === etag ||
    (!immutable && req.headers["if-modified-since"] === lastModified);
  if (notModified) {
    res.writeHead(304, { "Cache-Control": cacheControl, ETag: etag, "Last-Modified": lastModified });
    res.end();
    return true;
  }
  res.writeHead(200, {
    "Content-Type": MIME[ext] || "application/octet-stream",
    "Cache-Control": cacheControl,
    ETag: etag,
    "Last-Modified": lastModified,
  });
  fs.createReadStream(filePath).pipe(res);
  return true;
}

function sitemapXml() {
  const base = process.env.XP_BASE_URL || "https://xccessoriespoint.pk";
  const staticPaths = ["/", "/shop", "/privacy", "/returns", "/terms"];
  const categories = db.prepare("SELECT id FROM categories ORDER BY sortOrder, name").all();
  const products = db.prepare("SELECT id, COALESCE(updatedAt, createdAt) AS updatedAt FROM products WHERE active = 1").all();
  const lastmod = (v) => (v ? `<lastmod>${String(v).replace(" ", "T")}Z</lastmod>` : "");
  const bandPages = liveBandPages();
  const guides = db.prepare("SELECT slug, updatedAt FROM guides WHERE published = 1").all();
  const urls = [
    ...staticPaths.map((p2) => `  <url><loc>${base}${p2}</loc></url>`),
    ...categories.map((c2) => `  <url><loc>${base}/category/${c2.id}</loc></url>`),
    ...bandPages.map((b) => `  <url><loc>${base}/category/${b.categoryId}/${b.bandId}</loc></url>`),
    ...guides.map((g) => `  <url><loc>${base}/guides/${g.slug}</loc></url>${lastmod(g.updatedAt)}`),
    ...products.map((p2) => `  <url><loc>${base}/product/${p2.id}</loc></url>${lastmod(p2.updatedAt)}`),
  ].join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`;
}

/* rendered sitemap cached 10 min — crawler hits stop touching the DB */
let sitemapCache = null;
const SITEMAP_TTL = 600_000;
function sitemapXmlCached() {
  if (!sitemapCache || Date.now() - sitemapCache.at > SITEMAP_TTL)
    sitemapCache = { xml: sitemapXml(), at: Date.now() };
  return sitemapCache.xml;
}

/* ---------- server-side OG/Twitter meta injection for /product/:id ----------
 * WhatsApp/Facebook crawlers don't run JS, so the SPA's client-side setMeta()
 * is invisible to them. For product URLs we inject real tags from the DB into
 * the HTML shell before serving it — this is what makes shared links render
 * rich previews. Cached per product for 60s to keep it cheap.
 */
const esc = (s) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const PRODUCT_META_TTL = 300_000; // 5 min — trims idle CPU; staleness is fine for crawler-facing meta
const productMetaCache = new Map(); // productId -> { html, at }
const categoryMetaCache = new Map(); // categoryId -> { html, at }
let htmlShell = null;

function loadShell() {
  if (htmlShell === null) {
    try {
      htmlShell = fs.readFileSync(path.join(DIST, "index.html"), "utf8");
    } catch {
      return null;
    }
  }
  return htmlShell;
}

/* strip the shell's default title/description/OG/Twitter tags, keep everything else */
function stripDefaultHead(shell) {
  return shell
    .replace(/<title>[\s\S]*?<\/title>/i, "")
    .replace(/<meta\s+(?:name|property)="(?:description|og:[^"]*|twitter:[^"]*)"[^>]*>/gi, "");
}

function injectHead(stripped, tags) {
  return stripped.replace("</head>", `    ${tags.join("\n    ")}\n</head>`);
}

function productHeadTags(p) {
  const base = process.env.XP_BASE_URL || "https://xccessoriespoint.pk";
  const title = `${p.name} — XccessoriesPoint`;
  const desc =
    clamp(p.description, 160) || `Buy ${p.name} at XccessoriesPoint — Rs ${p.price}. COD nationwide, 7-day returns.`;
  const img = /^https?:\/\//i.test(p.image) ? p.image : `${base}${p.image}`;
  const url = `${base}/product/${p.id}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.name,
    ...(p.image ? { image: img } : {}),
    ...(p.description ? { description: clamp(p.description, 5000) } : {}),
    offers: {
      "@type": "Offer",
      priceCurrency: "PKR",
      price: p.price,
      availability: p.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      url,
    },
  };
  return [
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(desc)}" />`,
    `<meta property="og:type" content="product" />`,
    `<meta property="og:title" content="${esc(title)}" />`,
    `<meta property="og:description" content="${esc(desc)}" />`,
    `<meta property="og:image" content="${esc(img)}" />`,
    `<meta property="og:url" content="${esc(url)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${esc(title)}" />`,
    `<meta name="twitter:description" content="${esc(desc)}" />`,
    `<meta name="twitter:image" content="${esc(img)}" />`,
    `<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, "\\u003c")}</script>`,
  ];
}

/* homepage shell: rewrite relative og:image / JSON-LD logo+image paths to
 * absolute URLs — Facebook rejects relative og:image and silently drops previews */
function renderHomeShell() {
  const shell = loadShell();
  if (!shell) return null;
  const base = process.env.XP_BASE_URL || "https://xccessoriespoint.pk";
  return shell
    .replace(/(property="og:image" content=")\/((?:img|icons?)\/[^"]+)"/g, `$1${base}/$2"`)
    .replace(/(name="twitter:image" content=")\/((?:img|icons?)\/[^"]+)"/g, `$1${base}/$2"`)
    .replace(/"(logo|image)": "\/([^"]+)"/g, `"$1": "${base}/$2"`)
    .replace(/"(url|@id)": "https:\/\/xccessoriespoint\.pk/g, `"$1": "${base}`);
}

function renderProductShell(productId) {  const id = parseInt(productId, 10);
  if (!Number.isFinite(id)) return null;
  const cached = productMetaCache.get(id);
  if (cached && Date.now() - cached.at < PRODUCT_META_TTL) return cached.html;
  const p = db
    .prepare("SELECT id, name, price, stock, image, description FROM products WHERE id = ? AND active = 1")
    .get(id);
  if (!p) return null;
  const shell = loadShell();
  if (shell === null) return null;
  const html = injectHead(stripDefaultHead(shell), productHeadTags(p));
  productMetaCache.set(id, { html, at: Date.now() });
  return html;
}

function categoryHeadTags(c) {
  const base = process.env.XP_BASE_URL || "https://xccessoriespoint.pk";
  const title = `${c.name} Online in Pakistan — COD Nationwide | XccessoriesPoint`;
  const desc =
    clamp(c.description, 160) || `Buy ${c.name.toLowerCase()} online in Pakistan with cash on delivery and 7-day returns.`;
  const img = c.image ? (/^https?:\/\//i.test(c.image) ? c.image : `${base}${c.image}`) : `${base}/img/hero-1.png`;
  const url = `${base}/category/${c.id}`;
  return [
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(desc)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:title" content="${esc(title)}" />`,
    `<meta property="og:description" content="${esc(desc)}" />`,
    `<meta property="og:image" content="${esc(img)}" />`,
    `<meta property="og:url" content="${esc(url)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${esc(title)}" />`,
    `<meta name="twitter:description" content="${esc(desc)}" />`,
    `<meta name="twitter:image" content="${esc(img)}" />`,
  ];
}

function renderCategoryShell(categoryId) {
  if (!/^[a-z0-9-]{1,40}$/.test(categoryId)) return null;
  const cached = categoryMetaCache.get(categoryId);
  if (cached && Date.now() - cached.at < PRODUCT_META_TTL) return cached.html;
  const c = db.prepare("SELECT * FROM categories WHERE id = ?").get(categoryId);
  if (!c) return null;
  const shell = loadShell();
  if (shell === null) return null;
  const html = injectHead(stripDefaultHead(shell), categoryHeadTags(c));
  categoryMetaCache.set(categoryId, { html, at: Date.now() });
  return html;
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") return send(req, res, 204, {});
  const url = new URL(req.url, "http://localhost");

  // sitemap + robots.txt (work in both dev-proxy and production modes; honor XP_BASE_URL)
  if (url.pathname === "/sitemap.xml" || url.pathname === "/api/sitemap.xml") {
    res.writeHead(200, { "Content-Type": "application/xml" });
    return res.end(sitemapXmlCached());
  }
  if (url.pathname === "/robots.txt" || url.pathname === "/api/robots.txt") {
    const base = process.env.XP_BASE_URL || "https://xccessoriespoint.pk";
    res.writeHead(200, { "Content-Type": "text/plain" });
    return res.end(
      `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /checkout\nSitemap: ${base}/sitemap.xml\n`
    );
  }
  // health probe — handled before static serving so bare /health works in
  // production too (dist/ present would otherwise shadow the API route)
  if (url.pathname === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ ok: true, engine: "sqlite", time: new Date().toISOString() }));
  }
  // static site in production (dist/ present)
  if (req.method === "GET" && !url.pathname.startsWith("/api")) {
    if (serveStatic(req, res, url.pathname)) return;
  }

  const pathName = url.pathname.replace(/^\/api/, "") || "/";

  let body = {};
  let malformedBody = false;
  let oversizedBody = false;
  if (["POST", "PUT", "PATCH"].includes(req.method)) {
    body = await new Promise((resolve) => {
      let raw = "";
      req.on("data", (c) => {
        // stop buffering but keep draining so we can answer with a clean 413
        if (raw.length > 1e6) { oversizedBody = true; raw = ""; return; }
        raw += c;
      });
      req.on("end", () => {
        if (oversizedBody) return resolve({});
        if (!raw) return resolve({});
        try { resolve(JSON.parse(raw)); }
        catch { malformedBody = true; resolve({}); }
      });
      req.on("error", () => resolve({}));
      req.on("close", () => resolve({}));
    });
  }

  const ctx = {
    req, body,
    query: Object.fromEntries(url.searchParams),
    params: {},
    user: sessionUser(req),
  };

  try {
    if (oversizedBody) throw new HttpError(413, "Request body too large (limit 1 MB)");
    if (malformedBody) throw bad("Request body is not valid JSON");
    rateLimit(ctx, "global");
    for (const r of routes) {
      if (r.method !== req.method) continue;
      const m = pathName.match(r.regex);
      if (!m) continue;
      r.keys.forEach((k, i) => {
        try { ctx.params[k] = decodeURIComponent(m[i + 1]); }
        catch { throw bad(`Malformed URL encoding in /${k}`); }
      });
      const result = r.handler(ctx);
      const cartId = pathName.startsWith("/cart") && result?.id ? { "X-Cart-Id": result.id } : {};
      return send(req, res, req.method === "POST" ? 201 : 200, result, cartId);
    }
    return send(req, res, 404, { error: `No route: ${req.method} ${pathName}` });
  } catch (e) {
    const code = e instanceof HttpError ? e.code : 500;
    if (code === 500) console.error(e);
    const extra = e.retryAfter ? { "Retry-After": String(e.retryAfter) } : {};
    return send(req, res, code, { error: e.message || "Internal server error" }, extra);
  }
});

server.listen(PORT, "0.0.0.0", () =>
  console.log(`[api] XccessoriesPoint backend (SQLite) listening on :${PORT}`)
);
