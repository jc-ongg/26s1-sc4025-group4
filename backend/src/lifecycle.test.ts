import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { db } from "./db.js";

const base = process.env.TEST_API_URL ?? "http://localhost:4000/api";
const users: { id: string; cookie: string }[] = [];
const slots: string[] = [];
async function request(path: string, who = 0, body?: unknown) {
  const response = await fetch(`${base}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { Cookie: users[who].cookie, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, data: await response.json() };
}
async function slot(minimumPartySize = 2, capacity = 4, discountedSeats = capacity) {
  const id = `lifecycle-${randomUUID()}`;
  slots.push(id);
  return db.reservationSlot.create({
    data: {
      id,
      restaurantId: "joya",
      startsAt: new Date(Date.now() + 30 * 86400000 + Math.random() * 86400000),
      minimumPartySize,
      capacity,
      discountedSeats,
      discount: 40,
    },
  });
}
async function event(who = 0, minimum = 2, capacity = 4, pool = capacity) {
  const s = await slot(minimum, capacity, pool);
  const result = await request("/groups", who, {
    slotId: s.id,
    title: "Lifecycle fixture",
  });
  assert.equal(result.status, 201, JSON.stringify(result.data));
  return result.data.group;
}
async function due(group: { slotId: string }, started = false) {
  await db.reservationSlot.update({
    where: { id: group.slotId },
    data: { startsAt: new Date(Date.now() + (started ? -60000 : 3600000)) },
  });
}
before(async () => {
  for (let i = 0; i < 6; i++) {
    const user = await db.user.create({
      data: {
        email: `${randomUUID()}@example.com`,
        name: `Lifecycle diner ${i}`,
        demoPassword: "test-only",
        singpassVerified: true,
        dateOfBirth: new Date("2000-01-01"),
        gender: "MALE",
      },
    });
    const login = await fetch(`${base}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: user.email, password: "test-only" }),
    });
    assert.equal(login.status, 200);
    users.push({ id: user.id, cookie: login.headers.get("set-cookie")!.split(";")[0] });
  }
});
after(async () => {
  // These fixtures own their slots and accounts; persisted demo data is untouched.
  await db.$transaction(async (tx) => {
    await tx.slotAllocation.deleteMany({ where: { slotId: { in: slots } } });
    await tx.booking.deleteMany({ where: { slotId: { in: slots } } });
    await tx.groupDiningMember.deleteMany({
      where: { group: { slotId: { in: slots } } },
    });
    await tx.groupDiningSession.deleteMany({ where: { slotId: { in: slots } } });
    await tx.reservationSlot.deleteMany({ where: { id: { in: slots } } });
    await tx.user.deleteMany({ where: { id: { in: users.map((u) => u.id) } } });
  });
  await db.$disconnect();
});

