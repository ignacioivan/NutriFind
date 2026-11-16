export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;
export const ALLOWED_PRIORITIES = ["sin_gluten"] as const;

export type DietaryPriority = (typeof ALLOWED_PRIORITIES)[number];

export type RegistrationInput = {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
  priority: DietaryPriority;
  termsAccepted: boolean;
  honeypot?: string;
};

export type LoginInput = {
  email: string;
  password: string;
  honeypot?: string;
};

export type FieldErrors = Record<string, string>;

const CONTROL_CHARS = /[\u0000-\u001F\u007F]/g;
const NAME_PATTERN = /^[\p{L}][\p{L}\s'.-]*$/u;
const EMAIL_PATTERN = /^[^\s@<>\\/"']+@[^\s@<>\\/"']+\.[^\s@<>\\/"']{2,}$/;

export function normalizeText(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.replace(CONTROL_CHARS, "").trim().replace(/\s+/g, " ");
}

export function validateFullName(raw: unknown): string | null {
  const name = normalizeText(raw);
  if (name.length < 2) return "Ingresa tu nombre y apellido (mínimo 2 caracteres).";
  if (name.length > 80) return "El nombre no puede superar los 80 caracteres.";
  if (!NAME_PATTERN.test(name)) return "Usa solo letras, espacios, guiones o apóstrofes en tu nombre.";
  return null;
}

export function normalizeEmail(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.replace(CONTROL_CHARS, "").trim().toLowerCase();
}

export function validateEmail(raw: unknown): string | null {
  const email = normalizeEmail(raw);
  if (!email) return "Ingresa tu correo electrónico.";
  if (email.length > 254 || !EMAIL_PATTERN.test(email)) return "Ingresa un correo electrónico válido.";
  return null;
}

export function passwordChecks(password: string) {
  return {
    minLength: password.length >= PASSWORD_MIN_LENGTH && password.length <= PASSWORD_MAX_LENGTH,
    hasUpper: /[A-Z]/.test(password),
    hasLower: /[a-z]/.test(password),
    hasDigit: /\d/.test(password),
    hasSpecial: /[^A-Za-z0-9\s]/.test(password),
    noWhitespace: !/\s/.test(password) && !CONTROL_CHARS.test(password),
  };
}

export function validatePassword(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length === 0) return "Ingresa una contraseña.";
  if (raw.length > PASSWORD_MAX_LENGTH) return "La contraseña no puede superar los 128 caracteres.";
  const checks = passwordChecks(raw);
  if (!checks.noWhitespace) return "La contraseña no puede contener espacios.";
  if (!checks.minLength || !checks.hasUpper || !checks.hasLower || !checks.hasDigit || !checks.hasSpecial) {
    return "Debe tener mínimo 8 caracteres, una mayúscula, una minúscula, un número y un carácter especial.";
  }
  return null;
}

export function sanitizeRedirectPath(raw: unknown, fallback = "/"): string {
  if (typeof raw !== "string") return fallback;
  const trimmed = raw.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//") || trimmed.startsWith("/\\")) {
    return fallback;
  }
  return trimmed;
}

export function validateRegistrationPayload(
  raw: unknown,
): { ok: true; data: RegistrationInput } | { ok: false; fieldErrors: FieldErrors; message: string; botDetected?: boolean } {
  if (!raw || typeof raw !== "object") {
    return { ok: false, fieldErrors: {}, message: "Solicitud inválida." };
  }
  const body = raw as Record<string, unknown>;
  const honeypot = typeof body.honeypot === "string" ? body.honeypot.trim() : "";
  if (honeypot.length > 0) {
    return { ok: false, fieldErrors: {}, message: "No pudimos procesar la solicitud.", botDetected: true };
  }

  const fieldErrors: FieldErrors = {};
  const fullNameErr = validateFullName(body.fullName);
  if (fullNameErr) fieldErrors.fullName = fullNameErr;

  const emailErr = validateEmail(body.email);
  if (emailErr) fieldErrors.email = emailErr;

  const passErr = validatePassword(body.password);
  if (passErr) fieldErrors.password = passErr;

  const password = typeof body.password === "string" ? body.password : "";
  const confirmPassword = typeof body.confirmPassword === "string" ? body.confirmPassword : "";
  if (!confirmPassword) {
    fieldErrors.confirmPassword = "Repite tu contraseña para confirmarla.";
  } else if (password !== confirmPassword) {
    fieldErrors.confirmPassword = "Las contraseñas no coinciden. Revísalas antes de continuar.";
  }

  if (body.termsAccepted !== true) {
    fieldErrors.termsAccepted = "Debes aceptar el uso de datos para crear tu cuenta.";
  }

  const rawPriority = typeof body.priority === "string" ? body.priority : "sin_gluten";
  const priority: DietaryPriority = (ALLOWED_PRIORITIES as readonly string[]).includes(rawPriority)
    ? (rawPriority as DietaryPriority)
    : "sin_gluten";

  if (Object.keys(fieldErrors).length > 0) {
    return {
      ok: false,
      fieldErrors,
      message: "Revisa los campos marcados antes de continuar.",
    };
  }

  return {
    ok: true,
    data: {
      fullName: normalizeText(body.fullName),
      email: normalizeEmail(body.email),
      password,
      confirmPassword,
      priority,
      termsAccepted: true,
    },
  };
}

export function validateLoginPayload(
  raw: unknown,
): { ok: true; data: LoginInput } | { ok: false; fieldErrors: FieldErrors; message: string; botDetected?: boolean } {
  if (!raw || typeof raw !== "object") {
    return { ok: false, fieldErrors: {}, message: "Solicitud inválida." };
  }
  const body = raw as Record<string, unknown>;
  const honeypot = typeof body.honeypot === "string" ? body.honeypot.trim() : "";
  if (honeypot.length > 0) {
    return { ok: false, fieldErrors: {}, message: "No pudimos procesar la solicitud.", botDetected: true };
  }

  const fieldErrors: FieldErrors = {};
  const emailErr = validateEmail(body.email);
  if (emailErr) fieldErrors.email = emailErr;

  const password = typeof body.password === "string" ? body.password : "";
  if (!password || password.length > PASSWORD_MAX_LENGTH) {
    fieldErrors.password = "Ingresa tu contraseña.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      ok: false,
      fieldErrors,
      message: "Ingresa tu correo y contraseña válidos.",
    };
  }

  return {
    ok: true,
    data: {
      email: normalizeEmail(body.email),
      password,
    },
  };
}
