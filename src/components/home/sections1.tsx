import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useRouter } from "../../router";
import { useCart, useProducts, useUI, useWishlist, fmt } from "../../context/store";
import { Stars } from "../ProductCard";
import ProductCard from "../ProductCard";

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
  };
}

const SALE_END = Date.now() + 2 * 86400000 + 11 * 3600000 + 26 * 60000;

function CountdownBoxes() {
  const { days, hours, mins, secs } = useCountdown(SALE_END);
  const box =
    "bg-black/20 backdrop-blur-md border border-white/25 rounded-xl px-2.5 py-1.5 min-w-[54px] text-center shadow-lg shadow-black/20";
  const items = [
    [days, "Days"], [hours, "Hours"], [mins, "Mins"], [secs, "Secs"],
  ] as const;
  return (
    <div className="flex gap-2 justify-center lg:justify-start">
      {items.map(([v, l]) => (
        <div key={l} className={box}>
          <div className="text-lg font-black text-white tabular-nums">{String(v).padStart(2, "0")}</div>
          <div className="text-[10px] uppercase tracking-wide text-white/85">{l}</div>
        </div>
      ))}
    </div>
  );
}

/* ---------- 1. Hero ---------- */
const SLIDES = [
  {
    tag: "Limited-time flash sale",
    headline: "AeroBuds Pro — Silence the Noise",
    price: 4999,
    compareAt: 7999,
    image: "/img/hero-1.png",
    gradient: "from-emerald-700 via-teal-600 to-emerald-500",
    cat: "audio",
  },
  {
    tag: "New season, new look",
    headline: "VitaFit S2 — Your Health, On Your Wrist",
    price: 6499,
    compareAt: 9499,
    image: "/img/hero-2.png",
    gradient: "from-violet-700 via-purple-600 to-fuchsia-500",
    cat: "wearables",
  },
  {
    tag: "Power that travels",
    headline: "VoltCore 20K — Never Hit 0% Again",
    price: 3499,
    compareAt: 4999,
    image: "/img/hero-3.png",
    gradient: "from-amber-600 via-orange-500 to-rose-500",
    cat: "power",
  },
];

/* hand-drawn dashed arrow doodle (amaze-style personality) */
function ArrowDoodle() {
  return (
    <svg
      viewBox="0 0 120 90"
      className="hidden lg:block absolute left-[46%] top-[38%] w-28 text-white/70 -rotate-12"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
    >
      <path d="M8 78 C 30 70, 28 40, 52 38 C 76 36, 66 14, 104 12" strokeDasharray="6 7" />
      <path d="M92 6 l14 5 -11 11" strokeDasharray="0" />
    </svg>
  );
}

