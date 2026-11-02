"use server";

import { prisma } from "@/lib/client/prisma";
import { revalidatePath } from "next/cache";
import { getAdminUser } from "./admin.action";
import { londonParts } from "@/lib/smsCore";
import { daysBetween, isDay, isTimeWindow } from "@/lib/futureAppt";

// Sets, changes or clears the Future Appt of one order (CC-10). Touches only
// the three futureAppt fields; status and everything else stay as they are.
export async function saveFutureApptAction(prevState, formData) {
  const admin = await getAdminUser();
  if (!admin?.admin?.isAdmin) return { success: false, msg: "Unauthorized." };

  const orderId = Number(formData.get("orderId"));
  if (!Number.isInteger(orderId)) return { success: false, msg: "Order not found." };
  const order = await prisma.order.findUnique({ where: { id: orderId }, select: { id: true, userId: true } });
  if (!order) return { success: false, msg: "Order not found." };

  if (formData.get("clear") === "1") {
    await prisma.order.update({
      where: { id: orderId },
      data: { futureApptAt: null, futureApptDays: null, futureApptTime: null },
    });
    revalidatePath(`/admin/${order.userId}/account`);
    return { success: true, msg: "Future appointment removed." };
  }

  const day = String(formData.get("day") || "");
  const time = String(formData.get("time") || "");
  const today = londonParts(new Date()).date;
  if (!isDay(day)) return { success: false, msg: "Pick a date." };
  if (day <= today) return { success: false, msg: "The date must be after today." };
  if (!isTimeWindow(time)) return { success: false, msg: "Pick a time." };

  await prisma.order.update({
    where: { id: orderId },
    data: {
      futureApptAt: new Date(`${day}T00:00:00Z`),
      futureApptDays: daysBetween(today, day),
      futureApptTime: time,
    },
  });
  revalidatePath(`/admin/${order.userId}/account`);
  return { success: true, msg: "Future appointment saved." };
}

// CC-16: every Future Appt from today on, for the admin Booking Slots calendar.
// Read only. Returns [{ day: "YYYY-MM-DD", time, orderId, userId, name, medicine }].
export async function getFutureApptsAction() {
  const admin = await getAdminUser();
  if (!admin?.admin?.isAdmin) return [];
  const today = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z");
  const rows = await prisma.order.findMany({
    where: { futureApptAt: { gte: today } },
    select: {
      id: true,
      userId: true,
      medicineName: true,
      futureApptAt: true,
      futureApptTime: true,
      user: { select: { email: true, account: { select: { firstName: true, lastName: true } } } },
    },
    orderBy: { futureApptAt: "asc" },
    take: 1000,
  });
  return rows.map((o) => ({
    day: o.futureApptAt.toISOString().slice(0, 10),
    time: o.futureApptTime || "",
    orderId: o.id,
    userId: o.userId,
    medicine: o.medicineName,
    name:
      [o.user?.account?.firstName, o.user?.account?.lastName].filter(Boolean).join(" ") ||
      o.user?.email ||
      `Order #${o.id}`,
  }));
}
