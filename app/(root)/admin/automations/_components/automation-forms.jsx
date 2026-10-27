"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  addOptOutAction,
  removeOptOutAction,
  saveAutomationAction,
  saveConnectionAction,
  searchPatientsAction,
  sendMissedCallAction,
  sendTestAction,
} from "@/actions/automations.action";
import { segmentsOf } from "@/lib/smsCore";

const initial = { success: null, msg: "" };
const inputClass =
  "w-full rounded-lg border border-[#EEE0CF] bg-white px-4 py-3 text-sm text-[#0D060C] outline-none focus:border-[#CE8936]";
const primaryBtn =
  "rounded-full bg-[#CE8936] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#B4690E] disabled:opacity-60 cursor-pointer disabled:cursor-not-allowed";
const secondaryBtn =
  "rounded-full border border-[#CE8936] px-5 py-2.5 text-sm font-semibold text-[#B4690E] hover:bg-[#FBF0E2] disabled:opacity-60 cursor-pointer disabled:cursor-not-allowed";

function Notice({ state }) {
  if (!state?.msg) return null;
  return (
    <p
      role="status"
      className={`rounded-lg px-4 py-3 text-sm ${
        state.success ? "bg-[#E7F4EC] text-[#1E6B3A]" : "bg-[#FBE7E5] text-[#9B2C22]"
      }`}
    >
      {state.msg}
    </p>
  );
}

function Toggle({ id, name, checked, onChange, disabled }) {
  return (
    <span className="relative inline-flex shrink-0">
      <input
        id={id}
        name={name}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <span className="h-7 w-12 rounded-full bg-[#D9D2CB] transition peer-checked:bg-[#CE8936] peer-focus-visible:ring-2 peer-focus-visible:ring-[#CE8936]/50 peer-disabled:opacity-50" />
      <span className="absolute left-1 top-1 size-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
    </span>
  );
}

// useActionState queues a second click and runs it after the first; the ref
// drops it instead, so one click never sends two texts.
function useOnce(action) {
  const busy = useRef(false);
  return async (prev, formData) => {
    if (busy.current) return prev;
    busy.current = true;
    try {
      return await action(prev, formData);
    } finally {
      busy.current = false;
    }
  };
}

export function ConnectionForm({ enabled, hasKey, keyHint, ready }) {
  const [on, setOn] = useState(enabled);
  const [state, action, saving] = useActionState(saveConnectionAction, initial);
  return (
    <form action={action} className="flex flex-col gap-5 max-w-[640px]">
      <label
        htmlFor="sms-enabled"
        className="flex items-center justify-between gap-4 rounded-xl border border-[#ECE7E1] p-4 cursor-pointer"
      >
        <span className="min-w-0">
          <span className="block font-semibold text-[#0D060C]">Send SMS</span>
          <span className="block text-sm text-[#6B6660]">Main switch. When off, no automation sends anything.</span>
        </span>
        <Toggle id="sms-enabled" name="enabled" checked={on} onChange={setOn} />
      </label>
      <div className="flex flex-col gap-2">
        <label htmlFor="sms-apiKey" className="text-sm font-semibold text-[#0D060C]">
          Recallo24 API key
        </label>
        <input
          id="sms-apiKey"
          name="apiKey"
          type="password"
          autoComplete="off"
          spellCheck={false}
          placeholder={hasKey ? `Saved key ${keyHint}. Paste a new key to replace it.` : "Paste your API key (rk_live_...)"}
          className={inputClass}
        />
        <p className="text-xs text-[#6B6660]">Kept on the server only. Leave empty to keep the saved key.</p>
        {hasKey && (
          <label htmlFor="sms-clearKey" className="flex items-center gap-2 text-sm text-[#3A3D42]">
            <input id="sms-clearKey" name="clearKey" type="checkbox" className="size-4 accent-[#CE8936]" />
            Remove the saved key
          </label>
        )}
      </div>
      <Notice state={state} />
      <div>
        <button type="submit" disabled={saving || !ready} className={primaryBtn}>
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
    </form>
  );
}

