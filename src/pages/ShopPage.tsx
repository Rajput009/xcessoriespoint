import { useEffect, useMemo, useState } from "react";
import { useRouter } from "../router";
import { useProducts, useUI } from "../context/store";
import ProductCard from "../components/ProductCard";
import CategoryLogo from "../components/CategoryLogo";
import ViewToggle, { type ProductView } from "../components/ViewToggle";
import RecentlyViewed from "../components/RecentlyViewed";
import { BoltMark, Kicker } from "../components/brand";
import { SlidersIcon } from "../components/icons";
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
  { id: "all", label: "Any price", short: "Any price", min: 0, max: Infinity },
  { id: "u2", label: "Under Rs 2,000", short: "Under 2k", min: 0, max: 1999 },
  { id: "2-5", label: "Rs 2,000–5,000", short: "2k–5k", min: 2000, max: 5000 },
  { id: "5-10", label: "Rs 5,000–10,000", short: "5k–10k", min: 5001, max: 10000 },
  { id: "10p", label: "Over Rs 10,000", short: "Over 10k", min: 10001, max: Infinity },
];

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
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-4xl">Shop all products</h1>
          <p className="mt-0.5 text-sm leading-5 text-slate-500 sm:max-w-xl">
            Curated gear, clear prices, and COD across Pakistan.
            {offline && <span className="ml-2 font-semibold text-amber-600">Offline catalog</span>}
          </p>
        </div>
        <p className="hidden shrink-0 font-mono text-xs font-semibold text-slate-400 sm:block">{loading ? "Loading" : `${list.length} items`}</p>
      </div>

      {/* search — one clear full-width field */}
      <div className="mb-3">
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search products…"
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/15"
        />
      </div>

      {/* mobile — a single Filter button (opens the sheet), sort, and view */}
      <div className="mb-4 flex items-center gap-2 sm:hidden">
        <button
          type="button"
          onClick={() => setFilterOpen(true)}
          className={`flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-sm font-bold ${
            activeFilterCount || cat !== "all"
              ? "border-teal-700 bg-teal-50 text-teal-800"
              : "border-slate-200 bg-white text-slate-700"
          }`}
        >
          <SlidersIcon size={16} />
          <span className="truncate">Filter</span>
          {(activeFilterCount > 0 || cat !== "all") && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-teal-700 px-1.5 text-[11px] font-bold text-white">
              {activeFilterCount + (cat !== "all" ? 1 : 0)}
            </span>
          )}
        </button>
        <select
          aria-label="Sort products"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="shrink-0 rounded-xl border border-slate-200 bg-white py-2.5 pl-3 pr-8 text-sm font-semibold text-slate-700 outline-none focus:border-teal-500"
        >
          {SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
        <ViewToggle view={view} onChange={setView} />
      </div>

      {/* desktop — easy filters, all visible as one-tap pills */}
      <div className="mb-5 hidden space-y-2.5 rounded-2xl bg-white p-4 ring-1 ring-slate-900/5 shadow-[0_1px_2px_rgba(16,42,36,0.04),0_12px_32px_-20px_rgba(16,42,36,0.25)] sm:block">
        {/* categories — logos so each section is obvious; All first */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar -mx-1 px-1 pb-0.5">
          <button
            type="button"
            aria-pressed={cat === "all"}
            onClick={() => setCat("all")}
            className={`flex shrink-0 items-center gap-1.5 rounded-full py-1.5 pl-2.5 pr-4 text-sm font-semibold transition-colors ${
              cat === "all"
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            All
          </button>
          {categories.map((c) => {
            const on = cat === c.id;
            return (
              <button
                key={c.id}
                type="button"
                aria-pressed={on}
                onClick={() => setCat(on ? "all" : c.id)}
                className={`flex shrink-0 items-center gap-1.5 rounded-full py-1.5 pl-1.5 pr-4 text-sm font-semibold transition-colors ${
                  on ? "bg-teal-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-teal-50 hover:text-teal-800"
                }`}
              >
                <CategoryLogo category={c} size={24} variant="plain" active={on} />
                {c.name}
              </button>
            );
          })}
        </div>

        {/* price, quick toggles, sort, view */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar -mx-1 px-1 pb-0.5">
          {PRICE_BANDS.map((b) => {
            const on = priceBand === b.id;
            return (
              <button
                key={b.id}
                type="button"
                aria-pressed={on}
                title={b.label}
                onClick={() => setPriceBand(on ? "all" : b.id)}
                className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                  on ? "bg-teal-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {b.short}
              </button>
            );
          })}

          <span className="h-5 w-px shrink-0 bg-slate-200" aria-hidden="true" />

          <button
            type="button"
            aria-pressed={inStockOnly}
            onClick={() => setInStockOnly((v) => !v)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${
              inStockOnly ? "bg-teal-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {inStockOnly ? "✓ In stock" : "In stock"}
          </button>
          <button
            type="button"
            aria-pressed={topRatedOnly}
            onClick={() => setTopRatedOnly((v) => !v)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${
              topRatedOnly ? "bg-teal-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {topRatedOnly ? "✓ 4★ & up" : "4★ & up"}
          </button>

          <span className="flex-1" aria-hidden="true" />

          {(activeFilterCount > 0 || cat !== "all" || sort !== "featured") && (
            <button
              type="button"
              onClick={clear}
              className="shrink-0 rounded-full px-3 py-1.5 text-sm font-bold text-slate-500 underline decoration-dotted underline-offset-2 hover:text-teal-700"
            >
              Reset
            </button>
          )}

          <select
            aria-label="Sort products"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="shrink-0 rounded-full border border-slate-200 bg-white py-1.5 pl-3.5 pr-8 text-sm font-semibold text-slate-700 outline-none focus:border-teal-500"
          >
            {SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
          <ViewToggle view={view} onChange={setView} />
        </div>
      </div>

      {/* mobile filter sheet */}
      {filterOpen && (
        <div className="fixed inset-0 z-[60] sm:hidden" role="dialog" aria-modal="true" aria-label="Filter products">
          <button type="button" aria-label="Close filters" onClick={() => setFilterOpen(false)} className="absolute inset-0 bg-slate-950/40" />
          <div className="absolute inset-x-0 bottom-0 flex max-h-[88vh] flex-col rounded-t-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h2 className="text-base font-bold text-slate-900">
                Filters
                {(activeFilterCount > 0 || cat !== "all") && (
                  <span className="ml-2 rounded-full bg-teal-100 px-2 py-0.5 text-xs font-bold text-teal-800">
                    {activeFilterCount + (cat !== "all" ? 1 : 0)}
                  </span>
                )}
              </h2>
              <button type="button" onClick={() => setFilterOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-2xl leading-none text-slate-500" aria-label="Close filters">×</button>
            </div>

            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
              <fieldset>
                <legend className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Category</legend>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setCat("all")}
                    className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                      cat === "all" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    All
                  </button>
                  {categories.map((c) => {
                    const on = cat === c.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setCat(on ? "all" : c.id)}
                        className={`flex items-center gap-1.5 rounded-full py-1.5 pl-1.5 pr-3.5 text-sm font-semibold transition-colors ${
                          on ? "bg-teal-600 text-white" : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        <CategoryLogo category={c} size={22} variant="plain" active={on} />
                        {c.name}
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              <fieldset>
                <legend className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Price</legend>
                <div className="flex flex-wrap gap-2">
                  {PRICE_BANDS.map((b) => {
                    const on = priceBand === b.id;
                    return (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => setPriceBand(on ? "all" : b.id)}
                        className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                          on ? "bg-teal-600 text-white" : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {b.short}
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              <fieldset>
                <legend className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Availability</legend>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setInStockOnly((v) => !v)}
                    className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                      inStockOnly ? "bg-teal-600 text-white" : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {inStockOnly ? "✓ In stock" : "In stock"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setTopRatedOnly((v) => !v)}
                    className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                      topRatedOnly ? "bg-teal-600 text-white" : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {topRatedOnly ? "✓ 4★ & up" : "4★ & up"}
                  </button>
                </div>
              </fieldset>
            </div>

            <div className="flex gap-2 border-t border-slate-100 px-5 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
              <button type="button" onClick={clear} className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700">Reset</button>
              <button type="button" onClick={() => setFilterOpen(false)} className="flex-[1.6] rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white">
                Show {list.length} products
              </button>
            </div>
          </div>
        </div>
      )}

      <div>
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
                  className="btn-primary px-6 py-3"
                >
                  Clear filters
                </button>
              </div>
              <Kicker center className="text-amber-600">Meanwhile</Kicker>
              <h3 className="text-lg font-bold text-slate-900 mb-4">Customers are loving these</h3>
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
                    className="btn-primary px-8 py-3.5 text-sm"
                  >
                    Load more ({list.length - visible} remaining)
                  </button>
                </div>
              )}
            </>
          )}
      </div>

      <RecentlyViewed />
    </main>
  );
}
