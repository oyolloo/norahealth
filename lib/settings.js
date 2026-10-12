import { prisma } from "@/lib/client/prisma";

export const ADDRESS_KEYS = {
  enabled: "address.googlePlaces.enabled",
  apiKey: "address.googlePlaces.apiKey",
};

// Settings live in AppSetting. If that table is not there yet (migration not
// run), every read falls back to defaults so the site keeps working.
export async function getAddressSettings() {
  try {
    const rows = await prisma.appSetting.findMany({
      where: { key: { in: Object.values(ADDRESS_KEYS) } },
    });
    const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    const apiKey = map[ADDRESS_KEYS.apiKey] || "";
    const enabled = map[ADDRESS_KEYS.enabled] === "true";
    return { enabled, apiKey, provider: enabled && apiKey ? "google" : "postcodes" };
  } catch (err) {
    console.error("getAddressSettings failed, using defaults:", err?.message);
    return { enabled: false, apiKey: "", provider: "postcodes" };
  }
}

export async function saveAddressSettings({ enabled, apiKey }) {
  const writes = [
    prisma.appSetting.upsert({
      where: { key: ADDRESS_KEYS.enabled },
      update: { value: String(Boolean(enabled)) },
      create: { key: ADDRESS_KEYS.enabled, value: String(Boolean(enabled)) },
    }),
  ];
  if (apiKey !== undefined) {
    writes.push(
      prisma.appSetting.upsert({
        where: { key: ADDRESS_KEYS.apiKey },
        update: { value: apiKey },
        create: { key: ADDRESS_KEYS.apiKey, value: apiKey },
      })
    );
  }
  await prisma.$transaction(writes);
}
