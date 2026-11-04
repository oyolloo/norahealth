"use server";

import { prisma } from "@/lib/client/prisma";
import { revalidatePath } from "next/cache";
import { getAdminUser } from "./admin.action";

/* ------------------ helpers ------------------ */
const isWeekendYMD = (ymd) => {
  const [y, m, d] = String(ymd).split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const day = dt.getUTCDay(); // 0=Sun, 6=Sat
  return day === 0 || day === 6;
};

const ymdToUTCDate = (ymd) => {
  const [y, m, d] = String(ymd).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
};

const dateToYMDUTC = (dateUTC) => {
  const y = dateUTC.getUTCFullYear();
  const m = String(dateUTC.getUTCMonth() + 1).padStart(2, "0");
  const d = String(dateUTC.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const timeToMinutes = (t) => {
  const [h, m] = String(t).split(":").map(Number);
  return h * 60 + m;
};

const minutesToTime = (mins) => {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

const roundUpToInterval = (mins, interval) =>
  Math.ceil(mins / interval) * interval;

function buildSlotsForOneDay({ ymd, ranges, intervalMinutes }) {
  const slots = [];
  const slotDateUTC = ymdToUTCDate(ymd);

  for (const r of ranges || []) {
    const startTime = r.startTime;
    const endTime = r.endTime;

    if (!startTime || !endTime) continue;

    let startMin = timeToMinutes(startTime);
    let endMin = timeToMinutes(endTime);

    // allow "00:00" to mean end-of-day
    if (endTime === "00:00" && startTime !== "00:00") endMin = 24 * 60;

    if (endMin <= startMin) continue;

    let current = roundUpToInterval(startMin, intervalMinutes);

    while (current + intervalMinutes <= endMin) {
      slots.push({
        slotDate: slotDateUTC,
        startTime: minutesToTime(current),
        endTime: minutesToTime(current + intervalMinutes),
        isBooked: false,
      });
      current += intervalMinutes;
    }
  }

  return slots;
}

// For reading (client sends "YYYY-MM-DD")
function parseYMDtoDate(ymd) {
  // "2025-12-06" -> Date(2025-12-06T00:00:00.000Z)
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

// For creating (admin form sends "DD-MM-YYYY")
function parseDMYtoDate(dmy) {
  // "12-12-2025" -> Date(2025-12-12T00:00:00.000Z)
  const [d, m, y] = dmy.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

// function timeToMinutes(time) {
//   const [h, m] = time.split(":").map(Number);
//   return h * 60 + m;
// }

// function minutesToTime(mins) {
//   const h = Math.floor(mins / 60) % 24;
//   const m = mins % 60;
//   return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
// }

function roundUpToNext10(mins) {
  return Math.ceil(mins / 10) * 10;
}

/* ---------------- main action ---------------- */
/**
 * payload supports:
 *  - single day: { slotDate: "YYYY-MM-DD", ranges: [{startTime,endTime}], intervalMinutes, skipWeekends }
 *  - bulk days : { startDate:"YYYY-MM-DD", endDate:"YYYY-MM-DD", ranges, intervalMinutes, skipWeekends }
 */
export async function createBookingSlots(payload) {
  try {
    const {
      slotDate,
      startDate,
      endDate,
      ranges = [],
      intervalMinutes = 10,
      skipWeekends = true,
    } = payload || {};

    const interval = Math.max(1, Number(intervalMinutes) || 10);

    // -------- determine mode --------
    const isBulk = !!startDate && !!endDate;

    if (!isBulk && !slotDate) {
      return {
        success: false,
        msg: "slotDate or (startDate,endDate) is required.",
      };
    }

    // -------- build candidate dates --------
    let dates = [];

    if (isBulk) {
      const start = ymdToUTCDate(startDate);
      const end = ymdToUTCDate(endDate);

      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        return { success: false, msg: "Invalid startDate/endDate format." };
      }

      if (start > end) {
        return { success: false, msg: "startDate must be <= endDate." };
      }

      // limit days to prevent huge insert
      const MAX_DAYS = 366;
      let cur = new Date(start);
      let count = 0;

      while (cur <= end) {
        dates.push(dateToYMDUTC(cur));
        cur.setUTCDate(cur.getUTCDate() + 1);
        count++;
        if (count > MAX_DAYS) {
          return { success: false, msg: "Too many days selected (max 366)." };
        }
      }
    } else {
      dates = [slotDate];
    }

    // -------- skip weekends (server-side enforce) --------
    const before = dates.length;
    if (skipWeekends) {
      dates = dates.filter((d) => !isWeekendYMD(d));
    }
    const skippedWeekendDates = before - dates.length;

    if (!dates.length) {
      return {
        success: false,
        msg: "No valid dates to create slots (weekends skipped).",
      };
    }

    // -------- build all slots --------
    let allSlots = [];
    for (const d of dates) {
      allSlots.push(
        ...buildSlotsForOneDay({
          ymd: d,
          ranges,
          intervalMinutes: interval,
        })
      );
    }

    if (!allSlots.length) {
      return { success: false, msg: "No valid time slots generated." };
    }

    // -------- insert --------
    const result = await prisma.bookingSlot.createMany({
      data: allSlots,
      skipDuplicates: true, // ✅ works because of @@unique
    });

    const candidateCount = allSlots.length;
    const createdCount = result.count;
    const existingCount = Math.max(0, candidateCount - createdCount);

    revalidatePath("/admin/booking-slot");
    revalidatePath("/admin/booking-slots");

    return {
      success: true,
      msg: "Slots created successfully.",
      summary: {
        dateCount: dates.length,
        skippedWeekendDates,
        candidateCount,
        createdCount,
        existingCount,
      },
    };
  } catch (err) {
    console.error("createBookingSlots:", err);
    return { success: false, msg: "Server error", error: err?.message };
  }
}

/* ------------------ CREATE SLOTS (admin form) ------------------ */
/**
 * FormData keys expected:
 *  - date  -> "12-12-2025"  (DD-MM-YYYY)
 *  - times -> JSON string:
 *      [
 *        { "fromTime": "09:00", "toTime": "00:00" },
 *        { "fromTime": "02:59", "toTime": "06:00" }
 *      ]
 */
export async function createBookingSlotsFromClient(formData) {
  try {
    if (!(formData instanceof FormData)) {
      return {
        success: false,
        msg: "Invalid form submission.",
        data: null,
      };
    }

    const date = formData.get("date"); // "12-12-2025"
    const timesRaw = formData.get("times"); // JSON string

    if (!date || !timesRaw) {
      return {
        success: false,
        msg: "Date or time ranges missing.",
        data: null,
      };
    }

    let times;
    try {
      times = JSON.parse(timesRaw);
    } catch {
      return {
        success: false,
        msg: "Invalid times JSON format.",
        data: null,
      };
    }

    if (!Array.isArray(times)) {
      return {
        success: false,
        msg: "Times must be an array.",
        data: null,
      };
    }

    const baseDate = parseDMYtoDate(date);
    const slotsToInsert = [];

    for (const range of times) {
      if (!range.fromTime || !range.toTime) continue;

      let startMin = timeToMinutes(range.fromTime);
      let endMin = timeToMinutes(range.toTime);

      // "00:00" means end of same day
      if (range.toTime === "00:00" && range.fromTime !== "00:00") {
        endMin = 24 * 60;
      }

      if (endMin <= startMin) continue;

      // snap to 10-min boundary (02:59 -> 03:00)
      let current = roundUpToNext10(startMin);

      while (current + 10 <= endMin) {
        const slotStart = minutesToTime(current);
        const slotEnd = minutesToTime(current + 10);

        slotsToInsert.push({
          slotDate: baseDate, // always same calendar day
          startTime: slotStart,
          endTime: slotEnd,
          isBooked: false,
        });

        current += 10;
      }
    }

    if (!slotsToInsert.length) {
      return {
        success: true,
        msg: "No valid booking slots found.",
        data: [],
      };
    }

    const result = await prisma.bookingSlot.createMany({
      data: slotsToInsert,
      skipDuplicates: true,
    });

    return {
      success: true,
      msg: "Booking slots created successfully.",
      data: {
        createdCount: result.count,
        slots: slotsToInsert,
      },
    };
  } catch (error) {
    console.error("createBookingSlotsFromClient:", error);

    return {
      success: false,
      msg: "Server error while creating booking slots.",
      data: error.message,
    };
  }
}

/* ------------------ GET SLOTS FOR ONE DATE ------------------ */
/**
 * Accepts:
 *  - "2025-12-06" (string, YYYY-MM-DD)
 *  OR
 *  - FormData with "date" = "2025-12-06"
 */
export async function getBookingSlots(formDataOrDate) {
  try {
    let dateStr;

    if (formDataOrDate instanceof FormData) {
      dateStr = formDataOrDate.get("date");
    } else {
      dateStr = formDataOrDate;
    }

    if (!dateStr) {
      return {
        success: false,
        msg: "Date is required.",
        data: null,
      };
    }

    const slotDate = parseYMDtoDate(dateStr);

    // Patient names, emails and phones go to the admin calendar only, never
    // to the public booking page that uses this same action.
    const admin = await getAdminUser().catch(() => null);
    const isAdmin = Boolean(admin?.admin?.isAdmin);

    const rows = await prisma.bookingSlot.findMany({
      where: {
        slotDate,
      },
      orderBy: {
        startTime: "asc",
      },
      include: {
        _count: { select: { bookings: true } },
        bookings: isAdmin && {
          select: {
            id: true,
            fullName: true,
            email: true,
            phoneNumber: true,
            bookingType: true,
            bookingStatus: true,
            appointment: true,
          },
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    });

    // capacity-aware: a slot is full once booked count reaches capacity.
    // Full slots are returned too (not hidden) so the picker can show them
    // line-through + disabled. (maxCapacity null = legacy slot -> capacity 1)
    const slots = rows.map((row) => {
      const capacity = row.maxCapacity ?? 1;
      const booked = row._count.bookings;
      return {
        id: row.id,
        label: `${row.startTime} - ${row.endTime}`,
        startTime: row.startTime,
        endTime: row.endTime,
        slotDate: dateStr,
        capacity,
        booked,
        remaining: Math.max(0, capacity - booked),
        isFull: booked >= capacity,
        isBooked: row.isBooked || booked >= capacity,
        bookings: isAdmin ? row.bookings || [] : [],
      };
    });

    return {
      success: true,
      msg: slots.length
        ? "Booking slots fetched successfully."
        : "No booking slots found for this date.",
      data: slots,
    };
  } catch (error) {
    console.error("getBookingSlots:", error);

    return {
      success: false,
      msg: "Failed to fetch booking slots.",
      data: error.message,
    };
  }
}


/* ------------------ GET ALL BOOKABLE DATES ------------------ */

export async function getBookableDates(options) {
  const includeAll = options === true || options?.all === true || options?.includeAll === true;
  try {
    if (includeAll) {
      const rows = await prisma.bookingSlot.findMany({
        select: {
          slotDate: true,
        },
        distinct: ["slotDate"],
        orderBy: {
          slotDate: "asc",
        },
      });

      const dateStrings = rows.map((row) => {
        const d = row.slotDate instanceof Date ? row.slotDate : new Date(row.slotDate);
        const y = d.getUTCFullYear();
        const m = String(d.getUTCMonth() + 1).padStart(2, "0");
        const day = String(d.getUTCDate()).padStart(2, "0");
        return `${y}-${m}-${day}`;
      });

      return {
        success: true,
        msg: "All slot dates fetched successfully.",
        data: dateStrings,
      };
    }

    const rows = await prisma.bookingSlot.findMany({
      where: {
        isBooked: false,
      },
      select: {
        slotDate: true,
        maxCapacity: true,
        _count: { select: { bookings: true } },
      },
      orderBy: {
        slotDate: "asc",
      },
    });

    // Only include days that have at least one slot with remaining capacity
    const bookableDateSet = new Set();
    for (const row of rows) {
      const capacity = row.maxCapacity ?? 1;
      const booked = row._count?.bookings ?? 0;
      if (booked < capacity) {
        const d = row.slotDate instanceof Date ? row.slotDate : new Date(row.slotDate);
        const y = d.getUTCFullYear();
        const m = String(d.getUTCMonth() + 1).padStart(2, "0");
        const day = String(d.getUTCDate()).padStart(2, "0");
        bookableDateSet.add(`${y}-${m}-${day}`);
      }
    }

    const dateStrings = Array.from(bookableDateSet).sort();

    return {
      success: true,
      msg: "Bookable dates fetched successfully.",
      data: dateStrings,
    };
  } catch (error) {
    console.error("getBookableDates:", error);

    return {
      success: false,
      msg: "Failed to fetch bookable dates.",
      data: error.message,
    };
  }
}

export async function getAllSlotDates() {
  return getBookableDates(true);
}

export const deleteBookingSlot = async (formDataOrObj) => {
  // Read inputs
  let slotIdRaw;
  let slotDateRaw;

  if (formDataOrObj && typeof formDataOrObj.get === "function") {
    slotIdRaw = formDataOrObj.get("slotId");
    slotDateRaw = formDataOrObj.get("slotDate"); // optional when numeric id, required when label
  } else if (formDataOrObj) {
    slotIdRaw = formDataOrObj.slotId;
    slotDateRaw = formDataOrObj.slotDate;
  }

  if (slotIdRaw === undefined || slotIdRaw === null || slotIdRaw === "") {
    return { success: false, msg: "No slotId provided" };
  }

  // Helper: parse YYYY-MM-DD -> Date (local midnight)
  const parseYMDToDate = (ymd) => {
    const parts = String(ymd).split("-").map(Number);
    if (parts.length !== 3 || parts.some((p) => Number.isNaN(p))) return null;
    const [y, mo, d] = parts;
    return new Date(y, mo - 1, d);
  };

  // If numeric -> treat as DB id
  const maybeNum = Number(slotIdRaw);
  if (!Number.isNaN(maybeNum) && Number.isInteger(maybeNum) && maybeNum > 0) {
    const slotId = maybeNum;

    const slot = await prisma.bookingSlot.findUnique({
      where: { id: slotId },
      select: {
        id: true,
        isBooked: true,
        slotDate: true,
        startTime: true,
        endTime: true,
      },
    });

    if (!slot) return { success: false, msg: "Slot not found" };
    if (slot.isBooked)
      return { success: false, msg: "Cannot delete a booked slot" };

    await prisma.bookingSlot.delete({ where: { id: slotId } });

    revalidatePath("/admin/booking-slots");
    return {
      success: true,
      msg: "Slot deleted",
      slot: {
        id: slot.id,
        startTime: slot.startTime,
        endTime: slot.endTime,
        slotDate: slot.slotDate,
      },
    };
  }

  // Otherwise treat slotIdRaw as a label like "09:00-09:10" or "09:00 - 09:10".
  const label = String(slotIdRaw).trim();
  // accept both "09:00-09:10" and "09:00 - 09:10"
  const parts = label.split("-").map((s) => s.trim());
  if (parts.length !== 2)
    return {
      success: false,
      msg: "Invalid slot label format; expected 'HH:MM-HH:MM'.",
    };

  const [startTime, endTime] = parts;
  if (!/^\d{2}:\d{2}$/.test(startTime) || !/^\d{2}:\d{2}$/.test(endTime)) {
    return { success: false, msg: "Invalid time format in slot label." };
  }

  if (!slotDateRaw) {
    return {
      success: false,
      msg: "slotDate (YYYY-MM-DD) is required when slotId is a label.",
    };
  }

  const slotDateObj = parseYMDToDate(slotDateRaw);
  if (!slotDateObj)
    return {
      success: false,
      msg: "Invalid slotDate format; expected YYYY-MM-DD.",
    };

  // find the slot row by date + startTime + endTime
  const slotRow = await prisma.bookingSlot.findFirst({
    where: {
      slotDate: slotDateObj,
      startTime,
      endTime,
    },
    select: {
      id: true,
      isBooked: true,
      startTime: true,
      endTime: true,
      slotDate: true,
    },
  });

  if (!slotRow) {
    // return friendly message
    return {
      success: false,
      msg: "Slot not found for that date and time range.",
    };
  }

  if (slotRow.isBooked) {
    return { success: false, msg: "Cannot delete a booked slot" };
  }

  await prisma.bookingSlot.delete({ where: { id: slotRow.id } });

  revalidatePath("/profile/bookings");
  return {
    success: true,
    msg: "Slot deleted",
    slot: {
      id: slotRow.id,
      startTime: slotRow.startTime,
      endTime: slotRow.endTime,
      slotDate: slotRow.slotDate,
    },
  };
};

export const deleteBookingSlotsByDate = async (formDataOrObj) => {
  // Read input
  let slotDateRaw;
  if (formDataOrObj && typeof formDataOrObj.get === "function") {
    slotDateRaw = formDataOrObj.get("slotDate");
  } else if (formDataOrObj && formDataOrObj.slotDate !== undefined) {
    slotDateRaw = formDataOrObj.slotDate;
  }

  if (!slotDateRaw) return { success: false, msg: "No slotDate provided" };

  // parse YYYY-MM-DD into year/month/day integers
  const parts = String(slotDateRaw).split("-").map(Number);
  if (parts.length !== 3 || parts.some((p) => Number.isNaN(p))) {
    return {
      success: false,
      msg: "Invalid slotDate format (expected YYYY-MM-DD)",
    };
  }
  const [y, mo, d] = parts;

  // Build startOfDay and startOfNextDay as UTC midnight to be safe.
  // Using Date.UTC ensures a consistent instant regardless of server TZ.
  const startOfDay = new Date(Date.UTC(y, mo - 1, d, 0, 0, 0, 0));
  const startOfNextDay = new Date(Date.UTC(y, mo - 1, d + 1, 0, 0, 0, 0));

  // Debugging log (remove in production)
  // console.debug("deleteBookingSlotsByDate: startOfDay", startOfDay.toISOString(), "next", startOfNextDay.toISOString());

  // fetch slots in the half-open interval [startOfDay, startOfNextDay)
  const slots = await prisma.bookingSlot.findMany({
    where: {
      slotDate: {
        gte: startOfDay,
        lt: startOfNextDay,
      },
    },
    select: { id: true, startTime: true, endTime: true, isBooked: true },
    orderBy: { startTime: "asc" },
  });

  if (!slots || slots.length === 0) {
    return { success: false, msg: "No slots found for that date" };
  }

  const booked = slots.filter((s) => s.isBooked);
  if (booked.length > 0) {
    return {
      success: false,
      msg: "Cannot delete slots for this date: some slots are already booked",
      booked: booked.map((b) => ({
        id: b.id,
        startTime: b.startTime,
        endTime: b.endTime,
      })),
    };
  }

  const idsToDelete = slots.map((s) => s.id);
  await prisma.bookingSlot.deleteMany({ where: { id: { in: idsToDelete } } });

  revalidatePath("/admin/booking-slot");

  return {
    success: true,
    msg: `Deleted ${idsToDelete.length} slot(s) for ${slotDateRaw}`,
    deletedCount: idsToDelete.length,
  };
};

/* ------------------ BULK DELETE BY DATE RANGE / MONTH ------------------ */
/**
 * Delete unbooked slots across an inclusive date range.
 * Booked slots are skipped (never deleted) and reported back.
 *
 * Accepts object or FormData:
 *  - { startDate: "YYYY-MM-DD", endDate: "YYYY-MM-DD" }   // range
 *  - { month: "YYYY-MM" }                                  // whole month (shortcut)
 */
export const deleteBookingSlotsByRange = async (formDataOrObj) => {
  try {
    // read inputs (object or FormData)
    let startRaw, endRaw, monthRaw;
    if (formDataOrObj && typeof formDataOrObj.get === "function") {
      startRaw = formDataOrObj.get("startDate");
      endRaw = formDataOrObj.get("endDate");
      monthRaw = formDataOrObj.get("month");
    } else if (formDataOrObj) {
      startRaw = formDataOrObj.startDate;
      endRaw = formDataOrObj.endDate;
      monthRaw = formDataOrObj.month;
    }

    // month shortcut -> derive start/end
    if (monthRaw) {
      const mParts = String(monthRaw).split("-").map(Number); // [y, m]
      if (mParts.length !== 2 || mParts.some((p) => Number.isNaN(p))) {
        return { success: false, msg: "Invalid month format (expected YYYY-MM)" };
      }
      const [my, mm] = mParts;
      const last = new Date(Date.UTC(my, mm, 0)).getUTCDate(); // day 0 of next month = last day
      startRaw = `${my}-${String(mm).padStart(2, "0")}-01`;
      endRaw = `${my}-${String(mm).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
    }

    if (!startRaw || !endRaw) {
      return { success: false, msg: "startDate and endDate (or month) required" };
    }

    const sParts = String(startRaw).split("-").map(Number);
    const eParts = String(endRaw).split("-").map(Number);
    if (
      sParts.length !== 3 ||
      eParts.length !== 3 ||
      [...sParts, ...eParts].some((p) => Number.isNaN(p))
    ) {
      return { success: false, msg: "Invalid date format (expected YYYY-MM-DD)" };
    }

    const [sy, sm, sd] = sParts;
    const [ey, em, ed] = eParts;

    // half-open UTC interval [startOfStartDay, startOfDayAfterEnd)
    const startOfRange = new Date(Date.UTC(sy, sm - 1, sd, 0, 0, 0, 0));
    const endExclusive = new Date(Date.UTC(ey, em - 1, ed + 1, 0, 0, 0, 0));

    if (startOfRange >= endExclusive) {
      return { success: false, msg: "startDate must be <= endDate" };
    }

    const slots = await prisma.bookingSlot.findMany({
      where: { slotDate: { gte: startOfRange, lt: endExclusive } },
      select: { id: true, isBooked: true },
    });

    if (!slots.length) {
      return { success: false, msg: "No slots found in this range" };
    }

    const deletableIds = slots.filter((s) => !s.isBooked).map((s) => s.id);
    const skippedBooked = slots.length - deletableIds.length;

    if (!deletableIds.length) {
      return {
        success: false,
        msg: "No deletable slots — all slots in range are booked",
        skippedBooked,
      };
    }

    await prisma.bookingSlot.deleteMany({ where: { id: { in: deletableIds } } });

    revalidatePath("/admin/booking-slot");

    return {
      success: true,
      msg:
        `Deleted ${deletableIds.length} slot(s) from ${startRaw} to ${endRaw}` +
        (skippedBooked ? ` (skipped ${skippedBooked} booked)` : ""),
      deletedCount: deletableIds.length,
      skippedBooked,
    };
  } catch (err) {
    console.error("deleteBookingSlotsByRange:", err);
    return { success: false, msg: "Server error", error: err?.message };
  }
};
