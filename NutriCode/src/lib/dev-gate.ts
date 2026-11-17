export const DEV_GATE_COOKIE = "nf_dev_access";
export const DEV_GATE_PATH = "/_dev-gate";
export const DEV_GATE_MAX_AGE_SECONDS = 15 * 60;

const TOKEN_SCOPE = "nutrifind-dev-gate";
const encoder = new TextEncoder();

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> | null {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return null;
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  try {
    const binary = atob(padded);
    const out = new Uint8Array(new ArrayBuffer(binary.length));
    for (let i = 0; i < binary.length; i += 1) {
      out[i] = binary.charCodeAt(i);
    }
    return out;
  } catch {
    return null;
  }
}

async function importHmacKey(secret: string): Promise<CryptoKey> {
  return globalThis.crypto.subtle.importKey(
    "raw",
    encoder.encode(`${TOKEN_SCOPE}:${secret}`),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

/**
 * Compara una contraseña candidata contra el secreto esperado en tiempo constante
 * aplicando SHA-256 a ambas entradas para igualar longitudes antes del XOR.
 */
export async function verifyPasswordConstantTime(candidate: string, expected: string): Promise<boolean> {
  if (!expected || !candidate) return false;
  const [candHash, expHash] = await Promise.all([
    globalThis.crypto.subtle.digest("SHA-256", encoder.encode(candidate)),
    globalThis.crypto.subtle.digest("SHA-256", encoder.encode(expected)),
  ]);
  const a = new Uint8Array(candHash);
  const b = new Uint8Array(expHash);
  let diff = a.length ^ b.length;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

/**
 * Emite un token HMAC-SHA256 con timestamp en segundos para la cookie de staging.
 */
export async function signDevGateToken(secret: string, nowSec = Math.floor(Date.now() / 1000)): Promise<string> {
  const key = await importHmacKey(secret);
  const payload = `${TOKEN_SCOPE}:${nowSec}`;
  const sig = await globalThis.crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return `${nowSec}.${toBase64Url(new Uint8Array(sig))}`;
}

/**
 * Valida la firma HMAC-SHA256 y la ventana de expiración de la cookie de staging.
 */
export async function verifyDevGateToken(
  token: string | undefined,
  secret: string,
  nowSec = Math.floor(Date.now() / 1000),
): Promise<boolean> {
  if (!token || !secret) return false;
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [rawTs, rawSig] = parts;
  if (!/^\d+$/.test(rawTs)) return false;

  const issuedAt = Number(rawTs);
  if (!Number.isSafeInteger(issuedAt)) return false;
  if (issuedAt > nowSec + 60 || nowSec - issuedAt > DEV_GATE_MAX_AGE_SECONDS) {
    return false;
  }

  const sigBytes = fromBase64Url(rawSig);
  if (!sigBytes) return false;

  const key = await importHmacKey(secret);
  const payload = `${TOKEN_SCOPE}:${issuedAt}`;
  return globalThis.crypto.subtle.verify("HMAC", key, sigBytes, encoder.encode(payload));
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Renderiza la pantalla mínima de acceso protegido ("C · Etiqueta") sin scripts inline.
 */
export function renderDevGateResponse(opts: {
  nextPath: string;
  error?: string;
  status?: number;
  retryAfterSeconds?: number;
}): Response {
  const status = opts.status ?? 401;
  const safeNext = escapeHtml(opts.nextPath || "/");
  const errorBlock = opts.error
    ? `<p class="gate-error" role="alert">${escapeHtml(opts.error)}</p>`
    : "";

  const html = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex, nofollow" />
  <title>Acceso restringido · NutriFind Staging</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      padding: 24px;
      background: #f4f1ea;
      color: #111111;
      font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
    }
    .gate-card {
      width: 100%;
      max-width: 440px;
      background: #faf8f3;
      border: 1px solid #111111;
      padding: 28px;
    }
    .gate-kicker {
      display: inline-block;
      margin: 0 0 14px;
      padding: 4px 8px;
      background: #d19d38;
      color: #111111;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    h1 {
      margin: 0 0 8px;
      font-size: 26px;
      line-height: 1.15;
      font-weight: 900;
      letter-spacing: -0.02em;
    }
    .gate-lead {
      margin: 0 0 22px;
      color: #44423c;
      font-size: 14px;
      line-height: 1.5;
    }
    label {
      display: block;
      margin-bottom: 8px;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }
    input[type="password"] {
      width: 100%;
      padding: 12px 14px;
      border: 1px solid #111111;
      border-radius: 0;
      background: #ffffff;
      color: #111111;
      font-size: 15px;
    }
    input[type="password"]:focus-visible,
    button:focus-visible {
      outline: 2px solid #111111;
      outline-offset: 2px;
    }
    .gate-error {
      margin: 12px 0 0;
      padding: 10px 12px;
      border: 1px solid #991b1b;
      background: #fef2f2;
      color: #991b1b;
      font-size: 13px;
      line-height: 1.4;
    }
    button {
      margin-top: 16px;
      width: 100%;
      padding: 13px 16px;
      border: 1px solid #111111;
      border-radius: 0;
      background: #111111;
      color: #f4f1ea;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      cursor: pointer;
    }
    button:hover { background: #262522; }
    .gate-meta {
      margin: 18px 0 0;
      padding-top: 14px;
      border-top: 1px solid #d6d1c6;
      color: #57534a;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 11px;
    }
  </style>
</head>
<body>
  <main class="gate-card">
    <p class="gate-kicker">Entorno Staging · dev.200369.xyz</p>
    <h1>Acceso restringido</h1>
    <p class="gate-lead">Ingresa la clave de equipo para habilitar la vista previa de pruebas de NutriFind.</p>
    <form method="POST" action="${DEV_GATE_PATH}">
      <input type="hidden" name="next" value="${safeNext}" />
      <label for="dev-password">Clave de acceso</label>
      <input
        id="dev-password"
        name="password"
        type="password"
        autocomplete="current-password"
        required
        autofocus
      />
      ${errorBlock}
      <button type="submit">Desbloquear entorno</button>
    </form>
    <p class="gate-meta">Sesión válida por 15 minutos en este navegador.</p>
  </main>
</body>
</html>`;

  const headers: Record<string, string> = {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Robots-Tag": "noindex, nofollow",
  };
  if (opts.retryAfterSeconds && opts.retryAfterSeconds > 0) {
    headers["Retry-After"] = String(opts.retryAfterSeconds);
  }
  return new Response(html, { status, headers });
}
