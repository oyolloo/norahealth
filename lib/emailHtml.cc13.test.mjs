import { test } from "node:test";
import assert from "node:assert/strict";
import { orderReceivedEmailHtml, bookingConfirmationEmailHtml, longCallDate } from "./emailHtml.js";

test("long call date", () => {
  assert.equal(longCallDate("2026-10-26T10:00:00.000Z"), "Monday 26th October");
  assert.equal(longCallDate("2026-10-01T10:00:00.000Z"), "Thursday 1st October");
  assert.equal(longCallDate("2026-10-22T10:00:00.000Z"), "Thursday 22nd October");
  assert.equal(longCallDate("2026-10-13T10:00:00.000Z"), "Tuesday 13th October");
});

for (const [name, html] of [
  ["order", orderReceivedEmailHtml({ firstName: "Jane", phoneNumber: "07700 900123", deliveryAddress: "1 High St", callDate: "Monday 26th October", callTimeSlot: "10:00 – 11:00" })],
  ["booking", bookingConfirmationEmailHtml({ fullName: "Jane Doe", appointmentText: "Monday 26th October 2026 at 10:00 – 11:00", phoneNumber: "07700 900123" })],
]) {
  test(`${name}: client review 25 Oct`, () => {
    assert.match(html, /Contact Number Provided/);
    assert.match(html, /07700 900123/);
    assert.doesNotMatch(html, /Delivery address|1 High St/);
    assert.doesNotMatch(html, /How long will the call take/);
    assert.doesNotMatch(html, />Delivery</);
    assert.match(html, /We\u2019ll call from 0208 679 7198\. We never use a private number/);
    assert.match(html, /keep your phone free for the full hour/);
    assert.match(html, /Your latest blood pressure reading \(home reading is sufficient\)/);
    assert.match(html, /There\u2019s no time limit on the call/);
    assert.match(html, /href="mailto:pharmacy\.fap80@nhs\.net"[^>]*>Email us</);
    assert.match(html, /href="https:\/\/wa\.me\/447737984422"[^>]*>WhatsApp</);
    assert.match(html, /class="h1-one">Your telephone appointment is confirmed/);
    assert.match(html, /<title>Your telephone appointment is confirmed<\/title>/);
    assert.doesNotMatch(html, /undefined|null/);
  });
}
