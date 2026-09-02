import { useState } from "react";
import type { Product, Variant } from "../types";
import { Link } from "../router";
import { swatchFor, swatchStyle, allColorVariants } from "../lib/swatch";
import { useCart, useWishlist, fmt, useProducts } from "../context/store";
import { CartIcon } from "./icons";
import type { ProductView } from "./ViewToggle";

/** Fractional-fill star row (used across product cards, product page, reviews) */
export function Stars({ rating, size = "text-sm" }: { rating: number; size?: string }) {
  const clamped = Math.max(0, Math.min(5, rating));
  const pct = (clamped / 5) * 100;
  const row = (cls: string) => (
    <span className={`flex shrink-0 gap-[1.5px] ${cls}`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <StarRow key={i} />
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

function StarRow() {
  return (
    <svg width="1em" height="1em" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="block">
      <path d="M11.05 2.92a1.1 1.1 0 0 1 1.9 0l2.62 5.06 5.62.9c.86.14 1.2 1.19.58 1.8l-4.02 3.94.94 5.6c.15.86-.76 1.51-1.53 1.1L12 18.66l-5.16 2.66c-.77.4-1.68-.24-1.53-1.1l.94-5.6-4.02-3.93c-.62-.62-.28-1.67.58-1.81l5.62-.9 2.62-5.06Z" />
    </svg>
  );
}

/** Compact rating: stars + numeric score + review count. */
function RatingRow({ rating, reviews }: { rating: number; reviews?: number }) {
  return (
    <span className="inline-flex items-center gap-1.5" role="img" aria-label={`${rating} out of 5 stars`}>
      <Stars rating={rating} size="text-[13px]" />
      <span className="text-xs font-semibold text-slate-500">
        {rating.toFixed(1)}
        {reviews != null && reviews > 0 && (
          <span className="font-normal text-slate-400"> ({reviews.toLocaleString("en-PK")})</span>
        )}
      </span>
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
  const effPrice = selected ? product.price + selected.priceDelta : product.price;

  const pickDefault = () => {
    if (!hasVariants) return 0;
    return variants.find((v) => v.stock > 0)?.id ?? 0;
  };
  const effectiveSelectedId = selectedId || pickDefault();
  const effectiveSelected = variants.find((v) => v.id === effectiveSelectedId) ?? null;
  const addBlocked = soldOut || (hasVariants && !!effectiveSelected && effectiveSelected.stock <= 0);

  const handleAdd = () => {
    if (addBlocked) return;
    add(product, 1, effectiveSelectedId || 0, effectiveSelected?.label);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1800);
  };

  return (
    <article
      className={`group relative h-fit min-w-0 rounded-2xl bg-white ring-1 ring-slate-900/5 shadow-[0_1px_2px_rgba(16,42,36,0.04),0_10px_28px_-18px_rgba(16,42,36,0.2)] transition-[box-shadow,transform] duration-300 hover:-translate-y-1 hover:shadow-[0_2px_6px_rgba(16,42,36,0.05),0_22px_44px_-20px_rgba(16,42,36,0.3)] ${
        listView ? "flex items-stretch gap-4 p-3" : "flex flex-col p-2.5 sm:p-3"
      }`}
    >
      {/* ---------- image stage ---------- */}
      <div
        className={`relative overflow-hidden rounded-xl bg-slate-50 ring-1 ring-slate-100 ${
          listView
            ? "flex w-28 shrink-0 items-center sm:w-40"
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
            className={`h-full w-full transition-transform duration-500 group-hover:scale-[1.05] ${
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
              className="absolute inset-0 h-full w-full object-cover opacity-0 transition-all duration-500 group-hover:scale-[1.05] group-hover:opacity-100"
            />
          )}
          {/* status chips — stacked top-left */}
          <span className="absolute left-2 top-2 flex flex-col items-start gap-1.5">
            {soldOut ? (
              <span className="rounded-full bg-slate-900/85 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white backdrop-blur">
                Sold out
              </span>
            ) : (
              <>
                {discount > 0 && (
                  <span className="rounded-full bg-orange-500 px-2.5 py-1 text-[10px] font-bold text-white shadow-sm">
                    -{discount}%
                  </span>
                )}
                {product.bestSeller && (
                  <span className="rounded-full bg-teal-600/95 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white backdrop-blur">
                    Best seller
                  </span>
                )}
                {!product.bestSeller && product.newArrival && (
                  <span className="rounded-full bg-slate-900/85 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white backdrop-blur">
                    New
                  </span>
                )}
              </>
            )}
          </span>
        </Link>

        {/* wishlist — single quiet action on the stage */}
        <button
          type="button"
          onClick={() => toggle(product.id)}
          aria-pressed={wished}
          aria-label={wished ? `Remove ${product.name} from wishlist` : `Add ${product.name} to wishlist`}
          className={`absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-white/95 text-base shadow-sm ring-1 ring-slate-900/5 backdrop-blur transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 md:opacity-0 md:group-hover:opacity-100 ${
            wished ? "text-orange-600" : "text-slate-400 hover:text-orange-600"
          }`}
        >
          {wished ? "♥" : "♡"}
        </button>
      </div>

      {/* ---------- content ---------- */}
      <div className={`flex min-w-0 flex-1 flex-col ${listView ? "py-1" : "pt-3"}`}>
        <span className="font-mono text-[9px] font-medium uppercase tracking-[0.14em] text-slate-400">{catName}</span>

        <Link to={`/product/${product.id}`} className="mt-1">
          <h3 className={`font-semibold leading-snug text-slate-900 transition-colors group-hover:text-teal-700 ${
            listView ? "line-clamp-2 text-[15px]" : "line-clamp-2 text-sm sm:text-[15px]"
          }`}>
            {product.name}
          </h3>
        </Link>

        {!compact && product.reviews > 0 && (
          <span className="mt-1.5">
            <RatingRow rating={product.rating} reviews={product.reviews} />
          </span>
        )}

        <div className="mt-1.5 flex min-w-0 flex-nowrap items-baseline gap-x-2">
          <span className="shrink-0 font-mono text-base font-bold text-slate-900 tabular-nums sm:text-lg">{fmt(effPrice)}</span>
          {product.compareAt && product.compareAt > effPrice && (
            <span className="min-w-0 truncate text-xs text-slate-400 line-through">{fmt(product.compareAt)}</span>
          )}
        </div>

        {lowStock && <p className="mt-1 text-[11px] font-semibold text-orange-600">Only {product.stock} left</p>}

        {/* ---------- desktop variant selection ---------- */}
        {!compact && hasVariants && (
          <div className="mt-2 mb-3 hidden sm:block">
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
                      className={`relative h-7 w-7 rounded-full transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-1 ${out ? "cursor-not-allowed opacity-35" : active ? "ring-2 ring-slate-900 ring-offset-2" : "ring-1 ring-slate-200 hover:ring-2 hover:ring-teal-500"}`}
                      style={color ? swatchStyle(color) : undefined}
                    >
                      <span className="absolute inset-0 rounded-full border border-black/10" />
                      {out && <span className="absolute left-1/2 top-1/2 h-[2px] w-[130%] -translate-x-1/2 -translate-y-1/2 rotate-45 bg-red-400" />}
                    </button>
                  );
                })}
                {selected && <span className="ml-1 truncate text-[11px] font-medium text-slate-500">{selected.label}</span>}
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
                      className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${out ? "cursor-not-allowed border-slate-200 text-slate-300 line-through" : active ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 text-slate-700 hover:border-teal-400 hover:text-teal-700"}`}
                    >
                      {v.label}
                      {v.priceDelta !== 0 && <span className="ml-0.5 opacity-70">{v.priceDelta > 0 ? "+" : "−"}{Math.abs(v.priceDelta)}</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* mobile color dots */}
        {!compact && hasVariants && colorVariants && (
          <span className="mt-2 flex items-center gap-1 sm:hidden">
            {variants.slice(0, 5).map((v) => {
              const color = swatchFor(v);
              const out = v.stock <= 0;
              const active = effectiveSelectedId === v.id;
              return color ? (
                <button
                  key={v.id}
                  type="button"
                  disabled={out}
                  onClick={() => setSelectedId(v.id)}
                  aria-label={`${v.label}${out ? " sold out" : ""}`}
                  className={`h-4 w-4 rounded-full border border-black/10 focus:outline-none ${out ? "opacity-30" : active ? "ring-2 ring-slate-900 ring-offset-1" : ""}`}
                  style={swatchStyle(color)}
                />
              ) : null;
            })}
          </span>
        )}

        {/* ---------- add ---------- */}
        {!compact && (
          <button
            type="button"
            onClick={handleAdd}
            disabled={addBlocked}
            aria-label={soldOut ? `${product.name} is sold out` : `Add ${product.name} to cart`}
            className={`mt-auto flex w-full items-center justify-center gap-1.5 rounded-full py-2.5 text-xs font-semibold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 sm:mt-3 ${
              addBlocked
                ? "cursor-not-allowed bg-slate-100 text-slate-400"
                : added
                ? "bg-teal-600 text-white"
                : "bg-slate-900 text-white hover:-translate-y-0.5 hover:bg-slate-800 hover:shadow-lg hover:shadow-slate-900/20"
            }`}
          >
            <CartIcon size={14} />
            <span>{soldOut
              ? "Sold out"
              : added
              ? "Added ✓"
              : hasVariants
              ? effectiveSelected
                ? effectiveSelected.stock <= 0
                  ? "Sold out"
                  : `Add · ${effectiveSelected.label}`
                : "Choose option"
              : "Add to cart"}
            </span>
          </button>
        )}

        {/* compact mode (carousels): show price-level swatches only */}
        {compact && hasVariants && colorVariants && (
          <span className="mt-1.5 flex items-center gap-1">
            {variants.slice(0, 5).map((v) =>
              swatchFor(v) ? (
                <span key={v.id} className="h-3 w-3 rounded-full border border-black/10" style={swatchStyle(swatchFor(v)!)} />
              ) : null
            )}
          </span>
        )}
      </div>
    </article>
  );
}
