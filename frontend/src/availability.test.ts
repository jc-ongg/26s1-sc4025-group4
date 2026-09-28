import { test } from "node:test";
import assert from "node:assert/strict";
import { availableSlots, currentGroupStatus, hasStarted } from "./availability";
import type { Restaurant, Slot } from "./types";

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
