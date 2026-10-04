import type { Group, Restaurant } from "./types";

export const dinerCount = (group: Pick<Group, "members">) =>
  group.members.reduce((total, party) => total + party.partySize, 0);

export const isUpcomingEvent = (group: Group, now = Date.now()) =>
  group.slot.restaurant.active &&
  ["OPEN", "FULL", "CONFIRMED"].includes(group.status) &&
  !hasStarted(group.slot.startsAt, now);

export const canJoinEvent = (group: Group, now = Date.now()) =>
  isUpcomingEvent(group, now) && dinerCount(group) < group.capacity;

export function upcomingEventCounts(groups: Group[], now = Date.now()) {
  const counts = new Map<string, number>();
  for (const group of groups) {
    if (!isUpcomingEvent(group, now)) continue;
    const id = group.slot.restaurant.id;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}

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
