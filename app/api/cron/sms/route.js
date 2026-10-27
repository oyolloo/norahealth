import { runDueAutomations } from "@/lib/smsRunner";

export const dynamic = "force-dynamic";

// Hourly from the server crontab:
//   curl -s -H "x-cron-secret: $CRON_SECRET" https://norahealth.co.uk/api/cron/sms
export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: "CRON_SECRET is not set" }, { status: 503 });
  if (request.headers.get("x-cron-secret") !== secret)
    return Response.json({ error: "unauthorized" }, { status: 401 });
  try {
    return Response.json(await runDueAutomations());
  } catch (err) {
    console.error("[cron/sms]", err);
    return Response.json({ error: "failed" }, { status: 500 });
  }
}