export function HeroSection() {
  const [slide, setSlide] = useState(0);
  const { navigate } = useRouter();
  const { products } = useProducts();

  useEffect(() => {
    const t = setInterval(() => setSlide((s) => (s + 1) % SLIDES.length), 6000);
    return () => clearInterval(t);
  }, []);

  const s = SLIDES[slide];
  const featured = products.filter((p) => [2, 6, 3].includes(p.id)).slice(0, 3);

  return (
    <section className="relative">
      {/* full-bleed cross-fading gradients — run up behind the glass header */}
      <div className="absolute inset-0 overflow-hidden">
        {SLIDES.map((sl, i) => (
          <div
            key={i}
            className={`absolute inset-0 bg-gradient-to-br ${sl.gradient} transition-opacity duration-1000 ${
              i === slide ? "opacity-100" : "opacity-0"
            }`}
          />
        ))}
        {/* soft light blooms for depth */}
        <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-white/15 blur-3xl" />
        <div className="absolute bottom-0 right-0 w-[28rem] h-[28rem] rounded-full bg-white/10 blur-3xl" />
        {/* readability scrim behind the text column */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/30 via-black/10 to-transparent" />
      </div>

      <div className="relative max-w-7xl mx-auto px-6 pt-[130px] md:pt-[180px] pb-4">
        <div className="grid lg:grid-cols-2 gap-8 items-center">
          {/* text */}
          <div className="text-center lg:text-left order-2 lg:order-1 fade-up" key={`t${slide}`}>
            <p className="inline-block text-xs font-bold uppercase tracking-widest bg-black/25 backdrop-blur-md border border-white/25 text-white px-3.5 py-1.5 rounded-full mb-4">
              ⚡ {s.tag}
            </p>
            <h1 className="text-3xl md:text-5xl font-black text-white leading-tight mb-4 drop-shadow-[0_3px_18px_rgba(0,0,0,0.45)]">
              {s.headline}
            </h1>
            <p className="text-2xl font-bold text-white mb-5 drop-shadow-[0_2px_8px_rgba(0,0,0,0.35)]">
              {fmt(s.price)}{" "}
              <span className="text-base text-white/75 line-through font-medium">{fmt(s.compareAt)}</span>
            </p>
            <div className="mb-6">
              <CountdownBoxes />
            </div>
            <button
              onClick={() => navigate(`/shop?cat=${s.cat}`)}
              className="px-8 py-3.5 rounded-full bg-white text-slate-900 font-bold hover:bg-slate-900 hover:text-white transition-colors shadow-xl shadow-black/25"
            >
              Shop Now →
            </button>
          </div>
          {/* floating cutout product */}
          <div className="order-1 lg:order-2 relative flex justify-center fade-up" key={`i${slide}`}>
            <ArrowDoodle />
            <img
              src={s.image}
              alt={s.headline}
              className="float-slow w-64 md:w-[400px] max-h-[420px] object-contain drop-shadow-[0_35px_45px_rgba(6,78,59,0.4)]"
            />
          </div>
        </div>

        {/* dots */}
        <div className="flex justify-center gap-2 mt-8">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={() => setSlide(i)}
              aria-label={`Slide ${i + 1}`}
              className={`h-2 rounded-full transition-all ${
                i === slide ? "w-8 bg-white" : "w-2 bg-white/40 hover:bg-white/70"
              }`}
            />
          ))}
        </div>

        {/* featured glass cards — straddle the hero's bottom edge (amaze-style) */}
        <div className="mt-8 -mb-14 relative z-10 flex lg:grid lg:grid-cols-3 gap-4 overflow-x-auto no-scrollbar snap-x pb-2">
          {featured.map((p) => (
            <button
              key={p.id}
              onClick={() => navigate("/shop")}
              className="snap-start shrink-0 w-72 lg:w-auto bg-white/40 backdrop-blur-xl border border-white/50 rounded-2xl p-4 flex items-center gap-4 shadow-xl shadow-emerald-950/15 hover:bg-white/60 hover:-translate-y-0.5 transition text-left"
            >
              <img src={p.image} alt="" className="w-16 h-16 rounded-xl object-cover ring-1 ring-white/50" />
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
const CAT_IMG: Record<string, { img: string; count: string; tint: string; text: string }> = {
  audio: { img: "/img/cat-audio.png", count: "Earbuds & headphones", tint: "bg-violet-100/70", text: "group-hover:text-violet-700" },
  wearables: { img: "/img/cat-wearables.png", count: "Watches & bands", tint: "bg-emerald-100/70", text: "group-hover:text-emerald-700" },
  power: { img: "/img/cat-power.png", count: "Banks & chargers", tint: "bg-amber-100/70", text: "group-hover:text-amber-700" },
  cases: { img: "/img/cat-cases.png", count: "Covers & protection", tint: "bg-rose-100/70", text: "group-hover:text-rose-700" },
  cables: { img: "/img/cat-cables.png", count: "Cables & hubs", tint: "bg-cyan-100/70", text: "group-hover:text-cyan-700" },
};

export function CategoryIcons() {
  const { categories } = useProducts();
  const scrollerRef = useRef<HTMLDivElement>(null);

  const scrollBy = (dir: number) =>
    scrollerRef.current?.scrollBy({ left: dir * 320, behavior: "smooth" });

  return (
    <section className="max-w-7xl mx-auto px-6 pt-24 pb-10">
      <div className="flex items-end justify-between mb-6">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-violet-600 mb-1">Pick your lane</p>
          <h2 className="text-2xl md:text-3xl font-black text-slate-900">Shop by Category</h2>
          <p className="text-sm text-slate-500 mt-1">Everything your devices need, sorted.</p>
        </div>
        <div className="hidden md:flex gap-2">
          <button
            onClick={() => scrollBy(-1)}
            className="w-9 h-9 rounded-full glass-soft text-slate-600 hover:text-emerald-700 hover:shadow-md flex items-center justify-center transition-all"
            aria-label="Scroll left"
          >
            ‹
          </button>
          <button
            onClick={() => scrollBy(1)}
            className="w-9 h-9 rounded-full border border-slate-200 bg-white text-slate-500 hover:border-emerald-500 hover:text-emerald-600 flex items-center justify-center transition-colors"
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
          return (
            <Link
              key={c.id}
              to={`/shop?cat=${c.id}`}
              className="group snap-start shrink-0 w-36 md:w-44 flex flex-col rounded-2xl glass-soft overflow-hidden hover:-translate-y-1 hover:shadow-xl hover:shadow-emerald-500/15 hover:ring-2 hover:ring-emerald-400/50 transition-all"
            >
              <span className={`relative block aspect-square p-3 ${meta?.tint ?? "bg-white/60"}`}>
                <img
                  src={meta?.img}
                  alt={c.name}
                  loading="lazy"
                  className="w-full h-full object-contain group-hover:scale-110 transition-transform duration-500"
                />
              </span>
              <span className="px-2 pt-2 pb-3 text-center border-t border-white/50">
                <span className={`block text-xs font-black uppercase tracking-wide text-slate-900 transition-colors ${meta?.text ?? ""}`}>
                  {c.name}
                </span>
                <span className="block text-[10px] text-slate-400 mt-0.5">{meta?.count}</span>
              </span>
            </Link>
          );
        })}
        {/* view-all tile */}
        <Link
          to="/shop"
          className="group snap-start shrink-0 w-36 md:w-44 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white flex flex-col items-center justify-center gap-2 hover:-translate-y-1 hover:shadow-lg transition-all"
        >
          <span className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center text-lg group-hover:bg-white/25 transition-colors">
            →
          </span>
          <span className="text-xs font-black uppercase tracking-wide">View all</span>
          <span className="text-[10px] text-emerald-100">Full catalog</span>
        </Link>
      </div>
    </section>
  );
}

