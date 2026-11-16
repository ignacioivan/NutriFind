import type { APIRoute } from "astro";
import {
  ACCESS_COOKIE,
  clearSessionCookies,
  isSecureRequest,
  jsonNoStore,
  signOutUser,
  verifySameOrigin,
} from "../../../lib/auth.ts";

export const POST: APIRoute = async ({ request, url, cookies, redirect }) => {
  if (!verifySameOrigin(request, url.origin)) {
    return jsonNoStore({ error: "Origen de solicitud no permitido." }, 403);
  }

  const accessToken = cookies.get(ACCESS_COOKIE)?.value ?? "";
  await signOutUser(accessToken);
  clearSessionCookies(cookies, isSecureRequest(url, request));

  const accept = request.headers.get("accept") ?? "";
  if (accept.includes("application/json")) {
    return jsonNoStore({ ok: true });
  }
  return redirect("/", 303);
};
