import { SUPABASE_ANON_KEY, SUPABASE_URL } from "astro:env/server";
import { MAX_ITEMS_PER_LIST, MAX_LISTS_PER_USER } from "./lists-validation.ts";
import { getProductsByIds, type Product } from "./products.ts";

const TIMEOUT_MS = 8000;
const LISTS_TABLE = "listas_compras";
const ITEMS_TABLE = "listas_compras_items";

type ListRow = {
  id: string;
  user_id: string;
  nombre: string;
  descripcion: string | null;
  created_at: string;
  updated_at: string;
};

type ListItemRow = {
  id: string;
  lista_id: string;
  user_id: string;
  product_id: number;
  quantity: number;
  created_at: string;
};

export type ShoppingListSummary = {
  id: string;
  name: string;
  description: string | null;
  itemCount: number;
  containsProduct: boolean;
  productIds: number[];
  createdAt: string;
  updatedAt: string;
};

export type ShoppingListItemDetail = {
  id: string;
  listId: string;
  productId: number;
  quantity: number;
  createdAt: string;
  product: Product | null;
};

export type ShoppingListFull = {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  items: ShoppingListItemDetail[];
  totalPrice: number;
  totalUnits: number;
};

async function restFetch<T>(
  accessToken: string,
  path: string,
  options: RequestInit = {},
): Promise<{ status: number; data: T | null; errorCode?: string }> {
  const headers = new Headers(options.headers);
  headers.set("apikey", SUPABASE_ANON_KEY);
  headers.set("Authorization", `Bearer ${accessToken}`);
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  let res: Response;
  try {
    res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      ...options,
      headers,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    return { status: 503, data: null };
  }

  let parsed: unknown = null;
  try {
    const text = await res.text();
    if (text) parsed = JSON.parse(text);
  } catch {
    parsed = null;
  }

  if (!res.ok) {
    const errObj = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
    const errorCode = typeof errObj.code === "string" ? errObj.code : undefined;
    return { status: res.status, data: null, errorCode };
  }

  return { status: res.status, data: parsed as T };
}

export async function getUserListsSummary(
  accessToken: string,
  targetProductId?: number,
): Promise<{ lists: ShoppingListSummary[]; savedProductIds: number[]; schemaReady: boolean }> {
  const listsParams = new URLSearchParams({
    select: "id,user_id,nombre,descripcion,created_at,updated_at",
    order: "created_at.desc",
    limit: String(MAX_LISTS_PER_USER),
  });
  const listsRes = await restFetch<ListRow[]>(accessToken, `${LISTS_TABLE}?${listsParams}`);

  if (listsRes.status === 404 || listsRes.errorCode === "PGRST205") {
    return { lists: [], savedProductIds: [], schemaReady: false };
  }
  if (!listsRes.data) {
    return { lists: [], savedProductIds: [], schemaReady: true };
  }

  const itemsParams = new URLSearchParams({
    select: "id,lista_id,user_id,product_id,quantity,created_at",
    order: "created_at.desc",
  });
  const itemsRes = await restFetch<ListItemRow[]>(accessToken, `${ITEMS_TABLE}?${itemsParams}`);
  const itemRows = itemsRes.data ?? [];

  const byList = new Map<string, number[]>();
  const savedSet = new Set<number>();

  for (const row of itemRows) {
    const pid = Number(row.product_id);
    if (!Number.isSafeInteger(pid)) continue;
    savedSet.add(pid);
    const arr = byList.get(row.lista_id) ?? [];
    arr.push(pid);
    byList.set(row.lista_id, arr);
  }

  const lists: ShoppingListSummary[] = listsRes.data.map((l) => {
    const productIds = byList.get(l.id) ?? [];
    return {
      id: l.id,
      name: l.nombre,
      description: l.descripcion,
      itemCount: productIds.length,
      containsProduct: targetProductId !== undefined ? productIds.includes(targetProductId) : false,
      productIds,
      createdAt: l.created_at,
      updatedAt: l.updated_at,
    };
  });

  return {
    lists,
    savedProductIds: Array.from(savedSet),
    schemaReady: true,
  };
}

