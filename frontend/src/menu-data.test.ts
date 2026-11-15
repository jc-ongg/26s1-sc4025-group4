import test from "node:test";
import assert from "node:assert/strict";
import { discountedCents, menuFor, money } from "./menu-data";
test("menu prices round to cents, including zero discount and partial-cent results", () => {
  assert.equal(discountedCents(1690, 30), 1183);
  assert.equal(discountedCents(1690, 15), 1437);
  assert.equal(discountedCents(1690, 0), 1690);
  assert.equal(money(discountedCents(1590, 40)), "SGD 9.54");
  assert.equal(menuFor("joya").find((item) => item.name === "Unagi Don")?.cents, 1690);
  assert.deepEqual(menuFor("unknown"), []);
});
