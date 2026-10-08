import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { db } from "./db.js";

const base = process.env.TEST_API_URL ?? "http://localhost:4000/api";
const sessions: Record<string, string> = {};
const slotIds: string[] = [];
async function request(path: string, user = "jacob", body?: unknown) {
  const response = await fetch(`${base}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      Cookie: sessions[user] ?? "",
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return {
    status: response.status,
    data: response.status === 204 ? null : await response.json(),
  };
}
async function slot(minimumPartySize = 2, capacity = 4) {
  const id = `test-${randomUUID()}`;
  slotIds.push(id);
  return db.reservationSlot.create({
    data: {
      id,
      restaurantId: "joya",
      startsAt: new Date(Date.now() + 30 * 86400000 + Math.random() * 86400000),
      minimumPartySize,
      capacity,
      discount: 40,
    },
  });
}
async function group(capacity = 4) {
  const s = await slot();
  const created = await request("/groups", "jacob", {
    slotId: s.id,
    title: "Automated test table",
    capacity,
  });
  assert.equal(created.status, 201, JSON.stringify(created.data));
  return created.data.group;
}
before(async () => {
  for (const name of ["jacob", "chongwei", "yojin", "wallace", "harsh", "hansen"]) {
    const response = await fetch(`${base}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: `${name}@gmail.com`,
        password: "password123",
      }),
    });
    assert.equal(response.status, 200);
    sessions[name] = response.headers.get("set-cookie")!.split(";")[0];
  }
});
after(async () => {
  // Delete only fixtures created by this test process, never seed/user records.
  await db.$transaction(async (tx) => {
    const groups = await tx.groupDiningSession.findMany({
      where: { slotId: { in: slotIds } },
      select: { id: true },
    });
    await tx.slotAllocation.deleteMany({ where: { slotId: { in: slotIds } } });
    await tx.booking.deleteMany({ where: { slotId: { in: slotIds } } });
    await tx.groupDiningMember.deleteMany({
      where: { groupId: { in: groups.map((g) => g.id) } },
    });
    await tx.groupDiningSession.deleteMany({
      where: { slotId: { in: slotIds } },
    });
    await tx.reservationSlot.deleteMany({ where: { id: { in: slotIds } } });
  });
  await Promise.all(
    Object.keys(sessions).map((user) => request("/auth/logout", user, {})),
  );
  await db.$disconnect();
});

test("Reliability is private to the account and absent from public Event participants", async () => {
  const jacob = (await request("/me/profile", "jacob")).data.profile;
  const chongwei = (await request("/me/profile", "chongwei")).data.profile;
  assert.equal(jacob.email, "jacob@gmail.com");
  assert.equal(chongwei.email, "chongwei@gmail.com");
  assert.notEqual(jacob.id, chongwei.id);
  assert.equal(typeof jacob.reliabilityStrikes, "number");
  assert.ok(!("demoPassword" in jacob));
  assert.equal((await request("/me/profile", "anonymous")).status, 401);
  const event = await group();
  assert.ok(!("reliabilityStrikes" in event.host));
  assert.ok(
    event.members.every(
      (party: { user: Record<string, unknown> }) => !("reliabilityStrikes" in party.user),
    ),
  );
});

