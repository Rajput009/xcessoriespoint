/* Color-swatch helpers for product variants. */

/** Derive a swatch color from a variant label when none is stored. */
const LABEL_COLORS: [RegExp, string][] = [
  [/midnight|black/i, "#0f172a"],
  [/white/i, "#f8fafc"],
  [/forest|dark green/i, "#166534"],
  [/green/i, "#16a34a"],
  [/rose|pink/i, "#f472b6"],
  [/clear|transparent/i, "transparent"],
  [/silver|grey|gray/i, "#cbd5e1"],
  [/blue|navy/i, "#2563eb"],
  [/red|crimson/i, "#dc2626"],
  [/gold|amber|yellow/i, "#f59e0b"],
  [/purple|violet/i, "#8b5cf6"],
  [/orange/i, "#f97316"],
  [/beige|cream|ivory/i, "#f5f0e1"],
  [/brown|tan/i, "#92400e"],
];

export function swatchFor(variant: { swatch?: string | null; label: string }): string | null {
  if (variant.swatch) return variant.swatch;
  for (const [re, hex] of LABEL_COLORS) if (re.test(variant.label)) return hex;
  return null;
}

/** True when every active variant has a resolvable color — enables circle-swatch UI. */
export function allColorVariants(variants: { swatch?: string | null; label: string; stock: number }[]): boolean {
  return variants.length > 0 && variants.every((v) => swatchFor(v) !== null);
}

/** Small inline style for a swatch dot (handles "transparent" with a checker look). */
export function swatchStyle(color: string): React.CSSProperties {
  if (color === "transparent")
    return {
      backgroundImage:
        "linear-gradient(45deg,#e2e8f0 25%,transparent 25%,transparent 75%,#e2e8f0 75%),linear-gradient(45deg,#e2e8f0 25%,#fff 25%,#fff 75%,#e2e8f0 75%)",
      backgroundSize: "8px 8px",
      backgroundPosition: "0 0,4px 4px",
    };
  return { backgroundColor: color };
}
