import type { APIRoute } from "astro";
import { parseFilters } from "../../lib/search.ts";
import { DataError, searchProducts } from "../../lib/products.ts";

export const GET: APIRoute = async ({ url }) => {
  const filters = parseFilters(url.searchParams);
  try {
    const { items, total } = await searchProducts(filters);
    return Response.json(
      { items, total, page: filters.page },
      { headers: { "Cache-Control": "public, max-age=60" } },
    );
  } catch (e) {
    if (!(e instanceof DataError)) throw e;
    console.error(e.message);
    return Response.json({ error: "No pudimos consultar los productos" }, { status: 502 });
  }
};
