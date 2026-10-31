"use server";
import bcrypt from "bcrypt";
import { prisma } from "@/lib/client/prisma";
import { FULL_ADDRESS_MSG, isFullAddress } from "@/lib/addressLookup";
import { createCalendarEvent } from "@/lib/googleCalendar";
import { revalidatePath } from "next/cache";
import { orderFromBookingEmailTemplate, sendBookingConfirmationEmail, sendOrderBookingConfirmationEmail } from "@/lib/emailTemplate";
import { statusEmailSubject } from "@/lib/emailHtml";
import { createRoyalMailOrder, isRoyalMailConfigured } from "@/lib/royalMail";
import { Resend } from "resend";
import { getAdminUser } from "./admin.action";

const resend = new Resend(process.env.RESEND_API_KEY);

function parseYMDtoDate(ymd) {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function combineDateTime(ymd, time) {
  const [y, m, d] = ymd.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  return new Date(Date.UTC(y, m - 1, d, hh, mm, 0, 0));
}

// assume each slot is 10 minutes like before
function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

/**
 * Race-safe slot booking. Locks the slot row (FOR UPDATE) so concurrent
 * bookers serialize; rejects once booked count reaches capacity.
 * maxCapacity null = legacy single-booking slot (capacity 1).
 * Throws "SLOT_NOT_FOUND" / "SLOT_FULL". Returns the created Booking.
 */
async function bookSlotWithCapacity(slotId, bookingData) {
  return prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw`
      SELECT id, "maxCapacity"
      FROM "BookingSlot"
      WHERE id = ${slotId}
      FOR UPDATE
    `;
    if (locked.length === 0) throw new Error("SLOT_NOT_FOUND");

    const capacity = locked[0].maxCapacity ?? 1;

    const current = await tx.booking.count({ where: { slotId } });
    if (current >= capacity) throw new Error("SLOT_FULL");

    const created = await tx.booking.create({
      data: { ...bookingData, slot: { connect: { id: slotId } } },
    });

    // flip isBooked when this booking fills the slot (back-compat flag)
    if (current + 1 >= capacity) {
      await tx.bookingSlot.update({
        where: { id: slotId },
        data: { isBooked: true },
      });
    }

    return created;
  });
}

