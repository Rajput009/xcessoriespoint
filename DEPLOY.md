# Deployment Guide — Railway + Cloudflare (free)

Target topology:

```
visitor ──> Cloudflare edge (cache static, TLS) ──> Railway container (Node API + SQLite + dist/)
```

## 1. Railway

### Deploy
- Repo → Railway → New Project → Deploy from GitHub repo
- One service, one region, 512MB memory limit, no replicas
- Add a **Volume** mounted at `/app/data` if `XP_DB_PATH` points there (persistent SQLite)

### Environment variables

| Variable | Value | Why |
|---|---|---|
| `XP_ADMIN_EMAIL` / `XP_ADMIN_PASSWORD` | your credentials | seeds superadmin once |
| `XP_BASE_URL` | `https://xcessoriespoint.pk` | canonical URLs, sitemap, OG tags |
| `XP_ALLOWED_ORIGIN` | `https://xcessoriespoint.pk` | CORS lockdown |
| `XP_TRUST_PROXY` | unset (default trusts X-Forwarded-For) | Production always sits behind Railway/Cloudflare, so proxy headers are trusted by default. Set to `0` ONLY if exposing the server directly to the internet without any proxy |
| `XP_DB_PATH` | `/app/data/store.db` (or default) | keep on volume so data survives deploys |

Health check: `/api/health` responds only after DB seed completes.

### Cost control
- Usage-based billing: RAM-hours + CPU-seconds + egress. Idle baseline ≈70MB RAM.
- Static assets and product images are the main CPU/egress drivers — Cloudflare caching removes most of it.
- No per-request logging exists; log volume stays negligible.

## 2. Cloudflare (free plan)

1. **Add site** `xcessoriespoint.pk`, choose Free plan.
2. At the .pk registrar, replace nameservers with the two Cloudflare provides; wait for activation.
3. In Railway: Settings → Networking → Custom Domain → add `xcessoriespoint.pk` and `www`. Copy the DNS target into Cloudflare DNS records with **Proxy ON (orange cloud)**.
4. SSL/TLS → Overview → mode **Full**; enable **Always Use HTTPS**.

### Cache Rules (Rules → Cache Rules)

| Path | Setting |
|---|---|
| `/assets/*`, `/img/*` | Eligible for cache, Edge TTL 1 month (hashed filenames) |
| `/api/*`, `/admin*`, `/checkout*` | Bypass cache |
| `/sw.js` | Bypass cache (else service-worker updates lag) |
| `/sitemap.xml` | Edge TTL 10 min |

HTML pages are not cached by default — dynamic pages and WhatsApp/FB OG injection pass through untouched.

### After go-live

- Verify checklist:
  - HTTPS loads with valid padlock
  - Share a product URL in WhatsApp → rich preview renders
  - Place a test COD order end-to-end
  - `curl -s https://xcessoriespoint.pk/sitemap.xml | head` returns XML
  - Google Search Console → submit sitemap

## Local production smoke test

```bash
npm run build && npm start          # serves dist/ + API on :3000 (PORT env)
curl -s localhost:3000/api/health
curl -s localhost:3000/sitemap.xml | head -3
```

## Tests

```bash
npm test    # 41 tests: api.test.mjs (24) + seo-hardening.test.mjs (17)
```
