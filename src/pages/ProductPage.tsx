import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useRouter } from "../router";
import { useAuth, useCart, useProducts, useToast, useWishlist, fmt } from "../context/store";
import ProductCard, { Stars } from "../components/ProductCard";
import { HeartIcon, TruckIcon, ZapIcon } from "../components/icons";
import RecentlyViewed from "../components/RecentlyViewed";
import { swatchFor, allColorVariants, swatchStyle } from "../lib/swatch";
import { track } from "../lib/tracking";
import { pixelTrack } from "../lib/pixel";

interface Review {
  id: number;
  name: string;
  rating: number;
  text: string;
  createdAt: string;
}

const CATEGORY_PERKS: Record<string, string[]> = {
  audio: ["Bluetooth 5.3 with multipoint pairing", "6-month replacement warranty", "Free audio fit-check guide"],
  wearables: ["Works with Android & iOS", "6-month replacement warranty", "Free strap size exchange"],
  power: ["Over-charge & short-circuit protection", "6-month replacement warranty", "PTA-safe certified cells"],
  cases: ["Precise cutouts, wireless-charging safe", "Anti-yellowing guarantee", "Free screen protector included"],
  cables: ["Lifetime warranty on cables", "100% copper cores", "Tangle-free braided nylon"],
};

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
  const [showSticky, setShowSticky] = useState(false);
  const [alertEmail, setAlertEmail] = useState("");
  const [alertDone, setAlertDone] = useState(false);
  const [imgIdx, setImgIdx] = useState(0);
  const [hoverPreview, setHoverPreview] = useState<string | null>(null);

  const product = products.find((p) => p.id === id);
  const catName = categories.find((c) => c.id === product?.category)?.name ?? product?.category;
  const related = useMemo(
    () => products.filter((p) => p.category === product?.category && p.id !== id).slice(0, 4),
    [products, product, id]
  );

  useEffect(() => {
    if (!product) return;
    setImgIdx(0);
    if (product.variants?.length) {
      const firstInStock = product.variants.find((v) => v.stock > 0) ?? product.variants[0];
      setVariantId(firstInStock.id);
    } else {
      setVariantId(0);
    }
    document.title = `${product.name} — XccessoriesPoint`;
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
      .then((r) => (r.ok ? r.json() : { soldThisWeek: 0 }))
      .then((d) => setSoldWeek(d.soldThisWeek ?? 0))
      .catch(() => {});
    // recently-viewed history (functional storage, max 8)
    try {
      const seen: number[] = JSON.parse(localStorage.getItem("xp_recent") || "[]");
      const next = [product.id, ...seen.filter((x) => x !== product.id)].slice(0, 8);
      localStorage.setItem("xp_recent", JSON.stringify(next));
    } catch { /* ignore */ }
    window.scrollTo({ top: 0 });
    // SEO: Product structured data (JSON-LD)
    const ld = document.createElement("script");
    ld.type = "application/ld+json";
    ld.id = "product-jsonld";
    ld.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Product",
      name: product.name,
      image: location.origin + product.image,
      description: product.description,
      aggregateRating: { "@type": "AggregateRating", ratingValue: product.rating, reviewCount: product.reviews },
      offers: {
        "@type": "Offer",
        priceCurrency: "PKR",
        price: product.price,
        availability: product.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      },
    });
    document.getElementById("product-jsonld")?.remove();
    document.head.appendChild(ld);
    return () => document.getElementById("product-jsonld")?.remove();
  }, [product?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // sticky mobile CTA appears after scrolling past the fold
  useEffect(() => {
    const onScroll = () => setShowSticky(window.scrollY > 520);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (loading)
    return (
      <main className="pt-[120px] md:pt-44 max-w-7xl mx-auto px-6 pb-16">
        <div className="glass-soft rounded-3xl h-96 animate-pulse" />
      </main>
    );

  if (!product)
    return (
      <main className="pt-[120px] md:pt-44 max-w-7xl mx-auto px-6 pb-16 text-center">
        <div className="text-5xl mb-4">🔎</div>
        <h1 className="text-2xl font-black text-slate-900 mb-2">Product not found</h1>
        <Link to="/shop" className="text-emerald-600 font-semibold hover:underline">← Back to shop</Link>
      </main>
    );

  const gallery = (() => {
    const imgs = product.images?.length ? [...product.images] : [product.image];
    const vImg = product.variants?.find((v) => v.id === variantId)?.image;
    if (vImg && !imgs.includes(vImg)) imgs.unshift(vImg);
    return imgs;
  })();
  const mainImage = hoverPreview ?? gallery[Math.min(imgIdx, gallery.length - 1)];

  const variant = product.variants?.find((v) => v.id === variantId) ?? null;
  const unitPrice = product.price + (variant?.priceDelta ?? 0);
  const availableStock = variant ? variant.stock : product.stock;
  const low = availableStock > 0 && availableStock <= 15;
  const out = availableStock <= 0;
  const perks = CATEGORY_PERKS[product.category] ?? [];

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
    <main className="pt-[120px] md:pt-44 max-w-7xl mx-auto px-6 pb-16">
      {/* breadcrumb */}
      <nav className="text-xs text-slate-400 mb-4">
        <Link to="/" className="hover:text-emerald-600">Home</Link>
        <span className="mx-1.5">/</span>
        <Link to="/shop" className="hover:text-emerald-600">Shop</Link>
        <span className="mx-1.5">/</span>
        <Link to={`/shop?cat=${product.category}`} className="hover:text-emerald-600 capitalize">{catName}</Link>
        <span className="mx-1.5">/</span>
        <span className="text-slate-600 font-medium">{product.name}</span>
      </nav>

      <div className="grid lg:grid-cols-2 gap-8 lg:gap-12">
        {/* gallery */}
        <div>
          <div className="glass rounded-3xl overflow-hidden relative">
            {product.badge && (
              <span className="absolute top-4 left-4 z-10 bg-gradient-to-r from-rose-500 to-orange-500 text-white text-sm font-bold px-3 py-1.5 rounded-lg shadow-md shadow-rose-500/30">
                {product.badge}
              </span>
            )}
            {gallery.length > 1 && (
              <>
                <button
                  onClick={() => setImgIdx((i) => (i - 1 + gallery.length) % gallery.length)}
                  aria-label="Previous image"
                  className="absolute left-3 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white/70 backdrop-blur text-slate-700 hover:bg-white flex items-center justify-center shadow-lg transition"
                >
                  ‹
                </button>
                <button
                  onClick={() => setImgIdx((i) => (i + 1) % gallery.length)}
                  aria-label="Next image"
                  className="absolute right-3 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white/70 backdrop-blur text-slate-700 hover:bg-white flex items-center justify-center shadow-lg transition"
                >
                  ›
                </button>
                <span className="absolute bottom-3 right-3 z-10 bg-slate-900/60 backdrop-blur text-white text-[11px] font-bold px-2.5 py-1 rounded-full">
                  {Math.min(imgIdx + 1, gallery.length)} / {gallery.length}
                </span>
              </>
            )}
            <div className="overflow-hidden">
              <img
                key={mainImage}
                src={mainImage}
                alt={product.name}
                className="w-full aspect-square object-cover hover:scale-110 transition-transform duration-700 fade-up"
                fetchPriority="high"
              />
            </div>
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
                      ? "ring-2 ring-emerald-500 ring-offset-2 ring-offset-transparent"
                      : "opacity-60 hover:opacity-100 glass-soft"
                  }`}
                >
                  <img src={src} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* details */}
        <div>
          <Link to={`/shop?cat=${product.category}`} className="text-xs font-bold uppercase tracking-widest text-emerald-600 hover:underline">
            {catName}
          </Link>
          <h1 className="text-3xl md:text-4xl font-black text-slate-900 mt-2 mb-3">{product.name}</h1>
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <Stars rating={product.rating} />
            <span className="text-sm text-slate-500">{product.rating} · {product.reviews} reviews</span>
            {soldWeek > 0 && (
              <span className="text-xs font-bold bg-orange-100 text-orange-600 px-2.5 py-1 rounded-full">
                🔥 {soldWeek} sold this week
              </span>
            )}
          </div>
          <div className="flex items-baseline gap-3 mb-1.5 flex-wrap">
            <span className="text-3xl font-black text-emerald-700">{fmt(unitPrice)}</span>
            {product.compareAt && (
              <span className="text-lg text-slate-400 line-through">{fmt(product.compareAt + (variant?.priceDelta ?? 0))}</span>
            )}
          </div>
          {product.compareAt && (
            <p className="text-sm font-bold text-rose-500 mb-4">
              You save {fmt(product.compareAt + (variant?.priceDelta ?? 0) - unitPrice)} (
              {Math.round(((product.compareAt + (variant?.priceDelta ?? 0) - unitPrice) / (product.compareAt + (variant?.priceDelta ?? 0))) * 100)}%)
            </p>
          )}

          {/* stock */}
          <p className={`text-sm font-semibold mb-5 ${out ? "text-red-600" : low ? "text-amber-600" : "text-emerald-600"}`}>
            {out ? "✕ Out of stock" : low ? `⚠ Only ${availableStock} left — order soon` : "✓ In stock, ready to ship"}
          </p>

          {product.variants && product.variants.length > 0 && (
            <div className="mb-6">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-2.5">
                {allColorVariants(product.variants) ? "Color" : "Choose option"}
                {variant ? <span className="text-slate-800 normal-case"> — {variant.label}
                  {variant.priceDelta !== 0 && (
                    <span className="text-slate-400"> ({variant.priceDelta > 0 ? "+" : "−"}{fmt(Math.abs(variant.priceDelta))})</span>
                  )}
                </span> : null}
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
                        onClick={() => { setVariantId(v.id); setQty(1); setImgIdx(0); setHoverPreview(null); }}
                        onMouseEnter={() => v.image && setHoverPreview(v.image)}
                        onMouseLeave={() => setHoverPreview(null)}
                        className={`relative w-11 h-11 rounded-full transition-all ${
                          selected
                            ? "ring-[3px] ring-emerald-500 ring-offset-2 scale-110"
                            : out2
                            ? "opacity-40 cursor-not-allowed"
                            : "ring-1 ring-slate-300 hover:ring-2 hover:ring-emerald-400 hover:scale-105"
                        }`}
                        style={swatchStyle(color)}
                      >
                        {/* inner border so white swatches stay visible */}
                        <span className="absolute inset-0 rounded-full border border-black/10" />
                        {selected && (
                          <span className={`absolute inset-0 flex items-center justify-center text-sm font-bold ${
                            color === "#f8fafc" || color === "transparent" || color === "#cbd5e1" || color === "#f5f0e1"
                              ? "text-slate-700" : "text-white"
                          }`}>✓</span>
                        )}
                        {out2 && (
                          <span className="absolute inset-0 rounded-full overflow-hidden">
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
                        onClick={() => { setVariantId(v.id); setQty(1); setImgIdx(0); }}
                        className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all inline-flex items-center gap-2 ${
                          v.id === variantId
                            ? "bg-emerald-600 text-white neon-glow-soft"
                            : v.stock <= 0
                            ? "glass-soft text-slate-300 line-through cursor-not-allowed"
                            : "glass-soft text-slate-700 hover:ring-2 hover:ring-emerald-300"
                        }`}
                      >
                        {color && (
                          <span className="w-3.5 h-3.5 rounded-full border border-black/10 shrink-0" style={swatchStyle(color)} />
                        )}
                        {v.label}
                        {v.priceDelta !== 0 && (
                          <span className={`text-[11px] ${v.id === variantId ? "text-emerald-100" : "text-slate-400"}`}>
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

          {!out && unitPrice * qty >= 5000 && (
            <p className="text-xs font-bold text-emerald-600 -mt-3 mb-4">🚚 This order qualifies for FREE shipping</p>
          )}

          {out && (
            <div className="glass rounded-2xl p-4 mb-6">
              {alertDone ? (
                <p className="text-sm font-semibold text-emerald-700">
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
                      className="flex-1 min-w-0 rounded-xl bg-white/70 border border-white/70 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-300/60"
                    />
                    <button className="px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700">
                      Notify me
                    </button>
                  </form>
                </>
              )}
            </div>
          )}

          {!out && <DeliveryEstimate />}

          <p className="text-slate-600 leading-relaxed mb-6">{product.description}</p>

          {/* perks */}
          <ul className="space-y-2 mb-6">
            {perks.map((f) => (
              <li key={f} className="flex items-center gap-2.5 text-sm text-slate-600">
                <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs shrink-0">✓</span>
                {f}
              </li>
            ))}
          </ul>

          {/* qty + actions */}
          <div className="flex items-center gap-3 mb-5">
            <div className="flex items-center glass-soft rounded-xl">
              <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="w-10 h-11 text-slate-600 hover:text-emerald-700 font-bold">−</button>
              <span className="w-10 text-center font-bold">{qty}</span>
              <button onClick={() => setQty((q) => Math.min(Math.max(1, availableStock), q + 1))} className="w-10 h-11 text-slate-600 hover:text-emerald-700 font-bold">+</button>
            </div>
            <button
              disabled={out}
              onClick={() => add(product, qty, variantId)}
              className="flex-1 py-3.5 rounded-xl bg-slate-900 text-white font-bold hover:bg-emerald-600 hover:shadow-lg hover:shadow-emerald-500/40 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Add to Cart · {fmt(unitPrice * qty)}
            </button>
            <button
              onClick={() => toggle(product.id)}
              aria-label="Toggle wishlist"
              className={`w-12 h-12 rounded-xl flex items-center justify-center transition ${
                has(product.id) ? "bg-emerald-600 text-white neon-glow-soft" : "glass-soft text-slate-500 hover:text-emerald-600"
              }`}
            >
              <HeartIcon size={20} filled={has(product.id)} />
            </button>
          </div>

          {/* buy now */}
          <button
            disabled={out}
            onClick={() => { add(product, qty, variantId); navigate("/checkout"); }}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold hover:from-emerald-700 hover:to-teal-700 neon-glow-soft transition-all mb-6 disabled:opacity-40"
          >
            Buy Now →
          </button>

          {/* share */}
          <div className="flex items-center gap-2 mb-5">
            <span className="text-xs font-bold uppercase tracking-wide text-slate-400 mr-1">Share</span>
            <button
              onClick={() =>
                window.open(
                  "https://wa.me/?text=" + encodeURIComponent(`${product.name} — ${fmt(unitPrice)} at XccessoriesPoint! ${location.href}`),
                  "_blank"
                )
              }
              className="px-3.5 py-1.5 rounded-full glass-soft text-xs font-bold text-emerald-700 hover:ring-2 hover:ring-emerald-300 transition"
            >
              WhatsApp
            </button>
            <button
              onClick={() => { navigator.clipboard?.writeText(location.href); push("Link copied 📋"); }}
              className="px-3.5 py-1.5 rounded-full glass-soft text-xs font-bold text-slate-600 hover:ring-2 hover:ring-emerald-300 transition"
            >
              Copy link
            </button>
          </div>

          {/* trust strip */}
          <div className="grid grid-cols-3 gap-3 text-center">
            {[
              [<TruckIcon key="t" size={18} />, "Free ship > Rs 5,000"],
              [<ZapIcon key="z" size={18} />, "2–4 day delivery"],
              ["↩", "7-day easy returns"],
            ].map(([icon, label], i) => (
              <div key={i} className="glass-soft rounded-xl py-3 px-2 flex flex-col items-center gap-1.5 text-emerald-700">
                <span>{icon}</span>
                <span className="text-[11px] font-semibold text-slate-600">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* reviews */}
      <section className="mt-16 grid lg:grid-cols-2 gap-8">
        <div>
          <h2 className="text-xl font-black text-slate-900 mb-4">Customer Reviews ({reviews.length})</h2>
          {reviews.length === 0 ? (
            <p className="text-sm text-slate-500">No approved reviews yet — be the first!</p>
          ) : (
            <div className="space-y-3">
              {reviews.map((r) => (
                <div key={r.id} className="glass rounded-2xl p-4">
                  <div className="flex items-center gap-2.5 mb-1.5">
                    <span className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-sm font-bold">
                      {r.name.charAt(0)}
                    </span>
                    <span className="font-semibold text-slate-900 text-sm">{r.name}</span>
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
          <form onSubmit={submitReview} className="glass rounded-2xl p-5 space-y-3">
            <input
              value={revName}
              onChange={(e) => setRevName(e.target.value)}
              placeholder="Your name"
              required
              className="w-full rounded-xl bg-white/70 border border-white/70 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-300/60"
            />
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRevRating(n)}
                  className={`text-2xl transition ${n <= revRating ? "text-amber-400" : "text-slate-300 hover:text-amber-300"}`}
                  aria-label={`${n} stars`}
                >
                  ★
                </button>
              ))}
              <span className="ml-2 text-sm text-slate-500">{revRating}/5</span>
            </div>
            <textarea
              value={revText}
              onChange={(e) => setRevText(e.target.value)}
              rows={4}
              placeholder="What did you think of it?"
              className="w-full rounded-xl bg-white/70 border border-white/70 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-300/60"
            />
            <button
              disabled={revBusy}
              className="w-full py-3 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 neon-glow-soft disabled:opacity-50"
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
          <div className="glass !bg-white/90 rounded-2xl shadow-xl shadow-slate-900/15 p-2.5 flex items-center gap-3">
            <img src={variant?.image || product.image} alt="" className="w-11 h-11 rounded-xl object-cover" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-slate-900 truncate">{product.name}</p>
              <p className="text-sm font-black text-emerald-700">
                {fmt(unitPrice)}
                {variant && <span className="ml-1.5 text-[10px] font-bold text-slate-400">{variant.label}</span>}
              </p>
            </div>
            <button
              onClick={() => add(product, qty, variantId)}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold neon-glow-soft"
            >
              Add to Cart
            </button>
          </div>
        </div>
      )}

      <RecentlyViewed excludeId={product.id} />

      {/* related */}
      {related.length > 0 && (
        <section className="mt-16">
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-violet-600 mb-1">You might also like</p>
          <h2 className="text-2xl font-black text-slate-900 mb-6">Related Products</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}


/* ---------- dynamic delivery estimate ---------- */
function DeliveryEstimate() {
  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setHours(17, 0, 0, 0); // 5 PM same-day dispatch cutoff
  const beforeCutoff = now < cutoff;
  const msLeft = cutoff.getTime() - now.getTime();
  const hLeft = Math.floor(msLeft / 3600000);
  const mLeft = Math.floor((msLeft % 3600000) / 60000);
  const fmtDay = (offset: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() + offset);
    return d.toLocaleDateString("en-PK", { weekday: "short", day: "numeric", month: "short" });
  };
  const start = beforeCutoff ? 2 : 3;
  return (
    <div className="glass-soft rounded-xl px-4 py-3 mb-6 flex items-start gap-3">
      <span className="text-xl">🚚</span>
      <div className="text-sm">
        <p className="font-semibold text-slate-800">
          Get it by <span className="text-emerald-700">{fmtDay(start)} – {fmtDay(start + 2)}</span>
        </p>
        <p className="text-xs text-slate-500 mt-0.5">
          {beforeCutoff
            ? `⏱ Order within ${hLeft}h ${mLeft}m for same-day dispatch`
            : "Orders placed now ship tomorrow morning"}
          {" · Lahore & Karachi 2–3 days, other cities 3–5"}
        </p>
      </div>
    </div>
  );
}