export async function getUserListsWithProducts(
  accessToken: string,
): Promise<{ lists: ShoppingListFull[]; schemaReady: boolean }> {
  const listsParams = new URLSearchParams({
    select: "id,user_id,nombre,descripcion,created_at,updated_at",
    order: "created_at.desc",
    limit: String(MAX_LISTS_PER_USER),
  });
  const listsRes = await restFetch<ListRow[]>(accessToken, `${LISTS_TABLE}?${listsParams}`);

  if (listsRes.status === 404 || listsRes.errorCode === "PGRST205") {
    return { lists: [], schemaReady: false };
  }
  if (!listsRes.data || listsRes.data.length === 0) {
    return { lists: [], schemaReady: true };
  }

  const itemsParams = new URLSearchParams({
    select: "id,lista_id,user_id,product_id,quantity,created_at",
    order: "created_at.desc",
  });
  const itemsRes = await restFetch<ListItemRow[]>(accessToken, `${ITEMS_TABLE}?${itemsParams}`);
  const itemRows = itemsRes.data ?? [];

  const allProductIds = Array.from(
    new Set(itemRows.map((r) => Number(r.product_id)).filter((n) => Number.isSafeInteger(n) && n > 0)),
  );

  let productsById = new Map<number, Product>();
  if (allProductIds.length > 0) {
    try {
      const products = await getProductsByIds(allProductIds);
      productsById = new Map(products.map((p) => [p.id, p]));
    } catch {
      productsById = new Map();
    }
  }

  const itemsByList = new Map<string, ShoppingListItemDetail[]>();
  for (const row of itemRows) {
    const pid = Number(row.product_id);
    const detail: ShoppingListItemDetail = {
      id: row.id,
      listId: row.lista_id,
      productId: pid,
      quantity: row.quantity,
      createdAt: row.created_at,
      product: productsById.get(pid) ?? null,
    };
    const listArr = itemsByList.get(row.lista_id) ?? [];
    listArr.push(detail);
    itemsByList.set(row.lista_id, listArr);
  }

  const lists: ShoppingListFull[] = listsRes.data.map((l) => {
    const items = itemsByList.get(l.id) ?? [];
    let totalPrice = 0;
    let totalUnits = 0;
    for (const item of items) {
      totalUnits += item.quantity;
      if (item.product) {
        totalPrice += item.product.price * item.quantity;
      }
    }
    return {
      id: l.id,
      name: l.nombre,
      description: l.descripcion,
      createdAt: l.created_at,
      updatedAt: l.updated_at,
      items,
      totalPrice,
      totalUnits,
    };
  });

  return { lists, schemaReady: true };
}

export async function createShoppingList(
  accessToken: string,
  userId: string,
  input: { name: string; description?: string | null; initialProductId?: number },
): Promise<{ ok: true; list: ShoppingListSummary } | { ok: false; status: number; message: string }> {
  const current = await getUserListsSummary(accessToken);
  if (!current.schemaReady) {
    return {
      ok: false,
      status: 503,
      message: "Las tablas de listas aún no están activas en Supabase. Ejecuta los 3 bloques de 002_shopping_lists.sql.",
    };
  }
  if (current.lists.length >= MAX_LISTS_PER_USER) {
    return {
      ok: false,
      status: 400,
      message: `Alcanzaste el máximo de ${MAX_LISTS_PER_USER} listas por cuenta.`,
    };
  }

  const createRes = await restFetch<ListRow[]>(accessToken, LISTS_TABLE, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      user_id: userId,
      nombre: input.name,
      descripcion: input.description ?? null,
    }),
  });

  const created = createRes.data?.[0];
  if (!created) {
    if (createRes.errorCode === "23503") {
      return {
        ok: false,
        status: 409,
        message: "Tu perfil aún no está sincronizado. Ejecuta 003_fix_lists_fk_and_backfill.sql en Supabase.",
      };
    }
    if (createRes.errorCode === "42501") {
      return {
        ok: false,
        status: 403,
        message: "Faltan permisos RLS de escritura en public.listas_compras.",
      };
    }
    return { ok: false, status: 502, message: "No pudimos crear la lista en este momento." };
  }

  const productIds: number[] = [];
  if (input.initialProductId !== undefined) {
    const addRes = await addProductToList(accessToken, userId, created.id, input.initialProductId);
    if (addRes.ok) {
      productIds.push(input.initialProductId);
    }
  }

  return {
    ok: true,
    list: {
      id: created.id,
      name: created.nombre,
      description: created.descripcion,
      itemCount: productIds.length,
      containsProduct: productIds.length > 0,
      productIds,
      createdAt: created.created_at,
      updatedAt: created.updated_at,
    },
  };
}

