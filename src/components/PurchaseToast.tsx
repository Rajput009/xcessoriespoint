import { useEffect, useRef, useState } from "react";
import { Link, useRouter } from "../router";

/**
 * "Recently purchased" social-proof toast — Amaze/Daraz style, bottom-left.
 * Fed exclusively by REAL orders from GET /api/social-proof (first name +
 * city only). If the store has no recent orders, it simply never shows:
 * no fabricated names, no fake activity.
 */

type FeedItem = {
  productId: number | null;
  product: string;
  image: string | null;
  customer: string;
  city: string | null;
  minsAgo: number;
};

const SESSION_KEY = "xp_socialproof_shown";
const MAX_PER_SESSION = 3;
const VISIBLE_MS = 8000;
const GAP_MS = 26000;
const EMPTY_REFETCH_MS = 45000;

function ago(mins: number): string {
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h < 24) return `${h} hour${h === 1 ? "" : "s"}${m ? ` ${m} min` : ""} ago`;
  const d = Math.floor(h / 24);
  return `${d} day${d === 1 ? "" : "s"} ago`;
}

export default function PurchaseToast() {
  const { path } = useRouter();
  const [item, setItem] = useState<FeedItem | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const feed = useRef<FeedItem[]>([]);
  const shown = useRef(
    parseInt(sessionStorage.getItem(SESSION_KEY) ?? "0", 10) || 0
  );

  useEffect(() => {
    if (dismissed || shown.current >= MAX_PER_SESSION) return;
    let alive = true;
    let showTimer: number | undefined;
    let hideTimer: number | undefined;

    const fetchFeed = () =>
      fetch("/api/social-proof")
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((d: FeedItem[]) => {
          if (alive) feed.current = Array.isArray(d) ? d : [];
        })
        .catch(() => {});

    const showNext = () => {
      if (!alive || shown.current >= MAX_PER_SESSION) return;
      const next = feed.current.shift();
      if (next) {
        setItem(next);
        shown.current += 1;
        try { sessionStorage.setItem(SESSION_KEY, String(shown.current)); } catch {}
        hideTimer = window.setTimeout(() => {
          if (alive) setItem(null);
        }, VISIBLE_MS);
        showTimer = window.setTimeout(showNext, GAP_MS);
      } else {
        // feed empty — refetch later (new orders may land while browsing)
        showTimer = window.setTimeout(async () => {
          await fetchFeed();
          showNext();
        }, EMPTY_REFETCH_MS);
      }
    };

    fetchFeed().then(showNext);
    return () => {
      alive = false;
      window.clearTimeout(showTimer);
      window.clearTimeout(hideTimer);
    };
  }, [dismissed]);

  if (!item || dismissed || path === "/admin") return null;

  return (
    <div
      role="status"
      aria-label="Recent purchase"
      className="fixed bottom-20 md:bottom-6 left-4 z-30 w-[300px] rounded-xl border border-slate-200 bg-white p-3 shadow-xl shadow-slate-900/10 fade-up"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-bold text-slate-900">
          {item.customer} purchased!
          {item.city && (
            <span className="font-medium text-slate-500"> · From {item.city}, Pakistan</span>
          )}
        </p>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss purchase notifications"
          className="shrink-0 text-slate-400 transition-colors hover:text-slate-700"
        >
          ×
        </button>
      </div>
      <div className="mt-2 flex gap-2.5">
        {item.image && (
          <img
            src={item.image}
            alt=""
            loading="lazy"
            className="w-12 h-12 shrink-0 rounded-lg border border-slate-100 object-cover"
          />
        )}
        <div className="min-w-0">
          {item.productId ? (
            <Link
              to={`/product/${item.productId}`}
              className="line-clamp-2 text-xs font-semibold leading-snug text-slate-800 transition-colors hover:text-teal-700"
            >
              {item.product}
            </Link>
          ) : (
            <p className="line-clamp-2 text-xs font-semibold leading-snug text-slate-800">{item.product}</p>
          )}
          <p className="mt-1 flex items-center gap-1 text-[10px] font-medium text-slate-400">
            <span aria-hidden="true">🕐</span> {ago(item.minsAgo)}
          </p>
          <p className="mt-0.5 flex items-center gap-1 text-[10px] font-bold text-emerald-600">
            <span aria-hidden="true">✓</span> Verified order
          </p>
        </div>
      </div>
    </div>
  );
}
