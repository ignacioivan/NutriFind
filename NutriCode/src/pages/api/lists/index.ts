import type { APIRoute } from "astro";
import { jsonNoStore, readJsonBody, verifySameOrigin } from "../../../lib/auth.ts";
import {
  createShoppingList,
  deleteShoppingList,
  getUserListsSummary,
  updateShoppingList,
} from "../../../lib/lists.ts";
import {
  validateListDescription,
  validateListId,
  validateListName,
  validateProductId,
} from "../../../lib/lists-validation.ts";

export const GET: APIRoute = async ({ url, locals }) => {
  if (!locals.user || !locals.accessToken) {
    return jsonNoStore({ ok: false, message: "Inicia sesión para gestionar tus listas." }, 401);
  }

  const rawPid = url.searchParams.get("productId");
  let targetProductId: number | undefined;
  if (rawPid !== null && rawPid !== "") {
    const pidCheck = validateProductId(rawPid);
    if (!pidCheck.ok) {
      return jsonNoStore({ ok: false, message: pidCheck.message }, 400);
    }
    targetProductId = pidCheck.value;
  }

  const summary = await getUserListsSummary(locals.accessToken, targetProductId);
  return jsonNoStore({
    ok: true,
    lists: summary.lists,
    savedProductIds: summary.savedProductIds,
    schemaReady: summary.schemaReady,
  });
};

export const POST: APIRoute = async ({ request, url, locals }) => {
  if (!verifySameOrigin(request, url.origin)) {
    return jsonNoStore({ ok: false, message: "Origen de solicitud no permitido." }, 403);
  }
  if (!locals.user || !locals.accessToken) {
    return jsonNoStore({ ok: false, message: "Inicia sesión para crear una lista." }, 401);
  }

  const parsed = await readJsonBody(request, 4096);
  if (!parsed.ok || !parsed.data || typeof parsed.data !== "object") {
    return jsonNoStore({ ok: false, message: "Solicitud inválida." }, 400);
  }

  const body = parsed.data as Record<string, unknown>;
  const nameCheck = validateListName(body.name);
  if (!nameCheck.ok) {
    return jsonNoStore({ ok: false, message: nameCheck.message }, 400);
  }

  const descCheck = validateListDescription(body.description);
  if (!descCheck.ok) {
    return jsonNoStore({ ok: false, message: descCheck.message }, 400);
  }

  let initialProductId: number | undefined;
  if (body.productId !== undefined && body.productId !== null && body.productId !== "") {
    const pidCheck = validateProductId(body.productId);
    if (!pidCheck.ok) {
      return jsonNoStore({ ok: false, message: pidCheck.message }, 400);
    }
    initialProductId = pidCheck.value;
  }

  const created = await createShoppingList(locals.accessToken, locals.user.id, {
    name: nameCheck.value,
    description: descCheck.value,
    initialProductId,
  });

  if (!created.ok) {
    return jsonNoStore({ ok: false, message: created.message }, created.status);
  }

  return jsonNoStore({ ok: true, list: created.list }, 201);
};

export const PATCH: APIRoute = async ({ request, url, locals }) => {
  if (!verifySameOrigin(request, url.origin)) {
    return jsonNoStore({ ok: false, message: "Origen de solicitud no permitido." }, 403);
  }
  if (!locals.user || !locals.accessToken) {
    return jsonNoStore({ ok: false, message: "Inicia sesión para editar tu lista." }, 401);
  }

  const parsed = await readJsonBody(request, 4096);
  if (!parsed.ok || !parsed.data || typeof parsed.data !== "object") {
    return jsonNoStore({ ok: false, message: "Solicitud inválida." }, 400);
  }

  const body = parsed.data as Record<string, unknown>;
  const idCheck = validateListId(body.listId);
  if (!idCheck.ok) {
    return jsonNoStore({ ok: false, message: idCheck.message }, 400);
  }

  const nameCheck = validateListName(body.name);
  if (!nameCheck.ok) {
    return jsonNoStore({ ok: false, message: nameCheck.message }, 400);
  }

  const descCheck = validateListDescription(body.description);
  if (!descCheck.ok) {
    return jsonNoStore({ ok: false, message: descCheck.message }, 400);
  }

  const updated = await updateShoppingList(locals.accessToken, idCheck.value, {
    name: nameCheck.value,
    description: descCheck.value,
  });

  if (!updated.ok) {
    return jsonNoStore({ ok: false, message: updated.message }, updated.status);
  }

  return jsonNoStore({ ok: true });
};

export const DELETE: APIRoute = async ({ request, url, locals }) => {
  if (!verifySameOrigin(request, url.origin)) {
    return jsonNoStore({ ok: false, message: "Origen de solicitud no permitido." }, 403);
  }
  if (!locals.user || !locals.accessToken) {
    return jsonNoStore({ ok: false, message: "Inicia sesión para eliminar tu lista." }, 401);
  }

  const parsed = await readJsonBody(request, 4096);
  if (!parsed.ok || !parsed.data || typeof parsed.data !== "object") {
    return jsonNoStore({ ok: false, message: "Solicitud inválida." }, 400);
  }

  const body = parsed.data as Record<string, unknown>;
  const idCheck = validateListId(body.listId);
  if (!idCheck.ok) {
    return jsonNoStore({ ok: false, message: idCheck.message }, 400);
  }

  const deleted = await deleteShoppingList(locals.accessToken, idCheck.value);
  if (!deleted.ok) {
    return jsonNoStore({ ok: false, message: deleted.message }, deleted.status);
  }

  return jsonNoStore({ ok: true });
};