export async function updateShoppingList(
  accessToken: string,
  listId: string,
  input: { name: string; description?: string | null },
): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
  const params = new URLSearchParams({ id: `eq.${listId}` });
  const res = await restFetch<ListRow[]>(accessToken, `${LISTS_TABLE}?${params}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      nombre: input.name,
      descripcion: input.description ?? null,
    }),
  });

  if (!res.data || res.data.length === 0) {
    return { ok: false, status: 404, message: "No encontramos la lista para actualizar." };
  }
  return { ok: true };
}

export async function deleteShoppingList(
  accessToken: string,
  listId: string,
): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
  const params = new URLSearchParams({ id: `eq.${listId}` });
  const res = await restFetch<ListRow[]>(accessToken, `${LISTS_TABLE}?${params}`, {
    method: "DELETE",
    headers: { Prefer: "return=representation" },
  });

  if (!res.data || res.data.length === 0) {
    return { ok: false, status: 404, message: "No encontramos la lista para eliminar." };
  }
  return { ok: true };
}

export async function addProductToList(
  accessToken: string,
  userId: string,
  listId: string,
  productId: number,
): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
  const countParams = new URLSearchParams({
    select: "id",
    lista_id: `eq.${listId}`,
  });
  const existing = await restFetch<{ id: string }[]>(accessToken, `${ITEMS_TABLE}?${countParams}`);
  if (existing.status === 404 || existing.errorCode === "PGRST205") {
    return {
      ok: false,
      status: 503,
      message: "Las tablas de listas aún no están activas en Supabase.",
    };
  }
  if ((existing.data?.length ?? 0) >= MAX_ITEMS_PER_LIST) {
    return {
      ok: false,
      status: 400,
      message: `Esta lista ya alcanzó el límite de ${MAX_ITEMS_PER_LIST} productos.`,
    };
  }

  const insertParams = new URLSearchParams({ on_conflict: "lista_id,product_id" });
  const res = await restFetch<ListItemRow[]>(accessToken, `${ITEMS_TABLE}?${insertParams}`, {
    method: "POST",
    headers: {
      Prefer: "resolution=merge-duplicates,return=representation",
    },
    body: JSON.stringify({
      lista_id: listId,
      user_id: userId,
      product_id: productId,
      quantity: 1,
    }),
  });

  if (!res.data) {
    return { ok: false, status: 502, message: "No pudimos guardar el producto en la lista." };
  }
  return { ok: true };
}

export async function updateListItemQuantity(
  accessToken: string,
  listId: string,
  productId: number,
  quantity: number,
): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
  const params = new URLSearchParams({
    lista_id: `eq.${listId}`,
    product_id: `eq.${productId}`,
  });
  const res = await restFetch<ListItemRow[]>(accessToken, `${ITEMS_TABLE}?${params}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ quantity }),
  });

  if (!res.data || res.data.length === 0) {
    return { ok: false, status: 404, message: "No encontramos el producto en la lista." };
  }
  return { ok: true };
}

export async function removeProductFromList(
  accessToken: string,
  listId: string,
  productId: number,
): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
  const params = new URLSearchParams({
    lista_id: `eq.${listId}`,
    product_id: `eq.${productId}`,
  });
  const res = await restFetch<ListItemRow[]>(accessToken, `${ITEMS_TABLE}?${params}`, {
    method: "DELETE",
  });

  if (res.status >= 400) {
    return { ok: false, status: 502, message: "No pudimos quitar el producto de la lista." };
  }
  return { ok: true };
}
