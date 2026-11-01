export const PAGE_SIZE = 24;
const MAX_QUERY = 80;

export type Filters = {
  q: string;
  minPrice?: number;
  maxPrice?: number;
  page: number;
};

function positiveInt(v: string | null): number | undefined {
  if (v === null || !/^\d+$/.test(v.trim())) return undefined;
  const n = Number(v);
  return Number.isSafeInteger(n) ? n : undefined;
}

// URL params stay in Spanish (precioMin/precioMax): they are user-facing.
export function parseFilters(params: URLSearchParams): Filters {
  const f: Filters = {
    q: (params.get("q") ?? "").trim().slice(0, MAX_QUERY),
    page: Math.max(1, positiveInt(params.get("page")) ?? 1),
  };
  const min = positiveInt(params.get("precioMin"));
  const max = positiveInt(params.get("precioMax"));
  if (min !== undefined) f.minPrice = min;
  if (max !== undefined) f.maxPrice = max;
  return f;
}

const VOWELS = /[aeiouáéíóúàèìòùäëïöüâêîôû]/g;
const DISALLOWED = /[^a-z0-9ñáéíóúàèìòùäëïöüâêîôû]/g;

// shortcut: ilike wildcards instead of unaccent/full-text search; replace once Pedro adds unaccent in Postgres
export function wordPattern(word: string): string | null {
  let p = word.toLowerCase().replace(DISALLOWED, "");
  if (p.length > 4) p = p.replace(/es$|s$/, "");
  p = p.replace(VOWELS, "_");
  return p || null;
}

export function postgrestFilter(q: string): string | null {
  const patterns = q
    .toLowerCase()
    .split(DISALLOWED)
    .filter((w) => w.length >= 2)
    .map(wordPattern)
    .filter((p): p is string => p !== null);
  if (patterns.length === 0) return null;
  const conditions = patterns.map((p) => `or(nombre.ilike."%${p}%",marca.ilike."%${p}%")`);
  return `(${conditions.join(",")})`;
}
