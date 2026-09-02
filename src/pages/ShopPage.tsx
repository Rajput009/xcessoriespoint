import { useEffect, useMemo, useState } from "react";
import { SlidersIcon, StarIcon } from "../components/icons";
import { Link, useRouter } from "../router";
import { useProducts, useUI } from "../context/store";
import ProductCard from "../components/ProductCard";
import ViewToggle, { type ProductView } from "../components/ViewToggle";
import RecentlyViewed from "../components/RecentlyViewed";
import { BoltMark, Kicker } from "../components/brand";
import { smartSearch, didYouMean } from "../lib/fuzzy";
import { track } from "../lib/tracking";
import { pixelTrack } from "../lib/pixel";

const SORTS = [
  { id: "featured", label: "Featured" },
  { id: "price-asc", label: "Price: Low → High" },
  { id: "price-desc", label: "Price: High → Low" },
  { id: "rating", label: "Top Rated" },
  { id: "discount", label: "Biggest Discount" },
  { id: "name", label: "Name A–Z" },
];

const PRICE_BANDS = [
  { id: "all", label: "Any price", min: 0, max: Infinity },
  { id: "u2", label: "Under Rs 2,000", min: 0, max: 1999 },
  { id: "2-5", label: "Rs 2,000–5,000", min: 2000, max: 5000 },
  { id: "5-10", label: "Rs 5,000–10,000", min: 5001, max: 10000 },
  { id: "10p", label: "Over Rs 10,000", min: 10001, max: Infinity },
];

const SHORT_SORTS: Record<string, string> = {
  featured: "Featured",
  "price-asc": "Price low",
  "price-desc": "Price high",
  rating: "Top rated",
  discount: "Discount",
  name: "A–Z",
};

function Skeleton() {
  return (
    <div className="surface-muted rounded-lg overflow-hidden animate-pulse">
      <div className="aspect-square bg-slate-100" />
      <div className="p-4 space-y-2.5">
        <div className="h-3 bg-slate-100 rounded w-1/3" />
        <div className="h-4 bg-slate-100 rounded w-4/5" />
        <div className="h-3 bg-slate-100 rounded w-1/2" />
        <div className="h-9 bg-slate-100 rounded-lg" />
      </div>
    </div>
  );
}

