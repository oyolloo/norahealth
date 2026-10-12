const OC_TYPE_LABELS = {
  SAME_OC: "Same",
  DIFFERENT_OC: "New",
  MORNING_AFTER_PILL: "MAP",
};

const ORDER = ["SAME_OC", "DIFFERENT_OC", "MORNING_AFTER_PILL"];

export function ocTypeLabel(ocRequest) {
  if (!Array.isArray(ocRequest)) return null;
  const labels = ORDER.filter((k) => ocRequest.includes(k)).map(
    (k) => OC_TYPE_LABELS[k]
  );
  return labels.length ? labels.join(" / ") : null;
}
