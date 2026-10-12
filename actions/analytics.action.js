"use server";
import { prisma } from "@/lib/client/prisma";
import { getAdminUser } from "./admin.action";
import { countOrderRequests, periodStarts } from "@/lib/analytics";

export async function getAnalyticsAction() {
  const admin = await getAdminUser();
  if (!admin) return { success: false, msg: "Unauthorized. User is not admin" };

  const now = new Date();
  const starts = periodStarts(now);
  const since = new Date(
    Math.min(starts.week.getTime(), starts.month.getTime())
  );

  const [totalPatients, orderingPatients, totalRequests, requests, orders] =
    await Promise.all([
      prisma.user.count({ where: { role: "PATIENT" } }),
      prisma.order.findMany({ distinct: ["userId"], select: { userId: true } }),
      prisma.booking.count({ where: { bookingType: "Order" } }),
      prisma.booking.findMany({
        where: { bookingType: "Order", createdAt: { gte: since } },
        select: { createdAt: true, ocRequest: true },
      }),
      prisma.order.findMany({
        where: { createdAt: { gte: since } },
        select: { createdAt: true },
      }),
    ]);

  const medicineOrders = {};
  for (const [period, start] of Object.entries(starts)) {
    medicineOrders[period] = orders.filter(
      (o) => new Date(o.createdAt) >= start
    ).length;
  }

  return {
    success: true,
    totalPatients,
    patientsWithOrder: orderingPatients.length,
    totalRequests,
    requests: countOrderRequests(requests, now),
    medicineOrders,
  };
}
