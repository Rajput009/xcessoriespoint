/* XccessoriesPoint — database layer (better-sqlite3) */
import Database from "better-sqlite3";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DB_PATH = process.env.XP_DB_PATH || path.join(__dirname, "store.db");
// Ensure the parent directory exists (DB lives on the mounted Railway volume at /data).
// Prevents "Cannot open database because the directory does not exist" if the mount is missing/slow.
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
export const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

/* ---------- password hashing (scrypt + salt) ---------- */
export function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return { salt, hash };
}
export function verifyPassword(password, salt, hash) {
  const candidate = crypto.scryptSync(password, salt, 64).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(candidate, "hex"), Buffer.from(hash, "hex"));
}

/* ---------- schema ---------- */
db.exec(`
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  category TEXT NOT NULL REFERENCES categories(id),
  price INTEGER NOT NULL,
  compareAt INTEGER,
  rating REAL DEFAULT 0,
  reviews INTEGER DEFAULT 0,
  stock INTEGER DEFAULT 0,
  image TEXT DEFAULT '',
  badge TEXT,
  featured INTEGER DEFAULT 0,
  bestSeller INTEGER DEFAULT 0,
  newArrival INTEGER DEFAULT 0,
  dealOfDay INTEGER DEFAULT 0,
  description TEXT DEFAULT '',
  active INTEGER DEFAULT 1,
  createdAt TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  passHash TEXT NOT NULL,
  passSalt TEXT NOT NULL,
  isAdmin INTEGER DEFAULT 0,
  createdAt TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  userId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  createdAt TEXT DEFAULT (datetime('now')),
  expiresAt TEXT
);

CREATE TABLE IF NOT EXISTS carts (
  id TEXT PRIMARY KEY,
  userId INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updatedAt TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS cart_items (
  cartId TEXT NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  productId INTEGER NOT NULL REFERENCES products(id),
  qty INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (cartId, productId)
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  userId INTEGER REFERENCES users(id) ON DELETE SET NULL,
  email TEXT DEFAULT '',
  customer TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  address TEXT DEFAULT '',
  city TEXT DEFAULT '',
  payment TEXT DEFAULT 'cod',
  subtotal INTEGER NOT NULL,
  shipping INTEGER NOT NULL DEFAULT 0,
  discount INTEGER NOT NULL DEFAULT 0,
  couponCode TEXT,
  total INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'Processing',
  createdAt TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  orderId TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  productId INTEGER,
  name TEXT NOT NULL,
  price INTEGER NOT NULL,
  qty INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS coupons (
  code TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('percent','fixed','freeship')),
  value INTEGER NOT NULL DEFAULT 0,
  minOrder INTEGER NOT NULL DEFAULT 0,
  active INTEGER DEFAULT 1,
  expiresAt TEXT,
  usedCount INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  productId INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT DEFAULT '',
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  text TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  createdAt TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS returns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  orderId TEXT NOT NULL,
  email TEXT DEFAULT '',
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Requested',
  createdAt TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tickets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subject TEXT NOT NULL,
  message TEXT DEFAULT '',
  email TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Open',
  reply TEXT,
  createdAt TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT DEFAULT '',
  read INTEGER DEFAULT 0,
  createdAt TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS newsletter (
  email TEXT PRIMARY KEY,
  createdAt TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS addresses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label TEXT DEFAULT 'Home',
  name TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  isDefault INTEGER DEFAULT 0,
  createdAt TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  orderId TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  method TEXT NOT NULL DEFAULT 'cod',
  status TEXT NOT NULL DEFAULT 'pending',   -- pending | paid | failed | refunded
  amount INTEGER NOT NULL,
  txnRef TEXT,
  createdAt TEXT DEFAULT (datetime('now')),
  updatedAt TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS refunds (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  orderId TEXT NOT NULL,
  returnId INTEGER,
  amount INTEGER NOT NULL,
  method TEXT DEFAULT 'original',
  status TEXT NOT NULL DEFAULT 'issued',
  reason TEXT DEFAULT '',
  createdAt TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS stock_moves (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  productId INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  delta INTEGER NOT NULL,
  reason TEXT NOT NULL,                      -- sale | return-restock | manual | damaged | correction
  refType TEXT,                              -- order | return | admin
  refId TEXT,
  actor TEXT DEFAULT 'system',
  note TEXT DEFAULT '',
  createdAt TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER,
  userEmail TEXT DEFAULT '',
  action TEXT NOT NULL,
  entity TEXT DEFAULT '',
  entityId TEXT DEFAULT '',
  details TEXT DEFAULT '',
  createdAt TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS consents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  visitorId TEXT NOT NULL,
  essential INTEGER DEFAULT 1,
  analytics INTEGER DEFAULT 0,
  marketing INTEGER DEFAULT 0,
  version TEXT DEFAULT '1.0',
  createdAt TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_consents_visitor ON consents(visitorId, createdAt DESC);

CREATE TABLE IF NOT EXISTS analytics_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  visitorId TEXT NOT NULL,
  type TEXT NOT NULL,                        -- page_view | product_view | search | add_to_cart | checkout_start | purchase
  data TEXT DEFAULT '{}',
  createdAt TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_events_type ON analytics_events(type, createdAt DESC);
`);

