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
  const a = Buffer.from(candidate, "hex");
  const b = Buffer.from(hash ?? "", "hex");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
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
  status TEXT NOT NULL DEFAULT 'pending',   -- pending | paid | failed | refunded | cancelled
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

CREATE TABLE IF NOT EXISTS policies (
  path TEXT PRIMARY KEY,                     -- /privacy | /returns | /terms
  title TEXT NOT NULL,
  updated TEXT DEFAULT '',
  sections TEXT NOT NULL DEFAULT '[]'        -- JSON: [{heading, body}]
);

CREATE TABLE IF NOT EXISTS guides (
  slug TEXT PRIMARY KEY,                     -- e.g. what-is-anc-noise-cancellation
  title TEXT NOT NULL,
  tldr TEXT NOT NULL DEFAULT '',             -- 40-60 word direct answer (snippet/AEO target)
  sections TEXT NOT NULL DEFAULT '[]',       -- JSON: [{heading, body}]
  relatedCategory TEXT DEFAULT '',
  relatedBand TEXT DEFAULT '',
  published INTEGER DEFAULT 1,
  updatedAt TEXT DEFAULT (datetime('now'))
);
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
try { db.exec("ALTER TABLE categories ADD COLUMN description TEXT DEFAULT ''"); } catch { /* exists */ }
const catCols = db.prepare("PRAGMA table_info(categories)").all().map((c) => c.name);
if (!catCols.includes("sortOrder")) {
  db.exec("ALTER TABLE categories ADD COLUMN sortOrder INTEGER NOT NULL DEFAULT 0");
  // one-time backfill only: re-running this on every boot would undo any manual
  // ordering an admin set (0 is a legitimate "pin to front" value)
  db.exec("UPDATE categories SET sortOrder = rowid");
}

