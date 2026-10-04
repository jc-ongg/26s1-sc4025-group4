import type { Group, Booking } from "./types";
import { currentGroupStatus, hasStarted } from "./availability";

export type BookingFilter = "all" | "upcoming" | "history";

export function isUpcomingBooking(booking: Booking, now = Date.now()) {
  return booking.status === "CONFIRMED" && !hasStarted(booking.slot.startsAt, now);
}

export function isPastBooking(booking: Booking, now = Date.now()) {
  return booking.status === "CONFIRMED" && hasStarted(booking.slot.startsAt, now);
}

export function bookingDisplayStatus(booking: Booking, now = Date.now()) {
  return booking.status === "CONFIRMED"
    ? isPastBooking(booking, now)
      ? "PAST"
      : "UPCOMING"
    : booking.status;
}

export function eventDisplayStatus(group: Group, now = Date.now()) {
  const status = currentGroupStatus(group, now);
  return status === "CONFIRMED"
    ? hasStarted(group.slot.startsAt, now)
      ? "PAST"
      : "UPCOMING"
    : status;
}

export function matchesBooking(booking: Booking, filter: BookingFilter, now: number) {
  return (
    filter === "all" ||
    (filter === "upcoming"
      ? isUpcomingBooking(booking, now)
      : booking.status === "CANCELLED" || hasStarted(booking.slot.startsAt, now))
  );
}

export function matchesEvent(group: Group, filter: BookingFilter, now: number) {
  if (filter === "all") return true;
  const status = currentGroupStatus(group, now);
  const upcoming =
    ["OPEN", "FULL", "CONFIRMED"].includes(status) &&
    !hasStarted(group.slot.startsAt, now);
  return filter === "upcoming" ? upcoming : !upcoming;
}

export function byDiningTime(filter: BookingFilter) {
  return (a: { slot: { startsAt: string } }, b: { slot: { startsAt: string } }) => {
    const difference = Date.parse(a.slot.startsAt) - Date.parse(b.slot.startsAt);
    return filter === "upcoming" ? difference : -difference;
  };
}
