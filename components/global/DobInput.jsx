"use client";

// Typed date of birth: DD / MM / YYYY in one box, numeric keypad on mobile.
// Calls onChange with a Date (local midnight) when the text is a real past
// date, or null otherwise. Used by the register form (CC-11); the calendar
// DateField stays for the other forms.
import { useEffect, useState } from "react";

function toText(d) {
  if (!d) return "";
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function mask(raw) {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  const parts = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean);
  return parts.join("/");
}

// Returns { date } or { error } for a full DD/MM/YYYY text.
export function parseDob(text, today = new Date()) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);
  if (!m) return { error: "Enter your date of birth as DD/MM/YYYY." };
  const [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(y, mo - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d)
    return { error: "That date does not exist." };
  if (date > today) return { error: "Date of birth cannot be in the future." };
  if (today.getFullYear() - y > 120) return { error: "Please check the year." };
  return { date };
}

export default function DobInput({ id = "dob", label = "Date of Birth", selected, onChange, className }) {
  const [text, setText] = useState(toText(selected));
  const [error, setError] = useState("");
  useEffect(() => {
    if (selected && toText(selected) !== text) setText(toText(selected));
  }, [selected]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <label className="block text-base mb-2 text-[#0D060C]" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="bday"
        placeholder="DD/MM/YYYY"
        maxLength={10}
        value={text}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(e) => {
          const v = mask(e.target.value);
          setText(v);
          if (v.length === 10) {
            const res = parseDob(v);
            setError(res.error || "");
            onChange(res.date || null);
          } else {
            setError("");
            onChange(null);
          }
        }}
        onBlur={() => {
          if (text && text.length < 10) setError("Enter your date of birth as DD/MM/YYYY.");
        }}
        className={className}
      />
      {error ? (
        <p id={`${id}-error`} className="mt-1 text-sm text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
