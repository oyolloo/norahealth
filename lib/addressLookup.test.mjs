import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalisePostcode,
  looksLikePartialPostcode,
  parsePostcodeSuggestions,
  parsePostcodeDetails,
  parseGoogleSuggestions,
  parseGoogleDetails,
} from "./addressLookup.js";

test("normalises valid UK postcodes and rejects others", () => {
  assert.equal(normalisePostcode("cr41dl"), "CR4 1DL");
  assert.equal(normalisePostcode(" SW1A  1AA "), "SW1A 1AA");
  assert.equal(normalisePostcode("M1 1AE"), "M1 1AE");
  assert.equal(normalisePostcode("12345"), null);
  assert.equal(normalisePostcode(""), null);
});

test("spots postcodes while they are being typed", () => {
  assert.equal(looksLikePartialPostcode("CR4"), true);
  assert.equal(looksLikePartialPostcode("cr4 1d"), true);
  assert.equal(looksLikePartialPostcode("C"), false);
  assert.equal(looksLikePartialPostcode("12 High Street"), false);
});

test("parses postcodes.io responses", () => {
  assert.deepEqual(parsePostcodeSuggestions({ status: 200, result: ["CR4 1DA", "CR4 1DL"] }), [
    { id: "CR4 1DA", label: "CR4 1DA" },
    { id: "CR4 1DL", label: "CR4 1DL" },
  ]);
  assert.deepEqual(parsePostcodeSuggestions({ status: 200, result: null }), []);
  assert.deepEqual(
    parsePostcodeDetails({ result: { postcode: "CR4 1DL", admin_district: "Merton", region: "London" } }),
    { postcode: "CR4 1DL", area: "Merton, London" }
  );
  assert.equal(parsePostcodeDetails({ status: 404, error: "Invalid postcode" }), null);
});

test("parses Google autocomplete suggestions", () => {
  const out = parseGoogleSuggestions({
    suggestions: [
      { placePrediction: { placeId: "abc", text: { text: "341 Tamworth Lane, Mitcham, UK" } } },
      { queryPrediction: { text: { text: "tamworth" } } },
    ],
  });
  assert.deepEqual(out, [{ id: "abc", label: "341 Tamworth Lane, Mitcham" }]);
  assert.deepEqual(parseGoogleSuggestions({}), []);
});

test("builds an address line and postcode from Google address components", () => {
  const d = parseGoogleDetails({
    formattedAddress: "341 Tamworth Ln, Mitcham CR4 1DL, UK",
    addressComponents: [
      { longText: "341", types: ["street_number"] },
      { longText: "Tamworth Lane", types: ["route"] },
      { longText: "Mitcham", types: ["postal_town"] },
      { longText: "CR4 1DL", types: ["postal_code"] },
      { longText: "United Kingdom", types: ["country", "political"] },
    ],
  });
  assert.deepEqual(d, { line1: "341 Tamworth Lane, Mitcham", postcode: "CR4 1DL" });
  const flat = parseGoogleDetails({
    formattedAddress: "Flat 2, 10 Downing St, London SW1A 2AA, UK",
    addressComponents: [
      { longText: "Flat 2", types: ["subpremise"] },
      { longText: "10", types: ["street_number"] },
      { longText: "Downing Street", types: ["route"] },
      { longText: "London", types: ["postal_town"] },
      { longText: "SW1A 2AA", types: ["postal_code"] },
    ],
  });
  assert.equal(flat.line1, "Flat 2, 10 Downing Street, London");
  assert.deepEqual(parseGoogleDetails({ formattedAddress: "Somewhere, UK" }), { line1: "Somewhere", postcode: "" });
});
