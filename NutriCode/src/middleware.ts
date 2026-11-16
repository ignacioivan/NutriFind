import { defineMiddleware } from "astro:middleware";
import {
  ACCESS_COOKIE,
  clearSessionCookies,
  getUserFromToken,
  isSecureRequest,
  REFRESH_COOKIE,
  refreshSession,
  setSessionCookies,
} from "./lib/auth.ts";

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

export const onRequest = defineMiddleware(async (context, next) => {
  const secure = isSecureRequest(context.url, context.request);
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
});
