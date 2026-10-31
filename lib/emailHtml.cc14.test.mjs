import { test } from "node:test";
import assert from "node:assert/strict";
import { orderStatusEmailHtml, statusEmailSubject, SUBJECTS } from "./emailHtml.js";

test("subjects per client list", () => {
  assert.equal(statusEmailSubject("declined", 1), "Contraception Request On Hold");
  assert.equal(statusEmailSubject("posted", 1), "Contraception Dispatched");
  assert.equal(statusEmailSubject("clinicalreview", 1), "Request Approved");
  assert.equal(statusEmailSubject("other", 7), "Order #7 status: other");
  assert.equal(SUBJECTS.welcome, "Welcome to Nora: NHS funded contraception");
  assert.equal(SUBJECTS.requestReceived, "Contraception Request Received");
});

test("on hold title, wording kept", () => {
  const h = orderStatusEmailHtml({ firstName: "Jane", status: "declined" });
  assert.match(h, /Contraception Request On Hold/);
  assert.doesNotMatch(h, /Declined/);
  assert.match(h, /We'll leave your request open/);
});

test("awaiting dispatch has WhatsApp, clinic call and email buttons", () => {
  const h = orderStatusEmailHtml({ firstName: "Jane", status: "clinicalreview", medicineName: "M" });
  assert.match(h, /Your order has been approved/);
  assert.match(h, /href="https:\/\/wa\.me\/447737984422"[^>]*>WhatsApp</);
  assert.match(h, /href="tel:02086797198"[^>]*>Call the clinic</);
  assert.match(h, /href="mailto:pharmacy\.fap80@nhs\.net"[^>]*>Email us</);
});