/* ---------- migrations for existing databases ---------- */
try { db.exec("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'customer'"); } catch { /* exists */ }
try {
  db.prepare("UPDATE users SET role = 'superadmin' WHERE isAdmin = 1 AND (role IS NULL OR role = 'customer')").run();
} catch { /* ignore */ }

db.exec(`
CREATE TABLE IF NOT EXISTS emails (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  toEmail TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'queued',
  createdAt TEXT DEFAULT (datetime('now'))
);
`);

db.exec(`
CREATE TABLE IF NOT EXISTS product_images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  productId INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  sortOrder INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_pimages_product ON product_images(productId);
`);

db.exec(`
CREATE TABLE IF NOT EXISTS stock_alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  productId INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variantId INTEGER,
  email TEXT NOT NULL,
  notified INTEGER DEFAULT 0,
  createdAt TEXT DEFAULT (datetime('now'))
);
`);

/* ---- product variants ---- */
db.exec(`
CREATE TABLE IF NOT EXISTS product_variants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  productId INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  sku TEXT,
  priceDelta INTEGER NOT NULL DEFAULT 0,
  stock INTEGER NOT NULL DEFAULT 0,
  image TEXT,
  active INTEGER DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_variants_product ON product_variants(productId);
`);

/* cart_items: add variantId to the primary key (0 = no variant) */
const cartCols = db.prepare("PRAGMA table_info(cart_items)").all().map((c) => c.name);
if (!cartCols.includes("variantId")) {
  db.exec(`
    ALTER TABLE cart_items RENAME TO cart_items_old;
    CREATE TABLE cart_items (
      cartId TEXT NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
      productId INTEGER NOT NULL REFERENCES products(id),
      variantId INTEGER NOT NULL DEFAULT 0,
      qty INTEGER NOT NULL DEFAULT 1,
      PRIMARY KEY (cartId, productId, variantId)
    );
    INSERT INTO cart_items (cartId, productId, variantId, qty)
      SELECT cartId, productId, 0, qty FROM cart_items_old;
    DROP TABLE cart_items_old;
  `);
}

try { db.exec("ALTER TABLE product_variants ADD COLUMN swatch TEXT"); } catch { /* exists */ }

/* categories: tile image + manual ordering (admin-managed categories) */
try { db.exec("ALTER TABLE categories ADD COLUMN image TEXT DEFAULT ''"); } catch { /* exists */ }
const catCols = db.prepare("PRAGMA table_info(categories)").all().map((c) => c.name);
if (!catCols.includes("sortOrder")) {
  db.exec("ALTER TABLE categories ADD COLUMN sortOrder INTEGER NOT NULL DEFAULT 0");
  // one-time backfill only: re-running this on every boot would undo any manual
  // ordering an admin set (0 is a legitimate "pin to front" value)
  db.exec("UPDATE categories SET sortOrder = rowid");
}
// idempotent backfill: color swatches + per-color photos for seeded variants
const swatchFill = db.prepare("UPDATE product_variants SET swatch = ? WHERE label = ? AND swatch IS NULL");
for (const [label, hex] of [
  ["White", "#f8fafc"], ["Midnight Black", "#0f172a"], ["Black", "#1e293b"],
  ["Forest Green", "#166534"], ["Rose Pink", "#f472b6"], ["Dark Green", "#14532d"],
  ["Clear", "transparent"], ["Silver", "#cbd5e1"],
]) swatchFill.run(hex, label);
db.prepare("UPDATE product_variants SET image = '/img/earbuds-black.jpg' WHERE productId = 1 AND label = 'Midnight Black' AND image IS NULL").run();
db.prepare("UPDATE product_variants SET image = '/img/smartwatch-pink.jpg' WHERE productId = 3 AND label = 'Rose Pink' AND image IS NULL").run();

/* order_items + stock_moves: variant columns */
try { db.exec("ALTER TABLE order_items ADD COLUMN variantId INTEGER"); } catch { /* exists */ }
try { db.exec("ALTER TABLE order_items ADD COLUMN variantLabel TEXT"); } catch { /* exists */ }
try { db.exec("ALTER TABLE order_items ADD COLUMN sku TEXT"); } catch { /* exists */ }
try { db.exec("ALTER TABLE stock_moves ADD COLUMN variantId INTEGER"); } catch { /* exists */ }

