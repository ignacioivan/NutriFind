import type { APIRoute } from "astro";
import {
  AuthServiceError,
  getClientIp,
  getRateLimitStore,
  isSecureRequest,
  jsonNoStore,
  readJsonBody,
  setSessionCookies,
  signInWithPassword,
  verifySameOrigin,
} from "../../../lib/auth.ts";
import { validateLoginPayload } from "../../../lib/auth-validation.ts";
import {
  checkAndTrackRequest,
  clearAuthFailures,
  formatRetryMinutes,
  lockIpImmediately,
  recordAuthFailure,
} from "../../../lib/rate-limit.ts";

function rateLimited(retryAfterSeconds: number): Response {
  const wait = formatRetryMinutes(retryAfterSeconds);
  return jsonNoStore(
    {
      error: `Demasiados intentos seguidos. Espera ${wait} antes de volver a intentar.`,
      retryAfterSeconds,
    },
    429,
    { "Retry-After": String(retryAfterSeconds) },
  );
}

export const POST: APIRoute = async ({ request, url, cookies, clientAddress }) => {
  if (!verifySameOrigin(request, url.origin)) {
    return jsonNoStore({ error: "Origen de solicitud no permitido." }, 403);
  }

  const store = await getRateLimitStore();
  const ip = getClientIp(request, clientAddress);
  const gate = await checkAndTrackRequest(store, "login", ip);
  if (!gate.allowed) {
    return rateLimited(gate.retryAfterSeconds);
  }

  const parsedBody = await readJsonBody(request);
  if (!parsedBody.ok) {
    return jsonNoStore({ error: "Formato de solicitud inválido." }, parsedBody.status);
  }

  const validated = validateLoginPayload(parsedBody.data);
  if (!validated.ok) {
    if (validated.botDetected) {
      const retryAfter = await lockIpImmediately(store, "login", ip);
      return rateLimited(retryAfter);
    }
    const fail = await recordAuthFailure(store, "login", ip);
    if (fail.blocked) {
      return rateLimited(fail.retryAfterSeconds);
    }
    return jsonNoStore({ error: validated.message, fieldErrors: validated.fieldErrors }, 422);
  }

  try {
    const result = await signInWithPassword(validated.data);
    if (!result.ok) {
      const fail = await recordAuthFailure(store, "login", ip);
      if (fail.blocked) {
        return rateLimited(fail.retryAfterSeconds);
      }
      return jsonNoStore({ error: result.message }, result.status);
    }

    await clearAuthFailures(store, "login", ip);
    setSessionCookies(cookies, result.session, isSecureRequest(url, request));

    return jsonNoStore({
      ok: true,
      user: { fullName: result.session.user.fullName, email: result.session.user.email },
    });
  } catch (e) {
    if (e instanceof AuthServiceError) {
      return jsonNoStore({ error: e.message }, e.status);
    }
    return jsonNoStore({ error: "No pudimos iniciar sesión." }, 502);
  }
};
