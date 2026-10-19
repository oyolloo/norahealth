// Email HTML builders. Pure functions (no Resend import) so they can be
// rendered for previews and tests. Table layout + inline styles for Gmail,
// Outlook and Apple Mail. Layout follows the client's October 2026 designs.

const C = {
  orange: "#D08B36",
  orangeText: "#B5701F",
  ink: "#1A1A1A",
  body: "#2B2B2B",
  muted: "#5E5E5E",
  step: "#4A4A4A",
  line: "#F0E1DC",
  cream: "#F5E6E1",
  soft: "#FBF3F0",
  plum: "#3F1535",
  plumLine: "#6B3A5E",
};
const FONT = "'DM Sans', Arial, Helvetica, sans-serif";
const SITE = "https://www.norahealth.co.uk";
const IMG = `${SITE}/images/email`;
export const WHATSAPP_LINK = "https://wa.me/447440126154";
export const PHARMACY_EMAIL = "pharmacy.fap80@nhs.net";
const CLINIC_PHONE = "0208 679 7198";
const ROYAL_MAIL_TRACK = "https://www.royalmail.com/track-your-item#/tracking-results/";

export function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function firstNameOf(name) {
  return String(name || "").trim().split(/\s+/)[0] || "there";
}

export function getStatusLabel(status) {
  const s = String(status || "").toLowerCase();
  if (s === "clinicalreview") return "Awaiting Dispatch";
  if (s === "posted") return "Posted via Royal Mail";
  if (s === "declined") return "Declined";
  return status || "";
}

/* ---------- building blocks ---------- */

const link = (href, label) =>
  `<a href="${href}" target="_blank" rel="noopener noreferrer" style="color:${C.orangeText};text-decoration:underline;font-weight:700;">${label}</a>`;

export function p(html, extra = "") {
  return `<p style="margin:0 0 14px;font-family:${FONT};font-size:15px;line-height:24px;color:${C.body};${extra}">${html}</p>`;
}

export function heading(text) {
  return `<h2 style="margin:26px 0 10px;font-family:${FONT};font-size:16px;line-height:22px;font-weight:700;color:${C.ink};">${text}</h2>`;
}

export function button(href, label, { secondary = false } = {}) {
  const bg = secondary ? "#FFFFFF" : C.orange;
  const fg = secondary ? C.plum : "#FFFFFF";
  const border = secondary ? C.plum : C.orange;
  return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" class="btn" align="center" style="margin:18px auto 4px;">
  <tr>
    <td align="center" bgcolor="${bg}" style="border-radius:30px;background:${bg};border:2px solid ${border};">
      <a href="${href}" target="_blank" rel="noopener noreferrer"
        style="display:block;padding:13px 28px;font-family:${FONT};font-size:15px;font-weight:700;line-height:20px;color:${fg};text-decoration:none;border-radius:30px;">${label}</a>
    </td>
  </tr>
</table>`;
}

// Small inline pill links, side by side (welcome step 1, calendar)
function pillLink(href, label, { filled = false } = {}) {
  const style = filled
    ? `padding:10px 18px;background:${C.orange};color:#FFFFFF;`
    : `padding:8px 16px;border:2px solid ${C.plum};color:${C.plum};`;
  return `<a href="${href}" target="_blank" rel="noopener noreferrer" style="display:inline-block;margin:0 4px 8px;${style}border-radius:24px;font-family:${FONT};font-size:14px;line-height:20px;font-weight:700;text-decoration:none;">${label}</a>`;
}

