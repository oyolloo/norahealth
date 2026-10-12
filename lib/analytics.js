const TYPES = ["SAME_OC", "DIFFERENT_OC", "MORNING_AFTER_PILL"];

// Period starts use UTC calendar days; weeks start on Monday.
export function periodStarts(now = new Date()) {
  const day = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
  const week = new Date(day);
  week.setUTCDate(day.getUTCDate() - ((day.getUTCDay() + 6) % 7));
  const month = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  return { today: day, week, month };
}

function emptyCounts() {
  return { total: 0, SAME_OC: 0, DIFFERENT_OC: 0, MORNING_AFTER_PILL: 0 };
}

// A request can ask for several types, so type counts may add up to more
// than the total number of requests.
export function countOrderRequests(requests, now = new Date()) {
  const starts = periodStarts(now);
  const out = {
    today: emptyCounts(),
    week: emptyCounts(),
    month: emptyCounts(),
  };
  for (const r of requests) {
    const at = new Date(r.createdAt).getTime();
    for (const [period, start] of Object.entries(starts)) {
      if (at < start.getTime() || at > now.getTime()) continue;
      out[period].total += 1;
      for (const t of TYPES) if (r.ocRequest?.includes(t)) out[period][t] += 1;
    }
  }
  return out;
}
