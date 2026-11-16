import type { AstroCookies } from "astro";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "astro:env/server";
import type { DietaryPriority } from "./auth-validation.ts";
import { createKVRateLimitStore, createMemoryRateLimitStore, type CloudflareKVLike, type RateLimitStore } from "./rate-limit.ts";

const TIMEOUT_MS = 8000;

export const ACCESS_COOKIE = "nf_access_token";
export const REFRESH_COOKIE = "nf_refresh_token";
const ACCESS_MAX_AGE_SECONDS = 60 * 60; // 1 hora
const REFRESH_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 días

export type AuthUser = {
  id: string;
  email: string;
  fullName: string;
  priority: DietaryPriority;
};

type SupabaseUserPayload = {
  id: string;
  email?: string;
  user_metadata?: {
    full_name?: string;
    dietary_priority?: string;
  };
};

type SupabaseAuthResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  user?: SupabaseUserPayload;
  error?: string;
  error_code?: string;
  msg?: string;
  message?: string;
};

export type AuthSession = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: AuthUser;
};

export class AuthServiceError extends Error {
  status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.status = status;
  }
}

function toAuthUser(u: SupabaseUserPayload): AuthUser {
  const fullName = (u.user_metadata?.full_name ?? "").trim() || "Usuario";
  const priority = u.user_metadata?.dietary_priority === "sin_gluten" ? "sin_gluten" : "sin_gluten";
  return {
    id: u.id,
    email: u.email ?? "",
    fullName,
    priority,
  };
}

