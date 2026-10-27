import { getAutomationsPageAction } from "@/actions/automations.action";
import {
  AutomationCard,
  ConnectionForm,
  MissedCallForm,
  OptOutList,
  SmsLogTable,
  TestSmsForm,
} from "./_components/automation-forms";

export const dynamic = "force-dynamic";

function Section({ title, subtitle, children, right }) {
  return (
    <section className="rounded-2xl border border-[#ECE7E1] bg-white p-6 flex flex-col gap-5 min-w-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold text-[#0D060C]">{title}</h3>
          {subtitle && <p className="text-sm text-[#6B6660] max-w-[70ch]">{subtitle}</p>}
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

const AutomationsPage = async () => {
  const res = await getAutomationsPageAction();
  if (!res?.success) return <div className="w-full p-10">{res?.msg || "Could not load automations."}</div>;

  const missed = res.automations.find((a) => a.id === "5");

  return (
    <div className="w-full min-w-0 p-6 md:p-10 flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-semibold text-[#0D060C]">Automations</h2>
        <p className="text-sm text-[#6B6660]">
          Text messages sent to patients by Recallo24. Nothing is sent while SMS is switched off.
        </p>
      </div>

      {!res.ready && (
        <p className="rounded-lg bg-[#FBF0E2] px-4 py-3 text-sm text-[#8A5A12]">
          SMS storage is not set up on the server yet, so nothing can be saved or sent. Ask your developer to run the
          database update.
        </p>
      )}

      <Section
        title="SMS connection"
        subtitle="The Recallo24 API key and the main switch for every automation below."
        right={
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              res.enabled ? "bg-[#E7F4EC] text-[#1E6B3A]" : "bg-[#F4E7E1] text-[#0D060C]"
            }`}
          >
            {res.enabled ? "SMS on" : "SMS off"}
          </span>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-xl border border-[#ECE7E1] bg-[#FAF9F8] p-4">
            <p className="text-sm font-semibold text-[#0D060C]">Credit balance</p>
            <p className="mt-1 text-sm text-[#3A3D42]">
              {!res.balance
                ? "Save the API key to see the balance."
                : res.balance.error
                  ? `Could not read the balance: ${res.balance.error}`
                  : `${res.balance.credits} credits (1 credit = 1 SMS part)`}
            </p>
          </div>
          <div className="rounded-xl border border-[#ECE7E1] bg-[#FAF9F8] p-4">
            <p className="text-sm font-semibold text-[#0D060C]">Scheduled sending</p>
            <p className="mt-1 text-sm text-[#3A3D42]">
              {res.cronReady
                ? "The server checks every hour for messages that are due."
                : "Not set up on the server yet. Only the test and missed-call buttons work until it is."}
            </p>
          </div>
        </div>
        <ConnectionForm enabled={res.enabled} hasKey={res.hasKey} keyHint={res.keyHint} ready={res.ready} />
      </Section>

      <Section
        title="Automated messages"
        subtitle="Each message has its own switch. Sign-up messages only go to patients who sign up after SMS is first switched on."
      >
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {res.automations.map((a) => (
            <AutomationCard key={a.id} automation={a} ready={res.ready} />
          ))}
        </div>
      </Section>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Section title="Missed call" subtitle="Send the missed-call message to a patient after an unanswered call.">
          <MissedCallForm enabled={Boolean(missed?.enabled)} ready={res.ready} />
        </Section>
        <Section title="Send a test" subtitle="Sends one message to your own phone with sample details.">
          <TestSmsForm automations={res.automations} ready={res.ready} />
        </Section>
      </div>

      <Section title="Do not text" subtitle="Numbers here never get any SMS from the automations.">
        <OptOutList optOuts={res.optOuts} ready={res.ready} />
      </Section>

      <Section title="Recent messages" subtitle="The last 50 messages, sent, skipped or failed.">
        <SmsLogTable logs={res.logs} />
      </Section>
    </div>
  );
};

export default AutomationsPage;
