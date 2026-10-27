import { prisma } from "@/lib/client/prisma";
import { AUTOMATIONS } from "@/lib/smsCore";

// SMS automation settings live in the existing AppSetting key/value table.
export const SMS_KEYS = {
  enabled: "sms.enabled",
  startedAt: "sms.startedAt",
  apiKey: "sms.recallo24.apiKey",
  auto: (id, field) => `sms.auto.${id}.${field}`,
};

// Everything off and the document's texts until an admin saves.
export async function getSmsSettings() {
  let map = {};
  try {
    const rows = await prisma.appSetting.findMany({ where: { key: { startsWith: "sms." } } });
    map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  } catch (err) {
    console.error("getSmsSettings failed, using defaults:", err?.message);
  }
  const apiKey = map[SMS_KEYS.apiKey] || process.env.RECALLO24_API_KEY || "";
  return {
    enabled: map[SMS_KEYS.enabled] === "true",
    startedAt: map[SMS_KEYS.startedAt] ? new Date(map[SMS_KEYS.startedAt]) : null,
    apiKey,
    automations: AUTOMATIONS.map((a) => {
      const hour = Number(map[SMS_KEYS.auto(a.id, "hour")]);
      const since = map[SMS_KEYS.auto(a.id, "since")];
      return {
        ...a,
        since: since ? new Date(since) : null,
        enabled: a.ready && map[SMS_KEYS.auto(a.id, "enabled")] === "true",
        text: map[SMS_KEYS.auto(a.id, "text")] || a.text,
        hour: a.hour === undefined ? undefined : Number.isInteger(hour) ? hour : a.hour,
      };
    }),
  };
}

export async function setSmsSettings(entries) {
  const writes = Object.entries(entries)
    .filter(([, v]) => v !== undefined)
    .map(([key, value]) =>
      prisma.appSetting.upsert({
        where: { key },
        update: { value: String(value) },
        create: { key, value: String(value) },
      })
    );
  if (writes.length) await prisma.$transaction(writes);
}