const HOURS = Array.from({ length: 16 }, (_, i) => i + 6);
const hourText = (h) => `${h % 12 || 12}${h >= 12 ? "pm" : "am"}`;

export function AutomationCard({ automation: a, ready }) {
  const [on, setOn] = useState(a.enabled);
  const [text, setText] = useState(a.text);
  const [state, action, saving] = useActionState(saveAutomationAction, initial);
  const parts = segmentsOf(text);
  return (
    <form action={action} className="rounded-xl border border-[#ECE7E1] bg-[#FAF9F8] p-4 flex flex-col gap-3 min-w-0">
      <input type="hidden" name="id" value={a.id} />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-[#B4690E]">{a.id.toUpperCase()}</p>
          <p className="font-semibold text-[#0D060C]">{a.title}</p>
          <p className="text-sm text-[#6B6660]">{a.conditions}</p>
          <p className="text-sm text-[#3A3D42]">When: {a.when}</p>
        </div>
        <label htmlFor={`auto-${a.id}`} className="cursor-pointer">
          <span className="sr-only">Switch {a.title}</span>
          <Toggle id={`auto-${a.id}`} name="enabled" checked={on} onChange={setOn} disabled={!a.ready} />
        </label>
      </div>
      {!a.ready && (
        <p className="rounded-lg bg-[#FBF0E2] px-3 py-2 text-sm text-[#8A5A12]">Not available yet. {a.waiting}</p>
      )}
      <textarea
        name="text"
        rows={5}
        value={text}
        onChange={(e) => setText(e.target.value)}
        aria-label={`${a.title} text`}
        className={`${inputClass} resize-y`}
      />
      <p className="text-xs text-[#6B6660]">
        {text.length} characters, about {parts} SMS part{parts === 1 ? "" : "s"} per patient (credits). Use{" "}
        {"{first_name}"}
        {a.id === "2" || a.id === "4a" ? ", {time_frame}" : ""}
        {a.id === "3" ? ", {appt_time}" : ""}.
      </p>
      {a.hour !== undefined && (
        <label className="flex items-center gap-2 text-sm text-[#3A3D42]">
          Send at
          <select name="hour" defaultValue={a.hour} className="rounded-lg border border-[#EEE0CF] bg-white px-3 py-2 text-sm">
            {HOURS.map((h) => (
              <option key={h} value={h}>
                {hourText(h)}
              </option>
            ))}
          </select>
          UK time
        </label>
      )}
      <Notice state={state} />
      <div>
        <button type="submit" disabled={saving || !ready} className={secondaryBtn}>
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
    </form>
  );
}

export function MissedCallForm({ enabled, ready }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [picked, setPicked] = useState(null);
  const [state, action, sending] = useActionState(useOnce(sendMissedCallAction), initial);

  useEffect(() => {
    if (picked || q.trim().length < 2) {
      setResults([]);
      return;
    }
    let live = true;
    const t = setTimeout(async () => {
      const r = await searchPatientsAction(q);
      if (live) setResults(r);
    }, 300);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [q, picked]);

  return (
    <form action={action} className="flex flex-col gap-3">
      {!enabled && (
        <p className="rounded-lg bg-[#FBF0E2] px-3 py-2 text-sm text-[#8A5A12]">
          Switch on message 5 (Missed call) above to use this.
        </p>
      )}
      <input type="hidden" name="userId" value={picked?.id || ""} />
      {picked ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-[#ECE7E1] px-4 py-3">
          <span className="min-w-0 text-sm text-[#0D060C]">
            <span className="font-semibold">{picked.name}</span> <span className="text-[#6B6660]">{picked.phone}</span>
          </span>
          <button type="button" onClick={() => { setPicked(null); setQ(""); }} className="text-sm font-semibold text-[#B4690E] cursor-pointer">
            Change
          </button>
        </div>
      ) : (
        <div className="relative">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search patient by name, email or phone"
            aria-label="Search patient"
            className={inputClass}
          />
          {results.length > 0 && (
            <ul className="absolute z-10 mt-1 w-full rounded-lg border border-[#ECE7E1] bg-white shadow max-h-64 overflow-auto">
              {results.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => setPicked(r)}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-[#FBF0E2] cursor-pointer"
                  >
                    <span className="font-semibold text-[#0D060C]">{r.name}</span>{" "}
                    <span className="text-[#6B6660]">{r.phone} · {r.email}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <Notice state={state} />
      <div>
        <button type="submit" disabled={sending || !picked || !enabled || !ready} className={primaryBtn}>
          {sending ? "Sending..." : "Send missed-call SMS"}
        </button>
      </div>
    </form>
  );
}

export function TestSmsForm({ automations, ready }) {
  const [state, action, sending] = useActionState(useOnce(sendTestAction), initial);
  return (
    <form action={action} className="flex flex-col gap-3">
      <select name="id" aria-label="Message to test" className={inputClass} defaultValue={automations[0]?.id}>
        {automations.map((a) => (
          <option key={a.id} value={a.id}>
            {a.id.toUpperCase()}: {a.title}
          </option>
        ))}
      </select>
      <input name="phone" placeholder="Your mobile, e.g. 07700 900123" aria-label="Your mobile" className={inputClass} />
      <Notice state={state} />
      <div>
        <button type="submit" disabled={sending || !ready} className={secondaryBtn}>
          {sending ? "Sending..." : "Send test"}
        </button>
      </div>
    </form>
  );
}

export function OptOutList({ optOuts, ready }) {
  const [state, action, saving] = useActionState(addOptOutAction, initial);
  return (
    <div className="flex flex-col gap-4">
      <form action={action} className="flex flex-col md:flex-row gap-3">
        <input name="phone" placeholder="Mobile number" aria-label="Mobile number" className={inputClass} />
        <input name="note" placeholder="Note (optional)" aria-label="Note" className={inputClass} />
        <button type="submit" disabled={saving || !ready} className={`${secondaryBtn} shrink-0`}>
          {saving ? "Adding..." : "Add"}
        </button>
      </form>
      <Notice state={state} />
      {optOuts.length === 0 ? (
        <p className="text-sm text-[#6B6660]">No numbers yet.</p>
      ) : (
        <ul className="divide-y divide-[#ECE7E1] rounded-lg border border-[#ECE7E1]">
          {optOuts.map((o) => (
            <li key={o.phone} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
              <span className="min-w-0">
                <span className="font-semibold text-[#0D060C]">{o.phone}</span>{" "}
                <span className="text-[#6B6660]">{o.note}</span>
              </span>
              <form action={removeOptOutAction}>
                <input type="hidden" name="phone" value={o.phone} />
                <button type="submit" className="text-sm font-semibold text-[#9B2C22] cursor-pointer">
                  Remove
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const STATUS_STYLE = {
  sent: "bg-[#E7F4EC] text-[#1E6B3A]",
  failed: "bg-[#FBE7E5] text-[#9B2C22]",
  skipped: "bg-[#F4E7E1] text-[#0D060C]",
  sending: "bg-[#FBF0E2] text-[#8A5A12]",
};

export function SmsLogTable({ logs }) {
  if (!logs.length) return <p className="text-sm text-[#6B6660]">No messages yet.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[#6B6660]">
            <th className="py-2 pr-4 font-semibold">When</th>
            <th className="py-2 pr-4 font-semibold">Message</th>
            <th className="py-2 pr-4 font-semibold">To</th>
            <th className="py-2 pr-4 font-semibold">Status</th>
            <th className="py-2 font-semibold">Detail</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((l) => (
            <tr key={l.id} className="border-t border-[#ECE7E1] align-top">
              <td className="py-2 pr-4 whitespace-nowrap">
                {new Date(l.createdAt).toLocaleString("en-GB", { timeZone: "Europe/London", dateStyle: "short", timeStyle: "short" })}
              </td>
              <td className="py-2 pr-4 whitespace-nowrap">{l.automation.toUpperCase()}</td>
              <td className="py-2 pr-4 whitespace-nowrap">{l.to}</td>
              <td className="py-2 pr-4">
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLE[l.status] || ""}`}>
                  {l.status}
                </span>
              </td>
              <td className="py-2 text-[#6B6660] max-w-[40ch]">{l.error || l.sentBy || ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