export async function createBooking(formData) {
  try {
    if (!(formData instanceof FormData)) {
      return {
        success: false,
        msg: "Invalid form submission.",
        data: null,
      };
    }

    const fullName = formData.get("fullName")?.toString().trim();
    const email = formData.get("email")?.toString().trim();
    const phoneNumber = formData.get("phoneNumber")?.toString().trim();
    const notes = formData.get("notes")?.toString().trim() || null;

    const ocRequest = formData.get("ocRequest")?.toString(); // "SAME_OC" | "DIFFERENT_OC"
    const serviceName = formData.get("serviceName")?.toString().trim();
    const providerName = formData.get("providerName")?.toString().trim();
    const nhsService = formData.get("nhsService")?.toString().trim();

    const bookingdate = formData.get("bookingdate")?.toString(); // "YYYY-MM-DD"
    const bookingtime = formData.get("bookingtime")?.toString(); // "HH:MM"

    console.log(
      fullName,
      email,
      phoneNumber,
      serviceName,
      providerName,
      nhsService,
      bookingdate,
      bookingtime,
      "booking action",
    );

    if (
      !fullName ||
      !email ||
      !phoneNumber ||
      !serviceName ||
      !providerName ||
      !nhsService ||
      !bookingdate ||
      !bookingtime
    ) {
      return {
        success: false,
        msg: "Please fill in all required fields.",
        data: null,
      };
    }

    // if (!["SAME_OC", "DIFFERENT_OC"].includes(ocRequest)) {
    //   return {
    //     success: false,
    //     msg: "Invalid OC request value.",
    //     data: null,
    //   };
    // }

    const slotDate = parseYMDtoDate(bookingdate);
    const appointmentStart = combineDateTime(bookingdate, bookingtime);
    const appointmentEnd = addMinutes(appointmentStart, 60); // 1-hour slot

    const slot = await prisma.bookingSlot.findFirst({
      where: {
        slotDate,
        startTime: bookingtime,
      },
    });

    if (!slot) {
      return {
        success: false,
        msg: "Selected time is no longer available.",
        data: null,
      };
    }

    const bookingType = "Booking";

    // 🔒 race-safe capacity booking (max 6 per slot)
    let booking;
    try {
      booking = await bookSlotWithCapacity(slot.id, {
        fullName,
        email,
        phoneNumber,
        notes,
        bookingType,
        serviceName,
        providerName,
        nhsService,
        appointment: appointmentStart,
      });
    } catch (e) {
      if (e.message === "SLOT_FULL") {
        return { success: false, msg: "This time slot is full.", data: null };
      }
      if (e.message === "SLOT_NOT_FOUND") {
        return {
          success: false,
          msg: "Selected time is no longer available.",
          data: null,
        };
      }
      throw e;
    }

    const updatedSlot = { id: slot.id };

    // 👉 Try to create Google Calendar event, but don't break booking if it fails
    try {
      const calendarId = process.env.GOOGLE_CALENDAR_ID;

      if (calendarId) {
        const summary = `${serviceName} - ${fullName}`;
        const description = [
          `Provider: ${providerName}`,
          `NHS Service: ${nhsService}`,
          `Phone: ${phoneNumber}`,
          // `OC Request: ${ocRequest}`,
          notes ? `Notes: ${notes}` : null,
        ]
          .filter(Boolean)
          .join("\n");

        const res=await createCalendarEvent({
          calendarId,
          start: appointmentStart,
          end: appointmentEnd,
          summary,
          description,
          location: "Manor Chemist & Clinic, 341 Tamworth Ln, Mitcham CR4 1DL",
          email,
          name: fullName,
        });
        console.log("res calander", res);
        
      } else {
       console.warn("GOOGLE_CALENDAR_ID not set; skipping calendar event");
      }
    } catch (calendarError) {
      console.error("Failed to create Google Calendar event:", calendarError);
      console.error("Failed to create Google Calendar event:", calendarError);
  console.error("Error details:", calendarError.stack);
      // we don't fail the booking for this
    }

   try {
  await sendBookingConfirmationEmail({
    to: email,
    fullName,
    serviceName,
    providerName,
    nhsService,
    appointment: appointmentStart,
    appointmentEnd: appointmentEnd,
    notes,
    phoneNumber,
  });
} catch (emailError) {
  console.error("Booking confirmation email failed:", emailError);
  // booking should NOT fail because of email
}

    return {
      success: true,
      msg: "Booking created successfully.",
      data: {
        bookingId: booking.id,
        slotId: updatedSlot.id,
        appointment: appointmentStart,
      },
    };
  } catch (error) {
    // console.error("createBooking error:", error);
    return {
      success: false,
      msg: "Server error while creating booking.",
      data: error.message,
    };
  }
}
export async function createBookingOrder(formData) {
  try {
    if (!(formData instanceof FormData)) {
      return { success: false, msg: "Invalid form submission.", data: null };
    }

    const fullName = formData.get("fullName")?.toString().trim();
    const email = formData.get("email")?.toString().trim();
    const phoneNumber = formData.get("phoneNumber")?.toString().trim();
    const notes = formData.get("notes")?.toString().trim() || null;

    const OC_VALUES = ["SAME_OC", "DIFFERENT_OC", "MORNING_AFTER_PILL"];
    const ocRequest = [
      ...new Set(
        formData
          .getAll("ocRequest")
          .map((v) => v?.toString().trim().toUpperCase())
          .filter(Boolean)
      ),
    ];
    const appointmentRequest = formData.get("appointmentRequest") === "true";

    const serviceName = formData.get("serviceName")?.toString().trim();
    const providerName = formData.get("providerName")?.toString().trim();
    const nhsService = formData.get("nhsService")?.toString().trim();

    // Delivery details are now editable on the booking form (pre-filled from the
    // profile). We save any edits back to the user's account below.
    const deliveryAddressInput =
      formData.get("deliveryAddress")?.toString().trim() || "";
    const deliveryPostcodeInput =
      formData.get("deliveryPostcode")?.toString().trim() || "";

    const bookingdate = formData.get("bookingdate")?.toString(); // "YYYY-MM-DD"
    const bookingtime = formData.get("bookingtime")?.toString(); // "HH:MM"

    if (
      !fullName ||
      !email ||
      !phoneNumber ||
      !serviceName ||
      !providerName ||
      !nhsService
    ) {
      return {
        success: false,
        msg: "Please fill in all required fields.",
        data: null,
      };
    }

    if (deliveryAddressInput && !isFullAddress(deliveryAddressInput)) {
      return { success: false, msg: FULL_ADDRESS_MSG, data: null };
    }

    if (!bookingdate || !bookingtime) {
      return {
        success: false,
        msg: "Please select an appointment date and time.",
        data: null,
      };
    }

    if (
      ocRequest.length === 0 ||
      !ocRequest.every((v) => OC_VALUES.includes(v))
    ) {
      return { success: false, msg: "Invalid OC request value.", data: null };
    }

    // ✅ Find user (needed for Order.userId)
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, account: true },
    });

    // If orders must be tied to a user, stop here if user not found
    if (!user) {
      return {
        success: false,
        msg: "No account found with this email. Please login or use your registered email.",
        data: null,
      };
    }

    // Persist any delivery edits from the booking form back to the profile so
    // the confirmation email + Royal Mail dispatch use the address the patient
    // just entered. Only overwrite fields that were provided (never wipe).
    if (user.account && (deliveryAddressInput || deliveryPostcodeInput)) {
      const deliveryData = {};
      if (deliveryAddressInput)
        deliveryData.deliveryAddress = deliveryAddressInput;
      if (deliveryPostcodeInput)
        deliveryData.deliveryZipCode = deliveryPostcodeInput;
      try {
        await prisma.account.update({
          where: { userId: user.id },
          data: deliveryData,
        });
        user.account = { ...user.account, ...deliveryData };
      } catch (e) {
        console.error("Failed to save delivery details from booking:", e);
        // don't block the order for a delivery-save failure
      }
    }

    let recreatedOrder = null;

    // ✅ If SAME_OC -> recreate last order under clinicalreview
    // if (ocRequest === "SAME_OC") {
    //   const lastOrder = await prisma.order.findFirst({
    //     where: { userId: user.id },
    //     orderBy: { createdAt: "desc" },
    //     select: {
    //       id: true,
    //       medicineName: true,
    //     },
    //   });

    //   if (!lastOrder) {
    //     return {
    //       success: false,
    //       msg: "You have no previous order to repeat.",
    //       data: null,
    //     };
    //   }

    //   recreatedOrder = await prisma.order.create({
    //     data: {
    //       userId: user.id,
    //       medicineName: lastOrder.medicineName,
    //       trackingId: crypto.randomUUID(), // or your tracking generator
    //       status: "clinicalreview", // ✅ force review
    //     },
    //   });
    // }

    // ✅ resolve the selected 1-hour slot
    const slotDate = parseYMDtoDate(bookingdate);
    const appointmentStart = combineDateTime(bookingdate, bookingtime);

    const slot = await prisma.bookingSlot.findFirst({
      where: { slotDate, startTime: bookingtime },
    });

    if (!slot) {
      return {
        success: false,
        msg: "Selected time is no longer available.",
        data: null,
      };
    }

    const now = appointmentStart;
    const bookingType = "Order";

    // 🔒 race-safe capacity booking (max 6 per slot)
    let booking;
    try {
      booking = await bookSlotWithCapacity(slot.id, {
        fullName,
        email,
        phoneNumber,
        notes,
        ocRequest,
        appointmentRequest,
        serviceName,
        providerName,
        nhsService,
        appointment: appointmentStart,
        bookingType,
      });
    } catch (e) {
      if (e.message === "SLOT_FULL") {
        return { success: false, msg: "This time slot is full.", data: null };
      }
      if (e.message === "SLOT_NOT_FOUND") {
        return {
          success: false,
          msg: "Selected time is no longer available.",
          data: null,
        };
      }
      throw e;
    }


    // ✅ send confirmation email (non-blocking)
