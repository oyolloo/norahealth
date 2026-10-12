"use server";
import { prisma } from "@/lib/client/prisma";
import { getAdminUser } from "./admin.action";
import { RANGES, rangeWindow, summarise, toUk } from "@/lib/analytics";

const HOUR = 60 * 60 * 1000;

export async function getAnalyticsAction(range = "month") {
  const admin = await getAdminUser();
  if (!admin) return { success: false, msg: "Unauthorized. User is not admin" };
  if (!RANGES.includes(range)) range = "month";

  const ukNow = toUk(new Date());

  let firstUk = ukNow;
  if (range === "all") {
    const first = await prisma.booking.findFirst({
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    });
    if (first) firstUk = toUk(first.createdAt);
  }

  const win = rangeWindow(range, ukNow, firstUk);
  // UK-shifted times are at most 1h ahead of real UTC; pad the query by 2h.
  const from = new Date((win.prevStart || win.start).getTime() - 2 * HOUR);
  const where = range === "all" ? {} : { createdAt: { gte: from } };

  const [totalPatients, orderingPatients, requests, appointments, orders, signups] =
    await Promise.all([
      prisma.user.count({ where: { role: "PATIENT" } }),
      prisma.order.findMany({ distinct: ["userId"], select: { userId: true } }),
      prisma.booking.findMany({
        where: { ...where, bookingType: "Order" },
        select: { createdAt: true, ocRequest: true },
      }),
      prisma.booking.findMany({
        where: { ...where, bookingType: "Booking" },
        select: { createdAt: true },
      }),
      prisma.order.findMany({ where, select: { createdAt: true } }),
      prisma.user.findMany({
        where: { ...where, role: "PATIENT" },
        select: { createdAt: true },
      }),
    ]);

  const rows = (list, withTypes) =>
    list.map((r) => ({
      at: toUk(r.createdAt),
      types: withTypes ? r.ocRequest : undefined,
    }));

  return {
    success: true,
    range,
    totalPatients,
    patientsWithOrder: orderingPatients.length,
    requests: summarise(rows(requests, true), win),
    appointments: summarise(rows(appointments), win),
    orders: summarise(rows(orders), win),
    signups: summarise(rows(signups), win),
  };
}
