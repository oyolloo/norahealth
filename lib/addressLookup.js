// UK postcode: outward code (2-4 chars) + inward code (digit + 2 letters).
const POSTCODE_RE = /^([A-Z]{1,2}\d[A-Z\d]?)\s*(\d[A-Z]{2})$/;

export function normalisePostcode(input) {
  const s = String(input || "").toUpperCase().replace(/\s+/g, "");
  const m = s.match(POSTCODE_RE);
  return m ? `${m[1]} ${m[2]}` : null;
}

// Characters that can appear while a postcode is still being typed.
export function looksLikePartialPostcode(input) {
  const s = String(input || "").trim();
  return s.length >= 2 && s.length <= 8 && /^[A-Za-z]{1,2}\d[A-Za-z\d ]*$/.test(s);
}

export function parsePostcodeSuggestions(json) {
  return (json?.result || []).slice(0, 8).map((pc) => ({ id: pc, label: pc }));
}

export function parsePostcodeDetails(json) {
  const r = json?.result;
  if (!r?.postcode) return null;
  const area = [r.admin_district, r.region || r.country].filter(Boolean).join(", ");
  return { postcode: r.postcode, area };
}

export function parseGoogleSuggestions(json) {
  return (json?.suggestions || [])
    .map((s) => s.placePrediction)
    .filter((p) => p?.placeId && p?.text?.text)
    .map((p) => ({
      id: p.placeId,
      label: p.text.text.replace(/, UK$/, ""),
    }));
}

// Turn Place Details (New) addressComponents into one address line + postcode.
export function parseGoogleDetails(json) {
  const comps = json?.addressComponents || [];
  const get = (type) => comps.find((c) => c.types?.includes(type))?.longText || "";
  const street = [get("street_number"), get("route")].filter(Boolean).join(" ");
  const premise = [get("subpremise"), get("premise")].filter(Boolean).join(", ");
  const town = get("postal_town") || get("locality");
  const line1 = [premise, street || get("neighborhood"), town].filter(Boolean).join(", ");
  const postcode = normalisePostcode(get("postal_code")) || get("postal_code");
  return {
    line1: line1 || (json?.formattedAddress || "").replace(/, UK$/, ""),
    postcode,
  };
}
