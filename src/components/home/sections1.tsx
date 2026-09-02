import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useRouter } from "../../router";
import { useCart, useProducts, useWishlist, fmt } from "../../context/store";
import { useStoreConfig } from "../../lib/config";
import { Stars } from "../ProductCard";
import ProductCard from "../ProductCard";
import ViewToggle, { type ProductView } from "../ViewToggle";
import { BoltMark, Kicker } from "../brand";
import { ChevronLeftIcon, ChevronRightIcon } from "../icons";
import CategoryLogo from "../CategoryLogo";
import { categoryArt, categoryGlyph } from "../../lib/categoryArt";
import type { Category } from "../../types";

/* ---------- countdown hook ---------- */
export function useCountdown(target: number) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const diff = Math.max(0, target - now);
  return {
    days: Math.floor(diff / 86400000),
    hours: Math.floor((diff / 3600000) % 24),
    mins: Math.floor((diff / 60000) % 60),
    secs: Math.floor((diff / 1000) % 60),
    over: diff <= 0,
  };
}

/**
 * Real sale deadline from Admin → Settings (`saleEndsAt`). No fake urgency:
 * when unset or expired there is simply no countdown.
 */
function useSaleEnd(): number | null {
  const cfg = useStoreConfig();
  const raw = cfg?.saleEndsAt;
  if (!raw) return null;
  const t = new Date(raw).getTime();
  return Number.isFinite(t) && t > Date.now() ? t : null;
}

/**
 * Deadline for the Deals of the Day section: an Admin-set `saleEndsAt` wins;
 * otherwise a daily deal honestly ends at local MIDNIGHT and auto-resets
 * every day — a real deadline, never a fabricated one.
 */
function nextMidnight(): number {
  const d = new Date();
  d.setHours(24, 0, 0, 0);
  return d.getTime();
}

function useDealDeadline(): number {
  const cfg = useStoreConfig();
  const t = cfg?.saleEndsAt ? new Date(cfg.saleEndsAt).getTime() : NaN;
  return Number.isFinite(t) && t > Date.now() ? t : nextMidnight();
}

/* Refined countdown unit — quiet light tile, mono digits; the digit still
   flips each tick (key remount replays the animation) without the dark,
   slot-machine hinge look. */
function FlipUnit({ v, label }: { v: number; label: string }) {
  const text = String(v).padStart(2, "0");
  return (
    <span className="flex min-w-[46px] flex-col items-center gap-1">
      <span className="block w-full overflow-hidden rounded-lg bg-slate-50 ring-1 ring-slate-200">
        <span
          key={text}
          className="flip-tick font-mono block px-1.5 py-2 text-center text-lg font-bold text-slate-900 tabular-nums leading-none"
        >
          {text}
        </span>
      </span>
      <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-400">{label}</span>
    </span>
  );
}

function CountdownPill() {
  const saleEnd = useSaleEnd();
  const { days, hours, mins, secs } = useCountdown(saleEnd ?? Date.now());
  if (saleEnd === null) return null;
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    <div className="inline-flex items-center gap-2.5 rounded-full bg-slate-900 py-1.5 pl-3.5 pr-4 text-white shadow-sm">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orange-400 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-orange-500" />
      </span>
      <span className="text-xs font-medium text-slate-300">Offer ends in</span>
      <span className="font-mono text-sm font-bold tabular-nums tracking-wide">
        {days > 0 ? `${pad(days)}d ` : ""}{pad(hours)}:{pad(mins)}:{pad(secs)}
      </span>
    </div>
  );
}

/* ---------- 1. Hero ---------- */
// Promotional poster artwork stays fixed behind the live product content.
/* Design defaults (marketing copy + art direction). When Admin → Settings sets
 * `heroSlide1..3` to product IDs, the price, image and link come from the LIVE
 * catalog instead — the homepage can never advertise a stale price or a dead deal. */
const SLIDES = [
  {
    tag: "Everything you need, in one place",
    headline: "Smart accessories for everyday life",
    price: 4999,
    compareAt: 7999,
    image: "/img/hero-store.webp",
    mobileImage: "/img/hero-store-mobile.webp",
    width: 1600,
    height: 893,
    cat: "audio",
  },
];

type Slide = (typeof SLIDES)[number] & { productId?: number };

