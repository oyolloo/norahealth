// Serves a downloadable .ics calendar file for the "Apple / Other" button in
// confirmation emails. Stateless: the event is passed in the query string, so
// no database lookup is needed.
//
//   /api/ics?start=YYYYMMDDTHHMMSSZ&end=...&title=...&details=...&location=...&uid=...
//
// Apple Calendar, Outlook and most other apps open the returned file directly.

export const dynamic = "force-dynamic";

function icsEscape(s) {
  return String(s || "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

// Keep only the "YYYYMMDDTHHMMSSZ" basic-UTC shape; ignore anything else.
function safeStamp(v, fallback) {
  return /^\d{8}T\d{6}Z$/.test(String(v || "")) ? v : fallback;
}

function nowStamp() {
  return new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const now = nowStamp();
  const start = safeStamp(searchParams.get("start"), now);
  const end = safeStamp(searchParams.get("end"), start);
  const title = searchParams.get("title") || "Nora Health appointment";
  const details = searchParams.get("details") || "";
  const location = searchParams.get("location") || "";
  const uid = searchParams.get("uid") || `nora-${start}@norahealth.co.uk`;

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Nora Health//Appointments//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${icsEscape(uid)}`,
    `DTSTAMP:${now}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${icsEscape(title)}`,
    `DESCRIPTION:${icsEscape(details)}`,
    `LOCATION:${icsEscape(location)}`,
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  return new Response(ics, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="appointment.ics"',
      "Cache-Control": "public, max-age=3600",
    },
  });
}
