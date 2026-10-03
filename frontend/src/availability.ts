import type { Group, Restaurant } from "./types";

export const dinerCount = (group: Pick<Group, "members">) =>
  group.members.reduce((total, party) => total + party.partySize, 0);

export const canJoinEvent = (group: Group, now = Date.now()) =>
  ["OPEN", "FULL", "CONFIRMED"].includes(group.status) &&
  !hasStarted(group.slot.startsAt, now) &&
  dinerCount(group) < group.capacity;

export function hasStarted(startsAt: string, now = Date.now()) {
  return new Date(startsAt).getTime() <= now;
}

export function availableSlots(restaurant: Restaurant, now = Date.now()) {
  return restaurant.active
    ? restaurant.slots.filter(
        (slot) => !slot.allocation && !hasStarted(slot.startsAt, now),
      )
    : [];
}

export function currentGroupStatus(
  group: Pick<Group, "status" | "slot">,
  now = Date.now(),
): Group["status"] {
  // The display can cross the start time before the next server expiry check.
  return ["OPEN", "FULL"].includes(group.status) && hasStarted(group.slot.startsAt, now)
    ? "EXPIRED"
    : group.status;
}