try {
  await sendOrderBookingConfirmationEmail({
    to: email,
    fullName,
    firstName: user.account?.firstName,
    phoneNumber: user.account?.phoneNumber || phoneNumber,
    serviceName,
    providerName,
    nhsService,
    ocRequest,
    appointmentRequest,
    appointment: appointmentStart,
    slotStartTime: slot.startTime,
    slotEndTime: slot.endTime,
    createdAt: booking.createdAt || now,
    deliveryAddress: user.account.deliveryAddress || user.account.address || "",
    notes,
  });
} catch (emailError) {
  console.error("Order booking confirmation email failed:", emailError);
}

    return {
      success: true,
      msg: "Contraceptive order placed successfully.",
      data: {
        bookingId: booking.id,
        recreatedOrderId: recreatedOrder?.id || null,
      },
    };
  } catch (error) {
    console.error("createBookingOrder error:", error);
    return {
      success: false,
      msg: "Server error while creating order.",
      data: error.message,
    };
  }
}


export async function getAllBookingsAction({ year, month, day } = {}) {
  let bookings = await prisma.booking.findMany({
    where: { bookingType: "Booking" },
    orderBy: { createdAt: "desc" }, // ✅ newest first
    include: {
      slot: true,
    },
  });

  const y = year ? Number(year) : null;
  const m = month ? Number(month) : null;
  const d = day ? Number(day) : null;

  bookings = bookings.filter((b) => {
    const dt = new Date(b.appointment);
    const by = dt.getFullYear();
    const bm = dt.getMonth() + 1;
    const bd = dt.getDate();

    if (y && m && d) return by === y && bm === m && bd === d;
    if (y && m && !d) return by === y && bm === m;
    if (y && !m && !d) return by === y;
    if (!y && m && !d) return bm === m;
    if (!y && !m && d) return bd === d;
    if (!y && m && d) return bm === m && bd === d;

    return true;
  });
   // emails from bookings
  const emails = [
    ...new Set(
      bookings
        .map((b) => (b.email || "").trim().toLowerCase())
        .filter(Boolean)
    ),
  ];

  const userMap = new Map(); // email -> {} or {id,email}

  if (emails.length) {
    const users = await prisma.user.findMany({
      where: { email: { in: emails } },
      select: {
        id: true,
        email: true,
        account: { select: { id: true } }, // account exists?
      },
    });

    for (const u of users) {
      userMap.set(
        u.email.toLowerCase(),
        u.account ? { id: u.id, email: u.email } : {}
      );
    }
  }

  // ✅ ensure EVERY booking has "user: {}" (even if no user found)
  const bookingsWithUser = bookings.map((b) => {
    const key = (b.email || "").trim().toLowerCase();
    return {
      ...b,
      user: userMap.get(key) ?? {}, // always {} default
    };
  });

  return { success: true, msg: "OK", bookings: bookingsWithUser };

  // return { success: true, msg: "OK", bookings };
}
export async function getAllBookingOrdersAction({ year, month, day } = {}) {
  let bookings = await prisma.booking.findMany({
    where: { bookingType: "Order" },
    orderBy: { createdAt: "desc" }, // ✅ newest first
  });

  const y = year ? Number(year) : null;
  const m = month ? Number(month) : null;
  const d = day ? Number(day) : null;

  bookings = bookings.filter((b) => {
    const dt = new Date(b.appointment);
    const by = dt.getFullYear();
    const bm = dt.getMonth() + 1;
    const bd = dt.getDate();

    if (y && m && d) return by === y && bm === m && bd === d;
    if (y && m && !d) return by === y && bm === m;
    if (y && !m && !d) return by === y;
    if (!y && m && !d) return bm === m;
    if (!y && !m && d) return bd === d;
    if (!y && m && d) return bm === m && bd === d;

    return true;
  });

  // return { success: true, msg: "OK", bookings };
   // emails from bookings
  const emails = [
    ...new Set(
      bookings
        .map((b) => (b.email || "").trim().toLowerCase())
        .filter(Boolean)
    ),
  ];

  const userMap = new Map(); // email -> {} or {id,email}

  if (emails.length) {
    const users = await prisma.user.findMany({
      where: { email: { in: emails } },
      select: {
        id: true,
        email: true,
        account: { select: { id: true } }, // account exists?
      },
    });

    for (const u of users) {
      userMap.set(
        u.email.toLowerCase(),
        u.account ? { id: u.id, email: u.email } : {}
      );
    }
  }

  // ✅ ensure EVERY booking has "user: {}" (even if no user found)
  const bookingsWithUser = bookings.map((b) => {
    const key = (b.email || "").trim().toLowerCase();
    return {
      ...b,
      user: userMap.get(key) ?? {}, // always {} default
    };
  });

  return { success: true, msg: "OK", bookings: bookingsWithUser };
}

