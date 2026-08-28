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

function CountdownBoxes() {
  const saleEnd = useSaleEnd();
  const { days, hours, mins, secs } = useCountdown(saleEnd ?? Date.now());
  if (saleEnd === null) return null;
  const box =
    "bg-black/25 border border-white/20 rounded-xl px-2.5 py-1.5 min-w-[54px] text-center shadow-md shadow-black/20";
  const items = [
    [days, "Days"], [hours, "Hours"], [mins, "Mins"], [secs, "Secs"],
  ] as const;
  return (
    <div className="flex gap-2 justify-center lg:justify-start">
      {items.map(([v, l]) => (
          <div key={l} className={box}>
          <div className="text-lg font-black text-white tabular-nums">{String(v).padStart(2, "0")}</div>
          <div className="text-[11px] uppercase tracking-wide text-white/80">{l}</div>
        </div>
      ))}
    </div>
  );
}

/* ---------- 1. Hero ---------- */
// Promotional poster artwork stays fixed behind the live product content.
// Brand-matched poster artwork: blue, indigo, slate and soft sky only.
const HERO_BACKGROUND = "/img/hero-electric-blue.webp?v=1";

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

export function HeroSection() {
  const slides = useSlides();
  const [slide, setSlide] = useState(0);
  const heroFreeShipping = 5000;
  // only the visible slide (and the one queued next) is worth downloading — mounting all
  // three <img src> at once pulled ~1.1 MB on first paint
  const [loaded, setLoaded] = useState<number[]>([0]);
  useEffect(() => {
    const next = (slide + 1) % slides.length;
    setLoaded((prev) => (prev.includes(slide) && prev.includes(next) ? prev : [...new Set([...prev, slide, next])]));
  }, [slide, slides.length]);
  const { navigate } = useRouter();
  const { products } = useProducts();

  useEffect(() => {
    const t = setInterval(() => setSlide((s) => (s + 1) % slides.length), 6000);
    return () => clearInterval(t);
  }, [slides.length]);

  const featured = products.filter((p) => [2, 6, 3].includes(p.id)).slice(0, 3);

  return (
    <section className="relative">
      {/* Promotional poster stays fixed while live products and copy sit above it. */}
      <div className="absolute inset-0 overflow-hidden bg-slate-950">
        <img
          src={HERO_BACKGROUND}
          alt=""
          aria-hidden="true"
          width="1376"
          height="768"
          fetchPriority="high"
          decoding="async"
          className="absolute inset-0 w-full h-full object-cover"
        />
        {/* a light scrim keeps the poster texture visible while protecting text contrast */}
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/20 via-transparent to-slate-950/10" />
      </div>

      <div className="relative max-w-7xl mx-auto px-6 pt-20 md:pt-[130px] pb-4">
        {/* All slides live in the SAME grid cell and are only faded in/out. The hero is
            therefore always as tall as its tallest slide, so switching slides can never
            reflow the page below it (no layout shift / CLS). */}
        <div className="grid">
          {slides.map((sl, i) => {
            const active = i === slide;
            return (
              <div
                key={i}
                aria-hidden={!active}
                inert={!active ? true : undefined}
                className={`col-start-1 row-start-1 grid lg:grid-cols-2 gap-8 items-center transition-opacity duration-700 ease-out ${
                  active ? "opacity-100" : "opacity-0 pointer-events-none"
                }`}
              >
                {/* text */}
                <div className="relative z-10 text-center lg:text-left order-2 lg:order-1">
                  <p className="text-xs font-bold uppercase tracking-widest text-sky-300 mb-4">
                    {sl.tag}
                  </p>
                  <h1 className="text-2xl md:text-4xl font-black text-white leading-tight mb-4 drop-shadow-[0_3px_18px_rgba(0,0,0,0.45)]">
                    {sl.headline}
                  </h1>
                  <p className="text-2xl font-bold text-white mb-5 drop-shadow-[0_2px_8px_rgba(0,0,0,0.35)]">
                    {fmt(sl.price)}{" "}
                    <span className="text-base text-white/75 line-through font-medium">{fmt(sl.compareAt)}</span>
                  </p>
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-sky-300/90 mb-4">
                    Free shipping over {fmt(heroFreeShipping)} · COD nationwide
                  </p>
                  <div className="mb-6">
                    <CountdownBoxes />
                  </div>
                  <button
                    onClick={() => navigate(sl.productId ? `/product/${sl.productId}` : `/category/${sl.cat}`)}
                    tabIndex={active ? 0 : -1}
                    className="px-8 py-3.5 rounded-lg bg-white text-slate-900 font-bold hover:bg-sky-300 hover:text-slate-950 transition-colors shadow-xl shadow-black/25"
                  >
                    Shop Now →
                  </button>
                </div>
                {/* floating cutout product — fixed-height box so differently shaped
                    cutouts (and slow image loads) can't resize the hero */}
                <div className="relative z-0 order-1 lg:order-2 flex justify-center items-center h-[260px] md:h-[360px]">
                  {loaded.includes(i) && (
                    <img
                      src={sl.image}
                      alt={active ? sl.headline : ""}
                      width={sl.width}
                      height={sl.height}
                      fetchPriority={i === 0 ? "high" : "low"}
                      decoding="async"
                      className="hero-product float-slow object-contain drop-shadow-[0_35px_45px_rgba(30,64,175,0.45)]"
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* dots */}
        <div className="flex justify-center gap-2 mt-8">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setSlide(i)}
              aria-label={`Slide ${i + 1}`}
              className={`h-2 rounded-md transition-all ${
                i === slide ? "w-8 bg-sky-300" : "w-2 bg-white/50 hover:bg-white/80"
              }`}
            />
          ))}
        </div>

        {/* featured surface cards — sit inside the hero below the carousel */}
        <div className="mt-0 mb-0 relative z-10 flex lg:grid lg:grid-cols-3 gap-4 overflow-x-auto no-scrollbar snap-x pb-2">
          {featured.map((p) => (
            <button
              key={p.id}
              onClick={() => navigate(`/product/${p.id}`)}
              className="snap-start shrink-0 w-72 lg:w-auto bg-white/85 backdrop-blur rounded-lg py-2 pl-2 pr-5 flex items-center gap-3 hover:bg-white hover:-translate-y-0.5 transition text-left"
            >
              <img src={p.image} alt="" className="w-14 h-14 rounded-lg object-cover" />
              <div className="min-w-0">
                <Stars rating={p.rating} size="text-xs" />
                <p className="text-sm font-bold text-slate-900 truncate">{p.name}</p>
                <p className="text-sm">
                  <span className="font-bold text-slate-900">{fmt(p.price)}</span>{" "}
                  {p.badge && <span className="text-xs font-bold text-red-600/80">{p.badge}</span>}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- 2. CategoryIcons (compact scrollable image tiles) ---------- */
const CAT_IMG: Record<string, { img: string; count: string; tint: string }> = {
  audio: { img: "/img/cat-audio.webp", count: "Earbuds & headphones", tint: "bg-slate-100" },
  wearables: { img: "/img/cat-wearables.webp", count: "Watches & bands", tint: "bg-slate-100" },
  power: { img: "/img/cat-power.webp", count: "Banks & chargers", tint: "bg-slate-100" },
  cases: { img: "/img/cat-cases.webp", count: "Covers & protection", tint: "bg-slate-100" },
  cables: { img: "/img/cat-cables.webp", count: "Cables & hubs", tint: "bg-slate-100" },
};

export function CategoryIcons() {
  const { categories, products } = useProducts();
  const scrollerRef = useRef<HTMLDivElement>(null);

  const scrollBy = (dir: number) =>
    scrollerRef.current?.scrollBy({ left: dir * 320, behavior: "smooth" });

  return (
    <section className="max-w-7xl mx-auto px-6 pt-24 pb-10">
      <div className="flex items-end justify-between mb-6">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">Browse the range</p>
          <h2 className="text-2xl md:text-3xl font-black text-slate-900">Shop by Category</h2>
          <p className="text-sm text-slate-500 mt-1">Everything your devices need, sorted.</p>
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
        className="flex gap-4 overflow-x-auto no-scrollbar snap-x snap-mandatory pb-2 -mx-6 px-6"
      >
        {categories.map((c) => {
          const meta = CAT_IMG[c.id];
          // admin-set tile image wins, then the built-in art, else we render the emoji
          const tile = c.image || meta?.img;
          const count = products.filter((p) => p.category === c.id).length;
          return (
            <Link
              key={c.id}
              to={`/category/${c.id}`}
              className="group snap-start shrink-0 w-36 md:w-44 flex flex-col hover:-translate-y-1 transition-transform duration-200"
            >
              <span className={`relative block aspect-square overflow-hidden rounded-lg ${meta?.tint ?? "bg-slate-100"}`}>
                {tile ? (
                  <img
                    src={tile}
                    alt={c.name}
                    width={440}
                    height={440}
                    loading="lazy"
                    decoding="async"
                    className={`w-full h-full group-hover:scale-110 transition-transform duration-500 ${
                      c.image && !meta ? "object-cover rounded-xl" : "object-contain"
                    }`}
                  />
                ) : (
                  <span className="w-full h-full flex items-center justify-center text-4xl group-hover:scale-110 transition-transform duration-500">
                    {c.icon || "🗂"}
                  </span>
                )}
              </span>
              <span className="px-2 pt-2 pb-2.5 text-center">
                <span className="block text-xs font-black uppercase tracking-wide text-slate-900 transition-colors group-hover:text-slate-600">
                  {c.name}
                </span>
                <span className="block text-[11px] text-slate-400 mt-0.5">
                  {count > 0 ? `${count} ${count === 1 ? "product" : "products"}` : (meta?.count ?? "Shop the range")}
                </span>
              </span>
            </Link>
          );
        })}
        {/* view-all — plain link, no tile */}
        <Link
          to="/shop"
          className="group snap-start shrink-0 w-36 md:w-44 flex flex-col items-center justify-center gap-2.5"
        >
          <span className="w-12 h-12 rounded-lg bg-slate-200 text-slate-700 flex items-center justify-center text-lg group-hover:bg-slate-900 group-hover:text-white group-hover:scale-110 transition-all">
            →
          </span>
          <span className="text-xs font-black uppercase tracking-wide text-slate-900">View all</span>
          <span className="text-[11px] text-slate-400">Full catalog</span>
        </Link>
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
    return l.slice(0, 5);
  }, [products, tab]);

  return (
    <section className="max-w-7xl mx-auto px-6 py-10">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">Customer favourites</p>
          <h2 className="text-2xl md:text-3xl font-black text-slate-900">Best Selling</h2>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3">
          {/* desktop tabs */}
          <div className="hidden md:flex gap-2">
            {[{ id: "all", name: "All" }, ...categories].map((c) => (
              <button
                key={c.id}
                onClick={() => setTab(c.id)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
                  tab === c.id
                    ? "bg-slate-900 text-white"
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
            className="md:hidden rounded-xl surface-muted px-3 py-2 text-sm outline-none"
          >
            <option value="all">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <ViewToggle view={view} onChange={setView} />
        </div>
      </div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-slate-400">
          {list.length > 0 ? "Showing top picks" : "No matching best sellers"}
        </p>
        <Link to="/shop" className="text-xs font-bold uppercase tracking-wider text-slate-900 hover:text-slate-600 transition-colors">
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

/* ---------- 4. DealsOfDay (retail promo section) ---------- */
function DealCard({ id }: { id: number }) {
  const { products } = useProducts();
  const { add } = useCart();
  const { toggle, has } = useWishlist();
  const saleEnd = useSaleEnd();
  const { days, hours, mins, secs } = useCountdown(saleEnd ?? Date.now());
  const p = products.find((x) => x.id === id);
  if (!p) return null;
  const soldPct = Math.min(92, 100 - p.stock);

  return (
    <div className="flex flex-col sm:flex-row gap-5 sm:border-l sm:border-white/25 sm:pl-6">
      <img src={p.image} alt={p.name} className="w-full sm:w-40 aspect-square rounded-lg object-cover" />
      <div className="flex-1 flex flex-col">
        <Stars rating={p.rating} size="text-xs" />
        <h3 className="font-bold text-white mt-1">{p.name}</h3>
        <p className="text-lg font-black text-white mt-1">
          {fmt(p.price)}{" "}
          {p.compareAt && <span className="text-sm text-white/50 line-through font-medium">{fmt(p.compareAt)}</span>}
        </p>
        <div className="mt-3">
          <div className="flex justify-between text-xs text-white/70 mb-1">
            <span>Sold: {soldPct}%</span>
            <span>Only {p.stock} left</span>
          </div>
          <div className="h-1.5 rounded-full bg-white/20 overflow-hidden">
            <div className="h-full bg-sky-300" style={{ width: `${soldPct}%` }} />
          </div>
        </div>
        {saleEnd !== null && (
          <p className="text-xs text-white/70 mt-2 tabular-nums">
            ⏱ Ends in {days}d {String(hours).padStart(2, "0")}:{String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
          </p>
        )}
        <div className="flex gap-2 mt-4">
          <button
            onClick={() => add(p)}
            className="flex-1 py-2 rounded-lg bg-white text-blue-800 text-sm font-bold hover:bg-sky-300 transition"
          >
            Add to Cart
          </button>
          <button
            onClick={() => toggle(p.id)}
            className={`w-9 h-9 rounded-lg flex items-center justify-center transition ${
              has(p.id)
                ? "bg-white/30 text-white"
                : "bg-white/10 text-white/70 hover:bg-white/25 hover:text-white"
            }`}
            aria-label="Wishlist"
          >
            ♡
          </button>
        </div>
      </div>
    </div>
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
  return (
    <section className="max-w-7xl mx-auto px-6 py-10">
      <div className="relative rounded-lg overflow-hidden bg-gradient-to-br from-blue-600 via-indigo-600 to-blue-800 p-5 md:p-8">
        {/* light blooms */}
        <div className="relative grid lg:grid-cols-3 gap-5">
          <div className="flex flex-col justify-center text-white py-4">
            <p className="text-xs font-bold uppercase tracking-widest text-blue-200 mb-2">
              XccessoriesPoint
            </p>
            <h2 className="text-3xl font-black mb-3">Deals of the Day</h2>
            <p className="text-blue-100/90 text-sm mb-6">
              Hand-picked offers refreshed every 24 hours. When they're gone, they're gone.
            </p>
            <button
              onClick={() => navigate("/shop")}
              className="self-start px-6 py-2.5 rounded-lg bg-white/20 border border-white/30 text-white font-bold hover:bg-white hover:text-blue-800 transition"
            >
              View All Offers →
            </button>
          </div>
          <DealCard id={dealIds[0]} />
          <DealCard id={dealIds[1]} />
        </div>
      </div>
    </section>
  );
}
