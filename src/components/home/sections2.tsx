import { useMemo, useState } from "react";
import { Link, useRouter } from "../../router";
import { useProducts } from "../../context/store";
import ProductCard, { Stars } from "../ProductCard";
import { StarIcon } from "../icons";
import ViewToggle, { type ProductView } from "../ViewToggle";
import { BoltMark, Kicker } from "../brand";

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
    <section id="reviews" className="max-w-7xl mx-auto px-6 py-10 md:py-14 scroll-mt-24">
      <div className="mb-8 text-center">
        <Kicker center>Social proof</Kicker>
        <h2 className="text-3xl md:text-[2.6rem] font-bold tracking-tight text-slate-900 leading-tight">
          What customers say
        </h2>
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        {/* rating summary card */}
        <div className="rounded-2xl bg-white p-6 ring-1 ring-slate-900/5 shadow-[0_1px_2px_rgba(16,42,36,0.04),0_12px_32px_-18px_rgba(16,42,36,0.22)] h-fit md:p-7">
          <div className="flex items-end gap-3 mb-5">
            <span className="font-display text-5xl font-bold text-slate-900">4.7</span>
            <div className="pb-1">
              <Stars rating={5} />
              <p className="text-xs text-slate-500 mt-0.5">Based on 3,214 reviews</p>
            </div>
          </div>
          {bars.map((pct, i) => (
            <div key={i} className="flex items-center gap-2 mb-2 text-xs">
              <span className="flex w-6 items-center gap-0.5 text-slate-500">{5 - i}<StarIcon size={10} className="text-amber-400" /></span>
              <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full rounded-full bg-teal-500" style={{ width: `${pct}%` }} />
              </div>
              <span className="w-8 text-right text-slate-400">{pct}%</span>
            </div>
          ))}
          <p className="mt-5 pt-4 border-t border-slate-100 text-xs text-slate-400 flex items-center gap-1.5">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-[11px] font-bold text-white">G</span>
            Reviews synced from Google
          </p>
        </div>
        {/* quote cards */}
        {REVIEWS.slice(0, 2).map((r) => (
          <blockquote key={r.name} className="flex flex-col rounded-2xl bg-white p-6 ring-1 ring-slate-900/5 shadow-[0_1px_2px_rgba(16,42,36,0.04),0_12px_32px_-18px_rgba(16,42,36,0.22)] md:p-7">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-50 font-bold text-sm text-teal-700 ring-1 ring-teal-100">
                {r.name.charAt(0)}
              </div>
              <div>
                <p className="font-semibold text-slate-900 text-sm">{r.name}</p>
                <p className="text-xs text-slate-400">{r.date}</p>
              </div>
              <span className="ml-auto flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-[10px] font-bold text-white">G</span>
            </div>
            <Stars rating={r.rating} size="text-sm" />
            <p className="text-sm text-slate-600 mt-3 leading-relaxed flex-1">“{r.text}”</p>
            <p className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-teal-700">
              <svg width="13" height="13" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                <path d="M2.5 6.2 4.8 8.5 9.5 3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Verified purchase
            </p>
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
    <section className="max-w-7xl mx-auto px-6 py-10 md:py-14">
      <div className="flex items-end justify-between gap-4 mb-7">
        <div>
          <Kicker>Just landed</Kicker>
          <h2 className="text-3xl md:text-[2.6rem] font-bold tracking-tight leading-tight text-slate-900">New arrivals</h2>
          <p className="text-sm text-slate-500 mt-1.5">Fresh additions to the store.</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="rounded-full bg-white px-4 py-2 text-sm outline-none ring-1 ring-slate-200"
          >
            <option value="featured">Featured</option>
            <option value="price-asc">Price: Low → High</option>
            <option value="price-desc">Price: High → Low</option>
            <option value="rating">Top rated</option>
          </select>
          <ViewToggle view={view} onChange={setView} />
        </div>
      </div>

      {/* mobile banner carousel */}
      <div className="lg:hidden mb-6">
        <div className="relative rounded-2xl overflow-hidden h-44 ring-1 ring-slate-900/5">
          <img src={banners[banner].img} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950/75 via-slate-950/30 to-transparent flex flex-col justify-center px-6 text-white">
            <p className="text-xl font-bold">{banners[banner].title}</p>
            <p className="text-sm text-slate-200 mt-1">{banners[banner].copy}</p>
          </div>
        </div>
        <div className="flex justify-center gap-2 mt-3">
          {banners.map((_, i) => (
            <button
              key={i}
              onClick={() => setBanner(i)}
              className={`h-2 rounded-full transition-all ${i === banner ? "w-7 bg-slate-900" : "w-2 bg-slate-300"}`}
              aria-label={`Banner ${i + 1}`}
            />
          ))}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-4">
        {/* desktop lifestyle image */}
        <div className="hidden lg:block relative overflow-hidden rounded-2xl ring-1 ring-slate-900/5 shadow-[0_1px_2px_rgba(16,42,36,0.04),0_12px_32px_-18px_rgba(16,42,36,0.22)]">
          <img src="/img/lifestyle.jpg" alt="Lifestyle" className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/10 to-transparent flex flex-col justify-end p-7 text-white">
            <p className="font-display text-2xl font-bold leading-tight">Your everyday carry, upgraded.</p>
            <Link to="/shop" className="group mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-teal-300 hover:text-teal-200">
              Explore all
              <span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">→</span>
            </Link>
          </div>
        </div>
        {/* 8-product grid / list */}
        <div className={view === "list" ? "lg:col-span-3 grid grid-cols-1 gap-3" : "lg:col-span-3 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 md:gap-4"}>
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
    <section className="max-w-7xl mx-auto px-6 py-10 md:py-14">
      <div className="mb-7">
        <Kicker>Watch &amp; shop</Kicker>
        <h2 className="text-3xl md:text-[2.6rem] font-bold tracking-tight leading-tight text-slate-900">See it in action</h2>
        <p className="text-sm text-slate-500 mt-1.5">Real products, real tests, real customers.</p>
      </div>
      <div className="flex gap-4 overflow-x-auto no-scrollbar snap-x pb-2">
        {/* brand tile */}
        <div className="snap-start shrink-0 w-44 h-72 rounded-2xl bg-slate-950 text-white p-5 flex flex-col justify-between relative overflow-hidden">
          <div aria-hidden="true" className="xp-pattern absolute inset-0 opacity-60" />
          <div className="relative">
            <BoltMark size={30} className="mb-3 text-teal-300" />
            <p className="font-display font-bold text-lg leading-tight">
              Xccessories<br />Point
            </p>
          </div>
          <div className="relative">
            <p className="text-xs text-slate-300 mb-3">3,200+ five-star reviews</p>
            <button
              onClick={() => navigate("/shop")}
              className="w-full py-2.5 rounded-full bg-white text-slate-900 text-sm font-semibold hover:bg-teal-50 transition-colors"
            >
              Shop now
            </button>
          </div>
        </div>
        {reels.map((r) => (
          <div key={r.label} className="group snap-start shrink-0 w-44 h-72 rounded-2xl overflow-hidden relative cursor-pointer ring-1 ring-slate-900/5 shadow-[0_1px_2px_rgba(16,42,36,0.04),0_12px_32px_-18px_rgba(16,42,36,0.25)]">
            <img src={r.img} alt="" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/10 to-transparent" />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/95 text-teal-700 shadow-lg transition-transform duration-300 group-hover:scale-110">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M5 3.5v9l8-4.5-8-4.5Z" /></svg>
              </span>
            </div>
            <p className="absolute bottom-3.5 left-3.5 right-3.5 text-white text-xs font-semibold leading-snug">{r.label}</p>
          </div>
        ))}
        {/* review side tab — editorial */}
        <div className="snap-start shrink-0 w-44 h-72 flex flex-col justify-center p-5 rounded-2xl bg-white ring-1 ring-slate-900/5">
          <Stars rating={5} size="text-sm" />
          <p className="text-xs text-slate-600 mt-3 leading-relaxed flex-1 pt-1">
            “Watched the ANC test reel, ordered the same day. It performs exactly like the video.”
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
    <section className="max-w-3xl mx-auto px-6 py-10 md:py-16">
      <div className="mb-8 text-center">
        <Kicker center>Good to know</Kicker>
        <h2 className="text-3xl md:text-[2.6rem] font-bold tracking-tight leading-tight text-slate-900">Frequently asked questions</h2>
      </div>
      <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-900/5 shadow-[0_1px_2px_rgba(16,42,36,0.04),0_12px_32px_-18px_rgba(16,42,36,0.2)]">
        {FAQS.map((f, i) => (
          <div key={i} className={i > 0 ? "border-t border-slate-100" : ""}>
            <button
              onClick={() => setOpen(open === i ? null : i)}
              className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-slate-50/60"
              aria-expanded={open === i}
            >
              <span className="font-semibold text-slate-900 text-[15px]">{f.q}</span>
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition-transform duration-300 ${open === i ? "rotate-45 bg-teal-600 text-white" : ""}`}
                aria-hidden="true"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </span>
            </button>
            {open === i && (
              <p className="px-5 pb-5 text-sm text-slate-600 leading-relaxed fade-up">{f.a}</p>
            )}
          </div>
        ))}
      </div>
      <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
        <Link to="/shop" className="btn-primary">
          Shop now <span aria-hidden="true">→</span>
        </Link>
        <Link to="/faq" className="btn-ghost">
          Delivery &amp; payment FAQs
        </Link>
      </div>
    </section>
  );
}
