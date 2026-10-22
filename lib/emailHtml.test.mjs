import { test } from "node:test";
import assert from "node:assert/strict";
import {
  welcomeEmailHtml,
  orderReceivedEmailHtml,
  orderStatusEmailHtml,
  bookingConfirmationEmailHtml,
  resetPasswordEmailHtml,
  calendarButtonsHtml,
  button,
} from "./emailHtml.js";

const all = () => [
  welcomeEmailHtml({ name: "Jane Doe" }),
  orderReceivedEmailHtml({ firstName: "Jane", deliveryAddress: "1 High St", callDate: "15-Oct", callTimeSlot: "10:00 – 11:00", calendarButtons: calendarButtonsHtml({ google: "https://g", ics: "https://i" }) }),
  orderStatusEmailHtml({ firstName: "Jane", status: "clinicalreview", medicineName: "Microgynon", trackingId: "" }),
  orderStatusEmailHtml({ firstName: "Jane", status: "posted", medicineName: "Microgynon", trackingId: "MZ1", deliveryAddress: "1 High St" }),
  orderStatusEmailHtml({ firstName: "Jane", status: "declined" }),
  bookingConfirmationEmailHtml({ fullName: "Jane Doe", appointmentText: "Thursday, 15 October 2026 at 10:00 – 11:00", whatsappNumber: "+44 7737 984422" }),
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
  const [welcome, order, awaiting, posted, declined, booking, reset] = all();
  assert.match(welcome, /images\/email\/morning-after-pill\.png/);
  assert.match(welcome, /How it works/);
  assert.match(welcome, /Total transparency:/);
  assert.match(order, /Your telephone appointment is confirmed/);
  assert.match(order, /15-Oct/);
  assert.match(order, /Add this appointment to your calendar/);
  assert.match(awaiting, /Your order has been approved/);
  assert.match(awaiting, /before 12noon/);
  assert.doesNotMatch(awaiting, /Tracking ID/);
  assert.match(posted, /MZ1/);
  assert.match(posted, /Track your parcel/);
  assert.match(posted, /tracking-results\/MZ1/);
  assert.match(declined, /Contraception Request Declined/);
  assert.match(booking, /Thursday, 15 October 2026 at 10:00 – 11:00/);
  assert.match(reset, /Questions about your account\?/);
  for (const html of all()) assert.match(html, /GPhC premises number: 1036683/);
});

test("order email without a call date uses the request title", () => {
  const html = orderReceivedEmailHtml({ firstName: "Jane" });
  assert.match(html, /We&#039;ve received your request|We've received your request/);
  assert.doesNotMatch(html, />Appointment</);
  assert.match(html, /your delivery address/);
});

test("posted email without tracking id has no track button", () => {
  const html = orderStatusEmailHtml({ firstName: "Jane", status: "posted", medicineName: "M" });
  assert.doesNotMatch(html, /Track your parcel/);
});

test("whatsapp links use the current number", () => {
  for (const html of all()) {
    assert.match(html, /wa\.me\/447737984422/);
    assert.doesNotMatch(html, /7440126154/);
  }
});

test("buttons are centred and welcome has both order pills", () => {
  const welcome = welcomeEmailHtml({ name: "Jane Doe" });
  assert.match(button("https://x", "Go"), /<table role="presentation"[^>]*align="center"/);
  assert.match(welcome, />Order on WhatsApp</);
  assert.match(welcome, />Order online</);
  assert.match(welcome, />Message us on WhatsApp</);
});
