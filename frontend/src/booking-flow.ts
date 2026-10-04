import type { Group, Slot } from "./types";
import { dinerCount, hasStarted, currentGroupStatus } from "./availability";

export function slotState(slot: Slot, active: boolean, now = Date.now()) {
  if (!active || hasStarted(slot.startsAt, now)) return "unavailable";
  // A held Event is still discoverable, including after its reservation confirms.
  if (slot.allocation?.groupId) return "event";
  return slot.allocation ? "reserved" : "available";
}

export function eventJoinState(
  event: Group,
  partySize: number,
  userId: string,
  now = Date.now(),
) {
  if (event.members.some((party) => party.userId === userId)) return "joined";
  if (
    !event.slot.restaurant.active ||
    !["OPEN", "FULL", "CONFIRMED"].includes(currentGroupStatus(event, now)) ||
    hasStarted(event.slot.startsAt, now)
  )
    return "closed";
  if (dinerCount(event) >= event.capacity) return "full";
  if (partySize >= event.slot.minimumPartySize) return "direct";
  if (partySize < 1 || partySize > event.capacity - dinerCount(event))
    return "insufficient";
  return "eligible";
}
