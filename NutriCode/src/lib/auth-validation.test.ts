import { test } from "node:test";
import assert from "node:assert/strict";
import {
  sanitizeRedirectPath,
  validateEmail,
  validateFullName,
  validateLoginPayload,
  validatePassword,
  validateRegistrationPayload,
} from "./auth-validation.ts";

test("validateFullName accepts accented names and rejects scripts/short names", () => {
  assert.equal(validateFullName("Sofía Rojas-Pérez"), null);
  assert.notEqual(validateFullName("A"), null);
  assert.notEqual(validateFullName("<script>alert(1)</script>"), null);
});

test("validateEmail normalizes and validates email format", () => {
  assert.equal(validateEmail("Sofia@Ejemplo.cl"), null);
  assert.notEqual(validateEmail("sin-arroba"), null);
  assert.notEqual(validateEmail("a@b"), null);
});

test("validatePassword enforces 8+ chars, upper, lower, digit and special char", () => {
  assert.equal(validatePassword("NutriFind#2026"), null);
  assert.notEqual(validatePassword("Ab1!"), null); // muy corta
  assert.notEqual(validatePassword("nutrifind#2026"), null); // sin mayúscula
  assert.notEqual(validatePassword("NUTRIFIND#2026"), null); // sin minúscula
  assert.notEqual(validatePassword("NutriFind#abcd"), null); // sin número
  assert.notEqual(validatePassword("NutriFind2026"), null); // sin carácter especial
  assert.notEqual(validatePassword("Nutri Find#2026"), null); // con espacio
});

test("validateRegistrationPayload checks confirmPassword, termsAccepted and honeypot", () => {
  const valid = validateRegistrationPayload({
    fullName: "Sofía Rojas",
    email: "SOFIA@ejemplo.cl",
    password: "ClaveSegura#1",
    confirmPassword: "ClaveSegura#1",
    priority: "sin_gluten",
    termsAccepted: true,
  });
  assert.equal(valid.ok, true);
  if (valid.ok) {
    assert.equal(valid.data.email, "sofia@ejemplo.cl");
    assert.equal(valid.data.priority, "sin_gluten");
  }

  const bot = validateRegistrationPayload({
    fullName: "Bot",
    email: "bot@ejemplo.cl",
    password: "ClaveSegura#1",
    confirmPassword: "ClaveSegura#1",
    termsAccepted: true,
    honeypot: "http://spam.example",
  });
  assert.equal(bot.ok, false);
  if (!bot.ok) assert.equal(bot.botDetected, true);
});

test("validateLoginPayload and sanitizeRedirectPath block open redirects", () => {
  assert.equal(sanitizeRedirectPath("/buscar?q=pan"), "/buscar?q=pan");
  assert.equal(sanitizeRedirectPath("https://evil.com"), "/");
  assert.equal(sanitizeRedirectPath("//evil.com"), "/");
  const badLogin = validateLoginPayload({ email: "x", password: "" });
  assert.equal(badLogin.ok, false);
});
