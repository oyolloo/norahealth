import { test } from "node:test";
import assert from "node:assert/strict";
import { periodStarts, countOrderRequests } from "./analytics.js";

// Wednesday 14 Oct 2026, 15:00 UTC
const NOW = new Date(Date.UTC(2026, 9, 14, 15, 0));

test("week starts on Monday, month on the 1st", () => {
  const s = periodStarts(NOW);
  assert.equal(s.today.toISOString(), "2026-10-14T00:00:00.000Z");
  assert.equal(s.week.toISOString(), "2026-10-12T00:00:00.000Z");
  assert.equal(s.month.toISOString(), "2026-10-01T00:00:00.000Z");
});

test("a Sunday belongs to the week that began the Monday before", () => {
  const sun = new Date(Date.UTC(2026, 9, 18, 9));
  assert.equal(periodStarts(sun).week.toISOString(), "2026-10-12T00:00:00.000Z");
});

test("counts requests per period and per type", () => {
  const reqs = [
    { createdAt: "2026-10-14T08:00:00Z", ocRequest: ["SAME_OC"] },
    { createdAt: "2026-10-13T08:00:00Z", ocRequest: ["DIFFERENT_OC", "MORNING_AFTER_PILL"] },
    { createdAt: "2026-10-05T08:00:00Z", ocRequest: ["MORNING_AFTER_PILL"] },
    { createdAt: "2026-09-30T23:59:00Z", ocRequest: ["SAME_OC"] },
  ];
  const c = countOrderRequests(reqs, NOW);
  assert.deepEqual(c.today, { total: 1, SAME_OC: 1, DIFFERENT_OC: 0, MORNING_AFTER_PILL: 0 });
  assert.deepEqual(c.week, { total: 2, SAME_OC: 1, DIFFERENT_OC: 1, MORNING_AFTER_PILL: 1 });
  assert.deepEqual(c.month, { total: 3, SAME_OC: 1, DIFFERENT_OC: 1, MORNING_AFTER_PILL: 2 });
});

test("ignores requests with no type list and future timestamps", () => {
  const c = countOrderRequests(
    [
      { createdAt: "2026-10-14T10:00:00Z" },
      { createdAt: "2026-10-14T18:00:00Z", ocRequest: ["SAME_OC"] },
    ],
    NOW
  );
  assert.deepEqual(c.today, { total: 1, SAME_OC: 0, DIFFERENT_OC: 0, MORNING_AFTER_PILL: 0 });
});
