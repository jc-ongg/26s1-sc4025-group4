import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { db } from "./db.js";

test("local semantic ranking, availability, radius, shortlist isolation and undo", async () => {
  const user = await db.user.create({
    data: {
      name: "Discovery test",
      email: `test-${randomUUID()}@example.com`,
      demoPassword: "test-only",
    },
  });
  const other = await db.user.create({
    data: {
      name: "Other test",
      email: `test-${randomUUID()}@example.com`,
      demoPassword: "test-only",
    },
  });
  async function login(email: string) {
    const r = await fetch("http://localhost:4000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: "test-only" }),
    });
    assert.equal(r.status, 200);
    return r.headers.get("set-cookie")!.split(";")[0];
  }
  try {
    const cookie = await login(user.email),
      otherCookie = await login(other.email);
    async function api(path: string, body?: unknown, identity = cookie) {
      const r = await fetch(`http://localhost:4000/api${path}`, {
        method: body ? "POST" : "GET",
        headers: { cookie: identity, "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      assert.equal(r.status, 200, await r.clone().text());
      return r.json();
    }
    const search = (mood: string, extra = {}) =>
      api("/discovery/search", { mood, mode: "groups", ...extra });
    for (const [mood, expected] of [
      ["Grill meat with Korean barbecue lovers", "seorae"],
      ["Frozen sweet treats and waffles with students", "two-scoops"],
      ["A calm lunch with Japanese rice bowls", "joya"],
    ]) {
      const result = await search(mood);
      assert.equal(result.results[0].restaurant.id, expected);
      assert.ok(
        result.results.every(
          (r: {
            group: { status: string; members: { partySize: number }[]; capacity: number };
          }) =>
            ["OPEN", "CONFIRMED"].includes(r.group.status) &&
            r.group.members.reduce((total, party) => total + party.partySize, 0) <
              r.group.capacity,
        ),
      );
      console.log(`Semantic top-1: ${mood} -> ${expected}`);
    }
    const nearby = await search("lunch", { area: "ntu", radius: 3 });
    assert.ok(nearby.results.length > 0);
    assert.ok(nearby.results.every((r: { distanceKm: number }) => r.distanceKm <= 3));
    const typedLocation = await search("lunch", { area: "  NTU  ", radius: 3 });
    assert.deepEqual(
      typedLocation.results.map((r: { key: string }) => r.key),
      nearby.results.map((r: { key: string }) => r.key),
    );
    const namedVenue = await search("Italian pasta", {
      mode: "restaurants",
      area: "il Cielo",
      radius: 1,
    });
    assert.ok(
      namedVenue.results.some(
        (r: { restaurant: { id: string }; distanceKm: number }) =>
          r.restaurant.id === "il-cielo" && r.distanceKm === 0,
      ),
    );
    const unknownLocation = await fetch("http://localhost:4000/api/discovery/search", {
      method: "POST",
      headers: { cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ mood: "lunch", area: "unknown neighbourhood" }),
    });
    assert.equal(unknownLocation.status, 400);
    const noLocation = await search("lunch", { area: "" });
    assert.ok(
      noLocation.results.every(
        (r: { distanceKm: number | null }) => r.distanceKm === null,
      ),
    );
    const restaurants = await search("Italian pasta and pizza", {
      mode: "restaurants",
    });
    assert.equal(restaurants.results[0].restaurant.id, "il-cielo");
    const defaultMode = await api("/discovery/search", {
      mood: "Italian pasta and pizza",
    });
    assert.equal(defaultMode.results[0].restaurant.id, "il-cielo");
    assert.ok(defaultMode.results.every((result: { group?: unknown }) => !result.group));
    const western = await api("/discovery/search", {
      mood: "Chinese dumplings and shared dishes",
      cuisine: "  wEsTeRn  ",
    });
    assert.ok(western.results.length > 0);
    assert.ok(
      western.results.every(
        (r: { restaurant: { cuisine: string } }) => r.restaurant.cuisine === "Western",
      ),
    );
    assert.equal(western.results[0].restaurant.id, "lazy-lizard");
    const outsideRadius = await api("/discovery/search", {
      mood: "Chinese food",
      cuisine: "Western",
      area: "orchard",
      radius: 1,
    });
    assert.deepEqual(outsideRadius.results, []);
    const unknownCuisine = await api("/discovery/search", {
      mood: "lunch",
      cuisine: "Unlisted cuisine",
    });
    assert.deepEqual(unknownCuisine.results, []);
    const invalidCuisine = await fetch("http://localhost:4000/api/discovery/search", {
      method: "POST",
      headers: { cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ mood: "lunch", cuisine: ["Western"] }),
    });
    assert.equal(invalidCuisine.status, 400);
    console.log(
      "Explicit Western cuisine excludes Chinese recommendations, including conflicting moods; empty filters never fall back.",
    );
    const groupKey = (await search("lunch")).results[0].key;
    await api("/discovery/decision", { key: groupKey, decision: "SAVE" });
    assert.deepEqual((await api("/discovery/saved?mode=restaurants")).results, []);
    const key = restaurants.results[0].key;
    assert.equal(
      (await api("/discovery/decision", { key, decision: "SAVE" })).previous,
      null,
    );
    assert.ok(
      (await api("/discovery/saved")).results.some((r: { key: string }) => r.key === key),
    );
    const restaurantShortlist = await api("/discovery/saved?mode=restaurants");
    assert.deepEqual(
      restaurantShortlist.results.map((r: { key: string }) => r.key),
      [key],
    );
    assert.deepEqual(
      (await api("/discovery/saved?mode=groups")).results.map(
        (r: { key: string }) => r.key,
      ),
      [groupKey],
    );
    await api("/discovery/decision", { key: groupKey, decision: null });
    assert.equal(
      (await api("/discovery/saved", undefined, otherCookie)).results.length,
      0,
    );
    assert.ok(
      !(await search("Italian pasta", { mode: "restaurants" })).results.some(
        (r: { key: string }) => r.key === key,
      ),
    );
    await api("/discovery/decision", { key, decision: null });
    assert.ok(
      (await search("Italian pasta", { mode: "restaurants" })).results.some(
        (r: { key: string }) => r.key === key,
      ),
    );
    await api("/discovery/decision", { key, decision: "SKIP" });
    assert.equal((await api("/discovery/saved")).results.length, 0);
    const bad = await fetch("http://localhost:4000/api/discovery/search", {
      method: "POST",
      headers: { cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ mood: "hello", radius: "bad" }),
    });
    assert.equal(bad.status, 400);
    const unauth = await fetch("http://localhost:4000/api/discovery/saved");
    assert.equal(unauth.status, 401);
  } finally {
    await db.session.deleteMany({
      where: { userId: { in: [user.id, other.id] } },
    });
    await db.user.deleteMany({ where: { id: { in: [user.id, other.id] } } });
    await db.$disconnect();
  }
});
