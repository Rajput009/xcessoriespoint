/* Meta (Facebook) Pixel — consent-gated integration.
 *
 * The pixel is ONLY loaded after the visitor grants MARKETING consent
 * (cookie banner → "Accept all" or Customize → Marketing).
 * The Pixel ID is configured by the admin (Settings → Facebook Pixel ID)
 * and served via GET /api/config.
 */
import { getConsent } from "./tracking";

declare global {
  interface Window {
    fbq?: ((...args: unknown[]) => void) & { queue?: unknown[]; loaded?: boolean };
    _fbq?: unknown;
  }
}

let pixelId: string | null = null;
let initialized = false;
let configFetched = false;
/** Events fired before async init completes are buffered, then flushed. */
const pending: [string, Record<string, unknown> | undefined][] = [];

function injectSnippet() {
  if (window.fbq) return;
  // Standard Meta Pixel bootstrap (queues events until fbevents.js loads)
  const fbq: Window["fbq"] = function (...args: unknown[]) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const f = fbq as any;
    if (f.callMethod) f.callMethod(...args);
    else f.queue.push(args);
  } as Window["fbq"];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const f = fbq as any;
  f.push = fbq;
  f.loaded = true;
  f.version = "2.0";
  f.queue = [];
  window.fbq = fbq;
  window._fbq = fbq;
  const script = document.createElement("script");
  script.async = true;
  script.src = "https://connect.facebook.net/en_US/fbevents.js";
  document.head.appendChild(script);
}

async function fetchPixelId(): Promise<string | null> {
  if (configFetched) return pixelId;
  configFetched = true;
  try {
    const r = await fetch("/api/config");
    if (r.ok) {
      const cfg = await r.json();
      pixelId = cfg.facebookPixelId || null;
    }
  } catch {
    pixelId = null;
  }
  return pixelId;
}

/** Initialize the pixel if (and only if) marketing consent has been granted. */
export async function initPixel(): Promise<void> {
  const consent = getConsent();
  if (!consent?.marketing) return;
  const id = await fetchPixelId();
  if (!id) return;

  injectSnippet();
  if (!initialized) {
    window.fbq!("consent", "grant");
    window.fbq!("init", id);
    window.fbq!("track", "PageView");
    initialized = true;
    // flush events tracked while init was in flight
    for (const [event, data] of pending.splice(0)) window.fbq!("track", event, data ?? {});
  } else {
    window.fbq!("consent", "grant");
  }
}

/** Called when the user revokes marketing consent. */
export function revokePixel(): void {
  if (window.fbq) window.fbq("consent", "revoke");
}

/** Track a standard Meta Pixel event (no-op without marketing consent). */
export function pixelTrack(
  event:
    | "PageView"
    | "ViewContent"
    | "Search"
    | "AddToCart"
    | "AddToWishlist"
    | "InitiateCheckout"
    | "Purchase"
    | "CompleteRegistration"
    | "Lead",
  data?: Record<string, unknown>
): void {
  if (!getConsent()?.marketing) return;
  if (!initialized || !window.fbq) {
    // buffer until init completes (dropped if no pixel id is configured)
    pending.push([event, data]);
    if (pending.length > 50) pending.shift();
    return;
  }
  window.fbq("track", event, data ?? {});
}

/** SPA route change → PageView. */
export function pixelPageView(): void {
  pixelTrack("PageView");
}