/**
 * Delete booking (server action) — kept for table delete button usage.
 * Accepts FormData or { bookingId }.
 */
export const deleteBooking = async (formDataOrObj) => {
  let bookingId;
  if (formDataOrObj && typeof formDataOrObj.get === "function") {
    bookingId = formDataOrObj.get("bookingId");
  } else if (formDataOrObj && formDataOrObj.bookingId) {
    bookingId = formDataOrObj.bookingId;
  } else {
    return { success: false, msg: "No bookingId" };
  }

  const b = await prisma.booking.findUnique({
    where: { id: Number(bookingId) },
  });
  if (!b) return { success: false, msg: "Booking not found" };

  await prisma.booking.delete({ where: { id: Number(bookingId) } });

  if (b.slotId) {
    await prisma.bookingSlot.update({
      where: { id: b.slotId },
      data: { isBooked: false },
    });
  }

  // revalidate bookings page
  revalidatePath("/profile/bookings");

  // revalidate admin page
  revalidatePath("/admin/bookings");

  // revalidate admin page
  revalidatePath("/admin/appointments");

  return { success: true, msg: "Booking deleted" };
};

// export const createBookingSlots = async (formOrObj) => {
//   // allow FormData (from <form action={createBookingSlots}>) or plain object

//   let slotDate;
//   let ranges;
//   let intervalMinutes = 10;

