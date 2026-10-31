import { Resend } from "resend";
import {
  bookingConfirmationEmailHtml,
  calendarButtonsHtml,
  firstNameOf,
  orderReceivedEmailHtml,
  longCallDate,
  orderStatusEmailHtml,
  welcomeEmailHtml,
} from "./emailHtml";


const resend = new Resend(process.env.RESEND_API_KEY);



function formatDate(date) {
  return new Date(date).toLocaleString("en-GB", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "UTC", // stored UTC wall-clock == UK time the user picked
  });
}



/**
 * Welcome email — sent once the patient completes their Account Registration
 * (that form is where we first have their name, so the greeting is
 * personalised as "Hello <first name>,"). Copy supplied by the client.
 */
export async function sendWelcomeEmail({ to, name }) {
  const html = welcomeEmailHtml({ name });

  await resend.emails.send({
    from: "Nora Health <contact@norahealth.co.uk>",
    to,
    replyTo: "contact@norahealth.co.uk",
    subject: "Welcome to Nora Health",
    html,
  });
}

function formatDateTime(date) {
  return new Date(date).toLocaleString("en-GB", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "UTC", // stored UTC wall-clock == UK time the user picked
  });
}

// Full date + a start–end time frame, e.g.
// "Tuesday, 11 August 2026 at 16:00 – 17:00".
// Appointments are 1-hour slots; if no end is given, assume start + 60 min.
function formatAppointmentRange(start, end) {
  const s = new Date(start);
  const e = end ? new Date(end) : new Date(s.getTime() + 60 * 60 * 1000);
  const day = s.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  const t = (d) =>
    d.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "UTC",
    });
  // "Monday 26th October 2026 at 10:00 – 11:00" (client review 7.2a, same style as the order email)
  const long = longCallDate(s);
  return `${long ? `${long} ${s.getUTCFullYear()}` : day} at ${t(s)} – ${t(e)}`;
}

// ---------------------------------------------------------------------------
// Add-to-calendar helpers (Booking + Order confirmation emails)
//
// Appointment datetimes are stored as UK wall-clock inside a UTC field (e.g.
// 2026-08-07T10:00:00.000Z means 10:00 UK local). Calendar apps work in real
// UTC instants, so we convert wall-clock -> true UTC by subtracting the
// Europe/London offset for that date (0 in winter, +60 min in BST), then emit
// every link/ICS in UTC "Z" time. That keeps 10:00 UK showing as 10:00 for a
// UK viewer in both summer and winter.
// ---------------------------------------------------------------------------
function londonOffsetMinutes(date) {
  const tzn =
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/London",
      timeZoneName: "shortOffset",
    })
      .formatToParts(date)
      .find((p) => p.type === "timeZoneName")?.value || "GMT";
  const m = tzn.match(/GMT([+-]\d{1,2})(?::?(\d{2}))?/);
  if (!m) return 0; // "GMT" -> winter (0)
  const h = parseInt(m[1], 10);
  const min = m[2] ? parseInt(m[2], 10) : 0;
  return h * 60 + (h < 0 ? -min : min);
}

// Wall-clock-in-UTC value -> the real UTC instant of the appointment.
function toUtcInstant(stored) {
  const d = new Date(stored);
  return new Date(d.getTime() - londonOffsetMinutes(d) * 60 * 1000);
}

