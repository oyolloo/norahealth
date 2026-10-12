import { test } from "node:test";
import assert from "node:assert/strict";
import { ocTypeLabel } from "./ocType.js";

test("maps each request to its short type", () => {
  assert.equal(ocTypeLabel(["SAME_OC"]), "Same");
  assert.equal(ocTypeLabel(["DIFFERENT_OC"]), "New");
  assert.equal(ocTypeLabel(["MORNING_AFTER_PILL"]), "MAP");
});

test("combines several requests in a fixed order", () => {
  assert.equal(ocTypeLabel(["MORNING_AFTER_PILL", "SAME_OC"]), "Same / MAP");
  assert.equal(
    ocTypeLabel(["DIFFERENT_OC", "MORNING_AFTER_PILL", "SAME_OC"]),
    "Same / New / MAP"
  );
});

test("returns null when nothing was requested", () => {
  assert.equal(ocTypeLabel([]), null);
  assert.equal(ocTypeLabel(undefined), null);
  assert.equal(ocTypeLabel(["UNKNOWN"]), null);
});