//   if (formOrObj && typeof formOrObj.get === "function") {
//     // formData path
//     slotDate = formOrObj.get("slotDate"); // expected "YYYY-MM-DD"
//     const rangesJson = formOrObj.get("ranges"); // if you send ranges as JSON string
//     intervalMinutes = Number(formOrObj.get("intervalMinutes") || 10);
//     try {
//       ranges = rangesJson ? JSON.parse(rangesJson) : [];
//     } catch (e) {
//       ranges = [];
//     }
//   } else if (formOrObj) {
//     slotDate = formOrObj.slotDate;
//     ranges = formOrObj.ranges || [];
//     intervalMinutes = formOrObj.intervalMinutes || 10;
//   } else {
//     return { success: false, msg: "No input provided" };
//   }

//   if (!slotDate || !Array.isArray(ranges) || ranges.length === 0) {
//     return {
//       success: false,
//       msg: "Please provide a slotDate and at least one time range",
//     };
//   }

//   // simple time format checker HH:MM
//   const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

//   // function to convert "YYYY-MM-DD" + "HH:MM" into Date object (local)
//   const toDateTime = (dateStr, timeStr) => {
//     // dateStr: "YYYY-MM-DD", timeStr: "HH:MM"
//     const [y, mo, d] = dateStr.split("-").map(Number);
//     const [hh, mm] = timeStr.split(":").map(Number);
//     return new Date(y, mo - 1, d, hh, mm, 0, 0);
//   };

//   // Expand ranges into startTimes (HH:MM strings) for the given interval
//   const expandRangeToStarts = (startTime, endTime, interval) => {
//     // returns array of startTimes like "09:00", "09:10", ... where slot end is <= endTime
//     const arr = [];
//     const start = startTime;
//     const end = endTime;

//     // To compare, convert to minutes since midnight
//     const toMins = (t) => {
//       const [hh, mm] = t.split(":").map(Number);
//       return hh * 60 + mm;
//     };

//     const sMin = toMins(start);
//     const eMin = toMins(end);

//     if (sMin >= eMin) return arr; // invalid range

//     for (let t = sMin; t + interval <= eMin; t += interval) {
//       const hh = Math.floor(t / 60)
//         .toString()
//         .padStart(2, "0");
//       const mm = (t % 60).toString().padStart(2, "0");
//       arr.push(`${hh}:${mm}`);
//     }
//     return arr;
//   };

//   // collect all candidate startTimes (avoid duplicates in the candidate list)
//   const candidateSet = new Set();
//   for (const r of ranges) {
//     const s = (r.startTime || "").trim();
//     const e = (r.endTime || "").trim();
//     if (!timeRegex.test(s) || !timeRegex.test(e)) {
//       return {
//         success: false,
//         msg: `Invalid time format in range ${s} - ${e}`,
//       };
//     }
//     if (s >= e) {
//       return {
//         success: false,
//         msg: `startTime must be before endTime for range ${s} - ${e}`,
//       };
//     }

//     const starts = expandRangeToStarts(s, e, Number(intervalMinutes));
//     for (const st of starts) candidateSet.add(st);
//   }

//   const candidateStarts = Array.from(candidateSet).sort(); // sorted ascending

//   if (candidateStarts.length === 0) {
//     return {
//       success: false,
//       msg: "No slots generated from given ranges (check interval and range lengths)",
//     };
//   }

//   // Convert slotDate to Date object for comparison with DB
//   const slotDateObj = new Date(slotDate); // note: stored as Date with 00:00 time in DB per @db.Date
//   // We will query existing slots for that slotDate and those startTimes to avoid duplicates.

//   // Find existing slots for that date with overlapping startTimes
//   const existing = await prisma.bookingSlot.findMany({
//     where: {
//       slotDate: slotDateObj,
//       startTime: { in: candidateStarts },
//     },
//     select: { startTime: true },
//   });

//   const existingStartSet = new Set(existing.map((e) => e.startTime));

//   // filter out already existing starts
//   const toCreate = candidateStarts.filter((st) => !existingStartSet.has(st));

//   // prepare create payload
//   const createData = toCreate.map((st) => ({
//     slotDate: slotDateObj,
//     startTime: st,
//     // compute endTime by adding intervalMinutes to st
//     endTime: (() => {
//       const [hh, mm] = st.split(":").map(Number);
//       let total = hh * 60 + mm + Number(intervalMinutes);
//       const eh = Math.floor(total / 60)
//         .toString()
//         .padStart(2, "0");
//       const em = (total % 60).toString().padStart(2, "0");
//       return `${eh}:${em}`;
//     })(),
//     isBooked: false,
//   }));

//   let created = [];
//   if (createData.length > 0) {
//     // Use createMany for efficiency
//     // Prisma createMany doesn't return created rows; returns count
//     try {
//       await prisma.bookingSlot.createMany({
//         data: createData,
//         skipDuplicates: true, // skip if unique constraint exists (won't hurt if not)
//       });

