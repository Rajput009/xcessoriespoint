import { useMemo, useState } from "react";
import { Link, useRouter } from "../../router";
import { useProducts } from "../../context/store";
import ProductCard, { Stars } from "../ProductCard";

/* ---------- 6. ReviewsSummary ---------- */
const REVIEWS = [
  {
    name: "Ayesha K.",
    date: "Aug 2, 2026",
    rating: 5,
    text: "Ordered the AeroBuds Pro on Monday, delivered to Lahore by Wednesday. Noise cancellation is unreal for this price.",
  },
  {
    name: "Hamza R.",
    date: "Jul 21, 2026",
    rating: 5,
    text: "The VitaFit S2 battery genuinely lasts 9–10 days. Customer support replied within an hour when I had a strap question.",
  },
  {
    name: "Fatima S.",
    date: "Jul 9, 2026",
    rating: 4,
    text: "GaN charger is tiny and fast. Packaging was neat, and the invoice + warranty card were included. Will buy again.",
  },
];

export function ReviewsSummary() {
  const bars = [78, 15, 4, 2, 1];
  return (
    <section className="max-w-7xl mx-auto px-6 py-10">
      <p className="text-[11px] font-black uppercase tracking-[0.2em] text-cyan-600 mb-1 text-center">Social proof</p>
      <h2 className="text-2xl md:text-3xl font-black text-slate-900 mb-8 text-center">
        What Customers Say
      </h2>
      <div className="grid lg:grid-cols-3 gap-5">
        {/* summary card */}
        <div className="glass rounded-2xl p-6">
          <div className="flex items-end gap-3 mb-4">
            <span className="text-5xl font-black text-slate-900">4.7</span>
            <div className="pb-1">
              <Stars rating={5} />
              <p className="text-xs text-slate-500 mt-0.5">Based on 3,214 reviews</p>
            </div>
          </div>
          {bars.map((pct, i) => (
            <div key={i} className="flex items-center gap-2 mb-1.5 text-xs">
              <span className="w-6 text-slate-500">{5 - i}★</span>
              <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full bg-amber-400" style={{ width: `${pct}%` }} />
              </div>
              <span className="w-8 text-right text-slate-400">{pct}%</span>
            </div>
          ))}
          <p className="mt-4 text-xs text-slate-400 flex items-center gap-1.5">
            <span className="font-bold text-slate-600">G</span> Reviews synced from Google
          </p>
        </div>
        {/* review cards */}
        {REVIEWS.slice(0, 2).map((r) => (
          <div key={r.name} className="glass rounded-2xl p-6 flex flex-col">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                {r.name.charAt(0)}
              </div>
              <div>
                <p className="font-semibold text-slate-900 text-sm">{r.name}</p>
                <p className="text-xs text-slate-400">{r.date}</p>
              </div>
              <span className="ml-auto text-xs font-bold text-blue-500">G</span>
            </div>
            <Stars rating={r.rating} size="text-sm" />
            <p className="text-sm text-slate-600 mt-2 leading-relaxed">{r.text}</p>
            <p className="mt-auto pt-3 text-xs text-emerald-600 font-semibold">✓ Verified purchase</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---------- 7. NewArrivalsCarousel ---------- */
export function NewArrivalsCarousel() {
  const { products } = useProducts();
  const [sort, setSort] = useState("featured");
  const [banner, setBanner] = useState(0);

  const list = useMemo(() => {
    const l = products.filter((p) => p.newArrival);
    const arr = [...(l.length ? l : products)];
    if (sort === "price-asc") arr.sort((a, b) => a.price - b.price);
    if (sort === "price-desc") arr.sort((a, b) => b.price - a.price);
    if (sort === "rating") arr.sort((a, b) => b.rating - a.rating);
    return arr.slice(0, 8);
  }, [products, sort]);

  const banners = [
    { title: "Fresh This Week", copy: "8 new drops across audio & power", img: "/img/lifestyle.jpg" },
    { title: "Bundle & Save", copy: "Buds + charger combos from Rs 6,999", img: "/img/earbuds.jpg" },
  ];

  return (
    <section className="max-w-7xl mx-auto px-6 py-10">
      <div className="flex items-end justify-between gap-4 mb-6">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-violet-600 mb-1">Just landed</p>
          <h2 className="text-2xl md:text-3xl font-black text-slate-900">New Arrivals</h2>
          <p className="text-sm text-slate-500 mt-1">Just landed in the store.</p>
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="rounded-xl glass-soft px-3 py-2 text-sm outline-none"
        >
          <option value="featured">Featured</option>
          <option value="price-asc">Price: Low → High</option>
          <option value="price-desc">Price: High → Low</option>
          <option value="rating">Top Rated</option>
        </select>
      </div>

      {/* mobile banner carousel */}
      <div className="lg:hidden mb-5">
        <div className="relative rounded-2xl overflow-hidden h-40">
          <img src={banners[banner].img} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-slate-900/50 flex flex-col justify-center px-6 text-white">
            <p className="text-xl font-black">{banners[banner].title}</p>
            <p className="text-sm text-slate-200">{banners[banner].copy}</p>
          </div>
        </div>
        <div className="flex justify-center gap-2 mt-2">
          {banners.map((_, i) => (
            <button
              key={i}
              onClick={() => setBanner(i)}
              className={`h-1.5 rounded-full transition-all ${i === banner ? "w-6 bg-emerald-600" : "w-1.5 bg-slate-300"}`}
              aria-label={`Banner ${i + 1}`}
            />
          ))}
        </div>
      </div>

      <div className="grid lg:grid-cols-4 gap-5">
        {/* desktop lifestyle image */}
        <div className="hidden lg:block relative rounded-2xl overflow-hidden">
          <img src="/img/lifestyle.jpg" alt="Lifestyle" className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900/70 via-transparent flex flex-col justify-end p-6 text-white">
            <p className="text-2xl font-black leading-tight">Your everyday carry, upgraded.</p>
            <Link to="/shop" className="mt-3 text-sm font-bold text-emerald-300 hover:text-emerald-200">
              Explore all →
            </Link>
          </div>
        </div>
        {/* 8-product grid */}
        <div className="lg:col-span-3 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {list.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- 8. CategoryBanners ---------- */
export function CategoryBanners() {
  const tiles = [
    { big: true, title: "Audio Week", copy: "Up to 40% off earbuds & headphones", img: "/img/headphones.jpg", to: "/category/audio", tint: "from-violet-950/85 via-violet-900/25" },
    { title: "Wearables", copy: "From Rs 2,999", img: "/img/smartwatch.jpg", to: "/category/wearables", tint: "from-emerald-950/85 via-emerald-900/25" },
    { title: "Power Up", copy: "Chargers & banks", img: "/img/powerbank.jpg", to: "/category/power", tint: "from-amber-950/85 via-amber-900/25" },
    { title: "Protect It", copy: "Cases from Rs 999", img: "/img/case.jpg", to: "/category/cases", tint: "from-rose-950/85 via-rose-900/25" },
  ];
  return (
    <section className="max-w-7xl mx-auto px-6 py-10">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {tiles.map((t) => (
          <Link
            key={t.title}
            to={t.to}
            className={`group relative rounded-2xl overflow-hidden ${
              t.big ? "col-span-2 h-56" : "h-40 lg:h-56"
            }`}
          >
            <img
              src={t.img}
              alt=""
              className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
            <div className={`absolute inset-0 bg-gradient-to-t ${t.tint} to-transparent flex flex-col justify-end p-5 text-white`}>
              <p className={`font-black ${t.big ? "text-2xl" : "text-lg"}`}>{t.title}</p>
              <p className="text-sm text-slate-200">{t.copy}</p>
              <p className="text-xs font-bold text-amber-300 mt-1 opacity-0 group-hover:opacity-100 transition">
                Shop now →
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

/* ---------- 9. VideoStrip ---------- */
export function VideoStrip() {
  const { navigate } = useRouter();
  const reels = [
    { img: "/img/earbuds.jpg", label: "AeroBuds unboxing" },
    { img: "/img/smartwatch.jpg", label: "VitaFit workout test" },
    { img: "/img/headphones.jpg", label: "ANC street test" },
    { img: "/img/powerbank.jpg", label: "48h travel charge" },
    { img: "/img/charger.jpg", label: "0→60% in 25 min" },
  ];
  return (
    <section className="max-w-7xl mx-auto px-6 py-10">
      <div className="flex items-end justify-between mb-6">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-rose-600 mb-1">🎬 Watch & shop</p>
          <h2 className="text-2xl md:text-3xl font-black text-slate-900">See It in Action</h2>
          <p className="text-sm text-slate-500 mt-1">Real products, real tests, real customers.</p>
        </div>
      </div>
      <div className="flex gap-4 overflow-x-auto no-scrollbar snap-x pb-2">
        {/* brand tile */}
        <div className="snap-start shrink-0 w-44 h-72 rounded-2xl bg-gradient-to-b from-violet-600 to-indigo-800 text-white p-5 flex flex-col justify-between">
          <p className="font-black text-lg leading-tight">
            Xccessories<br />Point
          </p>
          <div>
            <p className="text-xs text-violet-200 mb-2">3,200+ five-star reviews</p>
            <button
              onClick={() => navigate("/shop")}
              className="w-full py-2 rounded-full bg-white text-indigo-700 text-sm font-bold"
            >
              Shop
            </button>
          </div>
        </div>
        {reels.map((r) => (
          <div key={r.label} className="group snap-start shrink-0 w-44 h-72 rounded-2xl overflow-hidden relative cursor-pointer">
            <img src={r.img} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900/70 via-transparent" />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center text-emerald-700 text-lg shadow-lg group-hover:scale-110 transition">
                ▶
              </span>
            </div>
            <p className="absolute bottom-3 left-3 right-3 text-white text-xs font-semibold">{r.label}</p>
          </div>
        ))}
        {/* review side tab */}
        <div className="snap-start shrink-0 w-44 h-72 rounded-2xl glass p-5 flex flex-col">
          <Stars rating={5} size="text-sm" />
          <p className="text-xs text-slate-600 mt-2 leading-relaxed flex-1">
            "Watched the ANC test reel, ordered the same day. It performs exactly like the video."
          </p>
          <p className="text-xs font-bold text-slate-900">— Bilal A.</p>
          <p className="text-[10px] text-slate-400">Verified buyer</p>
        </div>
      </div>
    </section>
  );
}


/* ---------- 10. FAQ ---------- */
const FAQS = [
  { q: "How long does delivery take?", a: "Lahore & Karachi: 2–3 working days. Other cities: 3–5 working days. Orders placed before 5 PM ship the same day." },
  { q: "Do you offer Cash on Delivery?", a: "Yes! COD is available nationwide. You can also pay by card or mobile wallet at checkout — no account needed." },
  { q: "What is your return policy?", a: "7-day easy returns on all products. If something arrives damaged or isn't what you ordered, we replace it or refund you in full." },
  { q: "Are the products genuine?", a: "100% genuine with a 6-month replacement warranty on electronics and a lifetime warranty on cables." },
  { q: "How do I track my order?", a: "Use the Track Order link in the footer with your order ID (e.g. XP-A1B2C3). You'll see live status from confirmation to delivery." },
];

export function FaqSection() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section className="max-w-3xl mx-auto px-6 py-10">
      <p className="text-[11px] font-black uppercase tracking-[0.2em] text-amber-600 mb-1 text-center">Good to know</p>
      <h2 className="text-2xl md:text-3xl font-black text-slate-900 mb-6 text-center">Frequently Asked Questions</h2>
      <div className="space-y-3">
        {FAQS.map((f, i) => (
          <div key={i} className="glass rounded-2xl overflow-hidden">
            <button
              onClick={() => setOpen(open === i ? null : i)}
              className="w-full flex items-center justify-between px-5 py-4 text-left"
              aria-expanded={open === i}
            >
              <span className="font-bold text-slate-900 text-sm">{f.q}</span>
              <span className={`text-emerald-600 transition-transform ${open === i ? "rotate-45" : ""}`}>＋</span>
            </button>
            {open === i && (
              <p className="px-5 pb-4 text-sm text-slate-600 leading-relaxed fade-up">{f.a}</p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
