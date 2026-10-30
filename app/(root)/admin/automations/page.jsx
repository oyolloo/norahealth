import { getAutomationsPageAction } from "@/actions/automations.action";
import {
  AutomationsHeader,
  ConnectionPanel,
  MessageGroups,
  MissedCallForm,
  OptOutList,
  SmsLogTable,
  TestSmsForm,
} from "./_components/automation-forms";

export const dynamic = "force-dynamic";

// Same card shell as the Settings and Analytics pages.
function Card({ title, subtitle, children, className = "" }) {
  return (
    <section className={`rounded-2xl border border-[#ECE7E1] bg-white p-5 md:p-6 min-w-0 ${className}`}>
      <div className="mb-4">
        <h3 className="text-base font-semibold text-heading">{title}</h3>
        {subtitle && <p className="text-sm text-[#6B6660]">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

const AutomationsPage = async () => {
  const res = await getAutomationsPageAction();
  if (!res?.success) return <div className="w-full p-10">{res?.msg || "Could not load automations."}</div>;

  const missed = res.automations.find((a) => a.id === "5");
  const live = res.automations.filter((a) => a.enabled).length;

  return (
    <div className="w-full min-w-0 p-6 flex flex-col gap-6">
      <AutomationsHeader enabled={res.enabled} live={live} total={res.automations.length} />

      {!res.ready && (
        <p className="rounded-lg bg-[#FBF0E2] px-4 py-3 text-sm text-[#8A5A12]">
          SMS storage is not set up on the server yet, so nothing can be saved or sent. Ask your developer to run the
          database update.
        </p>
      )}

      <ConnectionPanel
        enabled={res.enabled}
        hasKey={res.hasKey}
        keyHint={res.keyHint}
        ready={res.ready}
        balance={res.balance}
        cronReady={res.cronReady}
      />

      <MessageGroups automations={res.automations} ready={res.ready} smsOn={res.enabled} />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card title="Send missed-call text" subtitle="After an unanswered call, find the patient and send the missed-call message.">
          <MissedCallForm enabled={Boolean(missed?.enabled) && res.enabled} ready={res.ready} />
        </Card>
        <Card title="Send custom message" subtitle="Type your own text, or pick a saved SMS to test with sample details, and send it to one mobile.">
          <TestSmsForm automations={res.automations} ready={res.ready} />
        </Card>
      </div>

      <Card title="Do not text" subtitle="Numbers on this list never get any automated or manual SMS.">
        <OptOutList optOuts={res.optOuts} ready={res.ready} />
      </Card>

      <Card title="Recent messages" subtitle="The last 50 texts: sent, skipped or failed, with the reason.">
        <SmsLogTable logs={res.logs} />
      </Card>
    </div>
  );
};

export default AutomationsPage;
