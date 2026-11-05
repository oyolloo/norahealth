"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/client/prisma";
import { toE164Uk } from "@/lib/smsCore";
import { isBpLinkOpen } from "@/lib/bpToken";

// The SMS link is the same for everyone (norahealth.co.uk/bp/health), so the
// patient proves who they are with date of birth + mobile before the form opens.
// 5 wrong tries from one connection locks it for 30 minutes.
const MAX_TRIES = 5;
const LOCK_MS = 30 * 60 * 1000;
const tries = globalThis.__bpTries || (globalThis.__bpTries = new Map());

function dayKey(d, timeZone) {
  return new Date(d).toLocaleDateString("en-CA", { timeZone });
}

export async function verifyBpPatientAction(prevState, formData) {
  const h = await headers();
  const ip = (h.get("x-forwarded-for") || "").split(",")[0].trim() || h.get("x-real-ip") || "unknown";
  const now = Date.now();
  const t = tries.get(ip);
  if (t && t.count >= MAX_TRIES && now - t.first < LOCK_MS) {
    return { success: false, msg: "Too many tries. Please wait 30 minutes, or call us on 0208 679 7198." };
  }

  const dob = String(formData.get("dob") || "").trim(); // YYYY-MM-DD
  const phone = toE164Uk(String(formData.get("phone") || ""));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob) || !phone) {
    return { success: false, msg: "Enter your date of birth and the UK mobile number we texted." };
  }

  let token = null;
  try {
    const base = new Date(`${dob}T00:00:00Z`);
    const accounts = await prisma.account.findMany({
      where: {
        dob: {
          gte: new Date(base.getTime() - 24 * 3600e3),
          lt: new Date(base.getTime() + 48 * 3600e3),
        },
      },
      select: { userId: true, dob: true, phoneNumber: true },
    });
    const userIds = accounts
      .filter(
        (a) =>
          (dayKey(a.dob, "UTC") === dob || dayKey(a.dob, "Europe/London") === dob) &&
          toE164Uk(a.phoneNumber || "") === phone,
      )
      .map((a) => a.userId);

    if (userIds.length) {
      const readings = await prisma.bpReading.findMany({
        where: { userId: { in: userIds }, status: "pending" },
        orderBy: { createdAt: "desc" },
        select: { token: true, status: true, expiresAt: true },
      });
      token = readings.find((r) => isBpLinkOpen(r))?.token || null;
    }
  } catch (err) {
    console.error("verifyBpPatientAction failed:", err?.message);
    return { success: false, msg: "Something went wrong. Please try again." };
  }

  if (!token) {
    const cur = t && now - t.first < LOCK_MS ? t : { count: 0, first: now };
    cur.count += 1;
    tries.set(ip, cur);
    const left = MAX_TRIES - cur.count;
    return {
      success: false,
      msg:
        left > 0
          ? `We could not find an open blood pressure request for those details. ${left} ${left === 1 ? "try" : "tries"} left.`
          : "Too many tries. Please wait 30 minutes, or call us on 0208 679 7198.",
    };
  }

  tries.delete(ip);
  redirect(`/bp/${token}`);
}
