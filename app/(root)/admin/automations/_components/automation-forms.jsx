"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  CalendarClock,
  CalendarX2,
  Clock,
  KeyRound,
  Lock,
  PanelLeft,
  Pencil,
  PhoneMissed,
  RefreshCcw,
  Send,
  UserPlus,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAdmin } from "@/lib/adminContext";
import {
  addOptOutAction,
  removeOptOutAction,
  saveAutomationAction,
  saveConnectionAction,
  searchPatientsAction,
  sendMissedCallAction,
  sendTestAction,
} from "@/actions/automations.action";
import { renderText, segmentsOf } from "@/lib/smsCore";

const initial = { success: null, msg: "" };
const SAMPLE = { first_name: "Emma", time_frame: "3pm and 4pm", appt_time: "3pm-4pm" };
const themeBtn = "bg-theme hover:bg-[#B4690E] text-white";

// Shows each server action result as a toast, like the order pages do.
function useToastResult(state) {
  useEffect(() => {
    if (!state?.msg) return;
    if (state.success) toast.success(state.msg);
    else toast.error(state.msg);
  }, [state]);
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

function Toggle({ id, name, checked, onChange, disabled, label }) {
  return (
    <label
      htmlFor={id}
      className={`relative inline-flex shrink-0 ${disabled ? "cursor-not-allowed" : "cursor-pointer"}`}
    >
      <span className="sr-only">{label}</span>
      <input
        id={id}
        name={name}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <span className="h-6 w-11 rounded-full bg-[#D9D2CB] transition-colors peer-checked:bg-[#CD8936] peer-focus-visible:ring-2 peer-focus-visible:ring-[#CD8936]/50 peer-disabled:opacity-50" />
      <span className="absolute left-0.5 top-0.5 size-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
    </label>
  );
}

// Header in the same shape as the Orders and Appointments pages, including
// the round menu button that opens the sidebar on mobile.
export function AutomationsHeader({ enabled, live, total }) {
  const { setMenuOpen } = useAdmin();
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-4">
        <button
          onClick={() => setMenuOpen(true)}
          aria-label="Open menu"
          className="lg:hidden w-[40px] h-[40px] bg-[#d67b0e] text-white flex justify-center items-center rounded-full"
        >
          <PanelLeft />
        </button>
        <div>
          <h2 className="text-xl font-semibold">Automations</h2>
          <p className="text-sm text-[#6B6660]">Text messages sent to patients through Recallo24.</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Badge
          variant="outline"
          className={
            enabled ? "border-[#BFE3CC] bg-[#E7F4EC] text-[#1E6B3A]" : "border-[#ECE7E1] bg-[#F4E7E1] text-heading"
          }
        >
          <span className={`size-1.5 rounded-full ${enabled ? "bg-[#1E6B3A]" : "bg-[#9A938C]"}`} />
          {enabled ? "SMS on" : "SMS off"}
        </Badge>
        <Badge variant="outline" className="border-[#ECE7E1] bg-white text-[#3A3D42]">
          {live} of {total} messages on
        </Badge>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, children }) {
  return (
    <div className="flex gap-3 rounded-xl border border-[#ECE7E1] bg-[#FAF9F8] p-4 min-w-0">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#FBF0E2] text-theme">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        <p className="text-xs text-[#6B6660]">{label}</p>
        <p className="text-sm font-medium text-heading">{children}</p>
      </div>
    </div>
  );
}

