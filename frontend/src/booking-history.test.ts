import test from "node:test";
import assert from "node:assert/strict";
import type { Booking, Group } from "./types";
import {
  byDiningTime,
  isPastBooking,
  matchesBooking,
  matchesEvent,
} from "./booking-history";

const now = Date.parse("2026-10-04T12:00:00+08:00");
const booking = (startsAt: string, status = "CONFIRMED") =>
  ({
    status,
    slot: { startsAt },
  }) as Booking;

test("Upcoming excludes cancelled, pending and just-started reservations", () => {
  const future = "2026-10-04T12:00:01+08:00";
  assert.equal(matchesBooking(booking(future), "upcoming", now), true);
  for (const status of ["PENDING", "CANCELLED"]) {
    assert.equal(matchesBooking(booking(future, status), "upcoming", now), false);
  }
  const started = booking("2026-10-04T12:00:00+08:00");
  assert.equal(matchesBooking(started, "upcoming", now), false);
  assert.equal(matchesBooking(started, "history", now), true);
  assert.equal(isPastBooking(started, now), true);
  assert.equal(isPastBooking(booking(future, "CANCELLED"), now), false);
  assert.equal(matchesBooking(booking(future, "CANCELLED"), "history", now), true);
});

test("future pending Events remain Upcoming; cancelled and expired Events do not", () => {
  for (const status of ["OPEN", "FULL", "CONFIRMED", "CANCELLED", "EXPIRED"] as const) {
    const group = { status, slot: { startsAt: "2026-10-05T04:00:00Z" } } as Group;
    const active = ["OPEN", "FULL", "CONFIRMED"].includes(status);
    assert.equal(matchesEvent(group, "upcoming", now), active);
    assert.equal(matchesEvent(group, "history", now), !active);
    assert.equal(
      matchesEvent(
        { ...group, slot: { ...group.slot, startsAt: new Date(now).toISOString() } },
        "upcoming",
        now,
      ),
      false,
    );
  }
});

test("Upcoming sorts soonest first and History sorts latest dining times first", () => {
  const items = [booking("2026-10-06T04:00:00Z"), booking("2026-10-05T04:00:00Z")];
  assert.equal([...items].sort(byDiningTime("upcoming"))[0], items[1]);
  assert.equal([...items].sort(byDiningTime("history"))[0], items[0]);
});