// Stacked label / value card. rows: [[label, valueHtml], ...]
export function detailsCard(rows) {
  const items = rows
    .map(
      ([label, value]) => `
      <div style="font-family:${FONT};font-size:13px;line-height:18px;color:${C.muted};">${label}</div>
      <div style="font-family:${FONT};font-size:16px;line-height:24px;font-weight:700;color:${C.plum};padding-bottom:12px;">${value}</div>`
    )
    .join("");
  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:12px 0 16px;background:${C.soft};border-radius:12px;border-collapse:separate;">
  <tr><td style="padding:16px 18px 4px;">${items}
  </td></tr>
</table>`;
}

// Soft box with an orange left border, for notes the patient must not miss
export function noteBox(html) {
  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 16px;background:${C.soft};border-radius:12px;border-left:4px solid ${C.orange};border-collapse:separate;">
  <tr><td style="padding:14px 18px;font-family:${FONT};font-size:15px;line-height:23px;color:${C.plum};">${html}</td></tr>
</table>`;
}

// items: [[boldLead, text], ...]
export function featureList(items) {
  const tr = items
    .map(
      ([lead, text]) => `
  <tr>
    <td style="padding:0 12px 10px 0;width:6px;vertical-align:top;">
      <div style="width:6px;height:6px;margin-top:9px;border-radius:999px;background:${C.orange};"></div>
    </td>
    <td style="padding:0 0 10px;font-family:${FONT};font-size:15px;line-height:23px;color:${C.body};">
      <strong style="color:${C.ink};">${lead}</strong> ${text}
    </td>
  </tr>`
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 8px;">${tr}</table>`;
}

export function statusPill(label, tone = "neutral") {
  const t = {
    good: ["#E7F4EC", "#1E6B3A"],
    warn: ["#FBF0E2", "#8A5A12"],
    bad: ["#FBE7E5", "#9B2C22"],
    neutral: [C.cream, C.plum],
  }[tone];
  return `<span style="display:inline-block;padding:6px 14px;border-radius:20px;background:${t[0]};color:${t[1]};font-family:${FONT};font-size:13px;line-height:18px;font-weight:700;">${label}</span>`;
}

const centredPill = (label, tone) =>
  `<div style="text-align:center;padding:0 0 18px;">${statusPill(label, tone)}</div>`;

const signOff = (opener = "Best health,", extra = "") =>
  p(`${opener}<br>The Nora Health Team${extra}`, "margin:24px 0 0;");

const questionsLine = (topic) =>
  p(`Questions about your ${topic}? We're here Monday to Friday, 8am to 6:30pm, and we'll reply on the next working day.`, "margin-top:8px;");

function contactFooterLinks() {
  const a = (href, label) =>
    `<a href="${href}" target="_blank" rel="noopener noreferrer" style="color:#FFFFFF;text-decoration:none;font-weight:700;">${label}</a>`;
  return [a(WHATSAPP_LINK, "WhatsApp"), a(SITE, "Website"), a(`mailto:${PHARMACY_EMAIL}`, "Email us")].join(
    `<span style="color:#FFFFFF;padding:0 8px;">|</span>`
  );
}

export function layout({ preheader = "", eyebrow = "", title = "", body }) {
  const year = new Date().getFullYear();
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light">
<title>${escapeHtml(title || "Nora Health")}</title>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700&display=swap" rel="stylesheet">
<style>
  @media (max-width: 480px) {
    .px { padding-left: 20px !important; padding-right: 20px !important; }
    .h1 { font-size: 22px !important; line-height: 28px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:${C.cream};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${C.cream};">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.cream};">
  <tr>
    <td align="center" style="padding:20px 12px 32px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
        <tr>
          <td align="center" style="padding:4px 0 20px;">
            <a href="${SITE}" target="_blank" rel="noopener noreferrer">
              <img src="${IMG}/email-logo.png" width="150" alt="Nora Health" style="display:block;border:0;width:150px;height:auto;">
            </a>
          </td>
        </tr>
        <tr>
          <td class="px" style="background:#FFFFFF;border-radius:16px;border-top:3px solid ${C.orange};padding:28px 24px;">
            ${eyebrow ? `<p style="margin:0 0 ${title ? "0" : "20px"};font-family:${FONT};font-size:12px;line-height:16px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;text-align:center;color:${C.orangeText};">${eyebrow}</p>` : ""}
            ${title ? `<h1 class="h1" style="margin:10px 0 20px;font-family:${FONT};font-size:24px;line-height:30px;font-weight:700;text-align:center;color:${C.ink};">${title}</h1>` : ""}
            ${body}
          </td>
        </tr>
        <tr><td style="height:12px;line-height:12px;font-size:0;">&nbsp;</td></tr>
        <tr>
          <td align="center" class="px" style="background:${C.plum};border-radius:16px;padding:26px 20px;">
            <div style="font-family:${FONT};font-size:22px;line-height:28px;font-weight:700;color:${C.cream};">Nora <span style="color:${C.orange};font-weight:400;">Health</span></div>
            <div style="padding:10px 0 14px;font-family:${FONT};font-size:14px;line-height:20px;color:${C.cream};">Free Oral Contraception, Delivered to Your Door</div>
            <div style="font-family:${FONT};font-size:14px;line-height:22px;">${contactFooterLinks()}</div>
            <div style="padding-top:16px;margin-top:16px;border-top:1px solid ${C.plumLine};font-family:${FONT};font-size:13px;line-height:20px;color:${C.cream};">
              Nora Health Clinic<br>341 Tamworth Lane, Mitcham, CR4 1DL<br>
              Tel: <a href="tel:02086797198" style="color:${C.cream};text-decoration:underline;">${CLINIC_PHONE}</a><br>
              GPhC premises number: 1036683<br>
              &copy; ${year} Nora Health. All rights reserved.
            </div>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

/* ---------- calendar buttons ---------- */

export function calendarButtonsHtml({ google, ics }) {
  return `
<div style="text-align:center;font-family:${FONT};font-size:14px;line-height:20px;color:${C.body};padding:4px 0 10px;">Add this appointment to your calendar</div>
<div style="text-align:center;">${pillLink(ics, "Apple or Outlook")}${pillLink(google, "Google Calendar")}</div>`;
}

const whenWeCall = () =>
  noteBox(
    `<div style="font-size:16px;line-height:22px;font-weight:700;padding-bottom:6px;">When we call</div>
  <div style="color:${C.body};padding-bottom:8px;">We never call from a private number, so you'll see a number on your phone.</div>
  <div style="color:${C.body};">If we can't reach you, don't worry. We'll send you an SMS to say we tried calling, with a link to re-arrange if you need to.</div>`
  );

/* ---------- emails ---------- */

function welcomeIcons() {
  const cell = (file, label) => `
    <td width="33%" align="center" valign="top" style="padding:0 4px;">
      <img src="${IMG}/${file}" width="56" height="56" alt="" style="display:block;margin:0 auto 6px;border:0;width:56px;height:56px;">
      <div style="font-family:${FONT};font-size:13px;line-height:18px;font-weight:700;color:${C.plum};">${label}</div>
    </td>`;
  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 20px;">
  <tr>${cell("morning-after-pill.png", "Morning-after pill")}${cell("new-contraception.png", "Something new")}${cell("regular-contraception.png", "Regular pill")}</tr>
</table>`;
}

function howItWorks(orderOnline) {
  const step = (n, title, text, { last = false, extra = "" } = {}) => {
    const dot = last ? C.orange : C.plum;
    return `
  <tr><td style="padding:12px 18px ${last ? "20px" : "12px"};${last ? "" : `border-bottom:1px solid ${C.line};`}">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td width="36" valign="top" style="width:36px;padding:0 14px 0 0;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
          <td width="36" height="36" align="center" valign="middle" bgcolor="${dot}" style="width:36px;height:36px;border-radius:18px;background:${dot};color:#FFFFFF;font-family:${FONT};font-size:16px;line-height:36px;font-weight:700;">${n}</td>
        </tr></table>
      </td>
      <td valign="top">
        <div style="font-family:${FONT};font-size:16px;line-height:22px;font-weight:700;color:${last ? C.orange : C.ink};">${title}</div>
        <div style="padding-top:4px;font-family:${FONT};font-size:15px;line-height:22px;color:${C.step};">${text}</div>
      </td>
    </tr></table>${extra}
  </td></tr>`;
  };
  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.soft};border-radius:12px;border-collapse:separate;">
  <tr><td style="padding:20px 18px 6px;font-family:${FONT};font-size:18px;line-height:24px;font-weight:700;color:${C.plum};">How it works</td></tr>
  ${step(1, "Tell us what you need", "Order on WhatsApp, or fill in our online form, which takes less than a minute.", {
    extra: `<div style="padding-top:8px;text-align:center;">${pillLink(WHATSAPP_LINK, "Order on WhatsApp", { filled: true })}${pillLink(orderOnline, "Order online")}</div>`,
  })}
  ${step(2, "A clinician reviews your request", "We'll give you a quick call at a time that suits you to make sure the medication is safe for you.")}
  ${step(3, "Approved and dispatched", "Once approved, your medication is packed securely and shipped discreetly.")}
  ${step(4, "Ongoing support and reviews", "We don't just send your medication and leave you to it. We arrange appointments to check in as you get started, and you can message us on WhatsApp with questions in between. A month before you run out, we'll text and email you to review how it's going and whether you need more.", { last: true })}
</table>`;
}

export function welcomeEmailHtml({ name }) {
  const n = escapeHtml(firstNameOf(name));
  const orderOnline = `${SITE}/booking/order`;
  const body = [
    p(`Hello ${n},`),
    p(`Welcome to Nora Health &mdash; you have just joined the UK's simplest ordering service for contraception.`),
    welcomeIcons(),
    p(`Whether you need your regular supply, want to try a new pill or require urgent protection (morning after pill), we get it to you fast, discreetly and with zero hassle.`, "margin-bottom:22px;"),
    howItWorks(orderOnline),
    heading(`Our Promise To You:`),
    featureList([
      ["Safety first:", "Our clinical team is on WhatsApp to answer your questions, Monday to Friday, 8am to 8pm, with a typical reply within 4 hours."],
      ["No obligation:", "WhatsApp us with any general questions about contraception and we'll share information. You only order when you're ready, and you can get in touch again whenever you like."],
      ["Always free:", "There's no charge for advice, your consultation, your contraception or Royal Mail delivery."],
      ["Fast &amp; reliable:", "Secure Royal Mail 24-hour tracked delivery."],
      ["Zero stress:", "No long pharmacy queues or waiting for appointments."],
      ["Total transparency:", "An online account to keep track of all of your orders."],
    ]),
    p(`Ready to start? Tap the WhatsApp link below to say hello or visit our ${link(SITE, "website")} to secure your next order.`, "margin-top:12px;"),
    button(WHATSAPP_LINK, "Message us on WhatsApp"),
    signOff("Best health,", `<br>${link(SITE, "norahealth.co.uk")}`),
  ].join("");
  return layout({
    preheader: "Order your contraception online or on WhatsApp.",
    eyebrow: "Welcome",
    body,
  });
}

// Sent when a patient submits a contraception request with a call slot
export function orderReceivedEmailHtml({
  firstName,
  customerName,
  deliveryAddress,
  callDate,
  callTimeSlot,
  calendarButtons = "",
}) {
  const name = escapeHtml(firstName || firstNameOf(customerName));
  const address = escapeHtml(deliveryAddress || "your delivery address");
  const date = escapeHtml(callDate || "");
  const slot = escapeHtml(callTimeSlot || "");

  const body = [
    p(`Hello ${name},`),
    p(
      date
        ? `We've received your contraception request and booked your telephone appointment with one of our clinicians.`
        : `We've received your contraception request. One of our clinicians will call you for a quick telephone consultation.`
    ),
    detailsCard([
      ...(date ? [["Appointment", date]] : []),
      ...(slot ? [["Time slot", slot]] : []),
      ["Delivery address", address],
    ]),
    calendarButtons,
    whenWeCall(),
    heading(`What happens on the call`),
    p(`The clinician will discuss your contraception request to make sure it's the best one for your health needs. If you're asking for a combined contraceptive pill, it helps to have your recent blood pressure, weight and height readings to hand. If you don't have them, don't worry, we can talk it through on the call. A pharmacy blood pressure machine or a home monitor will give you a reading.`),
    heading(`How long will the call take?`),
    p(`There's no time limit. We'll take as long as you need to make sure you get the right contraception for you.`),
    heading(`Can you be more specific about when you'll call?`),
    p(`We don't have set appointment times, so the one-hour slot shows when to expect your call. If a specific time suits you best, tell us and we'll do our best to match it.`),
    heading(`Delivery`),
    p(`If your clinician agrees the treatment is suitable, we'll post your medication to the address above in discreet packaging. Your consultation, medication and delivery are free. All medicines are sent via Royal Mail 24 Hour Tracked service and you will be provided with full tracking details.`),
    p(`If the address above isn't right, please message us on WhatsApp before your call.`),
    heading(`Getting in touch`),
    p(`To change your appointment or ask a question, message us on ${link(WHATSAPP_LINK, "WhatsApp")} or email ${link(`mailto:${PHARMACY_EMAIL}`, PHARMACY_EMAIL)}. We're available Monday to Friday, 8am to 8pm, and for anything urgent in those hours you can call us directly on WhatsApp.`),
    signOff("Thank you. We look forward to speaking with you soon,"),
  ].join("");

  return layout({
    preheader: "We have your request. Next step: a quick telephone call.",
    eyebrow: "Request received",
    title: date ? "Your telephone appointment is confirmed" : "We've received your request",
    body,
  });
}

export function orderStatusEmailHtml({
  customerName,
  firstName,
  status,
  trackingId,
  medicineName,
  deliveryAddress,
}) {
  const name = escapeHtml(firstName || firstNameOf(customerName));
  const med = escapeHtml(medicineName || "");
  const tracking = escapeHtml(trackingId || "Pending");
  const address = escapeHtml(deliveryAddress || "your delivery address");
  const s = String(status || "").toLowerCase();

  let title, preheader, body;
  if (s === "declined") {
    title = "Contraception Request Declined";
    preheader = "We need a little more information from you.";
    body = [
      p(`Hi ${name},`),
      p(`We've reviewed your contraception request, but we need a little more information to complete our clinical safety checks. We've tried to get in touch with you a few times but haven't been able to reach you. As a result, we haven't been able to issue your medication.`),
      p(`If you'd still like to proceed with your request, please contact our team on ${link(WHATSAPP_LINK, "WhatsApp")} so we can obtain the information we need and help you with the next steps.`),
      p(`We understand that your circumstances may have changed and that you may no longer need contraception. We'll leave your request open so you can get back to us whenever you feel ready.`),
      p(`Please know that Nora Health is here to support you whenever you need us, and we'll be happy to help if you need our services in the future.`),
      button(WHATSAPP_LINK, "Message us on WhatsApp"),
      signOff("Wishing you good health,"),
    ].join("");
  } else if (s === "posted") {
    title = "Your order has been dispatched";
    preheader = "Your contraceptive has been posted via Royal Mail tracked service.";
    const trackUrl = trackingId
      ? `${ROYAL_MAIL_TRACK}${encodeURIComponent(String(trackingId).replace(/\s+/g, ""))}`
      : "";
    body = [
      centredPill("Posted via Royal Mail", "good"),
      p(`Hi ${name},`),
      p(`Your contraceptive has been posted via Royal Mail tracked service.`),
      detailsCard([
        ["Contraceptive", med],
        ["Delivery address", address],
        ["Tracking ID", tracking],
      ]),
      trackUrl ? button(trackUrl, "Track your parcel", { secondary: true }) : "",
      questionsLine("order"),
      button(WHATSAPP_LINK, "Message us on WhatsApp"),
      signOff(),
    ].join("");
  } else {
    title = "Your order has been approved";
    preheader = "Your contraceptive request has been approved and is awaiting dispatch.";
    body = [
      centredPill("Awaiting dispatch", "neutral"),
      p(`Hello ${name},`),
      p(`Your contraceptive request has been approved.`),
      p(`Once your order is on its way, we'll email you your tracking details.`),
      detailsCard([
        ["Oral contraceptive", med],
        ["Delivery address", address],
      ]),
      noteBox(`<strong>If the details above are incorrect, please message us on WhatsApp as soon as possible, before 12noon.</strong>`),
      questionsLine("order"),
      button(WHATSAPP_LINK, "Message us on WhatsApp"),
      signOff(),
    ].join("");
  }
  return layout({ preheader, eyebrow: "Order update", title, body });
}

// General (non-order) telephone appointment booked from /booking
export function bookingConfirmationEmailHtml({
  fullName,
  appointmentText,
  notes,
  calendarButtons = "",
}) {
  const body = [
    p(`Hello ${escapeHtml(firstNameOf(fullName))},`),
    p(`We've received your appointment request and booked your telephone appointment with one of our clinicians.`),
    detailsCard([
      ["Appointment", escapeHtml(appointmentText)],
      ...(notes ? [["Notes", escapeHtml(notes)]] : []),
    ]),
    calendarButtons,
    whenWeCall(),
    heading(`What happens on the call`),
    p(`The clinician will talk through what you'd like help with and answer any questions you have. If you're thinking about a combined contraceptive pill, it helps to have your recent blood pressure, weight and height readings to hand. If you don't have them, don't worry, we can talk it through on the call. A pharmacy blood pressure machine or a home monitor will give you a reading.`),
    heading(`How long will the call take?`),
    p(`There's no time limit. We'll take as long as you need to talk everything through.`),
    heading(`Can you be more specific about when you'll call?`),
    p(`We don't have set appointment times, so the one-hour slot shows when to expect your call. If a specific time suits you best, tell us and we'll do our best to match it.`),
    heading(`Delivery`),
    p(`If you decide on contraception, we can discuss it on the call. If your clinician agrees the treatment is suitable, we'll post it to you in discreet packaging. Your consultation, medication and delivery are free. All medicines are sent via Royal Mail 24 Hour Tracked service and you will be provided with full tracking details.`),
    heading(`Getting in touch`),
    p(`To change your appointment or ask a question, message us on WhatsApp. We're here Monday to Friday, 8am to 6:30pm, and we'll reply on the next working day if you message outside those hours. For anything urgent, call us directly on ${CLINIC_PHONE} during opening hours.`),
    button(WHATSAPP_LINK, "Message us on WhatsApp"),
    signOff("Thank you. We look forward to speaking with you soon,"),
  ].join("");
  return layout({
    preheader: `Your telephone appointment: ${appointmentText}`,
    eyebrow: "Request received",
    title: "Your telephone appointment is confirmed",
    body,
  });
}

export function resetPasswordEmailHtml({ resetUrl }) {
  const body = [
    p(`Click the button below to reset your password (valid for <b>15 minutes</b>):`),
    button(resetUrl, "Reset Password"),
    p(`If you didn't request this, you can ignore this email.`, `font-size:13px;color:${C.muted};margin-top:14px;`),
    questionsLine("account"),
    button(WHATSAPP_LINK, "Message us on WhatsApp"),
    signOff(),
  ].join("");
  return layout({
    preheader: "Reset your Nora Health password. The link is valid for 15 minutes.",
    eyebrow: "Account",
    title: "Reset your password",
    body,
  });
}