//       // optionally fetch created rows for details (if you need them)
//       // But we can return counts summary
//     } catch (err) {
//       // fallback: attempt individual creates (rare)
//       for (const item of createData) {
//         try {
//           const c = await prisma.bookingSlot.create({ data: item });
//           created.push(c);
//         } catch (e) {
//           // skip on error
//         }
//       }
//     }
//   }

//   // Revalidate the page that lists slots (adjust path as needed)
//   revalidatePath("/admin/booking-slot");

//   return {
//     success: true,
//     msg: "Slots processed",
//     summary: {
//       candidateCount: candidateStarts.length,
//       existingCount: existingStartSet.size,
//       createdCount: createData.length,
//       createdStarts: createData.map((c) => c.startTime),
//       skippedStarts: Array.from(existingStartSet),
//     },
//   };
// };

export const createBookingSlots = async (formOrObj) => {
  // allow FormData (from <form action={createBookingSlots}>) or plain object

  let slotDate;
  let ranges;
  let intervalMinutes = 10;

  if (formOrObj && typeof formOrObj.get === "function") {
    // formData path
    slotDate = formOrObj.get("slotDate"); // expected "YYYY-MM-DD"
    const rangesJson = formOrObj.get("ranges"); // if you send ranges as JSON string
    intervalMinutes = Number(formOrObj.get("intervalMinutes") || 10);
    try {
      ranges = rangesJson ? JSON.parse(rangesJson) : [];
    } catch (e) {
      ranges = [];
    }
  } else if (formOrObj) {
    slotDate = formOrObj.slotDate;
    ranges = formOrObj.ranges || [];
    intervalMinutes = formOrObj.intervalMinutes || 10;
  } else {
    return { success: false, msg: "No input provided" };
  }

  // 🔒 fixed business rule: slots are always 1 hour, capacity 6
  intervalMinutes = 60;
  const SLOT_CAPACITY = 6;

  if (!slotDate || !Array.isArray(ranges) || ranges.length === 0) {
    return {
      success: false,
      msg: "Please provide a slotDate and at least one time range",
    };
  }

  // simple time format checker HH:MM
  const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

  // helper: convert "HH:MM" => minutes since midnight
  const toMins = (t) => {
    const [hh, mm] = t.split(":").map(Number);
    return hh * 60 + mm;
  };

  // helper: convert minutes => "HH:MM"
  const minsToHHMM = (m) => {
    const hh = Math.floor(m / 60)
      .toString()
      .padStart(2, "0");
    const mm = (m % 60).toString().padStart(2, "0");
    return `${hh}:${mm}`;
  };

  // Expand ranges into startTimes (HH:MM strings) for the given interval
  const expandRangeToStarts = (startTime, endTime, interval) => {
    const arr = [];
    const sMin = toMins(startTime);
    const eMin = toMins(endTime);

    if (sMin >= eMin) return arr; // invalid range

    for (let t = sMin; t + interval <= eMin; t += interval) {
      arr.push(minsToHHMM(t));
    }
    return arr;
  };

  // collect all candidate startTimes (avoid duplicates in the candidate list)
  const candidateSet = new Set();
  for (const r of ranges) {
    const s = (r.startTime || "").trim();
    const e = (r.endTime || "").trim();
    if (!timeRegex.test(s) || !timeRegex.test(e)) {
      return {
        success: false,
        msg: `Invalid time format in range ${s} - ${e}`,
      };
    }
    if (toMins(s) >= toMins(e)) {
      return {
        success: false,
        msg: `startTime must be before endTime for range ${s} - ${e}`,
      };
    }

    const starts = expandRangeToStarts(s, e, Number(intervalMinutes));
    for (const st of starts) candidateSet.add(st);
  }

  const candidateStarts = Array.from(candidateSet).sort(); // sorted ascending

  if (candidateStarts.length === 0) {
    return {
      success: false,
      msg: "No slots generated from given ranges (check interval and range lengths)",
    };
  }

  // Convert slotDate to Date object for comparison with DB
  const slotDateObj = new Date(slotDate); // note: stored as Date with 00:00 time in DB per @db.Date

  // Fetch ALL existing slots for that date (we will check overlap in JS).
  // This is simpler and correct for overlap detection; indexes on slotDate make this efficient.
  const existingSlots = await prisma.bookingSlot.findMany({
    where: {
      slotDate: slotDateObj,
    },
    select: { startTime: true, endTime: true },
  });

  // Build array of existing intervals in minutes
  const existingIntervals = existingSlots.map((s) => {
    return { s: toMins(s.startTime), e: toMins(s.endTime) };
  });

  // function to check overlap: returns true if [aStart, aEnd) overlaps [bStart, bEnd)
  const overlaps = (aStart, aEnd, bStart, bEnd) => {
    return aStart < bEnd && bStart < aEnd;
  };

  // Filter out candidate starts that overlap any existing interval
  const acceptedStarts = [];
  const skippedDueToOverlap = [];

  for (const st of candidateStarts) {
    const cStart = toMins(st);
    const cEnd = cStart + Number(intervalMinutes);

    // check overlap with any existing
    const conflict = existingIntervals.some((iv) =>
      overlaps(cStart, cEnd, iv.s, iv.e),
    );

    if (conflict) {
      skippedDueToOverlap.push(st);
      continue;
    }

    // Also check overlap with already acceptedStarts (defensive, in case ranges produced overlapping candidates)
    const conflictWithAccepted = acceptedStarts.some((as) => {
      const aStart = toMins(as);
      const aEnd = aStart + Number(intervalMinutes);
      return overlaps(cStart, cEnd, aStart, aEnd);
    });

    if (conflictWithAccepted) {
      skippedDueToOverlap.push(st);
      continue;
    }

    acceptedStarts.push(st);
  }

  if (acceptedStarts.length === 0) {
    // Nothing to create
    return {
      success: true,
      msg: "No new slots to create (all candidates overlap existing slots or duplicates).",
      summary: {
        candidateCount: candidateStarts.length,
        existingCount: existingSlots.length,
        createdCount: 0,
        createdStarts: [],
        skippedStarts: skippedDueToOverlap,
      },
    };
  }

  // prepare create payload for acceptedStarts
  const createData = acceptedStarts.map((st) => {
    const [hh, mm] = st.split(":").map(Number);
    let total = hh * 60 + mm + Number(intervalMinutes);
    const eh = Math.floor(total / 60)
      .toString()
      .padStart(2, "0");
    const em = (total % 60).toString().padStart(2, "0");
    return {
      slotDate: slotDateObj,
      startTime: st,
      endTime: `${eh}:${em}`,
      isBooked: false,
      maxCapacity: SLOT_CAPACITY, // 6 users per 1h slot
    };
  });

  let createdCount = 0;
  let createdStarts = [];

  if (createData.length > 0) {
    try {
      // createMany with skipDuplicates - but skipDuplicates only works for unique constraints; still efficient.
      await prisma.bookingSlot.createMany({
        data: createData,
        skipDuplicates: true,
      });

      createdCount = createData.length;
      createdStarts = createData.map((c) => c.startTime);
    } catch (err) {
      // fallback: attempt individual creates (rare)
      for (const item of createData) {
        try {
          const c = await prisma.bookingSlot.create({ data: item });
          createdCount += 1;
          createdStarts.push(c.startTime);
        } catch (e) {
          // skip on error
        }
      }
    }
  }

  // Revalidate the page that lists slots (adjust path as needed)
  revalidatePath("/admin/booking-slot");

  return {
    success: true,
    msg: "Slots processed",
    summary: {
      candidateCount: candidateStarts.length,
      existingCount: existingSlots.length,
      createdCount,
      createdStarts,
      skippedStarts: skippedDueToOverlap,
    },
  };
};

