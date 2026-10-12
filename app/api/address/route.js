// Address lookup for patient forms. The browser only talks to this route, so
// the Google key never leaves the server.
//
//   /api/address?action=config
//   /api/address?action=suggest&q=...&session=...
//   /api/address?action=details&id=...&session=...

import { getAddressSettings } from "@/lib/settings";
import {
  looksLikePartialPostcode,
  normalisePostcode,
  parseGoogleDetails,
  parseGoogleSuggestions,
  parsePostcodeDetails,
  parsePostcodeSuggestions,
} from "@/lib/addressLookup";

export const dynamic = "force-dynamic";

let cached = { at: 0, value: null };
async function settings() {
  if (!cached.value || Date.now() - cached.at > 60_000) {
    cached = { at: Date.now(), value: await getAddressSettings() };
  }
  return cached.value;
}

const hits = new Map();
function limited(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < 60_000);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > 60;
}

const json = (body, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function GET(req) {
  const url = new URL(req.url);
  const action = url.searchParams.get("action");
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const s = await settings();

  if (action === "config") return json({ provider: s.provider });
  if (limited(ip)) return json({ error: "Too many requests" }, 429);

  const session = (url.searchParams.get("session") || "").slice(0, 64);

  try {
    if (action === "suggest") {
      const q = (url.searchParams.get("q") || "").trim().slice(0, 120);
      if (s.provider === "google") {
        if (q.length < 3) return json({ suggestions: [] });
        const r = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": s.apiKey,
            "X-Goog-FieldMask": "suggestions.placePrediction.placeId,suggestions.placePrediction.text",
          },
          body: JSON.stringify({
            input: q,
            includedRegionCodes: ["gb"],
            languageCode: "en-GB",
            ...(session ? { sessionToken: session } : {}),
          }),
        });
        if (!r.ok) return json({ suggestions: [], error: "lookup_failed" }, 502);
        return json({ suggestions: parseGoogleSuggestions(await r.json()) });
      }
      if (!looksLikePartialPostcode(q)) return json({ suggestions: [] });
      const r = await fetch(
        `https://api.postcodes.io/postcodes/${encodeURIComponent(q)}/autocomplete?limit=8`
      );
      if (!r.ok) return json({ suggestions: [] });
      return json({ suggestions: parsePostcodeSuggestions(await r.json()) });
    }

    if (action === "details") {
      const id = (url.searchParams.get("id") || "").slice(0, 300);
      if (!id) return json({ error: "Missing id" }, 400);
      if (s.provider === "google") {
        const qs = session ? `?sessionToken=${encodeURIComponent(session)}` : "";
        const r = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(id)}${qs}`, {
          headers: {
            "X-Goog-Api-Key": s.apiKey,
            "X-Goog-FieldMask": "formattedAddress,addressComponents",
          },
        });
        if (!r.ok) return json({ error: "lookup_failed" }, 502);
        return json({ address: parseGoogleDetails(await r.json()) });
      }
      const pc = normalisePostcode(id);
      if (!pc) return json({ address: null });
      const r = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(pc)}`);
      if (!r.ok) return json({ address: null });
      return json({ address: parsePostcodeDetails(await r.json()) });
    }
  } catch (err) {
    console.error("address lookup failed:", err?.message);
    return json({ error: "lookup_failed" }, 502);
  }

  return json({ error: "Unknown action" }, 400);
}
