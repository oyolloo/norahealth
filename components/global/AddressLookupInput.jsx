"use client";

import { useEffect, useId, useRef, useState } from "react";
import { normalisePostcode } from "@/lib/addressLookup";

let providerPromise;
function getProvider() {
  if (!providerPromise) {
    providerPromise = fetch("/api/address?action=config")
      .then((r) => (r.ok ? r.json() : { provider: "postcodes" }))
      .then((d) => d.provider || "postcodes")
      .catch(() => "postcodes");
  }
  return providerPromise;
}

const newSession = () =>
  typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Date.now());

/**
 * Text input with address or postcode suggestions.
 * kind="address": Google suggestions when the admin has turned Google on.
 * kind="postcode": free UK postcode suggestions and a format check when Google is off.
 * Works controlled (value + onChange) or uncontrolled (defaultValue); either way the
 * input keeps its name, so form submits are unchanged.
 */
export default function AddressLookupInput({
  kind,
  id,
  name,
  value,
  defaultValue = "",
  onChange,
  onPick,
  className = "",
  placeholder,
  readOnly = false,
}) {
  const controlled = value !== undefined;
  const [local, setLocal] = useState(defaultValue || "");
  const text = controlled ? value : local;

  const [provider, setProvider] = useState(null);
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [hint, setHint] = useState(null);
  const session = useRef(null);
  const timer = useRef(null);
  const listId = useId();

  useEffect(() => {
    let alive = true;
    getProvider().then((p) => alive && setProvider(p));
    return () => {
      alive = false;
      clearTimeout(timer.current);
    };
  }, []);

  const lookupOn =
    !readOnly &&
    ((kind === "address" && provider === "google") || (kind === "postcode" && provider === "postcodes"));

  function setText(v) {
    if (!controlled) setLocal(v);
    onChange?.({ target: { name, value: v } });
  }

  function search(q) {
    clearTimeout(timer.current);
    if (!lookupOn || q.trim().length < 2) {
      setItems([]);
      setOpen(false);
      return;
    }
    timer.current = setTimeout(async () => {
      try {
        if (!session.current) session.current = newSession();
        const r = await fetch(
          `/api/address?action=suggest&q=${encodeURIComponent(q)}&session=${session.current}`
        );
        const d = r.ok ? await r.json() : { suggestions: [] };
        setItems(d.suggestions || []);
        setActive(-1);
        setOpen((d.suggestions || []).length > 0);
      } catch {
        setItems([]);
        setOpen(false);
      }
    }, 250);
  }

  async function pick(item) {
    setOpen(false);
    setItems([]);
    try {
      const r = await fetch(
        `/api/address?action=details&id=${encodeURIComponent(item.id)}&session=${session.current || ""}`
      );
      const d = r.ok ? await r.json() : {};
      session.current = null;
      if (kind === "address") {
        const line = d.address?.line1 || item.label;
        setText(line);
        onPick?.({ line1: line, postcode: d.address?.postcode || "" });
      } else {
        const pc = d.address?.postcode || item.label;
        setText(pc);
        setHint(d.address?.area ? { ok: true, text: d.address.area } : null);
        onPick?.({ postcode: pc, area: d.address?.area || "" });
      }
    } catch {
      setText(item.label);
    }
  }

  function onBlur() {
    setTimeout(() => setOpen(false), 150);
    if (kind !== "postcode" || provider !== "postcodes" || readOnly) return;
    const raw = String(text || "").trim();
    if (!raw) return setHint(null);
    const pc = normalisePostcode(raw);
    if (!pc) return setHint({ ok: false, text: "This does not look like a UK postcode." });
    if (pc !== raw) setText(pc);
  }

  function onKeyDown(e) {
    if (!open || !items.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (a + 1) % items.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (a <= 0 ? items.length - 1 : a - 1));
    } else if (e.key === "Enter" && active >= 0) {
      e.preventDefault();
      pick(items[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="relative">
      <input
        id={id}
        name={name}
        type="text"
        value={text}
        placeholder={placeholder}
        readOnly={readOnly}
        autoComplete={lookupOn ? "off" : kind === "postcode" ? "postal-code" : "street-address"}
        role={lookupOn ? "combobox" : undefined}
        aria-expanded={lookupOn ? open : undefined}
        aria-controls={lookupOn ? listId : undefined}
        aria-autocomplete={lookupOn ? "list" : undefined}
        onChange={(e) => {
          setText(e.target.value);
          setHint(null);
          search(e.target.value);
        }}
        onKeyDown={onKeyDown}
        onBlur={onBlur}
        className={className}
      />
      {open && (
        <ul
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 z-30 mt-1 max-h-72 overflow-auto rounded-[8px] border border-[#EEE0CF] bg-white py-1 shadow-lg"
        >
          {items.map((it, i) => (
            <li
              key={it.id}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(it);
              }}
              onMouseEnter={() => setActive(i)}
              className={`cursor-pointer px-4 py-2.5 text-sm text-[#0D060C] ${
                i === active ? "bg-[#F4E7E1]" : ""
              }`}
            >
              {it.label}
            </li>
          ))}
          {provider === "google" && (
            <li className="px-4 pt-1 pb-1.5 text-right text-[11px] text-[#6B6660]" aria-hidden="true">
              Powered by Google
            </li>
          )}
        </ul>
      )}
      {hint && (
        <p className={`mt-1.5 text-xs ${hint.ok ? "text-[#1E6B3A]" : "text-[#B4690E]"}`}>{hint.text}</p>
      )}
    </div>
  );
}