export async function createOrderFromBooking({
  bookingId,
  medicineName,
  trackingId,
  status,
}) {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      return { success: false, message: "Booking not found" };
    }

    // if (!trackingId || !String(trackingId).trim()) {
    //   return { success: false, message: "trackingId is required" };
    // }

    // ✅ required: medicineName (fallback: booking.serviceName)
    const finalMedicineName = String(medicineName).trim();

    if (!finalMedicineName) {
      return { success: false, message: "medicineName is required" };
    }

    // 1. Check user by email
    let user = await prisma.user.findUnique({
      where: { email: booking.email },
      include: { account: true },
    });
    const password = "nora123"; // default password for new users
    const hashedPassword = await bcrypt.hash(password, 10);
    // 2. If user does not exist → create user + account
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: booking.email,
          password: hashedPassword, // later reset flow
          role: "PATIENT",
          account: {
            create: {
              firstName: booking.fullName.split(" ")[0],
              lastName: booking.fullName.split(" ").slice(1).join(" "),
              phoneNumber: booking.phoneNumber,
              secondEmail: booking.email,
              dob: new Date("2000-01-01"),
              address: "N/A",
              zipCode: "N/A",
            },
          },
        },
        include: { account: true },
      });
    }

    // 3. Create order
    const order = await prisma.order.create({
      data: {
        medicineName: finalMedicineName,
        trackingId: String(trackingId).trim(),
        status: status || "clinicalreview",
        userId: user.id,
      },
    });

    // 📦 Auto-dispatch: when the order lands in "Awaiting Dispatch"
    // (clinicalreview) with no manual tracking, send it to Royal Mail and,
    // ONLY if a tracking number comes back, flip it to "Posted via Royal Mail".
    // If RM isn't configured, fails, or returns no tracking number, the order
    // safely stays in "Awaiting Dispatch" (nothing breaks).
    let finalStatus = order.status;
    let finalTracking = order.trackingId;
    if (
      order.status === "clinicalreview" &&
      !order.trackingId &&
      isRoyalMailConfigured()
    ) {
      try {
        const { trackingNumber } = await createRoyalMailOrder({
          order,
          customer: { email: booking.email, account: user.account },
        });
        if (trackingNumber) {
          const updated = await prisma.order.update({
            where: { id: order.id },
            data: { trackingId: trackingNumber, status: "posted" },
          });
          finalStatus = updated.status;
          finalTracking = updated.trackingId;
        }
      } catch (err) {
        console.error("Royal Mail auto-dispatch (createOrderFromBooking) failed:", err);
        // keep order as-is (Awaiting Dispatch)
      }
    }

    // 3️⃣ Send email (non-blocking)
    try {
      await resend.emails.send({
        from: "Nora Health <contact@norahealth.co.uk>",
        to: booking.email,
        subject: statusEmailSubject(finalStatus, order.id),
        replyTo: "contact@norahealth.co.uk",
        html: orderFromBookingEmailTemplate({
          fullName: booking.fullName,
          firstName: user.account?.firstName,
          medicineName: finalMedicineName,
          status: finalStatus,
          trackingId: finalTracking,
          deliveryAddress:
            user.account?.deliveryAddress || user.account?.address,
        }),
      });
    } catch (emailErr) {
      console.error("Order-from-booking email failed:", emailErr);
    }

    revalidatePath("/admin/appointments");
    return { success: true, msg: "Order created successfully" };
  } catch (err) {
    console.error(err);
    return { success: false, msg: "Server error" };
  }
}

