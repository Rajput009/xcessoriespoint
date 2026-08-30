import { useState } from "react";
import type { Product, Variant } from "../types";
import { Link } from "../router";
import { swatchFor, swatchStyle, allColorVariants } from "../lib/swatch";
import { useCart, useWishlist, fmt, useProducts } from "../context/store";
import { CartIcon, StarIcon } from "./icons";
import type { ProductView } from "./ViewToggle";

/** Fractional-fill star row (product page, reviews summary) */
export function Stars({ rating, size = "text-sm" }: { rating: number; size?: string }) {
  const clamped = Math.max(0, Math.min(5, rating));
  const pct = (clamped / 5) * 100;
  const row = (cls: string) => (
    <span className={`flex shrink-0 gap-[1.5px] ${cls}`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <StarIcon key={i} width="1em" height="1em" className="block" />
      ))}
    </span>
  );
  return (
    <span className={`relative inline-flex ${size}`} role="img" aria-label={`${rating} out of 5 stars`}>
      {row("text-slate-200")}
      <span className="absolute inset-0 overflow-hidden" style={{ width: `${pct}%` }}>
        {row("text-amber-400")}
      </span>
    </span>
  );
}

/** Amaze-style rating: five yellow square chips with white stars */
function StarSquares({ rating, reviews }: { rating: number; reviews?: number }) {
  const rounded = Math.max(0, Math.min(5, Math.round(rating)));
  return (
    <span className="flex items-center gap-1.5" role="img" aria-label={`${rating} out of 5 stars`}>
      <span className="flex gap-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <span
            key={i}
            className={`flex h-[18px] w-5 items-center justify-center rounded-[4px] ${
              i < rounded ? "bg-amber-400" : "bg-slate-200"
            }`}
          >
            <StarIcon size={11} className="text-white" />
          </span>
        ))}
      </span>
      {reviews != null && reviews > 0 && (
        <span className="text-[11px] font-medium text-slate-400">({reviews.toLocaleString("en-PK")})</span>
      )}
    </span>
  );
}

/** Amaze price-tag arrow badge (left-pointing ribbon) */
function DiscountArrow({ discount }: { discount: number }) {
  return (
    <span
      className="inline-flex items-center bg-orange-500 py-0.5 pl-2.5 pr-1.5 text-[11px] font-black leading-relaxed text-white"
      style={{ clipPath: "polygon(0 50%, 14% 0, 100% 0, 100% 100%, 14% 100%)" }}
    >
      -{discount}%
    </span>
  );
}