export function ConnectionPanel({ enabled, hasKey, keyHint, ready, balance, cronReady }) {
  const [on, setOn] = useState(enabled);
  const [state, action, saving] = useActionState(saveConnectionAction, initial);
  useToastResult(state);
  return (
    <section className="rounded-2xl border border-[#ECE7E1] bg-white p-5 md:p-6 flex flex-col gap-5 min-w-0">
      <div>
        <h3 className="text-base font-semibold text-heading">SMS connection</h3>
        <p className="text-sm text-[#6B6660]">The main switch and the Recallo24 account the texts are sent from.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Stat icon={KeyRound} label="Recallo24 account">
          {hasKey ? `Connected (key ${keyHint})` : "Not connected"}
        </Stat>
        <Stat icon={Wallet} label="Credit balance">
          {!balance ? "Shown after connecting" : balance.error ? "Could not read the balance" : `${balance.credits} credits`}
        </Stat>
        <Stat icon={Clock} label="Scheduled sending">
          {cronReady ? "Checks every hour" : "Not set up on the server"}
        </Stat>
      </div>
      <form action={action} className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4 rounded-xl border border-[#ECE7E1] p-4">
          <div className="min-w-0">
            <p className="font-medium text-heading">Send SMS</p>
            <p className="text-sm text-[#6B6660]">When this is off nothing is sent, whatever the switches below say.</p>
          </div>
          <Toggle id="sms-enabled" name="enabled" checked={on} onChange={setOn} label="Send SMS" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-3 items-end">
          <div className="flex flex-col gap-1.5 min-w-0">
            <label htmlFor="sms-apiKey" className="text-xs text-gray-600">
              Recallo24 API key
            </label>
            <Input
              id="sms-apiKey"
              name="apiKey"
              type="password"
              autoComplete="off"
              spellCheck={false}
              placeholder={hasKey ? `Saved (${keyHint}). Paste a new key to replace it.` : "rk_live_..."}
              className="bg-white"
            />
          </div>
          <Button type="submit" className={themeBtn} disabled={saving || !ready}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#6B6660]">
          <span>Create the key in Recallo24 under Settings, API keys. It is kept on the server only.</span>
          {hasKey && (
            <label htmlFor="sms-clearKey" className="flex items-center gap-2 text-[#3A3D42]">
              <input id="sms-clearKey" name="clearKey" type="checkbox" className="size-4 accent-[#CD8936]" />
              Remove the saved key
            </label>
          )}
        </div>
      </form>
    </section>
  );
}

const GROUPS = [
  { title: "After sign-up", hint: "Only for people who sign up after the message is switched on.", ids: ["1a", "1b"] },
  { title: "Appointments", hint: "Uses the booking and order slots.", ids: ["2", "3"] },
  { title: "OC reviews", hint: "Needs the Future Appt Date on orders first.", ids: ["4a", "4b"] },
  { title: "Sent by your team", hint: "Only goes out when someone presses send.", ids: ["5"] },
];

const ICONS = {
  "1a": UserPlus,
  "1b": UserPlus,
  2: CalendarClock,
  3: CalendarX2,
  "4a": CalendarClock,
  "4b": RefreshCcw,
  5: PhoneMissed,
};

const hourText = (h) => `${h % 12 || 12}${h >= 12 ? "pm" : "am"}`;
const HOURS = Array.from({ length: 16 }, (_, i) => i + 6);

function whenText(a) {
  if (a.hour === undefined) return a.when;
  const h = hourText(a.hour);
  if (a.id === "4b") return `${h}, 28 days before the Future Appt Date`;
  if (a.id === "4a") return `${h} on the Future Appt Date`;
  if (a.id === "3") return `${h} on the day it is marked Failed Encounter`;
  return `${h} on the day of the appointment`;
}

// What the patient sees: a phone-style message bubble with a sample name.
function SmsBubble({ text }) {
  return (
    <div className="rounded-xl bg-[#F4F1EE] p-3">
      <div className="max-w-[46ch] whitespace-pre-line rounded-2xl rounded-bl-sm bg-white px-3.5 py-2.5 text-sm leading-relaxed text-[#3A3D42] shadow-xs">
        {renderText(text, SAMPLE)}
      </div>
    </div>
  );
}

function MessageRow({ a, ready, smsOn }) {
  const [on, setOn] = useState(a.enabled);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(a.text);
  const [hour, setHour] = useState(a.hour === undefined ? undefined : String(a.hour));
  const [state, action, saving] = useActionState(saveAutomationAction, initial);
  const toggleForm = useRef(null);
  useToastResult(state);
  useEffect(() => {
    if (state?.success) setOpen(false);
    if (state?.success === false) setOn(a.enabled);
  }, [state, a.enabled]);

  const Icon = ICONS[a.id] || Send;
  const parts = segmentsOf(text);
  const savedParts = segmentsOf(a.text);
  const fields = (
    <>
      <input type="hidden" name="id" value={a.id} />
      <input type="hidden" name="text" value={text} />
      {hour !== undefined && <input type="hidden" name="hour" value={hour} />}
    </>
  );

  return (
    <div
      className={`rounded-xl border p-4 flex flex-col gap-3 min-w-0 transition-colors ${
        on ? "border-[#EBD3B4] bg-white" : "border-[#ECE7E1] bg-[#FAF9F8]"
      }`}
    >
      <div className="flex items-start gap-3">
        <span
          className={`flex size-9 shrink-0 items-center justify-center rounded-full ${
            on ? "bg-[#FBF0E2] text-theme" : "bg-[#EFEBE7] text-[#9A938C]"
          }`}
        >
          <Icon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-heading">{a.title}</p>
          <p className="text-xs text-[#6B6660]">{whenText(a)}</p>
        </div>
        {a.ready ? (
          <form ref={toggleForm} action={action}>
            {fields}
            <Toggle
              id={`auto-${a.id}`}
              name="enabled"
              checked={on}
              disabled={!ready || saving}
              label={`Switch ${a.title}`}
              onChange={(v) => {
                setOn(v);
                requestAnimationFrame(() => toggleForm.current?.requestSubmit());
              }}
            />
          </form>
        ) : (
          <Badge variant="outline" className="border-[#ECE7E1] bg-white text-[#6B6660]">
            <Lock /> Coming soon
          </Badge>
        )}
      </div>

      <SmsBubble text={a.text} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-[#6B6660] min-w-0">
          {a.ready ? a.conditions : a.waiting} · {savedParts} SMS credit{savedParts === 1 ? "" : "s"} each
          {on && !smsOn ? " · waiting for the main switch" : ""}
        </p>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setOpen(true)}
          disabled={!ready}
          className="text-theme hover:text-[#B4690E]"
        >
          <Pencil /> Edit
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[620px]">
          <DialogHeader>
            <DialogTitle>{a.title}</DialogTitle>
            <DialogDescription>{a.conditions}</DialogDescription>
          </DialogHeader>
          <form action={action} className="flex flex-col gap-4">
            {fields}
            {on && <input type="hidden" name="enabled" value="on" />}
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`text-${a.id}`} className="text-xs text-gray-600">
                Message
              </label>
              <textarea
                id={`text-${a.id}`}
                rows={6}
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="w-full resize-y rounded-md border border-input bg-white px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              />
              <p className="text-xs text-[#6B6660]">
                {text.length} characters, {parts} SMS credit{parts === 1 ? "" : "s"} per patient. You can use{" "}
                {"{first_name}"}
                {a.id === "2" || a.id === "4a" ? ", {time_frame}" : ""}
                {a.id === "3" ? ", {appt_time}" : ""}.
              </p>
            </div>
            {hour !== undefined && (
              <div className="flex flex-col gap-1.5">
                <span className="text-xs text-gray-600">Send at (UK time)</span>
                <Select value={hour} onValueChange={setHour}>
                  <SelectTrigger className="w-[140px] bg-white" aria-label="Send at">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {HOURS.map((h) => (
                      <SelectItem key={h} value={String(h)}>
                        {hourText(h)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <span className="text-xs text-gray-600">Preview with a sample name</span>
              <SmsBubble text={text} />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setText(a.text);
                  setOpen(false);
                }}
              >
                Cancel
              </Button>
              <Button type="submit" className={themeBtn} disabled={saving}>
                {saving ? "Saving..." : "Save message"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function MessageGroups({ automations, ready, smsOn }) {
  const byId = Object.fromEntries(automations.map((a) => [a.id, a]));
  return (
    <section className="rounded-2xl border border-[#ECE7E1] bg-white p-5 md:p-6 flex flex-col gap-6 min-w-0">
      <div>
        <h3 className="text-base font-semibold text-heading">Messages</h3>
        <p className="text-sm text-[#6B6660]">
          Each message has its own switch. The bubble shows what the patient receives.
        </p>
      </div>
      {GROUPS.map((g) => (
        <div key={g.title} className="flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline gap-x-3">
            <h4 className="text-sm font-semibold text-theme">{g.title}</h4>
            <span className="text-xs text-[#6B6660]">{g.hint}</span>
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
            {g.ids.map((id) => byId[id] && <MessageRow key={id} a={byId[id]} ready={ready} smsOn={smsOn} />)}
          </div>
        </div>
      ))}
    </section>
  );
}

export function MissedCallForm({ enabled, ready }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [picked, setPicked] = useState(null);
  const [state, action, sending] = useActionState(useOnce(sendMissedCallAction), initial);
  useToastResult(state);

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
          Switch on Send SMS and the Missed call message to use this.
        </p>
      )}
      <input type="hidden" name="userId" value={picked?.id || ""} />
      {picked ? (
        <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
          <span className="min-w-0 text-sm">
            <span className="font-medium text-heading">{picked.name}</span>{" "}
            <span className="text-[#6B6660]">{picked.phone}</span>
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setPicked(null);
              setQ("");
            }}
          >
            Change
          </Button>
        </div>
      ) : (
        <div className="relative">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name, email or phone"
            aria-label="Search patient"
            className="bg-white"
          />
          {results.length > 0 && (
            <ul className="absolute z-10 mt-1 w-full rounded-md border bg-white shadow-md max-h-64 overflow-auto">
              {results.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => setPicked(r)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-[#FBF0E2] cursor-pointer"
                  >
                    <span className="font-medium text-heading">{r.name}</span>{" "}
                    <span className="text-[#6B6660]">
                      {r.phone} · {r.email}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <div>
        <Button type="submit" className={themeBtn} disabled={sending || !picked || !enabled || !ready}>
          <PhoneMissed /> {sending ? "Sending..." : "Send missed-call text"}
        </Button>
      </div>
    </form>
  );
}

export function TestSmsForm({ automations, ready }) {
  const [id, setId] = useState(automations[0]?.id);
  const [state, action, sending] = useActionState(useOnce(sendTestAction), initial);
  useToastResult(state);
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={id} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Select value={id} onValueChange={setId}>
          <SelectTrigger className="w-full bg-white" aria-label="Message to test">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {automations.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input name="phone" placeholder="Your mobile, e.g. 07700 900123" aria-label="Your mobile" className="bg-white" />
      </div>
      <div>
        <Button type="submit" variant="outline" disabled={sending || !ready}>
          <Send /> {sending ? "Sending..." : "Send test"}
        </Button>
      </div>
    </form>
  );
}

export function OptOutList({ optOuts, ready }) {
  const [state, action, saving] = useActionState(addOptOutAction, initial);
  useToastResult(state);
  return (
    <div className="flex flex-col gap-4">
      <form action={action} className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-3">
        <Input name="phone" placeholder="Mobile number" aria-label="Mobile number" className="bg-white" />
        <Input name="note" placeholder="Note (optional)" aria-label="Note" className="bg-white" />
        <Button type="submit" variant="outline" disabled={saving || !ready}>
          {saving ? "Adding..." : "Add number"}
        </Button>
      </form>
      {optOuts.length === 0 ? (
        <p className="text-sm text-[#6B6660]">No numbers yet.</p>
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Number</TableHead>
                <TableHead>Note</TableHead>
                <TableHead>Added</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {optOuts.map((o) => (
                <TableRow key={o.phone}>
                  <TableCell className="font-medium">{o.phone}</TableCell>
                  <TableCell className="text-[#6B6660]">{o.note}</TableCell>
                  <TableCell className="text-[#6B6660]">{new Date(o.createdAt).toLocaleDateString("en-GB")}</TableCell>
                  <TableCell className="text-right">
                    <form action={removeOptOutAction}>
                      <input type="hidden" name="phone" value={o.phone} />
                      <Button type="submit" variant="ghost" size="sm" className="text-[#9B2C22]">
                        Remove
                      </Button>
                    </form>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

const STATUS_STYLE = {
  sent: "border-[#BFE3CC] bg-[#E7F4EC] text-[#1E6B3A]",
  failed: "border-[#F1C9C4] bg-[#FBE7E5] text-[#9B2C22]",
  skipped: "border-[#ECE7E1] bg-[#F4F1EE] text-[#3A3D42]",
  sending: "border-[#EBD3B4] bg-[#FBF0E2] text-[#8A5A12]",
};

export function SmsLogTable({ logs }) {
  if (!logs.length) return <p className="text-sm text-[#6B6660]">No messages yet.</p>;
  return (
    <div className="rounded-md border overflow-x-auto">
      <Table className="min-w-max">
        <TableHeader>
          <TableRow>
            <TableHead>When</TableHead>
            <TableHead>Message</TableHead>
            <TableHead>To</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Detail</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {logs.map((l) => (
            <TableRow key={l.id}>
              <TableCell>
                {new Date(l.createdAt).toLocaleString("en-GB", {
                  timeZone: "Europe/London",
                  dateStyle: "short",
                  timeStyle: "short",
                })}
              </TableCell>
              <TableCell>{l.automation.toUpperCase()}</TableCell>
              <TableCell>{l.to}</TableCell>
              <TableCell>
                <Badge variant="outline" className={STATUS_STYLE[l.status] || ""}>
                  {l.status}
                </Badge>
              </TableCell>
              <TableCell className="text-[#6B6660] whitespace-normal max-w-[40ch]">{l.error || l.sentBy || ""}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
