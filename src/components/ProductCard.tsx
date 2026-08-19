import { useState } from "react";
import type { Product } from "../types";
import { Link } from "../router";
import { swatchFor, swatchStyle, allColorVariants } from "../lib/swatch";
import { useCart, useWishlist, fmt } from "../context/store";
import { useProducts } from "../context/store";

export function Stars({ rating, size = "text-sm" }: { rating: number; size?: string }) {
  return (
    <span className={`${size} text-amber-400 tracking-tight`} aria-label={`${rating} out of 5`}>
      {"★".repeat(Math.round(rating))}
      <span className="text-slate-300">{"★".repeat(5 - Math.round(rating))}</span>
    </span>
  );
}

const CAT_COLORS: Record<string, string> = {
  audio: "text-violet-500",
  wearables: "text-emerald-600",
  power: "text-amber-600",
  cases: "text-rose-500",
  cables: "text-cyan-600",
};

export default function ProductCard({ product }: { product: Product }) {
  const { add } = useCart();
  const [pickerOpen, setPickerOpen] = useState(false);
  const hasVariants = (product.variants?.length ?? 0) > 0;
  const { toggle, has } = useWishlist();
  const { categories } = useProducts();
  const catName = categories.find((c) => c.id === product.category)?.name ?? product.category;
  const wished = has(product.id);

  return (
    <div className="group glass rounded-2xl overflow-hidden hover:shadow-xl hover:shadow-emerald-500/15 hover:-translate-y-1 transition-all duration-300 flex flex-col">
      <Link to={`/product/${product.id}`} className="relative aspect-square overflow-hidden bg-white/50 block">
        <img
          src={product.image}
          alt={product.name}
          loading="lazy"
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
        />
        <span className="absolute top-3 left-3 flex flex-col gap-1.5 items-start">
          {product.badge && (
            <span className="bg-gradient-to-r from-rose-500 to-orange-500 text-white text-xs font-bold px-2 py-1 rounded-md shadow-md shadow-rose-500/30">
              {product.badge}
            </span>
          )}
          {product.newArrival && (
            <span className="bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white text-[10px] font-black px-2 py-0.5 rounded-md shadow-md shadow-violet-500/30 tracking-wide">
              NEW
            </span>
          )}
          {product.stock <= 0 && (
            <span className="bg-slate-800/90 text-white text-[10px] font-bold px-2 py-0.5 rounded-md">
              SOLD OUT
            </span>
          )}
        </span>
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggle(product.id); }}
          aria-label="Toggle wishlist"
          className={`absolute top-3 right-3 w-9 h-9 rounded-full flex items-center justify-center shadow transition-all ${
            wished
              ? "bg-emerald-600 text-white"
              : "bg-white text-slate-500 hover:text-emerald-600"
          } md:opacity-0 md:group-hover:opacity-100 opacity-100`}
        >
          {wished ? "♥" : "♡"}
        </button>
      </Link>
      <div className="p-4 flex flex-col flex-1">
        <p className={`text-xs uppercase tracking-wide font-bold mb-1 flex items-center ${CAT_COLORS[product.category] ?? "text-slate-400"}`}>
          {catName}
          {hasVariants && (
            <span className="ml-auto flex items-center gap-1" title={product.variants!.map((v) => v.label).join(" · ")}>
              {product.variants!.slice(0, 4).map((v) =>
                swatchFor(v) ? (
                  <span key={v.id} className="w-3 h-3 rounded-full border border-black/10" style={swatchStyle(swatchFor(v)!)} />
                ) : null
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
        <div className="flex items-center gap-1.5 mb-2">
          <Stars rating={product.rating} size="text-xs" />
          <span className="text-xs text-slate-400">({product.reviews})</span>
        </div>
        <div className="flex items-baseline gap-2 mb-3 mt-auto">
          <span className="text-lg font-bold text-emerald-700">{fmt(product.price)}</span>
          {product.compareAt && (
            <span className="text-sm text-slate-400 line-through">{fmt(product.compareAt)}</span>
          )}
        </div>
        {pickerOpen && hasVariants ? (
          /* inline picker — nothing gets covered, options morph in place of the button */
          <div className="fade-up">
            <div className="flex items-center gap-1.5 mb-1">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 flex-1">
                Pick an option
              </p>
              <button
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
                      disabled={out}
                      title={`${v.label} — ${out ? "sold out" : fmt(product.price + v.priceDelta)}`}
                      aria-label={v.label}
                      onClick={() => { add(product, 1, v.id, v.label); setPickerOpen(false); }}
                      className={`relative w-8 h-8 rounded-full transition-all ${
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
                    disabled={v.stock <= 0}
                    onClick={() => { add(product, 1, v.id, v.label); setPickerOpen(false); }}
                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition inline-flex items-center gap-1.5 ${
                      v.stock <= 0
                        ? "glass-soft text-slate-300 line-through cursor-not-allowed"
                        : "glass-soft text-slate-700 hover:ring-2 hover:ring-emerald-400 hover:text-emerald-700"
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
            onClick={() => (hasVariants ? setPickerOpen(true) : add(product))}
            className="w-full py-2.5 rounded-xl bg-slate-900/90 text-white text-sm font-semibold hover:bg-emerald-600 hover:shadow-lg hover:shadow-emerald-500/40 transition-all"
          >
            {hasVariants ? "Add to Cart ▾" : "Add to Cart"}
          </button>
        )}
      </div>
    </div>
  );
}
