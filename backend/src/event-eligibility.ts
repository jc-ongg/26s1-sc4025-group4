import type { Gender } from "@prisma/client";

export type DinerIdentity = {
  id: string;
  singpassVerified: boolean;
  dateOfBirth: Date | null;
  gender: Gender | null;
  suspendedUntil?: Date | null;
  blockedUserIds?: string[];
};
export type EventFilters = {
  genderFilter: Gender | null;
  minAge: number | null;
  maxAge: number | null;
};

// Birth dates are date-only. Shift the comparison date to Singapore's calendar
// before checking birthdays, so eligibility does not change at UTC midnight.
export function ageAt(birthDate: Date | null, at = new Date()): number | null {
  if (!birthDate) return null;
  const day = new Date(at.getTime() + 8 * 3600000).toISOString().slice(0, 10);
  const birth = birthDate.toISOString().slice(0, 10);
  return (
    Number(day.slice(0, 4)) -
    Number(birth.slice(0, 4)) -
    Number(day.slice(5) < birth.slice(5))
  );
}

export function verifiedAdult(diner: DinerIdentity, now = new Date()) {
  const age = ageAt(diner.dateOfBirth, now);
  return diner.singpassVerified && diner.gender !== null && age !== null && age >= 18;
}

export function matchesEvent(
  diner: DinerIdentity,
  event: EventFilters & {
    slot: { startsAt: Date };
    hostId?: string;
    members?: { userId: string }[];
  },
  now = new Date(),
) {
  if (!verifiedAdult(diner, now)) return false;
  if (diner.suspendedUntil && diner.suspendedUntil > now) return false;
  const participants = [event.hostId, ...(event.members?.map((m) => m.userId) ?? [])];
  if (diner.blockedUserIds?.some((id) => participants.includes(id))) return false;
  const age = ageAt(diner.dateOfBirth, event.slot.startsAt)!;
  return (
    (!event.genderFilter || event.genderFilter === diner.gender) &&
    age >= (event.minAge ?? 18) &&
    age <= (event.maxAge ?? 120)
  );
}

export function canViewEvent(
  diner: DinerIdentity,
  event: EventFilters & {
    hostId: string;
    members: { userId: string }[];
    slot: { startsAt: Date };
  },
) {
  // Retain access to a diner's own reservations, including legacy history.
  return (
    event.hostId === diner.id ||
    event.members.some((m) => m.userId === diner.id) ||
    matchesEvent({ ...diner, suspendedUntil: null }, event)
  );
}

export function parseEventFilters(body: Record<string, unknown>): EventFilters | null {
  const genderFilter = body.genderFilter ?? null;
  const minAge = body.minAge ?? null;
  const maxAge = body.maxAge ?? null;
  const validAge = (v: unknown) =>
    v === null || (typeof v === "number" && Number.isInteger(v) && v >= 18 && v <= 120);
  if (
    ![null, "MALE", "FEMALE"].includes(genderFilter as string | null) ||
    !validAge(minAge) ||
    !validAge(maxAge) ||
    (maxAge !== null && (maxAge as number) < ((minAge as number | null) ?? 18))
  )
    return null;
  return { genderFilter, minAge, maxAge } as EventFilters;
}