/* products.updatedAt drives sitemap <lastmod> */
try { db.exec("ALTER TABLE products ADD COLUMN updatedAt TEXT"); } catch { /* exists */ }
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
  // backfills that must run AFTER rows exist (fresh DBs get them via seed below)
  db.exec("UPDATE products SET updatedAt = createdAt WHERE updatedAt IS NULL");

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
    // a missing/corrupt seed file must not crashloop the container — boot with
    // an empty catalog and let the admin add products instead
    const seedFile = path.join(__dirname, "seed-products.json");
    let products = [];
    try {
      products = JSON.parse(fs.readFileSync(seedFile, "utf8"));
      if (!Array.isArray(products)) throw new Error("seed root is not an array");
    } catch (e) {
      console.error(`[db] seed-products.json unavailable (${e.message}) — starting with empty catalog`);
    }
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

  const adminEmail = (process.env.XP_ADMIN_EMAIL || "").toLowerCase().trim();
  const adminExists = db
    .prepare("SELECT 1 FROM users WHERE email = ?")
    .get(adminEmail || "admin@xccessoriespoint.com");
  if (!adminExists) {
    if (!adminEmail) {
      // No admin configured and none exists: generate a one-time password and
      // print it. Never ship a known default credential.
      const generated = crypto.randomBytes(12).toString("base64url");
      const { salt, hash } = hashPassword(generated);
      db.prepare("INSERT INTO users (name, email, passHash, passSalt, isAdmin, role) VALUES (?,?,?,?,1,'superadmin')")
        .run("Admin", "admin@xccessoriespoint.com", hash, salt);
      console.log("\n[seed] No XP_ADMIN_EMAIL/XP_ADMIN_PASSWORD set.");
      console.log("[seed] Created superadmin admin@xccessoriespoint.com with ONE-TIME password:");
      console.log(`[seed]   ${generated}`);
      console.log("[seed] Store it now — it will not be shown again.\n");
    } else {
      const password = process.env.XP_ADMIN_PASSWORD;
      if (!password) throw new Error("XP_ADMIN_EMAIL is set but XP_ADMIN_PASSWORD is missing");
      const { salt, hash } = hashPassword(password);
      db.prepare("INSERT INTO users (name, email, passHash, passSalt, isAdmin, role) VALUES (?,?,?,?,1,'superadmin')")
        .run("Admin", adminEmail, hash, salt);
      console.log(`[seed] Superadmin created for ${adminEmail} (from env)`);
    }
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
    ins.run("supportPhone", "+92 300 0000000"); // placeholder — set the real number in Admin → Settings
    ins.run("currency", "PKR");
    ins.run("freeShippingThreshold", "5000");
    ins.run("shippingFee", "250");
    ins.run("lowStockThreshold", "15");
    ins.run("facebookPixelId", "");
    // storefront merchandising — all editable in Admin → Settings, empty means
    // "use the built-in default / hide the section"
    ins.run("saleEndsAt", "");            // ISO datetime; countdown hidden when empty/past
    ins.run("heroSlide1", "");            // product IDs; price/image/link derive from live catalog
    ins.run("heroSlide2", "");
    ins.run("heroSlide3", "");
    ins.run("dealOfDay1", "");
    ins.run("dealOfDay2", "");
    ins.run("deliveryDaysCity", "2-3");   // working days for Lahore & Karachi
    ins.run("deliveryDaysOther", "3-5");  // working days elsewhere in Pakistan
  }

  // seed legal/policy pages (idempotent) — editable in Admin → Policies without a redeploy
  const polCount = db.prepare("SELECT COUNT(*) c FROM policies").get().c;
  if (polCount === 0) {
    const insPol = db.prepare("INSERT INTO policies (path, title, updated, sections) VALUES (?,?,?,?)");
    insPol.run("/privacy", "Privacy & Cookie Policy", "August 2026", JSON.stringify([
      { heading: "What we collect", body: "Account details (name, email), order information (delivery address, phone), and — only with your consent — anonymous analytics events such as product views and searches. Payment card data is never stored on our servers or in cookies." },
      { heading: "Cookies & storage", body: "Essential cookies/storage keep your cart, login session and checkout working. Analytics and marketing trackers (including the Meta Pixel) load ONLY after you opt in via the cookie banner. You can change your choice anytime via 'Manage cookies' in the footer." },
      { heading: "How we use your data", body: "To fulfil orders, provide support, send order updates, and — with consent — improve the store through aggregate analytics. We never sell personal data." },
      { heading: "Your rights", body: "You may request a copy or deletion of your personal data at any time by emailing support@xccessoriespoint.pk. Consent records are versioned and time-stamped." },
      { heading: "Retention", body: "Order records are kept for accounting purposes. Analytics events are aggregate and contain no personally identifying information." },
    ]));
    insPol.run("/returns", "Returns & Refund Policy", "August 2026", JSON.stringify([
      { heading: "7-day easy returns", body: "You can request a return within 7 days of delivery for any reason. Items should be unused and in original packaging with all accessories." },
      { heading: "Damaged or incorrect items", body: "If your order arrives damaged or isn't what you ordered, contact us within 48 hours — we replace it or refund you in full, including shipping." },
      { heading: "How to request", body: "Use the Track Order tool with your order ID and submit a return request, or message us on WhatsApp. Approved returns are refunded within 5–7 working days." },
      { heading: "Refund method", body: "Card and wallet payments are reversed to the original method. COD orders are refunded via bank transfer or mobile wallet." },
      { heading: "Warranty", body: "Electronics carry a 6-month replacement warranty; cables carry a lifetime warranty. Warranty claims follow the same process as returns." },
    ]));
    insPol.run("/terms", "Terms of Service", "August 2026", JSON.stringify([
      { heading: "Orders & pricing", body: "All prices are in Pakistani Rupees and include applicable taxes. Order totals (including discounts and shipping) are computed server-side at the moment of purchase. We may cancel orders in case of pricing errors or stock issues, with a full refund." },
      { heading: "Cash on Delivery", body: "COD orders start as 'Pending' and are confirmed by phone before dispatch. Repeatedly refused COD deliveries may limit future COD availability." },
      { heading: "Delivery", body: "Estimated delivery is 2–3 working days for Lahore & Karachi and 3–5 working days elsewhere. Estimates are not guarantees; couriers may face delays." },
      { heading: "Accounts", body: "You are responsible for keeping your account credentials secure. We may suspend accounts engaged in fraud or abuse (rate limits protect the store automatically)." },
      { heading: "Contact", body: "XccessoriesPoint · support@xccessoriespoint.pk · +92 300 0000000 · Lahore & Karachi, Pakistan." },
    ]));
  }

  // seed AEO buying guides (idempotent) — editable in Admin → Guides
  const guideCount = db.prepare("SELECT COUNT(*) c FROM guides").get().c;
  if (guideCount === 0) {
    const insGuide = db.prepare(
      "INSERT INTO guides (slug, title, tldr, sections, relatedCategory, relatedBand) VALUES (?,?,?,?,?,?)"
    );
    insGuide.run("what-is-anc-noise-cancellation", "What Is ANC (Active Noise Cancellation)?",
      "ANC (Active Noise Cancellation) uses microphones to detect outside noise and play an inverted sound wave that cancels it before it reaches your ear. It silences low-frequency rumble like traffic, bus engines and fans — ideal for commuting in Pakistani cities. It works best with a snug eartip seal.",
      JSON.stringify([
        { heading: "How ANC actually works", body: "Tiny microphones on the earbuds listen to the noise around you. A chip generates an identical sound wave but flipped in phase (anti-noise) and plays it alongside your music. When the two waves meet, they cancel each other out. This happens thousands of times per second — you never hear the anti-noise itself." },
        { heading: "What ANC can and can't cancel", body: "ANC excels at steady, low-frequency sounds: bus and rickshaw engines, AC hum, fan noise, airplane cabin roar. It struggles with sudden or high-pitched sounds like honking, voices or pressure horns — those are dampened somewhat, mostly by the physical seal of the eartip. No ANC makes loud environments silent; it makes them tolerable." },
        { heading: "Does ANC affect battery life?", body: "Yes — expect roughly 20–30% shorter playback with ANC on, since the microphones and cancellation chip run continuously. Most modern earbuds still deliver 4–6 hours per charge with ANC active. Turn ANC off in quiet places to stretch battery life." },
        { heading: "Is ANC worth it in Pakistan?", body: "If you commute by bus, rickshaw or train, or work in a noisy office, ANC is genuinely transformative — it lets you listen at lower, safer volumes. For calls, look for ENC (Environmental Noise Cancellation), which cleans up your voice for the caller rather than your listening experience. Browse our ANC-enabled earbuds below." },
      ]),
      "audio", null);
    insGuide.run("mah-explained-power-banks", "mAh Explained: How Big a Power Bank Do You Actually Need?",
      "mAh (milliamp-hours) measures a battery's capacity — how much charge it holds. As a rule of thumb, divide a power bank's mAh by your phone's battery mAh and multiply by ~0.65 for real-world losses: a 10,000mAh bank charges a 5,000mAh phone about 1.3 times. Bigger isn't always better — capacity adds weight.",
      JSON.stringify([
        { heading: "The quick math", body: "A 5,000mAh phone battery needs roughly 7,500mAh from a power bank, because energy is lost as heat during voltage conversion (typically 30–35%). So: 10,000mAh bank ≈ 1.3 full charges, 20,000mAh ≈ 2.6 charges, 30,000mAh ≈ 4 charges for a modern smartphone." },
        { heading: "Why '20,000mAh' banks underperform", body: "Beware inflated ratings. Quality cells inside a genuine 20,000mAh bank convert at 60–70% efficiency. Cheap banks often use recycled or mislabelled cells delivering half their claimed capacity. Buy from sellers who state cell quality and offer a warranty." },
        { heading: "Capacity vs portability", body: "10,000mAh is the sweet spot for daily carry — pocketsize, ~220g, one-and-a-bit full charges. 20,000mAh suits travel days and load-shedding backup. Above 20,000mAh you're carrying a brick; only worth it for tablets or multiple devices." },
        { heading: "Don't forget charging speed", body: "Capacity is only half the story — check output wattage. An 18W+ PD (Power Delivery) port refills most phones to 50% in about 30 minutes; old 10W ports take over an hour. Our power bank range lists real capacities with PD fast-charging and COD nationwide." },
      ]),
      "power", "under-5000");
    insGuide.run("gan-chargers-explained", "GaN Chargers Explained: Why Your Next Charger Should Be GaN",
      "GaN (gallium nitride) is a semiconductor material that handles higher power with far less heat than traditional silicon chargers. The result: chargers up to 40% smaller, running cooler, safely fast-charging laptops as well as phones. Same wattage rating, dramatically better engineering.",
      JSON.stringify([
        { heading: "Silicon vs GaN", body: "Conventional chargers use silicon transistors, which waste energy as heat and need bulky components to stay cool. Gallium nitride switches electricity more efficiently at higher frequencies, so components can shrink. That's why a pocket-size 65W GaN charger can outperform an old 65W laptop brick three times its size." },
        { heading: "One charger for everything", body: "Most GaN chargers are multi-port with smart power splitting: plug in a laptop and phone together and the chip allocates watts intelligently (e.g. 45W + 18W). With PD (Power Delivery) support, one GaN brick replaces your laptop, tablet and phone chargers — ideal for travel and load-shedding backup." },
        { heading: "What to check before buying", body: "Look for: total wattage matching your hungriest device (65W covers most laptops), PD 3.0/PPS support for Samsung and iPhones, built-in over-current and over-temperature protection, and a brand warranty. Avoid no-name '65W' chargers without protection circuits — cheap GaN is worse than good silicon." },
        { heading: "Are GaN chargers safe?", body: "Yes — certified GaN chargers include the same (often better) protections as premium silicon chargers: over-voltage, short-circuit and thermal cutoffs. They simply waste less energy as heat. See our PTA-safe GaN charger collection, all covered by replacement warranty." },
      ]),
      "power", null);
    insGuide.run("bluetooth-5-3-meaning", "Bluetooth 5.3: What the Number Means for Your Earbuds",
      "Bluetooth 5.3 is a version of the wireless standard focused on connection stability, lower latency and better power efficiency — not louder sound or longer raw range. For earbuds it means fewer dropouts in crowded markets, faster pairing, and slightly longer battery life than Bluetooth 5.0-era buds.",
      JSON.stringify([
        { heading: "What each generation improves", body: "Bluetooth versions aren't about volume or audio quality directly — codecs handle that. Version 5.0 added long-range modes; 5.2 introduced LE Audio foundations and better power control; 5.3 refined connection reliability, latency and coexistence with other radios. Practical result: steadier audio with fewer stutters." },
        { heading: "Real-world benefits for earbuds", body: "With BT 5.3 you get: quicker reconnection when you open the case, more stable audio in WiFi-dense areas (markets, offices, apartments), reduced lip-sync lag when watching videos, and marginal battery savings. Range through walls improves modestly — expect solid performance across a typical room or two." },
        { heading: "Do codecs matter more?", body: "Yes. AAC (iPhones and most Androids) and SBC are standard; aptX and LDAC offer hi-res paths on supported Androids. Both earbuds AND your phone must support the codec. A BT 5.3 bud with AAC will sound identical on iPhone to a more expensive bud with codecs your phone ignores." },
        { heading: "Multipoint: the sleeper feature", body: "Multipoint pairing lets earbuds stay connected to your laptop and phone simultaneously — calls interrupt music automatically. Combined with BT 5.3 stability, it's the feature commuters and WFH users appreciate most. Filter our audio range for multipoint-capable models." },
      ]),
      "audio", null);
    insGuide.run("spo2-smartwatch-tracking", "SpO2 on Smartwatches: What Blood-Oxygen Tracking Really Tells You",
      "SpO2 tracking measures blood-oxygen saturation via pulse oximetry — LEDs shine red and infrared light through your wrist, and a sensor reads how much light the blood absorbs. Normal readings sit between 95–100%. It's a useful wellness trend indicator, not a medical diagnostic device.",
      JSON.stringify([
        { heading: "How wrist SpO2 sensing works", body: "Oxygen-rich blood absorbs infrared light differently than oxygen-poor blood. The watch flashes its sensors periodically (usually overnight), measures absorption ratios, and estimates saturation percentage. Readings are affected by wrist position, tattoos, skin temperature and movement — treat single odd readings skeptically." },
        { heading: "What it's useful for", body: "Trend-watching: consistent overnight dips are worth discussing with a doctor, especially if you snore heavily (possible sleep apnea signal). Altitude travellers can spot acclimatization issues. Athletes use it to gauge recovery. What it's NOT: a substitute for a proper fingertip pulse oximeter or medical diagnosis." },
        { heading: "Accuracy expectations", body: "Consumer watches typically land within ±2% of medical pulse oximeters under good conditions — resting still, warm wrist, correct fit. Motion, cold hands and loose straps degrade accuracy significantly. Use it to spot patterns, not to make treatment decisions." },
        { heading: "Is it worth paying extra for?", body: "If you care about sleep quality trends, altitude travel or general health monitoring, yes — it's now standard even in budget bands. Prioritise instead: battery life, display quality and heart-rate accuracy, which you'll use daily. Our wearables range includes SpO2 tracking across price points." },
      ]),
      "wearables", null);
    insGuide.run("smartwatch-battery-life", "Smartwatch Battery Life: Real-World Numbers vs Marketing Claims",
      "Budget smartwatches advertise 7–15 day battery, but real-world life depends on display brightness, always-on mode, call usage and GPS. Expect roughly half the advertised figure with heavy features enabled. A well-tuned watch with always-on display disabled reliably delivers 5–9 days of normal use.",
      JSON.stringify([
        { heading: "Why claims don't match reality", body: "Advertised figures assume the display off between glances, heart-rate checks at long intervals, no calls, and brightness low. Turn on the always-on AMOLED display — often the biggest single drain — and 10 advertised days becomes 4–5. That's normal physics, not a defective unit." },
        { heading: "The big four battery drainers", body: "1) Always-on display (up to 40% of drain). 2) Continuous call/audio over Bluetooth. 3) High screen brightness outdoors. 4) Frequent GPS workouts. Sleep tracking with SpO2 sampling adds moderate overnight drain. Adjust these and you control your battery life almost entirely." },
        { heading: "Charging habits that preserve the battery", body: "Lithium batteries age fastest at extremes: avoid draining to 0% regularly and don't leave it on the charger all night every night. Topping up mid-week for 30–40 minutes beats full deep cycles. Expect 70–80% original capacity after two years of daily use." },
        { heading: "Choosing by battery priority", body: "If you hate charging: pick a rectangular band-style watch with 10+ day claims and skip always-on. If you want the full smart experience: accept 3–5 day reality with an AMOLED always-on display. Our wearables section filters by battery-focused vs display-first models, all with free strap exchange." },
      ]),
      "wearables", "under-5000");
    insGuide.run("tpu-vs-silicone-phone-cases", "TPU vs Silicone vs Hard Cases: Which Phone Case Material Lasts?",
      "TPU (thermoplastic polyurethane) offers the best everyday balance: flexible, impact-absorbing, yellowing-resistant for years. Silicone feels softest and grips surfaces but attracts lint and stretches. Hard PC cases resist scratches but crack on drops. For most people in Pakistan's climate, quality TPU wins.",
      JSON.stringify([
        { heading: "TPU — the practical default", body: "Thermoplastic polyurethane flexes to absorb shock, grips well, and resists oil and sweat — important in Pakistani summers. Its historical weakness was yellowing, but modern anti-yellowing TPU formulations stay clear for years. Look for 'anti-yellowing guarantee' listings and raised camera lips." },
        { heading: "Silicone — softest feel, highest upkeep", body: "Liquid silicone cases feel premium and grip dashboards beautifully, but the porous surface collects dust, lint and pocket debris, and needs regular cleaning. They also loosen over months as the material relaxes. Choose silicone for feel, not longevity." },
        { heading: "Hard PC and hybrid cases", body: "Polycarbonate shells shrug off scratches and print designs beautifully, but rigid plastic transfers drop energy straight to the phone and corners can crack. Hybrids (hard back + TPU bumper) combine looks with protection — check that the bumper wraps corners generously." },
        { heading: "Features that matter more than material", body: "Raised bezels protecting screen and camera lenses, precise button feedback, wireless-charging compatibility under 3mm thickness, and non-slip sides matter more daily than the material label. Our cases ship with a free screen protector and anti-yellowing guarantee — COD nationwide." },
      ]),
      "cases", null);
    insGuide.run("usb-c-cable-speeds-explained", "USB-C Cable Speeds Explained: Charging Watts and Data Rates Decoded",
      "All USB-C cables look alike but differ wildly: charging capability spans 60W to 240W depending on the internal wire gauge and E-marker chip, while data rates span USB 2.0 (480Mbps) to Thunderbolt-level 40Gbps. A cable that charges fast may transfer files painfully slowly — check both ratings before buying.",
      JSON.stringify([
        { heading: "Charging: watts and E-markers", body: "Cables rated 3A handle up to 60W (fine for phones and small tablets). Laptops drawing 100W–240W require a 5A-rated cable with an embedded E-marker chip that negotiates the higher current with the charger. Using a 60W cable with a 100W charger isn't dangerous — you just get 60W." },
        { heading: "Data: the hidden lottery", body: "Many bundled and budget cables are USB 2.0 — fine for charging, but capped at 480Mbps: a 50GB phone backup takes around 15 minutes versus under 3 minutes on USB 3.2's 10Gbps. If you offload photos or make wired backups, explicitly buy a 10Gbps-rated cable." },
        { heading: "Braided vs rubber jackets", body: "Nylon braiding protects against the #1 cable killer — bending stress near the connectors — typically lasting 5–10× longer than bare rubber. Inside the braid, what matters is copper core purity and strain-relief moulding. Lifetime-warranty braided cables exist because good ones rarely fail." },
        { heading: "Quick buying checklist", body: "Match wattage to your hungriest device (check its spec page), demand 480Mbps→10Gbps data rating appropriate to your use, prefer braided nylon with strain relief, and buy from sellers honoring warranties. Our braided copper-core cables carry a lifetime warranty — browse the cables range." },
      ]),
      "cables", null);
  }

  const notifCount = db.prepare("SELECT COUNT(*) c FROM notifications").get().c;
  if (notifCount === 0) {
    notify("system", "Welcome to your store", "Backend initialized with SQLite. All systems go.");
  }

  // PK-market category intro copy (SEO landing pages) — idempotent, runs after
  // category seeding so fresh DBs get copy too
  const catCopy = {    audio: "Shop wireless earbuds and headphones online in Pakistan with cash on delivery. Bluetooth 5.3 earbuds, ENC calling, long battery life and deep bass — from Rs 2,500 with free shipping over Rs 5,000.",
    wearables: "Buy smartwatches and fitness bands in Pakistan at honest prices. AMOLED displays, SpO2 and heart-rate tracking, 7-day battery and free strap exchange — COD nationwide on every order.",
    power: "Power banks, GaN fast chargers and cables built for Pakistani voltage. PD 20W+ charging, PTA-safe certified cells and over-charge protection — delivered anywhere in Pakistan with COD.",
    cases: "Protect your phone with slim, anti-yellowing cases that stay wireless-charging safe. Precise cutouts, raised camera lips and free screen protectors included — cash on delivery across Pakistan.",
    cables: "Braided USB-C, Lightning and HDMI hubs with 100% copper cores and lifetime warranty. Fast data transfer and 60W+ power delivery — tangle-free cables shipped COD nationwide.",
  };
  const fillCat = db.prepare("UPDATE categories SET description = ? WHERE id = ? AND (description IS NULL OR description = '')");
  for (const [id, desc] of Object.entries(catCopy)) fillCat.run(desc, id);

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
