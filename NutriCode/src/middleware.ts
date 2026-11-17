import type { APIContext } from "astro";
import { defineMiddleware } from "astro:middleware";
import { DEV_ACCESS_PASSWORD } from "astro:env/server";
import {
  ACCESS_COOKIE,
  clearSessionCookies,
  getClientIp,
  getRateLimitStore,
  getUserFromToken,
  isSecureRequest,
  jsonNoStore,
  REFRESH_COOKIE,
  refreshSession,
  setSessionCookies,
  verifySameOrigin,
} from "./lib/auth.ts";
import { sanitizeRedirectPath } from "./lib/auth-validation.ts";
import {
  DEV_GATE_COOKIE,
  DEV_GATE_MAX_AGE_SECONDS,
  DEV_GATE_PATH,
  renderDevGateResponse,
  signDevGateToken,
  verifyDevGateToken,
  verifyPasswordConstantTime,
} from "./lib/dev-gate.ts";
import { checkAndTrackRequest, clearAuthFailures, recordAuthFailure } from "./lib/rate-limit.ts";

const SECURITY_HEADERS: Record<string, string> = {
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  // CSP compatible con Astro ClientRouter, inline scripts mínimos de productos/tema e imágenes de supermercados
  "Content-Security-Policy": [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' data:",
    "img-src 'self' https: data:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; "),
};

function applySecurityHeaders(headers: Headers, secure: boolean): void {
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    if (!headers.has(key)) headers.set(key, value);
  }
  if (secure && !headers.has("Strict-Transport-Security")) {
    headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  headers.delete("X-Powered-By");
}

function withSecurityHeaders(response: Response, secure: boolean): Response {
  try {
    applySecurityHeaders(response.headers, secure);
    return response;
  } catch {
    const headers = new Headers(response.headers);
    applySecurityHeaders(headers, secure);
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }
}

function safeNextPath(raw: unknown): string {
  const candidate = sanitizeRedirectPath(raw, "/");
  return candidate.startsWith(DEV_GATE_PATH) ? "/" : candidate;
}

async function handleDevGate(context: APIContext, secure: boolean): Promise<Response | null> {
  const secret = typeof DEV_ACCESS_PASSWORD === "string" ? DEV_ACCESS_PASSWORD : "";
  if (!secret) return null;

  const { url, request, cookies } = context;

  if (url.pathname === DEV_GATE_PATH && request.method === "POST") {
    if (!verifySameOrigin(request, url.origin)) {
      return renderDevGateResponse({
        nextPath: "/",
        error: "Origen de solicitud no permitido.",
        status: 403,
      });
    }

    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return renderDevGateResponse({
        nextPath: "/",
        error: "Solicitud inválida.",
        status: 400,
      });
    }

    const nextPath = safeNextPath(form.get("next"));
    const password = typeof form.get("password") === "string" ? String(form.get("password")) : "";
    const ip = getClientIp(request, context.clientAddress);
    const store = await getRateLimitStore();

    const gate = await checkAndTrackRequest(store, "dev_gate", ip);
    if (!gate.allowed) {
      const mins = Math.max(1, Math.ceil(gate.retryAfterSeconds / 60));
      return renderDevGateResponse({
        nextPath,
        error: `Demasiados intentos. Espera ${mins} minuto${mins === 1 ? "" : "s"} para volver a intentar.`,
        status: 429,
        retryAfterSeconds: gate.retryAfterSeconds,
      });
    }

    if (!(await verifyPasswordConstantTime(password, secret))) {
      const fail = await recordAuthFailure(store, "dev_gate", ip);
      if (fail.blocked) {
        const mins = Math.max(1, Math.ceil(fail.retryAfterSeconds / 60));
        return renderDevGateResponse({
          nextPath,
          error: `Acceso bloqueado temporalmente por intentos fallidos. Reintenta en ${mins} minuto${mins === 1 ? "" : "s"}.`,
          status: 429,
          retryAfterSeconds: fail.retryAfterSeconds,
        });
      }
      return renderDevGateResponse({
        nextPath,
        error: `Clave incorrecta. Te quedan ${fail.remainingAttempts} intento${fail.remainingAttempts === 1 ? "" : "s"}.`,
        status: 401,
      });
    }

    await clearAuthFailures(store, "dev_gate", ip);
    const token = await signDevGateToken(secret);
    cookies.set(DEV_GATE_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure,
      path: "/",
      maxAge: DEV_GATE_MAX_AGE_SECONDS,
    });
    return context.redirect(nextPath, 303);
  }

  const token = cookies.get(DEV_GATE_COOKIE)?.value;
  if (await verifyDevGateToken(token, secret)) {
    if (url.pathname === DEV_GATE_PATH) {
      return context.redirect("/", 303);
    }
    return null;
  }

  if (url.pathname.startsWith("/api/")) {
    return jsonNoStore({ error: "Acceso restringido al entorno de pruebas." }, 401);
  }

  const nextPath = safeNextPath(`${url.pathname}${url.search}`);
  return renderDevGateResponse({ nextPath, status: 401 });
}

export const onRequest = defineMiddleware(async (context, next) => {
  const secure = isSecureRequest(context.url, context.request);

  const gateResponse = await handleDevGate(context, secure);
  if (gateResponse) {
    return withSecurityHeaders(gateResponse, secure);
  }

  const accessToken = context.cookies.get(ACCESS_COOKIE)?.value ?? "";
  const refreshToken = context.cookies.get(REFRESH_COOKIE)?.value ?? "";

  let activeToken: string | null = accessToken || null;
  let user = accessToken ? await getUserFromToken(accessToken) : null;
  if (!user && refreshToken) {
    const refreshed = await refreshSession(refreshToken);
    if (refreshed) {
      user = refreshed.user;
      activeToken = refreshed.accessToken;
      setSessionCookies(context.cookies, refreshed, secure);
    } else {
      activeToken = null;
      clearSessionCookies(context.cookies, secure);
    }
  }

  context.locals.user = user;
  context.locals.accessToken = user ? activeToken : null;

  const response = await next();
  return withSecurityHeaders(response, secure);
});
