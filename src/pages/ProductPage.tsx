import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link, useRouter } from "../router";
import { useAuth, useCart, useProducts, useToast, useWishlist, fmt } from "../context/store";
import ProductCard, { Stars } from "../components/ProductCard";
import { HeartIcon, TruckIcon, StarIcon } from "../components/icons";
import RecentlyViewed from "../components/RecentlyViewed";
import { swatchFor, allColorVariants, swatchStyle } from "../lib/swatch";
import { track } from "../lib/tracking";
import { pixelTrack } from "../lib/pixel";
import { setMeta } from "../lib/seo";
import { buildOrderMessage, openWhatsApp } from "../lib/whatsapp";
import type { Product } from "../types";

interface Review {
  id: number;
  name: string;
  rating: number;
  text: string;
  createdAt: string;
  verified?: boolean;
}

const CATEGORY_PERKS: Record<string, string[]> = {
  audio: ["Bluetooth 5.3 with multipoint pairing", "6-month replacement warranty", "Free audio fit-check guide"],
  wearables: ["Works with Android & iOS", "6-month replacement warranty", "Free strap size exchange"],
  power: ["Over-charge & short-circuit protection", "6-month replacement warranty", "PTA-safe certified cells"],
  cases: ["Precise cutouts, wireless-charging safe", "Anti-yellowing guarantee", "Free screen protector included"],
  cables: ["Lifetime warranty on cables", "100% copper cores", "Tangle-free braided nylon"],
};

function PaymentOptions() {
  return (
    <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-center text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Official payment options</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2 text-center">
          <p className="text-xs font-bold text-slate-800">Cash on Delivery</p>
          <p className="mt-0.5 text-[10px] font-semibold text-orange-600">Available nationwide</p>
        </div>
        <div className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2 text-center">
          <p className="text-xs font-bold text-slate-800">WhatsApp COD</p>
          <p className="mt-0.5 text-[10px] font-semibold text-orange-600">Confirm in minutes</p>
        </div>
      </div>
      <p className="mt-2 text-center text-[10px] text-slate-400">Card and mobile-wallet payments are coming soon.</p>
    </div>
  );
}

type ProductInfoTab = "description" | "delivery" | "returns";