export default function ProductCard({
  product,
  compact = false,
  view = "grid",
}: {
  product: Product;
  compact?: boolean;
  view?: ProductView;
}) {
  const listView = view === "list";
  const { add } = useCart();
  const { toggle, has } = useWishlist();
  const { categories } = useProducts();
  const [added, setAdded] = useState(false);
  const [selectedId, setSelectedId] = useState(0);

  const variants: Variant[] = product.variants ?? [];
  const hasVariants = variants.length > 0;
  const colorVariants = hasVariants && allColorVariants(variants);
  const catName = categories.find((c) => c.id === product.category)?.name ?? product.category;
  const wished = has(product.id);
  const secondaryImage = product.images?.find((url) => url && url !== product.image);
  const soldOut = product.stock <= 0 || (hasVariants && variants.every((v) => v.stock <= 0));
  const lowStock = !soldOut && product.stock <= 15;
  const discount =
    product.compareAt && product.compareAt > product.price
      ? Math.round(((product.compareAt - product.price) / product.compareAt) * 100)
      : 0;

  /* inline variant selection — pick a swatch/chip, then add */
  const selected = variants.find((v) => v.id === selectedId) ?? null;
  const selectedOut = selected ? selected.stock <= 0 : false;
  const effPrice = selected ? product.price + selected.priceDelta : product.price;

  const pickDefault = () => {
    if (!hasVariants) return 0;
    return variants.find((v) => v.stock > 0)?.id ?? 0;
  };
  const effectiveSelectedId = selectedId || pickDefault();
  const effectiveSelected = variants.find((v) => v.id === effectiveSelectedId) ?? null;
  const addPrice = effectiveSelected ? product.price + effectiveSelected.priceDelta : product.price;
  const addBlocked = soldOut || (hasVariants && !!effectiveSelected && effectiveSelected.stock <= 0);

  const handleAdd = () => {
    if (addBlocked) return;
    add(product, 1, effectiveSelectedId || 0, effectiveSelected?.label);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1800);
  };

  return (
    <article
      className={`group min-w-0 rounded-xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.05)] transition-shadow duration-300 hover:shadow-[0_12px_32px_rgba(15,23,42,0.12)] ${
        listView ? "flex items-stretch gap-3 p-2.5" : "flex flex-col p-3"
      }`}
    >
      {/* ---------- image stage — tall and airy like Amaze ---------- */}
      <div
        className={`relative overflow-hidden rounded-lg bg-white ${
          listView
            ? "flex w-28 shrink-0 items-center border border-slate-100 sm:w-36"
            : "aspect-square w-full"
        }`}
      >
        <Link to={`/product/${product.id}`} className="relative block h-full w-full">
          <img
            src={product.image}
            alt={product.name}
            loading="lazy"
            decoding="async"
            width={480}
            height={480}
            className={`h-full w-full transition-transform duration-300 group-hover:scale-[1.04] ${
              secondaryImage ? "group-hover:opacity-0" : ""
            } object-cover`}
          />
          {secondaryImage && (
            <img
              src={secondaryImage}
              alt=""
              loading="lazy"
              decoding="async"
              width={480}
              height={480}
              className="absolute inset-0 h-full w-full object-cover opacity-0 transition-all duration-300 group-hover:scale-[1.04] group-hover:opacity-100"
            />
          )}
          {(product.badge || product.newArrival || product.bestSeller || soldOut) && (
            <span className="absolute left-3 top-3">
              {soldOut ? (
                <span className="inline-flex rounded-md bg-slate-800 px-2.5 py-1 text-[11px] font-bold text-white">
                  SOLD OUT
                </span>
              ) : product.bestSeller ? (
                <span className="inline-flex rounded-md bg-amber-400 px-2.5 py-1 text-[11px] font-black uppercase tracking-wide text-slate-900 shadow-sm">
                  Best Seller
                </span>
              ) : product.badge ? (
                <span className="inline-flex rounded-md bg-slate-800 px-2.5 py-1 text-[11px] font-bold text-white">
                  {product.badge}
                </span>
              ) : (
                <span className="inline-flex rounded-md bg-slate-900 px-2.5 py-1 text-[11px] font-black tracking-wide text-white">
                  NEW
                </span>
              )}
            </span>
          )}
        </Link>

        {/* wishlist — single quiet action on the stage */}
        <button
          type="button"
          onClick={() => toggle(product.id)}
          aria-pressed={wished}
          aria-label={wished ? `Remove ${product.name} from wishlist` : `Add ${product.name} to wishlist`}
          className={`absolute right-2.5 top-2.5 flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-base shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-orange-500 md:opacity-0 md:group-hover:opacity-100 ${
            wished ? "text-orange-600" : "text-slate-400 hover:text-orange-600"
          }`}
        >
          {wished ? "♥" : "♡"}
        </button>
      </div>

      {/* ---------- content ---------- */}
      <div className={`flex min-w-0 flex-1 flex-col ${listView ? "py-1 pr-1" : "pt-2.5"}`}>
        <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">{catName}</span>

        <Link to={`/product/${product.id}`} className="mt-1">
          <h3 className={`font-bold leading-snug text-slate-900 transition-colors group-hover:text-orange-600 ${
            listView ? "line-clamp-2 text-[15px]" : "line-clamp-2 text-[15px] md:text-base"
          }`}>
            {product.name}
          </h3>
        </Link>

        {!compact && product.reviews > 0 && (
          <span className="mt-2">
            <StarSquares rating={product.rating} reviews={product.reviews} />
          </span>
        )}

        <div className="mt-1.5 flex flex-nowrap items-center gap-x-1.5 min-w-0">
          <span className="shrink-0 text-lg font-black text-orange-600 font-mono tabular-nums">{fmt(effPrice)}</span>
          {product.compareAt && product.compareAt > effPrice && (
            <span className="min-w-0 truncate text-xs text-slate-400 line-through">{fmt(product.compareAt)}</span>
          )}
          {discount > 0 && <span className="shrink-0"><DiscountArrow discount={discount} /></span>}
        </div>

        {lowStock && <p className="mt-1.5 text-[11px] font-bold text-orange-600">Hurry! Only {product.stock} left</p>}

        {/* ---------- inline variant selection ---------- */}
        {!compact && hasVariants && (
          <div className="mt-2 mb-3">
            {colorVariants ? (
              <div className="flex flex-wrap items-center gap-1.5">
                {variants.map((v) => {
                  const color = swatchFor(v);
                  const out = v.stock <= 0;
                  const active = effectiveSelectedId === v.id;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      disabled={out}
                      title={`${v.label} — ${out ? "sold out" : fmt(product.price + v.priceDelta)}`}
                      aria-label={`${v.label}${out ? " sold out" : ""}${active ? " (selected)" : ""}`}
                      aria-pressed={active}
                      onClick={() => setSelectedId(v.id)}
                      className={`relative h-7 w-7 rounded-md transition-all focus:outline-none focus:ring-2 focus:ring-orange-500 ${
                        out
                          ? "cursor-not-allowed opacity-35"
                          : active
                          ? "ring-2 ring-slate-900 ring-offset-1"
                          : "ring-1 ring-slate-200 hover:ring-2 hover:ring-orange-400"
                      }`}
                      style={color ? swatchStyle(color) : undefined}
                    >
                      <span className="absolute inset-0 rounded-md border border-black/10" />
                      {out && (
                        <span className="absolute left-1/2 top-1/2 h-[2px] w-[130%] -translate-x-1/2 -translate-y-1/2 rotate-45 bg-red-400" />
                      )}
                    </button>
                  );
                })}
                {selected && (
                  <span className="ml-1 text-[11px] font-semibold text-slate-500">{selected.label}</span>
                )}
              </div>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {variants.map((v) => {
                  const out = v.stock <= 0;
                  const active = effectiveSelectedId === v.id;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      disabled={out}
                      onClick={() => setSelectedId(v.id)}
                      aria-pressed={active}
                      className={`rounded-md border px-2 py-1 text-[11px] font-bold transition focus:outline-none focus:ring-2 focus:ring-orange-500 ${
                        out
                          ? "cursor-not-allowed border-slate-200 text-slate-300 line-through"
                          : active
                          ? "border-slate-900 bg-slate-900 text-white"
                          : "border-slate-200 text-slate-700 hover:border-orange-400 hover:text-orange-600"
                      }`}
                    >
                      {v.label}
                      {v.priceDelta !== 0 && (
                        <span className="ml-1 opacity-70">
                          {v.priceDelta > 0 ? "+" : "−"}
                          {Math.abs(v.priceDelta)}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ---------- add ---------- */}
        {!compact && (
          <button
            type="button"
            onClick={handleAdd}
            disabled={addBlocked}
            aria-label={soldOut ? `${product.name} is sold out` : `Add ${product.name} to cart`}
            className={`mt-auto flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-black uppercase tracking-wide transition-all focus:outline-none focus:ring-2 focus:ring-orange-500 ${
              addBlocked
                ? "cursor-not-allowed bg-slate-100 text-slate-400"
                : added
                ? "bg-emerald-600 text-white"
                : "bg-slate-900 text-white hover:bg-orange-600"
            }`}
          >
            <CartIcon size={14} />
            {soldOut
              ? "Sold out"
              : added
              ? "Added ✓"
              : hasVariants
              ? effectiveSelected
                ? effectiveSelected.stock <= 0
                  ? "Sold out"
                  : `Add — ${effectiveSelected.label}`
                : "Choose option"
              : "Add to Cart"}
          </button>
        )}

        {/* compact mode (carousels): show price-level swatches only */}
        {compact && hasVariants && colorVariants && (
          <span className="mt-1.5 flex items-center gap-1">
            {variants.slice(0, 5).map((v) =>
              swatchFor(v) ? (
                <span key={v.id} className="h-3 w-3 rounded-[3px] border border-black/10" style={swatchStyle(swatchFor(v)!)} />
              ) : null
            )}
          </span>
        )}
      </div>
    </article>
  );
}
