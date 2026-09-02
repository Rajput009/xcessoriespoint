import type { ReactNode } from "react";

/**
 * XccessoriesPoint identity primitives.
 *
 * BoltMark — the signature: a PIXEL-X — nine rounded tiles forming an X, with
 * the center tile gold — "the Point" (Xccessories*Point*). The mark is
 * one-color capable, reads at favicon size, and is unmistakable in a crowded
 * feed. Appears in the logotype, section kicker hairlines, empty states, the
 * deals poster, the footer whisper-pattern and the hero watermark — nowhere
 * else.
 */

/* Nine tiles on a 64 grid: five on one diagonal, four on the other. */
const PIXELS: [number, number][] = [
  [8, 8], [19, 19], [30, 30], [41, 41], [52, 52],
  [8, 52], [19, 41], [41, 19], [52, 8],
];
const CENTER_TILE = 2; // [30,30] — the gold point

export function BoltMark({
  size = 28,
  className = "",
  sw,
}: {
  size?: number;
  className?: string;
  sw?: number;
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className={className}>
      {PIXELS.map(([x, y], i) => (
        <rect
          key={`${x}-${y}`}
          x={x}
          y={y}
          width={10}
          height={10}
          rx={3}
          fill={i === CENTER_TILE ? "#e7b52e" : "currentColor"}
        />
      ))}
    </svg>
  );
}

/** Full logotype: bolt-X mark + "Xccessories / POINT · PK" wordmark. */
export function Logo({
  tone = "light",
  markSize = 34,
  className = "",
  compact = false,
}: {
  tone?: "light" | "dark";
  markSize?: number;
  className?: string;
  compact?: boolean;
}) {
  const ink = tone === "dark" ? "text-white" : "text-slate-900";
  const mark = tone === "dark" ? "text-amber-200" : "text-teal-600";
  const sub = tone === "dark" ? "text-amber-200/80" : "text-teal-600";
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <BoltMark size={markSize} className={mark} />
      <span className="flex flex-col leading-none">
        <span className={`font-display text-lg font-bold tracking-tight ${ink}`}>Xccessories</span>
        {!compact && (
          <span className={`mt-1 font-mono text-[9px] font-semibold uppercase tracking-[0.3em] ${sub}`}>
            Point · PK
          </span>
        )}
      </span>
    </span>
  );
}

/** Section kicker — editorial eyebrow: small dot + spaced-out sans label. */
export function Kicker({
  children,
  center = false,
  className = "",
}: {
  children: ReactNode;
  center?: boolean;
  className?: string;
}) {
  return (
    <p
      className={`eyebrow mb-2.5 ${center ? "justify-center" : ""} ${className}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-teal-600" aria-hidden="true" />
      {children}
    </p>
  );
}
