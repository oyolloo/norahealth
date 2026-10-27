import { test } from "node:test";
import assert from "node:assert/strict";
import {
  AUTOMATIONS,
  MAX_SEGMENTS,
  firstName,
  hourLabel,
  inDaytime,
  inWindow,
  londonParts,
  renderText,
  segmentsOf,
  toE164Uk,
} from "./smsCore.js";

test("UK mobiles normalise to E.164, others are refused", () => {
  assert.equal(toE164Uk("07700 900123"), "+447700900123");
  assert.equal(toE164Uk("+44 7700-900123"), "+447700900123");
  assert.equal(toE164Uk("447700900123"), "+447700900123");
  assert.equal(toE164Uk("01983 123456"), null);
  assert.equal(toE164Uk("0770090012"), null);
  assert.equal(toE164Uk(null), null);
});

test("renders the placeholder spellings used in the client document", () => {
  const vars = { first_name: "Amy", time_frame: "3pm and 4pm" };
  assert.equal(renderText("Hello {first name}", vars), "Hello Amy");
  assert.equal(renderText("Hi {First Name}.", vars), "Hi Amy.");
  assert.equal(renderText("Hi {first_name}", vars), "Hi Amy");
  assert.equal(renderText("between {time frame}", vars), "between 3pm and 4pm");
  assert.equal(renderText("at {unknown}", vars), "at {unknown}");
});

test("first name and hour labels", () => {
  assert.equal(firstName("amy smith"), "Amy");
  assert.equal(firstName(""), "there");
  assert.equal(hourLabel("15:00"), "3pm");
  assert.equal(hourLabel("09:30"), "9:30am");
  assert.equal(hourLabel("12:00"), "12pm");
  assert.equal(hourLabel("00:00"), "12am");
});

test("segments: GSM 160/153, unicode 70/67", () => {
  assert.equal(segmentsOf("a".repeat(160)), 1);
  assert.equal(segmentsOf("a".repeat(161)), 2);
  assert.equal(segmentsOf("•" + "a".repeat(69)), 1);
  assert.equal(segmentsOf("•" + "a".repeat(70)), 2);
});

test("London wall clock follows BST and GMT", () => {
  assert.deepEqual(londonParts(new Date("2026-07-01T06:30:00Z")), { date: "2026-07-01", hour: 7 });
  assert.deepEqual(londonParts(new Date("2026-12-01T23:30:00Z")), { date: "2026-12-01", hour: 23 });
  assert.deepEqual(londonParts(new Date("2026-06-30T23:30:00Z")), { date: "2026-07-01", hour: 0 });
});

test("send windows", () => {
  assert.equal(inWindow(7, 7), true);
  assert.equal(inWindow(9, 7), true);
  assert.equal(inWindow(10, 7), false);
  assert.equal(inWindow(6, 7), false);
  assert.equal(inDaytime(6), false);
  assert.equal(inDaytime(7), true);
  assert.equal(inDaytime(21), true);
  assert.equal(inDaytime(22), false);
});

test("every default text fits Recallo24's segment limit", () => {
  for (const a of AUTOMATIONS) assert.ok(segmentsOf(a.text) <= MAX_SEGMENTS, a.id);
});

test("every automation from the document is listed once", () => {
  assert.deepEqual(
    AUTOMATIONS.map((a) => a.id),
    ["1a", "1b", "2", "3", "4a", "4b", "5"]
  );
});
