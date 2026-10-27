import { prisma } from "@/lib/client/prisma";
import { getSmsSettings } from "@/lib/smsSettings";
import { sendSms } from "@/lib/recallo24";
import {
  firstName,
  hourLabel,
  inDaytime,
  inWindow,
  londonParts,
  renderText,
  toE164Uk,
} from "@/lib/smsCore";

const HOUR = 3600_000;
const DAY = 24 * HOUR;

// Sends one SMS at most once per `key`. Every attempt, skip and failure is
// written to SmsLog so staff can see it on /admin/automations.
export async function sendOne(settings, { key, automation, phone, text, vars, userId, bookingId, sentBy }) {
  const to = toE164Uk(phone);
  const body = renderText(text, vars);
  const base = { key, automation, userId: userId ?? null, bookingId: bookingId ?? null, body, sentBy: sentBy ?? null };

  let skip = null;
  if (!to) skip = "Not a UK mobile number";
  else if (await prisma.smsOptOut.findUnique({ where: { phone: to } })) skip = "Number opted out";

  let row;
  try {
    row = await prisma.smsLog.create({
      data: { ...base, to: to || String(phone || ""), status: skip ? "skipped" : "sending", error: skip },
    });
  } catch (err) {
    if (err?.code === "P2002") return { status: "duplicate" };
    throw err;
  }
  if (skip) return { status: "skipped", error: skip };

  const res = await sendSms(settings.apiKey, {
    to,
    body,
    reference: key.slice(0, 100),
    idempotencyKey: `nora-${key}`.slice(0, 100),
  });
  const data = res.ok
    ? { status: "sent", recalloId: res.data?.id || null, error: null }
    : { status: "failed", error: res.error || "Send failed" };
  await prisma.smsLog.update({ where: { id: row.id }, data });
  return data;
}

async function hasBookingOrOrder(user) {
  if (user._count?.orders) return true;
  const n = await prisma.booking.count({
    where: { email: { equals: user.email, mode: "insensitive" } },
  });
  return n > 0;
}

function slotLabel(slot, joiner) {
  if (!slot?.startTime) return null;
  return `${hourLabel(slot.startTime)}${joiner}${hourLabel(slot.endTime)}`;
}

// Runs every automation that is due now. Called hourly by the cron route.
export async function runDueAutomations(now = new Date()) {
  const settings = await getSmsSettings();
  const result = { ran: [], sent: 0, skipped: 0, failed: 0 };
  if (!settings.enabled || !settings.apiKey) return { ...result, off: true };

  const { date, hour } = londonParts(now);
  const auto = Object.fromEntries(settings.automations.map((a) => [a.id, a]));
  const tally = (r) => {
    if (r.status === "sent") result.sent++;
    else if (r.status === "skipped") result.skipped++;
    else if (r.status === "failed") result.failed++;
  };
  // Only patients who signed up after automations were first switched on, so
  // switching on never texts the whole existing patient list.
  const startedAt = settings.startedAt || now;

  for (const [id, minAge, maxAge] of [
    ["1a", DAY, 3 * DAY],
    ["1b", 7 * DAY, 9 * DAY],
  ]) {
    const a = auto[id];
    if (!a?.enabled || !inDaytime(hour)) continue;
    result.ran.push(id);
    const from = new Date(Math.max(now - maxAge, startedAt.getTime()));
    const users = await prisma.user.findMany({
      where: {
        createdAt: { gte: from, lte: new Date(now - minAge) },
        OR: [{ role: "PATIENT" }, { role: null }],
        account: { isNot: null },
      },
      select: {
        id: true,
        email: true,
        account: { select: { firstName: true, phoneNumber: true } },
        _count: { select: { orders: true } },
      },
    });
    for (const u of users) {
      if (await prisma.smsLog.findUnique({ where: { key: `${id}:user:${u.id}` } })) continue;
      if (await hasBookingOrOrder(u)) continue;
      tally(
        await sendOne(settings, {
          key: `${id}:user:${u.id}`,
          automation: id,
          phone: u.account.phoneNumber,
          text: a.text,
          vars: { first_name: firstName(u.account.firstName) },
          userId: u.id,
          sentBy: "automation",
        })
      );
    }
  }

  // 2: appointment today.
  if (auto["2"]?.enabled && inWindow(hour, auto["2"].hour)) {
    result.ran.push("2");
    const bookings = await prisma.booking.findMany({
      where: {
        slot: { is: { slotDate: new Date(`${date}T00:00:00Z`) } },
        OR: [{ bookingStatus: null }, { bookingStatus: { notIn: ["Complete", "FailedEncounter"] } }],
      },
      select: { id: true, fullName: true, phoneNumber: true, slot: { select: { startTime: true, endTime: true } } },
    });
    for (const b of bookings) {
      tally(
        await sendOne(settings, {
          key: `2:booking:${b.id}:${date}`,
          automation: "2",
          phone: b.phoneNumber,
          text: auto["2"].text,
          vars: { first_name: firstName(b.fullName), time_frame: slotLabel(b.slot, " and ") },
          bookingId: b.id,
          sentBy: "automation",
        })
      );
    }
  }

  // 3: set to Failed Encounter today.
  if (auto["3"]?.enabled && inWindow(hour, auto["3"].hour)) {
    result.ran.push("3");
    const bookings = await prisma.booking.findMany({
      where: { bookingStatus: "FailedEncounter", statusChangedAt: { gte: new Date(now - 30 * HOUR) } },
      select: {
        id: true,
        fullName: true,
        phoneNumber: true,
        statusChangedAt: true,
        slot: { select: { startTime: true, endTime: true } },
      },
    });
    for (const b of bookings) {
      if (londonParts(b.statusChangedAt).date !== date) continue;
      const appt = slotLabel(b.slot, "-");
      if (!appt) continue;
      tally(
        await sendOne(settings, {
          key: `3:booking:${b.id}:${date}`,
          automation: "3",
          phone: b.phoneNumber,
          text: auto["3"].text,
          vars: { first_name: firstName(b.fullName), appt_time: appt },
          bookingId: b.id,
          sentBy: "automation",
        })
      );
    }
  }

  return result;
}