test("shared pool caps concurrent bookings and enforces Join before creating another Event", async () => {
  const g = await event(0, 2, 4, 8);
  assert.equal(
    (await request("/groups", 1, { slotId: g.slotId, title: "Duplicate" })).status,
    409,
  );
  for (const who of [1, 2, 3])
    assert.equal((await request(`/groups/${g.id}/join`, who, {})).status, 200);
  const next = await request("/groups", 4, { slotId: g.slotId, title: "Second table" });
  assert.equal(next.status, 201);
  assert.equal((await request(`/groups/${next.data.group.id}/join`, 0, {})).status, 409);
  const results = await Promise.all(
    [4, 5].map((who) => request("/bookings", who, { slotId: g.slotId, partySize: 2 })),
  );
  assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
  assert.equal(
    (
      await db.slotAllocation.aggregate({
        where: { slotId: g.slotId },
        _sum: { seats: true },
      })
    )._sum.seats,
    8,
  );
});
test("Cutoff releases unused Held Seats; a short Event requires an explicit price choice", async () => {
  const g = await event(0, 4, 6);
  assert.equal(g.heldSeats, 4);
  await due(g);
  const first = await request(`/groups/${g.id}`);
  assert.equal(first.data.group.status, "PRICE_DECISION");
  assert.equal(first.data.group.heldSeats, 1);
  assert.equal(first.data.group.releasedAtCutoff, 3);
  assert.equal((await request(`/groups/${g.id}/join`, 1, {})).status, 409);
  assert.equal(
    (await request("/groups", 1, { slotId: g.slotId, title: "Too late" })).status,
    409,
  );
  const accepted = await request(`/groups/${g.id}/accept-price`, 0, {});
  assert.equal(accepted.status, 200);
  assert.equal(accepted.data.group.status, "FULL_PRICE");
  assert.equal(accepted.data.group.booking.discount, 0);
  assert.equal(accepted.data.group.booking.partySize, 1);
  assert.equal((await request(`/groups/${g.id}/leave`, 0, {})).status, 200);
  assert.equal(await db.reliabilityStrike.count({ where: { groupId: g.id } }), 0);
  const declined = await event();
  await due(declined);
  assert.equal(
    (await request(`/groups/${declined.id}/decline-price`, 0, {})).data.group.status,
    "CANCELLED",
  );
  assert.equal(await db.slotAllocation.count({ where: { groupId: declined.id } }), 0);
  const unanswered = await event();
  await due(unanswered, true);
  assert.equal((await request(`/groups/${unanswered.id}`)).data.group.status, "EXPIRED");
});
test("late Leave warns, records one strike, opens Last Call and refills the same booking", async () => {
  const g = await event(0);
  const joined = await request(`/groups/${g.id}/join`, 1, {});
  const bookingId = joined.data.group.booking.id;
  await due(g);
  const warning = await request(`/groups/${g.id}/leave`, 1, {});
  assert.equal(warning.status, 409);
  assert.equal(await db.reliabilityStrike.count({ where: { groupId: g.id } }), 0);
  assert.equal(
    (await request(`/groups/${g.id}/leave`, 1, { acknowledgeStrike: true })).data.group
      .status,
    "LAST_CALL",
  );
  assert.equal(await db.reliabilityStrike.count({ where: { groupId: g.id } }), 1);
  const refill = await request(`/groups/${g.id}/join`, 2, {});
  assert.equal(refill.data.group.status, "CONFIRMED");
  assert.equal(refill.data.group.booking.id, bookingId);
  await request(`/groups/${g.id}/leave`, 2, { acknowledgeStrike: true });
  assert.equal(
    (await request(`/groups/${g.id}/leave`, 0, {})).data.group.status,
    "CANCELLED",
  );
  assert.equal(
    await db.reliabilityStrike.count({ where: { groupId: g.id, userId: users[0].id } }),
    0,
  );
});
test("Last Call invites only nearby eligible diners and unresolved seats revert to full price", async () => {
  const g = await event(0);
  await request(`/groups/${g.id}/join`, 1, {});
  const restaurant = await db.restaurant.findUniqueOrThrow({ where: { id: "joya" } });
  assert.ok(restaurant.latitude !== null);
  await request("/me/profile", 3, { diningArea: "jurong east" });
  await request("/me/profile", 4, { diningArea: "orchard" });
  // Use the venue's actual neighbourhood so the near/far check is geographic.
  await request("/me/profile", 3, { diningArea: restaurant.area.toLowerCase() });
  await due(g);
  await request(`/groups/${g.id}/leave`, 1, { acknowledgeStrike: true });
  const invites = await db.notification.findMany({
    where: { groupId: g.id, key: { contains: ":invite:" } },
  });
  assert.ok(invites.some((n) => n.userId === users[3].id));
  assert.ok(!invites.some((n) => n.userId === users[4].id));
  const inbox = await request("/me/notifications", 3);
  const notice = inbox.data.notifications.find(
    (n: { groupId: string }) => n.groupId === g.id,
  );
  assert.ok(notice);
  assert.equal(
    (await request("/me/notifications/read", 4, { id: notice.id })).status,
    404,
  );
  assert.equal(
    (await request("/me/notifications/read", 3, { id: notice.id })).status,
    200,
  );
  const size = await db.notification.count({ where: { groupId: g.id } });
  await request(`/groups/${g.id}`);
  assert.equal(await db.notification.count({ where: { groupId: g.id } }), size);
  await due(g, true);
  const ended = await request(`/groups/${g.id}`);
  assert.equal(ended.data.group.status, "FULL_PRICE");
  assert.equal(ended.data.group.booking.discount, 0);
  assert.ok(
    !(await request("/me/notifications", 3)).data.notifications.some(
      (n: { id: string }) => n.id === notice.id,
    ),
  );
});
test("Chat and private feedback require membership; feedback also requires elapsed dining time and attestation", async () => {
  const g = await event(0);
  assert.equal((await request(`/groups/${g.id}/messages`, 0)).status, 409);
  assert.equal((await request(`/groups/${g.id}/messages`, 2)).status, 404);
  await request(`/groups/${g.id}/join`, 1, {});
  const body = "<script>plain text only</script>";
  assert.equal((await request(`/groups/${g.id}/messages`, 0, { body })).status, 201);
  assert.equal(
    (await request(`/groups/${g.id}/messages`, 1)).data.messages[0].body,
    body,
  );
  assert.equal((await request(`/groups/${g.id}/messages`, 0, { body: " " })).status, 400);
  const feedback = {
    overall: 4,
    safety: "YES",
    social: 4,
    meal: 5,
    dineAgain: "YES",
    attended: true,
  };
  assert.equal((await request(`/groups/${g.id}/feedback`, 0, feedback)).status, 409);
  await due(g, true);
  assert.equal(
    (await request(`/groups/${g.id}/feedback`, 0, { ...feedback, attended: false }))
      .status,
    400,
  );
  assert.equal((await request(`/groups/${g.id}/feedback`, 0, feedback)).status, 200);
  assert.equal((await request(`/groups/${g.id}/feedback`, 1)).data.feedback, null);
  assert.equal((await request(`/groups/${g.id}/feedback`, 2)).status, 404);
  assert.ok(
    !JSON.stringify((await request(`/groups/${g.id}`, 1)).data).includes('"overall"'),
  );
});
test("silent blocking hides future shared Events and allows a penalty-free departure", async () => {
  const g = await event(4);
  await request(`/groups/${g.id}/join`, 5, {});
  await request(`/groups/${g.id}/messages`, 5, { body: "Hello" });
  assert.equal(
    (
      await request(`/groups/${g.id}/safety`, 4, {
        targetId: users[5].id,
        action: "REPORT",
        reason: "Fixture report",
      })
    ).status,
    200,
  );
  const before = await db.notification.count({ where: { userId: users[5].id } });
  assert.equal(
    (
      await request(`/groups/${g.id}/safety`, 4, {
        targetId: users[5].id,
        action: "BLOCK",
      })
    ).status,
    200,
  );
  assert.equal(await db.notification.count({ where: { userId: users[5].id } }), before);
  assert.equal(
    (await request("/groups", 4, { slotId: g.slotId, title: "A second seat" })).status,
    409,
  );
  await due(g);
  assert.equal((await request(`/groups/${g.id}/messages`, 4)).data.messages.length, 0);
  assert.equal((await request(`/groups/${g.id}/leave`, 4, {})).status, 200);
  assert.equal(
    await db.reliabilityStrike.count({ where: { userId: users[4].id, groupId: g.id } }),
    0,
  );
  const future = await event(5);
  assert.equal((await request(`/groups/${future.id}`, 4)).status, 404);
  assert.equal((await request(`/groups/${future.id}/join`, 4, {})).status, 404);
  assert.equal((await request("/me/blocks", 4)).data.blocks[0].id, users[5].id);
  await request(`/me/blocks/${users[5].id}/remove`, 4, {});
  assert.equal((await request(`/groups/${future.id}`, 4)).status, 200);
});
test("three recent late Leaves suspend only EatTogether; old strikes fall outside the window", async () => {
  const historical = await event(5);
  await db.reliabilityStrike.create({
    data: {
      userId: users[5].id,
      groupId: historical.id,
      reason: "LATE_LEAVE",
      createdAt: new Date(Date.now() - 91 * 86400000),
    },
  });
  for (let i = 0; i < 3; i++) {
    const g = await event(3);
    await request(`/groups/${g.id}/join`, 5, {});
    await due(g);
    assert.equal(
      (await request(`/groups/${g.id}/leave`, 5, { acknowledgeStrike: true })).status,
      200,
    );
  }
  const profile = (await request("/me/profile", 5)).data.profile;
  assert.equal(profile.reliabilityStrikes, 3);
  assert.equal(profile.strikes.length, 3);
  assert.ok(Date.parse(profile.suspendedUntil) > Date.now() + 6 * 86400000);
  const s = await slot();
  assert.equal(
    (await request("/groups", 5, { slotId: s.id, title: "Suspended" })).status,
    403,
  );
  assert.equal(
    (await request("/bookings", 5, { slotId: s.id, partySize: 2 })).status,
    201,
  );
  const g = await event(3);
  assert.equal((await request(`/groups/${g.id}/join`, 5, {})).status, 403);
});
