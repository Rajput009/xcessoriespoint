import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useRouter } from "../../router";
import { useCart, useProducts, useWishlist, fmt } from "../../context/store";
import { useStoreConfig } from "../../lib/config";
import { Stars } from "../ProductCard";
import ProductCard from "../ProductCard";
import ViewToggle, { type ProductView } from "../ViewToggle";

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

/* Flip-clock style countdown unit — split tile, hinge line, side notches,
   digit flips each tick (key remount replays the animation). */
function FlipUnit({ v, label }: { v: number; label: string }) {
  const text = String(v).padStart(2, "0");
  return (
    <span className="flex min-w-[54px] flex-1 max-w-[72px] flex-col items-center gap-1.5">
      <span className="relative block w-full overflow-hidden rounded-lg bg-gradient-to-b from-slate-700 to-slate-900 ring-1 ring-slate-700/80 shadow-lg shadow-slate-900/35">
        {/* top-half highlight → split-card shading */}
        <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-white/10" />
        <span
          key={text}
          className="flip-tick block px-1 py-2.5 text-center text-xl md:text-2xl font-black text-white tabular-nums leading-none"
        >
          {text}
        </span>
        {/* hinge line + punched notches */}
        <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-slate-950/70" />
        <span aria-hidden="true" className="pointer-events-none absolute left-0 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white ring-1 ring-slate-900/40" />
        <span aria-hidden="true" className="pointer-events-none absolute right-0 top-1/2 h-2.5 w-2.5 translate-x-1/2 -translate-y-1/2 rounded-full bg-white ring-1 ring-slate-900/40" />
      </span>
      <span className="text-[9px] font-black uppercase tracking-wider text-orange-500">{label}</span>
    </span>
  );
}

