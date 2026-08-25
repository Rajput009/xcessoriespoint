import { useEffect, useState } from "react";
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

function SearchSuggestions({ query, onPick }: { query: string; onPick: () => void }) {
  const { products } = useProducts();
  const { navigate } = useRouter();
  const q = query.trim().toLowerCase();
  if (q.length < 2) return null;
  const res = smartSearch(products, q);
  const matches = res.results.slice(0, 5);
  const fuzzy = res.method === "fuzzy" || res.method === "synonym";
  if (matches.length === 0) return null;
  return (
    <div className="absolute top-full left-0 right-0 mt-2 glass !bg-white/90 rounded-2xl shadow-xl shadow-slate-900/10 overflow-hidden z-50">
      {fuzzy && (
        <p className="px-4 pt-2.5 pb-1 text-[11px] font-semibold text-slate-400">
          {res.interpretedAs ? `Showing "${res.interpretedAs}"` : `Closest matches for "${query.trim()}"`}
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
  const [category, setCategory] = useState("all");

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

  const visibleProducts = category === "all"
    ? products
    : products.filter((p) => p.category === category);

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
        className="absolute inset-0 bg-slate-950/25 backdrop-blur-[2px]"
      />
      <aside
        id="collection-drawer"
        className="relative h-full w-[min(92vw,430px)] bg-white/95 backdrop-blur-xl border-r border-white shadow-2xl shadow-slate-950/20 slide-in-left flex flex-col"
      >
        <div className="flex items-start justify-between gap-4 px-5 py-5 border-b border-slate-100">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-emerald-700 mb-1">The collection</p>
            <h2 className="text-xl font-black text-slate-950">Browse all products</h2>
            <p className="text-xs text-slate-500 mt-1">
              {loading ? "Loading products…" : `${visibleProducts.length} product${visibleProducts.length === 1 ? "" : "s"}`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close collection menu"
            className="w-9 h-9 shrink-0 rounded-full text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="px-4 py-3 border-b border-slate-100 overflow-x-auto no-scrollbar">
          <div className="flex gap-2 min-w-max">
            <button
              type="button"
              onClick={() => setCategory("all")}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
                category === "all" ? "bg-emerald-700 text-white" : "bg-slate-100 text-slate-600 hover:bg-emerald-50 hover:text-emerald-700"
              }`}
            >
              All products
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategory(c.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
                  category === c.id ? "bg-emerald-700 text-white" : "bg-slate-100 text-slate-600 hover:bg-emerald-50 hover:text-emerald-700"
                }`}
              >
                {c.icon} {c.name}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-2 rounded-xl animate-pulse">
                <div className="w-16 h-16 rounded-xl bg-slate-100" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-slate-100 rounded w-4/5" />
                  <div className="h-3 bg-slate-100 rounded w-1/3" />
                </div>
              </div>
            ))
          ) : visibleProducts.length > 0 ? (
            visibleProducts.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => goTo(`/product/${p.id}`)}
                className="w-full flex items-center gap-3 p-2 rounded-xl text-left hover:bg-emerald-50 transition-colors group"
              >
                <img src={p.image} alt="" className="w-16 h-16 rounded-xl object-cover bg-slate-100 shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[10px] uppercase tracking-wide font-bold text-emerald-700 mb-0.5">
                    {categories.find((c) => c.id === p.category)?.name ?? p.category}
                  </span>
                  <span className="block text-sm font-bold text-slate-900 truncate group-hover:text-emerald-800">{p.name}</span>
                  <span className="block text-sm font-black text-slate-900 mt-0.5">{fmt(p.price)}</span>
                </span>
                <span className="text-slate-300 group-hover:text-emerald-600 transition-colors" aria-hidden="true">→</span>
              </button>
            ))
          ) : (
            <p className="text-sm text-slate-500 text-center py-8">No products in this category yet.</p>
          )}
        </div>

        <div className="p-4 border-t border-slate-100">
          <button
            type="button"
            onClick={() => goTo("/shop")}
            className="w-full py-3 rounded-xl bg-emerald-700 text-white text-sm font-bold hover:bg-emerald-950 transition-colors"
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
  const cfg = useStoreConfig();
  const { count, total } = useCart();
  const { ids } = useWishlist();
  const { user } = useAuth();
  const { openModal, searchQuery, setSearchQuery } = useUI();
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

  // The hero is now a light product canvas, so keep navigation readable from first paint.
  const overHero = false;

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    navigate("/shop" + (searchQuery ? `?q=${encodeURIComponent(searchQuery)}` : ""));
  };

  const iconBtn = `relative w-10 h-10 flex items-center justify-center rounded-full transition-colors ${
    overHero
      ? "text-white hover:bg-white/25"
      : "text-slate-600 hover:text-emerald-700 hover:bg-emerald-50"
  }`;
  const badge =
    "absolute -top-0.5 -right-0.5 bg-emerald-600 text-white text-[10px] font-bold min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center ring-2 ring-white/60";

  return (
    <>
      <header className="fixed top-0 inset-x-0 z-40">
      {/* announcement bar */}
      <div
        className={`bg-emerald-950/90 backdrop-blur text-emerald-100 text-xs font-medium overflow-hidden transition-all duration-300 ${
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
            ? "bg-transparent"
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
              } ${overHero ? "text-white/90 font-medium" : "text-slate-500"}`}
            >
              <span className="flex items-center gap-1.5 whitespace-nowrap">
                <MapPinIcon size={14} className={overHero ? "text-lime-300" : "text-emerald-600"} />
                <span>Lahore · Karachi</span>
              </span>
              <span className="flex items-center gap-1.5 whitespace-nowrap">
                <PhoneIcon size={14} className={overHero ? "text-lime-300" : "text-emerald-600"} />
                <span>{cfg?.supportPhone || "+92 300 0000000"}</span>
              </span>
            </div>

            {/* center logo */}
            <Link to="/" className="justify-self-center">
              <Logo light={overHero} />
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
                  overHero ? "text-white hover:bg-white/25" : "text-slate-600 hover:text-emerald-700 hover:bg-emerald-50"
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
                    ? "bg-white/20 backdrop-blur-md border border-white/35 text-white hover:bg-white/35"
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
                    overHero ? "text-white/80" : "text-slate-400"
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
                      ? "bg-white/20 backdrop-blur-md border border-white/35 placeholder-white/75 text-white focus:bg-white/90 focus:text-slate-900 focus:placeholder-slate-400 focus:border-white"
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
            <button
              onClick={() => setMobileSearch((s) => !s)}
              className={`${iconBtn} shrink-0 ${mobileSearch ? "bg-white/50" : ""}`}
              aria-label="Toggle search"
            >
              <SearchIcon size={20} />
            </button>
            <Link to="/" className="min-w-0 text-center">
              <Logo compact light={overHero} />
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
                onBlur={() => setTimeout(() => setShowSug(false), 150)}
                placeholder="Search products…"
                className={`w-full rounded-full pl-10 pr-4 py-2.5 text-sm outline-none ${
                  overHero
                    ? "bg-white/40 backdrop-blur-md border border-white/50 placeholder-emerald-950/50 text-emerald-950"
                    : "border-2 border-slate-100 bg-slate-50 focus:border-emerald-500 focus:bg-white"
                }`}
              />
            </form>
          )}
        </div>
      </div>
      </header>
      <CollectionDrawer open={collectionOpen} onClose={() => setCollectionOpen(false)} />
    </>
  );
}
