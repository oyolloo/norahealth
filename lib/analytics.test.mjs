import { test } from "node:test";
import assert from "node:assert/strict";
import { toUk, rangeWindow, summarise } from "./analytics.js";

// Wednesday 14 Oct 2026, 15:00 UK time (BST)
const NOW = new Date(Date.UTC(2026, 9, 14, 15, 0));
const iso = (d) => d.toISOString();
const row = (s, types) => ({ at: new Date(s), types });

test("toUk shifts by the BST offset and not in winter", () => {
  assert.equal(iso(toUk("2026-07-01T23:30:00Z")), "2026-07-02T00:30:00.000Z");
  assert.equal(iso(toUk("2026-12-01T23:30:00Z")), "2026-12-01T23:30:00.000Z");
});

test("week runs Monday to Sunday with the same span last week", () => {
  const w = rangeWindow("week", NOW);
  assert.equal(iso(w.start), "2026-10-12T00:00:00.000Z");
  assert.equal(iso(w.prevStart), "2026-10-05T00:00:00.000Z");
  assert.equal(iso(w.prevEnd), "2026-10-07T15:00:00.000Z");
  assert.deepEqual(w.buckets.map((b) => b.label), ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"]);
});

test("month, year, today and all-time bucket sizes", () => {
  assert.equal(rangeWindow("month", NOW).buckets.length, 31);
  assert.equal(rangeWindow("year", NOW).buckets.length, 12);
  assert.equal(rangeWindow("today", NOW).buckets.length, 24);
  const all = rangeWindow("all", NOW, new Date(Date.UTC(2026, 5, 20)));
  assert.deepEqual(all.buckets.map((b) => b.label), ["Jun 26","Jul 26","Aug 26","Sep 26","Oct 26"]);
  assert.equal(all.prevStart, null);
});

test("summarise counts the period, the previous span and each type", () => {
  const w = rangeWindow("week", NOW);
  const s = summarise(
    [
      row("2026-10-12T09:00:00Z", ["SAME_OC"]),
      row("2026-10-14T10:00:00Z", ["DIFFERENT_OC", "MORNING_AFTER_PILL"]),
      row("2026-10-14T16:00:00Z", ["SAME_OC"]),
      row("2026-10-06T09:00:00Z", ["SAME_OC"]),
      row("2026-10-08T09:00:00Z", ["SAME_OC"]),
    ],
    w
  );
  assert.equal(s.total, 2);
  assert.equal(s.previous, 1);
  assert.deepEqual(s.types, { SAME_OC: 1, DIFFERENT_OC: 1, MORNING_AFTER_PILL: 1 });
  assert.equal(s.series[0].SAME_OC, 1);
  assert.equal(s.series[2].total, 1);
  assert.equal(s.series[3].future, true);
});

test("tooltip labels name the full bucket", () => {
  const w = rangeWindow("today", NOW);
  assert.equal(w.buckets[9].tip, "14 Oct, 09:00 to 10:00");
  assert.equal(rangeWindow("month", NOW).buckets[11].tip, "12 Oct 2026");
  assert.equal(rangeWindow("year", NOW).buckets[0].tip, "Jan 2026");
});

test("previous span never runs into the current period", () => {
  const mar31 = new Date(Date.UTC(2027, 2, 31, 12));
  const w = rangeWindow("month", mar31);
  assert.equal(iso(w.prevStart), "2027-02-01T00:00:00.000Z");
  assert.equal(iso(w.prevEnd), "2027-03-01T00:00:00.000Z");
  const s = summarise([row("2027-03-02T09:00:00Z", ["SAME_OC"])], w);
  assert.equal(s.total, 1);
  assert.equal(s.previous, 0);
});
