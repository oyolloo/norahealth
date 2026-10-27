"use server";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/client/prisma";
import { getAdminUser } from "./admin.action";
import { getSmsSettings, setSmsSettings, SMS_KEYS } from "@/lib/smsSettings";
import { getBalance } from "@/lib/recallo24";
import { sendOne } from "@/lib/smsRunner";
import { automationById, firstName, toE164Uk } from "@/lib/smsCore";

const PATH = "/admin/automations";
const DENIED = { success: false, msg: "Unauthorized. User is not admin" };

async function tablesReady() {
  try {
    await prisma.smsLog.count();
    await prisma.smsOptOut.count();
    return true;
  } catch {
    return false;
  }
}

const NOT_READY = {
  success: false,
  msg: "SMS storage is not set up on the server yet. Ask your developer to run the database update.",
};

export async function getAutomationsPageAction() {
  const admin = await getAdminUser();
  if (!admin) return DENIED;
  const s = await getSmsSettings();
  const ready = await tablesReady();
  const balance = s.apiKey ? await getBalance(s.apiKey) : null;
  const [logs, optOuts] = ready
    ? await Promise.all([
        prisma.smsLog.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
        prisma.smsOptOut.findMany({ orderBy: { createdAt: "desc" } }),
      ])
    : [[], []];
  return {
    success: true,
    ready,
    enabled: s.enabled,
    hasKey: Boolean(s.apiKey),
    keyHint: s.apiKey ? `••••${s.apiKey.slice(-4)}` : "",
    balance: balance ? (balance.ok ? { credits: balance.data?.credits } : { error: balance.error }) : null,
    cronReady: Boolean(process.env.CRON_SECRET),
    automations: s.automations,
    logs: logs.map((l) => ({ ...l, createdAt: l.createdAt.toISOString(), updatedAt: l.updatedAt.toISOString() })),
    optOuts: optOuts.map((o) => ({ ...o, createdAt: o.createdAt.toISOString() })),
  };
}

export async function saveConnectionAction(_prev, formData) {
  if (!(await getAdminUser())) return DENIED;
  if (!(await tablesReady())) return NOT_READY;
  const enabled = formData.get("enabled") === "on";
  const typed = String(formData.get("apiKey") || "").trim();
  const clearKey = formData.get("clearKey") === "on";
  const current = await getSmsSettings();
  const key = clearKey ? "" : typed || current.apiKey;

  if (enabled && !key) return { success: false, msg: "Add the Recallo24 API key before turning SMS on." };
  if (typed) {
    const res = await getBalance(typed);
    if (!res.ok) return { success: false, msg: `Not saved. Recallo24 refused the key: ${res.error}` };
  }
  await setSmsSettings({
    [SMS_KEYS.enabled]: enabled,
    [SMS_KEYS.apiKey]: clearKey || typed ? key : undefined,
    [SMS_KEYS.startedAt]: enabled && !current.startedAt ? new Date().toISOString() : undefined,
  });
  revalidatePath(PATH);
  return {
    success: true,
    msg: enabled ? "Saved. SMS automations are on." : "Saved. SMS automations are off, nothing will be sent.",
  };
}

export async function saveAutomationAction(_prev, formData) {
  if (!(await getAdminUser())) return DENIED;
  if (!(await tablesReady())) return NOT_READY;
  const a = automationById(String(formData.get("id") || ""));
  if (!a) return { success: false, msg: "Unknown automation." };
  const text = String(formData.get("text") || "").trim();
  if (!text) return { success: false, msg: "The SMS text can't be empty." };
  if (text.length > 900) return { success: false, msg: "The SMS text is too long (900 characters max)." };
  const enabled = formData.get("enabled") === "on";
  if (enabled && !a.ready) return { success: false, msg: "This automation can't be switched on yet." };
  let hour;
  if (a.hour !== undefined) {
    hour = Number(formData.get("hour"));
    if (!Number.isInteger(hour) || hour < 6 || hour > 21)
      return { success: false, msg: "Pick a send time between 6am and 9pm." };
  }
  await setSmsSettings({
    [SMS_KEYS.auto(a.id, "enabled")]: enabled,
    [SMS_KEYS.auto(a.id, "text")]: text,
    [SMS_KEYS.auto(a.id, "hour")]: hour,
  });
  revalidatePath(PATH);
  return { success: true, msg: `Saved "${a.title}".` };
}

