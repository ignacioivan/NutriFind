import { test } from "node:test";
import assert from "node:assert/strict";
import { parseFilters, wordPattern, postgrestFilter } from "./search.ts";

const p = (s: string) => parseFilters(new URLSearchParams(s));

test("wordPattern tolerates accents and plurals", () => {
  assert.equal(wordPattern("azúcar"), "_z_c_r");
  assert.equal(wordPattern("pastas"), "p_st_");
  assert.equal(wordPattern("pan"), "p_n");
  assert.equal(wordPattern("ñoquis"), "ñ_q__");
});

test("wordPattern drops characters PostgREST interprets", () => {
  for (const c of [",", "(", ")", '"', "*", "%", "\\", ".", ":"]) {
    assert.ok(!(wordPattern(`pa${c}n`) ?? "").includes(c), `kept ${c}`);
  }
  assert.equal(wordPattern("(),*"), null);
});

test("postgrestFilter requires every word in name or brand", () => {
  assert.equal(
    postgrestFilter("pan molde"),
    '(or(nombre.ilike."%p_n%",marca.ilike."%p_n%"),or(nombre.ilike."%m_ld_%",marca.ilike."%m_ld_%"))',
  );
  assert.equal(postgrestFilter("   "), null);
  // punctuation splits words; 1-letter words are dropped
  assert.equal(postgrestFilter("pan,(x)*"), '(or(nombre.ilike."%p_n%",marca.ilike."%p_n%"))');
});

test("parseFilters clamps garbage params", () => {
  assert.deepEqual(p("q=  pan  &page=-3"), { q: "pan", page: 1 });
  assert.equal(p("page=abc").page, 1);
  assert.equal(p("page=2.7").page, 1);
  assert.equal(p("precioMax=foo").maxPrice, undefined);
  assert.equal(p("q=" + "a".repeat(200)).q.length, 80);
  assert.deepEqual(p("q=pan&precioMin=5000&precioMax=10000&page=2"), {
    q: "pan",
    minPrice: 5000,
    maxPrice: 10000,
    page: 2,
  });
});
