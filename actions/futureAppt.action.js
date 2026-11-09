"use server";

import { prisma } from "@/lib/client/prisma";
import { revalidatePath } from "next/cache";
import { getAdminUser } from "./admin.action";
import { londonParts } from "@/lib/smsCore";
import { TIME_WINDOWS, daysBetween, futureApptDateTime, isDay, isTimeWindow, parseTimeWindowHour, reviewsByHour, slotHour } from "@/lib/futureAppt";

// Sets, changes or clears the Future Appt of one order (CC-10). Touches only
// the three futureAppt fields and keeps the linked review Booking in step.
export async function saveFutureApptAction(prevState, formData) {
  const admin = await getAdminUser();
  if (!admin?.admin?.isAdmin) return { success: false, msg: "Unauthorized." };

  const orderId = Number(formData.get("orderId"));
  if (!Number.isInteger(orderId)) return { success: false, msg: "Order not found." };
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      userId: true,
      medicineName: true,
      user: {
        select: {
          email: true,
          account: {
            select: {
              firstName: true,
              lastName: true,
              phoneNumber: true,
            },
          },
        },
      },
    },
  });
  if (!order) return { success: false, msg: "Order not found." };

  if (formData.get("clear") === "1") {
    await prisma.$transaction([
      prisma.order.update({
        where: { id: orderId },
        data: { futureApptAt: null, futureApptDays: null, futureApptTime: null, needsBpCheck: false },
      }),
      prisma.booking.deleteMany({
        where: { orderId: orderId, bookingType: "Review" },
      }),
    ]);
    revalidatePath(`/admin/${order.userId}/account`);
    revalidatePath(`/admin/${order.userId}/appointments`);
    revalidatePath("/admin/oc-orders");
    revalidatePath("/admin/appointments");
    return { success: true, msg: "Future appointment removed." };
  }

  const day = String(formData.get("day") || "");
  const time = String(formData.get("time") || "");
  const needsBpCheck = formData.get("needsBpCheck") === "1";
  const today = londonParts(new Date()).date;
  if (!isDay(day)) return { success: false, msg: "Pick a date." };
  if (day <= today) return { success: false, msg: "The date must be after today." };
  if (!isTimeWindow(time)) return { success: false, msg: "Pick a time." };

  const appointmentDate = futureApptDateTime(day, time);
  const fullName = [order.user?.account?.firstName, order.user?.account?.lastName]
    .filter(Boolean)
    .join(" ")
    .trim() || "Patient";
  const email = order.user?.email || "";
  const phoneNumber = order.user?.account?.phoneNumber || "";

  const existingReview = await prisma.booking.findFirst({
    where: { orderId: orderId, bookingType: "Review" },
    select: { id: true },
  });

  await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: orderId },
      data: {
        futureApptAt: new Date(`${day}T00:00:00Z`),
        futureApptDays: daysBetween(today, day),
        futureApptTime: time,
        needsBpCheck,
      },
    });

    if (existingReview) {
      await tx.booking.update({
        where: { id: existingReview.id },
        data: {
          appointment: appointmentDate,
          fullName,
          email,
          phoneNumber,
          notes: `Review: ${time} (${order.medicineName})`,
        },
      });
    } else {
      await tx.booking.create({
        data: {
          orderId: order.id,
          bookingType: "Review",
          ocRequest: [], // required column; a review has no OC request
          bookingStatus: "Incomplete",
          slotId: null,
          appointment: appointmentDate,
          fullName,
          email,
          phoneNumber,
          serviceName: "Oral Contraception Review",
          providerName: "Nora Health",
          nhsService: "Free NHS",
          notes: `Review: ${time} (${order.medicineName})`,
        },
      });
    }
  });

  revalidatePath(`/admin/${order.userId}/account`);
  revalidatePath(`/admin/${order.userId}/appointments`);
  revalidatePath("/admin/oc-orders");
  revalidatePath("/admin/appointments");
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

// CC-27: how full each review hour is on one day, for the time picker.
// Counts slot bookings plus other reviews on that day (the order being edited
// is left out, so its own review never blocks itself). Read only.
// Returns [{ value, hour, capacity (null = no slot that hour), booked }].
export async function getDayLoadAction(day, excludeOrderId) {
  const admin = await getAdminUser();
  if (!admin?.admin?.isAdmin || !isDay(day)) return [];
  const date = new Date(`${day}T00:00:00Z`);
  const skip = Number(excludeOrderId) || 0;
  const [slots, reviews] = await Promise.all([
    prisma.bookingSlot.findMany({
      where: { slotDate: date },
      select: { startTime: true, maxCapacity: true, _count: { select: { bookings: true } } },
    }),
    prisma.order.findMany({
      where: { futureApptAt: date, ...(skip ? { id: { not: skip } } : {}) },
      select: { futureApptTime: true },
    }),
  ]);
  const byHour = reviewsByHour(reviews.map((r) => ({ time: r.futureApptTime })));
  return TIME_WINDOWS.map((w) => {
    const hour = parseTimeWindowHour(w.value);
    const slot = slots.find((s) => slotHour(s.startTime) === hour);
    return {
      value: w.value,
      hour,
      capacity: slot ? slot.maxCapacity ?? 1 : null,
      booked: (slot?._count.bookings || 0) + (byHour[hour] || 0),
    };
  });
}
