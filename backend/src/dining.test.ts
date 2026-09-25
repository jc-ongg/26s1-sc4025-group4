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
async function slot() {
  const id = `test-${randomUUID()}`;
  slotIds.push(id);
  return db.reservationSlot.create({
    data: {
      id,
      restaurantId: "joya",
      startsAt: new Date(Date.now() + 30 * 86400000 + Math.random() * 86400000),
      minimumPartySize: 2,
      capacity: 4,
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
test("host confirms below capacity after minimum; shared booking is immutable and idempotent", async () => {
  const g = await group();
  assert.equal(g.members.length, 1);
  assert.equal((await request(`/groups/${g.id}/confirm`, "jacob", {})).status, 409);
  assert.equal((await request(`/groups/${g.id}/confirm`, "alice", {})).status, 403);
  assert.equal((await request(`/groups/${g.id}/cancel`, "alice", {})).status, 403);
  assert.equal((await request(`/groups/${g.id}/leave`, "jacob", {})).status, 409);
  await request(`/groups/${g.id}/join`, "alice", {});
  await request(`/groups/${g.id}/join`, "alice", {});
  assert.equal((await request(`/groups/${g.id}`)).data.group.members.length, 2);
  const confirmed = await request(`/groups/${g.id}/confirm`, "jacob", {});
  assert.equal(confirmed.status, 200);
  assert.equal(confirmed.data.group.status, "CONFIRMED");
  assert.equal(confirmed.data.group.booking.partySize, 2);
  const repeat = await request(`/groups/${g.id}/confirm`, "jacob", {});
  assert.equal(repeat.data.group.booking.id, confirmed.data.group.booking.id);
  assert.equal((await request(`/groups/${g.id}/join`, "bob", {})).status, 409);
  assert.equal((await request(`/groups/${g.id}/leave`, "alice", {})).status, 409);
  assert.ok(
    (await request("/me/bookings", "alice")).data.bookings.some(
      (b: { id: string }) => b.id === confirmed.data.group.booking.id,
    ),
  );
  assert.equal(
    (await request("/bookings", "bob", { slotId: g.slotId, partySize: 2 })).status,
    409,
  );
  assert.equal((await request(`/groups/${g.id}/cancel`, "jacob", {})).status, 200);
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
  assert.equal(full.status, "FULL");
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
  await db.reservationSlot.update({
    where: { id: g.slotId },
    data: { startsAt: new Date(Date.now() - 60000) },
  });
  const result = await request(`/groups/${g.id}`);
  assert.equal(result.data.group.status, "EXPIRED");
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