test("credentials are required and invalid group input cannot allocate a slot", async () => {
  assert.equal((await request("/restaurants", "anonymous")).status, 401);
  const s = await slot();
  for (const capacity of [0, 1, 5, 2.5, "4"]) {
    assert.equal(
      (
        await request("/groups", "jacob", {
          slotId: s.id,
          title: "Test",
          capacity,
        })
      ).status,
      400,
    );
  }
  assert.equal(
    (
      await request("/groups", "jacob", {
        slotId: s.id,
        title: " ",
        capacity: 4,
      })
    ).status,
    400,
  );
  assert.equal(await db.slotAllocation.count({ where: { slotId: s.id } }), 0);
});
test("confirmation is automatic, reversible and preserves one shared booking", async () => {
  const g = await group();
  assert.equal((await request(`/groups/${g.id}/confirm`, "jacob", {})).status, 409);
  assert.equal((await request(`/groups/${g.id}/confirm`, "chongwei", {})).status, 403);
  assert.equal((await request(`/groups/${g.id}/cancel`, "chongwei", {})).status, 403);
  const joined = await request(`/groups/${g.id}/join`, "chongwei", {});
  assert.equal(joined.status, 200);
  assert.equal(joined.data.group.status, "CONFIRMED");
  const id = joined.data.group.booking.id;
  await request(`/groups/${g.id}/join`, "chongwei", {});
  assert.equal((await request(`/groups/${g.id}`)).data.group.members.length, 2);
  const extra = await request(`/groups/${g.id}/join`, "yojin", {});
  assert.equal(extra.status, 200);
  assert.equal(extra.data.group.booking.partySize, 3);
  await request(`/groups/${g.id}/leave`, "chongwei", {});
  const short = await request(`/groups/${g.id}/leave`, "yojin", {});
  assert.equal(short.data.group.status, "OPEN");
  assert.equal(short.data.group.booking.status, "PENDING");
  assert.equal((await request(`/bookings/${id}/delete`, "jacob", {})).status, 409);
  assert.ok(
    !(await request("/me/bookings")).data.bookings.some(
      (b: { id: string }) => b.id === id,
    ),
  );
  const restored = await request(`/groups/${g.id}/join`, "chongwei", {});
  assert.equal(restored.data.group.booking.id, id);
  assert.equal(restored.data.group.booking.status, "CONFIRMED");
  const repeat = await request(`/groups/${g.id}/confirm`, "jacob", {});
  assert.equal(repeat.data.group.booking.id, id);
  assert.equal(await db.booking.count({ where: { groupId: g.id } }), 1);
  const restaurant = (await request(`/restaurants/${g.slot.restaurant.id}`)).data;
  assert.equal(
    restaurant.groups.find((event: { id: string }) => event.id === g.id)?.booking.id,
    id,
  );
  assert.equal(
    restaurant.restaurant.slots.find((slot: { id: string }) => slot.id === g.slotId)
      ?.allocation.groupId,
    g.id,
  );
  assert.ok(
    (await request("/me/bookings", "chongwei")).data.bookings.some(
      (b: { id: string }) => b.id === id,
    ),
  );
  assert.equal(
    (await request("/bookings", "yojin", { slotId: g.slotId, partySize: 2 })).status,
    409,
  );
  await request(`/groups/${g.id}/cancel`, "jacob", {});
  assert.equal((await request(`/groups/${g.id}`)).data.group.booking.status, "CANCELLED");
  assert.equal(await db.slotAllocation.count({ where: { slotId: g.slotId } }), 0);
  const released = (await request(`/restaurants/${g.slot.restaurant.id}`)).data;
  assert.ok(!released.groups.some((event: { id: string }) => event.id === g.id));
  assert.equal(
    released.restaurant.slots.find((slot: { id: string }) => slot.id === g.slotId)
      ?.allocation,
    null,
  );
});
test("simultaneous last-seat joins never overfill; leaving a full table reopens it", async () => {
  const g = await group(2);
  const results = await Promise.all(
    ["chongwei", "yojin", "wallace"].map((user) =>
      request(`/groups/${g.id}/join`, user, {}),
    ),
  );
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 409, 409]);
  const full = (await request(`/groups/${g.id}`)).data.group;
  assert.equal(full.status, "CONFIRMED");
  assert.equal(full.members.length, 2);
  const winner = ["chongwei", "yojin", "wallace"][
    results.findIndex((r) => r.status === 200)
  ];
  assert.equal((await request(`/groups/${g.id}/leave`, winner, {})).status, 200);
  const reopened = (await request(`/groups/${g.id}`)).data.group;
  assert.equal(reopened.status, "OPEN");
  assert.equal(reopened.members.length, 1);
});
test("competing normal booking and group creation share one exclusive slot allocation", async () => {
  const s = await slot();
  const results = await Promise.all([
    request("/groups", "jacob", {
      slotId: s.id,
      title: "Inventory test",
      capacity: 4,
    }),
    request("/bookings", "chongwei", { slotId: s.id, partySize: 2 }),
  ]);
  assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
  assert.equal(await db.slotAllocation.count({ where: { slotId: s.id } }), 1);
  if (results[0].status === 201)
    await request(`/groups/${results[0].data.group.id}/cancel`, "jacob", {});
  else {
    const id = results[1].data.booking.id;
    assert.equal((await request(`/bookings/${id}/cancel`, "yojin", {})).status, 403);
    await request(`/bookings/${id}/cancel`, "chongwei", {});
  }
  assert.equal(
    (await request("/bookings", "yojin", { slotId: s.id, partySize: 2 })).status,
    201,
  );
});
test("started unconfirmed groups expire and release their inventory", async () => {
  const g = await group();
  await request(`/groups/${g.id}/join`, "chongwei", {});
  await request(`/groups/${g.id}/leave`, "chongwei", {});
  assert.equal((await request(`/groups/${g.id}`)).data.group.booking.status, "PENDING");
  await db.reservationSlot.update({
    where: { id: g.slotId },
    data: { startsAt: new Date(Date.now() - 60000) },
  });
  const result = await request(`/groups/${g.id}`);
  assert.equal(result.data.group.status, "EXPIRED");
  assert.equal(result.data.group.booking.status, "CANCELLED");
  assert.equal(await db.slotAllocation.count({ where: { slotId: g.slotId } }), 0);
  assert.equal((await request(`/groups/${g.id}/join`, "chongwei", {})).status, 409);
});