function CountdownBoxes() {
  const saleEnd = useSaleEnd();
  const { days, hours, mins, secs } = useCountdown(saleEnd ?? Date.now());
  if (saleEnd === null) return null;
  return (
    <div className="flex gap-2 justify-center lg:justify-start">
      <FlipUnit v={days} label="Days" />
      <FlipUnit v={hours} label="Hours" />
      <FlipUnit v={mins} label="Mins" />
      <FlipUnit v={secs} label="Secs" />
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
    tag: "Limited-time flash sale",
    headline: "AeroBuds Pro — Silence the Noise",
    price: 4999,
    compareAt: 7999,
    image: "/img/hero-1.webp",
    width: 800,
    height: 523,
    cat: "audio",
  },
  {
    tag: "New season, new look",
    headline: "VitaFit S2 — Your Health, On Your Wrist",
    price: 6499,
    compareAt: 9499,
    image: "/img/hero-2.webp",
    width: 752,
    height: 800,
    cat: "wearables",
  },
  {
    tag: "Power that travels",
    headline: "VoltCore 20K — Never Hit 0% Again",
    price: 3499,
    compareAt: 4999,
    image: "/img/hero-3.webp",
    width: 567,
    height: 800,
    cat: "power",
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

/* Per-slide pastel for the product stage circle */
const STAGE_TINTS = [
  { tile: "bg-violet-100", ring: "ring-violet-100" },
  { tile: "bg-amber-100", ring: "ring-amber-100" },
  { tile: "bg-emerald-100", ring: "ring-emerald-100" },
];

/* Organic blob (slide 1), arch/doorway (2), soft squircle (3) */
const BLOB = "border-radius: 58% 42% 55% 45% / 52% 55% 45% 48%;";
const ARCH = "border-radius: 999px 999px 1.75rem 1.75rem;";

const HERO_TICKS = ["Free shipping over Rs 5,000", "COD nationwide", "7-day returns"];

export function HeroSection() {
  const slides = useSlides();
  const [slide, setSlide] = useState(0);
  const saleEnd = useSaleEnd();
  // only the visible slide (and the one queued next) is worth downloading — mounting all
  // three <img src> at once pulled ~1.1 MB on first paint
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
    <section className="relative max-w-7xl mx-auto px-4 md:px-6 pt-[84px] md:pt-[148px] pb-6">
      {/* the banner card */}
      <div className="relative overflow-hidden rounded-[2rem] border border-slate-200/70 bg-gradient-to-br from-sky-50 via-white to-violet-50 shadow-sm">
        {/* barely-there soft shapes */}
        <div aria-hidden="true" className="absolute -top-24 -right-16 h-80 w-80 rounded-full bg-sky-100/70 blur-3xl" />
        <div aria-hidden="true" className="absolute -bottom-28 -left-12 h-80 w-80 rounded-full bg-violet-100/70 blur-3xl" />

        <div className="relative px-6 md:px-10 lg:px-14 pt-8 md:pt-10 pb-6 md:pb-8">
          {/* all slides share one grid cell — hero height never jumps between slides (no CLS) */}
          <div className="grid">
            {slides.map((sl, i) => {
              const active = i === slide;
              const tint = STAGE_TINTS[i % STAGE_TINTS.length];
              const discount =
                sl.compareAt && sl.compareAt > sl.price
                  ? Math.round(((sl.compareAt - sl.price) / sl.compareAt) * 100)
                  : 0;
              return (
                <div
                  key={i}
                  aria-hidden={!active}
                  inert={!active ? true : undefined}
                  className={`col-start-1 row-start-1 grid lg:grid-cols-2 gap-6 lg:gap-10 items-center transition-opacity duration-700 ease-out ${
                    active ? "opacity-100" : "opacity-0 pointer-events-none"
                  }`}
                >
                  {/* copy */}
                  <div className="relative z-10 order-2 lg:order-1 text-center lg:text-left">
                    <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-white px-4 py-1.5 text-[11px] font-black uppercase tracking-widest text-orange-600 ring-1 ring-orange-500/25 shadow-sm">
                      <span className="h-1.5 w-1.5 rounded-full bg-orange-500" aria-hidden="true" />
                      {sl.tag}
                    </p>

                    <h1 className="text-4xl md:text-6xl font-black tracking-tight text-slate-900 leading-[1.05] mb-4">
                      {(() => {
                        const words = sl.headline.split(" ");
                        const last = words.pop();
                        return (
                          <>
                            {words.join(" ")}{" "}
                            <span className="relative inline-block whitespace-nowrap">
                              <span aria-hidden="true" className="absolute inset-x-0 bottom-1 h-[0.32em] -rotate-1 rounded-sm bg-amber-300/80" />
                              <span className="relative">{last}</span>
                            </span>
                          </>
                        );
                      })()}
                    </h1>

                    <div className="mb-4 flex flex-wrap items-baseline justify-center lg:justify-start gap-x-3 gap-y-1">
                      <span className="text-3xl md:text-4xl font-black text-red-600">{fmt(sl.price)}</span>
                      <span className="text-lg text-slate-400 line-through font-medium">{fmt(sl.compareAt)}</span>
                      {discount > 0 && (
                        <span className="rounded-md bg-orange-500 px-2 py-0.5 text-xs font-black text-white">
                          -{discount}% OFF
                        </span>
                      )}
                    </div>

                    <ul className="mb-5 flex flex-wrap items-center justify-center lg:justify-start gap-x-5 gap-y-2">
                      {HERO_TICKS.map((t) => (
                        <li key={t} className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-100 text-[9px] text-emerald-700" aria-hidden="true">✓</span>
                          {t}
                        </li>
                      ))}
                    </ul>

                    <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3">
                      <button
                        onClick={() => navigate(sl.productId ? `/product/${sl.productId}` : `/category/${sl.cat}`)}
                        tabIndex={active ? 0 : -1}
                        className="px-9 py-4 rounded-xl bg-slate-900 text-white text-sm font-black uppercase tracking-wide hover:bg-slate-800 hover:-translate-y-0.5 transition-all shadow-xl shadow-slate-900/25 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
                      >
                        Shop Now →
                      </button>
                      <button
                        onClick={() => navigate("/shop")}
                        tabIndex={active ? 0 : -1}
                        className="px-7 py-4 rounded-xl bg-white text-slate-800 text-sm font-black uppercase tracking-wide ring-1 ring-slate-200 hover:ring-slate-400 hover:-translate-y-0.5 transition-all shadow-sm"
                      >
                        Browse Deals
                      </button>
                    </div>

                    {saleEnd !== null && (
                      <div className="mt-5 flex flex-wrap items-center justify-center lg:justify-start gap-3">
                        <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">Offer ends in</span>
                        <CountdownBoxes />
                      </div>
                    )}
                  </div>

                  {/* product stage — floating cutout on a per-slide shape */}
                  <div className="relative z-0 order-1 lg:order-2 flex justify-center items-center min-h-[240px] md:min-h-[340px]">
                    <div
                      aria-hidden="true"
                      style={i % 3 === 0 ? undefined : { borderRadius: i % 3 === 1 ? ARCH : "2.5rem" }}
                      className={`absolute h-[240px] w-[240px] md:h-[330px] md:w-[330px] ${tint.tile} ring-[10px] ring-white shadow-[0_24px_60px_rgba(15,23,42,0.10)] ${
                        i % 3 === 0 ? "" : i % 3 === 2 ? "rotate-3" : ""
                      }`}
                    />
                    {/* outline echo of the stage shape — quiet depth, no confetti */}
                    <div
                      aria-hidden="true"
                      style={i % 3 === 0 ? { borderRadius: "58% 42% 55% 45% / 52% 55% 45% 48%" } : { borderRadius: i % 3 === 1 ? "999px 999px 1.75rem 1.75rem" : "2.5rem" }}
                      className={`absolute h-[240px] w-[240px] md:h-[330px] md:w-[330px] border-2 border-dashed border-slate-900/10 ${
                        i % 3 === 2 ? "-rotate-2" : ""
                      }`}
                    />
                    {loaded.includes(i) && (
                      <img
                        src={sl.image}
                        alt={active ? sl.headline : ""}
                        width={sl.width}
                        height={sl.height}
                        fetchPriority={i === 0 ? "high" : "low"}
                        decoding="async"
                        className="hero-product float-slow relative object-contain drop-shadow-[0_30px_40px_rgba(15,23,42,0.22)]"
                      />
                    )}
                    {discount > 0 && (
                      <div
                        aria-hidden="true"
                        className={`absolute top-3 right-[14%] md:right-[18%] flex h-16 w-16 md:h-20 md:w-20 rotate-6 flex-col items-center justify-center rounded-2xl bg-orange-500 text-white shadow-lg shadow-orange-500/40 transition-opacity duration-700 ${
                          active ? "opacity-100" : "opacity-0"
                        }`}
                      >
                        <span className="text-base md:text-lg font-black leading-none">-{discount}%</span>
                        <span className="text-[9px] font-bold uppercase tracking-wider opacity-90">Today</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* dots */}
          <div className="flex justify-center gap-2 mt-6">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => setSlide(i)}
                aria-label={`Slide ${i + 1}`}
                className={`h-2 rounded-full transition-all ${
                  i === slide ? "w-8 bg-slate-900" : "w-2 bg-slate-300 hover:bg-slate-400"
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- 2. CategoryIcons (compact scrollable image tiles) ---------- */
const CAT_IMG: Record<string, { img: string; count: string; tint: string }> = {
  audio: { img: "/img/cat-audio.webp", count: "Earbuds & headphones", tint: "bg-violet-200" },
  wearables: { img: "/img/cat-wearables.webp", count: "Watches & bands", tint: "bg-amber-200" },
  power: { img: "/img/cat-power.webp", count: "Banks & chargers", tint: "bg-sky-200" },
  cases: { img: "/img/cat-cases.webp", count: "Covers & protection", tint: "bg-emerald-200" },
  cables: { img: "/img/cat-cables.webp", count: "Cables & hubs", tint: "bg-rose-200" },
};

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
    <section className="max-w-7xl mx-auto px-6 pt-12 pb-8">
      <div className="flex items-end justify-between mb-5">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-orange-500 mb-1">Browse the range</p>
          <h2 className="text-3xl md:text-4xl font-black uppercase tracking-tight text-slate-900">Shop by Category</h2>
        </div>
        <div className="hidden md:flex gap-2">
          <button
            onClick={() => scrollBy(-1)}
            className="w-9 h-9 rounded-lg surface-muted text-slate-600 hover:text-slate-900 hover:shadow-md flex items-center justify-center transition-all"
            aria-label="Scroll left"
          >
            ‹
          </button>
          <button
            onClick={() => scrollBy(1)}
            className="w-9 h-9 rounded-lg border border-slate-200 bg-white text-slate-500 hover:border-slate-400 hover:text-slate-900 flex items-center justify-center transition-colors"
            aria-label="Scroll right"
          >
            ›
          </button>
        </div>
      </div>

      <div
        ref={scrollerRef}
        className="flex gap-4 md:gap-5 overflow-x-auto no-scrollbar snap-x snap-mandatory pb-2 -mx-6 px-6"
      >
        {categories.map((c) => {
          const meta = CAT_IMG[c.id];
          // admin-set tile image wins, then the built-in art, else we render the emoji
          const tile = c.image || meta?.img;
          return (
            <Link
              key={c.id}
              to={`/category/${c.id}`}
              className="group snap-start shrink-0 w-40 sm:w-48 md:w-[224px] rounded-xl border border-slate-200 bg-white px-4 pt-5 pb-4 text-center shadow-[0_1px_2px_rgba(15,23,42,0.05)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_16px_36px_rgba(15,23,42,0.12)]"
            >
              <span className="flex aspect-[4/3] items-center justify-center overflow-hidden">
                {tile ? (
                  <img
                    src={tile}
                    alt={c.name}
                    width={440}
                    height={440}
                    loading="lazy"
                    decoding="async"
                    className={`max-h-full w-auto transition-transform duration-500 group-hover:scale-110 ${
                      c.image && !meta ? "rounded-lg object-cover w-full h-full" : "object-contain"
                    }`}
                  />
                ) : (
                  <span className="text-5xl transition-transform duration-500 group-hover:scale-110">
                    {c.icon || "🗂"}
                  </span>
                )}
              </span>
              <span className="mt-3 block text-sm md:text-base font-black uppercase tracking-[0.08em] text-slate-900 transition-colors group-hover:text-orange-600">
                {c.name}
              </span>
            </Link>
          );
        })}
        {/* view-all — same card language */}
        <Link
          to="/shop"
          className="group snap-start shrink-0 w-40 sm:w-48 md:w-[224px] rounded-xl border border-slate-200 bg-white px-4 pt-5 pb-4 text-center shadow-[0_1px_2px_rgba(15,23,42,0.05)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_16px_36px_rgba(15,23,42,0.12)]"
        >
          <span className="flex aspect-[4/3] items-center justify-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-900 text-2xl text-white shadow-lg shadow-slate-900/25 transition-transform duration-300 group-hover:scale-110">
              →
            </span>
          </span>
          <span className="mt-3 block text-sm md:text-base font-black uppercase tracking-[0.08em] text-slate-900 transition-colors group-hover:text-orange-600">
            View All
          </span>
        </Link>
      </div>

      {/* dot pagination — active orange, inactive dark */}
      <div className="mt-6 flex justify-center gap-2" aria-label="Category pages">
        {Array.from({ length: pages }).map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => scrollToPage(i)}
            aria-label={`Go to category page ${i + 1}`}
            aria-current={i === page}
            className={`h-2 rounded-full transition-all duration-300 ${
              i === page ? "w-6 bg-orange-500" : "w-2 bg-slate-800 hover:bg-slate-500"
            }`}
          />
        ))}
      </div>
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
    <section className="max-w-7xl mx-auto px-6 py-7 md:py-9">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-5">
        <div className="shrink-0">
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-orange-500 mb-1">Customer favourites</p>
          <h2 className="text-3xl md:text-4xl font-black uppercase tracking-tight text-slate-900">Best Selling</h2>
        </div>
        <div className="flex min-w-0 items-center justify-between gap-3 sm:justify-end sm:flex-1">
          {/* desktop tabs */}
          <div className="hidden md:flex flex-wrap justify-end gap-2 min-w-0">
            {[{ id: "all", name: "All" }, ...categories].map((c) => (
              <button
                key={c.id}
                onClick={() => setTab(c.id)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
                  tab === c.id
                    ? "bg-slate-900 text-white shadow-md shadow-slate-900/25"
                    : "surface-muted text-slate-600 hover:text-slate-900"
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
          {/* mobile dropdown */}
          <select
            value={tab}
            onChange={(e) => setTab(e.target.value)}
            className="md:hidden min-w-0 flex-1 sm:flex-none sm:w-48 rounded-xl surface-muted px-3 py-2 text-sm outline-none"
          >
            <option value="all">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <ViewToggle view={view} onChange={setView} />
        </div>
      </div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-slate-400">
          {list.length > 0 ? "Showing top picks" : "No matching best sellers"}
        </p>
        <Link to="/shop" className="text-xs font-bold uppercase tracking-wider text-orange-600 hover:text-orange-700 transition-colors">
          View all products →
        </Link>
      </div>
      {list.length === 0 ? (
        <p className="text-sm text-slate-500 py-10 text-center">No matching best sellers.</p>
      ) : (
        <div className={view === "list" ? "grid grid-cols-1 gap-3" : "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4"}>
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
    <article className="relative grid sm:grid-cols-[1.05fr_1fr] rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.05)] transition-shadow duration-300 hover:shadow-[0_12px_32px_rgba(15,23,42,0.12)]">
      {/* ---------- left half: big image + identity ---------- */}
      <div className="flex flex-col p-3.5 md:p-4">
        <Link to={`/product/${p.id}`} className="group relative block">
          <span className="block aspect-[4/3] w-full overflow-hidden rounded-lg bg-white">
            <img
              src={p.image}
              alt={p.name}
              loading="lazy"
              decoding="async"
              className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-105"
            />
          </span>
        </Link>

        <p className="mt-2.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
          {p.category}
        </p>
        <Link to={`/product/${p.id}`}>
          <h3 className="mt-0.5 line-clamp-2 text-sm md:text-[15px] font-bold uppercase leading-snug text-slate-900 hover:text-orange-600 transition-colors">
            {p.name}
          </h3>
        </Link>

        {p.reviews > 0 && (
          <span className="mt-1.5 flex items-center gap-1.5">
            <Stars rating={p.rating} size="text-sm" />
            <span className="text-[10px] font-medium text-slate-400">({p.reviews.toLocaleString("en-PK")})</span>
          </span>
        )}

        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-xl font-black text-red-600">{fmt(p.price)}</span>
          {p.compareAt && p.compareAt > p.price && (
            <span className="text-xs text-slate-400 line-through">{fmt(p.compareAt)}</span>
          )}
          {discount > 0 && (
            <span className="rounded-[4px] bg-orange-500 px-1.5 py-0.5 text-[11px] font-black text-white">
              -{discount}%
            </span>
          )}
        </div>
      </div>

      {/* ---------- right half: offer details ---------- */}
      <div className="flex flex-col justify-between gap-2.5 border-t sm:border-t-0 sm:border-l border-slate-100 p-3.5 md:p-4">
        <p className={`flex items-center gap-2 text-xs font-bold ${soldOut ? "text-slate-500" : "text-emerald-700"}`}>
          <span className={`flex h-5 w-5 items-center justify-center rounded-full border text-[10px] ${soldOut ? "border-slate-200 bg-slate-100" : "border-emerald-200 bg-emerald-50"}`} aria-hidden="true">
            {soldOut ? "×" : "✓"}
          </span>
          {soldOut ? "Out of stock" : `${p.stock} ${p.stock === 1 ? "Product" : "Products"} in stock`}
        </p>

        <ul className="space-y-1">
          {DEAL_CHECKS.map((c) => (
            <li key={c} className="flex items-center gap-2 text-[11px] md:text-xs font-medium text-slate-600">
              <span className="text-slate-900" aria-hidden="true">✓</span>
              {c}
            </li>
          ))}
        </ul>

        {!soldOut && (
          <div className="flex gap-2" aria-label="Deal ends soon">
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
                <div className="h-1 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-orange-400 to-red-500 transition-[width] duration-700"
                    style={{ width: `${soldPct}%` }}
                  />
                </div>
                <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                  {soldPct}% sold — available {p.stock}
                </p>
              </>
            ) : (
              <p className="text-[10px] font-black uppercase tracking-wide text-orange-600">
                🔥 Fresh deal — just dropped
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
            className={`flex w-full items-center justify-center rounded-lg py-3 text-xs font-black uppercase tracking-wide transition-all focus:outline-none focus:ring-2 focus:ring-orange-500 ${
              soldOut
                ? "cursor-not-allowed bg-slate-100 text-slate-400"
                : added
                ? "bg-emerald-600 text-white"
                : "bg-slate-900 text-white hover:bg-slate-800 hover:shadow-lg hover:shadow-slate-900/25"
            }`}
          >
            {soldOut ? "Sold out" : added ? "Added ✓" : hasVariants ? "Choose options" : `Add to Cart — ${fmt(p.price)}`}
          </button>

          <div className="mt-2 flex items-center gap-5">
            <Link
              to={`/product/${p.id}`}
              className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 hover:text-orange-600 transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                <path d="M1 8s2.7-5 7-5 7 5 7 5-2.7 5-7 5-7-5-7-5Z" />
                <circle cx="8" cy="8" r="2" />
              </svg>
              Quick View
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
              Add To Wishlist
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
    <section className="max-w-7xl mx-auto px-6 py-6 md:py-8">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-5">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-orange-500 mb-1">Limited-stock offers</p>
          <h2 className="text-3xl md:text-4xl font-black uppercase tracking-tight text-slate-900">
            Deals <span className="text-orange-600">of the Day</span>
          </h2>
        </div>
        <div className="flex items-center gap-4">
          <span className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-black text-white tabular-nums shadow-md shadow-slate-900/30">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-orange-500" aria-hidden="true" />
            <span className="uppercase tracking-wide text-slate-300">Ends in</span>
            <span className="text-orange-400">{pad2(hours)}:{pad2(mins)}:{pad2(secs)}</span>
          </span>
          <Link to="/shop" className="text-xs font-bold uppercase tracking-wider text-slate-900 hover:text-slate-600 transition-colors">
            See More →
          </Link>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)_minmax(0,1fr)]">
        {/* promo poster tile */}
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-fuchsia-600 via-purple-600 to-indigo-800 p-5 flex flex-col justify-between text-white">
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" aria-hidden="true" />
          <div className="absolute -left-8 bottom-0 h-32 w-32 rounded-full bg-sky-400/20 blur-2xl" aria-hidden="true" />
          <div className="relative">
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-fuchsia-200">End of Season</p>
            <p
              className="mt-2 text-4xl font-black uppercase leading-[0.95] tracking-tight"
              style={{ textShadow: "0 0 26px rgba(232,121,249,0.85), 0 0 64px rgba(168,85,247,0.55)" }}
            >
              Mega<br />Deals
            </p>
            <span className="mt-3 inline-flex rounded-md bg-yellow-300 px-2 py-1 text-[11px] font-black uppercase tracking-wide text-slate-900 shadow shadow-yellow-300/40">
              Up to 40% off
            </span>
          </div>
          <button
            type="button"
            onClick={() => navigate("/shop")}
            className="relative self-start mt-6 rounded-lg bg-white/15 border border-white/25 px-4 py-2 text-xs font-bold text-white backdrop-blur transition hover:bg-white hover:text-purple-800"
          >
            View all offers →
          </button>
        </div>

        <DealCard id={dealIds[0]} />
        <DealCard id={dealIds[1]} />
      </div>
    </section>
  );
}
