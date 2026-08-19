/* Lightweight typo-tolerant search — no dependencies.
 * Levenshtein distance + token scoring: prefix > substring > fuzzy-edit.
 */
import type { Product } from "../types";

function levenshtein(a: string, b: string): number {
  // Damerau variant: adjacent transpositions ("chrager" → "charger") cost 1, not 2
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1])
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}

const tokenize = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9\u0600-\u06FF\s]/g, " ").split(/\s+/).filter((t) => t.length >= 2);

/* ---------- Urdu / Roman-Urdu / market-term synonyms ---------- */
/* Maps how Pakistani customers actually search → catalog vocabulary. */
const SYNONYMS: Record<string, string[]> = {
  // earbuds / headphones
  handsfree: ["earbuds", "headphones"],
  handfree: ["earbuds", "headphones"],
  airpods: ["earbuds"],
  earpods: ["earbuds"],
  earphone: ["earbuds"],
  earphones: ["earbuds"],
  buds: ["earbuds"],
  headphone: ["headphones"],
  "ہینڈ فری": ["earbuds", "headphones"],
  "ہینڈفری": ["earbuds", "headphones"],
  "ایئربڈز": ["earbuds"],
  "بڈز": ["earbuds"],
  "ہیڈ فون": ["headphones"],
  "ہیڈفون": ["headphones"],
  // charger / power
  charjar: ["charger"],
  "چارجر": ["charger"],
  adapter: ["charger"],
  "اڈاپٹر": ["charger"],
  powerbank: ["power", "bank"],
  "پاور بینک": ["power", "bank"],
  "پاوربینک": ["power", "bank"],
  battery: ["power", "bank"],
  "بیٹری": ["power", "bank"],
  // watch
  ghari: ["watch", "smartwatch"],
  gharee: ["watch", "smartwatch"],
  "گھڑی": ["watch", "smartwatch"],
  "سمارٹ واچ": ["smartwatch"],
  "واچ": ["watch", "smartwatch"],
  watch: ["watch", "smartwatch"],
  band: ["band", "watch"],
  // cable
  tar: ["cable"],
  wire: ["cable"],
  "کیبل": ["cable"],
  "تار": ["cable"],
  // case / cover
  cover: ["case"],
  covers: ["case"],
  "کور": ["case"],
  khol: ["case"],
  pouch: ["case"],
};

/* multi-word phrases that should map as a unit */
const PHRASE_SYNONYMS: [string, string[]][] = [
  ["hands free", ["earbuds", "headphones"]],
  ["power bank", ["power", "bank"]],
  ["smart watch", ["smartwatch"]],
  ["mobile cover", ["case"]],
  ["back cover", ["case"]],
  ["پاور بینک", ["power", "bank"]],
  ["ہینڈ فری", ["earbuds", "headphones"]],
  ["سمارٹ واچ", ["smartwatch"]],
];

/** Expand a query into alternative queries (original first). Handles Urdu,
 *  Roman-Urdu and near-miss typos of synonym keys ("hansfree" → handsfree). */
export function expandQuery(query: string): string[] {
  const q = query.toLowerCase().trim();
  const alts = new Set<string>([q]);

  // phrase-level synonyms
  for (const [phrase, targets] of PHRASE_SYNONYMS) {
    if (q.includes(phrase)) alts.add(q.split(phrase).join(targets.join(" ")).trim());
  }

  // token-level synonyms (exact key or fuzzy key match)
  const tokens = tokenize(q);
  const mapped = tokens.map((t) => {
    if (SYNONYMS[t]) return SYNONYMS[t].join(" ");
    // typo-tolerant synonym lookup for latin tokens
    if (/^[a-z0-9]+$/.test(t) && t.length >= 4) {
      for (const key of Object.keys(SYNONYMS)) {
        if (!/^[a-z0-9]+$/.test(key)) continue;
        if (levenshtein(t, key) <= Math.max(1, Math.floor(key.length / 4))) {
          return SYNONYMS[key].join(" ");
        }
      }
    }
    return t;
  });
  const mappedQuery = mapped.join(" ");
  if (mappedQuery !== tokens.join(" ")) alts.add(mappedQuery);

  return Array.from(alts);
}

