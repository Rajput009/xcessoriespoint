import { useState } from "react";
import type { Product } from "../types";
import { Link } from "../router";
import { swatchFor, swatchStyle, allColorVariants } from "../lib/swatch";
import { useCart, useWishlist, fmt } from "../context/store";
import { useProducts } from "../context/store";
import { CartIcon } from "./icons";

export function Stars({ rating, size = "text-sm" }: { rating: number; size?: string }) {
  const rounded = Math.max(0, Math.min(5, Math.round(rating)));
  return (
    <span className={`${size} text-amber-400 tracking-tight`} aria-label={`${rating} out of 5 stars`} role="img">
      {"★".repeat(rounded)}
      <span className="text-slate-300">{"★".repeat(5 - rounded)}</span>
    </span>
  );
}

export default function ProductCard({ product, compact = false }: { product: Product; compact?: boolean }) {
  const { add } = useCart();
  const { toggle, has } = useWishlist();
  const { categories } = useProducts();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [added, setAdded] = useState(false);

  const hasVariants = (product.variants?.length ?? 0) > 0;
  const catName = categories.find((c) => c.id === product.category)?.name ?? product.category;
  const wished = has(product.id);
  const secondaryImage = product.images?.find((url) => url && url !== product.image);
  const discount =
    product.compareAt && product.compareAt > product.price
      ? Math.round(((product.compareAt - product.price) / product.compareAt) * 100)
      : 0;
  const soldOut = product.stock <= 0 || (hasVariants && product.variants!.every((v) => v.stock <= 0));
  const lowStock = !soldOut && product.stock <= 15;

  const handleAdd = (variantId = 0, variantLabel?: string) => {
    if (soldOut) return;
    add(product, 1, variantId, variantLabel);
    setPickerOpen(false);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1800);
  };

  const openOptionsOrAdd = () => {
    if (hasVariants) setPickerOpen(true);
    else handleAdd();
  };

  return (
    <article className="group min-w-0">
      {/* Image-first stage, like a premium retail catalogue. */}
      <div className="relative aspect-square overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
        <Link to={`/product/${product.id}`} className="relative block w-full h-full">
          <img
            src={product.image}
            alt={product.name}
            loading="lazy"
            decoding="async"
            width={480}
            height={480}
            className={`w-full h-full object-contain transition-transform duration-300 group-hover:scale-[1.04] ${
              secondaryImage ? "group-hover:opacity-0" : ""
            }`}
          />
          {secondaryImage && (
            <img
              src={secondaryImage}
              alt=""
              loading="lazy"
              decoding="async"
              width={480}
              height={480}
              className="absolute inset-0 w-full h-full object-contain opacity-0 group-hover:opacity-100 group-hover:scale-[1.04] transition-all duration-300"
            />
          )}
          {(product.badge || product.newArrival || soldOut) && (
            <span className="absolute top-3 left-3">
              {soldOut ? (
                <span className="inline-flex rounded-full bg-slate-800 px-2.5 py-1 text-[10px] font-bold text-white">
                  SOLD OUT
                </span>
              ) : product.badge ? (
                <span className="inline-flex rounded-full bg-emerald-700 px-2.5 py-1 text-[10px] font-bold text-white">
                  {product.badge}
                </span>
              ) : (
                <span className="inline-flex rounded-full bg-slate-900 px-2.5 py-1 text-[10px] font-black tracking-wide text-white">
                  NEW
                </span>
              )}
            </span>
          )}
        </Link>

        <div className="absolute top-3 right-3 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => toggle(product.id)}
            aria-pressed={wished}
            aria-label={wished ? `Remove ${product.name} from wishlist` : `Add ${product.name} to wishlist`}
            className={`flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-lg shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500 md:opacity-0 md:group-hover:opacity-100 ${
              wished ? "text-emerald-700" : "text-slate-500 hover:text-emerald-700"
            }`}
          >
            {wished ? "♥" : "♡"}
          </button>
          <button
            type="button"
            onClick={openOptionsOrAdd}
            disabled={soldOut}
            aria-label={soldOut ? `${product.name} is sold out` : hasVariants ? `Choose options for ${product.name}` : `Quick add ${product.name}`}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition-all hover:bg-emerald-700 hover:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:cursor-not-allowed disabled:opacity-40 md:opacity-0 md:group-hover:opacity-100"
          >
            <CartIcon size={16} />
          </button>
        </div>
      </div>

      <div className="pt-3">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">{catName}</span>
          {!compact && hasVariants && (
            <span className="flex shrink-0 items-center gap-1" title={product.variants!.map((v) => v.label).join(" · ")}>
              {allColorVariants(product.variants!) ? (
                product.variants!.slice(0, 4).map((v) =>
                  swatchFor(v) ? (
                    <span key={v.id} className="h-3 w-3 rounded-full border border-black/10" style={swatchStyle(swatchFor(v)!)} />
                  ) : null
                )
              ) : (
                <span className="text-[9px] font-semibold normal-case text-slate-400">{product.variants!.length} options</span>
              )}
            </span>
          )}
        </div>

        <div className="mt-1 flex items-start justify-between gap-2">
          <Link to={`/product/${product.id}`} className="min-w-0">
            <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-slate-900 transition-colors group-hover:text-emerald-700">
              {product.name}
            </h3>
          </Link>
          {product.reviews > 0 && (
            <span className="flex shrink-0 items-center gap-1 text-[11px] font-semibold text-slate-600" aria-label={`${product.rating} out of 5 stars`}>
              <span className="text-amber-400">★</span>{product.rating.toFixed(1)}
            </span>
          )}
        </div>

        <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="text-base font-black text-slate-900">{fmt(product.price)}</span>
          {product.compareAt && product.compareAt > product.price && (
            <span className="text-xs text-slate-400 line-through">{fmt(product.compareAt)}</span>
          )}
          {discount > 0 && (
            <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-emerald-700">
              -{discount}%
            </span>
          )}
        </div>

        {lowStock && <p className="mt-1 text-[10px] font-semibold text-amber-700">Only {product.stock} left</p>}

        {pickerOpen && hasVariants && (
          <div className="mt-3 rounded-lg border border-slate-200 bg-white p-2.5">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Choose an option</p>
              <button type="button" onClick={() => setPickerOpen(false)} aria-label="Close options" className="text-xs text-slate-400 hover:text-slate-700">×</button>
            </div>
            {allColorVariants(product.variants!) ? (
              <div className="flex flex-wrap items-center gap-2">
                {product.variants!.map((v) => {
                  const color = swatchFor(v)!;
                  const out = v.stock <= 0;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      disabled={out}
                      title={`${v.label} — ${out ? "sold out" : fmt(product.price + v.priceDelta)}`}
                      aria-label={`${v.label}${out ? " sold out" : ""}`}
                      onClick={() => handleAdd(v.id, v.label)}
                      className={`relative h-8 w-8 rounded-full transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500 ${out ? "cursor-not-allowed opacity-35" : "ring-1 ring-slate-300 hover:ring-2 hover:ring-emerald-500 hover:scale-110"}`}
                      style={swatchStyle(color)}
                    >
                      <span className="absolute inset-0 rounded-full border border-black/10" />
                      {out && <span className="absolute left-1/2 top-1/2 h-[2px] w-[130%] -translate-x-1/2 -translate-y-1/2 rotate-45 bg-red-400" />}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {product.variants!.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    disabled={v.stock <= 0}
                    onClick={() => handleAdd(v.id, v.label)}
                    className={`rounded-md border px-2 py-1.5 text-[10px] font-bold transition focus:outline-none focus:ring-2 focus:ring-emerald-500 ${v.stock <= 0 ? "cursor-not-allowed border-slate-200 text-slate-300 line-through" : "border-slate-200 text-slate-700 hover:border-emerald-400 hover:text-emerald-700"}`}
                  >
                    {v.label}
                    {v.priceDelta !== 0 && <span className="ml-1 text-slate-400">{v.priceDelta > 0 ? "+" : "−"}{Math.abs(v.priceDelta)}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {!compact && (
          <button
            type="button"
            disabled={soldOut}
            aria-label={soldOut ? `${product.name} is sold out` : hasVariants ? `Choose options for ${product.name}` : `Add ${product.name} to cart`}
            onClick={openOptionsOrAdd}
            className={`mt-3 flex w-full items-center justify-center rounded-md py-2.5 text-xs font-bold transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
              soldOut
                ? "cursor-not-allowed bg-slate-100 text-slate-400"
                : added
                ? "bg-emerald-600 text-white"
                : "bg-emerald-600 text-white hover:bg-emerald-700"
            }`}
          >
            {soldOut ? "Sold out" : added ? "Added ✓" : hasVariants ? "Choose options" : "Add to Cart"}
          </button>
        )}
      </div>
    </article>
  );
}
