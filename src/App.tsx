import { RouterProvider, useRouter } from "./router";
import { StoreProvider, useProducts } from "./context/store";
import ProductCard from "./components/ProductCard";
import ErrorBoundary from "./components/ErrorBoundary";
import Header from "./components/Header";
import Footer from "./components/Footer";
import FloatingButtons from "./components/FloatingButtons";
import MobileBottomNav from "./components/MobileBottomNav";
import Modals from "./components/Modals";
import Toasts from "./components/Toasts";
import CookieConsent from "./components/CookieConsent";
import ExitIntentOffer from "./components/ExitIntentOffer";
import HomePage from "./pages/HomePage";
import ShopPage from "./pages/ShopPage";
import CheckoutPage from "./pages/CheckoutPage";
import ProductPage from "./pages/ProductPage";
import CategoryPage from "./pages/CategoryPage";
import GuidePage from "./pages/GuidePage";
import PolicyPage from "./pages/PolicyPage";
import { Link } from "./router";
import { lazy, Suspense, useEffect, useRef } from "react";
import { initPixel, pixelPageView } from "./lib/pixel";
import { setMeta } from "./lib/seo";

// Admin is code-split — shoppers never download the dashboard bundle
const AdminPage = lazy(() => import("./pages/AdminPage"));

/** Boot the Meta Pixel (if consented) and emit PageView on SPA navigations. */
function PixelManager() {
  const { path } = useRouter();
  const first = useRef(true);
  useEffect(() => {
    initPixel(); // no-op without marketing consent / pixel id
  }, []);
  useEffect(() => {
    if (first.current) {
      first.current = false; // initial PageView is sent by init
      return;
    }
    pixelPageView();
  }, [path]);
  return null;
}

const TITLES: Record<string, string> = {
  "/": "Tech Accessories Online in Pakistan — COD Nationwide | XccessoriesPoint",
  "/shop": "Shop All Tech Accessories Online in Pakistan | XccessoriesPoint",
  "/checkout": "Checkout — XccessoriesPoint",
  "/admin": "Admin Console — XccessoriesPoint",
  "/privacy": "Privacy & Cookie Policy — XccessoriesPoint",
  "/returns": "Returns & Refund Policy — XccessoriesPoint",
  "/terms": "Terms of Service — XccessoriesPoint",
};

const DESCRIPTIONS: Record<string, string> = {
  "/": "Shop earbuds, smartwatches, power banks, chargers & cases online in Pakistan. Free shipping over Rs 5,000, cash on delivery nationwide and 7-day returns.",
  "/shop": "Browse every accessory in one place — earbuds, smartwatches, power banks, chargers, cases & cables. COD across Pakistan, free shipping over Rs 5,000.",
};

function NotFound() {
  const { products } = useProducts();
  const best = products.filter((p) => p.bestSeller).slice(0, 4);
  return (
    <main className="pt-40 pb-20 px-6 max-w-7xl mx-auto">
      <div className="text-center mb-12">
        <div className="text-6xl mb-4">🧭</div>
        <h1 className="text-3xl font-black text-slate-900 mb-2">Page not found</h1>
        <p className="text-sm text-slate-500 mb-6">The page you're looking for doesn't exist — but these do:</p>
        <Link
          to="/shop"
          className="px-6 py-2.5 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700"
        >
          Browse the shop
        </Link>
      </div>
      {best.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {best.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </main>
  );
}

function Routes() {
  const { path, query, navigate } = useRouter();

  // legacy /shop?cat=x links (home tiles, old bookmarks) → canonical category URLs
  useEffect(() => {
    const cat = query.get("cat");
    if (path === "/shop" && cat && /^[a-z0-9-]+$/.test(cat)) navigate(`/category/${cat}`);
  }, [path, query, navigate]);

  // per-route SEO defaults (product/category pages set their own richer meta)
  useEffect(() => {
    if (path.startsWith("/product/") || path.startsWith("/category/")) return;
    const title = TITLES[path] ?? TITLES["/"];
    setMeta({
      title,
      description: DESCRIPTIONS[path] ?? DESCRIPTIONS["/"],
      image: "/img/hero-1.png",
      url: path,
      jsonLd: null,
    });
  }, [path]);

  // Full-screen flows with their own shells
  if (path === "/checkout") return <CheckoutPage />;
  if (path === "/admin" || path.startsWith("/admin/"))
    return (
      <Suspense
        fallback={
          <div className="min-h-screen bg-slate-900 flex items-center justify-center text-slate-400 text-sm">
            Loading admin console…
          </div>
        }
      >
        <AdminPage />
      </Suspense>
    );

  // Storefront shell
  const productMatch = path.match(/^\/product\/(\d+)$/);
  const categoryMatch = path.match(/^\/category\/([a-z0-9-]+)(?:\/([a-z0-9-]+))?$/);
  const guideMatch = path.match(/^\/guides\/([a-z0-9-]+)$/);
  const isPolicy = ["/privacy", "/returns", "/terms"].includes(path);
  return (
    <>
      <Header />
      {path === "/" ? (
        <HomePage />
      ) : path === "/shop" ? (
        <ShopPage />
      ) : productMatch ? (
        <ProductPage id={parseInt(productMatch[1], 10)} />
      ) : categoryMatch ? (
        <CategoryPage id={categoryMatch[1]} band={categoryMatch[2]} />
      ) : guideMatch ? (
        <GuidePage slug={guideMatch[1]} />
      ) : isPolicy ? (
        <PolicyPage />
      ) : (
        <NotFound />
      )}
      <Footer />
      <FloatingButtons />
      <MobileBottomNav />
    </>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <RouterProvider>
        <StoreProvider>
          <PixelManager />
          <Routes />
          <Modals />
          <Toasts />
          <CookieConsent />
          <ExitIntentOffer />
        </StoreProvider>
      </RouterProvider>
    </ErrorBoundary>
  );
}
