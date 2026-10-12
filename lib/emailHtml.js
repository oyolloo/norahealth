// Email HTML builders. Pure functions (no Resend import) so they can be
// rendered for previews and tests. Table layout + inline styles for Gmail,
// Outlook and Apple Mail.

const C = {
  orange: "#CE8936",
  ink: "#0D060C",
  body: "#3A3D42",
  muted: "#6B6660",
  line: "#EEE0CF",
  cream: "#F4E7E1",
  soft: "#FAF9F8",
  plum: "#3F1836",
};
const FONT = "'DM Sans', Inter, Arial, Helvetica, sans-serif";
const SITE = "https://www.norahealth.co.uk";
const IMG = `${SITE}/images/email`;
export const WHATSAPP_LINK = "https://wa.me/447440126154";
export const PHARMACY_EMAIL = "pharmacy.fap80@nhs.net";

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
  `<a href="${href}" target="_blank" rel="noopener noreferrer" style="color:${C.orange};text-decoration:underline;font-weight:600;">${label}</a>`;

export function p(html, extra = "") {
  return `<p style="margin:0 0 16px;font-family:${FONT};font-size:15px;line-height:1.65;color:${C.body};${extra}">${html}</p>`;
}

export function heading(text) {
  return `<p style="margin:28px 0 8px;font-family:${FONT};font-size:16px;line-height:1.4;font-weight:700;color:${C.ink};">${text}</p>`;
}

export function button(href, label, { secondary = false } = {}) {
  const bg = secondary ? "#FFFFFF" : C.orange;
  const fg = secondary ? C.orange : "#FFFFFF";
  return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" class="btn" style="margin:4px 0 16px;">
  <tr>
    <td style="border-radius:999px;background:${bg};border:1.5px solid ${C.orange};">
      <a href="${href}" target="_blank" rel="noopener noreferrer"
        style="display:inline-block;padding:13px 26px;font-family:${FONT};font-size:15px;font-weight:600;line-height:1.2;color:${fg};text-decoration:none;border-radius:999px;">${label}</a>
    </td>
  </tr>
</table>`;
}

// rows: [[label, valueHtml], ...]
export function detailsCard(rows) {
  const tr = rows
    .map(
      ([label, value], i) => `
  <tr>
    <td style="padding:12px 18px;${i ? `border-top:1px solid ${C.line};` : ""}font-family:${FONT};font-size:13px;color:${C.muted};width:42%;vertical-align:top;">${label}</td>
    <td style="padding:12px 18px;${i ? `border-top:1px solid ${C.line};` : ""}font-family:${FONT};font-size:14px;font-weight:600;color:${C.ink};vertical-align:top;">${value}</td>
  </tr>`
    )
    .join("");
  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
  style="margin:8px 0 20px;background:${C.soft};border:1px solid ${C.line};border-radius:12px;border-collapse:separate;">${tr}
</table>`;
}

