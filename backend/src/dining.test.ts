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
  for (const name of ["jacob", "alice", "bob", "charlie"]) {
    const response = await fetch(`${base}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: `${name}@example.com`,
        password: "demo123",
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
  assert.equal((await request(`/groups/${g.id}/confirm`, "alice", {})).status, 403);
  assert.equal((await request(`/groups/${g.id}/cancel`, "alice", {})).status, 403);
  const joined = await request(`/groups/${g.id}/join`, "alice", {});
  assert.equal(joined.status, 200);
  assert.equal(joined.data.group.status, "CONFIRMED");
  const id = joined.data.group.booking.id;
  await request(`/groups/${g.id}/join`, "alice", {});
  assert.equal((await request(`/groups/${g.id}`)).data.group.members.length, 2);
  const extra = await request(`/groups/${g.id}/join`, "bob", {});
  assert.equal(extra.status, 200);
  assert.equal(extra.data.group.booking.partySize, 3);
  await request(`/groups/${g.id}/leave`, "alice", {});
  const short = await request(`/groups/${g.id}/leave`, "bob", {});
  assert.equal(short.data.group.status, "OPEN");
  assert.equal(short.data.group.booking.status, "PENDING");
  assert.equal((await request(`/bookings/${id}/delete`, "jacob", {})).status, 409);
  assert.ok(
    !(await request("/me/bookings")).data.bookings.some(
      (b: { id: string }) => b.id === id,
    ),
  );
  const restored = await request(`/groups/${g.id}/join`, "alice", {});
  assert.equal(restored.data.group.booking.id, id);
  assert.equal(restored.data.group.booking.status, "CONFIRMED");
  const repeat = await request(`/groups/${g.id}/confirm`, "jacob", {});
  assert.equal(repeat.data.group.booking.id, id);
  assert.equal(await db.booking.count({ where: { groupId: g.id } }), 1);
  assert.ok(
    (await request("/me/bookings", "alice")).data.bookings.some(
      (b: { id: string }) => b.id === id,
    ),
  );
  assert.equal(
    (await request("/bookings", "bob", { slotId: g.slotId, partySize: 2 })).status,
    409,
  );
  await request(`/groups/${g.id}/cancel`, "jacob", {});
  assert.equal((await request(`/groups/${g.id}`)).data.group.booking.status, "CANCELLED");
  assert.equal(await db.slotAllocation.count({ where: { slotId: g.slotId } }), 0);
});
test("simultaneous last-seat joins never overfill; leaving a full table reopens it", async () => {
  const g = await group(2);
  const results = await Promise.all(
    ["alice", "bob", "charlie"].map((user) => request(`/groups/${g.id}/join`, user, {})),
  );
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 409, 409]);
  const full = (await request(`/groups/${g.id}`)).data.group;
  assert.equal(full.status, "CONFIRMED");
  assert.equal(full.members.length, 2);
  const winner = ["alice", "bob", "charlie"][results.findIndex((r) => r.status === 200)];
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
    request("/bookings", "alice", { slotId: s.id, partySize: 2 }),
  ]);
  assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
  assert.equal(await db.slotAllocation.count({ where: { slotId: s.id } }), 1);
  if (results[0].status === 201)
    await request(`/groups/${results[0].data.group.id}/cancel`, "jacob", {});
  else {
    const id = results[1].data.booking.id;
    assert.equal((await request(`/bookings/${id}/cancel`, "bob", {})).status, 403);
    await request(`/bookings/${id}/cancel`, "alice", {});
  }
  assert.equal(
    (await request("/bookings", "bob", { slotId: s.id, partySize: 2 })).status,
    201,
  );
});
test("started unconfirmed groups expire and release their inventory", async () => {
  const g = await group();
  await request(`/groups/${g.id}/join`, "alice", {});
  await request(`/groups/${g.id}/leave`, "alice", {});
  assert.equal((await request(`/groups/${g.id}`)).data.group.booking.status, "PENDING");
  await db.reservationSlot.update({
    where: { id: g.slotId },
    data: { startsAt: new Date(Date.now() - 60000) },
  });
  const result = await request(`/groups/${g.id}`);
  assert.equal(result.data.group.status, "EXPIRED");
  assert.equal(result.data.group.booking.status, "CANCELLED");
  assert.equal(await db.slotAllocation.count({ where: { slotId: g.slotId } }), 0);
  assert.equal((await request(`/groups/${g.id}/join`, "alice", {})).status, 409);
});

test("cancelled booking deletion is personal, persistent and rejects active or unrelated bookings", async () => {
  const g = await group();
  assert.ok(
    (await request("/me/groups")).data.groups.some((x: { id: string }) => x.id === g.id),
  );
  await request(`/groups/${g.id}/join`, "alice", {});
  const confirmed = await request(`/groups/${g.id}/confirm`, "jacob", {});
  const id = confirmed.data.group.booking.id;
  assert.equal((await request(`/bookings/${id}/delete`, "jacob", {})).status, 409);
  await request(`/groups/${g.id}/cancel`, "jacob", {});
  assert.equal((await request(`/bookings/${id}/delete`, "bob", {})).status, 403);
  assert.equal((await request(`/bookings/${id}/delete`, "anonymous", {})).status, 401);
  assert.equal((await request(`/bookings/${id}/delete`, "alice", {})).status, 200);
  assert.equal((await request(`/bookings/${id}/delete`, "alice", {})).status, 200);
  assert.ok(
    !(await request("/me/bookings", "alice")).data.bookings.some(
      (b: { id: string }) => b.id === id,
    ),
  );
  assert.ok(
    !(await request("/me/groups", "alice")).data.groups.some(
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

test("Party sizes determine qualification, resizing and concurrent remaining capacity", async () => {
  const s = await slot(4, 6);
  for (const partySize of [0, 4, 1.5, "2", null]) {
    assert.equal(
      (
        await request("/groups", "jacob", {
          slotId: s.id,
          title: "Party test",
          partySize,
        })
      ).status,
      400,
    );
  }
  const created = await request("/groups", "jacob", {
    slotId: s.id,
    title: "Party test",
    partySize: 2,
  });
  assert.equal(created.status, 201);
  const g = created.data.group;
  assert.equal(g.members[0].partySize, 2);
  assert.equal(g.status, "OPEN");
  for (const partySize of [0, 4, 7, 1.5, "2", null]) {
    assert.equal(
      (await request(`/groups/${g.id}/join`, "alice", { partySize })).status,
      400,
    );
  }
  assert.equal(await db.groupDiningMember.count({ where: { groupId: g.id } }), 1);
  const joined = await request(`/groups/${g.id}/join`, "alice", { partySize: 2 });
  assert.equal(joined.data.group.booking.partySize, 4);
  const duplicate = await request(`/groups/${g.id}/join`, "alice", { partySize: 3 });
  assert.equal(duplicate.status, 200);
  assert.equal(duplicate.data.group.booking.partySize, 4);
  const bookingId = joined.data.group.booking.id;
  const results = await Promise.all(
    ["bob", "charlie"].map((user) =>
      request(`/groups/${g.id}/join`, user, { partySize: 2 }),
    ),
  );
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
  const full = (await request(`/groups/${g.id}`)).data.group;
  assert.equal(
    full.members.reduce((n: number, p: { partySize: number }) => n + p.partySize, 0),
    6,
  );
  assert.equal(full.booking.partySize, 6);
  assert.equal(
    (await request(`/groups/${g.id}/resize`, "alice", { partySize: 3 })).status,
    409,
  );
  const winner = results[0].status === 200 ? "bob" : "charlie";
  await request(`/groups/${g.id}/leave`, winner, {});
  const short = await request(`/groups/${g.id}/resize`, "alice", { partySize: 1 });
  assert.equal(short.data.group.status, "OPEN");
  assert.equal(short.data.group.booking.status, "PENDING");
  const restored = await request(`/groups/${g.id}/resize`, "jacob", { partySize: 3 });
  assert.equal(restored.data.group.status, "CONFIRMED");
  assert.equal(restored.data.group.booking.id, bookingId);
  for (const [user, expectedSize] of [
    ["jacob", 3],
    ["alice", 1],
  ] as const) {
    const personal = (await request("/me/bookings", user)).data.bookings.find(
      (booking: { id: string }) => booking.id === bookingId,
    );
    assert.equal(personal.yourPartySize, expectedSize);
    assert.equal(personal.partySize, 4);
    assert.ok(!("members" in personal.group));
  }
  assert.equal(
    (await request(`/groups/${g.id}/resize`, winner, { partySize: 1 })).status,
    403,
  );
  const details = (await request(`/restaurants/${s.restaurantId}`)).data;
  assert.ok(details.groups.some((event: { id: string }) => event.id === g.id));
});

test("Host departure hands over to the earliest Joining Party; an empty Event releases the table", async () => {
  const g = await group();
  await request(`/groups/${g.id}/join`, "alice", {});
  await request(`/groups/${g.id}/join`, "bob", {});
  const departed = await request(`/groups/${g.id}/leave`, "jacob", {});
  assert.equal(departed.status, 200);
  const alice = await db.user.findUniqueOrThrow({
    where: { email: "alice@example.com" },
  });
  assert.equal(departed.data.group.hostId, alice.id);
  assert.equal(departed.data.group.booking.userId, alice.id);
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
  const handed = await request(`/groups/${g.id}/leave`, "alice", {});
  assert.equal(handed.data.group.host.name, "Bob");
  assert.equal(handed.data.group.status, "OPEN");
  const empty = await request(`/groups/${g.id}/leave`, "bob", {});
  assert.equal(empty.data.group.status, "CANCELLED");
  assert.equal(empty.data.group.members.length, 0);
  assert.equal(empty.data.group.booking.status, "CANCELLED");
  assert.equal(await db.slotAllocation.count({ where: { slotId: g.slotId } }), 0);
  const ordinary = await request("/bookings", "charlie", {
    slotId: g.slotId,
    partySize: 2,
  });
  assert.equal(ordinary.status, 201);
  const personal = (await request("/me/bookings", "charlie")).data.bookings.find(
    (booking: { id: string }) => booking.id === ordinary.data.booking.id,
  );
  assert.equal(personal.yourPartySize, 2);
  assert.equal(personal.group, null);
  const cancelled = (await request("/me/bookings", "bob")).data.bookings.find(
    (booking: { id: string }) => booking.id === empty.data.group.booking.id,
  );
  assert.equal(cancelled.yourPartySize, null);
});

test("started confirmed Events preserve bookings and reject membership changes", async () => {
  const g = await group();
  const joined = await request(`/groups/${g.id}/join`, "alice", {});
  await db.reservationSlot.update({
    where: { id: g.slotId },
    data: { startsAt: new Date(Date.now() - 60000) },
  });
  for (const [action, user, body] of [
    ["join", "bob", {}],
    ["leave", "alice", {}],
    ["resize", "jacob", { partySize: 2 }],
  ] as const) {
    assert.equal((await request(`/groups/${g.id}/${action}`, user, body)).status, 409);
  }
  const history = (await request(`/groups/${g.id}`)).data.group;
  assert.equal(history.status, "CONFIRMED");
  assert.equal(history.booking.id, joined.data.group.booking.id);
  assert.equal(history.booking.partySize, 2);
});
