/* SEO head manager — upserts meta/OG/Twitter/canonical tags + JSON-LD per route.
 *
 * Client-side updates keep SPA navigations shareable and crawlable where JS
 * runs; WhatsApp/Facebook link previews (no JS execution) are handled
 * server-side by meta injection in server/index.mjs.
 */

export interface SeoData {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  type?: string;
  /** Structured data: one object, several objects (e.g. Product + BreadcrumbList), or null to clear */
  jsonLd?: Record<string, unknown> | Record<string, unknown>[] | null;
}

const JSONLD_PREFIX = "route-jsonld";

function upsertMeta(attr: "name" | "property", key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function upsertCanonical(href: string) {
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!el) {
    el = document.createElement("link");
    el.rel = "canonical";
    document.head.appendChild(el);
  }
  el.href = href;
}

function absUrl(u: string): string {
  try {
    return new URL(u, location.origin).toString();
  } catch {
    return u;
  }
}

function setJsonLd(data: Record<string, unknown> | Record<string, unknown>[] | null) {
  document.querySelectorAll(`[id^="${JSONLD_PREFIX}"]`).forEach((el) => el.remove());
  if (!data) return;
  const blocks = Array.isArray(data) ? data : [data];
  blocks.forEach((obj, i) => {
    const el = document.createElement("script");
    el.type = "application/ld+json";
    el.id = `${JSONLD_PREFIX}-${i}`;
    el.textContent = JSON.stringify(obj);
    document.head.appendChild(el);
  });
}

/** Apply route-level SEO metadata. Only provided fields are overwritten. */
export function setMeta(seo: SeoData) {
  if (seo.title) document.title = seo.title;
  const url = seo.url ? absUrl(seo.url) : location.origin + location.pathname;

  if (seo.description) upsertMeta("name", "description", seo.description);
  if (seo.title) {
    upsertMeta("property", "og:title", seo.title);
    upsertMeta("name", "twitter:title", seo.title);
  }
  if (seo.description) {
    upsertMeta("property", "og:description", seo.description);
    upsertMeta("name", "twitter:description", seo.description);
  }
  if (seo.image) {
    const img = absUrl(seo.image);
    upsertMeta("property", "og:image", img);
    upsertMeta("name", "twitter:image", img);
  }
  upsertMeta("property", "og:url", url);
  upsertMeta("property", "og:type", seo.type ?? "website");
  upsertCanonical(url);

  if (seo.jsonLd !== undefined) setJsonLd(seo.jsonLd);
}
