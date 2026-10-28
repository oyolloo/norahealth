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
