import { useEffect, useMemo, useState } from "react";
import { Link, useRouter } from "../router";
import { useProducts, useUI } from "../context/store";
import ProductCard from "../components/ProductCard";
import RecentlyViewed from "../components/RecentlyViewed";
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
  const [visible, setVisible] = useState(12);
  const [priceBand, setPriceBand] = useState("all");
  const [inStockOnly, setInStockOnly] = useState(false);
  const [topRatedOnly, setTopRatedOnly] = useState(false);

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

  const clear = () => {
    setCat("all");
    setSearchQuery("");
    setSort("featured");
    setPriceBand("all");
    setInStockOnly(false);
    setTopRatedOnly(false);
  };

  const catBtn = (id: string, name: string) => (
    <button
      key={id}
      onClick={() => setCat(id)}
      className={`text-left px-4 py-2.5 rounded-lg text-sm font-medium transition whitespace-nowrap ${
        cat === id
          ? "bg-slate-900 text-white"
          : "surface-muted text-slate-600 hover:text-slate-900 lg:bg-transparent lg:border-transparent lg:hover:bg-white/50"
      }`}
    >
      {name}
    </button>
  );

  return (
    <main id="main-content" className="pt-[120px] md:pt-44 max-w-7xl mx-auto px-6 pb-10">
      {/* breadcrumb */}
      <nav className="text-xs text-slate-400 mb-3">
        <Link to="/" className="hover:text-slate-900">Home</Link>
        <span className="mx-1.5">/</span>
        <span className="text-slate-600 font-medium">Shop</span>
      </nav>
      <h1 className="text-3xl font-black text-slate-900">Shop All Products</h1>
      <p className="text-sm text-slate-500 mt-1 mb-6">
        Every accessory, one place. Filter, sort, and find your fit.
        {offline && <span className="ml-2 text-amber-600 font-semibold">⚠ Offline mode — showing local catalog</span>}
      </p>

      <div className="lg:grid lg:grid-cols-[220px_1fr] lg:gap-8">
        {/* sidebar (desktop) */}
        <aside className="hidden lg:block">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-2">Categories</p>
          <div className="flex flex-col gap-1">
            {catBtn("all", "All Products")}
            {categories.map((c) => catBtn(c.id, `${c.icon} ${c.name}`))}
          </div>
        </aside>

        <div>
          {/* chip row (mobile) */}
          <div className="lg:hidden flex gap-2 overflow-x-auto no-scrollbar pb-3 -mx-1 px-1">
            {catBtn("all", "All")}
            {categories.map((c) => catBtn(c.id, c.name))}
          </div>

          {/* search + sort */}
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search in shop…"
              className="flex-1 rounded-lg surface-muted px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-slate-300/80"
            />
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="rounded-lg surface-muted px-3 py-2.5 text-sm outline-none"
            >
              {SORTS.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </div>

          {/* refinement chips */}
          <div className="flex gap-2 flex-wrap mb-4">
            <select
              value={priceBand}
              onChange={(e) => setPriceBand(e.target.value)}
              className="rounded-lg surface-muted px-3 py-1.5 text-xs font-semibold outline-none"
            >
              {PRICE_BANDS.map((b) => (
                <option key={b.id} value={b.id}>{b.label}</option>
              ))}
            </select>
            <button
              onClick={() => setInStockOnly((v) => !v)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                inStockOnly ? "bg-slate-900 text-white" : "surface-muted text-slate-600 hover:text-slate-900"
              }`}
            >
              ✓ In stock
            </button>
            <button
              onClick={() => setTopRatedOnly((v) => !v)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                topRatedOnly ? "bg-slate-900 text-white" : "surface-muted text-slate-600 hover:text-slate-900"
              }`}
            >
              ★ 4+ rated
            </button>
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
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} />)}
            </div>
          ) : list.length === 0 ? (
            <div className="py-12">
              <div className="text-center mb-8">
                <div className="text-5xl mb-4">🔎</div>
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
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-amber-600 mb-1">Meanwhile</p>
              <h3 className="text-lg font-black text-slate-900 mb-4">Customers are loving these</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {products.filter((p) => p.bestSeller).slice(0, 4).map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                {list.slice(0, visible).map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
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
      <RecentlyViewed />
    </main>
  );
}
