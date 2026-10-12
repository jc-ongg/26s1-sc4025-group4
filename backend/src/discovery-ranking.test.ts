import test from "node:test";
import assert from "node:assert/strict";
import {
  diningIntent,
  menuMatch,
  normalizeDiningText,
  relevantResults,
} from "./discovery-ranking.js";

const dessert = {
  name: "Sweet cafe",
  cuisine: "Dessert",
  description: "Gelato and waffles",
  tags: [],
  signatureDishes: ["Gelato"],
};
const western = {
  name: "Burger cafe",
  cuisine: "Western",
  description: "Burgers and wings",
  tags: [],
  signatureDishes: ["Burgers"],
};
const chinese = {
  ...western,
  cuisine: "Chinese",
  description: "Grilled fish",
  signatureDishes: ["Grilled fish"],
};

test("compact spellings, menu synonyms and plurals have the same dining intent", () => {
  assert.equal(normalizeDiningText("ICECREAM!"), normalizeDiningText("ice-cream"));
  assert.ok(menuMatch(dessert, diningIntent("I want icecream"))?.exact);
  assert.equal(menuMatch(western, diningIntent("ice cream")), null);
  assert.ok(menuMatch(western, diningIntent("a burger"))?.exact);
  assert.ok(
    menuMatch(
      { ...western, description: "Korean charcoal barbecue", cuisine: "Korean" },
      diningIntent("kbbq"),
    )?.exact,
  );
});
test("typed cuisines constrain results, including unsupported cuisines and exclusions", () => {
  assert.ok(menuMatch(western, diningIntent("western food")));
  assert.equal(menuMatch(chinese, diningIntent("western food")), null);
  assert.equal(menuMatch(western, diningIntent("mexican food")), null);
  assert.equal(menuMatch(dessert, diningIntent("not dessert, western please")), null);
  assert.ok(menuMatch(western, diningIntent("not dessert, western please")));
});
test("weak and distant semantic neighbours are omitted without a fallback list", () => {
  assert.deepEqual(relevantResults([{ similarity: 0.18, exact: false }]), []);
  assert.deepEqual(
    relevantResults([
      { similarity: 0.54, exact: false },
      { similarity: 0.31, exact: false },
      { similarity: 0.19, exact: true },
    ]).map((r) => r.similarity),
    [0.19, 0.54],
  );
});
