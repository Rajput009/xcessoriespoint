import type { Category } from "../types";

/** Built-in category art (WebP tiles shipped in /public/img). */
export const CATEGORY_ART: Record<string, string> = {
  audio: "/img/cat-audio.webp",
  wearables: "/img/cat-wearables.webp",
  power: "/img/cat-power.webp",
  cases: "/img/cat-cases.webp",
  cables: "/img/cat-cables.webp",
};

export const FALLBACK_CATEGORY_ICON = "🗂";

/**
 * Resolve a category's logo image. The admin-set tile image wins, then the
 * built-in art; returns null when there is no image (caller can show the emoji).
 */
export function categoryArt(category: Category): string | null {
  return category.image || CATEGORY_ART[category.id] || null;
}

/** Emoji glyph for a category, used as the final fallback. */
export function categoryGlyph(category: Category): string {
  return category.icon || FALLBACK_CATEGORY_ICON;
}