test("cancelled booking deletion is personal, persistent and rejects active or unrelated bookings", async () => {
  const g = await group();
  assert.ok(
    (await request("/me/groups")).data.groups.some((x: { id: string }) => x.id === g.id),
  );
  await request(`/groups/${g.id}/join`, "chongwei", {});
  const confirmed = await request(`/groups/${g.id}/confirm`, "jacob", {});
  const id = confirmed.data.group.booking.id;
  assert.equal((await request(`/bookings/${id}/delete`, "jacob", {})).status, 409);
  await request(`/groups/${g.id}/cancel`, "jacob", {});
  assert.equal((await request(`/bookings/${id}/delete`, "yojin", {})).status, 403);
  assert.equal((await request(`/bookings/${id}/delete`, "anonymous", {})).status, 401);
  assert.equal((await request(`/bookings/${id}/delete`, "chongwei", {})).status, 200);
  assert.equal((await request(`/bookings/${id}/delete`, "chongwei", {})).status, 200);
  assert.ok(
    !(await request("/me/bookings", "chongwei")).data.bookings.some(
      (b: { id: string }) => b.id === id,
    ),
  );
  assert.ok(
    !(await request("/me/groups", "chongwei")).data.groups.some(
      (b: { id: string }) => b.id === g.id,
    ),
  );
  assert.ok(
    (await request("/me/bookings", "jacob")).data.bookings.some(
      (b: { id: string }) => b.id === id,
    ),
  );
  assert.ok(
    (await request("/me/groups", "jacob")).data.groups.some(
      (b: { id: string }) => b.id === g.id,
    ),
  );
  assert.equal(
    (await db.booking.findUniqueOrThrow({ where: { id } })).status,
    "CANCELLED",
  );
  assert.equal(await db.slotAllocation.count({ where: { slotId: g.slotId } }), 0);
});

