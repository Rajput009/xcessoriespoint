import { useMemo, useState } from "react";
import { Link, useRouter } from "../../router";
import { useProducts } from "../../context/store";
import ProductCard, { Stars } from "../ProductCard";
import { StarIcon } from "../icons";
import ViewToggle, { type ProductView } from "../ViewToggle";

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
    <section id="reviews" className="max-w-7xl mx-auto px-6 py-7 md:py-9 scroll-mt-24">
      <p className="text-[11px] font-black uppercase tracking-[0.2em] text-orange-500 mb-1 text-center">Social proof</p>
      <h2 className="text-3xl md:text-4xl font-black uppercase tracking-tight text-slate-900 mb-5 text-center">
        What Customers Say
      </h2>
      <div className="grid lg:grid-cols-3 gap-x-10 gap-y-8">
        {/* rating summary card */}
        <div className="rounded-2xl border border-slate-200/80 bg-gradient-to-br from-sky-50 via-white to-violet-50 p-5 md:p-7 shadow-[0_1px_2px_rgba(15,23,42,0.05)] ring-1 ring-white/60 h-fit">
          <div className="flex items-end gap-3 mb-5">
            <span className="text-5xl font-black text-slate-900">4.7</span>
            <div className="pb-1">
              <Stars rating={5} />
              <p className="text-xs text-slate-500 mt-0.5">Based on 3,214 reviews</p>
            </div>
          </div>
          {bars.map((pct, i) => (
            <div key={i} className="flex items-center gap-2 mb-1.5 text-xs">
              <span className="flex w-6 items-center gap-0.5 text-slate-500">{5 - i}<StarIcon size={10} className="text-amber-400" /></span>
              <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full bg-amber-400" style={{ width: `${pct}%` }} />
              </div>
              <span className="w-8 text-right text-slate-400">{pct}%</span>
            </div>
          ))}
          <p className="mt-5 pt-4 border-t border-slate-100 text-xs text-slate-400 flex items-center gap-1.5">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-[11px] font-black text-white">G</span>
            Reviews synced from Google
          </p>
        </div>
        {/* editorial quotes — no cards */}
        {REVIEWS.slice(0, 2).map((r) => (
          <blockquote key={r.name} className="border-l-2 border-slate-300 pl-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-sm">
                {r.name.charAt(0)}
              </div>
              <div>
                <p className="font-semibold text-slate-900 text-sm">{r.name}</p>
                <p className="text-xs text-slate-400">{r.date}</p>
              </div>
              <span className="ml-auto text-xs font-bold text-slate-500">G</span>
            </div>
            <Stars rating={r.rating} size="text-sm" />
            <p className="text-sm text-slate-600 mt-2 leading-relaxed">{r.text}</p>
            <p className="mt-3 text-xs text-slate-600 font-semibold">✓ Verified purchase</p>
          </blockquote>
        ))}
      </div>
    </section>
  );
}