/* ---------- 3. BestSelling ---------- */
export function BestSelling() {
  const { products, categories } = useProducts();
  const { searchQuery } = useUI();
  const [tab, setTab] = useState("all");

  const list = useMemo(() => {
    let l = products.filter((p) => p.bestSeller || p.rating >= 4.4);
    if (tab !== "all") l = l.filter((p) => p.category === tab);
    if (searchQuery.trim())
      l = l.filter((p) => p.name.toLowerCase().includes(searchQuery.toLowerCase()));
    return l.slice(0, 5);
  }, [products, tab, searchQuery]);

  return (
    <section className="max-w-7xl mx-auto px-6 py-10">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-amber-600 mb-1">⚡ Trending now</p>
          <h2 className="text-2xl md:text-3xl font-black text-slate-900">Best Selling Products</h2>
          <p className="text-sm text-slate-500 mt-1">Customer favourites, restocked weekly.</p>
        </div>
        {/* desktop tabs */}
        <div className="hidden md:flex gap-2">
          {[{ id: "all", name: "All" }, ...categories].map((c) => (
            <button
              key={c.id}
              onClick={() => setTab(c.id)}
              className={`px-4 py-2 rounded-full text-sm font-semibold transition ${
                tab === c.id
                  ? "bg-emerald-600 text-white neon-glow-soft"
                  : "glass-soft text-slate-600 hover:text-emerald-700"
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
          className="md:hidden rounded-xl glass-soft px-3 py-2 text-sm outline-none"
        >
          <option value="all">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>
      {list.length === 0 ? (
        <p className="text-sm text-slate-500 py-10 text-center">No matching best sellers.</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {list.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </section>
  );
}

/* ---------- 4. FeaturedProductDetail ---------- */
export function FeaturedProductDetail() {
  const { products } = useProducts();
  const { add } = useCart();
  const p = products.find((x) => x.featured) ?? products[0];
  if (!p) return null;

  return (
    <section className="max-w-7xl mx-auto px-6 py-10">
      <div className="grid lg:grid-cols-2 rounded-3xl overflow-hidden bg-slate-900 text-white">
        <div className="p-8 md:p-12 flex flex-col justify-center">
          <p className="text-emerald-400 text-xs font-bold uppercase tracking-widest mb-3">
            Featured Product
          </p>
          <h2 className="text-2xl md:text-4xl font-black mb-4">{p.name}</h2>
          <p className="text-slate-300 text-sm md:text-base mb-6">{p.description}</p>
          <ul className="space-y-2.5 mb-8 text-sm">
            {["Hybrid active noise cancellation", "32-hour total battery life", "Wireless + USB-C fast charging", "IPX5 sweat & splash resistant"].map((f) => (
              <li key={f} className="flex items-center gap-2.5 glass-dark rounded-xl px-3 py-2">
                <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs">✓</span>
                {f}
              </li>
            ))}
          </ul>
          <div className="flex items-center gap-4">
            <span className="text-2xl font-black text-emerald-400">{fmt(p.price)}</span>
            {p.compareAt && <span className="text-slate-400 line-through">{fmt(p.compareAt)}</span>}
            <button
              onClick={() => add(p)}
              className="ml-auto px-6 py-3 rounded-full bg-emerald-600 font-bold hover:bg-emerald-500 transition neon-glow"
            >
              Add to Cart
            </button>
          </div>
        </div>
        <div className="relative hidden lg:block">
          <img src={p.image} alt={p.name} className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-transparent" />
          <p className="absolute bottom-8 left-8 right-8 text-2xl font-black">
            Sound that disappears into your day.
          </p>
        </div>
      </div>
    </section>
  );
}

/* ---------- 5. DealsOfDay (glass on gradient) ---------- */
function DealCard({ id }: { id: number }) {
  const { products } = useProducts();
  const { add } = useCart();
  const { toggle, has } = useWishlist();
  const { days, hours, mins, secs } = useCountdown(SALE_END);
  const p = products.find((x) => x.id === id);
  if (!p) return null;
  const soldPct = Math.min(92, 100 - p.stock);

  return (
    <div className="bg-white/15 backdrop-blur-xl border border-white/25 rounded-2xl p-5 flex flex-col sm:flex-row gap-5 hover:bg-white/25 transition shadow-lg shadow-emerald-950/10">
      <img src={p.image} alt={p.name} className="w-full sm:w-40 aspect-square rounded-xl object-cover ring-1 ring-white/30" />
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
          <div className="h-2 rounded-full bg-white/20 overflow-hidden">
            <div className="h-full bg-lime-300" style={{ width: `${soldPct}%` }} />
          </div>
        </div>
        <p className="text-xs text-white/70 mt-2 tabular-nums">
          ⏱ Ends in {days}d {String(hours).padStart(2, "0")}:{String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
        </p>
        <div className="flex gap-2 mt-3">
          <button
            onClick={() => add(p)}
            className="flex-1 py-2 rounded-lg bg-white text-emerald-800 text-sm font-bold hover:bg-emerald-950 hover:text-white transition"
          >
            Add to Cart
          </button>
          <button
            onClick={() => toggle(p.id)}
            className={`w-9 h-9 rounded-lg border flex items-center justify-center transition ${
              has(p.id)
                ? "border-white bg-white/30 text-white"
                : "border-white/40 text-white/70 hover:bg-white/20 hover:text-white"
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
  return (
    <section className="max-w-7xl mx-auto px-6 py-10">
      <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-emerald-600 via-teal-600 to-emerald-800 p-5 md:p-8">
        {/* light blooms */}
        <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full bg-white/15 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-16 w-72 h-72 rounded-full bg-fuchsia-400/25 blur-3xl pointer-events-none" />
        <div className="relative grid lg:grid-cols-3 gap-5">
          <div className="flex flex-col justify-center text-white py-4">
            <p className="text-xs font-bold uppercase tracking-widest text-emerald-200 mb-2">
              XccessoriesPoint
            </p>
            <h2 className="text-3xl font-black mb-3">Deals of the Day</h2>
            <p className="text-emerald-100/90 text-sm mb-6">
              Hand-picked offers refreshed every 24 hours. When they're gone, they're gone.
            </p>
            <button
              onClick={() => navigate("/shop")}
              className="self-start px-6 py-2.5 rounded-full bg-white/20 backdrop-blur-md border border-white/30 text-white font-bold hover:bg-white hover:text-emerald-800 transition"
            >
              View All Offers →
            </button>
          </div>
          <DealCard id={1} />
          <DealCard id={3} />
        </div>
      </div>
    </section>
  );
}
