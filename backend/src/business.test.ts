import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { db } from "./db.js";

const cookies: Record<string, string> = {},
  users: string[] = [],
  slots: string[] = [];
async function login(
  key: string,
  email: string,
  password = "password123",
  accountType?: string,
) {
  const response = await fetch("http://localhost:4000/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, accountType }),
  });
  assert.equal(response.status, 200, await response.clone().text());
  cookies[key] = response.headers.get("set-cookie")!.split(";")[0];
  return response.json();
}
async function request(path: string, who: string, body?: unknown) {
  const response = await fetch(`http://localhost:4000/api${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { cookie: cookies[who], "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, data: await response.json() };
}
async function slot() {
  const id = `business-test-${randomUUID()}`;
  slots.push(id);
  return db.reservationSlot.create({
    data: {
      id,
      restaurantId: "joya",
      startsAt: new Date(Date.now() + 35 * 86400000),
      minimumPartySize: 4,
      capacity: 4,
      discountedSeats: 8,
      discount: 30,
    },
  });
}
async function restaurantEvent() {
  const s = await slot();
  const response = await request("/business/events", "joya", {
    slotId: s.id,
    title: "Business fixture",
    minimumPartySize: 2,
    capacity: 4,
    discount: 50,
  });
  assert.equal(response.status, 201, JSON.stringify(response.data));
  return response.data.group;
}
before(async () => {
  await login("joya", "joya@business.com", "password123", "BUSINESS");
  await login("seorae", "seorae@business.com");
  for (const [key, gender, dob] of [
    ["one", "MALE", "2005-01-01"],
    ["two", "MALE", "2004-01-01"],
    ["three", "FEMALE", "2000-01-01"],
  ] as const) {
    const user = await db.user.create({
      data: {
        name: `Business QA ${key}`,
        email: `${randomUUID()}@example.com`,
        demoPassword: "test-only",
        singpassVerified: true,
        dateOfBirth: new Date(dob),
        gender,
      },
    });
    users.push(user.id);
    await login(key, user.email, "test-only");
  }
});
after(async () => {
  await db.$transaction(async (tx) => {
    await tx.slotAllocation.deleteMany({ where: { slotId: { in: slots } } });
    await tx.booking.deleteMany({ where: { slotId: { in: slots } } });
    await tx.groupDiningMember.deleteMany({
      where: { group: { slotId: { in: slots } } },
    });
    await tx.groupDiningSession.deleteMany({ where: { slotId: { in: slots } } });
    await tx.reservationSlot.deleteMany({ where: { id: { in: slots } } });
    await tx.user.deleteMany({ where: { id: { in: users } } });
  });
  for (const cookie of Object.values(cookies))
    await fetch("http://localhost:4000/api/auth/logout", {
      method: "POST",
      headers: { cookie },
    });
  await db.$disconnect();
});

test("business accounts have a separate login identity and cannot access diner operations", async () => {
  assert.equal((await request("/restaurants", "joya")).status, 403);
  assert.equal(
    (await request("/groups", "joya", { slotId: "unused", title: "Not a diner" })).status,
    403,
  );
  assert.equal((await request("/business/dashboard?date=2026-10-14", "one")).status, 403);
  assert.equal(
    (await request("/business/dashboard?date=2026-02-30", "joya")).status,
    400,
  );
  const response = await fetch("http://localhost:4000/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "joya@business.com",
      password: "password123",
      accountType: "DINER",
    }),
  });
  assert.equal(response.status, 401);
});
test("Restaurant Events hold a whole table without a Host seat, preserve their offer, and protect inventory", async () => {
  const g = await restaurantEvent();
  assert.equal(g.status, "OPEN");
  assert.equal(g.members.length, 0);
  assert.equal(g.heldSeats, 4);
  assert.equal(g.slot.minimumPartySize, 2);
  assert.equal(g.discount, 50);
  assert.equal((await request(`/business/events/${g.id}`, "seorae")).status, 404);
  assert.equal((await request(`/groups/${g.id}/join`, "one", {})).status, 200);
  const joined = await request(`/groups/${g.id}/join`, "two", {});
  assert.equal(joined.data.group.status, "CONFIRMED");
  assert.equal(joined.data.group.hostId, g.hostId);
  assert.equal(joined.data.group.members.length, 2);
  assert.equal(joined.data.group.booking.discount, 50);
  assert.equal(joined.data.group.heldSeats, 4);
  assert.equal(
    (await request("/bookings", "three", { slotId: g.slotId, partySize: 4 })).status,
    201,
  );
  assert.equal(
    (await request("/bookings", "one", { slotId: g.slotId, partySize: 4 })).status,
    409,
  );
  const setting = {
    minimumPartySize: 4,
    capacity: 4,
    discountedSeats: 8,
    discount: 20,
    eatTogetherEnabled: true,
  };
  assert.equal(
    (await request(`/business/slots/${g.slotId}`, "joya", setting)).status,
    409,
  );
  assert.equal(
    (await request(`/business/slots/${g.slotId}`, "seorae", setting)).status,
    404,
  );
  assert.equal(
    (await request(`/business/events/${g.id}/withdraw`, "joya", {})).status,
    409,
  );
  assert.equal(
    (
      await request(`/business/events/${g.id}/messages`, "joya", {
        body: "Your table is ready.",
      })
    ).status,
    201,
  );
  assert.equal(
    (await request(`/groups/${g.id}/messages`, "one")).data.messages[0].userId,
    g.hostId,
  );
  assert.equal(
    (
      await request(`/groups/${g.id}/safety`, "one", {
        action: "REPORT",
        targetId: g.hostId,
        reason: "Test-only restaurant report",
      })
    ).status,
    200,
  );
  const left = await request(`/groups/${g.id}/leave`, "one", {});
  assert.equal(left.data.group.hostId, g.hostId);
  await request(`/groups/${g.id}/leave`, "two", {});
  const empty = (await request(`/business/events/${g.id}`, "joya")).data.group;
  assert.equal(empty.status, "OPEN");
  assert.equal(empty.heldSeats, 4);
  assert.equal(
    (await request(`/business/events/${g.id}/withdraw`, "joya", {})).status,
    200,
  );
  assert.equal(await db.slotAllocation.count({ where: { groupId: g.id } }), 0);
});
test("Themed Events enforce immutable filters and business slots can be excluded without changing existing bookings", async () => {
  const s = await slot();
  assert.equal(
    (
      await request("/business/events", "joya", {
        slotId: s.id,
        title: "Missing theme",
        genderFilter: "MALE",
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request("/business/events", "joya", {
        slotId: s.id,
        title: "Bad discount",
        discount: 9,
      })
    ).status,
    400,
  );
  const created = await request("/business/events", "joya", {
    slotId: s.id,
    title: "Themed fixture",
    theme: "Young adults",
    genderFilter: "MALE",
    minAge: 21,
    maxAge: 22,
    capacity: 4,
  });
  assert.equal(created.status, 201, JSON.stringify(created.data));
  const g = created.data.group;
  assert.equal((await request(`/groups/${g.id}`, "three")).status, 404);
  assert.equal((await request(`/groups/${g.id}/join`, "one", {})).status, 200);
  assert.equal(
    (
      await request(`/business/slots/${s.id}`, "joya", {
        minimumPartySize: 4,
        capacity: 4,
        discountedSeats: 8,
        discount: 30,
        eatTogetherEnabled: false,
      })
    ).status,
    200,
  );
  assert.equal((await request(`/groups/${g.id}/join`, "two", {})).status, 200);
  const fresh = await slot();
  assert.equal(
    (
      await request(`/business/slots/${fresh.id}`, "joya", {
        minimumPartySize: 2,
        capacity: 4,
        discountedSeats: 10,
        discount: 40,
        eatTogetherEnabled: false,
      })
    ).status,
    200,
  );
  assert.equal(
    (await request("/groups", "one", { slotId: fresh.id, title: "Excluded" })).status,
    409,
  );
  assert.equal(
    (await request("/bookings", "one", { slotId: fresh.id, partySize: 2 })).status,
    201,
  );
});
test("attendance is scoped, timed, idempotent, private, and correctable with matching price/reliability updates", async () => {
  const g = await restaurantEvent();
  await request(`/groups/${g.id}/join`, "one", {});
  await request(`/groups/${g.id}/join`, "two", {});
  const first = (await request(`/groups/${g.id}`, "one")).data.group.members.find(
    (m: { user: { name: string } }) => m.user.name === "Business QA one",
  ).userId;
  assert.equal(
    (
      await request(`/business/events/${g.id}/attendance`, "joya", {
        userId: first,
        status: "NO_SHOW",
      })
    ).status,
    409,
  );
  await db.reservationSlot.update({
    where: { id: g.slotId },
    data: { startsAt: new Date(Date.now() - 60000) },
  });
  assert.equal(
    (
      await request(`/business/events/${g.id}/attendance`, "seorae", {
        userId: first,
        status: "NO_SHOW",
      })
    ).status,
    404,
  );
  for (let i = 0; i < 2; i++)
    assert.equal(
      (
        await request(`/business/events/${g.id}/attendance`, "joya", {
          userId: first,
          status: "NO_SHOW",
        })
      ).status,
      200,
    );
  assert.equal(
    await db.reliabilityStrike.count({
      where: { groupId: g.id, userId: first, reason: "NO_SHOW" },
    }),
    1,
  );
  assert.equal(
    (await db.booking.findUniqueOrThrow({ where: { groupId: g.id } })).discount,
    0,
  );
  const visible = (await request(`/groups/${g.id}`, "two")).data.group;
  assert.ok(
    visible.members.every(
      (m: object) => !("attendance" in m) && !("attendanceRecordedAt" in m),
    ),
  );
  assert.equal(
    (await request(`/groups/${g.id}`, "one")).data.group.yourAttendance,
    "NO_SHOW",
  );
  const feedback = {
    overall: 4,
    safety: "YES",
    social: 5,
    meal: 4,
    dineAgain: "YES",
    attended: true,
  };
  assert.equal((await request(`/groups/${g.id}/feedback`, "one", feedback)).status, 409);
  assert.equal((await request(`/groups/${g.id}/feedback`, "two", feedback)).status, 200);
  const summary = (await request(`/business/events/${g.id}`, "joya")).data.feedback;
  assert.equal(summary.count, 1);
  assert.equal(summary.overall, 4);
  assert.ok(!JSON.stringify(summary).includes("userId"));
  for (const status of ["ATTENDED", "NO_SHOW", "ATTENDED"])
    assert.equal(
      (
        await request(`/business/events/${g.id}/attendance`, "joya", {
          userId: first,
          status,
        })
      ).status,
      200,
    );
  assert.equal(
    await db.reliabilityStrike.count({
      where: { groupId: g.id, userId: first, reason: "NO_SHOW" },
    }),
    0,
  );
  assert.equal(
    (await db.booking.findUniqueOrThrow({ where: { groupId: g.id } })).discount,
    50,
  );
});

test("an empty Restaurant Event releases its entire hold at Cutoff and records the release", async () => {
  const g = await restaurantEvent();
  await db.reservationSlot.update({
    where: { id: g.slotId },
    data: { startsAt: new Date(Date.now() + 3600000) },
  });
  const result = (await request(`/business/events/${g.id}`, "joya")).data.group;
  assert.equal(result.status, "CANCELLED");
  assert.equal(result.cutoffProcessed, true);
  assert.equal(result.cutoffHeadcount, 0);
  assert.equal(result.heldSeats, 0);
  assert.equal(result.releasedAtCutoff, 4);
});
