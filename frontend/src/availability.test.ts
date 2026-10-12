import { test } from "node:test";
import assert from "node:assert/strict";
import {
  availableSlots,
  currentGroupStatus,
  hasStarted,
  dinerCount,
  canJoinEvent,
  isUpcomingEvent,
  upcomingEventCounts,
} from "./availability";
import type { Group, Restaurant, Slot } from "./types";

const now = Date.parse("2026-09-28T04:00:00Z");
const restaurant: Restaurant = {
  id: "test",
  name: "Test restaurant",
  cuisine: "",
  area: "",
  description: "",
  price: "",
  artwork: "",
  active: true,
  address: "",
  latitude: null,
  longitude: null,
  tags: [],
  signatureDishes: [],
  slots: [],
};
const slot = (
  id: string,
  startsAt: string,
  allocation: Slot["allocation"] = null,
): Slot => ({
  id,
  startsAt,
  allocation,
  restaurant,
  minimumPartySize: 2,
  capacity: 4,
  discount: 50,
});

test("availability excludes past, just-started, allocated and inactive slots", () => {
  const slots = [
    slot("past", "2026-09-27T04:00:00Z"),
    slot("now", "2026-09-28T12:00:00+08:00"),
    slot("held", "2026-09-29T04:00:00Z", { groupId: "g", bookingId: null }),
    slot("free", "2026-09-29T04:00:00Z"),
  ];
  assert.deepEqual(
    availableSlots({ ...restaurant, slots }, now).map((s) => s.id),
    ["free"],
  );
  assert.deepEqual(availableSlots({ ...restaurant, slots, active: false }, now), []);
  assert.equal(hasStarted("2026-09-28T12:00:00+08:00", now), true);
});

test("only unconfirmed parties become expired at their start time", () => {
  const started = slot("started", "2026-09-28T04:00:00Z");
  for (const status of ["OPEN", "FULL"] as const)
    assert.equal(currentGroupStatus({ status, slot: started }, now), "EXPIRED");
  for (const status of ["CONFIRMED", "CANCELLED", "EXPIRED"] as const)
    assert.equal(currentGroupStatus({ status, slot: started }, now), status);
  assert.equal(
    currentGroupStatus(
      { status: "OPEN", slot: slot("future", "2026-09-29T04:00:00Z") },
      now,
    ),
    "OPEN",
  );
});

test("Event availability counts diners across Parties and includes confirmed Events", () => {
  const event = {
    id: "event",
    title: "",
    description: "",
    hostId: "u1",
    host: { id: "u1", name: "Host", age: null, gender: null },
    genderFilter: null,
    minAge: null,
    maxAge: null,
    status: "CONFIRMED" as const,
    capacity: 6,
    booking: null,
    slot: slot("future", "2026-09-29T04:00:00Z"),
    members: [
      {
        userId: "u1",
        partySize: 2,
        user: { id: "u1", name: "Host", age: null, gender: null },
      },
      {
        userId: "u2",
        partySize: 2,
        user: { id: "u2", name: "Joiner", age: null, gender: null },
      },
    ],
  };
  assert.equal(dinerCount(event), 4);
  assert.equal(canJoinEvent(event, now), true);
  assert.equal(canJoinEvent({ ...event, capacity: 4 }, now), false);
  assert.equal(canJoinEvent({ ...event, status: "CANCELLED" }, now), false);
  assert.equal(
    canJoinEvent({ ...event, slot: slot("past", "2026-09-28T04:00:00Z") }, now),
    false,
  );
});

test("restaurant Event counts include full future tables but exclude closed, started and inactive venues", () => {
  const event: Group = {
    id: "event",
    title: "",
    description: "",
    hostId: "host",
    host: { id: "host", name: "Host", age: null, gender: null },
    genderFilter: null,
    minAge: null,
    maxAge: null,
    status: "CONFIRMED",
    capacity: 2,
    booking: null,
    slot: slot("future", "2026-09-29T04:00:00Z"),
    members: [
      {
        userId: "host",
        partySize: 2,
        user: { id: "host", name: "Host", age: null, gender: null },
      },
    ],
  };
  assert.equal(isUpcomingEvent(event, now), true);
  assert.equal(canJoinEvent(event, now), false);
  const inactive = {
    ...event,
    slot: { ...event.slot, restaurant: { ...restaurant, active: false } },
  };
  assert.equal(canJoinEvent(inactive, now), false);
  const anotherVenue = {
    ...event,
    slot: { ...event.slot, restaurant: { ...restaurant, id: "another" } },
  };
  const events: Group[] = [
    event,
    { ...event, id: "waiting", status: "OPEN" },
    anotherVenue,
    inactive,
    { ...event, status: "CANCELLED" },
    { ...event, status: "EXPIRED" },
    { ...event, slot: slot("starting", "2026-09-28T04:00:00Z") },
    { ...event, slot: slot("past", "2026-09-27T04:00:00Z") },
  ];
  assert.deepEqual(
    [...upcomingEventCounts(events, now)],
    [
      ["test", 2],
      ["another", 1],
    ],
  );
});
