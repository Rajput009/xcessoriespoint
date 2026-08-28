import { useMemo } from "react";
import { Link } from "../../router";
import { useProducts, fmt } from "../../context/store";
import type { Product } from "../../types";
import ProductCard from "../ProductCard";
import { PhoneIcon, TruckIcon } from "../icons";

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
    <section className="max-w-7xl mx-auto px-6 py-10">
      <div className="mb-6">
        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">Trusted names</p>
        <h2 className="text-2xl md:text-3xl font-black text-slate-900">Popular Brands</h2>
      </div>
      {/* open logo strip — no cards: brands float on the page edge-to-edge */}
      <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-6 border-y border-slate-200 py-7 md:justify-between">
        {BRAND_LOGOS.map((brand) => (
          <Link
            key={brand.name}
            to="/shop"
            aria-label={`Browse ${brand.name}`}
            className="group flex flex-col items-center gap-1.5 transition-transform duration-200 hover:-translate-y-0.5"
          >
            <img
              src={brand.logo}
              alt={`${brand.name} logo`}
              className="h-8 max-w-[140px] object-contain opacity-80 transition duration-200 group-hover:opacity-100 group-hover:scale-105"
            />
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400 transition-colors group-hover:text-slate-900">
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
        <section key={category.id} className="max-w-7xl mx-auto px-6 py-9">
          <div className="flex items-end justify-between gap-4 mb-5">
            <h2 className="text-2xl md:text-3xl font-black text-slate-900">{category.name}</h2>
            <Link to={`/category/${category.id}`} className="text-sm font-bold text-blue-700 hover:text-blue-900">
              View all →
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
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
    copy: "Power banks & compact chargers",
    to: "/category/power",
    img: "/img/powerbank.jpg",
    match: (product: Product) => product.category === "power",
  },
  {
    label: "Desk setup",
    copy: "Hubs, cables & fast charging",
    to: "/category/cables",
    img: "/img/charger-2.jpg",
    match: (product: Product) => product.category === "cables",
  },
  {
    label: "Everyday audio",
    copy: "Simple sound for every commute",
    to: "/category/audio",
    img: "/img/headphones.jpg",
    match: (product: Product) => product.category === "audio",
  },
  {
    label: "Everyday protection",
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
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 md:gap-6">
      {items.map((g) => (
        <Link
          key={g.label}
          to={g.to}
          className="group block focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600"
        >
          <span className="block aspect-square rounded-lg bg-slate-100 overflow-hidden transition-transform duration-200 group-hover:scale-[1.02]">
            <img
              src={g.img}
              alt=""
              loading="lazy"
              decoding="async"
              width={480}
              height={480}
              className="w-full h-full object-contain transition-transform duration-500 group-hover:scale-105"
            />
          </span>
          <span className="block pt-3">
            <span className="flex items-center gap-1.5">
              <span className="text-sm md:text-base font-black text-slate-900 leading-tight transition-colors group-hover:text-slate-600">
                {g.label}
              </span>
              <span aria-hidden="true" className="text-slate-300 transition-all group-hover:text-slate-900 group-hover:translate-x-1">
                →
              </span>
            </span>
            <span className="mt-0.5 block text-xs text-slate-500">{g.copy}</span>
            <span className="mt-1 block text-xs font-semibold text-slate-400">
              {g.count} {g.count === 1 ? "product" : "products"}
              {g.fromPrice > 0 && (
                <>
                  {" "}· from <span className="text-slate-600">{fmt(g.fromPrice)}</span>
                </>
              )}
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
    <section className="max-w-7xl mx-auto px-6 py-10">
      <div className="mb-8">
        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">Find it fast</p>
        <h2 className="text-2xl md:text-3xl font-black text-slate-900">Shop by Device &amp; Connection</h2>
      </div>
      <WayGrid items={groups} />
    </section>
  );
}

export function ShopByNeed() {
  const needs = useGroupStats(NEEDS);
  if (needs.length === 0) return null;
  return (
    <section className="max-w-7xl mx-auto px-6 py-10">
      <div className="mb-8">
        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">Solve it in one tap</p>
        <h2 className="text-2xl md:text-3xl font-black text-slate-900">Shop by Need</h2>
      </div>
      <WayGrid items={needs} />
    </section>
  );
}

export function TrustStrip() {
  const perks = [
    { title: "Cash on Delivery", copy: "Available nationwide", icon: "✓" },
    { title: "Free shipping", copy: "On orders over Rs 5,000", icon: <TruckIcon size={18} /> },
    { title: "7-day returns", copy: "Simple return support", icon: "↩" },
    { title: "WhatsApp support", copy: "Quick order assistance", icon: <PhoneIcon size={18} /> },
  ];

  return (
    <section className="max-w-7xl mx-auto px-6 py-10">
      <div className="mb-8">
        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">Shop with confidence</p>
        <h2 className="text-2xl md:text-3xl font-black text-slate-900 sr-only">Why shop with us</h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-10 gap-y-6">
        {perks.map((perk) => (
          <div key={perk.title} className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-sm font-black text-slate-700">
              {perk.icon}
            </span>
            <span>
              <span className="block text-xs font-bold text-slate-900">{perk.title}</span>
              <span className="block text-[11px] text-slate-500">{perk.copy}</span>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---------- StatsStrip — live credibility numbers (Amaze-style) ---------- */
export function StatsStrip() {
  const { products, categories, loading } = useProducts();
  const reviews = products.reduce((sum, p) => sum + (p.reviews || 0), 0);
  const rating = products.length
    ? products.reduce((sum, p) => sum + (p.rating || 0), 0) / products.length
    : 0;
  const stats = [
    { big: loading ? "—" : `${products.length}`, label: "Products", suffix: "+" },
    { big: loading ? "—" : `${categories.length}`, label: "Categories", suffix: "" },
    { big: loading ? "—" : rating ? rating.toFixed(1) : "—", label: "Average rating", suffix: "★" },
    { big: loading ? "—" : reviews.toLocaleString("en-PK"), label: "Customer reviews", suffix: "+" },
  ];
  return (
    <section className="max-w-7xl mx-auto px-6 py-10">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-10 gap-y-8">
        {stats.map((s) => (
          <div key={s.label}>
            <p className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight">
              {s.big}
              {s.suffix && <span className="text-slate-300 ml-1">{s.suffix}</span>}
            </p>
            <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">{s.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
