import { test } from "node:test";
import assert from "node:assert/strict";
import { offDayWarning, addDays, daysBetween, futureApptState, isDay, isTimeWindow, timeFrameText } from "./futureAppt.js";

test("adds days across month and year ends", () => {
  assert.equal(addDays("2026-10-28", 84), "2027-01-20");
  assert.equal(addDays("2026-10-28", 168), "2027-04-14");
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

test("off days", () => {
  assert.match(offDayWarning("2027-01-24", "10am-11am"), /Sunday/); // a Sunday
  assert.equal(offDayWarning("2027-01-23", "10am-11am"), null); // Saturday, open
  assert.match(offDayWarning("2027-01-23", "2pm-3pm"), /Saturday/);
  assert.equal(offDayWarning("2027-01-25", "2pm-3pm"), null); // Monday
});
