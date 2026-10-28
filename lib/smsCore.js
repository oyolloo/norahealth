// Pure helpers for the SMS automations (CC-9). No database, no network, so
// they run under `node --test`.

export const TZ = "Europe/London";

// Recallo24 rejects a body longer than this many SMS parts (400 invalid_body).
export const MAX_SEGMENTS = 6;

// The automations from the client's "SMS Automations v2" document. `ready`
// false = shown in the admin but cannot be switched on yet (waiting for the
// client's details).
export const AUTOMATIONS = [
  {
    id: "1a",
    title: "New sign-up, no booking after 24 hours",
    when: "24 hours after sign-up, between 7am and 10pm UK time",
    conditions: "New sign-up, 24 hours passed, no appointment or order yet",
    ready: true,
    text:
      "Hi {first_name}, it's Dev from Nora Health. Thanks for signing up! You can order online, or simply text/WhatsApp 07440 126154 to order your NHS OC. Quick and easy.",
  },
  {
    id: "1b",
    title: "New sign-up, no booking after 7 days",
    when: "7 days after sign-up, between 7am and 10pm UK time",
    conditions: "New sign-up, 7 days passed, no appointment or order yet",
    ready: true,
    text:
      "Hi {first_name}, it's Dev from Nora Health. You haven't booked yet, so here's how: book at norahealth.co.uk/booking or text/WhatsApp 07440 126154 and we'll sort it. This is our last message. Best wishes, Dev",
  },
  {
    id: "2",
    title: "Appointment reminder",
    when: "Morning of the appointment",
    conditions: "New booking or order with an appointment slot today",
    ready: true,
    hour: 7,
    text:
      "Hi {first_name}, reminder: your NHS OC appointment with Dev from Nora Health is today between {time_frame}. To rearrange, reply on 07440 126154 (SMS/WhatsApp).",
  },
  {
    id: "3",
    title: "Failed encounter",
    when: "Same day, evening",
    conditions: "Booking or order set to Failed Encounter today",
    ready: true,
    hour: 19,
    text:
      "Hi {first_name}, sorry we missed you at your appointment today ({appt_time}). Rebook at norahealth.co.uk/booking or reply on 07440 126154.",
  },
  {
    id: "4a",
    title: "Future appointment day",
    when: "7am on the Future Appt Date",
    conditions: "Order has a Future Appt set for today",
    ready: true,
    hour: 7,
    text:
      "Hello {first_name} Reminder: Your OC review appt with Dev from Nora Health is today between {time_frame}. Reply on 07440 126154 (SMS / WhatsApp) to re-arrange. Thank you.",
  },
  {
    id: "4b",
    title: "OC review next month",
    when: "7am, 28 days before the Future Appt Date",
    conditions: "Order has a Future Appt 28 days from today",
    ready: true,
    hour: 7,
    text:
      "Hello {first_name}. Just a reminder that your Nora Health OC review is coming up next month. Please make sure you have an up-to-date blood pressure and weight reading ready beforehand. Please send your results to 07440 126154 (SMS / WhatsApp). Thank you",
  },
  {
    id: "5",
    title: "Missed call",
    when: "On demand (send button below)",
    conditions: "Sent by staff after a missed call",
    ready: true,
    manual: true,
    text:
      "Hi {first_name}, we tried to call you from Nora Health about your NHS OC appointment. We'll try again soon, or reply on 07440 126154 to rearrange.",
  },
];

export function automationById(id) {
  return AUTOMATIONS.find((a) => a.id === id) || null;
}

// UK mobile to E.164 (+447xxxxxxxxx), else null.
export function toE164Uk(value) {
  if (typeof value !== "string") return null;
  const s = value.trim().replace(/[\s().-]/g, "");
  const m = /^(?:\+44|0044|44|0)(7\d{9})$/.exec(s);
  return m ? `+44${m[1]}` : null;
}

export function firstName(fullName) {
  const s = String(fullName || "").trim().split(/\s+/)[0] || "";
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : "there";
}

// "15:00" -> "3pm", "09:30" -> "9:30am".
export function hourLabel(hhmm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || "").trim());
  if (!m) return String(hhmm || "");
  let h = Number(m[1]);
  const suffix = h >= 12 ? "pm" : "am";
  h = h % 12 || 12;
  return m[2] === "00" ? `${h}${suffix}` : `${h}:${m[2]}${suffix}`;
}

// Accepts the spellings used in the client document: {first name},
// {First Name}, {first_name}, {time frame}, {appt_time}.
export function renderText(template, vars) {
  return String(template || "").replace(/\{\s*([a-zA-Z]+)[\s_]*([a-zA-Z]*)\s*\}/g, (all, a, b) => {
    const key = `${a}${b ? "_" + b : ""}`.toLowerCase();
    return Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key]) : all;
  });
}

const GSM =
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";
const GSM_EXT = "^{}\\[~]|€";

// SMS segments, as networks bill them.
export function segmentsOf(body) {
  const text = String(body || "");
  let gsm = true;
  let units = 0;
  for (const ch of text) {
    if (GSM.includes(ch)) units += 1;
    else if (GSM_EXT.includes(ch)) units += 2;
    else {
      gsm = false;
      break;
    }
  }
  if (!gsm) {
    const len = [...text].reduce((n, ch) => n + (ch.codePointAt(0) > 0xffff ? 2 : 1), 0);
    return len <= 70 ? 1 : Math.ceil(len / 67);
  }
  return units <= 160 ? 1 : Math.ceil(units / 153);
}

// Date and hour on the UK wall clock.
export function londonParts(date = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value])
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour) };
}

// Is `hour` inside the send window that starts at `start` (3 hours wide, so
// a late or missed cron run still sends the same morning/evening).
export function inWindow(hour, start, width = 3) {
  return hour >= start && hour < start + width;
}

// Sign-up nudges go out only between 7am and 10pm UK time.
export function inDaytime(hour) {
  return hour >= 7 && hour < 22;
}
