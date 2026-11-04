import crypto from "crypto";

// Characters safe for URLs and SMS, avoiding easily confused characters (0/O, 1/l/I)
const SAFE_CHARS = "23456789abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ";

/**
 * Generate a short, URL-safe random token.
 * 8 characters provide ~46 bits of entropy (sufficient for unique short-lived review links).
 */
export function generateBpToken(length = 8) {
  const bytes = crypto.randomBytes(length);
  let token = "";
  for (let i = 0; i < length; i++) {
    token += SAFE_CHARS[bytes[i] % SAFE_CHARS.length];
  }
  return token;
}

/**
 * Retrieve details for a given BP token.
 */
export async function getBpReadingByToken(token) {
  if (!token || typeof token !== "string") return null;

  const { prisma } = await import("./client/prisma.js");

  const reading = await prisma.bpReading.findUnique({
    where: { token: token.trim() },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          account: {
            select: {
              firstName: true,
              lastName: true,
              dob: true,
            },
          },
        },
      },
      order: {
        select: {
          id: true,
          medicineName: true,
          futureApptAt: true,
          futureApptTime: true,
        },
      },
    },
  });

  if (!isBpLinkOpen(reading)) return null;
  return reading;
}

// A link works once, and only until it expires (set when the SMS is sent).
export function isBpLinkOpen(reading, now = new Date()) {
  if (!reading) return false;
  if (reading.status === "submitted") return false;
  if (reading.expiresAt && new Date(reading.expiresAt) < now) return false;
  return true;
}

/**
 * Submit home blood pressure reading via public token link.
 */
export async function submitBpReading(token, { systolic, diastolic, readingDate }) {
  if (!token || typeof token !== "string") {
    return { success: false, msg: "Invalid or missing token." };
  }

  const { prisma } = await import("./client/prisma.js");

  const reading = await prisma.bpReading.findUnique({
    where: { token: token.trim() },
    include: { user: true, order: true },
  });

  if (!isBpLinkOpen(reading)) {
    return { success: false, msg: "This link is invalid, has expired or has already been used." };
  }

  const sys = Number(systolic);
  const dia = Number(diastolic);

  // NHS clinical validation limits
  if (!Number.isInteger(sys) || sys < 70 || sys > 250) {
    return {
      success: false,
      msg: "Please enter a valid systolic (top) number between 70 and 250 mmHg.",
    };
  }

  if (!Number.isInteger(dia) || dia < 40 || dia > 150) {
    return {
      success: false,
      msg: "Please enter a valid diastolic (bottom) number between 40 and 150 mmHg.",
    };
  }

  if (sys <= dia) {
    return {
      success: false,
      msg: "The systolic (top) number must be higher than the diastolic (bottom) number.",
    };
  }

  let bpDate = new Date();
  if (readingDate) {
    const parsed = new Date(readingDate);
    if (!isNaN(parsed.getTime())) {
      bpDate = parsed;
    }
  }

  const now = new Date();

  // 1. Update BpReading record
  await prisma.bpReading.update({
    where: { id: reading.id },
    data: {
      systolic: sys,
      diastolic: dia,
      readingDate: bpDate,
      status: "submitted",
      submittedAt: now,
    },
  });

  // 2. Automatically save into patient's Medical Records so clinician sees it in RecordTable
  try {
    await prisma.record.create({
      data: {
        userId: reading.userId,
        weight: "—",
        height: "—",
        lastwhCheck: now,
        bloodPressure: `${sys}/${dia}`,
        lastBpCheckDate: bpDate,
      },
    });
  } catch (err) {
    console.error("Failed to create medical record for BP reading:", err);
  }

  // 3. Mark repliedAt on the SMS log so staff see "Replied" in admin
  try {
    await prisma.smsLog.updateMany({
      where: {
        userId: reading.userId,
        automation: "4b_bp",
        repliedAt: null,
      },
      data: {
        repliedAt: now,
      },
    });
  } catch (err) {
    console.error("Failed to update SMS log repliedAt:", err);
  }

  // 4. Revalidate admin pages
  try {
    const { revalidatePath } = await import("next/cache");
    revalidatePath(`/admin/${reading.userId}/account`);
    revalidatePath(`/admin/${reading.userId}/records`);
    revalidatePath("/admin/automations");
    revalidatePath("/admin/oc-orders");
  } catch (e) {
    // ignore revalidate in non-next context
  }

  return {
    success: true,
    msg: "Blood pressure reading saved successfully.",
    data: {
      systolic: sys,
      diastolic: dia,
      readingDate: bpDate,
    },
  };
}
