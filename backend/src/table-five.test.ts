import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { db } from "./db.js";
import {
  clearUsabilityFixtures,
  prepareUsabilityFixtures,
} from "./usability-fixtures.js";

let scenario: Awaited<ReturnType<typeof prepareUsabilityFixtures>>;
const cookies: Record<string, string> = {};
async function login(name: string, email = `${name}@demo.com`) {
  const r = await fetch("http://localhost:4000/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "password123" }),
  });
  assert.equal(r.status, 200);
  cookies[name] = r.headers.get("set-cookie")!.split(";")[0];
  return (await r.json()).user;
}
async function request(path: string, who: string, body?: unknown) {
  const r = await fetch(`http://localhost:4000/api${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { cookie: cookies[who], "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: r.status, data: await r.json() };
}
before(async () => {
  scenario = await prepareUsabilityFixtures();
  for (const who of ["alex", "ava", "beth", "cara", "dan"]) await login(who);
  await login("merchant", "peacock@business.com");
});
after(async () => {
  await clearUsabilityFixtures();
  await db.$disconnect();
});

test("Table 5 D2-D7 and RT2-RT5 execute against repeatable scenarios with persisted shared state", async () => {
  const t = scenario.tasks;
  assert.equal(
    (await request(`/groups/${t.D2}/join`, "alex", {})).data.group.status,
    "CONFIRMED",
  );
  const created = await request("/groups", "alex", {
    slotId: t.D3,
    title: "Women’s dinner",
    genderFilter: "FEMALE",
    minAge: 25,
    maxAge: 35,
  });
  assert.equal(created.status, 201, JSON.stringify(created.data));
  assert.equal(
    (await request(`/groups/${created.data.group.id}/join`, "dan", {})).status,
    404,
  );
  assert.equal(
    (await request(`/groups/${created.data.group.id}/join`, "ava", { minAge: 18 }))
      .status,
    400,
  );
  const pending = (await request(`/groups/${t.D4}`, "alex")).data.group;
  assert.equal(
    Date.parse(pending.slot.startsAt) - Date.parse(pending.cutoffAt),
    2 * 3600000,
  );
  assert.equal(pending.status, "OPEN");
  const choice = (await request(`/groups/${t.priceChoice}`, "alex")).data.group;
  assert.equal(choice.status, "PRICE_DECISION");
  assert.equal(
    (await request(`/groups/${t.priceChoice}/accept-price`, "alex", {})).status,
    200,
  );
  assert.equal(
    (await request(`/groups/${t.priceChoice}/decline-price`, "cara", {})).data.group
      .status,
    "FULL_PRICE",
  );
  assert.equal(
    (await request("/me/notifications", "beth")).data.notifications.some(
      (n: { groupId: string }) => n.groupId === t.D5,
    ),
    true,
  );
  assert.equal(
    (await request(`/groups/${t.D5}/join`, "beth", {})).data.group.status,
    "CONFIRMED",
  );
  assert.equal((await request(`/groups/${t.D6}/leave`, "alex", {})).status, 409);
  assert.equal(
    (await request(`/groups/${t.D6}/leave`, "alex", { acknowledgeStrike: true })).data
      .group.status,
    "LAST_CALL",
  );
  assert.equal((await request("/me/profile", "alex")).data.profile.reliabilityStrikes, 1);
  const feedback = {
    overall: 4,
    safety: "SOMEWHAT",
    social: 4,
    meal: 5,
    dineAgain: "MAYBE",
    suggestions: "Fixture response",
    attended: true,
  };
  assert.equal((await request(`/groups/${t.D7}/feedback`, "alex", feedback)).status, 200);
  assert.equal(
    (
      await request(`/groups/${t.D7}/safety`, "alex", {
        action: "REPORT",
        targetId: scenario.people.ava,
        reason: "Usability fixture report",
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await request(`/groups/${t.D7}/safety`, "alex", {
        action: "BLOCK",
        targetId: scenario.people.ava,
      })
    ).status,
    200,
  );
  assert.equal((await request(`/groups/${t.D2}`, "alex")).status, 200); // own booking remains accessible
  const actorNotice = await db.notification.count({
    where: { userId: scenario.people.ava, title: { contains: "block" } },
  });
  assert.equal(actorNotice, 0);
  console.log("PASS Table 5: D2, D3, D4, D5, D6, D7");

  assert.equal(
    (
      await request("/business/events", "merchant", {
        slotId: t.RT2,
        title: "Table 12",
        minimumPartySize: 4,
        capacity: 6,
        discount: 9,
      })
    ).status,
    400,
  );
  const release = await request("/business/events", "merchant", {
    slotId: t.RT2,
    title: "Table 12",
    minimumPartySize: 4,
    capacity: 6,
    discount: 40,
  });
  assert.equal(release.status, 201, JSON.stringify(release.data));
  assert.equal(release.data.group.heldSeats, 6);
  assert.equal(release.data.group.slot.minimumPartySize, 4);
  const themed = await request("/business/events", "merchant", {
    slotId: t.RT3,
    title: "Ladies’ Night",
    theme: "Ladies’ Night",
    minimumPartySize: 4,
    capacity: 6,
    discount: 40,
    genderFilter: "FEMALE",
    minAge: 25,
    maxAge: 45,
  });
  assert.equal(themed.status, 201, JSON.stringify(themed.data));
  assert.equal(
    (await request(`/groups/${themed.data.group.id}/join`, "beth", {})).status,
    200,
  );
  assert.equal(
    (await request(`/groups/${themed.data.group.id}/join`, "dan", {})).status,
    404,
  );
  const held = (await request(`/business/events/${t.RT4}`, "merchant")).data.group;
  assert.equal(held.heldSeats, 4);
  await db.reservationSlot.update({
    where: { id: held.slotId },
    data: { startsAt: new Date(Date.now() + 3600000) },
  });
  const released = (await request(`/business/events/${t.RT4}`, "merchant")).data.group;
  assert.equal(released.heldSeats, 2);
  assert.equal(released.releasedAtCutoff, 2);
  assert.equal(released.status, "PRICE_DECISION");
  assert.equal(
    (
      await request(`/business/events/${t.RT5chat}/messages`, "merchant", {
        body: "Your table is ready.",
      })
    ).status,
    201,
  );
  assert.equal(
    (await request(`/groups/${t.RT5chat}/messages`, "beth")).data.messages.at(-1).body,
    "Your table is ready.",
  );
  const averages = (await request(`/business/events/${t.RT5feedback}`, "merchant")).data
    .feedback;
  assert.equal(averages.count, 2);
  assert.equal(averages.overall, 4.5);
  assert.ok(!("suggestions" in averages));
  console.log("PASS Table 5: RT2, RT3, RT4, RT5");
});