// Date -> "YYYYMMDDTHHMMSSZ" (UTC basic format for ICS / Google).
function icsStamp(date) {
  return new Date(date)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

function icsEscape(s) {
  return String(s || "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

// Google + Outlook "add event" links. start/end are real UTC Date objects.
function buildCalendarLinks({ title, start, end, details, location }) {
  const google =
    "https://calendar.google.com/calendar/render?" +
    new URLSearchParams({
      action: "TEMPLATE",
      text: title,
      dates: `${icsStamp(start)}/${icsStamp(end)}`,
      details: details || "",
      location: location || "",
    }).toString();

  const outlook =
    "https://outlook.office.com/calendar/0/deeplink/compose?" +
    new URLSearchParams({
      path: "/calendar/action/compose",
      rru: "addevent",
      startdt: new Date(start).toISOString(),
      enddt: new Date(end).toISOString(),
      subject: title,
      body: details || "",
      location: location || "",
    }).toString();

  // "Apple / Other": a hosted .ics link. Clicking it downloads/opens a calendar
  // file that Apple Calendar, Outlook and most other apps understand. Served by
  // /api/ics so it works as a normal <a href> in email (an attachment can't be
  // linked to).
  const ics =
    "https://www.norahealth.co.uk/api/ics?" +
    new URLSearchParams({
      start: icsStamp(start),
      end: icsStamp(end),
      title,
      details: details || "",
      location: location || "",
      uid: `nora-appt-${new Date(start).getTime()}@norahealth.co.uk`,
    }).toString();

  return { google, outlook, ics };
}

// A valid single-event ICS (Apple Calendar / Outlook desktop / Google import).
function buildIcs({ title, start, end, details, location, uid }) {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Nora Health//Appointments//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${icsStamp(new Date())}`,
    `DTSTART:${icsStamp(start)}`,
    `DTEND:${icsStamp(end)}`,
    `SUMMARY:${icsEscape(title)}`,
    `DESCRIPTION:${icsEscape(details)}`,
    `LOCATION:${icsEscape(location)}`,
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

// Email-safe "Add to calendar" block: an "Apple / Other" button (hosted .ics,
// works with Apple Calendar / Outlook / most apps) and a "Google Calendar"
// button, each with its real brand logo. The logos are hosted PNGs (Gmail and
// Outlook don't render SVG or data: URIs in email), sized 2x for retina and
// shown with alt="" so a blocked image just leaves the text label intact.

// Assemble calendar links + ICS + button HTML for a 1-hour appointment slot.
// `stored` is the wall-clock-in-UTC appointment; `storedEnd` optional.
function appointmentCalendar({ stored, storedEnd, fullName, whatsappNumber, supportEmail }) {
  const start = toUtcInstant(stored);
  const end = storedEnd
    ? toUtcInstant(storedEnd)
    : new Date(start.getTime() + 60 * 60 * 1000);
  const title = "Nora Health appointment";
  const details =
    `Your Nora Health contraception call${fullName ? ` for ${fullName}` : ""}. ` +
    `Nora Health will call you during this 1-hour slot. Need to change or ` +
    `cancel? WhatsApp ${whatsappNumber} or email ${supportEmail}.`;
  const location = "Phone call — Nora Health will call you";
  const links = buildCalendarLinks({ title, start, end, details, location });
  const ics = buildIcs({
    title,
    start,
    end,
    details,
    location,
    uid: `nora-appt-${start.getTime()}@norahealth.co.uk`,
  });
  return {
    buttonsHtml: calendarButtonsHtml(links),
    attachment: {
      filename: "appointment.ics",
      content: Buffer.from(ics),
      content_type: "text/calendar; method=PUBLISH; charset=UTF-8",
    },
  };
}
// export const orderEmailTemplate = ({ medicineName, trackingId, status }) =>
//    `
// <div style="font-family: Arial, sans-serif; background:#f9f9f9; padding:20px;">
//   <table width="100%" style="max-width:600px;margin:auto;background:#fff;border:1px solid #eee;border-radius:6px;">
//     <tr>
//       <td style="background:#cd8936;color:#fff;padding:16px;text-align:center;font-size:22px;font-weight:bold;">
//         Nora Health
//       </td>
//     </tr>

//     <tr>
//       <td style="padding:20px;font-size:18px;font-weight:bold;color:#333;">
//         Order Confirmation
//       </td>
//     </tr>

//     <tr>
//       <td style="padding:0 20px 20px;color:#333;font-size:15px;">
//         <p>Your order has been successfully created.</p>

//         <table width="100%" cellpadding="0" cellspacing="0">
//           <tr>
//             <td style="padding:6px 0;font-weight:bold;">Contraceptive:</td>
//             <td>${medicineName}</td>
//           </tr>
//           <tr>
//             <td style="padding:6px 0;font-weight:bold;">Tracking ID:</td>
//             <td>${trackingId || "Pending"}</td>
//           </tr>
//           <tr>
//             <td style="padding:6px 0;font-weight:bold;">Status:</td>
//             <td>${escapeHtml(getStatusLabel(status))}</td>
//           </tr>
//         </table>

//         <p style="margin-top:20px;">
//           We will notify you once your order is shipped.
//         </p>
//       </td>
//     </tr>

//     <tr>
//       <td style="background:#f3f3f3;padding:12px;text-align:center;font-size:13px;color:#777;">
//         © ${new Date().getFullYear()} Nora Health. All rights reserved.
//       </td>
//     </tr>
//   </table>
// </div>
// `;


export const orderEmailTemplate = (args) => orderReceivedEmailHtml(args);


export const orderStatusEmailTemplate = (args) => orderStatusEmailHtml(args);


// export async function sendBookingConfirmationEmail({
//   to,
//   fullName,
//   serviceName,
//   providerName,
//   nhsService,
//   appointment,
//   notes,
// }) {
//   const html = `
//   <div style="font-family: Arial, sans-serif; background:#f9f9f9; padding:20px;">
//     <table width="100%" style="max-width:600px;margin:auto;background:#fff;border-radius:6px;border:1px solid #eee;">
//       <tr>
//         <td style="background:#cd8936;color:#fff;padding:16px;text-align:center;font-size:22px;font-weight:bold;">
//           Nora Health
//         </td>
//       </tr>

//       <tr>
//         <td style="padding:20px;font-size:18px;font-weight:bold;color:#333;">
//           Booking Confirmation
//         </td>
//       </tr>

//       <tr>
//         <td style="padding:0 20px 20px;font-size:15px;color:#333;">
//           <p>Hi ${escapeHtml(fullName)},</p>

//           <p>Your appointment has been successfully booked. Here are the details:</p>

//           <table width="100%" cellpadding="0" cellspacing="0">
            
//             <tr>
//               <td style="padding:6px 0;font-weight:bold;color:#cd8936;">Appointment:</td>
//               <td>${formatDateTime(appointment)}</td>
//             </tr>
//             ${
//               notes
//                 ? `<tr>
//                      <td style="padding:6px 0;font-weight:bold;color:#cd8936;">Notes:</td>
//                      <td>${escapeHtml(notes)}</td>
//                    </tr>`
//                 : ""
//             }
//           </table>

          

//           <p style="font-size:13px;color:#555;">
//             If you need to change or cancel your appointment, please contact us.
//           </p>
//         </td>
//       </tr>

//       <tr>
//         <td style="background:#f3f3f3;padding:12px;text-align:center;font-size:13px;color:#777;">
//           © ${new Date().getFullYear()} Nora Health. All rights reserved.
//         </td>
//       </tr>
//     </table>
//   </div>
//   `;

//   await resend.emails.send({
//     from: "Nora Health <contact@norahealth.co.uk>",
//     to,
//     subject: "Your Appointment Is Confirmed",
//     replyTo: "contact@norahealth.co.uk",
//     html,
//   });
// }

// export async function sendOrderBookingConfirmationEmail({
//   to,
//   fullName,
//   serviceName,
//   providerName,
//   nhsService,
//   ocRequest,
//   appointmentRequest,
//   deliveryAddress,
//   createdAt,
//   notes,
// }) {

  
//   const html = `
//   <div style="font-family:Arial,sans-serif;background:#f9f9f9;padding:20px;">
//     <table width="100%" style="max-width:600px;margin:auto;background:#fff;border-radius:6px;border:1px solid #eee;">
//       <tr>
//         <td style="background:#cd8936;color:#fff;padding:16px;text-align:center;font-size:22px;font-weight:bold;">
//           Nora Health
//         </td>
//       </tr>

//       <tr>
//         <td style="padding:20px;font-size:18px;font-weight:bold;color:#333;">
//           Order Confirmation
//         </td>
//       </tr>

//       <tr>
//         <td style="padding:0 20px 20px;font-size:15px;color:#333;">
//           <p>Hi ${escapeHtml(fullName)},</p>

//           <p>
//             Thank you for placing your contraceptive order with Nora Health. 
//           </p>

//            <p>
//            Your request is under review by our clinical team. Once completed we will post your medication to you at:
//             <strong>${escapeHtml(deliveryAddress)}</strong>.  We offer free next day delivery on all consultations completed by 1:00 p.m..
//           </p>

          

//           <p style="margin-top:16px;font-size:13px;color:#555;">
//            Thank You
//           </p>
//         </td>
//       </tr>

//       <tr>
//         <td style="background:#f3f3f3;padding:12px;text-align:center;font-size:13px;color:#777;">
//           © ${new Date().getFullYear()} Nora Health. All rights reserved.
//         </td>
//       </tr>
//     </table>
//   </div>
//   `;

//   await resend.emails.send({
//     from: "Nora Health <contact@norahealth.co.uk>",
//     to,
//     subject: "Your Contraceptive Order Has Been Received",
//     replyTo: "contact@norahealth.co.uk",
//     html,
//   });
// }


// export const orderFromBookingEmailTemplate=({
//   fullName,
//   medicineName,
//   status,
//   trackingId,
// })=> {
//   return `
//   <div style="font-family:Arial,sans-serif;background:#f9f9f9;padding:20px;">
//     <table width="100%" style="max-width:600px;margin:auto;background:#fff;border-radius:6px;border:1px solid #eee;">
//       <tr>
//         <td style="background:#cd8936;color:#fff;padding:16px;text-align:center;font-size:22px;font-weight:bold;">
//           Nora Health
//         </td>
//       </tr>

//       <tr>
//         <td style="padding:20px;font-size:18px;font-weight:bold;color:#333;">
//           Order Update
//         </td>
//       </tr>

//       <tr>
//         <td style="padding:0 20px 20px;font-size:15px;color:#333;">
//           <p>Hi ${escapeHtml(fullName)},</p>

//           <p>
//             Please see below for updates to your contraceptive order::
//           </p>

//           <table width="100%" cellpadding="0" cellspacing="0">
//             <tr>
//               <td style="padding:6px 0;font-weight:bold;color:#cd8936;">Medicine:</td>
//               <td>${escapeHtml(medicineName)}</td>
//             </tr>
//             <tr>
//               <td style="padding:6px 0;font-weight:bold;color:#cd8936;">Status:</td>
//               <td>${escapeHtml(getStatusLabel(status))}</td>
//             </tr>
//             <tr>
//               <td style="padding:6px 0;font-weight:bold;color:#cd8936;">Tracking ID:</td>
//               <td>${escapeHtml(trackingId || "Pending")}</td>
//             </tr>
//           </table>

//           <p style="margin-top:16px;font-size:13px;color:#555;"> 
//             Our clinical team will review your order and update you shortly.
           
//           </p>
//         </td>
//       </tr>

//       <tr>
//         <td style="background:#f3f3f3;padding:12px;text-align:center;font-size:13px;color:#777;">
//           © ${new Date().getFullYear()} Nora Health. All rights reserved.
//         </td>
//       </tr>
//     </table>
//   </div>
//   `;
// }



export async function sendBookingConfirmationEmail({
  to,
  fullName,
  serviceName,
  providerName,
  nhsService,
  appointment,
  appointmentEnd,
  notes,
  phoneNumber,
}) {
  const whatsappLink = "https://wa.me/447737984422";
  const whatsappNumber = "+44 7737 984422";
  const supportEmail = "pharmacy.fap80@nhs.net";

  // Google/Outlook buttons + .ics attachment for this appointment slot.
  const cal = appointmentCalendar({
    stored: appointment,
    storedEnd: appointmentEnd,
    fullName,
    whatsappNumber,
    supportEmail,
  });

  const html = bookingConfirmationEmailHtml({
    fullName,
    appointmentText: formatAppointmentRange(appointment, appointmentEnd),
    phoneNumber,
    notes,
    calendarButtons: cal.buttonsHtml,
    whatsappNumber,
  });

  await resend.emails.send({
    from: "Nora Health <contact@norahealth.co.uk>",
    to,
    bcc: "pharmacy.fap80@nhs.net",
    subject: "Your Appointment Is Confirmed",
    replyTo: "contact@norahealth.co.uk",
    html,
    attachments: [cal.attachment],
  });
}

export async function sendOrderBookingConfirmationEmail({
  to,
  fullName,
  firstName,
  phoneNumber,
  serviceName,
  providerName,
  nhsService,
  ocRequest,
  appointmentRequest,
  deliveryAddress,
  appointment,
  slotStartTime,
  slotEndTime,
  createdAt,
  notes,
}) {
  // "15-Jul" (DD-MMM) + "15:00 – 16:00" for the "we will call you on …" line.
  let callDate = "";
  let callTimeSlot = "";
  if (appointment) {
    // "Monday 26th October" (client review 7.2a)
    callDate = longCallDate(appointment);
    callTimeSlot = slotStartTime
      ? `${slotStartTime}${slotEndTime ? ` – ${slotEndTime}` : ""}`
      : "";
  }

  // Add-to-calendar (Google/Outlook buttons + .ics attachment) for the call
  // slot — only when we actually have an appointment datetime.
  const cal = appointment
    ? appointmentCalendar({
        stored: appointment,
        fullName,
        whatsappNumber: "+44 7737 984422",
        supportEmail: "pharmacy.fap80@nhs.net",
      })
    : null;

  const html = orderEmailTemplate({
    firstName: firstName || firstNameOf(fullName),
    phoneNumber,
    deliveryAddress,
    callDate,
    callTimeSlot,
    calendarButtons: cal ? cal.buttonsHtml : "",
  });

  await resend.emails.send({
    from: "Nora Health <contact@norahealth.co.uk>",
    to,
    bcc: "pharmacy.fap80@nhs.net",
    subject: "Your Contraceptive Order Has Been Received",
    replyTo: "contact@norahealth.co.uk",
    html,
    ...(cal ? { attachments: [cal.attachment] } : {}),
  });
}

export const orderFromBookingEmailTemplate = ({
  fullName,
  firstName,
  medicineName,
  status,
  trackingId,
  deliveryAddress,
}) => {
  return orderStatusEmailTemplate({
    firstName: firstName || firstNameOf(fullName),
    medicineName,
    status,
    trackingId,
    deliveryAddress,
  });
};



