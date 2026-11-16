import { normalizeText } from "./auth-validation.ts";

export const MAX_LISTS_PER_USER = 20;
export const MAX_ITEMS_PER_LIST = 100;
export const LIST_NAME_MAX_LENGTH = 60;
export const LIST_DESCRIPTION_MAX_LENGTH = 160;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FORBIDDEN_MARKUP = /[<>]/;

export function validateListName(raw: unknown): { ok: true; value: string } | { ok: false; message: string } {
  const name = normalizeText(raw);
  if (name.length < 1) {
    return { ok: false, message: "Escribe un nombre para tu lista." };
  }
  if (name.length > LIST_NAME_MAX_LENGTH) {
    return { ok: false, message: `El nombre no puede superar los ${LIST_NAME_MAX_LENGTH} caracteres.` };
  }
  if (FORBIDDEN_MARKUP.test(name)) {
    return { ok: false, message: "El nombre contiene caracteres no permitidos." };
  }
  return { ok: true, value: name };
}

export function validateListDescription(raw: unknown): { ok: true; value: string | null } | { ok: false; message: string } {
  if (raw === undefined || raw === null || raw === "") {
    return { ok: true, value: null };
  }
  const desc = normalizeText(raw);
  if (!desc) return { ok: true, value: null };
  if (desc.length > LIST_DESCRIPTION_MAX_LENGTH) {
    return { ok: false, message: `La descripción no puede superar los ${LIST_DESCRIPTION_MAX_LENGTH} caracteres.` };
  }
  if (FORBIDDEN_MARKUP.test(desc)) {
    return { ok: false, message: "La descripción contiene caracteres no permitidos." };
  }
  return { ok: true, value: desc };
}

export function validateListId(raw: unknown): { ok: true; value: string } | { ok: false; message: string } {
  if (typeof raw !== "string") {
    return { ok: false, message: "Identificador de lista inválido." };
  }
  const trimmed = raw.trim().toLowerCase();
  if (!UUID_PATTERN.test(trimmed)) {
    return { ok: false, message: "Identificador de lista inválido." };
  }
  return { ok: true, value: trimmed };
}

export function validateProductId(raw: unknown): { ok: true; value: number } | { ok: false; message: string } {
  const num = typeof raw === "number" ? raw : typeof raw === "string" && /^\d+$/.test(raw.trim()) ? Number(raw.trim()) : NaN;
  if (!Number.isSafeInteger(num) || num <= 0 || num > 1_000_000_000) {
    return { ok: false, message: "Identificador de producto inválido." };
  }
  return { ok: true, value: num };
}

export function validateQuantity(raw: unknown): { ok: true; value: number } | { ok: false; message: string } {
  const num = typeof raw === "number" ? raw : typeof raw === "string" && /^\d+$/.test(raw.trim()) ? Number(raw.trim()) : NaN;
  if (!Number.isSafeInteger(num) || num < 1 || num > 99) {
    return { ok: false, message: "La cantidad debe estar entre 1 y 99 unidades." };
  }
  return { ok: true, value: num };
}
