import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);


function getStatusLabel(status) {
  const s = String(status || "").toLowerCase();

  if (s === "clinicalreview") return "Awaiting Dispatch";
  if (s === "posted") return "Posted via Royal Mail";
  if (s === "declined") return "Declined";

  return status || "";
}

function firstNameOf(name) {
  return String(name || "").trim().split(/\s+/)[0] || "there";
}

function formatDate(date) {
  return new Date(date).toLocaleString("en-GB", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "UTC", // stored UTC wall-clock == UK time the user picked
  });
}


function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Welcome email — sent once the patient completes their Account Registration
 * (that form is where we first have their name, so the greeting is
 * personalised as "Hello <first name>,"). Copy supplied by the client.
 */
export async function sendWelcomeEmail({ to, name }) {
  const greetingName = firstNameOf(name); // "there" as a safe fallback
  // Full international number (44 + 7440126154); the client's draft link was
  // missing the "44" country code, which would break the WhatsApp deep link.
  const whatsappLink = "https://wa.me/447440126154";
  const orderOnlineLink = "https://www.norahealth.co.uk/booking/order";
  const siteLink = "https://www.norahealth.co.uk";
  const linkStyle = "color:#cd8936;text-decoration:underline;";

  const html = `
  <div style="font-family: Arial, sans-serif; background:#f9f9f9; padding:20px;">
    <table width="100%" style="max-width:600px;margin:auto;background:#fff;border-radius:6px;border:1px solid #eee;">
      <tr>
        <td style="background:#cd8936;color:#fff;padding:16px;text-align:center;font-size:22px;font-weight:bold;">
          Nora Health
        </td>
      </tr>

      <tr>
        <td style="padding:20px 20px 0;font-size:18px;font-weight:bold;color:#333;">
          Welcome to Nora Health
        </td>
      </tr>

      <tr>
        <td style="padding:16px 20px 20px;font-size:15px;color:#333;line-height:1.6;">
          <p>Hello ${escapeHtml(greetingName)},</p>

          <p>
            Welcome to Nora Health — you have just joined the UK's simplest
            ordering service for contraception.
          </p>

          <p>
            Whether you need your regular supply, want to try a new pill or
            require urgent protection (morning after pill), we get it to you
            fast, discreetly and with zero hassle.
          </p>

          <p style="font-weight:bold;color:#cd8936;margin-top:24px;">
            Option 1: Order via WhatsApp (Recommended)
          </p>
          <p>
            We highly recommend using our WhatsApp service for the absolute
            fastest experience. Chat directly with our team instantly:<br/>
            👉 <a href="${whatsappLink}" target="_blank" rel="noopener noreferrer" style="${linkStyle}">Click here to order on WhatsApp</a>
            (or text us at 07440 126 154)
          </p>

          <p style="font-weight:bold;color:#cd8936;margin-top:24px;">
            Option 2: Order Online (Quick &amp; Easy)
          </p>
          <p>
            Prefer to use our website? You can safely submit your details and
            request your prescription through our secure online portal:<br/>
            👉 <a href="${orderOnlineLink}" target="_blank" rel="noopener noreferrer" style="${linkStyle}">Click here to order online at norahealth.co.uk</a>
          </p>

          <p style="font-weight:bold;margin-top:24px;">What you can order today:</p>
          <ul style="padding-left:20px;margin:0;">
            <li style="margin-bottom:6px;"><b>Regular repeat contraception:</b> Never run out of your daily pill.</li>
            <li style="margin-bottom:6px;"><b>New contraception:</b> Switch your method easily online or via chat.</li>
            <li style="margin-bottom:6px;"><b>Emergency contraception:</b> Quick, confidential access to the morning-after pill.</li>
          </ul>

          <p style="font-weight:bold;margin-top:24px;">Our Promise To You:</p>
          <ul style="padding-left:20px;margin:0;">
            <li style="margin-bottom:6px;"><b>Total flexibility:</b> Order online or straight through WhatsApp.</li>
            <li style="margin-bottom:6px;"><b>Fast &amp; reliable:</b> Secure Royal Mail 24-hour tracked delivery for next-day arrival.</li>
            <li style="margin-bottom:6px;"><b>Zero stress:</b> No long pharmacy queues or waiting for appointments.</li>
            <li style="margin-bottom:6px;"><b>Total transparency:</b> An online account to keep track of all of your orders.</li>
          </ul>

          <p style="margin-top:24px;">
            Ready to start? Tap the WhatsApp link below to say hello or visit our
            <a href="${orderOnlineLink}" target="_blank" rel="noopener noreferrer" style="${linkStyle}">website</a>
            to secure your next order.
          </p>
          <p>
            👉 <a href="${whatsappLink}" target="_blank" rel="noopener noreferrer" style="${linkStyle}">Chat with us on WhatsApp</a>
          </p>

          <p style="margin-top:16px;">
            Best health,<br/>
            The Nora Health Team<br/>
            <a href="${siteLink}" target="_blank" rel="noopener noreferrer" style="${linkStyle}">norahealth.co.uk</a>
          </p>
        </td>
      </tr>

      <tr>
        <td style="background:#f3f3f3;padding:12px;text-align:center;font-size:13px;color:#777;">
          © ${new Date().getFullYear()} Nora Health. All rights reserved.
        </td>
      </tr>
    </table>
  </div>
  `;

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
  return `${day} at ${t(s)} – ${t(e)}`;
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


export const orderEmailTemplate = ({
  firstName,
  customerName,
  phoneNumber,
  deliveryAddress,
  callDate,
  callTimeSlot,
}) => {
  const whatsappLink = "https://wa.me/447440126154";
  const supportEmail = "pharmacy.fap80@nhs.net";

  const name = escapeHtml(firstName || firstNameOf(customerName));
  const phone = escapeHtml(phoneNumber || "your registered number");
  const address = escapeHtml(deliveryAddress || "your delivery address");

  // "We will call you on 07-Aug during 10:00 – 11:00. The 1-hour slot simply
  // indicates when you may expect a call." Only shown when we have the slot.
  const date = escapeHtml(callDate || "");
  const slot = escapeHtml(callTimeSlot || "");
  const callLine = date
    ? `We will call you on <strong>${date}</strong>${
        slot ? ` during <strong>${slot}</strong>` : ""
      }. The 1-hour slot simply indicates when you may expect a call. `
    : "";

  return `
<div style="font-family: Arial, sans-serif; background:#f9f9f9; padding:20px;">
  <table width="100%" style="max-width:600px;margin:auto;background:#fff;border:1px solid #eee;border-radius:6px;">
    <tr>
      <td style="background:#cd8936;color:#fff;padding:16px;text-align:center;font-size:22px;font-weight:bold;">
        Nora Health
      </td>
    </tr>

    <tr>
      <td style="padding:20px 20px 0;font-size:18px;font-weight:bold;color:#333;">
        Order Confirmation
      </td>
    </tr>

    <tr>
      <td style="padding:16px 20px 20px;color:#333;font-size:15px;line-height:1.6;">
        <p>Hello ${name},</p>

        <p>Thank you for submitting your contraception request with Nora Health.</p>

        <p style="font-weight:bold;color:#cd8936;margin-top:20px;">Next Steps:</p>
        <p>
          Before we can approve your contraception request we need to complete a
          quick telephone call &mdash; usually only takes <strong>just 2&ndash;3 minutes</strong>.
          ${callLine}If there is a specific time that works best for you, feel
          free to tell us and we'll try our best to match it.
        </p>

        <p style="font-weight:bold;color:#cd8936;margin-top:20px;">Delivery:</p>
        <p>
          After your consultation we will post your medication to
          <strong>${address}</strong> in discreet packaging. Our service is
          completely free. If we complete the call before 1pm we can usually
          arrange for next day delivery using Royal Mail 24 Hour Tracked service.
        </p>

        <p style="font-weight:bold;color:#cd8936;margin-top:20px;">Getting in Touch:</p>
        <p>
          If you need to adjust your appointment or have any questions you may
          message us and/or call us directly on
          <a href="${whatsappLink}" target="_blank" rel="noopener noreferrer" style="color:#cd8936;text-decoration:underline;">
            WhatsApp
          </a>
          or email us at
          <a href="mailto:${supportEmail}" style="color:#cd8936;text-decoration:underline;">
            ${supportEmail}
          </a>. For anything urgent please call us directly via WhatsApp.
        </p>

        <p style="margin-top:16px;">
          Thank you &mdash; we look forward to speaking with you soon,<br/>
          Dev
        </p>
      </td>
    </tr>

    <tr>
      <td style="background:#f3f3f3;padding:12px;text-align:center;font-size:13px;color:#777;">
        © ${new Date().getFullYear()} Nora Health. All rights reserved.
      </td>
    </tr>
  </table>
</div>
`;
};



export const orderStatusEmailTemplate = ({
  customerName,
  firstName,
  orderId,
  status,
  trackingId,
  medicineName,
  deliveryAddress,
}) => {
  const name = escapeHtml(firstName || firstNameOf(customerName));
  const med = escapeHtml(medicineName || "");
  const tracking = escapeHtml(trackingId || "Pending");
  const address = escapeHtml(deliveryAddress || "your delivery address");

  const whatsappLink = "https://wa.me/447440126154";
  const emailAddress = "pharmacy.fap80@nhs.net";

  const s = String(status || "").toLowerCase();

  const queryLine = `
    <p style="margin:16px 0 0;color:#555;font-size:13px;">
      If you have any queries regarding your order please
      <a href="${whatsappLink}" target="_blank" rel="noopener noreferrer" style="color:#cd8936;text-decoration:underline;">
        click here
      </a>
      to message us on WhatsApp or send us an email on
      <a href="mailto:${emailAddress}" style="color:#cd8936;text-decoration:underline;">
        ${emailAddress}
      </a>.
    </p>`;

  let title = "Contraception Update";
  let inner;

  if (s === "declined") {
    title = "Contraception Request Declined";
    inner = `
      <p style="margin:0 0 12px;">Hi ${name},</p>
      <p style="margin:0 0 12px;">
        Your contraceptive request didn&#39;t pass our clinical safety checks so we
        haven&#39;t been able to post your medicines yet.
      </p>
      <p style="margin:0 0 12px;">
        When you have a moment, please get in touch with us &mdash; we just need a
        little more information to make sure everything is safe for you. You can
        call us,
        <a href="${whatsappLink}" target="_blank" rel="noopener noreferrer" style="color:#cd8936;text-decoration:underline;">message us on WhatsApp</a>,
        or email us at
        <a href="mailto:${emailAddress}" style="color:#cd8936;text-decoration:underline;">${emailAddress}</a>.
      </p>
      <p style="margin:0;">We&#39;ll do our very best to sort this out quickly for you.</p>
    `;
  } else if (s === "posted") {
    title = "Contraception Posted";
    inner = `
      <p style="margin:0 0 12px;">Hi ${name},</p>
      <p style="margin:0 0 12px;">
        Your contraceptive has been posted via Royal Mail tracked service.
      </p>
      ${queryLine}
      <p style="margin:16px 0 8px;font-weight:bold;">Order details:</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="font-size:15px;color:#333;">
        <tr>
          <td style="padding:6px 0;width:160px;font-weight:bold;color:#cd8936;">Contraceptive:</td>
          <td>#${med}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;font-weight:bold;color:#cd8936;">Delivery Address:</td>
          <td>${address}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;font-weight:bold;color:#cd8936;">Tracking ID:</td>
          <td>${tracking}</td>
        </tr>
      </table>
    `;
  } else {
    // clinicalreview -> Awaiting Dispatch (default)
    inner = `
      <p style="margin:0 0 12px;">Hi ${name},</p>
      <p style="margin:0 0 12px;">
        Your contraceptive request has been approved and is awaiting dispatch.
      </p>
      <p style="margin:16px 0 8px;font-weight:bold;">Order details:</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="font-size:15px;color:#333;">
        <tr>
          <td style="padding:6px 0;width:160px;font-weight:bold;color:#cd8936;">Oral Contraceptive:</td>
          <td>${med}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;font-weight:bold;color:#cd8936;">Status:</td>
          <td>${escapeHtml(getStatusLabel(status))}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;font-weight:bold;color:#cd8936;">Tracking ID:</td>
          <td>${tracking}</td>
        </tr>
      </table>
      ${queryLine}
    `;
  }

  return `
  <div style="font-family: Arial, sans-serif; background:#f9f9f9; padding:20px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:auto;background:#fff;border:1px solid #eee;border-radius:6px;overflow:hidden;">
      <tr>
        <td style="background:#cd8936;color:#fff;padding:16px;text-align:center;font-size:22px;font-weight:bold;">
          Nora Health
        </td>
      </tr>

      <tr>
        <td style="padding:20px 20px 0;font-size:18px;font-weight:bold;color:#333;">
          ${title}
        </td>
      </tr>

      <tr>
        <td style="padding:12px 20px 20px;font-size:15px;color:#333;line-height:1.5;">
          ${inner}
        </td>
      </tr>

      <tr>
        <td style="background:#f3f3f3;padding:12px;text-align:center;font-size:13px;color:#777;">
          © ${new Date().getFullYear()} Nora Health. All rights reserved.
        </td>
      </tr>
    </table>
  </div>
  `;
};


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
}) {
  const whatsappLink = "https://wa.me/447440126154";
  const whatsappNumber = "+44 7440126154";
  const supportEmail = "pharmacy.fap80@nhs.net";

  const html = `
  <div style="font-family: Arial, sans-serif; background:#f9f9f9; padding:20px;">
    <table width="100%" style="max-width:600px;margin:auto;background:#fff;border-radius:6px;border:1px solid #eee;">
      <tr>
        <td style="background:#cd8936;color:#fff;padding:16px;text-align:center;font-size:22px;font-weight:bold;">
          Nora Health
        </td>
      </tr>

      <tr>
        <td style="padding:20px;font-size:18px;font-weight:bold;color:#333;">
          Booking Confirmation
        </td>
      </tr>

      <tr>
        <td style="padding:0 20px 20px;font-size:15px;color:#333;">
          <p>Hi ${escapeHtml(fullName)},</p>

          <p>Your appointment has been successfully booked. Here are the details:</p>

          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding:6px 0;font-weight:bold;color:#cd8936;">Appointment:</td>
              <td>${formatAppointmentRange(appointment, appointmentEnd)}</td>
            </tr>
            ${
              notes
                ? `<tr>
                     <td style="padding:6px 0;font-weight:bold;color:#cd8936;">Notes:</td>
                     <td>${escapeHtml(notes)}</td>
                   </tr>`
                : ""
            }
          </table>

          <p style="font-size:13px;color:#555;">
            If you need to change or cancel your appointment, please
            <a href="${whatsappLink}" target="_blank" rel="noopener noreferrer" style="color:#cd8936;text-decoration:underline;">
              message us on WhatsApp
            </a>
            (${whatsappNumber}) or email us at
            <a href="mailto:${supportEmail}" style="color:#cd8936;text-decoration:underline;">
              ${supportEmail}
            </a>.
          </p>
        </td>
      </tr>

      <tr>
        <td style="background:#f3f3f3;padding:12px;text-align:center;font-size:13px;color:#777;">
          © ${new Date().getFullYear()} Nora Health. All rights reserved.
        </td>
      </tr>
    </table>
  </div>
  `;

  await resend.emails.send({
    from: "Nora Health <contact@norahealth.co.uk>",
    to,
    bcc: "pharmacy.fap80@nhs.net",
    subject: "Your Appointment Is Confirmed",
    replyTo: "contact@norahealth.co.uk",
    html,
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
    callDate = new Date(appointment)
      .toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        timeZone: "UTC", // stored UTC wall-clock == UK time the user picked
      })
      .replace(" ", "-"); // "15 Jul" -> "15-Jul"
    callTimeSlot = slotStartTime
      ? `${slotStartTime}${slotEndTime ? ` – ${slotEndTime}` : ""}`
      : "";
  }

  const html = orderEmailTemplate({
    firstName: firstName || firstNameOf(fullName),
    phoneNumber,
    deliveryAddress,
    callDate,
    callTimeSlot,
  });

  await resend.emails.send({
    from: "Nora Health <contact@norahealth.co.uk>",
    to,
    bcc: "pharmacy.fap80@nhs.net",
    subject: "Your Contraceptive Order Has Been Received",
    replyTo: "contact@norahealth.co.uk",
    html,
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



