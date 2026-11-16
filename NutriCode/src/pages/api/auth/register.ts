import type { APIRoute } from "astro";
import {
  AuthServiceError,
  getClientIp,
  getRateLimitStore,
  isSecureRequest,
  jsonNoStore,
  readJsonBody,
  setSessionCookies,
  signUpWithEmail,
  verifySameOrigin,
} from "../../../lib/auth.ts";
import { validateRegistrationPayload } from "../../../lib/auth-validation.ts";
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
      error: `Demasiados intentos en poco tiempo. Espera ${wait} antes de volver a intentarlo.`,
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
  const gate = await checkAndTrackRequest(store, "register", ip);
  if (!gate.allowed) {
    return rateLimited(gate.retryAfterSeconds);
  }

  const parsedBody = await readJsonBody(request);
  if (!parsedBody.ok) {
    return jsonNoStore({ error: "Formato de solicitud inválido." }, parsedBody.status);
  }

  const validated = validateRegistrationPayload(parsedBody.data);
  if (!validated.ok) {
    if (validated.botDetected) {
      const retryAfter = await lockIpImmediately(store, "register", ip);
      return rateLimited(retryAfter);
    }
    const fail = await recordAuthFailure(store, "register", ip);
    if (fail.blocked) {
      return rateLimited(fail.retryAfterSeconds);
    }
    return jsonNoStore(
      {
        error: validated.message,
        fieldErrors: validated.fieldErrors,
        remainingAttempts: fail.remainingAttempts,
      },
      422,
    );
  }

  try {
    const emailRedirectTo = `${url.origin}/ingresar?verificado=1`;
    const result = await signUpWithEmail({
      ...validated.data,
      redirectTo: emailRedirectTo,
    });
    if (!result.ok) {
      const fail = await recordAuthFailure(store, "register", ip);
      if (fail.blocked) {
        return rateLimited(fail.retryAfterSeconds);
      }
      return jsonNoStore(
        { error: result.message, remainingAttempts: fail.remainingAttempts },
        result.status,
      );
    }

    await clearAuthFailures(store, "register", ip);
    if (result.session) {
      setSessionCookies(cookies, result.session, isSecureRequest(url, request));
    }

    return jsonNoStore(
      {
        ok: true,
        requiresEmailConfirmation: result.requiresEmailConfirmation,
        user: result.user ? { fullName: result.user.fullName, email: result.user.email } : null,
      },
      201,
    );
  } catch (e) {
    if (e instanceof AuthServiceError) {
      return jsonNoStore({ error: e.message }, e.status);
    }
    return jsonNoStore({ error: "No pudimos completar el registro." }, 502);
  }
};