/* ---------- 7. NewArrivalsCarousel ---------- */
export function NewArrivalsCarousel() {
  const { products } = useProducts();
  const [sort, setSort] = useState("featured");
  const [view, setView] = useState<ProductView>("grid");
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
    <section className="max-w-7xl mx-auto px-6 py-7 md:py-9">
      <div className="flex items-end justify-between gap-4 mb-5">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-orange-500 mb-1">Just landed</p>
          <h2 className="text-3xl md:text-4xl font-black uppercase tracking-tight text-slate-900">New Arrivals</h2>
          <p className="text-sm text-slate-500 mt-1">Fresh additions to the store.</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="rounded-xl surface-muted px-3 py-2 text-sm outline-none"
          >
            <option value="featured">Featured</option>
            <option value="price-asc">Price: Low → High</option>
            <option value="price-desc">Price: High → Low</option>
            <option value="rating">Top Rated</option>
          </select>
          <ViewToggle view={view} onChange={setView} />
        </div>
      </div>

      {/* mobile banner carousel */}
      <div className="lg:hidden mb-5">
        <div className="relative rounded-lg overflow-hidden h-40">
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
              className={`h-1.5 rounded-md transition-all ${i === banner ? "w-6 bg-slate-900" : "w-1.5 bg-slate-300"}`}
              aria-label={`Banner ${i + 1}`}
            />
          ))}
        </div>
      </div>

      <div className="grid lg:grid-cols-4 gap-5">
        {/* desktop lifestyle image */}
        <div className="hidden lg:block relative rounded-lg overflow-hidden">
          <img src="/img/lifestyle.jpg" alt="Lifestyle" className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900/70 via-transparent flex flex-col justify-end p-6 text-white">
            <p className="text-2xl font-black leading-tight">Your everyday carry, upgraded.</p>
            <Link to="/shop" className="mt-3 text-sm font-bold text-orange-300 hover:text-orange-100">
              Explore all →
            </Link>
          </div>
        </div>
        {/* 8-product grid / list */}
        <div className={view === "list" ? "lg:col-span-3 grid grid-cols-1 gap-3" : "lg:col-span-3 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"}>
          {list.map((p) => (
            <ProductCard key={p.id} product={p} view={view} />
          ))}
        </div>
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
    <section className="max-w-7xl mx-auto px-6 py-7 md:py-9">
      <div className="flex items-end justify-between mb-5">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-orange-500 mb-1">Watch & shop</p>
          <h2 className="text-2xl md:text-3xl font-black text-slate-900">See It in Action</h2>
          <p className="text-sm text-slate-500 mt-1">Real products, real tests, real customers.</p>
        </div>
      </div>
      <div className="flex gap-4 overflow-x-auto no-scrollbar snap-x pb-2">
        {/* brand tile */}
        <div className="snap-start shrink-0 w-44 h-72 rounded-lg bg-slate-950 text-white p-5 flex flex-col justify-between">
          <p className="font-black text-lg leading-tight">
            Xccessories<br />Point
          </p>
          <div>
            <p className="text-xs text-slate-300 mb-2">3,200+ five-star reviews</p>
            <button
              onClick={() => navigate("/shop")}
              className="w-full py-2 rounded-lg bg-white text-slate-900 text-sm font-bold hover:bg-slate-200 transition-colors"
            >
              Shop
            </button>
          </div>
        </div>
        {reels.map((r) => (
          <div key={r.label} className="group snap-start shrink-0 w-44 h-72 rounded-lg overflow-hidden relative cursor-pointer">
            <img src={r.img} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900/70 via-transparent" />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="w-12 h-12 rounded-xl bg-white/90 flex items-center justify-center text-orange-600 text-lg shadow-lg group-hover:scale-110 transition">
                ▶
              </span>
            </div>
            <p className="absolute bottom-3 left-3 right-3 text-white text-xs font-semibold">{r.label}</p>
          </div>
        ))}
        {/* review side tab — editorial, no box */}
        <div className="snap-start shrink-0 w-44 h-72 flex flex-col p-3 border-l-2 border-slate-300">
          <Stars rating={5} size="text-sm" />
          <p className="text-xs text-slate-600 mt-2 leading-relaxed flex-1">
            "Watched the ANC test reel, ordered the same day. It performs exactly like the video."
          </p>
          <p className="text-xs font-bold text-slate-900">— Bilal A.</p>
          <p className="text-[11px] text-slate-400">Verified buyer</p>
        </div>
      </div>
    </section>
  );
}


/* ---------- 9. FAQ ---------- */
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
    <section className="max-w-3xl mx-auto px-6 py-7 md:py-9">
      <p className="text-[11px] font-black uppercase tracking-[0.2em] text-orange-500 mb-1 text-center">Good to know</p>
      <h2 className="text-2xl md:text-3xl font-black text-slate-900 mb-5 text-center">Frequently Asked Questions</h2>
      <div className="divide-y divide-slate-200 border-y border-slate-200">
        {FAQS.map((f, i) => (
          <div key={i}>
            <button
              onClick={() => setOpen(open === i ? null : i)}
              className="w-full flex items-center justify-between py-4 text-left"
              aria-expanded={open === i}
            >
              <span className="font-bold text-slate-900 text-sm">{f.q}</span>
              <svg
                width="12"
                height="12"
                viewBox="0 0 12 12"
                fill="none"
                aria-hidden="true"
                className={`shrink-0 text-slate-400 transition-transform duration-200 ${open === i ? "rotate-180" : ""}`}
              >
                <path d="M2 4.2 6 8.2 10 4.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {open === i && (
              <p className="pb-4 text-sm text-slate-600 leading-relaxed fade-up">{f.a}</p>
            )}
          </div>
        ))}
      </div>
      <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
        <Link to="/shop" className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-6 py-3 text-xs font-bold uppercase tracking-wider text-white hover:bg-slate-700 transition-colors">
          Shop now
        </Link>
        <Link
          to="/faq"
          className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-6 py-3 text-xs font-bold uppercase tracking-wider text-slate-700 hover:border-slate-400 hover:bg-slate-50 transition-colors"
        >
          Delivery & payment FAQs
        </Link>
      </div>
    </section>
  );
}
