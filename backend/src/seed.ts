import { readFileSync } from "node:fs";
import type { Prisma } from "@prisma/client";
import { db } from "./db.js";
import { demoAccounts, demoPassword } from "./demo-accounts.js";
import { syncEvent } from "./event-lifecycle.js";

try {
  // Rename legacy fixtures in place so bookings, sessions and memberships keep their user IDs.
  await db.$transaction(async (tx) => {
    for (const account of demoAccounts) {
      const current = await tx.user.findUnique({ where: { email: account.email } });
      const legacy = account.legacyEmail
        ? await tx.user.findUnique({ where: { email: account.legacyEmail } })
        : null;
      if (current && legacy && current.id !== legacy.id) {
        throw new Error(
          `Two accounts exist for ${account.email}; resolve them before seeding.`,
        );
      }
      const data = {
        name: account.name,
        email: account.email,
        demoPassword,
        singpassVerified: true,
        dateOfBirth: new Date(`${account.dateOfBirth}T00:00:00Z`),
        gender: account.gender,
      };
      const existing = current ?? legacy;
      if (existing) await tx.user.update({ where: { id: existing.id }, data });
      else await tx.user.create({ data });
    }
  });
  const restaurants: Prisma.RestaurantCreateInput[] = JSON.parse(
    readFileSync(new URL("../data/restaurants.json", import.meta.url), "utf8"),
  );
  await db.restaurant.updateMany({
    where: {
      id: { in: ["komorebi", "basil", "tamarind", "garden", "ember", "seoul"] },
    },
    data: { active: false },
  });
  const todaySG = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const tomorrowSG = new Date(new Date(`${todaySG}T00:00:00Z`).getTime() + 86400000)
    .toISOString()
    .slice(0, 10);
  for (const restaurant of restaurants) {
    await db.restaurant.upsert({
      where: { id: restaurant.id },
      update: restaurant,
      create: restaurant,
    });
    // Business identities are separate preverified fixtures, never diner seats.
    await db.restaurant.update({
      where: { id: restaurant.id! },
      data: { corppassVerified: true },
    });
    await db.user.upsert({
      where: { email: `${restaurant.id}@business.com` },
      create: {
        email: `${restaurant.id}@business.com`,
        name: restaurant.name,
        demoPassword,
        accountType: "BUSINESS",
        managedRestaurantId: restaurant.id,
      },
      update: {
        name: restaurant.name,
        demoPassword,
        accountType: "BUSINESS",
        managedRestaurantId: restaurant.id,
      },
    });
    for (let day = 0; day < 7; day++) {
      const date = new Date(`${todaySG}T00:00:00+08:00`);
      date.setTime(date.getTime() + day * 86400000);
      const daySG = new Date(date.getTime() + 8 * 3600000).toISOString().slice(0, 10);
      for (const [time, discount] of [
        ["12:00", 30],
        ["17:30", 50],
        ["19:00", 20],
        ["20:30", 40],
      ] as const) {
        const startsAt = new Date(`${daySG}T${time}:00+08:00`);
        if (startsAt.getTime() <= Date.now()) continue;
        await db.reservationSlot.upsert({
          where: {
            restaurantId_startsAt: { restaurantId: restaurant.id, startsAt },
          },
          update: {},
          create: {
            id: `${restaurant.id}-${daySG}-${time.replace(":", "")}`,
            restaurantId: restaurant.id,
            startsAt,
            minimumPartySize: ["seorae", "yan-lai-ju"].includes(restaurant.id!) ? 4 : 2,
            capacity: ["seorae", "yan-lai-ju"].includes(restaurant.id!) ? 6 : 4,
            discountedSeats: ["seorae", "yan-lai-ju"].includes(restaurant.id!) ? 12 : 8,
            discount,
          },
        });
      }
    }
  }
  // Stable daily seed IDs avoid recreating groups that users cancel or confirm.
  const demos = [
    {
      restaurantId: "joya",
      title: "A quiet Japanese lunch after class",
      description:
        "Relaxed conversation over Japanese rice bowls. A low-key lunch for people who prefer a small group.",
      host: "chongwei",
      members: ["chongwei"],
    },
    {
      restaurantId: "seorae",
      title: "Korean BBQ and new friends",
      description:
        "Share sizzling grilled meat and banchan. A lively dinner for anyone who loves Korean barbecue.",
      host: "yojin",
      members: ["yojin", "wallace"],
    },
    {
      restaurantId: "peacock",
      title: "Curry, naan and a catch-up",
      description:
        "Share North Indian curries and naan over a friendly lunch in Clementi.",
      host: "wallace",
      members: ["wallace"],
    },
    {
      restaurantId: "lazy-lizard",
      title: "Casual comfort food after work",
      description:
        "Unwind with burgers, pizza and relaxed conversation. Easy-going neighbourhood dinner.",
      host: "chongwei",
      members: ["chongwei", "yojin"],
    },
    {
      restaurantId: "yan-lai-ju",
      title: "Chinese dishes for the sharing table",
      description:
        "Family-style Chinese food and good conversation. Come ready to share a few dishes.",
      host: "yojin",
      members: ["yojin"],
    },
    {
      restaurantId: "two-scoops",
      title: "Ice cream and a study break",
      description:
        "Dessert, waffles and ice cream with students taking a break from assignments.",
      host: "wallace",
      members: ["wallace", "chongwei"],
    },
    {
      restaurantId: "il-cielo",
      title: "Pasta and a little city escape",
      description:
        "Italian pasta, pizza and relaxed conversation in Orchard. Meet new people over lunch.",
      host: "chongwei",
      members: ["chongwei"],
    },
    {
      restaurantId: "lime",
      title: "A buffet with good company",
      description:
        "Explore an international buffet together in Chinatown. A social lunch with plenty of choice.",
      host: "yojin",
      members: ["yojin", "chongwei", "wallace", "jacob"],
    },
  ];
  for (const demo of demos) {
    const id = `demo-${tomorrowSG}-${demo.restaurantId}`;
    if (await db.groupDiningSession.findUnique({ where: { id } })) continue;
    const slot = await db.reservationSlot.findFirst({
      where: {
        restaurantId: demo.restaurantId,
        eatTogetherEnabled: true,
        restaurant: { eatTogetherEnabled: true },
        startsAt: { gte: new Date(`${tomorrowSG}T00:00:00+08:00`) },
        allocations: { none: {} },
      },
      orderBy: { startsAt: "asc" },
    });
    if (!slot) continue;
    const accounts = await db.user.findMany({
      where: {
        email: { in: demo.members.map((name) => `${name}@gmail.com`) },
      },
    });
    const host = accounts.find((user) => user.email === `${demo.host}@gmail.com`)!;
    await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "ReservationSlot" WHERE id = ${slot.id} FOR UPDATE`;
      await tx.groupDiningSession.create({
        data: {
          id,
          slotId: slot.id,
          title: demo.title,
          hostId: host.id,
          description: demo.description,
          capacity: slot.capacity,
          initialHeldSeats: slot.minimumPartySize,
          status: "OPEN",
          members: { create: accounts.map((user) => ({ userId: user.id })) },
        },
      });
      await tx.slotAllocation.create({
        data: {
          slotId: slot.id,
          groupId: id,
          seats: Math.max(slot.minimumPartySize, accounts.length),
        },
      });
      await syncEvent(tx, id);
    });
  }
  // Adopt the new lifecycle for future Events only. Past reservation history is unchanged.
  const upcoming = await db.groupDiningSession.findMany({
    where: {
      status: { in: ["OPEN", "FULL", "CONFIRMED"] },
      slot: { startsAt: { gt: new Date() } },
    },
    select: { id: true, slotId: true },
  });
  for (const event of upcoming)
    await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "ReservationSlot" WHERE id = ${event.slotId} FOR UPDATE`;
      await syncEvent(tx, event.id);
    });
  console.log(
    "Demo accounts, restaurants, seven-day slots and social tables ready. Existing records preserved.",
  );
} finally {
  await db.$disconnect();
}
