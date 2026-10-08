import test from "node:test";
import assert from "node:assert/strict";
import type { Group, Restaurant, Slot } from "./types";
import { eventJoinState, slotState } from "./booking-flow";

const now = Date.parse("2026-10-04T12:00:00+08:00");
const slot = {
  id: "slot",
  startsAt: "2026-10-05T12:00:00+08:00",
  minimumPartySize: 4,
  capacity: 6,
  restaurant: { active: true } as Restaurant,
} as Slot;
const event = {
  id: "event",
  status: "CONFIRMED",
  capacity: 6,
  slot,
  members: [{ userId: "host", partySize: 4 }],
} as Group;

test("Event-held times remain discoverable while ordinary reservations are unavailable", () => {
  assert.equal(slotState(slot, true, now), "available");
  assert.equal(
    slotState(
      { ...slot, allocation: { groupId: "event", bookingId: "booking" } },
      true,
      now,
    ),
    "event",
  );
  assert.equal(
    slotState(
      { ...slot, allocation: { groupId: null, bookingId: "booking" } },
      true,
      now,
    ),
    "reserved",
  );
  assert.equal(slotState(slot, false, now), "unavailable");
  assert.equal(
    slotState({ ...slot, startsAt: new Date(now).toISOString() }, true, now),
    "unavailable",
  );
});

test("each account joins for one diner and cannot reserve companions' seats", () => {
  assert.equal(eventJoinState(event, 1, "new", now), "eligible");
  assert.equal(eventJoinState(event, 2, "new", now), "insufficient");
  assert.equal(eventJoinState(event, 3, "new", now), "insufficient");
  assert.equal(eventJoinState(event, 4, "new", now), "insufficient");
  assert.equal(eventJoinState({ ...event, capacity: 4 }, 1, "new", now), "full");
  assert.equal(eventJoinState(event, 0, "new", now), "insufficient");
});

test("members can manage a full Event; closed or inactive Events cannot accept newcomers", () => {
  assert.equal(eventJoinState({ ...event, capacity: 4 }, 1, "host", now), "joined");
  for (const status of ["CANCELLED", "EXPIRED"] as const) {
    assert.equal(
      eventJoinState({ ...event, status, capacity: 4 }, 1, "new", now),
      "closed",
    );
  }
  assert.equal(
    eventJoinState(
      { ...event, slot: { ...slot, startsAt: new Date(now).toISOString() } },
      1,
      "new",
      now,
    ),
    "closed",
  );
  assert.equal(
    eventJoinState(
      { ...event, slot: { ...slot, restaurant: { ...slot.restaurant, active: false } } },
      1,
      "new",
      now,
    ),
    "closed",
  );
});