/** merge admin-configured product IDs into the slide deck */
function useSlides(): Slide[] {
  const cfg = useStoreConfig();
  const { products } = useProducts();
  return useMemo(
    () =>
      SLIDES.map((sl, i) => {
        const key = `heroSlide${i + 1}` as keyof NonNullable<ReturnType<typeof useStoreConfig>>;
        const pid = parseInt((cfg?.[key] as string | null) ?? "", 10);
        const p = products.find((x) => x.id === pid);
        if (!p) return sl;
        return {
          ...sl,
          productId: p.id,
          headline: p.name,
          price: p.price,
          compareAt: p.compareAt ?? sl.compareAt,
          image: p.image,
          cat: p.category,
        };
      }),
    [cfg, products]
  );
}

/* ---------- 1. Hero — clean promotional banner card ---------- */

const HERO_TICKS = ["Free shipping over Rs 5,000", "Cash on delivery nationwide", "7-day easy returns"];

export function HeroSection() {
  const slides = useSlides();
  const [slide, setSlide] = useState(0);
  // only the visible slide (and the one queued next) is worth downloading
  const [loaded, setLoaded] = useState<number[]>([0]);
  useEffect(() => {
    const next = (slide + 1) % slides.length;
    setLoaded((prev) => (prev.includes(slide) && prev.includes(next) ? prev : [...new Set([...prev, slide, next])]));
  }, [slide, slides.length]);
  const { navigate } = useRouter();

  useEffect(() => {
    const t = setInterval(() => setSlide((s) => (s + 1) % slides.length), 6000);
    return () => clearInterval(t);
  }, [slides.length]);

  return (
    <section className="relative w-full overflow-hidden pt-14 md:pt-16">
      <div className="relative min-h-[560px] overflow-hidden sm:min-h-[600px] md:min-h-[640px]">
        {/* ---- background image (crossfades between slides) ---- */}
        {slides.map((sl, i) =>
          loaded.includes(i) ? (
            <div key={i} aria-hidden="true" className={`absolute inset-0 transition-opacity duration-700 ease-out ${i === slide ? "opacity-100" : "opacity-0"}`}>
              <picture>
                <source media="(max-width: 767px)" srcSet={sl.mobileImage} />
                <img
                  src={sl.image}
                  alt=""
                  width={sl.width}
                  height={sl.height}
                  fetchPriority="high"
                  decoding="async"
                  className="h-full w-full object-cover object-[50%_15%] md:object-[82%_center]"
                />
              </picture>
            </div>
          ) : null
        )}

        {/* legibility wash: opaque on the text side (desktop) / bottom (mobile),
            fading to the page canvas so the banner blends edge-to-edge */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#f7f6f1] via-[#f7f6f1]/60 to-transparent md:bg-gradient-to-r md:from-[#f7f6f1] md:via-[#f7f6f1]/75 md:to-transparent" />

        {/* ---- overlaid content ---- */}
        <div className="relative mx-auto flex min-h-[560px] w-full max-w-7xl items-end px-4 pb-12 sm:min-h-[600px] md:min-h-[640px] md:items-center md:px-6 md:pb-0">
          <div className="grid w-full">
            {slides.map((sl, i) => {
              const active = i === slide;
              const discount =
                sl.compareAt && sl.compareAt > sl.price
                  ? Math.round(((sl.compareAt - sl.price) / sl.compareAt) * 100)
                  : 0;
              return (
                <div
                  key={i}
                  aria-hidden={!active}
                  inert={!active ? true : undefined}
                  className={`col-start-1 row-start-1 w-full max-w-xl pb-2 transition-all duration-700 ease-out md:pb-0 ${
                    active ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3 pointer-events-none"
                  }`}
                >
                  {/* eyebrow */}
                  <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/85 px-3.5 py-1.5 shadow-sm ring-1 ring-slate-900/5 backdrop-blur">
                    <span className="h-1.5 w-1.5 rounded-full bg-teal-600" />
                    <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-teal-700">{sl.tag}</span>
                  </p>

                  <h1 className="font-display text-[2.5rem] leading-[1.05] font-bold tracking-tight text-slate-900 sm:text-6xl lg:text-[4.2rem]">
                    {(() => {
                      const words = sl.headline.split(" ");
                      const last = words.pop();
                      return (
                        <>
                          {words.join(" ")}{" "}
                          <span className="whitespace-nowrap text-teal-700">{last}</span>
                        </>
                      );
                    })()}
                  </h1>

                  <p className="mt-4 max-w-md text-base leading-relaxed text-slate-600 md:text-lg">
                    Premium audio, charging, protection and wearables — genuine gear,
                    honest prices, delivered nationwide with cash on delivery.
                  </p>

                  {/* price row */}
                  <div className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="text-sm font-semibold text-slate-500">From</span>
                    <span className="font-mono text-3xl md:text-4xl font-bold tabular-nums text-slate-900">{fmt(sl.price)}</span>
                    {sl.compareAt && sl.compareAt > sl.price && (
                      <span className="text-base font-medium text-slate-400 line-through">{fmt(sl.compareAt)}</span>
                    )}
                    {discount > 0 && (
                      <span className="rounded-full bg-orange-500 px-2.5 py-1 text-xs font-bold text-white shadow-sm">
                        Save {discount}%
                      </span>
                    )}
                  </div>

                  {/* CTAs */}
                  <div className="mt-6 flex flex-wrap items-center gap-3">
                    <button
                      onClick={() => navigate(sl.productId ? `/product/${sl.productId}` : `/category/${sl.cat}`)}
                      tabIndex={active ? 0 : -1}
                      className="btn-primary px-7 py-3.5 text-sm"
                    >
                      Shop the collection
                      <span aria-hidden="true">→</span>
                    </button>
                    <button
                      onClick={() => navigate("/shop")}
                      tabIndex={active ? 0 : -1}
                      className="btn-ghost px-6 py-3.5 text-sm bg-white/85 backdrop-blur"
                    >
                      Browse all deals
                    </button>
                  </div>

                  {/* trust ticks */}
                  <ul className="mt-7 hidden flex-wrap items-center gap-x-6 gap-y-2.5 sm:flex">
                    {HERO_TICKS.map((t) => (
                      <li key={t} className="flex items-center gap-2 text-sm font-medium text-slate-700">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-teal-600 text-white">
                          <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                            <path d="M2.5 6.2 4.8 8.5 9.5 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </span>
                        {t}
                      </li>
                    ))}
                  </ul>

                  {/* countdown */}
                  {active && <div className="mt-6"><CountdownPill /></div>}
                </div>
              );
            })}
          </div>
        </div>

        {/* dots — only meaningful with more than one slide */}
        {slides.length > 1 && (
          <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 gap-2">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => setSlide(i)}
                aria-label={`Slide ${i + 1}`}
                className={`h-2 rounded-full transition-all duration-300 ${
                  i === slide ? "w-7 bg-slate-900" : "w-2 bg-slate-400/70 hover:bg-slate-500"
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

/* ---------- 2. CategoryIcons (compact scrollable image tiles) ---------- */
export function CategoryIcons() {
  const { categories, products } = useProducts();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(0);
  const [pages, setPages] = useState(1);

  // dot pagination state follows the carousel's scroll position
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const update = () => {
      setPages(Math.max(1, Math.ceil(el.scrollWidth / el.clientWidth)));
      setPage(Math.round(el.scrollLeft / el.clientWidth));
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [categories.length]);

  const pageWidth = () => scrollerRef.current?.clientWidth || 320;
  const scrollBy = (dir: number) =>
    scrollerRef.current?.scrollBy({ left: dir * pageWidth(), behavior: "smooth" });
  const scrollToPage = (i: number) =>
    scrollerRef.current?.scrollTo({ left: i * pageWidth(), behavior: "smooth" });

  return (
    <section className="max-w-7xl mx-auto px-6 pt-14 pb-10 md:pt-20">
      <div className="flex items-end justify-between mb-7">
        <div>
          <Kicker>Browse the range</Kicker>
          <h2 className="text-3xl md:text-[2.6rem] font-bold tracking-tight text-slate-900 leading-tight">Shop by category</h2>
        </div>
        <div className="hidden md:flex gap-2.5">
          <button
            onClick={() => scrollBy(-1)}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-slate-600 ring-1 ring-slate-200 shadow-sm transition-all hover:-translate-y-0.5 hover:text-slate-900 hover:shadow-md"
            aria-label="Scroll left"
          >
            <ChevronLeftIcon size={18} />
          </button>
          <button
            onClick={() => scrollBy(1)}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-slate-600 ring-1 ring-slate-200 shadow-sm transition-all hover:-translate-y-0.5 hover:text-slate-900 hover:shadow-md"
            aria-label="Scroll right"
          >
            <ChevronRightIcon size={18} />
          </button>
        </div>
      </div>

      <div
        ref={scrollerRef}
        className="flex gap-4 md:gap-5 overflow-x-auto no-scrollbar snap-x snap-mandatory pb-2 -mx-6 px-6"
      >
        {categories.map((c) => {
          // admin-set tile image wins, then the built-in art, else we render the emoji
          const tile = categoryArt(c);
          return (
            <Link
              key={c.id}
              to={`/category/${c.id}`}
              className="group snap-start shrink-0 w-40 sm:w-48 md:w-[224px] overflow-hidden rounded-2xl bg-white ring-1 ring-slate-900/5 shadow-[0_1px_2px_rgba(16,42,36,0.04),0_10px_28px_-16px_rgba(16,42,36,0.18)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_2px_6px_rgba(16,42,36,0.05),0_22px_44px_-18px_rgba(16,42,36,0.28)]"
            >
              <span className="flex aspect-[4/3] items-center justify-center overflow-hidden bg-gradient-to-b from-slate-50 to-white p-5">
                {tile ? (
                  <img
                    src={tile}
                    alt={c.name}
                    width={440}
                    height={440}
                    loading="lazy"
                    decoding="async"
                    className={`max-h-full w-auto transition-transform duration-500 group-hover:scale-[1.08] ${
                      c.image ? "rounded-lg object-cover w-full h-full" : "object-contain"
                    }`}
                  />
                ) : (
                  <span className="text-5xl transition-transform duration-500 group-hover:scale-110">
                    {categoryGlyph(c)}
                  </span>
                )}
              </span>
              <span className="flex items-center justify-center gap-1.5 border-t border-slate-100 px-4 py-3.5 text-sm md:text-[15px] font-semibold text-slate-900 transition-colors group-hover:text-teal-700">
                {c.name}
                <ChevronRightIcon size={15} className="text-slate-300 transition-all group-hover:translate-x-0.5 group-hover:text-teal-600" />
              </span>
            </Link>
          );
        })}
        {/* view-all — same card language */}
        <Link
          to="/shop"
          className="group snap-start shrink-0 w-40 sm:w-48 md:w-[224px] overflow-hidden rounded-2xl bg-slate-900 shadow-[0_1px_2px_rgba(16,42,36,0.04),0_10px_28px_-16px_rgba(16,42,36,0.18)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_2px_6px_rgba(16,42,36,0.05),0_22px_44px_-18px_rgba(16,42,36,0.28)]"
        >
          <span className="flex aspect-[4/3] items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900">
            <BoltMark size={56} className="text-teal-300/90 transition-transform duration-300 group-hover:scale-110" />
          </span>
          <span className="flex items-center justify-center gap-1.5 px-4 py-3.5 text-sm md:text-[15px] font-semibold text-white">
            View all
            <ChevronRightIcon size={15} className="text-slate-400 transition-all group-hover:translate-x-0.5 group-hover:text-teal-300" />
          </span>
        </Link>
      </div>

      {/* dot pagination */}
      {pages > 1 && (
        <div className="mt-7 flex justify-center gap-2" aria-label="Category pages">
          {Array.from({ length: pages }).map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => scrollToPage(i)}
              aria-label={`Go to category page ${i + 1}`}
              aria-current={i === page}
              className={`h-2 rounded-full transition-all duration-300 ${
                i === page ? "w-7 bg-teal-600" : "w-2 bg-slate-300 hover:bg-slate-400"
              }`}
            />
          ))}
        </div>
      )}
    </section>
  );
}

/* ---------- 3. BestSelling ---------- */
export function BestSelling() {
  const { products, categories } = useProducts();
  const [tab, setTab] = useState("all");
  const [view, setView] = useState<ProductView>("grid");

  const list = useMemo(() => {
    let l = products.filter((p) => p.bestSeller || p.rating >= 4.4);
    if (tab !== "all") l = l.filter((p) => p.category === tab);
    return l.slice(0, 10);
  }, [products, tab]);

  return (
    <section className="max-w-7xl mx-auto px-6 py-10 md:py-14">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-6">
        <div className="shrink-0">
          <Kicker>Customer favourites</Kicker>
          <h2 className="text-3xl md:text-[2.6rem] font-bold tracking-tight text-slate-900 leading-tight">Best sellers</h2>
        </div>
        <div className="flex min-w-0 items-center justify-between gap-3 sm:justify-end sm:flex-1">
          {/* desktop tabs — pill segmented control */}
          <div className="hidden md:flex flex-wrap justify-end gap-1.5 min-w-0 rounded-full bg-slate-100/80 p-1 ring-1 ring-slate-200/70">
            {[{ id: "all", name: "All" }, ...categories].map((c) => (
              <button
                key={c.id}
                onClick={() => setTab(c.id)}
                className={`inline-flex items-center gap-1.5 rounded-full py-1.5 pl-2 pr-4 text-sm font-semibold transition-all ${
                  tab === c.id
                    ? "bg-slate-900 text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                {c.id !== "all" && (
                  <CategoryLogo
                    category={c as Category}
                    size={20}
                    variant="plain"
                    active={tab === c.id}
                  />
                )}
                {c.name}
              </button>
            ))}
          </div>
          {/* mobile dropdown */}
          <select
            value={tab}
            onChange={(e) => setTab(e.target.value)}
            className="md:hidden min-w-0 flex-1 sm:flex-none sm:w-48 rounded-full bg-white px-4 py-2 text-sm outline-none ring-1 ring-slate-200"
          >
            <option value="all">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{categoryGlyph(c)} {c.name}</option>
            ))}
          </select>
          <ViewToggle view={view} onChange={setView} />
        </div>
      </div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-slate-400">
          {list.length > 0 ? "Showing top picks" : "No matching best sellers"}
        </p>
        <Link to="/shop" className="group inline-flex items-center gap-1 text-sm font-semibold text-teal-700 transition-colors hover:text-teal-800">
          View all products
          <span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">→</span>
        </Link>
      </div>
      {list.length === 0 ? (
        <p className="text-sm text-slate-500 py-10 text-center">No matching best sellers.</p>
      ) : (
        <div className={view === "list" ? "grid grid-cols-1 gap-3" : "grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5 md:gap-5"}>
          {list.map((p) => (
            <ProductCard key={p.id} product={p} view={view} />
          ))}
        </div>
      )}
    </section>
  );
}

