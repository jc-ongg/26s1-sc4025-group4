import { db } from "./db.js";
import { syncEvent, notify } from "./event-lifecycle.js";
import { lockSlot } from "./inventory.js";

const prefix = "usability-";
const actors = [
  ["alex", "Alex", "FEMALE", "2000-07-18"],
  ["ava", "Ava", "FEMALE", "2000-03-12"],
  ["beth", "Beth", "FEMALE", "2001-02-10"],
  ["cara", "Cara", "FEMALE", "2000-05-10"],
  ["dan", "Dan", "MALE", "2001-01-10"],
] as const;
export async function clearUsabilityFixtures() {
  // Only explicitly named practice slots and accounts are reset. Daily seeded
  // restaurants, the six team accounts, and unrelated reservations are retained.
  const slotIds = (
    await db.reservationSlot.findMany({
      where: { id: { startsWith: prefix } },
      select: { id: true },
    })
  ).map((s) => s.id);
  await db.$transaction(async (tx) => {
    const where = { slotId: { in: slotIds } };
    await tx.slotAllocation.deleteMany({ where });
    await tx.booking.deleteMany({ where });
    await tx.groupDiningMember.deleteMany({ where: { group: where } });
    await tx.groupDiningSession.deleteMany({ where });
    await tx.reservationSlot.deleteMany({ where: { id: { in: slotIds } } });
    const ids = (
      await tx.user.findMany({
        where: { email: { in: actors.map((a) => `${a[0]}@demo.com`) } },
        select: { id: true },
      })
    ).map((u) => u.id);
    await tx.dinerBlock.deleteMany({
      where: { OR: [{ blockerId: { in: ids } }, { blockedId: { in: ids } }] },
    });
    await tx.reliabilityStrike.deleteMany({ where: { userId: { in: ids } } });
    await tx.notification.deleteMany({ where: { userId: { in: ids } } });
    await tx.user.updateMany({
      where: { id: { in: ids } },
      data: { reliabilityStrikes: 0, suspendedUntil: null },
    });
  });
}

