/* Privacy-aware analytics: visitor id + consent + event tracking */

export interface Consent {
  essential: boolean;
  analytics: boolean;
  marketing: boolean;
  version?: string | null;
}

const CONSENT_KEY = "xp_consent";
const VISITOR_KEY = "xp_visitor";

export function getVisitorId(): string {
  let id = localStorage.getItem(VISITOR_KEY);
  if (!id) {
    id = "vis_" + crypto.randomUUID().replace(/-/g, "").slice(0, 20);
    localStorage.setItem(VISITOR_KEY, id);
  }
  return id;
}

export function getConsent(): Consent | null {
  try {
    return JSON.parse(localStorage.getItem(CONSENT_KEY) || "null");
  } catch {
    return null;
  }
}

export async function saveConsent(c: Consent): Promise<void> {
  localStorage.setItem(CONSENT_KEY, JSON.stringify({ ...c, savedAt: new Date().toISOString() }));
  try {
    await fetch("/api/consent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visitorId: getVisitorId(), analytics: c.analytics, marketing: c.marketing }),
    });
  } catch {
    /* offline — local copy still applies */
  }
}

/** Fire an analytics event. Silently dropped unless the visitor consented to analytics. */
export function track(
  type: "page_view" | "product_view" | "search" | "add_to_cart" | "checkout_start",
  data: Record<string, unknown> = {}
): void {
  const consent = getConsent();
  if (!consent?.analytics) return;
  fetch("/api/analytics/events", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Visitor-Id": getVisitorId() },
    body: JSON.stringify({ type, data }),
  }).catch(() => {});
}

/** Open the cookie preferences dialog from anywhere (e.g. footer link). */
export const CONSENT_OPEN_EVENT = "xp:open-consent";
export function openConsentManager(): void {
  window.dispatchEvent(new Event(CONSENT_OPEN_EVENT));
}