/* ---------- seed ---------- */
export function seed() {
  const catCount = db.prepare("SELECT COUNT(*) c FROM categories").get().c;
  if (catCount === 0) {
    const cats = [
      ["audio", "Audio", "🎧"],
      ["wearables", "Wearables", "⌚"],
      ["power", "Power & Charging", "🔋"],
      ["cases", "Cases & Protection", "📱"],
      ["cables", "Cables & Hubs", "🔌"],
    ];
    const ins = db.prepare("INSERT INTO categories (id, name, icon, sortOrder) VALUES (?,?,?,?)");
    cats.forEach((c, i) => ins.run(...c, i + 1));
  }

  const prodCount = db.prepare("SELECT COUNT(*) c FROM products").get().c;
  if (prodCount === 0) {
    const seedFile = path.join(__dirname, "seed-products.json");
    const products = JSON.parse(fs.readFileSync(seedFile, "utf8"));
    const ins = db.prepare(`INSERT INTO products
      (id, name, category, price, compareAt, rating, reviews, stock, image, badge, featured, bestSeller, newArrival, dealOfDay, description)
      VALUES (@id,@name,@category,@price,@compareAt,@rating,@reviews,@stock,@image,@badge,@featured,@bestSeller,@newArrival,@dealOfDay,@description)`);
    const tx = db.transaction((rows) => {
      for (const p of rows)
        ins.run({
          ...p,
          compareAt: p.compareAt ?? null,
          badge: p.badge ?? null,
          featured: p.featured ? 1 : 0,
          bestSeller: p.bestSeller ? 1 : 0,
          newArrival: p.newArrival ? 1 : 0,
          dealOfDay: p.dealOfDay ? 1 : 0,
          description: p.description ?? "",
        });
    });
    tx(products);
  }

  const adminExists = db
    .prepare("SELECT 1 FROM users WHERE email = ?")
    .get("admin@xccessoriespoint.com");
  if (!adminExists) {
    const { salt, hash } = hashPassword("admin123");
    db.prepare("INSERT INTO users (name, email, passHash, passSalt, isAdmin, role) VALUES (?,?,?,?,1,'superadmin')")
      .run("Admin", "admin@xccessoriespoint.com", hash, salt);
  }

  const couponCount = db.prepare("SELECT COUNT(*) c FROM coupons").get().c;
  if (couponCount === 0) {
    const ins = db.prepare(
      "INSERT INTO coupons (code, type, value, minOrder, active, expiresAt) VALUES (?,?,?,?,?,?)"
    );
    ins.run("WELCOME10", "percent", 10, 0, 1, null);
    ins.run("XP500", "fixed", 500, 3000, 1, null);
    ins.run("FREESHIP", "freeship", 0, 2000, 1, null);
    ins.run("EID25", "percent", 25, 0, 0, "2026-06-15");
  }

  const reviewCount = db.prepare("SELECT COUNT(*) c FROM reviews").get().c;
  if (reviewCount === 0) {
    const ins = db.prepare(
      "INSERT INTO reviews (productId, name, email, rating, text, status) VALUES (?,?,?,?,?,?)"
    );
    ins.run(1, "Ayesha K.", "ayesha@example.com", 5, "Ordered Monday, delivered to Lahore by Wednesday. Noise cancellation is unreal for this price.", "approved");
    ins.run(3, "Hamza R.", "hamza@example.com", 5, "Battery genuinely lasts 9-10 days. Support replied within an hour.", "approved");
    ins.run(6, "Fatima S.", "fatima@example.com", 4, "GaN charger is tiny and fast. Neat packaging with warranty card.", "approved");
    ins.run(12, "Anonymous", "", 2, "HDMI output flickers on my monitor at 4K.", "pending");
  }

  const settingCount = db.prepare("SELECT COUNT(*) c FROM settings").get().c;
  if (settingCount === 0) {
    const ins = db.prepare("INSERT INTO settings (key, value) VALUES (?,?)");
    ins.run("storeName", "XccessoriesPoint");
    ins.run("supportEmail", "support@xccessoriespoint.pk");
    ins.run("currency", "PKR");
    ins.run("freeShippingThreshold", "5000");
    ins.run("shippingFee", "250");
    ins.run("lowStockThreshold", "15");
    ins.run("facebookPixelId", "");
  }

  const notifCount = db.prepare("SELECT COUNT(*) c FROM notifications").get().c;
  if (notifCount === 0) {
    notify("system", "Welcome to your store", "Backend initialized with SQLite. All systems go.");
  }

  // seed gallery images (idempotent)
  const imgCount = db.prepare("SELECT COUNT(*) c FROM product_images").get().c;
  if (imgCount === 0) {
    const ins = db.prepare("INSERT INTO product_images (productId, url, sortOrder) VALUES (?,?,?)");
    const galleries = {
      1: ["/img/earbuds-2.jpg", "/img/earbuds-3.jpg", "/img/lifestyle.jpg"],
      7: ["/img/earbuds-2.jpg", "/img/earbuds-3.jpg"],
      3: ["/img/smartwatch-2.jpg", "/img/smartwatch-3.jpg"],
      8: ["/img/smartwatch-2.jpg"],
      14: ["/img/smartwatch-3.jpg"],
      4: ["/img/powerbank-2.jpg", "/img/lifestyle.jpg"],
      9: ["/img/powerbank-2.jpg"],
      6: ["/img/charger-2.jpg", "/img/lifestyle.jpg"],
      15: ["/img/charger-2.jpg"],
      2: ["/img/lifestyle.jpg"],
    };
    for (const [pid, urls] of Object.entries(galleries))
      urls.forEach((u, i) => ins.run(pid, u, i));
  }

  // seed variants (idempotent) — variant stocks sum to the product's stock
  const variantCount = db.prepare("SELECT COUNT(*) c FROM product_variants").get().c;
  if (variantCount === 0) {
    const ins = db.prepare(
      "INSERT INTO product_variants (productId, label, sku, priceDelta, stock) VALUES (?,?,?,?,?)"
    );
    const setStock = db.prepare("UPDATE products SET stock = ? WHERE id = ?");
    const seedVariants = [
      // AeroBuds Pro — colors
      [1, [["White", "AB-PRO-WHT", 0, 24], ["Midnight Black", "AB-PRO-BLK", 0, 18]]],
      // VitaFit S2 — band colors
      [3, [["Forest Green", "VF-S2-GRN", 0, 15], ["Black", "VF-S2-BLK", 0, 9], ["Rose Pink", "VF-S2-PNK", 200, 6]]],
      // ArmorFlex Slim Case — colors
      [5, [["Dark Green", "AF-SLM-GRN", 0, 60], ["Clear", "AF-SLM-CLR", -100, 40], ["Black", "AF-SLM-BLK", 0, 20]]],
      // FlexLine cable — lengths
      [11, [["1 m", "FL-100W-1M", -200, 120], ["2 m", "FL-100W-2M", 0, 60], ["3 m", "FL-100W-3M", 300, 20]]],
    ];
    for (const [pid, variants] of seedVariants) {
      let total = 0;
      for (const [label, sku, delta, stock] of variants) {
        ins.run(pid, label, sku, delta, stock);
        total += stock;
      }
      setStock.run(total, pid);
    }
  }
}

