export const OC_TYPES = ["SAME_OC", "DIFFERENT_OC", "MORNING_AFTER_PILL"];
export const RANGES = ["today", "week", "month", "year", "all"];

const DAY = 24 * 60 * 60 * 1000;
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// UK wall-clock time written as a UTC instant, so plain UTC calendar maths
// gives UK days, weeks and months (BST included).
export function toUk(date) {
  const s = new Date(date).toLocaleString("sv-SE", { timeZone: "Europe/London" });
  return new Date(Date.parse(s.replace(" ", "T") + "Z"));
}

const utcDay = (d) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
const addMonths = (d, n) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1));

// Returns UK-shifted [start, end) for the current period, the same elapsed
// span in the previous period, and the chart buckets.
export function rangeWindow(range, ukNow, firstUk = ukNow) {
  let start, prevStart, unit;
  if (range === "today") {
    start = utcDay(ukNow);
    prevStart = new Date(start.getTime() - DAY);
    unit = "hour";
  } else if (range === "week") {
    start = utcDay(ukNow);
    start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
    prevStart = new Date(start.getTime() - 7 * DAY);
    unit = "day";
  } else if (range === "month") {
    start = addMonths(ukNow, 0);
    prevStart = addMonths(ukNow, -1);
    unit = "day";
  } else if (range === "year") {
    start = new Date(Date.UTC(ukNow.getUTCFullYear(), 0, 1));
    prevStart = new Date(Date.UTC(ukNow.getUTCFullYear() - 1, 0, 1));
    unit = "month";
  } else {
    start = addMonths(firstUk, 0);
    prevStart = null;
    unit = "month";
  }

  const end = ukNow;
  // Clamp so a shorter previous month never reaches into the current one.
  const prevEnd = prevStart
    ? new Date(Math.min(prevStart.getTime() + (end - start), start.getTime()))
    : null;

  let periodEnd;
  if (range === "today") periodEnd = new Date(start.getTime() + DAY);
  else if (range === "week") periodEnd = new Date(start.getTime() + 7 * DAY);
  else if (range === "month") periodEnd = addMonths(start, 1);
  else if (range === "year") periodEnd = new Date(Date.UTC(start.getUTCFullYear() + 1, 0, 1));
  else periodEnd = addMonths(ukNow, 1);

  const buckets = [];
  for (let t = start; t < periodEnd; ) {
    const next =
      unit === "hour" ? new Date(t.getTime() + 60 * 60 * 1000)
      : unit === "day" ? new Date(t.getTime() + DAY)
      : addMonths(t, 1);
    buckets.push({ start: t, end: next, label: bucketLabel(t, unit, range), tip: tipLabel(t, unit) });
    t = next;
  }
  return { start, end, prevStart, prevEnd, unit, buckets };
}

function tipLabel(t, unit) {
  const d = `${t.getUTCDate()} ${MONTHS[t.getUTCMonth()]}`;
  if (unit === "hour") {
    const h = String(t.getUTCHours()).padStart(2, "0");
    return `${d}, ${h}:00 to ${String((t.getUTCHours() + 1) % 24).padStart(2, "0")}:00`;
  }
  if (unit === "day") return `${d} ${t.getUTCFullYear()}`;
  return `${MONTHS[t.getUTCMonth()]} ${t.getUTCFullYear()}`;
}

function bucketLabel(t, unit, range) {
  if (unit === "hour") return String(t.getUTCHours()).padStart(2, "0");
  if (unit === "day")
    return range === "week"
      ? ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"][(t.getUTCDay() + 6) % 7]
      : String(t.getUTCDate());
  return range === "all"
    ? `${MONTHS[t.getUTCMonth()]} ${String(t.getUTCFullYear()).slice(2)}`
    : MONTHS[t.getUTCMonth()];
}

const inSpan = (at, a, b) => a && at >= a.getTime() && at < b.getTime();

// rows: [{ at: Date (UK-shifted), types?: string[] }]
export function summarise(rows, win) {
  const series = win.buckets.map((b) => ({
    label: b.label,
    tipLabel: b.tip,
    total: 0,
    SAME_OC: 0,
    DIFFERENT_OC: 0,
    MORNING_AFTER_PILL: 0,
    future: b.start.getTime() > win.end.getTime(),
  }));
  let total = 0;
  let previous = 0;
  const types = { SAME_OC: 0, DIFFERENT_OC: 0, MORNING_AFTER_PILL: 0 };

  for (const r of rows) {
    const at = r.at.getTime();
    if (inSpan(at, win.prevStart, win.prevEnd || win.prevStart)) previous += 1;
    if (!(at >= win.start.getTime() && at <= win.end.getTime())) continue;
    total += 1;
    const i = win.buckets.findIndex((b) => at >= b.start.getTime() && at < b.end.getTime());
    if (i < 0) continue;
    series[i].total += 1;
    for (const t of OC_TYPES)
      if (r.types?.includes(t)) {
        series[i][t] += 1;
        types[t] += 1;
      }
  }
  return { total, previous: win.prevStart ? previous : null, types, series };
}