async function authFetch(path: string, options: RequestInit = {}): Promise<{ status: number; data: SupabaseAuthResponse }> {
  const headers = new Headers(options.headers);
  headers.set("apikey", SUPABASE_ANON_KEY);
  if (!headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${SUPABASE_ANON_KEY}`);
  }
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  let res: Response;
  try {
    res = await fetch(`${SUPABASE_URL}/auth/v1${path}`, {
      ...options,
      headers,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw new AuthServiceError("No pudimos conectar con el servicio de cuentas. Intenta en unos segundos.", 503);
  }

  let data: SupabaseAuthResponse = {};
  try {
    const text = await res.text();
    if (text) data = JSON.parse(text) as SupabaseAuthResponse;
  } catch {
    data = {};
  }

  return { status: res.status, data };
}

export async function signUpWithEmail(input: {
  fullName: string;
  email: string;
  password: string;
  priority: DietaryPriority;
  redirectTo?: string;
}): Promise<{ ok: true; session: AuthSession | null; user: AuthUser | null; requiresEmailConfirmation: boolean } | { ok: false; status: number; message: string }> {
  const signupPath = input.redirectTo
    ? `/signup?redirect_to=${encodeURIComponent(input.redirectTo)}`
    : "/signup";
  const { status, data } = await authFetch(signupPath, {
    method: "POST",
    body: JSON.stringify({
      email: input.email,
      password: input.password,
      data: {
        full_name: input.fullName,
        dietary_priority: input.priority,
      },
    }),
  });

  if (status >= 400) {
    const code = data.error_code ?? "";
    if (code === "user_already_exists" || status === 422 || status === 400) {
      return {
        ok: false,
        status: 400,
        message: "No pudimos completar el registro con esos datos. Si ya tienes cuenta, intenta ingresar.",
      };
    }
    return {
      ok: false,
      status: 502,
      message: "No pudimos crear tu cuenta en este momento. Intenta de nuevo.",
    };
  }

  const user = data.user ? toAuthUser(data.user) : null;
  if (data.access_token && data.refresh_token && user) {
    return {
      ok: true,
      session: {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresIn: typeof data.expires_in === "number" ? data.expires_in : ACCESS_MAX_AGE_SECONDS,
        user,
      },
      user,
      requiresEmailConfirmation: false,
    };
  }

  return {
    ok: true,
    session: null,
    user,
    requiresEmailConfirmation: true,
  };
}

export async function signInWithPassword(input: {
  email: string;
  password: string;
}): Promise<{ ok: true; session: AuthSession } | { ok: false; status: number; message: string }> {
  const { status, data } = await authFetch("/token?grant_type=password", {
    method: "POST",
    body: JSON.stringify({
      email: input.email,
      password: input.password,
    }),
  });

  if (status >= 400 || !data.access_token || !data.refresh_token || !data.user) {
    if (status === 400 || status === 401 || status === 422) {
      // Mensaje genérico: evita enumeración de correos registrados
      return { ok: false, status: 401, message: "Correo o contraseña incorrectos." };
    }
    return { ok: false, status: 502, message: "No pudimos iniciar sesión en este momento." };
  }

  return {
    ok: true,
    session: {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: typeof data.expires_in === "number" ? data.expires_in : ACCESS_MAX_AGE_SECONDS,
      user: toAuthUser(data.user),
    },
  };
}

export async function getUserFromToken(accessToken: string): Promise<AuthUser | null> {
  if (!accessToken) return null;
  try {
    const { status, data } = await authFetch("/user", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    const payload = data as unknown as SupabaseUserPayload;
    if (status === 200 && payload?.id) {
      return toAuthUser(payload);
    }
    return null;
  } catch {
    return null;
  }
}

export async function refreshSession(refreshToken: string): Promise<AuthSession | null> {
  if (!refreshToken) return null;
  try {
    const { status, data } = await authFetch("/token?grant_type=refresh_token", {
      method: "POST",
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (status === 200 && data.access_token && data.refresh_token && data.user) {
      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresIn: typeof data.expires_in === "number" ? data.expires_in : ACCESS_MAX_AGE_SECONDS,
        user: toAuthUser(data.user),
      };
    }
    return null;
  } catch {
    return null;
  }
}

export async function signOutUser(accessToken: string): Promise<void> {
  if (!accessToken) return;
  try {
    await authFetch("/logout", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
  } catch {
    // Igual limpiamos cookies locales aunque Supabase no responda
  }
}

export function setSessionCookies(cookies: AstroCookies, session: AuthSession, isSecure: boolean): void {
  const base = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: isSecure,
    path: "/",
  };
  cookies.set(ACCESS_COOKIE, session.accessToken, {
    ...base,
    maxAge: Math.min(Math.max(session.expiresIn, 300), ACCESS_MAX_AGE_SECONDS),
  });
  cookies.set(REFRESH_COOKIE, session.refreshToken, {
    ...base,
    maxAge: REFRESH_MAX_AGE_SECONDS,
  });
}

export function clearSessionCookies(cookies: AstroCookies, isSecure: boolean): void {
  const base = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: isSecure,
    path: "/",
  };
  cookies.delete(ACCESS_COOKIE, base);
  cookies.delete(REFRESH_COOKIE, base);
}

export function isSecureRequest(url: URL, request: Request): boolean {
  return url.protocol === "https:" || request.headers.get("x-forwarded-proto") === "https";
}

export function verifySameOrigin(request: Request, expectedOrigin: string): boolean {
  const origin = request.headers.get("origin");
  if (origin) return origin === expectedOrigin;
  const referer = request.headers.get("referer");
  if (!referer) return false;
  try {
    return new URL(referer).origin === expectedOrigin;
  } catch {
    return false;
  }
}

export function getClientIp(request: Request, clientAddress?: string): string {
  const cfIp = request.headers.get("cf-connecting-ip");
  if (cfIp) return cfIp.trim();
  if (clientAddress) return clientAddress.trim();
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return "127.0.0.1";
}

export async function getRateLimitStore(): Promise<RateLimitStore> {
  try {
    const mod = await import("cloudflare:workers");
    const kv: CloudflareKVLike | undefined = mod.env?.AUTH_RATE_LIMIT ?? mod.env?.SESSION;
    if (kv && typeof kv.get === "function" && typeof kv.put === "function") {
      return createKVRateLimitStore(kv);
    }
  } catch {
    // En node/tests sin runtime workerd usa fallback en memoria local
  }
  return createMemoryRateLimitStore();
}

export function jsonNoStore(body: unknown, status = 200, extraHeaders?: Record<string, string>): Response {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      ...extraHeaders,
    },
  });
}

export async function readJsonBody(request: Request, maxBytes = 8192): Promise<{ ok: true; data: unknown } | { ok: false; status: number }> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return { ok: false, status: 415 };
  }
  const text = await request.text();
  if (text.length > maxBytes) {
    return { ok: false, status: 413 };
  }
  try {
    return { ok: true, data: JSON.parse(text) };
  } catch {
    return { ok: false, status: 400 };
  }
}
