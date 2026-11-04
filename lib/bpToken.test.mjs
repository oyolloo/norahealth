import test from "node:test";
import assert from "node:assert/strict";
import { generateBpToken } from "./bpToken.js";
import { renderText, segmentsOf, smsLimit } from "./smsCore.js";

test("generateBpToken generates 8-character safe tokens", () => {
  const token = generateBpToken(8);
  assert.equal(token.length, 8);
  assert.match(token, /^[0-9a-zA-Z]{8}$/);
});

test("generateBpToken produces unique tokens", () => {
  const set = new Set();
  for (let i = 0; i < 500; i++) {
    const t = generateBpToken(8);
    assert.equal(set.has(t), false);
    set.add(t);
  }
});

test("Option A SMS template with token link fits in 1 segment (<= 160 characters)", () => {
  const template =
    "Hello {first_name}, your Nora Health review is next month. Please submit your blood pressure reading before your call: {link}";

  const token = generateBpToken(8);
  const link = `norahealth.co.uk/bp/${token}`;
  const rendered = renderText(template, {
    first_name: "Emma",
    link,
  });

  assert.equal(
    rendered,
    `Hello Emma, your Nora Health review is next month. Please submit your blood pressure reading before your call: norahealth.co.uk/bp/${token}`
  );

  // Link length is 30 characters ("norahealth.co.uk/bp/" + 8 chars)
  assert.equal(link.length, 28);
  // Total message length with Emma is 133 characters
  assert.equal(rendered.length <= 160, true);
  // SMS segment count is exactly 1 segment (= 1 credit)
  assert.equal(segmentsOf(rendered), 1);
});

test("Option A SMS fits in 1 segment even with longer first names", () => {
  const template =
    "Hello {first_name}, your Nora Health review is next month. Please submit your blood pressure reading before your call: {link}";

  const token = "k8J9mX2p";
  const link = `norahealth.co.uk/bp/${token}`;
  const rendered = renderText(template, {
    first_name: "Alexandrina", // 11 characters
    link,
  });

  assert.equal(rendered.length <= 160, true);
  assert.equal(segmentsOf(rendered), 1);
});

test("BP_SMS_TEMPLATE is defined with 4b_bp and hour 7", async () => {
  const { BP_SMS_TEMPLATE, automationById } = await import("./smsCore.js");
  assert.equal(BP_SMS_TEMPLATE.id, "4b_bp");
  assert.equal(BP_SMS_TEMPLATE.title, "BP request for Type B medicines");
  assert.equal(BP_SMS_TEMPLATE.hour, 7);
  assert.equal(BP_SMS_TEMPLATE.ready, true);
  assert.equal(automationById("4b_bp").id, "4b_bp");
});

