// Future Appt on orders (CC-10). Pure helpers shared by the orders table,
// the server action and the SMS runner. Dates are London calendar days kept
// as "YYYY-MM-DD" strings, stored as midnight UTC of that day.

export const PRESET_DAYS = [84, 168];

// Hour windows a doctor can pick, shown in SMS 4a as "{from} and {to}".
export const TIME_WINDOWS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18].map((h) => {
  const label = (x) => `${x % 12 || 12}${x < 12 ? "am" : "pm"}`;
  return { value: `${label(h)}-${label(h + 1)}`, from: label(h), to: label(h + 1) };
});

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
