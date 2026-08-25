import { useCallback, useEffect, useState } from "react";
import { Link, useRouter } from "../router";
import { useCart, useWishlist, useAuth, useUI, useProducts, fmt } from "../context/store";
import {
  SearchIcon, HeartIcon, CartIcon, UserIcon, PhoneIcon, MapPinIcon,
  MenuIcon, ZapIcon, TruckIcon,
} from "./icons";
import { smartSearch } from "../lib/fuzzy";
import { useStoreConfig } from "../lib/config";

const ANNOUNCEMENTS = [
  { icon: <TruckIcon size={14} />, text: "Free shipping on orders over Rs 5,000" },
  { icon: <ZapIcon size={14} />, text: "Flash sale — up to 40% off audio this week" },
  { icon: <PhoneIcon size={14} />, text: "COD available nationwide · 7-day returns" },
];

function Logo({ compact = false, light = false }: { compact?: boolean; light?: boolean }) {
  return (
    <span
      className={`font-black tracking-tight whitespace-nowrap transition-colors duration-500 ${
        light ? "text-white drop-shadow-[0_1px_6px_rgba(0,0,0,0.25)]" : "text-slate-900"
      } ${compact ? "[font-size:clamp(1rem,4.8vw,1.2rem)]" : "text-2xl"}`}
    >
      Xccessories<span className={light ? "text-lime-300" : "text-emerald-700"}>Point</span>
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
      <div className="absolute top-full left-0 right-0 mt-2 glass !bg-white/90 rounded-2xl shadow-xl shadow-slate-900/10 overflow-hidden z-50 p-4">
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
              className="glass-soft rounded-full px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-emerald-700 hover:bg-emerald-50 transition-colors"
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
    <div className="absolute top-full left-0 right-0 mt-2 glass !bg-white/90 rounded-2xl shadow-xl shadow-slate-900/10 overflow-hidden z-50">
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
        className="collection-drawer relative h-full w-[min(92vw,430px)] bg-white/95 border-r border-white/70 rounded-r-3xl shadow-2xl shadow-emerald-950/20 slide-in-left flex flex-col"
      >
        <div className="relative px-5 pt-6 pb-5 border-b border-white/60">
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-emerald-700 mb-1">The collection</p>
          <p className="text-lg font-black text-slate-950">All categories</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close collection menu"
            className="absolute top-5 right-5 w-9 h-9 rounded-full bg-white/60 text-slate-500 hover:text-emerald-700 hover:bg-white transition-colors flex items-center justify-center"
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
                    isExpanded ? "bg-emerald-50/70" : "bg-transparent hover:bg-white/55"
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
                  <div id={`collection-${row.id}`} className="bg-white/35 px-4 py-2 border-t border-white/50">
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
                          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left hover:bg-white/70 transition-colors group"
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

        <div className="p-5 border-t border-white/60 bg-white/35">
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
  const cfg = useStoreConfig();
  const { count, total } = useCart();
  const { ids } = useWishlist();
  const { user } = useAuth();
  const { openModal, searchQuery, setSearchQuery } = useUI();
  const { navigate, path } = useRouter();

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

  // Let the hero backdrop continue behind the navigation on the homepage.
  const overHero = path === "/" && !scrolled;

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    navigate("/shop" + (searchQuery ? `?q=${encodeURIComponent(searchQuery)}` : ""));
  };

  const iconBtn = `relative w-10 h-10 flex items-center justify-center rounded-full transition-colors ${
    overHero
      ? "text-slate-700 hover:bg-white/60"
      : "text-slate-600 hover:text-emerald-700 hover:bg-emerald-50"
  }`;
  const badge =
    "absolute -top-0.5 -right-0.5 bg-emerald-600 text-white text-[10px] font-bold min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center ring-2 ring-white/60";

  return (
    <>
      <header className="fixed top-0 inset-x-0 z-40">
      {/* announcement bar */}
      <div
        className={`bg-emerald-950/75 backdrop-blur text-emerald-100 text-xs font-medium overflow-hidden transition-all duration-300 ${
          scrolled ? "max-h-0" : "max-h-8"
        }`}
      >
        <button
          key={announce}
          onClick={() => navigate("/shop")}
          className="fade-up h-8 w-full flex items-center justify-center gap-2 hover:text-white transition-colors"
        >
          {ANNOUNCEMENTS[announce].icon}
          <span className="tracking-wide">{ANNOUNCEMENTS[announce].text}</span>
          <span className="opacity-60">→</span>
        </button>
      </div>

      <div
        className={`transition-all duration-500 ${
          overHero
            ? "bg-white/35 backdrop-blur-xl border-b border-white/45"
            : scrolled
            ? "bg-white/80 backdrop-blur-xl shadow-lg shadow-slate-900/5"
            : "bg-white/80 backdrop-blur-xl border-b border-slate-100"
        }`}
      >
        {/* ---------- Desktop ---------- */}
        <div className="hidden md:block max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-3 items-center py-3">
            {/* left contact info — collapses on scroll */}
            <div
              className={`flex items-center gap-5 text-xs overflow-hidden transition-all duration-300 ${
                scrolled ? "opacity-0 max-w-0" : "opacity-100 max-w-md"
              } ${overHero ? "text-slate-600 font-medium" : "text-slate-500"}`}
            >
              <span className="flex items-center gap-1.5 whitespace-nowrap">
                <MapPinIcon size={14} className="text-emerald-600" />
                <span>Lahore · Karachi</span>
              </span>
              <span className="flex items-center gap-1.5 whitespace-nowrap">
                <PhoneIcon size={14} className="text-emerald-600" />
                <span>{cfg?.supportPhone || "+92 300 0000000"}</span>
              </span>
            </div>

            {/* center logo */}
            <Link to="/" className="justify-self-center">
              <Logo />
            </Link>

            {/* right actions */}
            <div className="justify-self-end flex items-center gap-1.5">
              <button onClick={() => openModal("wishlist")} className={iconBtn} aria-label="Wishlist">
                <HeartIcon size={20} filled={ids.length > 0} className={ids.length > 0 ? "text-emerald-700" : undefined} />
                {ids.length > 0 && <span className={badge}>{ids.length}</span>}
              </button>
              <button
                onClick={() => openModal("cart")}
                className="flex items-center gap-2.5 pl-3 pr-4 h-10 rounded-full bg-slate-900/90 backdrop-blur text-white hover:bg-emerald-700 transition-colors group"
                aria-label="Cart"
              >
                <span className="relative">
                  <CartIcon size={18} />
                  {count > 0 && (
                    <span key={count} className="badge-pop absolute -top-2 -right-2.5 bg-emerald-500 text-white text-[10px] font-bold min-w-[16px] h-4 px-0.5 rounded-full flex items-center justify-center">
                      {count}
                    </span>
                  )}
                </span>
                <span className="text-sm font-bold tabular-nums">{fmt(total)}</span>
              </button>
              <button
                onClick={() => openModal(user ? "account" : "auth")}
                className={`flex items-center gap-2 h-10 px-3 rounded-full text-sm font-semibold transition-colors ${
                  overHero ? "text-slate-700 hover:bg-white/60" : "text-slate-600 hover:text-emerald-700 hover:bg-emerald-50"
                }`}
              >
                <UserIcon size={19} />
                <span>{user ? user.name.split(" ")[0] : "Sign in"}</span>
              </button>
            </div>
          </div>

          {/* search row — hidden on scroll */}
          <div
            className={`transition-all duration-300 ${
              scrolled
                ? "max-h-0 opacity-0 overflow-hidden"
                : `max-h-20 opacity-100 pb-3.5 ${showSug ? "overflow-visible" : "overflow-hidden"}`
            }`}
          >
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => setCollectionOpen(true)}
                aria-expanded={collectionOpen}
                aria-controls="collection-drawer"
                className={`whitespace-nowrap text-sm font-bold px-4 h-11 rounded-full flex items-center gap-2 transition-all ${
                  overHero
                    ? "bg-white/60 backdrop-blur-md border border-white/70 text-emerald-800 hover:bg-white/85"
                    : "text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-md shadow-emerald-600/20"
                }`}
              >
                <MenuIcon size={16} />
                Browse all collection
              </button>
              <form onSubmit={submitSearch} className="flex-1 relative">
                {showSug && <SearchSuggestions query={searchQuery} onPick={() => setShowSug(false)} />}
                <SearchIcon
                  size={17}
                  className={`absolute left-5 top-1/2 -translate-y-1/2 pointer-events-none ${
                    overHero ? "text-slate-500" : "text-slate-400"
                  }`}
                />
                <input
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setShowSug(true); }}
                  onFocus={() => setShowSug(true)}
                  onBlur={() => setTimeout(() => setShowSug(false), 150)}
                  placeholder="Search earbuds, چارجر, handsfree…"
                  className={`w-full h-11 rounded-full pl-12 pr-12 text-sm outline-none transition-all ${
                    overHero
                      ? "bg-white/60 backdrop-blur-md border border-white/75 placeholder-slate-500 text-slate-700 focus:bg-white/85 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                      : "border-2 border-slate-100 bg-slate-50 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-100"
                  }`}
                />
                <button
                  type="submit"
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 bg-emerald-700 text-white w-8 h-8 rounded-full flex items-center justify-center hover:bg-emerald-800 transition-colors"
                  aria-label="Search"
                >
                  <SearchIcon size={15} />
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* ---------- Mobile ---------- */}
        <div className="md:hidden px-4 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => setCollectionOpen(true)}
                className={`${iconBtn} ${collectionOpen ? "bg-emerald-50 text-emerald-700" : ""}`}
                aria-label="Browse categories"
                aria-expanded={collectionOpen}
                aria-controls="collection-drawer"
              >
                <MenuIcon size={20} />
              </button>
              <button
                onClick={() => setMobileSearch((s) => !s)}
                className={`${iconBtn} ${mobileSearch ? "bg-white/50" : ""}`}
                aria-label="Toggle search"
              >
                <SearchIcon size={20} />
              </button>
            </div>
            <Link to="/" className="min-w-0 text-center">
              <Logo compact />
            </Link>
            <div className="flex items-center gap-0.5 shrink-0">
              <button onClick={() => openModal("cart")} className={iconBtn} aria-label="Cart">
                <CartIcon size={20} />
                {count > 0 && <span key={count} className={`badge-pop ${badge}`}>{count}</span>}
              </button>
              <button
                onClick={() => openModal(user ? "account" : "auth")}
                className={iconBtn}
                aria-label="Account"
              >
                <UserIcon size={20} />
              </button>
            </div>
          </div>
          {mobileSearch && (
            <form onSubmit={submitSearch} className="mt-2 fade-up relative">
              {showSug && <SearchSuggestions query={searchQuery} onPick={() => { setShowSug(false); setMobileSearch(false); }} />}
              <SearchIcon size={16} className={`absolute left-4 top-1/2 -translate-y-1/2 ${overHero ? "text-emerald-950/60" : "text-slate-400"}`} />
              <input
                autoFocus
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setShowSug(true); }}
                onFocus={() => setShowSug(true)}
                onBlur={() => setTimeout(() => setShowSug(false), 150)}
                placeholder="Search products…"
                className={`w-full rounded-full pl-10 pr-4 py-2.5 text-sm outline-none ${
                  overHero
                    ? "bg-white/60 backdrop-blur-md border border-white/70 placeholder-slate-500 text-slate-700 focus:bg-white/85 focus:border-emerald-500"
                    : "border-2 border-slate-100 bg-slate-50 focus:border-emerald-500 focus:bg-white"
                }`}
              />
            </form>
          )}
        </div>
      </div>
      </header>
      <CollectionDrawer open={collectionOpen} onClose={closeCollection} />
    </>
  );
}
