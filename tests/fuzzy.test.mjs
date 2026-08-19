/* Unit tests for the typo-tolerant / Urdu search engine.
 * The TS module is compiled by `npm run test:build` before this runs.
 */
import { test, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

let fz;
let products;

before(async () => {
  fz = await import("../.test-build/fuzzy.mjs");
  products = JSON.parse(fs.readFileSync(new URL("../server/seed-products.json", import.meta.url), "utf8"));
});

test("exact match wins", () => {
  const r = fz.smartSearch(products, "earbuds");
  assert.equal(r.method, "exact");
  assert.ok(r.results.length >= 2);
});

test("transposition typos resolve (Damerau)", () => {
  for (const [q, expect] of [["chrager", "Charger"], ["smartwacth", "Smartwatch"], ["earbods", "Earbuds"]]) {
    const r = fz.smartSearch(products, q);
    assert.ok(r.results.length > 0, `${q} found nothing`);
    assert.ok(r.results.some((p) => p.name.includes(expect)), `${q} → ${expect}`);
  }
});

test("Urdu script synonyms", () => {
  for (const [q, expect] of [["چارجر", "Charger"], ["گھڑی", "Smartwatch"], ["بڈز", "Earbuds"]]) {
    const r = fz.smartSearch(products, q);
    assert.equal(r.method, "synonym", q);
    assert.ok(r.results.some((p) => p.name.includes(expect)), `${q} → ${expect}`);
  }
});

test("Roman-Urdu & market terms", () => {
  assert.ok(fz.smartSearch(products, "ghari").results.length >= 2, "ghari finds watches");
  assert.ok(fz.smartSearch(products, "handsfree").results.length >= 3, "handsfree finds audio");
  assert.ok(fz.smartSearch(products, "cover").results.length >= 3, "cover finds cases");
  assert.ok(fz.smartSearch(products, "charjar").results.length >= 1, "misspelled roman-urdu");
});

test("did-you-mean suggests catalog words", () => {
  assert.equal(fz.didYouMean(products, "earbods"), "earbuds");
});

test("gibberish returns none", () => {
  assert.equal(fz.smartSearch(products, "qqxxzz123").method, "none");
});
