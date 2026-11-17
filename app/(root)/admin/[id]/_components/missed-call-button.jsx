"use client";

// CC-31: send the missed-call SMS from the patient record (client, 17 Nov).
// Uses the same server action as the Automations page card, so the same
// switches, 10-minute guard, do-not-text list and log apply.
import { useActionState, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { PhoneMissed } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getMissedCallPreviewAction, sendMissedCallAction } from "@/actions/automations.action";

const initial = { success: null, msg: "" };

export default function MissedCallButton({ userId }) {
  const [open, setOpen] = useState(false);
  const [info, setInfo] = useState(null);
  const busy = useRef(false);
  const [state, action, sending] = useActionState(async (prev, formData) => {
    if (busy.current) return prev; // one click never sends two texts
    busy.current = true;
    try {
      return await sendMissedCallAction(prev, formData);
    } finally {
      busy.current = false;
    }
  }, initial);

  useEffect(() => {
    if (!state?.msg) return;
    if (state.success) {
      toast.success(state.msg);
      setOpen(false);
    } else toast.error(state.msg);
  }, [state]);

  useEffect(() => {
    if (!open) return;
    let live = true;
    setInfo(null);
    getMissedCallPreviewAction(userId)
      .then((r) => live && setInfo(r))
      .catch(() => live && setInfo({ success: false, msg: "Could not load the message." }));
    return () => {
      live = false;
    };
  }, [open, userId]);

  const problem = info && (info.success === false ? info.msg : info.blocked);

  return (
    <>
      <Button type="button" variant="outline" className="ml-auto shrink-0" onClick={() => setOpen(true)}>
        <PhoneMissed /> <span className="hidden sm:inline">Missed-call text</span>
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Send missed-call text</DialogTitle>
            <DialogDescription>After an unanswered call, send the missed-call message to this patient.</DialogDescription>
          </DialogHeader>
          {!info ? (
            <p className="text-sm text-[#6B6660]">Loading…</p>
          ) : (
            <div className="flex flex-col gap-3">
              {info.success !== false && (
                <div className="rounded-md border px-3 py-2 text-sm">
                  <span className="font-medium text-heading">{info.name}</span>{" "}
                  <span className="text-[#6B6660]">{info.phone || "No phone number"}</span>
                </div>
              )}
              {info.text ? (
                <div className="rounded-xl bg-[#F4F1EE] p-3">
                  <p className="rounded-lg bg-white px-3.5 py-2.5 text-sm leading-relaxed text-[#3A3D42] shadow-xs whitespace-pre-line">
                    {info.text}
                  </p>
                </div>
              ) : null}
              {problem ? (
                <p className="rounded-lg bg-[#FBF0E2] px-3 py-2 text-sm text-[#8A5A12]">{problem}</p>
              ) : null}
            </div>
          )}
          <form action={action}>
            <input type="hidden" name="userId" value={userId} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-theme hover:bg-[#B4690E] text-white"
                disabled={sending || !info || Boolean(problem)}
              >
                <PhoneMissed /> {sending ? "Sending..." : "Send missed-call text"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
