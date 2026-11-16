import type { APIRoute } from "astro";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "astro:env/server";
import {
  clearSessionCookies,
  isSecureRequest,
  jsonNoStore,
  readJsonBody,
  verifySameOrigin,
} from "../../../lib/auth.ts";

const TIMEOUT_MS = 8000;

async function callSupabaseRpc(
  fnName: string,
  args: Record<string, unknown> = {},
  accessToken?: string | null,
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const headers: Record<string, string> = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${accessToken || SUPABASE_ANON_KEY}`,
    "Content-Type": "application/json",
  };

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fnName}`, {
      method: "POST",
      headers,
      body: JSON.stringify(args),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const text = await res.text();
    let data: unknown = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 503, data: null };
  }
}

function isLocalDevRequest(url: URL): boolean {
  return import.meta.env.DEV || url.hostname === "localhost" || url.hostname === "127.0.0.1";
}

export const GET: APIRoute = async ({ locals, url }) => {
  if (!isLocalDevRequest(url)) {
    return jsonNoStore({ ok: true, currentUser: locals.user ?? null, rpcReady: false, users: [] });
  }
  const rpcRes = await callSupabaseRpc("dev_list_registered_users", {}, locals.accessToken);
  return jsonNoStore({
    ok: true,
    currentUser: locals.user ?? null,
    rpcReady: rpcRes.ok,
    users: Array.isArray(rpcRes.data) ? rpcRes.data : [],
  });
};

export const DELETE: APIRoute = async ({ request, url, cookies, locals }) => {
  if (!verifySameOrigin(request, url.origin)) {
    return jsonNoStore({ error: "Origen de solicitud no permitido." }, 403);
  }

  const secure = isSecureRequest(url, request);

  if (locals.accessToken) {
    await callSupabaseRpc("delete_own_account", {}, locals.accessToken);
  }

  clearSessionCookies(cookies, secure);
  return jsonNoStore({
    ok: true,
    message: "Cuenta eliminada y sesión cerrada correctamente.",
  });
};

export const POST: APIRoute = async ({ request, url, cookies, locals }) => {
  if (!isLocalDevRequest(url)) {
    return jsonNoStore({ error: "Endpoint disponible únicamente en entorno local de desarrollo." }, 403);
  }
  if (!verifySameOrigin(request, url.origin)) {
    return jsonNoStore({ error: "Origen de solicitud no permitido." }, 403);
  }

  const parsed = await readJsonBody(request);
  if (!parsed.ok || typeof parsed.data !== "object" || parsed.data === null) {
    return jsonNoStore({ error: "Formato inválido." }, 400);
  }

  const body = parsed.data as { email?: unknown; clearCookies?: unknown };
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email) {
    return jsonNoStore({ error: "Ingresa el correo del usuario que deseas purgar." }, 400);
  }

  const rpcRes = await callSupabaseRpc(
    "admin_reset_demo_user",
    { target_email: email },
    locals.accessToken,
  );

  // Si el usuario purgado es el que tenía la sesión abierta (o si se pidió limpiar cookies), cerramos sesión local
  const secure = isSecureRequest(url, request);
  if (
    body.clearCookies === true ||
    (locals.user && locals.user.email.toLowerCase() === email)
  ) {
    clearSessionCookies(cookies, secure);
  }

  if (!rpcRes.ok) {
    return jsonNoStore(
      {
        ok: false,
        error:
          "Falta ejecutar 005_dev_user_cleanup.sql en el SQL Editor de Supabase para habilitar el borrado directo desde este panel.",
      },
      409,
    );
  }

  return jsonNoStore({
    ok: true,
    result: rpcRes.data,
    message: `El correo ${email} fue eliminado de auth.users, public.profiles y listas_compras.`,
  });
};
