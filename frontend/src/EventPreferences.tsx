import type { Group } from "./types";

export function eventPreferenceLabel(
  event: Pick<Group, "genderFilter" | "minAge" | "maxAge">,
) {
  const gender =
    event.genderFilter === "FEMALE"
      ? "Women"
      : event.genderFilter === "MALE"
        ? "Men"
        : "";
  const ages = event.maxAge
    ? `Ages ${event.minAge ?? 18}–${event.maxAge}`
    : event.minAge && event.minAge > 18
      ? `Ages ${event.minAge}+`
      : "";
  return [gender, ages].filter(Boolean).join(" · ");
}

export function EventPreferences({ event }: { event: Group }) {
  const label = eventPreferenceLabel(event);
  return label ? <p className="small event-preferences-label">{label}</p> : null;
}
