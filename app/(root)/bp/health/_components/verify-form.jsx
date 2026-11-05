"use client";

import { useActionState } from "react";
import { verifyBpPatientAction } from "@/actions/bpVerify.action";

export default function VerifyForm() {
  const [state, action, pending] = useActionState(verifyBpPatientAction, null);
  return (
    <form action={action} className="flex flex-col gap-4">
      <div>
        <label htmlFor="dob" className="block text-sm font-medium text-[#0D060C]">
          Date of birth
        </label>
        <input
          id="dob"
          name="dob"
          type="date"
          required
          className="mt-1 w-full rounded-lg border border-[#E7D8C6] px-3 py-2.5 text-sm"
        />
      </div>
      <div>
        <label htmlFor="phone" className="block text-sm font-medium text-[#0D060C]">
          Mobile number
        </label>
        <input
          id="phone"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="07..."
          required
          className="mt-1 w-full rounded-lg border border-[#E7D8C6] px-3 py-2.5 text-sm"
        />
        <p className="mt-1 text-xs text-muted-foreground">The number this text was sent to.</p>
      </div>
      {state?.msg && (
        <p role="alert" className="rounded-lg bg-[#FDECEA] px-3 py-2 text-sm text-[#B42318]">
          {state.msg}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-[#D6866B] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#c5755a] disabled:opacity-60"
      >
        {pending ? "Checking..." : "Continue"}
      </button>
    </form>
  );
}