function ProductInfoTabs({ product, perks }: { product: Product; perks: string[] }) {
  const [tab, setTab] = useState<ProductInfoTab>("description");
  const tabs: { id: ProductInfoTab; label: string }[] = [
    { id: "description", label: "Description" },
    { id: "delivery", label: "Delivery Policy" },
    { id: "returns", label: "Return & Exchange" },
  ];

  return (
    <section className="mt-10 border-t border-slate-200 pt-7">
      <div className="mb-7 space-y-3 text-[13px] text-slate-600">
        <p className="flex items-center gap-2.5">
          <span className="text-base text-slate-700" aria-hidden="true">◷</span>
          Orders ship within 2–5 business days.
        </p>
        <p className="flex items-center gap-2.5">
          <TruckIcon size={16} className="text-orange-600" aria-hidden="true" />
          <span>Hooray! Free Shipping Over <strong className="font-semibold text-slate-800">Rs 5,000</strong></span>
        </p>
      </div>

      <div className="overflow-x-auto no-scrollbar border-b border-slate-200">
        <div className="flex min-w-max items-end gap-1">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              onClick={() => setTab(item.id)}
              className={`rounded-t-lg border px-5 py-3 text-xs font-semibold transition-colors ${
                tab === item.id
                  ? "border-slate-200 border-b-white bg-white text-slate-900 -mb-px"
                  : "border-transparent bg-slate-200 text-slate-600 hover:bg-slate-100"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="pt-7 text-[13px] leading-7 text-slate-500" role="tabpanel">
        {tab === "description" && (
          <div className="space-y-5">
            <div>
              <h2 className="mb-2 text-sm font-bold text-slate-800">{product.name}</h2>
              <p>{product.description || "A thoughtfully selected accessory designed for everyday use."}</p>
            </div>
            {perks.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-bold text-slate-800">Key Features</h3>
                <ul className="space-y-1.5">
                  {perks.map((perk) => (
                    <li key={perk} className="flex items-start gap-2">
                      <span className="mt-1 text-orange-600" aria-hidden="true">✓</span>
                      <span>{perk}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
        {tab === "delivery" && (
          <div className="space-y-3">
            <h2 className="text-sm font-bold text-slate-800">Delivery Policy</h2>
            <p>Orders are dispatched after confirmation. Lahore and Karachi usually arrive in 2–3 working days; other cities generally take 3–5 working days.</p>
            <p>Cash on Delivery is available nationwide. Shipping is free on orders over Rs 5,000.</p>
          </div>
        )}
        {tab === "returns" && (
          <div className="space-y-3">
            <h2 className="text-sm font-bold text-slate-800">Return & Exchange</h2>
            <p>Request an eligible return within 7 days of delivery. Please keep the product, packaging and accessories in their original condition.</p>
            <p>If an item arrives damaged or incorrect, contact support before sending it back so we can arrange a replacement or refund.</p>
          </div>
        )}
      </div>
    </section>
  );
}

export default function ProductPage({ id }: { id: number }) {
  const { products, categories, loading } = useProducts();
  const { add } = useCart();
  const { toggle, has } = useWishlist();
  const { user } = useAuth();
  const { push } = useToast();
  const { navigate } = useRouter();
  const [qty, setQty] = useState(1);
  const [variantId, setVariantId] = useState<number>(0);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [revName, setRevName] = useState(user?.name ?? "");
  const [revRating, setRevRating] = useState(5);
  const [revText, setRevText] = useState("");
  const [revBusy, setRevBusy] = useState(false);
  const [soldWeek, setSoldWeek] = useState(0);
  const [topVariantId, setTopVariantId] = useState<number | null>(null);
  const variantTouched = useRef(false);
  const [showSticky, setShowSticky] = useState(false);
  const [alertEmail, setAlertEmail] = useState("");
  const [alertDone, setAlertDone] = useState(false);
  const [imgIdx, setImgIdx] = useState(0);
  const [hoverPreview, setHoverPreview] = useState<string | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const product = products.find((p) => p.id === id);
  const catName = categories.find((c) => c.id === product?.category)?.name ?? product?.category;
  const related = useMemo(
    () => products.filter((p) => p.category === product?.category && p.id !== id).slice(0, 4),
    [products, product, id]
  );
  const reviewBreakdown = useMemo(
    () => [5, 4, 3, 2, 1].map((rating) => ({
      rating,
      count: reviews.filter((review) => review.rating === rating).length,
    })),
    [reviews]
  );
  const verifiedReviewCount = reviews.filter((review) => review.verified).length;

  const gallery = product
    ? (() => {
        const imgs = product.images?.length ? [...product.images] : [product.image];
        const vImg = product.variants?.find((v) => v.id === variantId)?.image;
        if (vImg && !imgs.includes(vImg)) imgs.unshift(vImg);
        return imgs;
      })()
    : [];
  const productSku = product?.variants?.find((item) => item.id === variantId)?.sku
    ?? product?.variants?.find((item) => item.sku)?.sku
    ?? null;

  useEffect(() => {
    if (!product) return;
    setImgIdx(0);
    if (product.variants?.length) {
      const firstInStock = product.variants.find((v) => v.stock > 0) ?? product.variants[0];
      setVariantId(firstInStock.id);
    } else {
      setVariantId(0);
    }
    setMeta({
      title: `${product.name} — XccessoriesPoint`,
      description:
        product.description?.slice(0, 160) ||
        `Buy ${product.name} at XccessoriesPoint — ${fmt(product.price)}. COD nationwide, 7-day returns.`,
      image: product.image,
      url: `/product/${product.id}`,
      type: "product",
      jsonLd: [
        {
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: location.origin + "/" },
            { "@type": "ListItem", position: 2, name: "Shop", item: location.origin + "/shop" },
            { "@type": "ListItem", position: 3, name: catName ?? product.category, item: `${location.origin}/category/${product.category}` },
            { "@type": "ListItem", position: 4, name: product.name, item: `${location.origin}/product/${product.id}` },
          ],
        },
        {
          "@context": "https://schema.org",
          "@type": "Product",
          name: product.name,
          ...(productSku ? { sku: productSku } : {}),
          image: product.image ? location.origin + product.image : undefined,
          description: product.description || undefined,
          category: catName,
          aggregateRating:
            product.reviews > 0
              ? { "@type": "AggregateRating", ratingValue: product.rating, reviewCount: product.reviews }
              : undefined,
          offers: {
            "@type": "Offer",
            priceCurrency: "PKR",
            price: product.price,
            availability: product.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
          },
        },
      ],
    });
    track("product_view", { id: product.id, name: product.name });
    pixelTrack("ViewContent", {
      content_ids: [String(product.id)],
      content_name: product.name,
      content_type: "product",
      value: product.price,
      currency: "PKR",
    });
    fetch(`/api/products/${product.id}/reviews`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setReviews)
      .catch(() => {});
    fetch(`/api/products/${product.id}/stats`)
      .then((r) => (r.ok ? r.json() : { soldThisWeek: 0, topVariantId: null }))
      .then((d) => {
        setSoldWeek(d.soldThisWeek ?? 0);
        const topId = d.topVariantId ?? null;
        setTopVariantId(topId);
        // pre-select the best-selling variant unless the shopper already chose one
        if (topId && !variantTouched.current) {
          const tv = product.variants?.find((v) => v.id === topId);
          if (tv && tv.stock > 0) {
            setVariantId(topId);
            if (tv.image) { setImgIdx(0); }
          }
        }
      })
      .catch(() => {});
    // recently-viewed history (functional storage, max 8)
    try {
      const seen: number[] = JSON.parse(localStorage.getItem("xp_recent") || "[]");
      const next = [product.id, ...seen.filter((x) => x !== product.id)].slice(0, 8);
      localStorage.setItem("xp_recent", JSON.stringify(next));
    } catch { /* ignore */ }
    window.scrollTo({ top: 0 });
  }, [product?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // sticky mobile CTA appears after scrolling past the fold
  useEffect(() => {
    const onScroll = () => setShowSticky(window.scrollY > 520);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // keep the gallery lightbox focused and prevent the page behind it from moving
  useEffect(() => {
    if (!lightboxOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxOpen(false);
      if (e.key === "ArrowLeft") setImgIdx((i) => (i - 1 + gallery.length) % gallery.length);
      if (e.key === "ArrowRight") setImgIdx((i) => (i + 1) % gallery.length);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [lightboxOpen, gallery.length]);

  if (loading)
    return (
      <main id="main-content" className="pt-20 md:pt-44 max-w-7xl mx-auto px-6 pb-16">
        <div className="surface-muted rounded-3xl h-96 animate-pulse" />
      </main>
    );

  if (!product)
    return (
      <main id="main-content" className="pt-20 md:pt-44 max-w-7xl mx-auto px-6 pb-16 text-center">
        <div className="text-5xl mb-4">🔎</div>
        <h1 className="text-2xl font-black text-slate-900 mb-2">Product not found</h1>
        <Link to="/shop" className="text-orange-600 font-semibold hover:underline">← Back to shop</Link>
      </main>
    );

  const mainImage = hoverPreview ?? gallery[Math.min(imgIdx, gallery.length - 1)];

  const variant = product.variants?.find((v) => v.id === variantId) ?? null;
  const unitPrice = product.price + (variant?.priceDelta ?? 0);
  const comparePrice =
    product.compareAt && product.compareAt + (variant?.priceDelta ?? 0) > unitPrice
      ? product.compareAt + (variant?.priceDelta ?? 0)
      : null;
  const discountPercent = comparePrice ? Math.round(((comparePrice - unitPrice) / comparePrice) * 100) : 0;
  const availableStock = variant ? variant.stock : product.stock;
  const low = availableStock > 0 && availableStock <= 15;
  const out = availableStock <= 0;
  // A real meter based on recent orders and remaining stock; it stays hidden
  // until there is actual sales data instead of inventing urgency.
  const recentSalesTotal = soldWeek + availableStock;
  const soldPercent = soldWeek > 0 && recentSalesTotal > 0
    ? Math.round((soldWeek / recentSalesTotal) * 100)
    : null;
  const perks = CATEGORY_PERKS[product.category] ?? [];
  const summary = product.description?.split(/[.!?]/)[0]?.trim() || "A thoughtfully selected accessory for everyday use.";

  /* ---- order this product straight on WhatsApp ---- */
  const orderOnWhatsApp = () => {
    const needsVariant = (product.variants?.length ?? 0) > 0 && !variant;
    if (needsVariant) {
      push("Please choose an option first", "error");
      document.getElementById("xp-variants")?.scrollIntoView?.({ behavior: "smooth", block: "center" });
      return;
    }
    // treated as a checkout start — it is one, just handed off to WhatsApp
    track("checkout_start", { via: "whatsapp", productId: product.id, qty, variantId: variantId || null, value: unitPrice * qty });
    pixelTrack("InitiateCheckout", {
      content_ids: [String(product.id)],
      num_items: qty,
      value: unitPrice * qty,
      currency: "PKR",
    });
    openWhatsApp(
      buildOrderMessage({
        lines: [{ name: product.name, variantLabel: variant?.label ?? null, qty, price: unitPrice }],
        subtotal: unitPrice * qty,
        shipping: unitPrice * qty >= 5000 ? 0 : 250,
        total: unitPrice * qty + (unitPrice * qty >= 5000 ? 0 : 250),
        name: user?.name ?? "",
        phone: "",
        email: user?.email ?? "",
        address: "",
        city: "",
        notes: `Product link: ${location.href}`,
        payment: "whatsapp",
      })
    );
  };

  const submitReview = async (e: FormEvent) => {
    e.preventDefault();
    setRevBusy(true);
    try {
      const r = await fetch(`/api/products/${product.id}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: revName, rating: revRating, text: revText, email: user?.email ?? "" }),
      });
      if (!r.ok) throw new Error((await r.json()).error || "Could not submit review");
      push("Review submitted — it will appear after moderation ✨");
      setRevText("");
    } catch (err) {
      push(err instanceof Error ? err.message : "Review failed", "error");
    } finally {
      setRevBusy(false);
    }
  };

  return (
    <main id="main-content" className="pt-20 md:pt-44 max-w-7xl mx-auto px-6 pb-16">
      {/* breadcrumb */}
      <nav className="text-xs text-slate-400 mb-4">
        <Link to="/" className="hover:text-orange-600">Home</Link>
        <span className="mx-1.5">/</span>
        <Link to="/shop" className="hover:text-orange-600">Shop</Link>
        <span className="mx-1.5">/</span>
        <Link to={`/category/${product.category}`} className="hover:text-orange-600 capitalize">{catName}</Link>
        <span className="mx-1.5">/</span>
        <span className="text-slate-600 font-medium">{product.name}</span>
      </nav>

      <div className="grid lg:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)] gap-8 lg:gap-12 items-start">
        {/* gallery */}
        <div>
          <div className="surface rounded-xl shadow-none overflow-hidden relative">
            {product.badge && (
              <span className="absolute top-4 left-4 z-10 bg-slate-900 text-white text-sm font-bold px-3 py-1.5 rounded-lg shadow-md shadow-slate-900/25">
                {product.badge}
              </span>
            )}
            {gallery.length > 1 && (
              <>
                <button
                  onClick={() => setImgIdx((i) => (i - 1 + gallery.length) % gallery.length)}
                  aria-label="Previous image"
                  className="absolute left-3 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-lg bg-white text-slate-700 hover:bg-white flex items-center justify-center shadow-lg transition"
                >
                  ‹
                </button>
                <button
                  onClick={() => setImgIdx((i) => (i + 1) % gallery.length)}
                  aria-label="Next image"
                  className="absolute right-3 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-lg bg-white text-slate-700 hover:bg-white flex items-center justify-center shadow-lg transition"
                >
                  ›
                </button>
                <span className="absolute bottom-3 right-3 z-10 bg-slate-900/60 text-white text-[11px] font-bold px-2.5 py-1 rounded-md">
                  {Math.min(imgIdx + 1, gallery.length)} / {gallery.length}
                </span>
              </>
            )}
            <button
              type="button"
              onClick={() => setLightboxOpen(true)}
              className="group block w-full overflow-hidden bg-white p-4 md:p-8 cursor-zoom-in"
              aria-label="Open product image gallery"
            >
              <img
                key={mainImage}
                src={mainImage}
                alt={product.name}
                width={800}
                height={800}
                className="w-full aspect-square object-contain group-hover:scale-[1.03] transition-transform duration-500 fade-up"
                fetchPriority="high"
              />
              <span className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-slate-900/65 px-3 py-1.5 text-[11px] font-semibold text-white opacity-0 group-hover:opacity-100 transition-opacity">
                Click to enlarge
              </span>
            </button>
          </div>
          {gallery.length > 1 && (
            <div className="flex gap-2.5 mt-3 overflow-x-auto no-scrollbar pb-1">
              {gallery.map((src, i) => (
                <button
                  key={src + i}
                  onClick={() => setImgIdx(i)}
                  aria-label={`Image ${i + 1}`}
                  className={`shrink-0 w-18 h-18 md:w-20 md:h-20 rounded-xl overflow-hidden transition-all ${
                    i === imgIdx
                      ? "ring-2 ring-orange-500 ring-offset-2 ring-offset-transparent"
                      : "opacity-60 hover:opacity-100 surface-muted"
                  }`}
                >
                  <img
                    src={src}
                    alt={`${product.name} — image ${i + 1}`}
                    width={160}
                    height={160}
                    className="w-full h-full object-contain bg-white p-1"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* purchase panel */}
        <div>
          <div className="lg:sticky lg:top-24 self-start">
            <Link to={`/category/${product.category}`} className="text-xs font-bold uppercase tracking-widest text-orange-600 hover:underline">
            {catName}
          </Link>
          <h1 className="text-2xl md:text-4xl font-black uppercase text-slate-900 mt-2 mb-3">
            {product.name}
            {productSku && <span className="text-slate-500"> | {productSku}</span>}
          </h1>
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <Stars rating={product.rating} />
            <span className="text-xs text-slate-500">({product.reviews})</span>
            <a href="#reviews" className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 hover:text-orange-600 hover:underline">
              View all reviews
            </a>
          </div>
          <p className="text-sm text-slate-600 leading-relaxed mb-4">{summary}</p>
          <div className="flex items-baseline gap-3 mb-1.5 flex-wrap">
            <span className="text-3xl font-black text-orange-600">{fmt(unitPrice)}</span>
            {comparePrice && (
              <span className="text-lg text-slate-400 line-through">{fmt(comparePrice)}</span>
            )}
            {discountPercent > 0 && (
              <span className="inline-flex items-center rounded-md bg-orange-500 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-white">-{discountPercent}%</span>
            )}
          </div>

          {/* stock */}
          <p className={`text-sm font-semibold mb-5 ${out ? "text-red-600" : low ? "text-amber-600" : "text-orange-600"}`}>
            {out ? "✕ Out of stock" : low ? `⚠ Only ${availableStock} left — order soon` : "✓ In stock, ready to ship"}
          </p>

          {soldPercent !== null && !out && (
            <div className="mb-5">
              <div className="flex items-center justify-between gap-3 text-[11px] font-semibold text-slate-500 mb-1.5">
                <span>{soldPercent}% sold recently</span>
                <span>Only {availableStock} left</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full rounded-full bg-slate-900 transition-all" style={{ width: `${soldPercent}%` }} />
              </div>
            </div>
          )}

          {product.variants && product.variants.length > 0 && (
            <div className="mb-6" id="xp-variants">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-2.5">
                {allColorVariants(product.variants) ? "Color" : "Choose option"}
                {variant ? <span className="text-slate-800 normal-case"> — {variant.label}
                  {variant.priceDelta !== 0 && (
                    <span className="text-slate-400"> ({variant.priceDelta > 0 ? "+" : "−"}{fmt(Math.abs(variant.priceDelta))})</span>
                  )}
                </span> : null}
                {topVariantId !== null && variant?.id === topVariantId && (
                  <span className="ml-2 normal-case bg-orange-100 text-orange-600 px-2 py-0.5 rounded-md">🔥 Most popular</span>
                )}
              </p>
              {allColorVariants(product.variants) ? (
                /* circle swatches for color options */
                <div className="flex gap-3 flex-wrap items-center">
                  {product.variants.map((v) => {
                    const color = swatchFor(v)!;
                    const selected = v.id === variantId;
                    const out2 = v.stock <= 0;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        disabled={out2}
                        title={`${v.label}${out2 ? " — sold out" : ""}`}
                        aria-label={v.label}
                        onClick={() => { variantTouched.current = true; setVariantId(v.id); setQty(1); setImgIdx(0); setHoverPreview(null); }}
                        onMouseEnter={() => v.image && setHoverPreview(v.image)}
                        onMouseLeave={() => setHoverPreview(null)}
                        className={`relative w-11 h-11 rounded-lg transition-all ${
                          selected
                            ? "ring-[3px] ring-orange-500 ring-offset-2 scale-110"
                            : out2
                            ? "opacity-40 cursor-not-allowed"
                            : "ring-1 ring-slate-300 hover:ring-2 hover:ring-orange-400 hover:scale-105"
                        }`}
                        style={swatchStyle(color)}
                      >
                        {/* inner border so white swatches stay visible */}
                        <span className="absolute inset-0 rounded-lg border border-black/10" />
                        {selected && (
                          <span className={`absolute inset-0 flex items-center justify-center text-sm font-bold ${
                            color === "#f8fafc" || color === "transparent" || color === "#cbd5e1" || color === "#f5f0e1"
                              ? "text-slate-700" : "text-white"
                          }`}>✓</span>
                        )}
                        {out2 && (
                          <span className="absolute inset-0 rounded-lg overflow-hidden">
                            <span className="absolute left-1/2 top-1/2 w-[140%] h-[2px] bg-red-400 -translate-x-1/2 -translate-y-1/2 rotate-45" />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ) : (
                /* pills (with a dot when a color is derivable) for size/length options */
                <div className="flex gap-2 flex-wrap">
                  {product.variants.map((v) => {
                    const color = swatchFor(v);
                    return (
                      <button
                        key={v.id}
                        type="button"
                        disabled={v.stock <= 0}
                        onClick={() => { variantTouched.current = true; setVariantId(v.id); setQty(1); setImgIdx(0); }}
                        className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all inline-flex items-center gap-2 ${
                          v.id === variantId
                            ? "bg-slate-900 text-white neon-glow-soft"
                            : v.stock <= 0
                            ? "surface-muted text-slate-300 line-through cursor-not-allowed"
                            : "surface-muted text-slate-700 hover:ring-2 hover:ring-orange-300"
                        }`}
                      >
                        {color && (
                          <span className="w-3.5 h-3.5 rounded-full border border-black/10 shrink-0" style={swatchStyle(color)} />
                        )}
                        {v.label}
                        {v.priceDelta !== 0 && (
                          <span className={`text-[11px] ${v.id === variantId ? "text-orange-100" : "text-slate-400"}`}>
                            {v.priceDelta > 0 ? "+" : "−"}{fmt(Math.abs(v.priceDelta)).replace("Rs ", "Rs")}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}


          {out && (
            <div className="surface rounded-2xl p-4 mb-6">
              {alertDone ? (
                <p className="text-sm font-semibold text-orange-600">
                  ✓ You're on the list — we'll email you the moment it's back!
                </p>
              ) : (
                <>
                  <p className="text-sm font-bold text-slate-900 mb-2">🔔 Get notified when it's back</p>
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      try {
                        const r = await fetch("/api/stock-alerts", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ productId: product.id, variantId: variantId || undefined, email: alertEmail }),
                        });
                        if (!r.ok) throw new Error((await r.json()).error);
                        setAlertDone(true);
                        push("We'll let you know when it's back 🔔");
                      } catch (err) {
                        push(err instanceof Error ? err.message : "Failed", "error");
                      }
                    }}
                    className="flex gap-2"
                  >
                    <input
                      type="email"
                      required
                      value={alertEmail}
                      onChange={(e) => setAlertEmail(e.target.value)}
                      placeholder="you@email.com"
                      className="flex-1 min-w-0 rounded-xl bg-white border border-slate-200 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-orange-300/60"
                    />
                    <button className="px-4 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-bold hover:bg-slate-800">
                      Notify me
                    </button>
                  </form>
                </>
              )}
            </div>
          )}


          {/* qty + actions */}
          <div className="flex items-center gap-3 mb-5">
            <div className="flex items-center surface-muted rounded-xl">
              <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Decrease quantity" className="w-10 h-11 text-slate-600 hover:text-orange-600 font-bold">−</button>
              <span className="w-10 text-center font-bold" aria-live="polite">{qty}</span>
              <button type="button" onClick={() => setQty((q) => Math.min(Math.max(1, availableStock), q + 1))} aria-label="Increase quantity" className="w-10 h-11 text-slate-600 hover:text-orange-600 font-bold">+</button>
            </div>
            <button
              disabled={out}
              onClick={() => add(product, qty, variantId)}
              className="flex-1 py-3.5 rounded-xl bg-slate-900 text-white font-bold hover:bg-slate-900 hover:shadow-lg hover:shadow-orange-500/40 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Add to Cart · {fmt(unitPrice * qty)}
            </button>
            <button
              onClick={() => toggle(product.id)}
              aria-label="Toggle wishlist"
              className={`w-12 h-12 rounded-xl flex items-center justify-center transition ${
                has(product.id) ? "bg-slate-900 text-white neon-glow-soft" : "surface-muted text-slate-500 hover:text-orange-600"
              }`}
            >
              <HeartIcon size={20} filled={has(product.id)} />
            </button>
          </div>

          {/* buy now */}
          <button
            disabled={out}
            onClick={() => { add(product, qty, variantId); navigate("/checkout"); }}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-slate-900 to-indigo-600 text-white font-bold hover:from-slate-800 hover:to-indigo-700 neon-glow-soft transition-all mb-3 disabled:opacity-40"
          >
            Buy Now →
          </button>

          {/* order on WhatsApp */}
          <button
            disabled={out}
            onClick={orderOnWhatsApp}
            className="w-full py-3 rounded-xl bg-[#25D366] text-white font-bold hover:brightness-95 transition-all mb-2 disabled:opacity-40 flex items-center justify-center gap-2.5"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5" aria-hidden>
              <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.46 1.32 4.96L2 22l5.25-1.38a9.86 9.86 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2zm0 18.02h-.01a8.2 8.2 0 0 1-4.18-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.17 8.17 0 0 1-1.25-4.35c0-4.53 3.7-8.22 8.24-8.22 2.2 0 4.27.86 5.82 2.41a8.18 8.18 0 0 1 2.41 5.82c0 4.54-3.7 8.2-8.24 8.2z" />
              <path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.65.08-.3-.15-1.25-.46-2.39-1.47-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.6-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.06 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.63.71.22 1.36.19 1.87.12.57-.09 1.75-.72 2-1.41.25-.69.25-1.28.17-1.41-.07-.13-.27-.2-.57-.35z" />
            </svg>
            Order on WhatsApp
          </button>
          <p className="text-center text-xs text-slate-500 mb-4">
            COD nationwide · 7-day returns · Phone confirmation
          </p>
          <PaymentOptions />
          </div>

        </div>
      </div>

      <ProductInfoTabs product={product} perks={perks} />

      {/* reviews */}
      <section id="reviews" className="scroll-mt-24 mt-16 grid lg:grid-cols-2 gap-8">
        <div>
          <div className="surface-muted rounded-xl p-4 mb-4">
            <div className="flex items-center gap-4">
              <span className="text-3xl font-black text-slate-900">{product.reviews > 0 ? product.rating.toFixed(1) : "—"}</span>
              <div>
                <Stars rating={product.rating} />
                <p className="text-xs text-slate-500 mt-0.5">
                  {product.reviews > 0 ? `Based on ${product.reviews} review${product.reviews === 1 ? "" : "s"}` : "Be the first to review this product"}
                </p>
              </div>
            </div>
            {reviews.length > 0 && (
              <div className="mt-3 space-y-1.5" aria-label="Rating breakdown">
                {reviewBreakdown.map(({ rating, count }) => {
                  const percentage = Math.round((count / reviews.length) * 100);
                  return (
                    <div key={rating} className="flex items-center gap-2 text-[11px] text-slate-500">
                      <span className="flex w-7 shrink-0 items-center gap-0.5">{rating}<StarIcon size={11} className="text-amber-400" /></span>
                      <div className="h-1.5 flex-1 rounded-full bg-slate-100 overflow-hidden">
                        <div className="h-full rounded-full bg-amber-400" style={{ width: `${percentage}%` }} />
                      </div>
                      <span className="w-5 text-right tabular-nums">{count}</span>
                    </div>
                  );
                })}
              </div>
            )}
            {verifiedReviewCount > 0 && (
              <p className="text-[11px] font-semibold text-orange-600 mt-3">✓ {verifiedReviewCount} verified purchase{verifiedReviewCount === 1 ? "" : "s"}</p>
            )}
          </div>
          <h2 className="text-xl font-black text-slate-900 mb-4">Customer Reviews ({reviews.length})</h2>
          {reviews.length === 0 ? (
            <p className="text-sm text-slate-500">No approved reviews yet — be the first!</p>
          ) : (
            <div className="space-y-3">
              {reviews.map((r) => (
                <div key={r.id} className="surface rounded-xl shadow-none p-4">
                  <div className="flex items-center gap-2.5 mb-1.5">
                    <span className="w-8 h-8 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center text-sm font-bold">
                      {r.name.charAt(0)}
                    </span>
                    <span className="font-semibold text-slate-900 text-sm">{r.name}</span>
                    {r.verified && <span className="text-[10px] font-bold text-orange-600">✓ Verified purchase</span>}
                    <span className="text-xs text-slate-400 ml-auto">{r.createdAt?.slice(0, 10)}</span>
                  </div>
                  <Stars rating={r.rating} size="text-xs" />
                  <p className="text-sm text-slate-600 mt-1.5">{r.text}</p>
                </div>
              ))}
            </div>
          )}
        </div>
        <div>
          <h2 className="text-xl font-black text-slate-900 mb-4">Write a Review</h2>
          <form onSubmit={submitReview} className="surface rounded-xl shadow-none p-5 space-y-3">
            <input
              value={revName}
              onChange={(e) => setRevName(e.target.value)}
              placeholder="Your name"
              required
              className="w-full rounded-xl bg-white border border-slate-200 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-orange-300/60"
            />
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRevRating(n)}
                  className={`transition ${n <= revRating ? "text-amber-400" : "text-slate-300 hover:text-amber-300"}`}
                  aria-label={`${n} stars`}
                >
                  <StarIcon size={24} />
                </button>
              ))}
              <span className="ml-2 text-sm text-slate-500">{revRating}/5</span>
            </div>
            <textarea
              value={revText}
              onChange={(e) => setRevText(e.target.value)}
              rows={4}
              placeholder="What did you think of it?"
              className="w-full rounded-xl bg-white border border-slate-200 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-orange-300/60"
            />
            <button
              disabled={revBusy}
              className="w-full py-3 rounded-xl bg-slate-900 text-white font-bold hover:bg-slate-800 neon-glow-soft disabled:opacity-50"
            >
              {revBusy ? "Submitting…" : "Submit review"}
            </button>
            <p className="text-[11px] text-slate-400">Reviews are moderated before appearing publicly.</p>
          </form>
        </div>
      </section>

      {/* sticky mobile add-to-cart (conversion) */}
      {showSticky && !out && (
        <div className="md:hidden fixed bottom-[60px] inset-x-0 z-30 px-3 pb-2 fade-up">
          <div className="surface !bg-white rounded-2xl shadow-xl shadow-slate-900/15 p-2.5 flex items-center gap-3">
            <img src={variant?.image || product.image} alt="" className="w-11 h-11 rounded-xl object-cover" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-slate-900 truncate">{product.name}</p>
              <p className="text-sm font-black text-orange-600">
                {fmt(unitPrice)}
                {variant && <span className="ml-1.5 text-[10px] font-bold text-slate-400">{variant.label}</span>}
              </p>
            </div>
            <button
              onClick={() => add(product, qty, variantId)}
              className="px-5 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-bold neon-glow-soft"
            >
              Add to Cart
            </button>
          </div>
        </div>
      )}

      <RecentlyViewed excludeId={product.id} />

      {/* related */}
      {related.length > 0 && (
        <section className="mt-16 border-t border-slate-200 pt-10">
          <div className="text-center mb-6">
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-orange-600 mb-1">You might also like</p>
            <h2 className="text-2xl font-black text-slate-900">Related Products</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} compact />
            ))}
          </div>
        </section>
      )}

      {lightboxOpen && (
        <div
          className="fixed inset-0 z-[80] bg-slate-950/80  p-4 md:p-8 flex items-center justify-center"
          role="dialog"
          aria-modal="true"
          aria-label={`${product.name} image gallery`}
          onClick={() => setLightboxOpen(false)}
        >
          <button
            type="button"
            onClick={() => setLightboxOpen(false)}
            aria-label="Close image gallery"
            className="absolute top-5 right-5 w-10 h-10 rounded-lg bg-white text-slate-700 text-xl hover:bg-white z-10"
          >
            ×
          </button>
          <div className="relative max-w-5xl max-h-full flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
            {gallery.length > 1 && (
              <button
                type="button"
                onClick={() => setImgIdx((i) => (i - 1 + gallery.length) % gallery.length)}
                aria-label="Previous image"
                className="absolute left-2 md:-left-14 w-10 h-10 rounded-lg bg-white text-slate-700 text-2xl shadow-lg hover:bg-white z-10"
              >
                ‹
              </button>
            )}
            <img
              key={mainImage}
              src={mainImage}
              alt={product.name}
              width={1000}
              height={1000}
              className="max-h-[82vh] max-w-[88vw] object-contain rounded-2xl shadow-2xl"
            />
            {gallery.length > 1 && (
              <button
                type="button"
                onClick={() => setImgIdx((i) => (i + 1) % gallery.length)}
                aria-label="Next image"
                className="absolute right-2 md:-right-14 w-10 h-10 rounded-lg bg-white text-slate-700 text-2xl shadow-lg hover:bg-white z-10"
              >
                ›
              </button>
            )}
            {gallery.length > 1 && (
              <span className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-md bg-slate-950/70 text-white text-xs font-bold px-3 py-1.5">
                {Math.min(imgIdx + 1, gallery.length)} / {gallery.length}
              </span>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