export async function updateBookingStatus(formDataOrObj) {
  try {
    let bookingId;
    let bookingStatus;

    // support: FormData OR plain object
    if (formDataOrObj && typeof formDataOrObj.get === "function") {
      bookingId = formDataOrObj.get("bookingId");
      bookingStatus = formDataOrObj.get("bookingStatus");
    } else if (formDataOrObj) {
      bookingId = formDataOrObj.bookingId;
      bookingStatus = formDataOrObj.bookingStatus;
    }

    const idNum = Number(bookingId);
    if (!idNum) return { success: false, msg: "Invalid bookingId" };

    if (!bookingStatus)
      return { success: false, msg: "bookingStatus required" };

    // ✅ validate enum values
    if (
      ![
        "Incomplete",
        "FirstCallAttempted",
        "SecondCallAttempted",
        "Complete",
        "FailedEncounter",
      ].includes(String(bookingStatus))
    ) {
      return { success: false, msg: "Invalid bookingStatus" };
    }

    // update
    const updated = await prisma.booking.update({
      where: { id: idNum },
      data: { bookingStatus: String(bookingStatus) },
      select: { id: true, bookingStatus: true, bookingType: true },
    });

    // CC-9: remember when the status changed (failed-encounter SMS). Separate
    // and guarded so a missing column can never break the status update.
    await prisma.booking
      .update({ where: { id: idNum }, data: { statusChangedAt: new Date() } })
      .catch((err) => console.error("statusChangedAt not saved:", err?.message));

    // ✅ revalidate (adjust your routes)
    revalidatePath("/admin/appointments"); // Booking list
    revalidatePath("/admin/appointments-order"); // if you have this route
    revalidatePath(`/admin/appointments-order/${updated.id}`); // details page (optional)

    return {
      success: true,
      msg: "Booking status updated",
      data: updated,
    };
  } catch (err) {
    console.error("updateBookingStatus:", err);
    return { success: false, msg: "Server error" };
  }
}


export async function getPatientAppointmentsAction(userId) {
  // getAdminUser() returns null for anyone who is not ADMIN/SUPERADMIN.
  const admin = await getAdminUser();
  if (!admin) {
    return { success: false, msg: "Unauthorized. User is not admin" };
  }

  const id = Number(userId);
  if (!Number.isInteger(id)) return { success: false, msg: "Patient not found" };

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      account: { select: { firstName: true, lastName: true, dob: true } },
    },
  });
  if (!user) return { success: false, msg: "Patient not found" };

  // Bookings carry no userId; they belong to a patient only through email.
  const bookings = await prisma.booking.findMany({
    where: { email: { equals: user.email, mode: "insensitive" } },
    orderBy: { appointment: "desc" },
    select: {
      id: true,
      appointment: true,
      phoneNumber: true,
      ocRequest: true,
      bookingStatus: true,
      bookingType: true,
      slot: { select: { startTime: true, endTime: true } },
    },
  });

  return { success: true, user, bookings };
}
