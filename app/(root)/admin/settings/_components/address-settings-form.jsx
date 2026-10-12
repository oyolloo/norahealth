"use client";

import { useActionState, useState } from "react";
import { saveAddressSettingsAction, testGoogleKeyAction } from "@/actions/settings.action";
import ApiKeyHelp from "./api-key-help";

const initial = { success: null, msg: "" };

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

export default function AddressSettingsForm({ enabled, hasKey, keyHint, ready }) {
  const [on, setOn] = useState(enabled);
  const [saveState, saveAction, saving] = useActionState(saveAddressSettingsAction, initial);
  const [testState, testAction, testing] = useActionState(testGoogleKeyAction, initial);

  return (
    <form action={saveAction} className="flex flex-col gap-5 max-w-[640px]">
      <label htmlFor="enabled" className="flex items-center justify-between gap-4 rounded-xl border border-[#ECE7E1] p-4 cursor-pointer">
        <span className="min-w-0">
          <span className="block font-semibold text-[#0D060C]">Google address search</span>
          <span className="block text-sm text-[#6B6660]">
            When on, patients pick their address from Google suggestions instead of the postcode lookup.
          </span>
        </span>
        <span className="relative inline-flex shrink-0">
          <input
            id="enabled"
            name="enabled"
            type="checkbox"
            checked={on}
            onChange={(e) => setOn(e.target.checked)}
            className="peer sr-only"
          />
          <span className="h-7 w-12 rounded-full bg-[#D9D2CB] transition peer-checked:bg-[#CE8936] peer-focus-visible:ring-2 peer-focus-visible:ring-[#CE8936]/50" />
          <span className="absolute left-1 top-1 size-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
        </span>
      </label>

      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-1.5">
          <label htmlFor="apiKey" className="text-sm font-semibold text-[#0D060C]">
            Google API key
          </label>
          <ApiKeyHelp />
        </div>
        <input
          id="apiKey"
          name="apiKey"
          type="password"
          autoComplete="off"
          spellCheck={false}
          placeholder={hasKey ? `Saved key ${keyHint}. Paste a new key to replace it.` : "Paste your API key"}
          className="w-full rounded-lg border border-[#EEE0CF] bg-white px-4 py-3 text-sm text-[#0D060C] outline-none focus:border-[#CE8936]"
        />
        <p className="text-xs text-[#6B6660]">
          The key is kept on the server and never shown to patients. Leave this empty to keep the saved key.
        </p>
        {hasKey && (
          <label htmlFor="clearKey" className="flex items-center gap-2 text-sm text-[#3A3D42]">
            <input id="clearKey" name="clearKey" type="checkbox" className="size-4 accent-[#CE8936]" />
            Remove the saved key
          </label>
        )}
      </div>

      <Notice state={testState} />
      <Notice state={saveState} />

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          formAction={testAction}
          disabled={testing}
          className="rounded-full border border-[#CE8936] px-5 py-2.5 text-sm font-semibold text-[#B4690E] hover:bg-[#FBF0E2] disabled:opacity-60"
        >
          {testing ? "Testing..." : "Test key"}
        </button>
        <button
          type="submit"
          disabled={saving || !ready}
          className="rounded-full bg-[#CE8936] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#B4690E] disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
    </form>
  );
}
