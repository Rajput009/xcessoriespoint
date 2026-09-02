import { useMemo } from "react";
import { Link } from "../../router";
import { useProducts, fmt } from "../../context/store";
import type { Product } from "../../types";
import ProductCard from "../ProductCard";
import CategoryLogo from "../CategoryLogo";
import { PhoneIcon, TruckIcon, StarIcon } from "../icons";
import { Kicker } from "../brand";

const BRAND_LOGOS = [
  { name: "Anker", logo: "/img/brands/anker.png" },
  { name: "Baseus", logo: "/img/brands/baseus.png" },
  { name: "UGREEN", logo: "/img/brands/ugreen.png" },
  { name: "Joyroom", logo: "/img/brands/joyroom.png" },
  { name: "Xiaomi", logo: "/img/brands/xiaomi.svg" },
  { name: "Samsung", logo: "/img/brands/samsung.svg" },
  { name: "Apple", logo: "/img/brands/apple.svg" },
];

export function ShopByBrand() {
  return (
    <section className="max-w-7xl mx-auto px-6 py-10 md:py-14">
      <div className="mb-7 text-center">
        <Kicker center>Trusted names</Kicker>
        <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">Popular brands</h2>
      </div>
      <div className="grid grid-cols-3 gap-3 rounded-2xl bg-white p-6 ring-1 ring-slate-900/5 shadow-[0_1px_2px_rgba(16,42,36,0.04),0_12px_32px_-18px_rgba(16,42,36,0.18)] sm:grid-cols-4 md:grid-cols-7 md:gap-4 md:p-8">
        {BRAND_LOGOS.map((brand) => (
          <Link
            key={brand.name}
            to="/shop"
            aria-label={`Browse ${brand.name}`}
            className="group flex flex-col items-center gap-2"
          >
            <span className="flex h-14 w-full items-center justify-center grayscale opacity-70 transition-all duration-300 group-hover:grayscale-0 group-hover:opacity-100">
              <img
                src={brand.logo}
                alt={`${brand.name} logo`}
                className="h-9 max-w-[110px] object-contain"
              />
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 transition-colors group-hover:text-slate-700">
              {brand.name}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

export function PopularCategoryShelves() {
  const { products, categories } = useProducts();
  const shelves = useMemo(
    () =>
      categories
        .map((category) => {
          const items = products
            .filter((product) => product.category === category.id)
            .sort((a, b) => Number(!!b.bestSeller) - Number(!!a.bestSeller) || b.rating - a.rating)
            .slice(0, 4);
          return { category, items };
        })
        .filter(({ items }) => items.length >= 3)
        .sort((a, b) => b.items.length - a.items.length || (a.category.sortOrder ?? 0) - (b.category.sortOrder ?? 0))
        .slice(0, 4),
    [categories, products]
  );

  if (shelves.length === 0) return null;

  return (
    <div>
      {shelves.map(({ category, items }) => (
        <section key={category.id} className="max-w-7xl mx-auto px-6 py-8 md:py-10">
          <div className="flex items-end justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <CategoryLogo category={category} size={48} className="hidden sm:flex" />
              <div>
                <Kicker>Browse the range</Kicker>
                <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">{category.name}</h2>
              </div>
            </div>
            <Link to={`/category/${category.id}`} className="group inline-flex items-center gap-1 text-sm font-semibold text-teal-700 hover:text-teal-800">
              View all
              <span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">→</span>
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 md:gap-5">
            {items.map((product) => <ProductCard key={product.id} product={product} />)}
          </div>
        </section>
      ))}
    </div>
  );
}

/* ---------- Shop by Device & Shop by Need (two compact sections) ---------- */
type GroupDef = {
  label: string;
  copy: string;
  to: string;
  img: string;
  compact?: boolean;
  match: (product: Product) => boolean;
};

const DEVICE_GROUPS: GroupDef[] = [
  {
    label: "Wireless audio",
    copy: "Earbuds & headphones",
    to: "/category/audio",
    img: "/img/earbuds.jpg",
    match: (product: Product) => product.category === "audio",
  },
  {
    label: "USB-C devices",
    copy: "Chargers, cables & hubs",
    to: "/shop?q=USB-C",
    img: "/img/charger.jpg",
    match: (product: Product) => /usb[- ]?c|usb-c|gan|charger|power bank|hub/i.test(`${product.name} ${product.description ?? ""}`),
  },
  {
    label: "Wearables",
    copy: "Watches & fitness bands",
    to: "/category/wearables",
    img: "/img/smartwatch.jpg",
    match: (product: Product) => product.category === "wearables",
  },
  {
    label: "Phone protection",
    copy: "Slim & rugged cases",
    to: "/category/cases",
    img: "/img/case.jpg",
    match: (product: Product) => product.category === "cases",
  },
];

const NEEDS: GroupDef[] = [
  {
    label: "Travel charging",
    compact: true,
    copy: "Power banks & compact chargers",
    to: "/category/power",
    img: "/img/powerbank.jpg",
    match: (product: Product) => product.category === "power",
  },
  {
    label: "Desk setup",
    compact: true,
    copy: "Hubs, cables & fast charging",
    to: "/category/cables",
    img: "/img/charger-2.jpg",
    match: (product: Product) => product.category === "cables",
  },
  {
    label: "Everyday audio",
    compact: true,
    copy: "Simple sound for every commute",
    to: "/category/audio",
    img: "/img/headphones.jpg",
    match: (product: Product) => product.category === "audio",
  },
  {
    label: "Everyday protection",
    compact: true,
    copy: "Slim and rugged phone cases",
    to: "/category/cases",
    img: "/img/case.jpg",
    match: (product: Product) => product.category === "cases",
  },
];

/** Attach live catalog facts (product count + lowest price) to each group. */
function useGroupStats(groups: GroupDef[]) {
  const { products } = useProducts();
  return useMemo(
    () =>
      groups
        .map((g) => {
          const items = products.filter(g.match);
          const fromPrice = items.reduce((min, p) => {
            const price = p.variants?.length
              ? Math.min(p.price, ...p.variants.map((v) => p.price + (v.priceDelta || 0)))
              : p.price;
            return Math.min(min, price);
          }, Number.POSITIVE_INFINITY);
          return {
            ...g,
            count: items.length,
            fromPrice: Number.isFinite(fromPrice) ? fromPrice : 0,
          };
        })
        .filter((g) => g.count > 0),
    [products, groups]
  );
}

function WayGrid({ items }: { items: ReturnType<typeof useGroupStats> }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
      {items.map((g) => (
        <Link
          key={g.label}
          to={g.to}
          className="group block overflow-hidden rounded-2xl bg-white ring-1 ring-slate-900/5 shadow-[0_1px_2px_rgba(16,42,36,0.04),0_10px_28px_-18px_rgba(16,42,36,0.2)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_2px_6px_rgba(16,42,36,0.05),0_22px_44px_-20px_rgba(16,42,36,0.3)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-600"
        >
          <span className={`block aspect-[4/3] overflow-hidden bg-gradient-to-b from-slate-50 to-white ${g.compact ? "p-6 md:p-8" : "p-4 md:p-5"}`}>
            <img
              src={g.img}
              alt=""
              loading="lazy"
              decoding="async"
              width={480}
              height={480}
              className="h-full w-full object-contain transition-transform duration-500 group-hover:scale-105"
            />
          </span>
          <span className="block border-t border-slate-100 p-4 md:p-5">
            <span className="flex items-center gap-1.5">
              <span className="text-sm md:text-base font-semibold text-slate-900 leading-tight transition-colors group-hover:text-teal-700">
                {g.label}
              </span>
            </span>
            <span className="mt-0.5 block text-xs text-slate-500">{g.copy}</span>
            <span className="mt-2 flex items-center justify-between text-xs font-medium text-slate-400">
              <span>
                {g.count} {g.count === 1 ? "product" : "products"}
                {g.fromPrice > 0 && (
                  <>
                    {" "}· from <span className="font-semibold text-slate-600">{fmt(g.fromPrice)}</span>
                  </>
                )}
              </span>
              <span aria-hidden="true" className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition-all group-hover:bg-teal-600 group-hover:text-white">
                →
              </span>
            </span>
          </span>
        </Link>
      ))}
    </div>
  );
}

export function ShopByDevice() {
  const groups = useGroupStats(DEVICE_GROUPS);
  if (groups.length === 0) return null;
  return (
    <section className="max-w-7xl mx-auto px-6 py-10 md:py-14">
      <div className="mb-7">
        <Kicker>Find it fast</Kicker>
        <h2 className="text-3xl md:text-[2.6rem] font-bold tracking-tight leading-tight text-slate-900">Shop by device &amp; connection</h2>
      </div>
      <WayGrid items={groups} />
    </section>
  );
}

export function ShopByNeed() {
  const needs = useGroupStats(NEEDS);
  if (needs.length === 0) return null;
  return (
    <section className="max-w-7xl mx-auto px-6 py-10 md:py-14">
      <div className="mb-7">
        <Kicker>Solve it in one tap</Kicker>
        <h2 className="text-3xl md:text-[2.6rem] font-bold tracking-tight leading-tight text-slate-900">Shop by need</h2>
      </div>
      <WayGrid items={needs} />
    </section>
  );
}


function ShieldCheckIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6l-7-3Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function ReturnIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 7h13a5 5 0 0 1 5 5v0a5 5 0 0 1-5 5H8" />
      <path d="m7 3-4 4 4 4" />
    </svg>
  );
}

export function TrustStrip() {
  const perks = [
    { title: "Cash on delivery", copy: "Available nationwide", icon: <ShieldCheckIcon size={18} /> },
    { title: "Free shipping", copy: "On orders over Rs 5,000", icon: <TruckIcon size={18} /> },
    { title: "7-day returns", copy: "Simple, no-questions support", icon: <ReturnIcon size={18} /> },
    { title: "WhatsApp support", copy: "Quick order assistance", icon: <PhoneIcon size={18} /> },
  ];

  return (
    <section className="max-w-7xl mx-auto px-6 pt-12 md:pt-16">
      <div className="grid grid-cols-2 gap-3 rounded-2xl bg-white p-5 ring-1 ring-slate-900/5 shadow-[0_1px_2px_rgba(16,42,36,0.04),0_12px_32px_-18px_rgba(16,42,36,0.18)] sm:grid-cols-4 md:gap-4 md:p-7">
        {perks.map((perk) => (
          <div key={perk.title} className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-teal-50 text-teal-700 ring-1 ring-teal-100">
              {perk.icon}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-slate-900">{perk.title}</span>
              <span className="block text-xs text-slate-500 truncate">{perk.copy}</span>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---------- StatsStrip — live credibility numbers ---------- */
export function StatsStrip() {
  const { products, categories, loading } = useProducts();
  const reviews = products.reduce((sum, p) => sum + (p.reviews || 0), 0);
  const rating = products.length
    ? products.reduce((sum, p) => sum + (p.rating || 0), 0) / products.length
    : 0;
  const stats = [
    { big: loading ? "—" : `${products.length}`, label: "Products", suffix: "+" },
    { big: loading ? "—" : `${categories.length}`, label: "Categories", suffix: "" },
    { big: loading ? "—" : rating ? rating.toFixed(1) : "—", label: "Average rating", star: true },
    { big: loading ? "—" : reviews.toLocaleString("en-PK"), label: "Customer reviews", suffix: "+" },
  ];
  return (
    <section className="max-w-7xl mx-auto px-6 py-6 md:py-8">
      <div className="grid grid-cols-2 gap-y-6 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="flex items-baseline gap-2">
            <p className="font-display text-4xl md:text-5xl font-bold tracking-tight text-slate-900">
              {s.big}
            </p>
            {"star" in s && s.star ? (
              <StarIcon size={22} className="mb-1.5 text-amber-400" />
            ) : (
              s.suffix && <span className="text-2xl font-bold text-teal-600">{s.suffix}</span>
            )}
            <p className="ml-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">{s.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