export async function sendTestAction(_prev, formData) {
  const admin = await getAdminUser();
  if (!admin) return DENIED;
  if (!(await tablesReady())) return NOT_READY;
  const s = await getSmsSettings();
  if (!s.apiKey) return { success: false, msg: "Save the Recallo24 API key first." };
  const a = s.automations.find((x) => x.id === String(formData.get("id") || ""));
  if (!a) return { success: false, msg: "Pick an SMS to test." };
  const phone = String(formData.get("phone") || "");
  if (!toE164Uk(phone)) return { success: false, msg: "Enter a UK mobile number, for example 07700 900123." };
  const r = await sendOne(s, {
    key: `test:${a.id}:${randomUUID()}`,
    automation: `test-${a.id}`,
    phone,
    text: a.text,
    vars: { first_name: "Test", time_frame: "3pm and 4pm", appt_time: "3pm-4pm" },
    sentBy: admin.admin?.email || "admin",
  });
  revalidatePath(PATH);
  return r.status === "sent"
    ? { success: true, msg: "Test SMS sent." }
    : { success: false, msg: `Not sent: ${r.error || r.status}` };
}

export async function searchPatientsAction(query) {
  if (!(await getAdminUser())) return [];
  const q = String(query || "").trim();
  if (q.length < 2) return [];
  const users = await prisma.user.findMany({
    where: {
      account: { isNot: null },
      OR: [
        { email: { contains: q, mode: "insensitive" } },
        { account: { is: { firstName: { contains: q, mode: "insensitive" } } } },
        { account: { is: { lastName: { contains: q, mode: "insensitive" } } } },
        { account: { is: { phoneNumber: { contains: q.replace(/\s/g, "") } } } },
      ],
    },
    select: { id: true, email: true, account: { select: { firstName: true, lastName: true, phoneNumber: true } } },
    take: 10,
    orderBy: { id: "desc" },
  });
  return users.map((u) => ({
    id: u.id,
    email: u.email,
    name: `${u.account.firstName} ${u.account.lastName}`.trim(),
    phone: u.account.phoneNumber,
  }));
}

export async function sendMissedCallAction(_prev, formData) {
  const admin = await getAdminUser();
  if (!admin) return DENIED;
  if (!(await tablesReady())) return NOT_READY;
  const s = await getSmsSettings();
  const a = s.automations.find((x) => x.id === "5");
  if (!s.apiKey) return { success: false, msg: "Save the Recallo24 API key first." };
  if (!a.enabled) return { success: false, msg: "Switch on the Missed call SMS first." };
  const userId = Number(formData.get("userId"));
  const user = userId
    ? await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, account: { select: { firstName: true, phoneNumber: true } } },
      })
    : null;
  if (!user?.account) return { success: false, msg: "Pick a patient first." };

  // Double-click guard: one missed-call text per patient per 10 minutes.
  const recent = await prisma.smsLog.findFirst({
    where: { automation: "5", userId: user.id, createdAt: { gte: new Date(Date.now() - 10 * 60_000) } },
  });
  if (recent) return { success: false, msg: "A missed-call SMS went to this patient in the last 10 minutes." };

  const r = await sendOne(s, {
    key: `5:user:${user.id}:${randomUUID()}`,
    automation: "5",
    phone: user.account.phoneNumber,
    text: a.text,
    vars: { first_name: firstName(user.account.firstName) },
    userId: user.id,
    sentBy: admin.admin?.email || "admin",
  });
  revalidatePath(PATH);
  return r.status === "sent"
    ? { success: true, msg: "Missed-call SMS sent." }
    : { success: false, msg: `Not sent: ${r.error || r.status}` };
}

export async function addOptOutAction(_prev, formData) {
  if (!(await getAdminUser())) return DENIED;
  if (!(await tablesReady())) return NOT_READY;
  const phone = toE164Uk(String(formData.get("phone") || ""));
  if (!phone) return { success: false, msg: "Enter a UK mobile number." };
  const note = String(formData.get("note") || "").trim().slice(0, 200) || null;
  await prisma.smsOptOut.upsert({ where: { phone }, update: { note }, create: { phone, note } });
  revalidatePath(PATH);
  return { success: true, msg: `${phone} will not get any SMS.` };
}

export async function removeOptOutAction(formData) {
  if (!(await getAdminUser())) return DENIED;
  const phone = String(formData.get("phone") || "");
  await prisma.smsOptOut.deleteMany({ where: { phone } });
  revalidatePath(PATH);
  return { success: true };
}