/** Score one query token against one text token: 1 = perfect, 0 = no match. */
function tokenScore(qt: string, tt: string): number {
  if (tt === qt) return 1;
  if (tt.startsWith(qt)) return 0.92;
  if (tt.includes(qt)) return 0.75;
  // typo tolerance: allow ~1 edit per 4 chars
  const dist = levenshtein(qt, tt);
  const allowed = Math.max(1, Math.floor(qt.length / 4) + (qt.length >= 5 ? 1 : 0));
  if (dist <= allowed) return 0.7 - dist * 0.12;
  return 0;
}

/** Score a whole query against a text (product name + category). */
export function fuzzyScore(query: string, text: string): number {
  const qTokens = tokenize(query);
  const tTokens = tokenize(text);
  if (qTokens.length === 0 || tTokens.length === 0) return 0;
  let total = 0;
  for (const qt of qTokens) {
    let best = 0;
    for (const tt of tTokens) best = Math.max(best, tokenScore(qt, tt));
    total += best;
  }
  return total / qTokens.length; // 0..1
}

/** Fuzzy-rank products for a query (threshold keeps junk out). */
export function fuzzySearchProducts(products: Product[], query: string, threshold = 0.55): Product[] {
  return products
    .map((p) => ({ p, s: fuzzyScore(query, `${p.name} ${p.category} ${p.description ?? ""}`) }))
    .filter((x) => x.s >= threshold)
    .sort((a, b) => b.s - a.s)
    .map((x) => x.p);
}

export interface SmartSearchResult {
  results: Product[];
  /** how the results were found */
  method: "exact" | "synonym" | "fuzzy" | "none";
  /** the query interpretation that produced the results (differs from input for synonym/fuzzy) */
  interpretedAs: string | null;
}

/** Search pipeline: exact substring → synonym expansion → fuzzy (on all alternatives). */
export function smartSearch(products: Product[], query: string): SmartSearchResult {
  const q = query.trim().toLowerCase();
  if (!q) return { results: products, method: "exact", interpretedAs: null };
  const alts = expandQuery(q);

  // pass 1: substring on each alternative (original first)
  for (const alt of alts) {
    const hits = products.filter(
      (p) => p.name.toLowerCase().includes(alt) || p.category.includes(alt)
    );
    if (hits.length > 0)
      return { results: hits, method: alt === q ? "exact" : "synonym", interpretedAs: alt === q ? null : alt };
  }
  // pass 1.5: multi-word alternatives — AND for precision, OR fallback for recall
  for (const alt of alts) {
    const toks = alt.split(/\s+/).filter((t) => t.length >= 2);
    if (toks.length < 2) continue;
    const text = (p: Product) => `${p.name} ${p.category}`.toLowerCase();
    const andHits = products.filter((p) => toks.every((t) => text(p).includes(t)));
    const orHits = alt !== q ? products.filter((p) => toks.some((t) => t.length >= 3 && text(p).includes(t))) : [];
    const hits = andHits.length >= 2 ? andHits : orHits.length > andHits.length ? orHits : andHits;
    if (hits.length > 0)
      return { results: hits, method: alt === q ? "exact" : "synonym", interpretedAs: alt === q ? null : alt };
  }

  // pass 2: fuzzy on each alternative, keep the best set
  let best: Product[] = [];
  let bestAlt: string | null = null;
  for (const alt of alts) {
    const hits = fuzzySearchProducts(products, alt);
    if (hits.length > best.length) {
      best = hits;
      bestAlt = alt;
    }
  }
  if (best.length > 0) return { results: best, method: "fuzzy", interpretedAs: bestAlt !== q ? bestAlt : null };
  return { results: [], method: "none", interpretedAs: null };
}

/** Suggest a corrected search term from the catalog vocabulary. */
export function didYouMean(products: Product[], query: string): string | null {
  const vocab = new Set<string>();
  for (const p of products) for (const t of tokenize(`${p.name} ${p.category}`)) if (t.length >= 3) vocab.add(t);
  const qTokens = tokenize(query);
  if (qTokens.length === 0) return null;

  const corrected = qTokens.map((qt) => {
    let best: string | null = null;
    let bestDist = Infinity;
    for (const v of vocab) {
      if (v === qt) return qt; // token is already valid
      const dist = levenshtein(qt, v);
      if (dist < bestDist || (dist === bestDist && best && v.length < best.length)) {
        bestDist = dist;
        best = v;
      }
    }
    const allowed = Math.max(1, Math.floor(qt.length / 3));
    return best && bestDist <= allowed ? best : qt;
  });

  const suggestion = corrected.join(" ");
  return suggestion.toLowerCase() !== query.toLowerCase().trim() ? suggestion : null;
}
