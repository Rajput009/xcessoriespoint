import { useCallback, useEffect, useState } from "react";
import { Link, useRouter } from "../router";
import { useCart, useWishlist, useAuth, useUI, useProducts, fmt } from "../context/store";
import {
  SearchIcon, HeartIcon, CartIcon, UserIcon, PhoneIcon,
  MenuIcon, ZapIcon, TruckIcon,
} from "./icons";
import { smartSearch } from "../lib/fuzzy";

const ANNOUNCEMENTS = [
  { icon: <TruckIcon size={14} />, text: "Free shipping on orders over Rs 5,000" },
  { icon: <ZapIcon size={14} />, text: "Flash sale — up to 40% off audio this week" },
  { icon: <PhoneIcon size={14} />, text: "COD available nationwide · 7-day returns" },
];

function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`font-black tracking-tight whitespace-nowrap text-slate-900 ${compact ? "[font-size:clamp(1rem,4.8vw,1.2rem)]" : "text-2xl"}`}>
      Xccessories<span className="text-emerald-700">Point</span>
    </span>
  );
}

const POPULAR_SEARCHES = ["Earbuds", "Smartwatch", "Power bank", "Fast charger", "Phone case"];

function SearchSuggestions({ query, onPick }: { query: string; onPick: () => void }) {
  const { products } = useProducts();
  const { navigate } = useRouter();
  const { setSearchQuery } = useUI();
  const trimmed = query.trim();
  const q = trimmed.toLowerCase();

  const chooseSearch = (term: string) => {
    setSearchQuery(term);
    onPick();
    navigate(`/shop?q=${encodeURIComponent(term)}`);
  };

  // Clicking into an empty search field opens useful, low-friction suggestions.
  if (q.length < 2) {
    const featured = products.filter((p) => p.bestSeller || p.featured).slice(0, 3);
    return (
      <div className="absolute top-full left-0 right-0 mt-2 surface !bg-white rounded-2xl shadow-xl shadow-slate-900/10 overflow-hidden z-50 p-4">
        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-emerald-700 mb-3">Popular searches</p>
        <div className="flex flex-wrap gap-2">
          {POPULAR_SEARCHES.map((term) => (
            <button
              key={term}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                chooseSearch(term);
              }}
              className="surface-muted rounded-full px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-emerald-700 hover:bg-emerald-50 transition-colors"
            >
              {term}
            </button>
          ))}
        </div>
        {featured.length > 0 && (
          <>
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400 mt-4 mb-2">Popular products</p>
            <div className="space-y-1">
              {featured.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onPick();
                    navigate(`/product/${p.id}`);
                  }}
                  className="w-full flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-emerald-50/80 text-left transition-colors"
                >
                  <img src={p.image} alt="" className="w-9 h-9 rounded-lg object-cover" />
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-semibold text-slate-900 truncate">{p.name}</span>
                    <span className="block text-xs text-emerald-700 font-bold">{fmt(p.price)}</span>
                  </span>
                  <span className="text-slate-300" aria-hidden="true">→</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    );
  }

  const res = smartSearch(products, q);
  const matches = res.results.slice(0, 5);
  const fuzzy = res.method === "fuzzy" || res.method === "synonym";
  if (matches.length === 0) return null;
  return (
    <div className="absolute top-full left-0 right-0 mt-2 surface !bg-white rounded-2xl shadow-xl shadow-slate-900/10 overflow-hidden z-50">
      {fuzzy && (
        <p className="px-4 pt-2.5 pb-1 text-[11px] font-semibold text-slate-400">
          {res.interpretedAs ? `Showing "${res.interpretedAs}"` : `Closest matches for "${trimmed}"`}
        </p>
      )}
      {matches.map((p) => (
        <button
          key={p.id}
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            onPick();
            navigate(`/product/${p.id}`);
          }}
          className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-emerald-50/80 text-left transition-colors"
        >
          <img src={p.image} alt="" className="w-10 h-10 rounded-lg object-cover" />
          <span className="flex-1 min-w-0">
            <span className="block text-sm font-semibold text-slate-900 truncate">{p.name}</span>
            <span className="block text-xs text-emerald-700 font-bold">{fmt(p.price)}</span>
          </span>
          {p.badge && <span className="text-[10px] font-bold text-rose-500">{p.badge}</span>}
        </button>
      ))}
    </div>
  );
}

function CollectionDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { products, categories, loading } = useProducts();
  const { navigate } = useRouter();
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (open) setExpanded(null);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const rows = [
    { id: "all", label: "All products", products },
    ...categories.map((c) => ({
      id: c.id,
      label: c.name,
      products: products.filter((p) => p.category === c.id),
    })),
    { id: "new", label: "New arrivals", products: products.filter((p) => p.newArrival) },
  ];

  const goTo = (to: string) => {
    onClose();
    navigate(to);
  };

  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label="Browse product collection">
      <button
        type="button"
        aria-label="Close collection menu"
        onClick={onClose}
        className="absolute inset-0 bg-emerald-950/20"
      />
      <aside
        id="collection-drawer"
        className="collection-drawer relative h-full w-[min(92vw,430px)] bg-white border-r border-white/70 rounded-r-3xl shadow-2xl shadow-emerald-950/20 slide-in-left flex flex-col"
      >
        <div className="relative px-5 pt-6 pb-5 border-b border-white/60">
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-emerald-700 mb-1">The collection</p>
          <p className="text-lg font-black text-slate-950">All categories</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close collection menu"
            className="absolute top-5 right-5 w-9 h-9 rounded-full bg-white text-slate-500 hover:text-emerald-700 hover:bg-white transition-colors flex items-center justify-center"
          >
            <span className="text-2xl font-light leading-none" aria-hidden="true">×</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {rows.map((row) => {
            const isExpanded = expanded === row.id;
            const hasProducts = loading || row.products.length > 0;
            return (
              <div key={row.id} className="border-b border-white/60">
                <button
                  type="button"
                  aria-expanded={isExpanded}
                  aria-controls={`collection-${row.id}`}
                  onClick={() => hasProducts && setExpanded(isExpanded ? null : row.id)}
                  className={`w-full min-h-[64px] px-9 flex items-center justify-between gap-4 text-left transition-colors ${
                    isExpanded ? "bg-emerald-50/70" : "bg-transparent hover:bg-slate-50"
                  }`}
                >
                  <span className={`text-[18px] leading-tight font-medium ${
                    row.id === "all" ? "text-slate-400 uppercase tracking-wide" : "text-slate-700"
                  }`}>
                    {row.label}
                  </span>
                  {hasProducts && (
                    <span
                      className={`w-2.5 h-2.5 shrink-0 border-r-2 border-b-2 border-emerald-600 rotate-45 -translate-y-1 transition-transform ${
                        isExpanded ? "rotate-[225deg] translate-y-1" : ""
                      }`}
                      aria-hidden="true"
                    />
                  )}
                </button>

                {isExpanded && (
                  <div id={`collection-${row.id}`} className="bg-white px-4 py-2 border-t border-white/50">
                    {loading ? (
                      Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="flex items-center gap-3 px-3 py-3 animate-pulse">
                          <div className="w-10 h-10 rounded-lg bg-slate-200" />
                          <div className="h-3 bg-slate-200 rounded w-3/4" />
                        </div>
                      ))
                    ) : row.products.length > 0 ? (
                      row.products.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => goTo(`/product/${p.id}`)}
                          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left hover:bg-white transition-colors group"
                        >
                          <img src={p.image} alt="" loading="lazy" className="w-10 h-10 rounded-lg object-cover bg-white shrink-0" />
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-medium text-slate-800 truncate group-hover:text-emerald-700">{p.name}</span>
                            <span className="block text-xs font-bold text-slate-500 mt-0.5">{fmt(p.price)}</span>
                          </span>
                          <span className="text-slate-300 group-hover:text-emerald-600" aria-hidden="true">→</span>
                        </button>
                      ))
                    ) : (
                      <p className="px-3 py-4 text-sm text-slate-500">No products here yet.</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="p-5 border-t border-white/60 bg-white">
          <button
            type="button"
            onClick={() => goTo("/shop")}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-sm font-bold shadow-md shadow-emerald-600/20 hover:from-emerald-700 hover:to-teal-700 transition-all"
          >
            View full shop →
          </button>
        </div>
      </aside>
    </div>
  );
}

export default function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileSearch, setMobileSearch] = useState(false);
  const [showSug, setShowSug] = useState(false);
  const [announce, setAnnounce] = useState(0);
  const [collectionOpen, setCollectionOpen] = useState(false);
  const closeCollection = useCallback(() => setCollectionOpen(false), []);
  const { count, total } = useCart();
  const { ids } = useWishlist();
  const { user } = useAuth();
  const { openModal, searchQuery, setSearchQuery } = useUI();
  const { categories } = useProducts();
  const { navigate } = useRouter();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setAnnounce((a) => (a + 1) % ANNOUNCEMENTS.length), 4000);
    return () => clearInterval(t);
  }, []);

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    navigate("/shop" + (searchQuery ? `?q=${encodeURIComponent(searchQuery)}` : ""));
  };

  const iconBtn = "relative w-10 h-10 flex items-center justify-center rounded-full text-slate-600 transition-colors hover:text-emerald-700 hover:bg-emerald-50";
  const badge =
    "absolute -top-0.5 -right-0.5 bg-emerald-600 text-white text-[10px] font-bold min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center ring-2 ring-white/60";

  return (
    <>
      <header className="fixed top-0 inset-x-0 z-40 bg-white">
        {/* small utility bar */}
        <div
          className={`bg-emerald-950 text-emerald-100 text-xs font-medium overflow-hidden transition-all duration-300 ${
            scrolled ? "max-h-0 opacity-0" : "max-h-8 opacity-100"
          }`}
        >
          <button
            type="button"
            onClick={() => navigate("/shop")}
            className="h-8 w-full flex items-center justify-center gap-2 hover:text-white transition-colors"
          >
            {ANNOUNCEMENTS[announce].icon}
            <span className="tracking-wide">{ANNOUNCEMENTS[announce].text}</span>
            <span className="opacity-60">→</span>
          </button>
        </div>

        <div className="bg-white border-b border-slate-200 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 md:px-6">
            {/* desktop: one clear shopping row */}
            <div className={`hidden md:flex items-center gap-4 ${scrolled ? "h-16" : "h-[72px]"}`}>
              <Link to="/" className="shrink-0" aria-label="XccessoriesPoint home">
                <Logo />
              </Link>

              <button
                type="button"
                onClick={() => setCollectionOpen(true)}
                aria-expanded={collectionOpen}
                aria-controls="collection-drawer"
                className="hidden lg:flex shrink-0 items-center gap-2 rounded-lg bg-emerald-700 px-4 h-11 text-sm font-bold text-white shadow-sm hover:bg-emerald-800 transition-colors"
              >
                <MenuIcon size={17} />
                Browse categories
              </button>

              <form onSubmit={submitSearch} className="relative flex-1 min-w-0">
                {showSug && <SearchSuggestions query={searchQuery} onPick={() => setShowSug(false)} />}
                <SearchIcon size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setShowSug(true); }}
                  onFocus={() => setShowSug(true)}
                  onBlur={() => setTimeout(() => setShowSug(false), 150)}
                  placeholder="Search products, categories…"
                  className="w-full h-11 rounded-lg border border-slate-200 bg-slate-50 pl-11 pr-12 text-sm text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-100"
                />
                <button
                  type="submit"
                  aria-label="Search"
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-md bg-emerald-700 text-white hover:bg-emerald-800 transition-colors"
                >
                  <SearchIcon size={15} />
                </button>
              </form>

              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => openModal("wishlist")} className={iconBtn} aria-label="Wishlist">
                  <HeartIcon size={20} filled={ids.length > 0} className={ids.length > 0 ? "text-emerald-700" : undefined} />
                  {ids.length > 0 && <span className={badge}>{ids.length}</span>}
                </button>
                <button
                  type="button"
                  onClick={() => openModal("cart")}
                  className="relative flex h-11 items-center gap-2 rounded-lg bg-slate-900 px-3.5 text-white hover:bg-emerald-700 transition-colors"
                  aria-label="Cart"
                >
                  <CartIcon size={18} />
                  {count > 0 && <span className={badge}>{count}</span>}
                  <span className="hidden xl:inline text-sm font-bold tabular-nums">{fmt(total)}</span>
                </button>
                <button
                  type="button"
                  onClick={() => openModal(user ? "account" : "auth")}
                  className="hidden lg:flex h-11 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 transition-colors"
                >
                  <UserIcon size={19} />
                  <span>{user ? user.name.split(" ")[0] : "Sign in"}</span>
                </button>
              </div>
            </div>

            {/* mobile: compact utility row */}
            <div className="md:hidden py-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => setCollectionOpen(true)}
                    className={iconBtn}
                    aria-label="Browse categories"
                    aria-expanded={collectionOpen}
                    aria-controls="collection-drawer"
                  >
                    <MenuIcon size={20} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setMobileSearch((value) => !value)}
                    className={`${iconBtn} ${mobileSearch ? "bg-slate-100" : ""}`}
                    aria-label="Toggle search"
                  >
                    <SearchIcon size={20} />
                  </button>
                </div>
                <Link to="/" className="min-w-0 text-center" aria-label="XccessoriesPoint home">
                  <Logo compact />
                </Link>
                <div className="flex items-center gap-0.5 shrink-0">
                  <button onClick={() => openModal("cart")} className={iconBtn} aria-label="Cart">
                    <CartIcon size={20} />
                    {count > 0 && <span className={`badge-pop ${badge}`}>{count}</span>}
                  </button>
                  <button onClick={() => openModal(user ? "account" : "auth")} className={iconBtn} aria-label="Account">
                    <UserIcon size={20} />
                  </button>
                </div>
              </div>
              {mobileSearch && (
                <form onSubmit={submitSearch} className="mt-2 relative fade-up">
                  {showSug && <SearchSuggestions query={searchQuery} onPick={() => { setShowSug(false); setMobileSearch(false); }} />}
                  <SearchIcon size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    autoFocus
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); setShowSug(true); }}
                    onFocus={() => setShowSug(true)}
                    onBlur={() => setTimeout(() => setShowSug(false), 150)}
                    placeholder="Search products…"
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-emerald-500 focus:bg-white"
                  />
                </form>
              )}
            </div>

            {/* category links keep the catalog one click away on desktop */}
            <nav
              aria-label="Shop by category"
              className={`hidden lg:flex items-center gap-7 border-t border-slate-100 transition-all duration-200 ${
                scrolled ? "max-h-0 opacity-0 overflow-hidden border-t-0" : "max-h-12 py-2.5 opacity-100"
              }`}
            >
              <Link to="/shop" className="text-xs font-bold uppercase tracking-wide text-emerald-700 hover:text-emerald-900">Shop all</Link>
              {categories.map((category) => (
                <Link key={category.id} to={`/category/${category.id}`} className="text-sm font-medium text-slate-600 hover:text-emerald-700 transition-colors">
                  {category.name}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      </header>
      <CollectionDrawer open={collectionOpen} onClose={closeCollection} />
    </>
  );
}