/** Email abstraction — queues into the outbox table. Point this at a real
 *  provider (Resend/SMTP) in production by replacing the body of deliver(). */
export function sendEmail(to, subject, body = "") {
  if (!to || !/@/.test(to)) return;
  db.prepare("INSERT INTO emails (toEmail, subject, body) VALUES (?,?,?)").run(to, subject, body);
  console.log(`[email queued] to=${to} subject="${subject}"`);
}

export function notify(type, title, body = "") {
  db.prepare("INSERT INTO notifications (type, title, body) VALUES (?,?,?)").run(type, title, body);
}

export function audit(user, action, entity = "", entityId = "", details = "") {
  db.prepare(
    "INSERT INTO audit_logs (userId, userEmail, action, entity, entityId, details) VALUES (?,?,?,?,?,?)"
  ).run(user?.id ?? null, user?.email ?? "system", action, entity, String(entityId), details);
}

export function moveStock(productId, delta, reason, refType = null, refId = null, actor = "system", note = "", variantId = null) {
  if (variantId)
    db.prepare("UPDATE product_variants SET stock = MAX(0, stock + ?) WHERE id = ?").run(delta, variantId);
  // product.stock stays the aggregate across variants (or the sole counter for simple products)
  db.prepare("UPDATE products SET stock = MAX(0, stock + ?) WHERE id = ?").run(delta, productId);
  db.prepare(
    "INSERT INTO stock_moves (productId, variantId, delta, reason, refType, refId, actor, note) VALUES (?,?,?,?,?,?,?,?)"
  ).run(productId, variantId, delta, reason, refType, refId ? String(refId) : null, actor, note);
}

export function latestConsent(visitorId) {
  const row = db
    .prepare("SELECT * FROM consents WHERE visitorId = ? ORDER BY createdAt DESC, id DESC LIMIT 1")
    .get(visitorId);
  return row
    ? { ...row, essential: !!row.essential, analytics: !!row.analytics, marketing: !!row.marketing }
    : null;
}

export function getSetting(key, fallback = null) {
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key);
  return row ? row.value : fallback;
}
