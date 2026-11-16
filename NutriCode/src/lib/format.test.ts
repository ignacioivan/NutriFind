import { test } from "node:test";
import assert from "node:assert/strict";
import { formatCLP, extractSize, imageUrl, formatDate, analyzeProductSpecs } from "./format.ts";

test("formatCLP uses dot thousands separator and no decimals", () => {
  assert.equal(formatCLP(4990), "$4.990");
  assert.equal(formatCLP(73990), "$73.990");
  assert.equal(formatCLP(0), "$0");
});

test("extractSize normalizes the unit", () => {
  assert.equal(extractSize("Quinoa Pop Sin Gluten 240g Bio V"), "240 g");
  assert.equal(extractSize("Psyllium Husk 200gr"), "200 g");
  assert.equal(extractSize("Harina 1 Kg"), "1 kg");
  assert.equal(extractSize("Bebida 1,5 L"), "1,5 l");
  assert.equal(extractSize("Chocolate Collection Con Leche"), undefined);
});

test("imageUrl resizes only walmartimages URLs", () => {
  const u = "https://i5.walmartimages.cl/asr/x.jpeg?odnHeight=2000&odnWidth=2000&odnBg=ffffff";
  const r = new URL(imageUrl(u, 300));
  assert.equal(r.searchParams.get("odnHeight"), "300");
  assert.equal(r.searchParams.get("odnWidth"), "300");
  assert.equal(r.searchParams.get("odnBg"), "ffffff");
  assert.equal(imageUrl("https://otro.cl/a.png", 300), "https://otro.cl/a.png");
  assert.equal(imageUrl("no-es-url", 300), "no-es-url");
});

test("formatDate in Chilean Spanish without dots", () => {
  assert.equal(formatDate("2026-10-31T12:00:00Z"), "31 oct 2026");
});

test("analyzeProductSpecs computes pack price, 100g reference and dietary tags", () => {
  const pack = analyzeProductSpecs("Pack 5, Quinoa Blanca 500gr", 32400);
  assert.equal(pack.packUnits, 5);
  assert.equal(pack.unitReferenceLabel, "Valor por unidad");
  assert.equal(pack.unitReferenceValue, "$6.480 c/u");
  assert.deepEqual(pack.attributes, ["Sin gluten"]);

  const single = analyzeProductSpecs("Quinoa Pop Sin Endulzar Sin Gluten 240g Bio V", 7990);
  assert.equal(single.packUnits, undefined);
  assert.equal(single.unitReferenceLabel, "Ref. por 100 g");
  assert.equal(single.unitReferenceValue, "$3.329");
  assert.deepEqual(single.attributes, ["Sin gluten", "Sin endulzar"]);
});
