import { useEffect, useState } from "react";

/**
 * Public storefront settings (GET /api/config — non-sensitive whitelist only).
 * Module-level cache: one fetch per session, shared across every consumer.
 * Returns null until loaded; callers must fall back to built-in defaults so
 * the site renders correctly before (or without) the config response.
 */
export type StoreConfig = {
  storeName: string | null;
  supportEmail: string | null;
  supportPhone: string | null;
  currency: string | null;
  freeShippingThreshold: string | null;
  shippingFee: string | null;
  facebookPixelId: string | null;
  saleEndsAt: string | null;
  heroSlide1: string | null;
  heroSlide2: string | null;
  heroSlide3: string | null;
  dealOfDay1: string | null;
  dealOfDay2: string | null;
  deliveryDaysCity: string | null;
  deliveryDaysOther: string | null;
};

let cache: StoreConfig | null = null;
let inflight: Promise<StoreConfig> | null = null;

function load(): Promise<StoreConfig> {
  if (cache) return Promise.resolve(cache);
  if (!inflight)
    inflight = fetch("/api/config")
      .then((r) => (r.ok ? r.json() : {}))
      .then((c) => {
        cache = c as StoreConfig;
        return cache;
      })
      .catch(() => ({}) as StoreConfig);
  return inflight;
}

export function useStoreConfig(): StoreConfig | null {
  const [cfg, setCfg] = useState<StoreConfig | null>(cache);
  useEffect(() => {
    if (!cache) load().then(setCfg);
  }, []);
  return cfg;
}

/** numeric setting with fallback — thresholds/fees come from admin settings */
export function cfgNum(v: string | null | undefined, fallback: number): number {
  const n = parseInt(v ?? "", 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}
