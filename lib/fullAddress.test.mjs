import { test } from "node:test";
import assert from "node:assert/strict";
import { isFullAddress } from "./addressLookup.js";

test("rejects a bare house number, postcode or empty value", () => {
  assert.equal(isFullAddress("36"), false);
  assert.equal(isFullAddress("PO33 1EN"), false);
  assert.equal(isFullAddress("sw164nt"), false);
  assert.equal(isFullAddress("  "), false);
  assert.equal(isFullAddress(null), false);
  assert.equal(isFullAddress("36 A"), false);
});

test("accepts numbered and named addresses", () => {
  assert.equal(isFullAddress("36 High Street, Ryde"), true);
  assert.equal(isFullAddress("Flat 2, 10 Mill Rd"), true);
  assert.equal(isFullAddress("Rose Cottage, Mill Lane"), true);
  assert.equal(isFullAddress("1 Ox Rd"), true);
});
