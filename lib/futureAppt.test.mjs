import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PRESET_DAYS,
  offDayWarning,
  addDays,
  daysBetween,
  futureApptState,
  isDay,
  isTimeWindow,
  timeFrameText,
  parseTimeWindowHour,
  futureApptDateTime,
} from "./futureAppt.js";

test("preset timeframe choices include 56, 84, and 168 days", () => {
  assert.deepEqual(PRESET_DAYS, [56, 84, 168]);
});

test("adds days across month and year ends", () => {
  assert.equal(addDays("2026-10-28", 56), "2026-12-23");
  assert.equal(addDays("2026-10-28", 84), "2027-01-20");
  assert.equal(addDays("2026-10-28", 168), "2027-04-14");
  assert.equal(daysBetween("2026-10-28", "2026-12-23"), 56);
  assert.equal(daysBetween("2026-10-28", "2027-01-20"), 84);
});

test("cell state", () => {
  const today = "2026-10-28";
  assert.equal(futureApptState({ status: "posted" }, today), "add");
  assert.equal(futureApptState({ status: "declined" }, today), "add");
  assert.equal(futureApptState({ status: "posted", futureApptAt: "2026-10-28T00:00:00Z" }, today), "upcoming");
  assert.equal(futureApptState({ status: "posted", futureApptAt: "2026-10-27T00:00:00Z" }, today), "past");
});

test("time windows and day strings", () => {
  assert.ok(isTimeWindow("10am-11am"));
  assert.ok(!isTimeWindow("10am-12pm"));
  assert.equal(timeFrameText("12pm-1pm"), "12pm and 1pm");
  assert.ok(isDay("2027-01-20"));
  assert.ok(!isDay("20-01-2027"));
});

test("parseTimeWindowHour extracts starting hour in 24h format", () => {
  assert.equal(parseTimeWindowHour("8am-9am"), 8);
  assert.equal(parseTimeWindowHour("10am-11am"), 10);
  assert.equal(parseTimeWindowHour("12pm-1pm"), 12);
  assert.equal(parseTimeWindowHour("1pm-2pm"), 13);
  assert.equal(parseTimeWindowHour("5pm-6pm"), 17);
});

test("futureApptDateTime constructs UTC appointment Date", () => {
  const dt = futureApptDateTime("2026-12-23", "10am-11am");
  assert.equal(dt.toISOString(), "2026-12-23T10:00:00.000Z");

  const dtPm = futureApptDateTime("2026-12-23", "2pm-3pm");
  assert.equal(dtPm.toISOString(), "2026-12-23T14:00:00.000Z");

  assert.equal(futureApptDateTime("invalid", "10am-11am"), null);
});

test("off days", () => {
  assert.match(offDayWarning("2027-01-24", "10am-11am"), /Sunday/); // a Sunday
  assert.equal(offDayWarning("2027-01-23", "10am-11am"), null); // Saturday, open
  assert.match(offDayWarning("2027-01-23", "2pm-3pm"), /Saturday/);
  assert.equal(offDayWarning("2027-01-25", "2pm-3pm"), null); // Monday
});
