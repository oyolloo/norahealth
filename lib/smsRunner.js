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
import { addDays, timeFrameText } from "@/lib/futureAppt";
import { generateBpToken } from "@/lib/bpToken";

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
    const since = Math.max(startedAt.getTime(), (a.since || now).getTime());
    const from = new Date(Math.max(now - maxAge, since));
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
      const timeFrame = slotLabel(b.slot, " and ");
      if (!timeFrame) continue;
      // One reminder per phone per day, even with two bookings today.
      const to = toE164Uk(b.phoneNumber) || `booking${b.id}`;
      tally(
        await sendOne(settings, {
          key: `2:${to}:${date}`,
          automation: "2",
          phone: b.phoneNumber,
          text: auto["2"].text,
          vars: { first_name: firstName(b.fullName), time_frame: timeFrame },
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
          // Once per booking: re-saving the status later never texts again.
          key: `3:booking:${b.id}`,
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

  // 4a: Future Appt today (CC-10).
  if (auto["4a"]?.enabled && inWindow(hour, auto["4a"].hour)) {
    result.ran.push("4a");
    const apptDay = addDays(date, 0);
    const orders = await prisma.order.findMany({
      where: { futureApptAt: new Date(`${apptDay}T00:00:00Z`) },
      select: {
        id: true,
        userId: true,
        futureApptTime: true,
        user: { select: { account: { select: { firstName: true, phoneNumber: true } } } },
      },
    });
    for (const o of orders) {
      const acc = o.user?.account;
      if (!acc?.phoneNumber) continue;
      const timeFrame = timeFrameText(o.futureApptTime);
      if (!timeFrame) continue;
      tally(
        await sendOne(settings, {
          key: `4a:order:${o.id}:${apptDay}`,
          automation: "4a",
          phone: acc.phoneNumber,
          text: auto["4a"].text,
          vars: { first_name: firstName(acc.firstName), time_frame: timeFrame },
          userId: o.userId,
          sentBy: "automation",
        })
      );
    }
  }

  // 4b: OC review 28 days from today for non-BP orders.
  // 4b_bp: Blood pressure SMS 28 days from today for Type B medicine orders.
  const apptDay28 = addDays(date, 28);
  const run4b = auto["4b"]?.enabled && inWindow(hour, auto["4b"].hour);
  const run4bBp = auto["4b_bp"]?.enabled && inWindow(hour, auto["4b_bp"].hour);

  if (run4b || run4bBp) {
    if (run4b) result.ran.push("4b");
    if (run4bBp) result.ran.push("4b_bp");

    const orders = await prisma.order.findMany({
      where: { futureApptAt: new Date(`${apptDay28}T00:00:00Z`) },
      select: {
        id: true,
        userId: true,
        needsBpCheck: true,
        user: { select: { account: { select: { firstName: true, phoneNumber: true } } } },
      },
    });

    for (const o of orders) {
      const acc = o.user?.account;
      if (!acc?.phoneNumber) continue;

      // BP patients get the BP request instead of 4b while 4b_bp is switched
      // on; if 4b_bp is off they still get the normal 4b reminder.
      const bpOn = Boolean(auto["4b_bp"]?.enabled);
      if (o.needsBpCheck && bpOn && run4bBp) {
        // One reading request per review date, so a later review gets its own link.
        const reviewDate = new Date(`${apptDay28}T00:00:00Z`);
        let bp = await prisma.bpReading.findFirst({
          where: { orderId: o.id, reviewDate },
          select: { token: true },
        });
        if (!bp) {
          const token = generateBpToken(8);
          bp = await prisma.bpReading.create({
            data: {
              token,
              userId: o.userId,
              orderId: o.id,
              reviewDate,
              // Link works until the end of the review day.
              expiresAt: new Date(`${addDays(apptDay28, 1)}T00:00:00Z`),
              status: "pending",
            },
            select: { token: true },
          });
        }
        // Same link for everyone; the page asks for DOB + mobile (client, 4 Nov).
        const link = "norahealth.co.uk/bp/health";
        tally(
          await sendOne(settings, {
            key: `4b_bp:order:${o.id}:${apptDay28}`,
            automation: "4b_bp",
            phone: acc.phoneNumber,
            text: auto["4b_bp"].text,
            vars: { first_name: firstName(acc.firstName), link },
            userId: o.userId,
            sentBy: "automation",
          })
        );
      } else if (run4b && !(o.needsBpCheck && bpOn)) {
        tally(
          await sendOne(settings, {
            key: `4b:order:${o.id}:${apptDay28}`,
            automation: "4b",
            phone: acc.phoneNumber,
            text: auto["4b"].text,
            vars: { first_name: firstName(acc.firstName) },
            userId: o.userId,
            sentBy: "automation",
          })
        );
      }
    }
  }

  return result;
}
