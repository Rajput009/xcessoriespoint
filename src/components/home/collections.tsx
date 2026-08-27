import { useMemo } from "react";
import { Link } from "../../router";
import { useProducts } from "../../context/store";
import type { Product } from "../../types";
import ProductCard from "../ProductCard";
import { PhoneIcon, TruckIcon } from "../icons";

function brandOf(product: Product) {
  return product.brand?.trim() || product.name.trim().split(/\s+/)[0] || "Other";
}

export function ShopByBrand() {
  const { products } = useProducts();
  const brands = useMemo(() => {
    const groups = new Map<string, number>();
    products.forEach((product) => {
      const brand = brandOf(product);
      groups.set(brand, (groups.get(brand) ?? 0) + 1);
    });
    return [...groups]
      .filter(([, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 8);
  }, [products]);

  if (brands.length === 0) return null;

  return (
    <section className="max-w-7xl mx-auto px-6 py-10">
      <div className="flex items-end justify-between gap-4 mb-5">
        <h2 className="text-2xl md:text-3xl font-black text-slate-900">Shop by Brand</h2>
        <Link to="/shop" className="text-sm font-bold text-blue-700 hover:text-blue-900">
          View all →
        </Link>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {brands.map(([brand, count]) => (
          <Link
            key={brand}
            to={`/shop?q=${encodeURIComponent(brand)}`}
            className="group flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-3.5 transition hover:border-blue-300 hover:shadow-md hover:shadow-blue-900/10"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-sm font-black text-blue-700">
              {brand.slice(0, 2).toUpperCase()}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold text-slate-900 group-hover:text-blue-700">{brand}</span>
              <span className="block text-[11px] text-slate-400">{count} products</span>
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

const DEVICE_GROUPS = [
  {
    label: "Wireless audio",
    copy: "Earbuds & headphones",
    to: "/category/audio",
    matches: (product: Product) => product.category === "audio",
  },
  {
    label: "USB-C devices",
    copy: "Chargers, cables & hubs",
    to: "/shop?q=USB-C",
    matches: (product: Product) => /usb[- ]?c|usb-c|gan|charger|power bank|hub/i.test(`${product.name} ${product.description ?? ""}`),
  },
  {
    label: "Wearables",
    copy: "Watches & fitness bands",
    to: "/category/wearables",
    matches: (product: Product) => product.category === "wearables",
  },
  {
    label: "Phone protection",
    copy: "Slim & rugged cases",
    to: "/category/cases",
    matches: (product: Product) => product.category === "cases",
  },
];

export function ShopByDevice() {
  const { products } = useProducts();
  const groups = DEVICE_GROUPS.map((group) => ({
    ...group,
    count: products.filter(group.matches).length,
  })).filter((group) => group.count > 0);

  if (groups.length === 0) return null;

  return (
    <section className="max-w-7xl mx-auto px-6 py-10">
      <div className="flex items-end justify-between gap-4 mb-5">
        <h2 className="text-2xl md:text-3xl font-black text-slate-900">Shop by Device &amp; Connection</h2>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {groups.map((group) => (
          <Link
            key={group.label}
            to={group.to}
            className="group rounded-xl border border-slate-200 bg-white px-4 py-4 transition hover:border-blue-300 hover:shadow-md hover:shadow-blue-900/10"
          >
            <span className="block text-sm font-bold text-slate-900 group-hover:text-blue-700">{group.label}</span>
            <span className="mt-1 block text-xs text-slate-500">{group.copy}</span>
            <span className="mt-3 block text-[11px] font-semibold text-blue-700">{group.count} products →</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

const NEEDS = [
  { label: "Travel charging", copy: "Power banks & compact chargers", to: "/category/power" },
  { label: "Desk setup", copy: "Hubs, cables & fast charging", to: "/category/cables" },
  { label: "Everyday audio", copy: "Simple sound for every commute", to: "/category/audio" },
  { label: "Everyday protection", copy: "Slim and rugged phone cases", to: "/category/cases" },
];

export function ShopByNeed() {
  return (
    <section className="max-w-7xl mx-auto px-6 py-10">
      <div className="flex items-end justify-between gap-4 mb-5">
        <h2 className="text-2xl md:text-3xl font-black text-slate-900">Shop by Need</h2>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {NEEDS.map((need) => (
          <Link
            key={need.label}
            to={need.to}
            className="group rounded-xl bg-slate-900 px-4 py-5 text-white transition hover:bg-blue-950"
          >
            <span className="block text-sm font-bold group-hover:text-sky-300">{need.label}</span>
            <span className="mt-1 block text-xs leading-relaxed text-slate-300">{need.copy}</span>
            <span className="mt-4 block text-[11px] font-bold text-sky-300">Explore →</span>
          </Link>
        ))}
      </div>
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
      <div className="grid grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 rounded-2xl border border-slate-200 bg-white">
        {perks.map((perk) => (
          <div key={perk.title} className="flex items-center gap-3 px-4 py-4 md:px-5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-sm font-black text-blue-700">
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
