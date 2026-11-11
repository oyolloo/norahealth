// Future Appt on orders (CC-10). Pure helpers shared by the orders table,
// the server action and the SMS runner. Dates are London calendar days kept
// as "YYYY-MM-DD" strings, stored as midnight UTC of that day.

export const PRESET_DAYS = [56, 84, 168];

// Hour windows a doctor can pick, shown in SMS 4a as "{from} and {to}".
export const TIME_WINDOWS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18].map((h) => {
  const label = (x) => `${x % 12 || 12}${x < 12 ? "am" : "pm"}`;
  return { value: `${label(h)}-${label(h + 1)}`, from: label(h), to: label(h + 1) };
});

// Extract the starting hour from a time window like "10am-11am" -> 10, "2pm-3pm" -> 14.
export function parseTimeWindowHour(timeStr) {
  if (!timeStr) return 9;
  const m = String(timeStr).match(/^(\d{1,2})(am|pm)/i);
  if (!m) return 9;
  let h = parseInt(m[1], 10);
  const ampm = m[2].toLowerCase();
  if (ampm === "pm" && h < 12) h += 12;
  if (ampm === "am" && h === 12) h = 0;
  return h;
}

// Combines London calendar day "YYYY-MM-DD" and window "10am-11am" into a UTC appointment Date.
export function futureApptDateTime(day, time) {
  if (!isDay(day)) return null;
  const [y, m, d] = day.split("-").map(Number);
  const hour = parseTimeWindowHour(time);
  return new Date(Date.UTC(y, m - 1, d, hour, 0, 0, 0));
}

export function isTimeWindow(v) {
  return TIME_WINDOWS.some((w) => w.value === v);
}

// "10am-11am" -> "10am and 11am" for the 4a text.
export function timeFrameText(v) {
  const w = TIME_WINDOWS.find((x) => x.value === v);
  return w ? `${w.from} and ${w.to}` : null;
}

export function isDay(s) {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));
}

export function addDays(day, n) {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(fromDay, toDay) {
  return Math.round((Date.parse(`${toDay}T00:00:00Z`) - Date.parse(`${fromDay}T00:00:00Z`)) / 86400000);
}

export function dayOf(date) {
  if (!date) return null;
  return new Date(date).toISOString().slice(0, 10);
}

// What the Future Appt cell shows for one order.
//  add:      no appointment yet, "+ Future Appt"
//  upcoming: today or later, click to edit
//  past:     the day has gone, read only
export function futureApptState(order, today) {
  const day = dayOf(order?.futureApptAt);
  // Every order can get one, declined included (client: "all order e").
  if (day) return day < today ? "past" : "upcoming";
  return "add";
}

// Weekly opening, read from the clinic's own booking slots (Oct 2026): no
// Sunday slots ever; Saturday only 9am to 11am; Monday to Friday all day.
export const OFF_WEEKDAYS = [0]; // Sunday
export const SATURDAY_TIMES = ["9am-10am", "10am-11am"];

export function weekdayOf(day) {
  return new Date(`${day}T00:00:00Z`).getUTCDay();
}

// A warning for a day the clinic is normally closed (or a Saturday time
// outside its short hours), or null when the day and time are fine.
export function offDayWarning(day, time) {
  if (!day) return null;
  const wd = weekdayOf(day);
  if (OFF_WEEKDAYS.includes(wd)) return "This date is a Sunday, when the clinic is normally closed.";
  if (wd === 6 && time && !SATURDAY_TIMES.includes(time))
    return "On Saturdays the clinic is normally open only 9am to 11am.";
  return null;
}

// CC-27: hour load for the review time picker and the Booking Slots page.
// Slot bookings and reviews both count toward the slot's capacity (6).

// CC-28: the Future Appt time value for a slot hour, e.g. 9 -> "9am-10am".
export function windowForHour(hour) {
  return TIME_WINDOWS.find((w) => parseTimeWindowHour(w.value) === hour)?.value || null;
}

// "10:00" -> 10
export function slotHour(startTime) {
  const h = parseInt(String(startTime || "").split(":")[0], 10);
  return Number.isNaN(h) ? null : h;
}

// Reviews per hour from [{ time: "10am-11am" }, ...] -> { 10: 2, ... }
export function reviewsByHour(appts) {
  const out = {};
  for (const a of appts || []) {
    if (!a?.time) continue;
    const h = parseTimeWindowHour(a.time);
    out[h] = (out[h] || 0) + 1;
  }
  return out;
}

// load: [{ value, hour, capacity|null, booked }]. A window is free when it has
// a slot that is not full. On today only later hours count. Returns the value
// of the first free window, or "" when the day has none.
export function firstFreeWindow(load, { isToday = false, nowHour = 0 } = {}) {
  const w = (load || []).find(
    (x) => x.capacity != null && x.booked < x.capacity && (!isToday || x.hour > nowHour),
  );
  return w ? w.value : "";
}
