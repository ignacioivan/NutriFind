import assert from "node:assert/strict";
import test from "node:test";
import {
  DEV_GATE_MAX_AGE_SECONDS,
  renderDevGateResponse,
  signDevGateToken,
  verifyDevGateToken,
  verifyPasswordConstantTime,
} from "./dev-gate.ts";

test("verifyPasswordConstantTime acepta coincidencia exacta y rechaza diferencias", async () => {
  assert.equal(await verifyPasswordConstantTime("ClaveSegura#2026", "ClaveSegura#2026"), true);
  assert.equal(await verifyPasswordConstantTime("ClaveSegura#2025", "ClaveSegura#2026"), false);
  assert.equal(await verifyPasswordConstantTime("corta", "ClaveSegura#2026"), false);
  assert.equal(await verifyPasswordConstantTime("", "ClaveSegura#2026"), false);
  assert.equal(await verifyPasswordConstantTime("algo", ""), false);
});

test("signDevGateToken y verifyDevGateToken validan firma, secreto y expiración", async () => {
  const secret = "staging-secret-123";
  const now = 1_800_000_000;
  const token = await signDevGateToken(secret, now);

  assert.equal(await verifyDevGateToken(token, secret, now + 60), true);
  assert.equal(await verifyDevGateToken(token, "otro-secreto", now + 60), false);

  // Tampering de timestamp o firma
  const [ts, sig] = token.split(".");
  assert.equal(await verifyDevGateToken(`${Number(ts) + 1}.${sig}`, secret, now + 60), false);
  assert.equal(await verifyDevGateToken(`${ts}.tamperedSig`, secret, now + 60), false);

  // Token expirado (> 15 min)
  assert.equal(DEV_GATE_MAX_AGE_SECONDS, 15 * 60);
  assert.equal(
    await verifyDevGateToken(token, secret, now + DEV_GATE_MAX_AGE_SECONDS + 1),
    false,
  );
});

test("renderDevGateResponse devuelve 401 no-store y escapa XSS en nextPath/error", async () => {
  const res = renderDevGateResponse({
    nextPath: '/buscar?q="><script>alert(1)</script>',
    error: 'Clave <img src=x onerror=1> incorrecta',
    status: 401,
  });

  assert.equal(res.status, 401);
  assert.equal(res.headers.get("Cache-Control"), "no-store");
  assert.equal(res.headers.get("X-Robots-Tag"), "noindex, nofollow");

  const body = await res.text();
  assert.equal(body.includes("<script>alert(1)</script>"), false);
  assert.equal(body.includes("<img src=x"), false);
  assert.equal(body.includes("&lt;script&gt;"), true);
});
