# XccessoriesPoint

Pakistani cash-on-delivery (COD) e-commerce storefront for tech accessories — earbuds, smartwatches, power banks, chargers and cases. React SPA frontend backed by a custom Node.js + SQLite API, deployable as a single container.

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 18 + Vite + Tailwind CSS (SPA with clean URLs) |
| Backend | Plain Node `http` server — no framework |
| Database | SQLite (better-sqlite3, WAL mode) on a mounted volume |
| Deploy | Docker → Railway, Cloudflare (free) edge cache in front |

## Features

**Storefront**
- Catalog with variants, wishlist, guest/local cart that syncs to a server cart
- COD / WhatsApp / card checkout with server-side pricing and stock validation
- Public order tracking by order ID (PII redacted), returns & ticketing
- Service worker for offline shell; visible degraded-mode banner

**SEO / AEO**
- Server-injected absolute OG/Twitter/JSON-LD meta for product, category and homepage shells (WhatsApp/Facebook rich previews work without JS)
- True 404s outside the SPA route whitelist; dynamic `robots.txt` + sitemap
- Programmatic price-band pages (`/category/:id/:band`) — only published when ≥3 in-stock products qualify, ranked by real weekly sales
- AEO buying guides (`/guides/:slug`) with Article + FAQ JSON-LD

**Admin console** (`/admin`)
- Products/variants/images, categories with SEO descriptions, coupons
- Orders with status flow (stock-safe cancel/refund/fail restocking), payments, refunds
- Review moderation, policies editor, buying-guides editor
- Settings-driven merchandising: sale countdown, hero/deal product picks, shipping fees, delivery ETAs, contact details — no redeploy needed

## Quick start

```bash
npm install          # installs deps (skip chromium: PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1)
npm run dev          # vite dev server (proxies /api)
npm run api          # API only on :4173
```

Production:

```bash
npm run build        # builds dist/
npm start            # serves dist/ + API from one process
```

Tests:

```bash
npm test             # 54 tests: api.test.mjs + seo-hardening.test.mjs (hermetic servers)
npm run backup       # WAL-safe SQLite backup
```

## Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `4173` | Listen port (Railway sets it) |
| `XP_DB_PATH` | `./store.db` | SQLite file location — put it on the volume in prod |
| `XP_ADMIN_EMAIL` / `XP_ADMIN_PASSWORD` | random (printed once) | Seeds the superadmin on first boot |
| `XP_BASE_URL` | `https://xccessoriespoint.pk` | Canonical URL — sitemap, OG tags, robots.txt |
| `XP_ALLOWED_ORIGIN` | permissive | Comma-separated CORS allowlist; set it in prod |
| `XP_TRUST_PROXY` | trust XFF | Set `0` only when exposing the server directly to the internet |
| `VITE_WHATSAPP_NUMBER` | placeholder | WhatsApp deep-link number, digits only |

Full deployment guide (Railway + Cloudflare, healthcheck notes): **[DEPLOY.md](./DEPLOY.md)**

## Project layout

```
server/index.mjs      entire API: routes, auth/sessions, orders, pSEO, policies, static serving
server/db.mjs         schema + idempotent seeds (catalog, settings, guides, policies)
server/pseo.mjs       programmatic price-band engine (quality gate + ranking)
src/context/store.tsx global state: products, cart, auth, toasts, offline mode
src/pages/            Shop, Product, Category (hubs + band spokes), Checkout, Admin, Guide…
tests/                two hermetic suites spawning real servers on scratch DBs
```
