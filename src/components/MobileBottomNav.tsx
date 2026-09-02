import { Link, useRouter } from "../router";
import { useAuth, useUI, useWishlist } from "../context/store";
import { HomeIcon, StoreIcon, HeartIcon, UserIcon } from "./icons";

export default function MobileBottomNav() {
  const { path } = useRouter();
  const { openModal } = useUI();
  const { user } = useAuth();
  const { ids } = useWishlist();

  // the "Shop" tab stays lit anywhere in the catalog — so a customer on a
  // category or product page still knows which section they're in
  const browsing = path === "/shop" || path.startsWith("/category/") || path.startsWith("/product/");

  const item =
    "flex flex-col items-center justify-center gap-1 flex-1 py-2 text-[10px] font-semibold transition-colors";

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white  border-t border-slate-200 flex shadow-[0_-4px_16px_rgba(0,0,0,0.07)]">
      <Link
        to="/"
        aria-current={path === "/" ? "page" : undefined}
        className={`${item} relative ${path === "/" ? "text-teal-700" : "text-slate-400"}`}
      >
        {path === "/" && <span className="absolute top-0 h-0.5 w-8 rounded-full bg-teal-600" aria-hidden="true" />}
        <HomeIcon size={20} />
        Home
      </Link>
      <Link
        to="/shop"
        aria-current={path === "/shop" ? "page" : undefined}
        className={`${item} relative ${browsing ? "text-teal-700" : "text-slate-400"}`}
      >
        {browsing && <span className="absolute top-0 h-0.5 w-8 rounded-full bg-teal-600" aria-hidden="true" />}
        <StoreIcon size={20} />
        Shop
      </Link>
      <button onClick={() => openModal("wishlist")} className={`${item} text-slate-400`}>
        <span className="relative">
          <HeartIcon size={20} filled={ids.length > 0} className={ids.length > 0 ? "text-teal-700" : undefined} />
          {ids.length > 0 && (
            <span className="absolute -top-1.5 -right-2 bg-slate-900 text-white text-[9px] font-bold min-w-[15px] h-[15px] rounded-full flex items-center justify-center ring-2 ring-white">
              {ids.length}
            </span>
          )}
        </span>
        Wishlist
      </button>
      <button onClick={() => openModal(user ? "account" : "auth")} className={`${item} text-slate-400`}>
        <UserIcon size={20} />
        Account
      </button>
    </nav>
  );
}
