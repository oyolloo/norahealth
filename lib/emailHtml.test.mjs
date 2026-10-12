import { test } from "node:test";
import assert from "node:assert/strict";
import {
  welcomeEmailHtml,
  orderReceivedEmailHtml,
  orderStatusEmailHtml,
  bookingConfirmationEmailHtml,
  resetPasswordEmailHtml,
  calendarButtonsHtml,
} from "./emailHtml.js";

const all = () => [
  welcomeEmailHtml({ name: "Jane Doe" }),
  orderReceivedEmailHtml({ firstName: "Jane", deliveryAddress: "1 High St", callDate: "15-Oct", callTimeSlot: "10:00 – 11:00", calendarButtons: calendarButtonsHtml({ google: "https://g", ics: "https://i" }) }),
  orderStatusEmailHtml({ firstName: "Jane", status: "clinicalreview", medicineName: "Microgynon", trackingId: "" }),
  orderStatusEmailHtml({ firstName: "Jane", status: "posted", medicineName: "Microgynon", trackingId: "MZ1", deliveryAddress: "1 High St" }),
  orderStatusEmailHtml({ firstName: "Jane", status: "declined" }),
  bookingConfirmationEmailHtml({ fullName: "Jane Doe", appointmentText: "Thursday, 15 October 2026 at 10:00 – 11:00", whatsappNumber: "+44 7440126154" }),
  resetPasswordEmailHtml({ resetUrl: "https://www.norahealth.co.uk/reset-password?token=abc" }),
];

test("every email is a full document with logo and footer and no undefined", () => {
  for (const html of all()) {
    assert.match(html, /^<!doctype html>/);
    assert.match(html, /email-logo\.png/);
    assert.match(html, /All rights reserved/);
    assert.doesNotMatch(html, /undefined|null/);
  }
});

test("patient-supplied text is escaped", () => {
  const html = orderStatusEmailHtml({
    firstName: "<script>x</script>",
    status: "posted",
    medicineName: "<b>pill</b>",
    deliveryAddress: "\"onclick=\"",
  });
  assert.doesNotMatch(html, /<script>|<b>pill/);
  assert.match(html, /&lt;script&gt;/);
  const b = bookingConfirmationEmailHtml({ fullName: "<i>A</i>", appointmentText: "x", notes: "<img src=x>", whatsappNumber: "1" });
  assert.doesNotMatch(b, /<i>A<\/i>|<img src=x>/);
});

test("client copy and key details are kept", () => {
  const [welcome, order, awaiting, posted, declined, booking] = all();
  assert.match(welcome, /Option 1: Order via WhatsApp \(Recommended\)/);
  assert.match(welcome, /Click here to order on WhatsApp/);
  assert.match(order, /We will call you on <strong>15-Oct<\/strong> during <strong>10:00 – 11:00<\/strong>/);
  assert.match(order, /You can add this appointment to your calendar/);
  assert.match(awaiting, /approved and is awaiting dispatch/);
  assert.match(awaiting, /Awaiting Dispatch/);
  assert.match(awaiting, /Pending/);
  assert.match(posted, /MZ1/);
  assert.doesNotMatch(posted, /#Microgynon/);
  assert.match(declined, /didn&#39;t pass our clinical safety checks/);
  assert.match(booking, /Thursday, 15 October 2026 at 10:00 – 11:00/);
});

test("order email without a call date skips the call card and line", () => {
  const html = orderReceivedEmailHtml({ firstName: "Jane" });
  assert.doesNotMatch(html, /Telephone appointment|We will call you on/);
  assert.match(html, /your delivery address/);
});