// items: [[boldLead, text], ...]
export function featureList(items) {
  const tr = items
    .map(
      ([lead, text]) => `
  <tr>
    <td style="padding:0 12px 12px 0;width:10px;vertical-align:top;">
      <div style="width:8px;height:8px;margin-top:8px;border-radius:999px;background:${C.orange};"></div>
    </td>
    <td style="padding:0 0 12px;font-family:${FONT};font-size:15px;line-height:1.6;color:${C.body};">
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
    neutral: [C.cream, C.ink],
  }[tone];
  return `<span style="display:inline-block;padding:5px 12px;border-radius:999px;background:${t[0]};color:${t[1]};font-family:${FONT};font-size:13px;font-weight:600;">${label}</span>`;
}

function contactFooterLinks() {
  const a = (href, label) =>
    `<a href="${href}" target="_blank" rel="noopener noreferrer" style="color:#FFFFFF;text-decoration:none;font-weight:600;">${label}</a>`;
  return [a(WHATSAPP_LINK, "WhatsApp"), a(SITE, "Website"), a(`mailto:${PHARMACY_EMAIL}`, "Email us")].join(
    `<span style="color:#B69AAE;padding:0 10px;">|</span>`
  );
}

export function layout({ preheader = "", eyebrow = "", title, body }) {
  const year = new Date().getFullYear();
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light">
<title>${escapeHtml(title)}</title>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700&display=swap" rel="stylesheet">
<style>
  @media (max-width: 620px) {
    .px { padding-left: 22px !important; padding-right: 22px !important; }
    .h1 { font-size: 24px !important; }
    .btn, .btn td, .btn a { display: block !important; width: 100% !important; text-align: center !important; box-sizing: border-box; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:${C.cream};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${C.cream};">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.cream};">
  <tr>
    <td align="center" style="padding:28px 12px 36px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;">
        <tr>
          <td align="center" style="padding:4px 0 22px;">
            <a href="${SITE}" target="_blank" rel="noopener noreferrer">
              <img src="${IMG}/email-logo.png" width="172" height="33" alt="Nora Health" style="display:block;border:0;width:172px;height:auto;">
            </a>
          </td>
        </tr>
        <tr>
          <td style="background:#FFFFFF;border-radius:20px;border:1px solid ${C.line};border-top:4px solid ${C.orange};">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td class="px" style="padding:34px 40px 8px;">
                  ${eyebrow ? `<p style="margin:0 0 8px;font-family:${FONT};font-size:12px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:${C.orange};">${eyebrow}</p>` : ""}
                  <h1 class="h1" style="margin:0 0 22px;font-family:${FONT};font-size:28px;line-height:1.25;font-weight:700;color:${C.ink};">${title}</h1>
                </td>
              </tr>
              <tr>
                <td class="px" style="padding:0 40px 30px;">${body}</td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding-top:16px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.plum};border-radius:20px;">
              <tr>
                <td align="center" class="px" style="padding:28px 40px;">
                  <img src="${IMG}/email-logo-white.png" width="136" height="26" alt="Nora Health" style="display:block;border:0;width:136px;height:auto;margin:0 auto 14px;">
                  <p style="margin:0 0 14px;font-family:${FONT};font-size:14px;color:#E9DCE5;">Free Oral Contraception, Delivered to Your Door</p>
                  <p style="margin:0 0 16px;font-family:${FONT};font-size:14px;">${contactFooterLinks()}</p>
                  <p style="margin:0;font-family:${FONT};font-size:12px;color:#B69AAE;">&copy; ${year} Nora Health. All rights reserved.</p>
                </td>
              </tr>
            </table>
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
  const pill = (href, icon, w, h, label) => `
    <td style="padding:0 8px 8px 0;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="border:1.5px solid ${C.orange};border-radius:999px;background:#FFFFFF;">
            <a href="${href}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:10px 18px;font-family:${FONT};font-size:14px;font-weight:600;color:${C.orange};text-decoration:none;">
              <img src="${IMG}/${icon}" width="${w}" height="${h}" alt="" style="vertical-align:middle;margin-right:8px;border:0;">${label}
            </a>
          </td>
        </tr>
      </table>
    </td>`;
  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 20px;background:${C.soft};border:1px solid ${C.line};border-radius:12px;border-collapse:separate;">
  <tr>
    <td style="padding:16px 18px 10px;">
      <p style="margin:0 0 12px;font-family:${FONT};font-size:14px;font-weight:700;color:${C.ink};">You can add this appointment to your calendar</p>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0">
        <tr>
          ${pill(ics, "apple.png", 13, 16, "Apple / Other")}
          ${pill(google, "google-calendar.png", 16, 16, "Google Calendar")}
        </tr>
      </table>
      <p style="margin:4px 0 6px;font-family:${FONT};font-size:12px;line-height:1.5;color:${C.muted};">
        &ldquo;Apple / Other&rdquo; opens a calendar file that works with Apple Calendar, Outlook and most apps.
      </p>
    </td>
  </tr>
</table>`;
}

/* ---------- emails ---------- */

export function welcomeEmailHtml({ name }) {
  const n = escapeHtml(firstNameOf(name));
  const orderOnline = `${SITE}/booking/order`;
  const body = [
    p(`Hello ${n},`),
    p(`Welcome to Nora Health — you have just joined the UK's simplest ordering service for contraception.`),
    p(`Whether you need your regular supply, want to try a new pill or require urgent protection (morning after pill), we get it to you fast, discreetly and with zero hassle.`),
    heading(`Option 1: Order via WhatsApp (Recommended)`),
    p(`We highly recommend using our WhatsApp service for the absolute fastest experience. Chat directly with our team instantly:`, "margin-bottom:12px;"),
    button(WHATSAPP_LINK, "Click here to order on WhatsApp"),
    p(`(or text us at 07440 126 154)`, `font-size:13px;color:${C.muted};margin-top:-6px;`),
    heading(`Option 2: Order Online (Quick &amp; Easy)`),
    p(`Prefer to use our website? You can safely submit your details and request your prescription through our secure online portal:`, "margin-bottom:12px;"),
    button(orderOnline, "Click here to order online at norahealth.co.uk", { secondary: true }),
    heading(`What you can order today:`),
    featureList([
      ["Regular repeat contraception:", "Never run out of your daily pill."],
      ["New contraception:", "Switch your method easily online or via chat."],
      ["Emergency contraception:", "Quick, confidential access to the morning-after pill."],
    ]),
    heading(`Our Promise To You:`),
    featureList([
      ["Total flexibility:", "Order online or straight through WhatsApp."],
      ["Fast &amp; reliable:", "Secure Royal Mail 24-hour tracked delivery for next-day arrival."],
      ["Zero stress:", "No long pharmacy queues or waiting for appointments."],
      ["Total transparency:", "An online account to keep track of all of your orders."],
    ]),
    p(`Ready to start? Tap the WhatsApp link below to say hello or visit our ${link(orderOnline, "website")} to secure your next order.`, "margin-top:12px;"),
    button(WHATSAPP_LINK, "Chat with us on WhatsApp"),
    p(`Best health,<br>The Nora Health Team<br>${link(SITE, "norahealth.co.uk")}`, "margin-top:12px;"),
  ].join("");
  return layout({
    preheader: "Order your contraception online or on WhatsApp.",
    eyebrow: "Welcome",
    title: "Welcome to Nora Health",
    body,
  });
}

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
  const callLine = date
    ? `We will call you on <strong>${date}</strong>${slot ? ` during <strong>${slot}</strong>` : ""}. The 1-hour slot simply indicates when you may expect a call. `
    : "";

  const body = [
    p(`Hello ${name},`),
    p(`Thank you for submitting your contraception request with Nora Health.`),
    date
      ? detailsCard([
          ["Telephone appointment", date],
          ...(slot ? [["Time slot", slot]] : []),
        ])
      : "",
    heading(`Next Steps:`),
    p(`Before we can approve your contraception request we need to complete a quick telephone call &mdash; usually only takes <strong>just 2&ndash;3 minutes</strong>. ${callLine}If there is a specific time that works best for you, feel free to tell us and we'll try our best to match it.`),
    calendarButtons,
    heading(`Delivery:`),
    p(`After your consultation we will post your medication to <strong>${address}</strong> in discreet packaging. Our service is completely free. If we complete the call before 1pm we can usually arrange for next day delivery using Royal Mail 24 Hour Tracked service.`),
    heading(`Getting in Touch:`),
    p(`If you need to adjust your appointment or have any questions you may message us and/or call us directly on ${link(WHATSAPP_LINK, "WhatsApp")} or email us at ${link(`mailto:${PHARMACY_EMAIL}`, PHARMACY_EMAIL)}. For anything urgent please call us directly via WhatsApp.`),
    p(`Thank you &mdash; we look forward to speaking with you soon,<br>Dev`, "margin-top:12px;"),
  ].join("");

  return layout({
    preheader: "We have your request. Next step: a quick telephone call.",
    eyebrow: "Request received",
    title: "Order Confirmation",
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

  const queryLine = p(
    `If you have any queries regarding your order please ${link(WHATSAPP_LINK, "click here")} to message us on WhatsApp or send us an email on ${link(`mailto:${PHARMACY_EMAIL}`, PHARMACY_EMAIL)}.`,
    `font-size:13px;color:${C.muted};`
  );

  let title, eyebrow, preheader, body;
  if (s === "declined") {
    title = "Contraception Request Declined";
    eyebrow = "Update on your request";
    preheader = "We need a little more information from you.";
    body = [
      p(`Hi ${name},`),
      p(`Your contraceptive request didn&#39;t pass our clinical safety checks so we haven&#39;t been able to post your medicines yet.`),
      p(`When you have a moment, please get in touch with us &mdash; we just need a little more information to make sure everything is safe for you. You can call us, ${link(WHATSAPP_LINK, "message us on WhatsApp")}, or email us at ${link(`mailto:${PHARMACY_EMAIL}`, PHARMACY_EMAIL)}.`),
      button(WHATSAPP_LINK, "Message us on WhatsApp"),
      p(`We&#39;ll do our very best to sort this out quickly for you.`),
    ].join("");
  } else if (s === "posted") {
    title = "Contraception Posted";
    eyebrow = "On its way";
    preheader = "Your contraceptive has been posted via Royal Mail tracked service.";
    body = [
      p(`Hi ${name},`),
      p(`Your contraceptive has been posted via Royal Mail tracked service.`),
      p(statusPill("Posted via Royal Mail", "good"), "margin-bottom:8px;"),
      detailsCard([
        ["Contraceptive", med],
        ["Delivery Address", address],
        ["Tracking ID", tracking],
      ]),
      queryLine,
    ].join("");
  } else {
    title = "Contraception Update";
    eyebrow = "Approved";
    preheader = "Your contraceptive request has been approved and is awaiting dispatch.";
    body = [
      p(`Hi ${name},`),
      p(`Your contraceptive request has been approved and is awaiting dispatch.`),
      p(statusPill(escapeHtml(getStatusLabel(status)), "warn"), "margin-bottom:8px;"),
      detailsCard([
        ["Oral Contraceptive", med],
        ["Status", escapeHtml(getStatusLabel(status))],
        ["Tracking ID", tracking],
      ]),
      queryLine,
    ].join("");
  }
  return layout({ preheader, eyebrow, title, body });
}

export function bookingConfirmationEmailHtml({
  fullName,
  appointmentText,
  notes,
  calendarButtons = "",
  whatsappNumber,
}) {
  const body = [
    p(`Hi ${escapeHtml(fullName)},`),
    p(`Your appointment has been successfully booked. Here are the details:`),
    detailsCard([
      ["Appointment", escapeHtml(appointmentText)],
      ...(notes ? [["Notes", escapeHtml(notes)]] : []),
    ]),
    calendarButtons,
    p(
      `If you need to change or cancel your appointment, please ${link(WHATSAPP_LINK, "message us on WhatsApp")} (${escapeHtml(whatsappNumber)}) or email us at ${link(`mailto:${PHARMACY_EMAIL}`, PHARMACY_EMAIL)}.`,
      `font-size:13px;color:${C.muted};`
    ),
  ].join("");
  return layout({
    preheader: `Your telephone appointment: ${appointmentText}`,
    eyebrow: "Telephone appointment",
    title: "Booking Confirmation",
    body,
  });
}

export function resetPasswordEmailHtml({ resetUrl }) {
  const body = [
    p(`Click the button below to reset your password (valid for <b>15 minutes</b>):`),
    button(resetUrl, "Reset Password"),
    p(`If you didn't request this, you can ignore this email.`, `font-size:13px;color:${C.muted};`),
  ].join("");
  return layout({
    preheader: "Reset your Nora Health password. The link is valid for 15 minutes.",
    eyebrow: "Account",
    title: "Reset your password",
    body,
  });
}
