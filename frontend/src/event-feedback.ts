import type { Group } from "./types";
import { currentGroupStatus, dinerCount } from "./availability";

export function reservationProgress(group: Group, now = Date.now()) {
  const status = currentGroupStatus(group, now);
  if (status === "CONFIRMED") return "Reservation confirmed.";
  if (status === "LAST_CALL")
    return "Last Call · refill before dining time to keep the discount.";
  if (status === "PRICE_DECISION")
    return "Cutoff reached · choose full price or decline.";
  if (status === "FULL_PRICE") return "Reservation confirmed at full price.";
  if (status === "CANCELLED") return "Event cancelled.";
  if (status === "EXPIRED") return "Event expired without confirmation.";
  const missing = Math.max(0, group.slot.minimumPartySize - dinerCount(group));
  return `Reservation pending · ${missing} more ${missing === 1 ? "diner" : "diners"} needed.`;
}

export function eventUpdateMessage(
  previous: Group | null,
  current: Group,
  userId: string,
  now = Date.now(),
) {
  // Initial reads and a different Event are not live changes to announce.
  if (!previous || previous.id !== current.id) return "";
  const updates: string[] = [];
  if (previous.status !== current.status) updates.push(reservationProgress(current, now));
  if (previous.hostId !== current.hostId) {
    updates.push(
      current.hostId === userId
        ? "You are now the Host."
        : `${current.host.name} is now the Host.`,
    );
  }
  return updates.join(" ");
}
