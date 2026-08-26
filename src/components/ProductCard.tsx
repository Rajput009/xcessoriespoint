import { useState } from "react";
import type { Product } from "../types";
import { Link } from "../router";
import { swatchFor, swatchStyle, allColorVariants } from "../lib/swatch";
import { useCart, useWishlist, fmt } from "../context/store";
import { useProducts } from "../context/store";

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

  return (
    <div className="group surface rounded-xl shadow-none overflow-hidden hover:shadow-md hover:shadow-slate-900/10 hover:-translate-y-0.5 transition-all duration-200 flex flex-col">
      {/* Image stage — contain keeps watches, earbuds and chargers from being cropped. */}
      <div className="relative aspect-square overflow-hidden">
        <Link to={`/product/${product.id}`} className="relative block w-full h-full">
          <img
            src={product.image}
            alt={product.name}
            loading="lazy"
            decoding="async"
            width={400}
            height={400}
            className={`w-full h-full object-contain p-4 transition-all duration-500 group-hover:scale-[1.04] ${
              secondaryImage ? "group-hover:opacity-0" : ""
            }`}
          />
          {secondaryImage && (
            <img
              src={secondaryImage}
              alt=""
              loading="lazy"
              decoding="async"
              width={400}
              height={400}
              className="absolute inset-0 w-full h-full object-contain p-4 opacity-0 group-hover:opacity-100 group-hover:scale-[1.04] transition-all duration-500"
            />
          )}
          <span className="absolute top-3 left-3 flex flex-col gap-1.5 items-start">
            {soldOut ? (
              <span className="bg-slate-800/90 text-white text-[10px] font-bold px-2 py-1 rounded-md shadow-sm">
                SOLD OUT
              </span>
            ) : product.badge ? (
              <span className="bg-emerald-700 text-white text-xs font-bold px-2 py-1 rounded-md shadow-md shadow-emerald-700/25">
                {product.badge}
              </span>
            ) : product.newArrival ? (
              <span className="bg-slate-900/90 text-white text-[10px] font-black px-2 py-1 rounded-md tracking-wide">
                NEW
              </span>
            ) : null}
          </span>
        </Link>
        {!compact && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              toggle(product.id);
            }}
            aria-pressed={wished}
            aria-label={wished ? `Remove ${product.name} from wishlist` : `Add ${product.name} to wishlist`}
            className={`absolute top-3 right-3 w-9 h-9 rounded-full flex items-center justify-center shadow transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 ${
              wished
                ? "bg-emerald-600 text-white"
                : "bg-white text-slate-500 hover:text-emerald-600 hover:bg-white"
            } md:opacity-0 md:group-hover:opacity-100 opacity-100`}
          >
            {wished ? "♥" : "♡"}
          </button>
        )}
      </div>

      <div className="p-4 flex flex-col flex-1">
        <p className="text-xs uppercase tracking-wide font-bold mb-1 flex items-center text-slate-400">
          <span className="truncate">{catName}</span>
          {hasVariants && !compact && (
            <span className="ml-auto flex items-center gap-1 shrink-0" title={product.variants!.map((v) => v.label).join(" · ")}>
              {allColorVariants(product.variants!) ? (
                product.variants!.slice(0, 4).map((v) =>
                  swatchFor(v) ? (
                    <span key={v.id} className="w-3 h-3 rounded-full border border-black/10" style={swatchStyle(swatchFor(v)!)} />
                  ) : null
                )
              ) : (
                <span className="text-[9px] text-slate-400 font-bold normal-case">
                  {product.variants!.length} options
                </span>
              )}
              {product.variants!.length > 4 && (
                <span className="text-[9px] text-slate-400 font-bold normal-case">+{product.variants!.length - 4}</span>
              )}
            </span>
          )}
        </p>

        <Link to={`/product/${product.id}`}>
          <h3 className="font-semibold text-slate-900 text-sm leading-snug mb-1.5 line-clamp-2 hover:text-emerald-700 transition-colors">
            {product.name}
          </h3>
        </Link>

        <div className="flex items-center gap-1.5 mb-2 min-h-[18px]">
          {product.reviews > 0 ? (
            <>
              <Stars rating={product.rating} size="text-xs" />
              <span className="text-xs text-slate-400">({product.reviews})</span>
            </>
          ) : (
            <span className="text-[11px] font-semibold text-slate-400">New listing</span>
          )}
        </div>

        <div className="mt-auto mb-2">
          <div className="flex items-baseline flex-wrap gap-x-2 gap-y-0.5">
            <span className="text-lg font-bold text-emerald-700">{fmt(product.price)}</span>
            {product.compareAt && product.compareAt > product.price && (
              <span className="text-sm text-slate-400 line-through">{fmt(product.compareAt)}</span>
            )}
            {discount > 0 && (
              <span className="text-[10px] font-black uppercase tracking-wide text-emerald-700">{discount}% off</span>
            )}
          </div>
          {!compact && (
            <p className={`text-[10px] font-semibold mt-1 ${lowStock ? "text-amber-700" : soldOut ? "text-slate-400" : "text-slate-400"}`}>
              {soldOut ? "Currently unavailable" : lowStock ? `Only ${product.stock} left` : "COD · 7-day returns"}
            </p>
          )}
        </div>

        {!compact && (pickerOpen && hasVariants ? (
          <div className="fade-up">
            <div className="flex items-center gap-1.5 mb-1">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 flex-1">
                Choose an option
              </p>
              <button
                type="button"
                onClick={() => setPickerOpen(false)}
                aria-label="Close options"
                className="w-5 h-5 rounded-full text-slate-400 hover:bg-slate-100 text-[10px] leading-none"
              >
                ✕
              </button>
            </div>
            {allColorVariants(product.variants!) ? (
              <div className="flex items-center gap-2 py-1 flex-wrap">
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
                      className={`relative w-8 h-8 rounded-full transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                        out
                          ? "opacity-35 cursor-not-allowed"
                          : "ring-1 ring-slate-300 hover:ring-2 hover:ring-emerald-500 hover:scale-110"
                      }`}
                      style={swatchStyle(color)}
                    >
                      <span className="absolute inset-0 rounded-full border border-black/10" />
                      {out && (
                        <span className="absolute left-1/2 top-1/2 w-[130%] h-[2px] bg-red-400 -translate-x-1/2 -translate-y-1/2 rotate-45" />
                      )}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="flex gap-1.5 py-1 flex-wrap">
                {product.variants!.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    disabled={v.stock <= 0}
                    onClick={() => handleAdd(v.id, v.label)}
                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition inline-flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                      v.stock <= 0
                        ? "surface-muted text-slate-300 line-through cursor-not-allowed"
                        : "surface-muted text-slate-700 hover:ring-2 hover:ring-emerald-400 hover:text-emerald-700"
                    }`}
                  >
                    {swatchFor(v) && (
                      <span className="w-2.5 h-2.5 rounded-full border border-black/10" style={swatchStyle(swatchFor(v)!)} />
                    )}
                    {v.label}
                    {v.priceDelta !== 0 && v.stock > 0 && (
                      <span className="text-slate-400 font-semibold">
                        {v.priceDelta > 0 ? "+" : "−"}{Math.abs(v.priceDelta)}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <button
            type="button"
            disabled={soldOut}
            aria-label={soldOut ? `${product.name} is sold out` : hasVariants ? `Choose options for ${product.name}` : `Add ${product.name} to cart`}
            onClick={() => (hasVariants ? setPickerOpen(true) : handleAdd())}
            className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 ${
              soldOut
                ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                : added
                ? "bg-emerald-600 text-white"
                : "bg-slate-900/90 text-white hover:bg-emerald-600 hover:shadow-lg hover:shadow-emerald-500/30"
            }`}
          >
            {soldOut ? "Sold out" : added ? "Added ✓" : hasVariants ? "Choose options" : "Add to Cart"}
          </button>
        ))}
      </div>
    </div>
  );
}
