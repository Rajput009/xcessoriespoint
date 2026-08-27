import { Link, useRouter } from "../router";
import { useAuth, useUI, useWishlist } from "../context/store";
import { HomeIcon, StoreIcon, HeartIcon, UserIcon } from "./icons";

export default function MobileBottomNav() {
  const { path } = useRouter();
  const { openModal } = useUI();
  const { user } = useAuth();
  const { ids } = useWishlist();

  const item =
    "flex flex-col items-center justify-center gap-1 flex-1 py-2 text-[10px] font-semibold transition-colors";

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white  border-t border-slate-200 flex shadow-[0_-4px_16px_rgba(0,0,0,0.07)]">
      <Link to="/" className={`${item} ${path === "/" ? "text-blue-600" : "text-slate-400"}`}>
        <HomeIcon size={20} />
        Home
      </Link>
      <Link to="/shop" className={`${item} ${path === "/shop" ? "text-blue-600" : "text-slate-400"}`}>
        <StoreIcon size={20} />
        Shop
      </Link>
      <button onClick={() => openModal("wishlist")} className={`${item} text-slate-400`}>
        <span className="relative">
          <HeartIcon size={20} filled={ids.length > 0} className={ids.length > 0 ? "text-blue-600" : undefined} />
          {ids.length > 0 && (
            <span className="absolute -top-1.5 -right-2 bg-blue-600 text-white text-[9px] font-bold min-w-[15px] h-[15px] rounded-full flex items-center justify-center ring-2 ring-white">
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
