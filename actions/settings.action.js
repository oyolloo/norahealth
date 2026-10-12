"use server";
import { prisma } from "@/lib/client/prisma";
import { getAdminUser } from "./admin.action";
import { getAddressSettings, saveAddressSettings } from "@/lib/settings";
import { revalidatePath } from "next/cache";

async function tableReady() {
  try {
    await prisma.appSetting.count();
    return true;
  } catch {
    return false;
  }
}

export async function getAddressSettingsAction() {
  const admin = await getAdminUser();
  if (!admin) return { success: false, msg: "Unauthorized. User is not admin" };
  const s = await getAddressSettings();
  return {
    success: true,
    ready: await tableReady(),
    enabled: s.enabled,
    hasKey: Boolean(s.apiKey),
    keyHint: s.apiKey ? `••••${s.apiKey.slice(-4)}` : "",
    provider: s.provider,
  };
}

// Calls Places Autocomplete (New) once with a known UK address.
async function probeGoogleKey(apiKey) {
  try {
    const r = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "suggestions.placePrediction.placeId",
      },
      body: JSON.stringify({ input: "10 Downing Street", includedRegionCodes: ["gb"] }),
    });
    if (r.ok) return { ok: true, msg: "The key works. Google returned address suggestions." };
    const body = await r.json().catch(() => ({}));
    const reason = body?.error?.message || `Google returned status ${r.status}.`;
    return { ok: false, msg: reason };
  } catch {
    return { ok: false, msg: "Could not reach Google. Check the server's internet connection." };
  }
}

export async function testGoogleKeyAction(_prev, formData) {
  const admin = await getAdminUser();
  if (!admin) return { success: false, msg: "Unauthorized. User is not admin" };
  const typed = String(formData.get("apiKey") || "").trim();
  const key = typed || (await getAddressSettings()).apiKey;
  if (!key) return { success: false, msg: "Paste an API key first." };
  const res = await probeGoogleKey(key);
  return { success: res.ok, msg: res.msg };
}

export async function saveAddressSettingsAction(_prev, formData) {
  const admin = await getAdminUser();
  if (!admin) return { success: false, msg: "Unauthorized. User is not admin" };
  if (!(await tableReady()))
    return {
      success: false,
      msg: "Settings storage is not set up on the server yet. Ask your developer to run the database update.",
    };

  const enabled = formData.get("enabled") === "on";
  const typed = String(formData.get("apiKey") || "").trim();
  const clearKey = formData.get("clearKey") === "on";
  const current = await getAddressSettings();
  const key = clearKey ? "" : typed || current.apiKey;

  if (enabled && !key)
    return { success: false, msg: "Add an API key before turning Google address search on." };
  if (enabled && typed) {
    const res = await probeGoogleKey(typed);
    if (!res.ok) return { success: false, msg: `Not saved. Google rejected the key: ${res.msg}` };
  }

  await saveAddressSettings({ enabled, apiKey: clearKey || typed ? key : undefined });
  revalidatePath("/admin/settings");
  return {
    success: true,
    msg: enabled
      ? "Saved. Google address search is on. It reaches patient forms within a minute."
      : "Saved. Patient forms use the free postcode lookup.",
  };
}
