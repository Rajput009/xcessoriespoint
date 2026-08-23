/* Programmatic SEO engine — price-band curation pages (/category/:id/:band).
 *
 * Pages are generated ONLY where they provide unique value: a band×category
 * combination goes live when at least MIN_ITEMS active, in-stock products
 * qualify. Rankings use a proprietary score built from real weekly sales
 * (order_items joined to orders), ratings and review confidence — data no
 * competitor can copy. Intro copy is admin-editable via settings keys
 * (`pseo_intro_{category}_{band}`), falling back to a data-driven composition.
 */
import { db, getSetting } from "./db.mjs";

export const PSEO_BANDS = [
  { id: "under-2000", label: "Under Rs 2,000", max: 1999 },
  { id: "under-3000", label: "Under Rs 3,000", max: 2999 },
  { id: "under-5000", label: "Under Rs 5,000", max: 4999 },
  { id: "under-10000", label: "Under Rs 10,000", max: 9999 },
  { id: "best-premium", label: "Premium Picks", min: 10000 },
];

const MIN_ITEMS = 3;
const BAND_TRADEOFFS = {
  "under-2000": "At this budget every rupee counts — expect the essentials done well rather than flagship extras.",
  "under-3000": "The sweet spot for everyday use: reliable basics with one or two standout features.",
  "under-5000": "This is where features like fast charging, ENC calling and premium finishes start appearing.",
  "under-10000": "Upper mid-range territory — close to flagship experience without the flagship price.",
  "best-premium": "No compromises here: top-spec chips, best-in-class battery and full accessory bundles.",
};

function weeklySales() {
  const map = {};
  const rows = db.prepare(
    `SELECT oi.productId, SUM(oi.qty) v FROM order_items oi
     JOIN orders o ON o.id = oi.orderId
     WHERE o.status NOT IN ('Cancelled', 'Failed')
       AND o.createdAt > datetime('now', '-7 days')
     GROUP BY oi.productId`
  ).all();
  for (const r of rows) map[r.productId] = r.v;
  return map;
}

function scoreProduct(p, sold) {
  return sold * 3 + p.rating * 2 + Math.log(p.reviews + 1) + (p.stock > 0 ? 1 : 0);
}

function whyLine(item, cheapestPrice) {
  if (item.rank === 1 && item.soldThisWeek > 0)
    return `Top seller — ${item.soldThisWeek} bought this week`;
  if (item.rating >= 4.5 && item.reviews >= 3)
    return `Crowd favourite — rated ${item.rating}★ by ${item.reviews} buyers`;
  if (item.price === cheapestPrice) return "Best value in this budget";
  return `${item.rating}★ rated · ${item.stock} in stock`;
}

function inBand(band, price) {
  if (band.max !== undefined && price > band.max) return false;
  if (band.min !== undefined && price < band.min) return false;
  return true;
}

/** Resolve one band page. Returns null when the quality gate fails. */
export function resolveBand(categoryId, bandId) {
  const category = db.prepare("SELECT * FROM categories WHERE id = ?").get(categoryId);
  const band = PSEO_BANDS.find((b) => b.id === bandId);
  if (!category || !band) return null;

  const sales = weeklySales();
  // effective price = what the cheapest purchasable option actually costs
  // (base + lowest active-variant delta), so an "Under Rs 2,000" page never
  // lists a product whose real minimum is above the band
  const minDelta = db.prepare("SELECT MIN(priceDelta) d FROM product_variants WHERE productId = ? AND active = 1");
  const pool = db
    .prepare("SELECT * FROM products WHERE category = ? AND active = 1 AND stock > 0 ORDER BY price ASC")
    .all(categoryId)
    .map((p) => ({ ...p, effPrice: p.price + (minDelta.get(p.id)?.d ?? 0) }))
    .filter((p) => inBand(band, p.effPrice));

  if (pool.length < MIN_ITEMS) return null;

  const scored = pool
    .map((p) => ({
      id: p.id,
      name: p.name,
      image: p.image,
      price: p.effPrice,
      compareAt: p.compareAt && p.compareAt > p.effPrice ? p.compareAt : null,
      rating: p.rating,
      reviews: p.reviews,
      stock: p.stock,
      description: p.description || "",
      soldThisWeek: sales[p.id] ?? 0,
    }))
    .map((p) => ({ ...p, score: scoreProduct(p, p.soldThisWeek) }))
    .sort((a, b) => b.score - a.score || a.price - b.price);

  const cheapestPrice = Math.min(...scored.map((s) => s.price));
  const items = scored.map((p, i) => {
    const item = { ...p, rank: i + 1 };
    return { ...item, why: whyLine(item, cheapestPrice) };
  });

  return { category, band, items, total: items.length };
}

/** All currently-live band pages (sitemap + admin listing).
 *  Memoized for 60s: each call otherwise rescans every category × band
 *  (products scan + weekly-sales query), and this runs on sitemap.xml,
 *  hub siblings and every band-page render. */
let lbpCache = null;
const LBP_TTL = 300_000; // 5 min — recomputes are the heaviest query path in the app
export function liveBandPages() {
  if (lbpCache && Date.now() - lbpCache.at < LBP_TTL) return lbpCache.pages;
  const pages = [];
  for (const c of db.prepare("SELECT id FROM categories").all()) {
    for (const b of PSEO_BANDS) {
      const r = resolveBand(c.id, b.id);
      if (r)
        pages.push({
          categoryId: c.id,
          categoryName: r.category.name,
          bandId: b.id,
          bandLabel: b.label,
          productCount: r.total,
        });
    }
  }
  lbpCache = { pages, at: Date.now() };
  return pages;
}

/** Live sibling bands for cross-linking (hub → spokes and spoke → spokes). */
export function siblingBands(categoryId, excludeBandId = null) {
  return liveBandPages()
    .filter((p) => p.categoryId === categoryId && p.bandId !== excludeBandId)
    .map(({ categoryId, bandId, bandLabel }) => ({ categoryId, bandId, bandLabel }));
}

/** Intro copy: admin override via settings, else composed from live data. */
export function bandIntro(categoryId, bandId, category, band, total) {
  const override = getSetting(`pseo_intro_${categoryId}_${bandId}`, "");
  if (override && String(override).trim()) return String(override).trim();
  const prices = db
    .prepare("SELECT MIN(price) lo, MAX(price) hi FROM products WHERE category = ? AND active = 1 AND stock > 0")
    .get(categoryId);
  return (
    `${BAND_TRADEOFFS[bandId] ?? ""} ` +
    `These ${total} ${category.name.toLowerCase()} picks between Rs ${prices?.lo ?? 0} and Rs ${prices?.hi ?? 0} are ranked by what's actually selling at XccessoriesPoint this week — not by who paid for placement. ` +
    `Every item ships cash-on-delivery across Pakistan, with free shipping on orders over Rs 5,000 and 7-day returns.`
  );
}