test("one account reserves one Event seat; concurrent diners cannot overfill", async () => {
  const s = await slot(4, 5);
  for (const partySize of [0, 2, 4, 1.5, "1", null]) {
    assert.equal(
      (
        await request("/groups", "jacob", {
          slotId: s.id,
          title: "Single-diner test",
          partySize,
        })
      ).status,
      400,
    );
  }
  assert.equal(await db.slotAllocation.count({ where: { slotId: s.id } }), 0);
  const created = await request("/groups", "jacob", {
    slotId: s.id,
    title: "Single-diner test",
    partySize: 1,
  });
  assert.equal(created.status, 201);
  const g = created.data.group;
  assert.equal(g.members[0].partySize, 1);
  for (const partySize of [0, 2, 7, 1.5, "1", null]) {
    assert.equal(
      (await request(`/groups/${g.id}/join`, "chongwei", { partySize })).status,
      400,
    );
    assert.equal(
      (await request(`/groups/${g.id}/resize`, "jacob", { partySize })).status,
      400,
    );
  }
  assert.equal(await db.groupDiningMember.count({ where: { groupId: g.id } }), 1);
  for (const user of ["chongwei", "yojin"]) {
    assert.equal(
      (await request(`/groups/${g.id}/join`, user, { partySize: 1 })).status,
      200,
    );
  }
  const duplicate = await request(`/groups/${g.id}/join`, "chongwei", {});
  assert.equal(duplicate.status, 200);
  assert.equal(duplicate.data.group.members.length, 3);
  assert.equal(duplicate.data.group.status, "OPEN");
  assert.equal(
    (await request(`/groups/${g.id}/join`, "chongwei", { partySize: 2 })).status,
    400,
  );
  const users = ["wallace", "harsh", "hansen"];
  const results = await Promise.all(
    users.map((user) => request(`/groups/${g.id}/join`, user, {})),
  );
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 200, 409]);
  const full = (await request(`/groups/${g.id}`)).data.group;
  assert.equal(full.members.length, 5);
  assert.ok(full.members.every((party: { partySize: number }) => party.partySize === 1));
  assert.equal(full.booking.partySize, 5);
  const bookingId = full.booking.id;
  const winners = users.filter((_, i) => results[i].status === 200);
  for (const user of winners) await request(`/groups/${g.id}/leave`, user, {});
  const short = (await request(`/groups/${g.id}`)).data.group;
  assert.equal(short.status, "OPEN");
  assert.equal(short.booking.status, "PENDING");
  const restored = await request(`/groups/${g.id}/join`, winners[0], {});
  assert.equal(restored.data.group.status, "CONFIRMED");
  assert.equal(restored.data.group.booking.id, bookingId);
  for (const user of ["jacob", "chongwei"]) {
    const personal = (await request("/me/bookings", user)).data.bookings.find(
      (booking: { id: string }) => booking.id === bookingId,
    );
    assert.equal(personal.yourPartySize, 1);
    assert.equal(personal.partySize, 4);
  }
  const loser = users[results.findIndex((r) => r.status === 409)];
  assert.equal(
    (await request(`/groups/${g.id}/resize`, loser, { partySize: 1 })).status,
    403,
  );
  assert.equal(
    (await request(`/groups/${g.id}/resize`, "jacob", { partySize: 1 })).status,
    200,
  );
});

