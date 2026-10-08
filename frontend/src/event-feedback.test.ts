import { test } from "node:test";
import assert from "node:assert/strict";
import type { Group } from "./types";
import { reservationProgress, eventUpdateMessage } from "./event-feedback";

const now = Date.parse("2026-10-03T04:00:00Z");
const event = {
  id: "event",
  status: "CONFIRMED",
  hostId: "jacob",
  host: { id: "jacob", name: "Jacob" },
  slot: { startsAt: "2026-10-05T04:00:00Z", minimumPartySize: 4 },
  members: [{ partySize: 2 }, { partySize: 2 }],
} as Group;

test("a first read, unchanged polling and navigating to another Event stay quiet", () => {
  assert.equal(eventUpdateMessage(null, event, "alice", now), "");
  assert.equal(eventUpdateMessage(event, { ...event }, "alice", now), "");
  assert.equal(eventUpdateMessage(event, { ...event, id: "another" }, "alice", now), "");
});

test("pending progress counts missing diners, not the number of Parties", () => {
  const pending: Group = {
    ...event,
    status: "OPEN",
    members: [{ partySize: 3 }] as Group["members"],
  };
  assert.match(reservationProgress(pending, now), /1 more diner needed/);
  assert.match(
    reservationProgress(
      { ...pending, members: [{ partySize: 2 }] as Group["members"] },
      now,
    ),
    /2 more diners needed/,
  );
  assert.match(
    reservationProgress(
      { ...pending, slot: { ...pending.slot, startsAt: "2026-10-01T04:00:00Z" } },
      now,
    ),
    /expired/,
  );
});

test("one update explains lost confirmation and Handover to the current account", () => {
  const handed: Group = {
    ...event,
    status: "OPEN",
    hostId: "alice",
    host: { id: "alice", name: "Alice", ageBand: null },
    members: [{ partySize: 2 }] as Group["members"],
  };
  const update = eventUpdateMessage(event, handed, "alice", now);
  assert.match(update, /Reservation pending/);
  assert.match(update, /You are now the Host/);
  assert.match(eventUpdateMessage(event, handed, "jacob", now), /Alice is now the Host/);
  assert.match(
    eventUpdateMessage(handed, { ...handed, status: "CONFIRMED" }, "alice", now),
    /Reservation confirmed/,
  );
});
