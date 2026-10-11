import test from "node:test";
import assert from "node:assert/strict";
import {
  ageAt,
  canViewEvent,
  matchesEvent,
  parseEventFilters,
  verifiedAdult,
  type DinerIdentity,
} from "./event-eligibility.js";

const now = new Date("2026-10-08T08:00:00Z");
const diner: DinerIdentity = {
  id: "diner",
  singpassVerified: true,
  dateOfBirth: new Date("2002-10-09T00:00:00Z"),
  gender: "FEMALE",
};
const event = {
  genderFilter: "FEMALE" as const,
  minAge: 24,
  maxAge: 24,
  hostId: "host",
  members: [],
  slot: { startsAt: new Date("2026-10-09T04:00:00Z") },
};

test("suspension closes Joins but preserves discovery; blocks exclude future shared Events", () => {
  const suspended = { ...diner, suspendedUntil: new Date(now.getTime() + 86400000) };
  assert.equal(matchesEvent(suspended, event, now), false);
  assert.equal(canViewEvent(suspended, event), true);
  assert.equal(matchesEvent({ ...suspended, suspendedUntil: now }, event, now), true);
  const blocked = { ...diner, blockedUserIds: [event.hostId] };
  assert.equal(canViewEvent(blocked, event), false);
  assert.equal(
    canViewEvent(blocked, { ...event, members: [{ userId: diner.id }] }),
    true,
  );
});

test("exact ages cross birthdays at Singapore midnight", () => {
  assert.equal(ageAt(diner.dateOfBirth, new Date("2026-10-08T15:59:59Z")), 23);
  assert.equal(ageAt(diner.dateOfBirth, new Date("2026-10-08T16:00:00Z")), 24);
  for (const [birth, expected] of [
    ["2008-10-09", 17],
    ["2008-10-08", 18],
    ["2001-10-08", 25],
    ["1991-10-08", 35],
    ["1961-10-08", 65],
  ])
    assert.equal(ageAt(new Date(`${birth}T00:00:00Z`), now), expected);
  assert.equal(ageAt(null, now), null);
});

test("verified adults must match both filters at dining time, including range boundaries", () => {
  assert.ok(matchesEvent(diner, event, now));
  assert.ok(!matchesEvent(diner, { ...event, maxAge: 23, minAge: 18 }, now));
  assert.ok(!matchesEvent(diner, { ...event, minAge: 25, maxAge: null }, now));
  assert.ok(!matchesEvent({ ...diner, gender: "MALE" }, event, now));
  assert.ok(
    matchesEvent(
      diner,
      { ...event, genderFilter: null, minAge: null, maxAge: null },
      now,
    ),
  );
  for (const changed of [
    { singpassVerified: false },
    { dateOfBirth: null },
    { gender: null },
    { dateOfBirth: new Date("2008-10-09T00:00:00Z") },
  ])
    assert.ok(!verifiedAdult({ ...diner, ...changed }, now));
});

test("participants keep their existing reservation history when their identity no longer matches", () => {
  const unverified = { ...diner, singpassVerified: false };
  assert.ok(!canViewEvent(unverified, event));
  assert.ok(canViewEvent(unverified, { ...event, members: [{ userId: diner.id }] }));
  assert.ok(canViewEvent(unverified, { ...event, hostId: diner.id }));
});

test("only integral adult age ranges and supported genders are accepted", () => {
  assert.deepEqual(parseEventFilters({}), {
    genderFilter: null,
    minAge: null,
    maxAge: null,
  });
  assert.deepEqual(parseEventFilters({ genderFilter: "MALE", minAge: 18, maxAge: 120 }), {
    genderFilter: "MALE",
    minAge: 18,
    maxAge: 120,
  });
  for (const invalid of [
    { minAge: 17 },
    { maxAge: 121 },
    { minAge: 25, maxAge: 24 },
    { minAge: 18.5 },
    { maxAge: "30" },
    { minAge: false },
    { genderFilter: "ANY" },
    { genderFilter: [] },
  ])
    assert.equal(parseEventFilters(invalid), null);
});