export default function ShopPage() {
  const { products, categories, loading, offline } = useProducts();
  const { query } = useRouter();
  const { searchQuery, setSearchQuery } = useUI();
  const [cat, setCat] = useState(query.get("cat") || "all");
  const [sort, setSort] = useState("featured");
  const [view, setView] = useState<ProductView>("grid");
  const [visible, setVisible] = useState(12);
  const [priceBand, setPriceBand] = useState("all");
  const [inStockOnly, setInStockOnly] = useState(false);
  const [topRatedOnly, setTopRatedOnly] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);

  // sync from URL (?cat= & ?q=)
  useEffect(() => {
    setCat(query.get("cat") || "all");
    const q = query.get("q");
    if (q !== null) setSearchQuery(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  // consent-gated search analytics (debounced) — records zero-result searches for merchandising
  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) return;
    const t = setTimeout(() => {
      track("search", { q, results: list.length });
      pixelTrack("Search", { search_string: q });
    }, 900);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  const { list, fuzzyUsed, interpretedAs } = useMemo(() => {
    let l = [...products];
    if (cat !== "all") l = l.filter((p) => p.category === cat);
    const q = searchQuery.trim().toLowerCase();
    let fuzzyUsed = false;
    let interpretedAs: string | null = null;
    if (q) {
      const res = smartSearch(l, q);
      l = res.results;
      fuzzyUsed = res.method === "fuzzy";
      interpretedAs = res.interpretedAs;
    }
    const band = PRICE_BANDS.find((b) => b.id === priceBand) ?? PRICE_BANDS[0];
    l = l.filter((p) => p.price >= band.min && p.price <= band.max);
    if (inStockOnly) l = l.filter((p) => p.stock > 0);
    if (topRatedOnly) l = l.filter((p) => p.rating >= 4);
    const discountPct = (p: (typeof l)[number]) =>
      p.compareAt ? (p.compareAt - p.price) / p.compareAt : 0;
    switch (sort) {
      case "price-asc": l.sort((a, b) => a.price - b.price); break;
      case "price-desc": l.sort((a, b) => b.price - a.price); break;
      case "rating": l.sort((a, b) => b.rating - a.rating); break;
      case "discount": l.sort((a, b) => discountPct(b) - discountPct(a)); break;
      case "name": l.sort((a, b) => a.name.localeCompare(b.name)); break;
    }
    return { list: l, fuzzyUsed, interpretedAs };
  }, [products, cat, searchQuery, sort, priceBand, inStockOnly, topRatedOnly]);

  const suggestion = useMemo(
    () => (searchQuery.trim().length >= 3 && (fuzzyUsed || list.length === 0) ? didYouMean(products, searchQuery) : null),
    [products, searchQuery, fuzzyUsed, list.length]
  );


  useEffect(() => setVisible(12), [cat, searchQuery, sort, priceBand, inStockOnly, topRatedOnly]);

  const activeFilterCount = [priceBand !== "all", inStockOnly, topRatedOnly].filter(Boolean).length;

  const clear = () => {
    setCat("all");
    setSearchQuery("");
    setSort("featured");
    setPriceBand("all");
    setInStockOnly(false);
    setTopRatedOnly(false);
    setFilterOpen(false);
  };

  return (
    <main id="main-content" className="mx-auto max-w-7xl px-2.5 pb-10 pt-[76px] sm:px-6 md:pt-44">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <p className="mb-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-teal-700">The everyday edit</p>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 sm:text-4xl">Shop all products</h1>
          <p className="mt-0.5 text-sm leading-5 text-slate-500 sm:max-w-xl">
            Curated gear, clear prices, and COD across Pakistan.
            {offline && <span className="ml-2 font-semibold text-amber-600">Offline catalog</span>}
          </p>
        </div>
        <p className="hidden shrink-0 font-mono text-xs font-semibold text-slate-400 sm:block">{loading ? "Loading" : `${list.length} items`}</p>
      </div>

      <div className="lg:grid lg:grid-cols-[220px_1fr] lg:gap-8">
        {/* sidebar (desktop) */}
        <aside className="hidden lg:block">
          <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-400" htmlFor="sidebar-category-select">Category</label>
          <select
            id="sidebar-category-select"
            value={cat}
            onChange={(e) => setCat(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-700 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/15"
          >
            <option value="all">All products</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </aside>

        <div>
          {/* search */}
          <div className="mb-2">
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search products…"
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/15"
            />
          </div>

          {/* compact mobile controls: filters, sort, and view stay together */}
          <div className="mb-3 flex items-center gap-1.5 sm:hidden">
            <button
              type="button"
              onClick={() => setFilterOpen(true)}
              className={`flex min-w-0 flex-1 items-center justify-center gap-1 rounded-xl border px-2 py-2 text-sm font-bold ${activeFilterCount ? "border-teal-700 bg-teal-50 text-teal-800" : "border-slate-200 bg-white text-slate-700"}`}
            >
              <SlidersIcon size={15} /> Filters {activeFilterCount > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-teal-700 px-1.5 text-[11px] text-white">{activeFilterCount}</span>}
            </button>
            <button
              type="button"
              onClick={() => setFilterOpen(true)}
              className="flex min-w-0 flex-1 items-center justify-center rounded-xl border border-slate-200 bg-white px-2 py-2 text-sm font-bold text-slate-700"
            >
              Sort · {SHORT_SORTS[sort] ?? "Featured"}
            </button>
            <ViewToggle view={view} onChange={setView} />
          </div>

          {/* desktop sort and view controls */}
          <div className="mb-4 hidden items-center justify-end gap-2 sm:flex">
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none"
            >
              {SORTS.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
            <ViewToggle view={view} onChange={setView} />
          </div>

          <div className="mb-5 hidden sm:block">
            <label className="sr-only" htmlFor="category-select">Category</label>
            <select
              id="category-select"
              value={cat}
              onChange={(e) => setCat(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/15"
            >
              <option value="all">All products</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {/* synonym interpretation notice (Urdu / Roman-Urdu / market terms) */}
          {searchQuery.trim() && !fuzzyUsed && interpretedAs && list.length > 0 && (
            <div className="surface-muted rounded-lg px-4 py-2.5 mb-4 text-sm text-slate-600">
              Showing results for "<span className="font-bold text-slate-900">{interpretedAs}</span>"
              <span className="text-slate-400"> (searched: "{searchQuery}")</span>
            </div>
          )}

          {/* typo-tolerance notices */}
          {searchQuery.trim() && fuzzyUsed && list.length > 0 && (
            <div className="surface-muted rounded-lg px-4 py-2.5 mb-4 text-sm text-slate-600">
              No exact matches for "<span className="font-bold">{searchQuery}</span>" — showing the closest matches.
              {suggestion && (
                <>
                  {" "}Did you mean{" "}
                  <button
                    onClick={() => setSearchQuery(suggestion)}
                    className="font-bold text-slate-900 underline decoration-dotted hover:text-slate-600"
                  >
                    {suggestion}
                  </button>
                  ?
                </>
              )}
            </div>
          )}

          {/* count + clear */}
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-slate-500">
              {loading ? "Loading products…" : `${list.length} product${list.length === 1 ? "" : "s"}`}
            </p>
            {(cat !== "all" || searchQuery || sort !== "featured" || priceBand !== "all" || inStockOnly || topRatedOnly) && (
              <button onClick={clear} className="text-sm font-semibold text-slate-600 hover:text-slate-900 hover:underline">
                Clear filters
              </button>
            )}
          </div>

          {/* grid / skeletons / empty */}
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
              {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} />)}
            </div>
          ) : list.length === 0 ? (
            <div className="py-12">
              <div className="text-center mb-8">
              <div className="flex justify-center mb-4">
                <BoltMark size={72} sw={5} className="text-slate-200" />
              </div>
                <p className="font-bold text-slate-900 mb-1">
                  No products found{searchQuery.trim() ? ` for "${searchQuery}"` : ""}
                </p>
                {suggestion ? (
                  <p className="text-sm text-slate-500 mb-5">
                    Did you mean{" "}
                    <button
                      onClick={() => setSearchQuery(suggestion)}
                      className="font-bold text-slate-900 underline decoration-dotted hover:text-slate-600"
                    >
                      {suggestion}
                    </button>
                    ?
                  </p>
                ) : (
                  <p className="text-sm text-slate-500 mb-5">Try a different search or category.</p>
                )}
                <button
                  onClick={clear}
                  className="px-6 py-2.5 rounded-lg bg-slate-900 text-white font-semibold hover:bg-slate-700 transition"
                >
                  Clear filters
                </button>
              </div>
              <Kicker center className="text-amber-600">Meanwhile</Kicker>
              <h3 className="text-lg font-black text-slate-900 mb-4">Customers are loving these</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {products.filter((p) => p.bestSeller).slice(0, 4).map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
            </div>
          ) : (
            <>
              {view === "list" ? (
                <div className="flex flex-col gap-3">
                  {list.slice(0, visible).map((p) => (
                    <ProductCard key={p.id} product={p} view="list" />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 md:gap-4">
                  {list.slice(0, visible).map((p) => (
                    <ProductCard key={p.id} product={p} />
                  ))}
                </div>
              )}
              {list.length > visible && (
                <div className="text-center mt-8">
                  <button
                    onClick={() => setVisible((v) => v + 12)}
                    className="px-8 py-3 rounded-lg bg-slate-900 text-white font-bold text-sm hover:bg-slate-700 transition-all"
                  >
                    Load more ({list.length - visible} remaining)
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {filterOpen && (
        <div className="fixed inset-0 z-[60] sm:hidden" role="dialog" aria-modal="true" aria-label="Product filters">
          <button type="button" aria-label="Close filters" onClick={() => setFilterOpen(false)} className="absolute inset-0 bg-slate-950/35" />
          <div className="absolute inset-y-0 right-0 flex w-[min(88vw,380px)] flex-col bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-teal-700">Refine results</p>
                <h2 className="mt-1 text-xl font-black text-slate-900">Filters</h2>
              </div>
              <button type="button" onClick={() => setFilterOpen(false)} className="rounded-lg px-2 py-1 text-2xl leading-none text-slate-400" aria-label="Close filters">×</button>
            </div>
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto">
              <label className="block text-sm font-bold text-slate-900">Sort by
                <select value={sort} onChange={(e) => setSort(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium outline-none">
                  {SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </label>
              <label className="block text-sm font-bold text-slate-900">Price range
                <select value={priceBand} onChange={(e) => setPriceBand(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium outline-none">
                  {PRICE_BANDS.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setInStockOnly((v) => !v)} className={`rounded-xl border px-3 py-3 text-sm font-bold ${inStockOnly ? "border-teal-700 bg-teal-50 text-teal-800" : "border-slate-200 bg-white text-slate-700"}`}>{inStockOnly ? "✓ In stock" : "In stock"}</button>
                <button type="button" onClick={() => setTopRatedOnly((v) => !v)} className={`rounded-xl border px-3 py-3 text-sm font-bold ${topRatedOnly ? "border-teal-700 bg-teal-50 text-teal-800" : "border-slate-200 bg-white text-slate-700"}`}>{topRatedOnly ? "✓ 4+ rated" : "4+ rated"}</button>
              </div>
            </div>
            <div className="mt-6 flex gap-2 border-t border-slate-100 pt-4">
              <button type="button" onClick={clear} className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700">Clear all</button>
              <button type="button" onClick={() => setFilterOpen(false)} className="flex-[1.5] rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white">Show {list.length} products</button>
            </div>
          </div>
        </div>
      )}

      <RecentlyViewed />
    </main>
  );
}
