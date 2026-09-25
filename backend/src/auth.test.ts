import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCredentials } from "./auth.js";

test("accepts email casing/whitespace without altering the password", () => {
  assert.deepEqual(
    parseCredentials({ email: " Jacob@Example.com ", password: " demo123 " }),
    { email: "jacob@example.com", password: " demo123 " },
  );
});
test("rejects missing, non-string and oversized credentials", () => {
  for (const value of [
    null,
    {},
    { email: 1, password: "x" },
    { email: "a", password: [] },
    { email: "  ", password: "x" },
    { email: "a", password: "" },
    { email: "a", password: "x".repeat(129) },
  ]) {
    assert.equal(parseCredentials(value), null);
  }
});
