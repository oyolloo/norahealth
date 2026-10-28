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
//  none:     declined order, nothing to book
//  add:      no appointment yet, "+ Future Appt"
//  upcoming: today or later, click to edit
//  past:     the day has gone, read only
export function futureApptState(order, today) {
  const day = dayOf(order?.futureApptAt);
  if (day) return day < today ? "past" : "upcoming";
  if (order?.status === "declined") return "none";
  return "add";
}
