import type { Category } from "../types";
import { categoryArt, categoryGlyph } from "../lib/categoryArt";

type CategoryLogoProps = {
  category: Category;
  /** Pixel size of the square logo chip. */
  size?: number;
  /** "chip" = white rounded tile with ring (drawer / shelf header); "plain" = bare image (nav pills). */
  variant?: "chip" | "plain";
  /** Active/department highlight — teal ring instead of neutral. */
  active?: boolean;
  className?: string;
};

/**
 * A category's logo: the admin-set tile image, else the built-in department art,
 * else the category's emoji glyph — shown in a consistent rounded chip.
 */
export default function CategoryLogo({
  category,
  size = 40,
  variant = "chip",
  active = false,
  className = "",
}: CategoryLogoProps) {
  const art = categoryArt(category);
  const glyph = categoryGlyph(category);

  if (variant === "plain") {
    return art ? (
      <img
        src={art}
        alt=""
        aria-hidden="true"
        loading="lazy"
        decoding="async"
        width={size}
        height={size}
        style={{ width: size, height: size }}
        className={`shrink-0 rounded-full object-cover ring-1 ${active ? "ring-white/40" : "ring-slate-900/10"} ${className}`}
      />
    ) : (
      <span
        aria-hidden="true"
        style={{ width: size, height: size, fontSize: size * 0.55 }}
        className={`flex shrink-0 items-center justify-center leading-none ${className}`}
      >
        {glyph}
      </span>
    );
  }

  return (
    <span
      style={{ width: size, height: size }}
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-b from-slate-50 to-white ring-1 ${
        active ? "ring-teal-200" : "ring-slate-200"
      } ${className}`}
    >
      {art ? (
        <img
          src={art}
          alt=""
          aria-hidden="true"
          loading="lazy"
          decoding="async"
          className="h-full w-full object-contain p-1.5"
        />
      ) : (
        <span style={{ fontSize: size * 0.5 }} className="leading-none">
          {glyph}
        </span>
      )}
    </span>
  );
}
