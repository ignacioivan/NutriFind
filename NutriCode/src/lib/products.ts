import { SUPABASE_URL, SUPABASE_ANON_KEY } from "astro:env/server";
import { type Filters, PAGE_SIZE, postgrestFilter, wordPattern } from "./search.ts";
import { extractSize } from "./format.ts";

// Only place that knows the table. To migrate to productos_integrales, change TABLE and toProduct.
const TABLE = "productos_demo";
const TIMEOUT_MS = 8000;

export const UPCOMING_STORES = ["Tottus", "Jumbo"] as const;

export type Product = {
  id: number;
  name: string;
  brand: string;
  price: number;
  store: string;
  images: string[];
  sourceUrl: string;
  size?: string;
  updatedAt: string;
};

type Row = {
  id: number;
  nombre: string;
  precio: number;
  supermercado: string | null;
  imagen_url: string | null;
  marca: string | null;
  url_origen: string | null;
  created_at: string;
};

export class DataError extends Error {}

function toProduct(r: Row): Product {
  return {
    id: r.id,
    name: r.nombre,
    brand: r.marca?.replaceAll("_", " ").trim() || "Sin marca",
    price: r.precio,
    store: r.supermercado || "Lider",
    images: r.imagen_url ? [r.imagen_url] : [],
    sourceUrl: r.url_origen ?? "",
    size: extractSize(r.nombre),
    updatedAt: r.created_at,
  };
}

async function query(params: URLSearchParams, range?: [number, number]) {
  const headers: Record<string, string> = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  };
  if (range) {
    headers.Range = `${range[0]}-${range[1]}`;
    headers.Prefer = "count=exact";
  }
  let res: Response;
  try {
    res = await fetch(`${SUPABASE_URL}/rest/v1/${TABLE}?${params}`, {
      headers,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (e) {
    throw new DataError(`No connection to Supabase: ${(e as Error).message}`);
  }
  // 416: page out of range with count=exact; not a data error.
  if (!res.ok && res.status !== 416) {
    throw new DataError(`Supabase responded ${res.status}`);
  }
  let rows: Row[] = [];
  if (res.status !== 416) {
    try {
      rows = await res.json();
    } catch (e) {
      throw new DataError(`Invalid Supabase response: ${(e as Error).message}`);
    }
  }
  const total = Number(res.headers.get("content-range")?.split("/")[1] ?? rows.length);
  return { items: rows.map(toProduct), total: Number.isFinite(total) ? total : rows.length };
}

export async function searchProducts(f: Filters): Promise<{ items: Product[]; total: number }> {
  const params = new URLSearchParams({ select: "*", order: "precio.asc,id.asc" });
  const filter = postgrestFilter(f.q);
  if (filter) params.set("and", filter);
  if (f.minPrice !== undefined) params.append("precio", `gte.${f.minPrice}`);
  if (f.maxPrice !== undefined) params.append("precio", `lte.${f.maxPrice}`);
  const from = (f.page - 1) * PAGE_SIZE;
  return query(params, [from, from + PAGE_SIZE - 1]);
}

export async function getProduct(id: number): Promise<Product | null> {
  const { items } = await query(new URLSearchParams({ select: "*", id: `eq.${id}` }));
  return items[0] ?? null;
}

export async function featuredProducts(n = 8): Promise<Product[]> {
  const params = new URLSearchParams({ select: "*", order: "created_at.desc,id.desc", limit: String(n) });
  return (await query(params)).items;
}

const IGNORED_WORDS = new Set(["sin", "gluten", "pack", "con"]);

export async function similarProducts(p: Product, n = 4): Promise<Product[]> {
  const keyword = p.name
    .toLowerCase()
    .split(/\s+/)
    .find((w) => w.length >= 4 && !IGNORED_WORDS.has(w));
  const pattern = keyword ? wordPattern(keyword) : null;
  let similar: Product[] = [];
  if (pattern) {
    const params = new URLSearchParams({
      select: "*",
      nombre: `ilike.%${pattern}%`,
      id: `neq.${p.id}`,
      limit: String(n),
    });
    similar = (await query(params)).items;
  }
  if (similar.length < n) {
    const seen = new Set([p.id, ...similar.map((s) => s.id)]);
    const filler = (await featuredProducts(n + seen.size)).filter((d) => !seen.has(d.id));
    similar = similar.concat(filler.slice(0, n - similar.length));
  }
  return similar;
}
