import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  validateListDescription,
  validateListId,
  validateListName,
  validateProductId,
  validateQuantity,
} from "./lists-validation.ts";

describe("lists-validation", () => {
  it("normalizes and accepts valid list names", () => {
    const res = validateListName("  Despensa   del mes  ");
    assert.deepEqual(res, { ok: true, value: "Despensa del mes" });
  });

  it("rejects empty, oversized or HTML-injected list names", () => {
    assert.equal(validateListName("   ").ok, false);
    assert.equal(validateListName("a".repeat(61)).ok, false);
    assert.equal(validateListName("<script>alert(1)</script>").ok, false);
  });

  it("validates optional list descriptions", () => {
    assert.deepEqual(validateListDescription(""), { ok: true, value: null });
    assert.deepEqual(validateListDescription("Para desayunos de la semana"), {
      ok: true,
      value: "Para desayunos de la semana",
    });
    assert.equal(validateListDescription("<b>mal</b>").ok, false);
    assert.equal(validateListDescription("x".repeat(161)).ok, false);
  });

  it("validates UUID list IDs", () => {
    assert.deepEqual(validateListId("550e8400-e29b-41d4-a716-446655440000"), {
      ok: true,
      value: "550e8400-e29b-41d4-a716-446655440000",
    });
    assert.equal(validateListId("not-a-uuid").ok, false);
    assert.equal(validateListId("123; DROP TABLE listas_compras;").ok, false);
  });

  it("validates positive integer product IDs and quantities", () => {
    assert.deepEqual(validateProductId(42), { ok: true, value: 42 });
    assert.deepEqual(validateProductId("42"), { ok: true, value: 42 });
    assert.equal(validateProductId(0).ok, false);
    assert.equal(validateProductId(-5).ok, false);
    assert.equal(validateProductId("abc").ok, false);

    assert.deepEqual(validateQuantity(3), { ok: true, value: 3 });
    assert.equal(validateQuantity(0).ok, false);
    assert.equal(validateQuantity(100).ok, false);
  });
});