test("existing multi-diner records are preserved and can only shrink to one seat", async () => {
  const s = await slot(4, 6);
  const created = await request("/groups", "jacob", {
    slotId: s.id,
    title: "Existing reservation test",
  });
  const g = created.data.group;
  // Represent a reservation made before individual accounts were required.
  await db.groupDiningMember.update({
    where: { groupId_userId: { groupId: g.id, userId: g.hostId } },
    data: { partySize: 3 },
  });
  assert.equal((await request(`/groups/${g.id}`)).data.group.members[0].partySize, 3);
  const joined = await request(`/groups/${g.id}/join`, "chongwei", {});
  assert.equal(joined.data.group.booking.partySize, 4);
  assert.equal(
    (await request(`/groups/${g.id}/resize`, "jacob", { partySize: 2 })).status,
    400,
  );
  assert.equal((await request(`/groups/${g.id}/resize`, "jacob", {})).status, 400);
  const reduced = await request(`/groups/${g.id}/resize`, "jacob", { partySize: 1 });
  assert.equal(reduced.data.group.status, "OPEN");
  assert.equal(reduced.data.group.booking.status, "PENDING");
  assert.equal(reduced.data.group.booking.id, joined.data.group.booking.id);
  assert.ok(
    reduced.data.group.members.every(
      (party: { partySize: number }) => party.partySize === 1,
    ),
  );
});

test("Host departure hands over to the earliest Joining Party; an empty Event releases the table", async () => {
  const g = await group();
  await request(`/groups/${g.id}/join`, "chongwei", {});
  await request(`/groups/${g.id}/join`, "yojin", {});
  const departed = await request(`/groups/${g.id}/leave`, "jacob", {});
  assert.equal(departed.status, 200);
  const chongwei = await db.user.findUniqueOrThrow({
    where: { email: "chongwei@gmail.com" },
  });
  assert.equal(departed.data.group.hostId, chongwei.id);
  assert.equal(departed.data.group.booking.userId, chongwei.id);
  assert.equal(departed.data.group.booking.partySize, 2);
  assert.equal((await request(`/groups/${g.id}/cancel`, "jacob", {})).status, 403);
  assert.ok(
    !(await request("/me/bookings", "jacob")).data.bookings.some(
      (b: { id: string }) => b.id === departed.data.group.booking.id,
    ),
  );
  assert.ok(
    !(await request("/me/groups", "jacob")).data.groups.some(
      (event: { id: string }) => event.id === g.id,
    ),
  );
  const handed = await request(`/groups/${g.id}/leave`, "chongwei", {});
  assert.equal(handed.data.group.host.name, "Yojin");
  assert.equal(handed.data.group.status, "OPEN");
  const empty = await request(`/groups/${g.id}/leave`, "yojin", {});
  assert.equal(empty.data.group.status, "CANCELLED");
  assert.equal(empty.data.group.members.length, 0);
  assert.equal(empty.data.group.booking.status, "CANCELLED");
  assert.equal(await db.slotAllocation.count({ where: { slotId: g.slotId } }), 0);
  const ordinary = await request("/bookings", "wallace", {
    slotId: g.slotId,
    partySize: 2,
  });
  assert.equal(ordinary.status, 201);
  const personal = (await request("/me/bookings", "wallace")).data.bookings.find(
    (booking: { id: string }) => booking.id === ordinary.data.booking.id,
  );
  assert.equal(personal.yourPartySize, 2);
  assert.equal(personal.group, null);
  const cancelled = (await request("/me/bookings", "yojin")).data.bookings.find(
    (booking: { id: string }) => booking.id === empty.data.group.booking.id,
  );
  assert.equal(cancelled.yourPartySize, null);
});

test("started confirmed Events preserve bookings and reject membership changes", async () => {
  const g = await group();
  const joined = await request(`/groups/${g.id}/join`, "chongwei", {});
  await db.reservationSlot.update({
    where: { id: g.slotId },
    data: { startsAt: new Date(Date.now() - 60000) },
  });
  for (const [action, user, body] of [
    ["join", "yojin", {}],
    ["leave", "chongwei", {}],
    ["resize", "jacob", { partySize: 2 }],
  ] as const) {
    assert.equal((await request(`/groups/${g.id}/${action}`, user, body)).status, 409);
  }
  const history = (await request(`/groups/${g.id}`)).data.group;
  assert.equal(history.status, "CONFIRMED");
  assert.equal(history.booking.id, joined.data.group.booking.id);
  assert.equal(history.booking.partySize, 2);
});