/* ---------- 4. DealsOfDay (Amaze-style promo tile + deal cards) ---------- */

/* Real social proof for the stock bar: units sold in the last 7 days from
 * actual orders via GET /api/products/:id/stats — the same source the PDP
 * uses. No fabricated percentages. */
function useSoldThisWeek(id: number) {
  const [sold, setSold] = useState<number | null>(null);
  useEffect(() => {
    let alive = true;
    fetch(`/api/products/${id}/stats`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: { soldThisWeek?: number }) => { if (alive) setSold(d.soldThisWeek ?? 0); })
      .catch(() => { if (alive) setSold(0); });
    return () => { alive = false; };
  }, [id]);
  return sold;
}

const DEAL_CHECKS = ["6 Months Warranty", "100% Genuine Products", "Free Shipping over Rs 5,000"];

function DealCard({ id }: { id: number }) {
  const { products } = useProducts();
  const { add } = useCart();
  const { toggle, has } = useWishlist();
  const { navigate } = useRouter();
  const { days, hours, mins, secs } = useCountdown(useDealDeadline());
  const soldThisWeek = useSoldThisWeek(id);
  const [added, setAdded] = useState(false);
  const p = products.find((x) => x.id === id);
  if (!p) return null;

  const hasVariants = (p.variants?.length ?? 0) > 0;
  const soldOut = p.stock <= 0 || (hasVariants && p.variants!.every((v) => v.stock <= 0));
  const discount =
    p.compareAt && p.compareAt > p.price
      ? Math.round(((p.compareAt - p.price) / p.compareAt) * 100)
      : 0;
  const soldPct =
    soldThisWeek && soldThisWeek > 0
      ? Math.min(97, Math.round((soldThisWeek / (soldThisWeek + Math.max(p.stock, 1))) * 100))
      : 0;

  const handleAdd = () => {
    if (soldOut) return;
    // multi-variant products need an explicit choice → PDP
    if (hasVariants) { navigate(`/product/${p.id}`); return; }
    add(p);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1800);
  };

  return (
    <article className="relative grid sm:grid-cols-[1.05fr_1fr] rounded-2xl bg-white ring-1 ring-slate-900/5 shadow-[0_1px_2px_rgba(16,42,36,0.04),0_12px_32px_-18px_rgba(16,42,36,0.22)] transition-shadow duration-300 hover:shadow-[0_2px_6px_rgba(16,42,36,0.05),0_22px_48px_-20px_rgba(16,42,36,0.3)]">
      {/* ---------- left half: big image + identity ---------- */}
      <div className="flex flex-col p-4 md:p-5">
        <Link to={`/product/${p.id}`} className="group relative block">
          <span className="block aspect-[4/3] w-full overflow-hidden rounded-xl bg-slate-50 ring-1 ring-slate-100">
            <img
              src={p.image}
              alt={p.name}
              loading="lazy"
              decoding="async"
              className="w-full h-full object-contain p-2 transition-transform duration-300 group-hover:scale-[1.04]"
            />
          </span>
          {discount > 0 && (
            <span className="absolute left-2.5 top-2.5 rounded-full bg-orange-500 px-2.5 py-1 text-[11px] font-bold text-white shadow-sm">
              -{discount}%
            </span>
          )}
        </Link>

        <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
          {p.category}
        </p>
        <Link to={`/product/${p.id}`}>
          <h3 className="mt-0.5 line-clamp-2 text-sm md:text-[15px] font-semibold leading-snug text-slate-900 transition-colors group-hover:text-teal-700">
            {p.name}
          </h3>
        </Link>

        {p.reviews > 0 && (
          <span className="mt-1.5 flex items-center gap-1.5">
            <Stars rating={p.rating} size="text-sm" />
            <span className="text-[10px] font-medium text-slate-400">({p.reviews.toLocaleString("en-PK")})</span>
          </span>
        )}

        <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="font-mono text-2xl font-bold tabular-nums text-slate-900">{fmt(p.price)}</span>
          {p.compareAt && p.compareAt > p.price && (
            <span className="text-xs text-slate-400 line-through">{fmt(p.compareAt)}</span>
          )}
        </div>
      </div>

      {/* ---------- right half: offer details ---------- */}
      <div className="flex flex-col justify-between gap-3 border-t border-slate-100 p-4 sm:border-l sm:border-t-0 md:p-5">
        <p className={`flex items-center gap-2 text-xs font-semibold ${soldOut ? "text-slate-500" : "text-teal-700"}`}>
          <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${soldOut ? "bg-slate-100 text-slate-400" : "bg-teal-50 ring-1 ring-teal-100"}`} aria-hidden="true">
            {soldOut ? "×" : "✓"}
          </span>
          {soldOut ? "Out of stock" : `${p.stock} in stock`}
        </p>

        <ul className="space-y-1.5">
          {DEAL_CHECKS.map((c) => (
            <li key={c} className="flex items-center gap-2 text-[11px] md:text-xs font-medium text-slate-600">
              <svg width="13" height="13" viewBox="0 0 12 12" fill="none" aria-hidden="true" className="shrink-0 text-teal-600">
                <path d="M2.5 6.2 4.8 8.5 9.5 3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {c}
            </li>
          ))}
        </ul>

        {!soldOut && (
          <div className="flex gap-1.5" aria-label="Deal ends soon">
            <FlipUnit v={days} label="Days" />
            <FlipUnit v={hours} label="Hours" />
            <FlipUnit v={mins} label="Mins" />
            <FlipUnit v={secs} label="Secs" />
          </div>
        )}

        {!soldOut && (
          <div>
            {soldPct > 0 ? (
              <>
                <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-teal-500 to-teal-600 transition-[width] duration-700"
                    style={{ width: `${soldPct}%` }}
                  />
                </div>
                <p className="mt-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  {soldPct}% sold — {p.stock} left
                </p>
              </>
            ) : (
              <p className="inline-flex items-center gap-1.5 rounded-full bg-orange-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-orange-600 ring-1 ring-orange-100">
                Fresh deal — just dropped
              </p>
            )}
          </div>
        )}

        {/* CTA pinned to bottom */}
        <div className="pt-0.5">
          <button
            type="button"
            onClick={handleAdd}
            disabled={soldOut}
            className={`flex w-full items-center justify-center rounded-full py-3 text-sm font-semibold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 ${
              soldOut
                ? "cursor-not-allowed bg-slate-100 text-slate-400"
                : added
                ? "bg-teal-600 text-white"
                : "bg-slate-900 text-white hover:-translate-y-0.5 hover:bg-slate-800 hover:shadow-lg hover:shadow-slate-900/25"
            }`}
          >
            {soldOut ? "Sold out" : added ? "Added ✓" : hasVariants ? "Choose options" : `Add to cart · ${fmt(p.price)}`}
          </button>

          <div className="mt-2.5 flex items-center gap-5">
            <Link
              to={`/product/${p.id}`}
              className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 transition-colors hover:text-teal-700"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                <path d="M1 8s2.7-5 7-5 7 5 7 5-2.7 5-7 5-7-5-7-5Z" />
                <circle cx="8" cy="8" r="2" />
              </svg>
              Quick view
            </Link>
            <button
              type="button"
              onClick={() => toggle(p.id)}
              aria-pressed={has(p.id)}
              className={`flex items-center gap-1.5 text-[11px] font-semibold transition-colors ${
                has(p.id) ? "text-orange-600" : "text-slate-500 hover:text-orange-600"
              }`}
            >
              <span className="text-sm leading-none" aria-hidden="true">{has(p.id) ? "♥" : "♡"}</span>
              Wishlist
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

export function DealsOfDay() {
  const { navigate } = useRouter();
  // deal products come from Admin → Settings (`dealOfDay1/2`), defaulting to
  // the original picks until configured — never hardcoded stale IDs
  const cfg = useStoreConfig();
  const dealIds = [
    parseInt(cfg?.dealOfDay1 ?? "", 10) || 1,
    parseInt(cfg?.dealOfDay2 ?? "", 10) || 3,
  ];
  const { hours, mins, secs } = useCountdown(useDealDeadline());
  const pad2 = (n: number) => String(n).padStart(2, "0");

  return (
    <section className="max-w-7xl mx-auto px-6 py-10 md:py-14">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-7">
        <div>
          <Kicker>Limited-stock offers</Kicker>
          <h2 className="text-3xl md:text-[2.6rem] font-bold tracking-tight leading-tight text-slate-900">
            Deals <span className="text-teal-700">of the day</span>
          </h2>
        </div>
        <div className="flex items-center gap-4">
          <span className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-sm">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orange-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-orange-500" />
            </span>
            <span className="text-slate-300">Ends in</span>
            <span className="font-mono font-bold tabular-nums text-orange-300">{pad2(hours)}:{pad2(mins)}:{pad2(secs)}</span>
          </span>
          <Link to="/shop" className="group hidden sm:inline-flex items-center gap-1 text-sm font-semibold text-teal-700 hover:text-teal-800">
            See more
            <span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">→</span>
          </Link>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)_minmax(0,1fr)] md:gap-5">
        {/* promo poster tile */}
        <div className="relative overflow-hidden rounded-2xl bg-slate-950 p-6 flex flex-col justify-between text-white min-h-[260px]">
          <div aria-hidden="true" className="xp-pattern absolute inset-0 opacity-60" />
          <div className="absolute -right-12 -top-12 h-44 w-44 rounded-full bg-teal-500/25 blur-3xl" aria-hidden="true" />
          <div className="absolute -left-10 bottom-6 h-36 w-36 rounded-full bg-amber-400/15 blur-3xl" aria-hidden="true" />
          <BoltMark size={220} className="pointer-events-none absolute -bottom-14 -right-12 text-white/[0.07]" />
          <div className="relative">
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-teal-300">End of season</p>
            <p className="mt-3 font-display text-5xl font-bold leading-[0.98] tracking-tight text-white">
              Mega<br />deals
            </p>
            <span className="mt-4 inline-flex rounded-full bg-white px-3 py-1.5 text-xs font-bold text-slate-900 shadow">
              Up to 40% off
            </span>
          </div>
          <button
            type="button"
            onClick={() => navigate("/shop")}
            className="relative self-start mt-6 inline-flex items-center gap-1.5 rounded-full bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-500"
          >
            View all offers
            <span aria-hidden="true">→</span>
          </button>
        </div>

        <DealCard id={dealIds[0]} />
        <DealCard id={dealIds[1]} />
      </div>
    </section>
  );
}