export async function prepareUsabilityFixtures() {
  await clearUsabilityFixtures();
  const people: Record<string, string> = {};
  for (const [key, name, gender, birth] of actors) {
    const values = {
      name,
      gender,
      dateOfBirth: new Date(birth),
      demoPassword: "password123",
      singpassVerified: true,
      diningArea: "joo koon",
    };
    const user = await db.user.upsert({
      where: { email: `${key}@demo.com` },
      create: { email: `${key}@demo.com`, ...values },
      update: values,
    });
    people[key] = user.id;
  }
  const merchant = await db.user.findUniqueOrThrow({
    where: { email: "peacock@business.com" },
  });
  const lime = await db.user.findUniqueOrThrow({ where: { email: "lime@business.com" } });
  const now = new Date(),
    after = (hours: number) => new Date(now.getTime() + hours * 3600000);
  function nextEvening(weekday?: number) {
    const day = new Date(now.getTime() + 8 * 3600000).toISOString().slice(0, 10);
    let start = new Date(`${day}T20:30:00+08:00`);
    while (
      start.getTime() <= now.getTime() + 2 * 3600000 ||
      (weekday !== undefined &&
        new Date(start.getTime() + 8 * 3600000).getUTCDay() !== weekday)
    )
      start = new Date(start.getTime() + 86400000);
    return start;
  }
  async function makeSlot(
    key: string,
    restaurantId: string,
    startsAt: Date,
    minimum = 2,
    capacity = 4,
  ) {
    // Reuse only an entirely empty daily slot. Never create two indistinguishable
    // 20:30 buttons or take a time that already belongs to a reservation.
    for (;;) {
      const exact = await db.reservationSlot.findUnique({
        where: { restaurantId_startsAt: { restaurantId, startsAt } },
      });
      const data = {
        id: `${prefix}${key}`,
        restaurantId,
        startsAt,
        minimumPartySize: minimum,
        capacity,
        discountedSeats: capacity * 2,
        discount: 40,
        eatTogetherEnabled: true,
      };
      if (!exact) return db.reservationSlot.create({ data });
      const adopted = await db.$transaction(async (tx) => {
        await lockSlot(tx, exact.id);
        if (
          (await tx.groupDiningSession.count({ where: { slotId: exact.id } })) ||
          (await tx.booking.count({ where: { slotId: exact.id } })) ||
          (await tx.slotAllocation.count({ where: { slotId: exact.id } }))
        )
          return null;
        return tx.reservationSlot.update({ where: { id: exact.id }, data });
      });
      if (adopted) return adopted;
      startsAt = new Date(startsAt.getTime() + 7 * 86400000);
    }
  }
  async function makeEvent(
    key: string,
    restaurantId: string,
    startsAt: Date,
    names: string[],
    title: string,
    options: {
      minimum?: number;
      capacity?: number;
      merchant?: string;
      cutoffHeadcount?: number;
    } = {},
  ) {
    const minimum = options.minimum ?? 2,
      capacity = options.capacity ?? 4;
    const slot = await makeSlot(key, restaurantId, startsAt, minimum, capacity);
    const headcount = options.cutoffHeadcount;
    const group = await db.groupDiningSession.create({
      data: {
        id: `${prefix}${key}`,
        slotId: slot.id,
        title,
        description: "A relaxed meal and conversation.",
        hostId: options.merchant ?? people[names[0]],
        restaurantHosted: !!options.merchant,
        capacity,
        initialHeldSeats: options.merchant ? capacity : minimum,
        ...(headcount !== undefined && {
          cutoffProcessed: true,
          cutoffHeadcount: headcount,
          status: names.length >= minimum ? "CONFIRMED" : "LAST_CALL",
          lastCallRound: names.length < minimum ? 1 : 0,
          confirmedAt: after(-2),
          chatOpenedAt: after(-2),
          releasedAtCutoff: Math.max(
            0,
            (options.merchant ? capacity : minimum) - headcount,
          ),
        }),
        members: { create: names.map((name) => ({ userId: people[name] })) },
      },
    });
    await db.$transaction(async (tx) => {
      await lockSlot(tx, slot.id);
      await syncEvent(tx, group.id);
    });
    return group;
  }
  const buffet = await makeEvent(
    "buffet",
    "lime",
    after(5),
    ["ava"],
    "Buffet with good company",
    { merchant: lime.id, capacity: 6 },
  );
  const create = await makeSlot("diner-create", "joya", nextEvening());
  const pending = await makeEvent(
    "pending",
    "joya",
    after(3),
    ["alex"],
    "Japanese dinner together",
  );
  const priceChoice = await makeEvent(
    "price-choice",
    "joya",
    after(1.2),
    ["alex", "cara"],
    "A shared Japanese table",
    { minimum: 4 },
  );
  const lastCall = await makeEvent(
    "last-call",
    "joya",
    after(1),
    ["ava"],
    "Lunch with a spare seat",
    { cutoffHeadcount: 2 },
  );
  await db.$transaction((tx) =>
    notify(
      tx,
      people.beth,
      lastCall.id,
      `${lastCall.id}:invite:1`,
      "Last Call nearby",
      "A replacement seat is available before dining time. Join to restore the discount.",
    ),
  );
  const lateLeave = await makeEvent(
    "late-leave",
    "joya",
    after(1.5),
    ["alex", "cara"],
    "A small afternoon table",
    { cutoffHeadcount: 2 },
  );
  const feedback = await makeEvent(
    "feedback",
    "joya",
    after(-24),
    ["alex", "ava"],
    "Yesterday’s dinner",
    { cutoffHeadcount: 2 },
  );
  const release = await makeSlot("restaurant-create", "peacock", nextEvening(4), 4, 6);
  const theme = await makeSlot("themed-create", "peacock", nextEvening(3), 4, 6);
  const held = await makeEvent(
    "held-seats",
    "peacock",
    after(3),
    ["ava", "beth"],
    "An evening sharing table",
    { minimum: 4, merchant: merchant.id },
  );
  const releasedHold = await makeEvent(
    "released-hold",
    "peacock",
    after(1.1),
    ["ava", "beth"],
    "A smaller sharing table",
    { minimum: 4, merchant: merchant.id },
  );
  const chat = await makeEvent(
    "restaurant-chat",
    "peacock",
    after(1.5),
    ["ava", "beth"],
    "Dinner with good company",
    { merchant: merchant.id, cutoffHeadcount: 2 },
  );
  const past = await makeEvent(
    "restaurant-history",
    "peacock",
    after(-7 * 24),
    ["ava", "beth"],
    "Last week’s shared dinner",
    { merchant: merchant.id, cutoffHeadcount: 2 },
  );
  for (const [key, overall, social, meal] of [
    ["ava", 4, 5, 4],
    ["beth", 5, 4, 5],
  ] as const) {
    await db.eventFeedback.create({
      data: {
        groupId: past.id,
        userId: people[key],
        overall,
        social,
        meal,
        safety: "YES",
        dineAgain: "YES",
        attended: true,
      },
    });
    await db.groupDiningMember.update({
      where: { groupId_userId: { groupId: past.id, userId: people[key] } },
      data: { attendance: "ATTENDED", attendanceRecordedAt: after(-7 * 24) },
    });
  }
  return {
    preparedAt: now.toISOString(),
    people,
    business: merchant.id,
    tasks: {
      D1: "alex@demo.com",
      D2: buffet.id,
      D3: create.id,
      D4: pending.id,
      priceChoice: priceChoice.id,
      D5: lastCall.id,
      D6: lateLeave.id,
      D7: feedback.id,
      RT1: "peacock@business.com",
      RT2: release.id,
      RT3: theme.id,
      RT4: held.id,
      RT4released: releasedHold.id,
      RT5chat: chat.id,
      RT5feedback: past.id,
    },
    dates: {
      RT2: release.startsAt.toISOString(),
      RT3: theme.startsAt.toISOString(),
      RT4: after(3).toISOString(),
      RT5feedback: after(-7 * 24).toISOString(),
    },
  };
}
