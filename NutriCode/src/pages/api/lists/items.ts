import type { APIRoute } from "astro";
import { jsonNoStore, readJsonBody, verifySameOrigin } from "../../../lib/auth.ts";
import {
  addProductToList,
  removeProductFromList,
  updateListItemQuantity,
} from "../../../lib/lists.ts";
import {
  validateListId,
  validateProductId,
  validateQuantity,
} from "../../../lib/lists-validation.ts";

export const POST: APIRoute = async ({ request, url, locals }) => {
  if (!verifySameOrigin(request, url.origin)) {
    return jsonNoStore({ ok: false, message: "Origen de solicitud no permitido." }, 403);
  }
  if (!locals.user || !locals.accessToken) {
    return jsonNoStore({ ok: false, message: "Inicia sesión para guardar productos." }, 401);
  }

  const parsed = await readJsonBody(request, 4096);
  if (!parsed.ok || !parsed.data || typeof parsed.data !== "object") {
    return jsonNoStore({ ok: false, message: "Solicitud inválida." }, 400);
  }

  const body = parsed.data as Record<string, unknown>;
  const listCheck = validateListId(body.listId);
  if (!listCheck.ok) {
    return jsonNoStore({ ok: false, message: listCheck.message }, 400);
  }

  const pidCheck = validateProductId(body.productId);
  if (!pidCheck.ok) {
    return jsonNoStore({ ok: false, message: pidCheck.message }, 400);
  }

  const added = await addProductToList(
    locals.accessToken,
    locals.user.id,
    listCheck.value,
    pidCheck.value,
  );
  if (!added.ok) {
    return jsonNoStore({ ok: false, message: added.message }, added.status);
  }

  return jsonNoStore({ ok: true }, 201);
};

export const PATCH: APIRoute = async ({ request, url, locals }) => {
  if (!verifySameOrigin(request, url.origin)) {
    return jsonNoStore({ ok: false, message: "Origen de solicitud no permitido." }, 403);
  }
  if (!locals.user || !locals.accessToken) {
    return jsonNoStore({ ok: false, message: "Inicia sesión para modificar cantidades." }, 401);
  }

  const parsed = await readJsonBody(request, 4096);
  if (!parsed.ok || !parsed.data || typeof parsed.data !== "object") {
    return jsonNoStore({ ok: false, message: "Solicitud inválida." }, 400);
  }

  const body = parsed.data as Record<string, unknown>;
  const listCheck = validateListId(body.listId);
  if (!listCheck.ok) {
    return jsonNoStore({ ok: false, message: listCheck.message }, 400);
  }

  const pidCheck = validateProductId(body.productId);
  if (!pidCheck.ok) {
    return jsonNoStore({ ok: false, message: pidCheck.message }, 400);
  }

  const qtyCheck = validateQuantity(body.quantity);
  if (!qtyCheck.ok) {
    return jsonNoStore({ ok: false, message: qtyCheck.message }, 400);
  }

  const updated = await updateListItemQuantity(
    locals.accessToken,
    listCheck.value,
    pidCheck.value,
    qtyCheck.value,
  );
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
    return jsonNoStore({ ok: false, message: "Inicia sesión para quitar productos." }, 401);
  }

  const parsed = await readJsonBody(request, 4096);
  if (!parsed.ok || !parsed.data || typeof parsed.data !== "object") {
    return jsonNoStore({ ok: false, message: "Solicitud inválida." }, 400);
  }

  const body = parsed.data as Record<string, unknown>;
  const listCheck = validateListId(body.listId);
  if (!listCheck.ok) {
    return jsonNoStore({ ok: false, message: listCheck.message }, 400);
  }

  const pidCheck = validateProductId(body.productId);
  if (!pidCheck.ok) {
    return jsonNoStore({ ok: false, message: pidCheck.message }, 400);
  }

  const removed = await removeProductFromList(
    locals.accessToken,
    listCheck.value,
    pidCheck.value,
  );
  if (!removed.ok) {
    return jsonNoStore({ ok: false, message: removed.message }, removed.status);
  }

  return jsonNoStore({ ok: true });
};
