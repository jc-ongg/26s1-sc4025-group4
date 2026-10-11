import test from "node:test";
import assert from "node:assert/strict";
import type { Group, Restaurant } from "./types";
import { defaultRestaurantFilters, discoverRestaurants } from "./restaurant-discovery";

const now = Date.parse("2026-10-11T04:00:00Z");
function venue(id: string, price = "$$"): Restaurant {
  const restaurant: Restaurant = {
    id,
    name: id,
    cuisine: "Japanese",
    area: "Joo Koon",
    price,
    description: "",
    artwork: "",
    active: true,
    address: "",
    latitude: 1.3,
    longitude: 103.7,
    tags: [],
    signatureDishes: [],
    slots: [],
  };
  restaurant.slots = [
    {
      id: `${id}-ordinary`,
      startsAt: "2026-10-12T04:00:00Z",
      minimumPartySize: 2,
      capacity: 4,
      availableSeats: 4,
      discount: 50,
      restaurant,
    },
  ];
  return restaurant;
}
function event(restaurant: Restaurant, id: string, changes: Partial<Group> = {}): Group {
  return {
    id,
    title: `Dinner ${id}`,
    description: "",
    hostId: "host",
    host: { id: "host", name: "Host", age: 21 },
    genderFilter: null,
    minAge: null,
    maxAge: null,
    capacity: 4,
    status: "OPEN",
    members: [
      { userId: "host", partySize: 1, user: { id: "host", name: "Host", age: 21 } },
    ],
    booking: null,
    slot: { ...restaurant.slots[0], id: `${id}-slot`, discount: 30 },
    ...changes,
  };
}

test("each venue appears once with its upcoming Events; closed and started Events do not inflate counts", () => {
  const r = venue("Joya"),
    inactive = { ...venue("Inactive"), active: false };
  const past = event(r, "past");
  past.slot = { ...past.slot, startsAt: new Date(now).toISOString() };
  const results = discoverRestaurants(
    [r, inactive],
    [
      event(r, "first"),
      event(r, "second"),
      event(r, "closed", { status: "CANCELLED" }),
      past,
      event(inactive, "inactive"),
    ],
    defaultRestaurantFilters,
    now,
  );
  assert.equal(results.length, 1);
  assert.deepEqual(
    results[0].events.map((g) => g.id),
    ["first", "second"],
  );
});

test("ordinary discounts cannot satisfy an EatTogether discount filter; Event overrides include zero", () => {
  const r = venue("Joya"),
    g = event(r, "event");
  const filters = { ...defaultRestaurantFilters, minimumDiscount: 40 };
  const ordinary = discoverRestaurants([r], [g], filters, now);
  assert.equal(ordinary.length, 1);
  assert.equal(ordinary[0].events.length, 0);
  assert.equal(
    discoverRestaurants([r], [g], { ...filters, eatTogether: "events" }, now).length,
    0,
  );
  assert.equal(
    discoverRestaurants(
      [r],
      [{ ...g, discount: 50 }],
      { ...filters, eatTogether: "events" },
      now,
    )[0].events.length,
    1,
  );
  assert.equal(
    discoverRestaurants(
      [r],
      [{ ...g, discount: 0 }],
      { ...defaultRestaurantFilters, minimumDiscount: 10, eatTogether: "events" },
      now,
    ).length,
    0,
  );
  r.slots[0].availableSeats = 1;
  assert.equal(discoverRestaurants([r], [g], filters, now).length, 0);
});

test("Event-title searches retain the restaurant and only its matching Events", () => {
  const r = venue("Joya"),
    first = event(r, "first", { title: "A shared ramen lunch" });
  const results = discoverRestaurants(
    [r],
    [first, event(r, "second")],
    { ...defaultRestaurantFilters, search: " RAMEN " },
    now,
  );
  assert.equal(results.length, 1);
  assert.deepEqual(
    results[0].events.map((g) => g.id),
    ["first"],
  );
  assert.equal(
    discoverRestaurants(
      [r],
      [first],
      { ...defaultRestaurantFilters, search: "pizza" },
      now,
    ).length,
    0,
  );
});

test("Events and seats filters distinguish a full Event from one that can accept another diner", () => {
  const r = venue("Joya"),
    full = event(r, "full", { capacity: 1, status: "CONFIRMED" });
  assert.equal(
    discoverRestaurants(
      [r],
      [full],
      { ...defaultRestaurantFilters, eatTogether: "events" },
      now,
    ).length,
    1,
  );
  assert.equal(
    discoverRestaurants(
      [r],
      [full],
      { ...defaultRestaurantFilters, eatTogether: "seats" },
      now,
    ).length,
    0,
  );
  assert.equal(
    discoverRestaurants(
      [r],
      [full, event(r, "open")],
      { ...defaultRestaurantFilters, eatTogether: "seats" },
      now,
    )[0].events.length,
    1,
  );
});

test("cuisine and price bands compose with Event filters, including all premium bands", () => {
  const cheap = venue("Cheap", "$"),
    premium = venue("Premium", "$$$$$"),
    four = venue("Four", "$$$$");
  const restaurants = [cheap, premium, four];
  assert.deepEqual(
    discoverRestaurants(
      restaurants,
      [],
      { ...defaultRestaurantFilters, price: "premium" },
      now,
    ).map((r) => r.restaurant.id),
    ["Premium", "Four"],
  );
  assert.deepEqual(
    discoverRestaurants(
      restaurants,
      [],
      { ...defaultRestaurantFilters, price: "$" },
      now,
    ).map((r) => r.restaurant.id),
    ["Cheap"],
  );
  assert.equal(
    discoverRestaurants(
      restaurants,
      [event(premium, "event")],
      {
        ...defaultRestaurantFilters,
        price: "premium",
        cuisine: "Western",
        eatTogether: "events",
      },
      now,
    ).length,
    0,
  );
});
