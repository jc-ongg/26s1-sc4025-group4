import { Router } from "express";
import { db } from "./db.js";
import { check } from "./http-error.js";
import { groupInclude, presentGroup } from "./dining.js";
import { availableSeats, holdSeats, lockSlot, poolSize } from "./inventory.js";
import {
  cutoffAt,
  eventMinimum,
  eventDiscount,
  notify,
  processLifecycle,
  syncEvent,
} from "./event-lifecycle.js";
import { parseEventFilters } from "./event-eligibility.js";
import { recordNoShow, correctNoShow } from "./reliability.js";

export const business = Router();
business.use(async (req, res, next) => {
  const token = req.cookies.eatigo_session;
  const session =
    typeof token === "string"
      ? await db.session.findUnique({
          where: { token },
          include: { user: { include: { managedRestaurant: true } } },
        })
      : null;
  check(
    session && session.expiresAt > new Date(),
    401,
    "Please log in to your restaurant account.",
  );
  const account = session.user;
  check(
    account.accountType === "BUSINESS" && account.managedRestaurant,
    403,
    "A restaurant account is required.",
  );
  res.locals.businessId = account.id;
  res.locals.restaurantId = account.managedRestaurant.id;
  res.set("Cache-Control", "no-store");
  await processLifecycle();
  next();
});
function number(value: unknown, minimum: number, maximum: number) {
  check(
    typeof value === "number" &&
      Number.isInteger(value) &&
      value >= minimum &&
      value <= maximum,
    400,
    `Enter a whole number from ${minimum} to ${maximum}.`,
  );
  return value;
}
function text(value: unknown, maximum: number, required = true) {
  check(
    typeof value === "string" &&
      value.trim().length <= maximum &&
      (!required || !!value.trim()),
    400,
    `Enter ${required ? "1" : "0"}–${maximum} characters.`,
  );
  return value.trim();
}
async function ownedEvent(id: string, restaurantId: string) {
  const reference = await db.groupDiningSession.findFirst({
    where: { id, slot: { restaurantId } },
    select: { slotId: true },
  });
  check(reference, 404, "Event not found.");
  // Reconcile the selected Event even when a background pass was already in
  // flight. The merchant must see the same Cutoff state as the diner.
  return db.$transaction(async (tx) => {
    await lockSlot(tx, reference.slotId);
    await syncEvent(tx, id);
    return tx.groupDiningSession.findUniqueOrThrow({
      where: { id },
      include: groupInclude,
    });
  });
}
function businessEvent(group: Awaited<ReturnType<typeof ownedEvent>>) {
  const visible = presentGroup(group);
  return {
    ...visible,
    members: visible.members.map((member) => {
      const source = group.members.find((m) => m.userId === member.userId)!;
      return {
        ...member,
        attendance: source.attendance,
        attendanceRecordedAt: source.attendanceRecordedAt,
      };
    }),
  };
}

business.get("/dashboard", async (req, res) => {
  const date = req.query.date;
  check(
    typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date),
    400,
    "Choose a dining date.",
  );
  const from = new Date(`${date}T00:00:00+08:00`),
    to = new Date(from.getTime() + 86400000);
  check(
    Number.isFinite(from.getTime()) &&
      new Date(from.getTime() + 8 * 3600000).toISOString().slice(0, 10) === date,
    400,
    "Choose a valid date.",
  );
  const restaurantId = res.locals.restaurantId as string;
  const restaurant = await db.restaurant.findUniqueOrThrow({
    where: { id: restaurantId },
  });
  const slots = await db.reservationSlot.findMany({
    where: { restaurantId, startsAt: { gte: from, lt: to } },
    include: { allocations: true },
    orderBy: { startsAt: "asc" },
  });
  const groups = await db.groupDiningSession.findMany({
    where: { slot: { restaurantId, startsAt: { gte: from, lt: to } } },
    include: groupInclude,
    orderBy: { slot: { startsAt: "asc" } },
  });
  const bookings = await db.booking.findMany({
    where: { slot: { restaurantId, startsAt: { gte: from, lt: to } } },
    include: {
      user: { select: { name: true } },
      slot: true,
      group: { select: { id: true, title: true } },
    },
    orderBy: { slot: { startsAt: "asc" } },
  });
  res.json({
    restaurant,
    slots: slots.map(({ allocations, ...slot }) => ({
      ...slot,
      heldSeats: allocations.reduce((n, a) => n + a.seats, 0),
      availableSeats: Math.max(
        0,
        poolSize(slot) - allocations.reduce((n, a) => n + a.seats, 0),
      ),
    })),
    groups: groups.map(businessEvent),
    bookings: bookings.map(({ deletedFor: _deletedFor, ...booking }) => booking),
  });
});

business.post("/settings", async (req, res) => {
  check(
    typeof req.body?.eatTogetherEnabled === "boolean",
    400,
    "Choose EatTogether availability.",
  );
  await db.restaurant.update({
    where: { id: res.locals.restaurantId },
    data: { eatTogetherEnabled: req.body.eatTogetherEnabled },
  });
  res.json({ saved: true });
});
business.post("/slots/:id", async (req, res) => {
  const result = await db.$transaction(async (tx) => {
    const slot = await lockSlot(tx, String(req.params.id));
    check(slot.restaurantId === res.locals.restaurantId, 404, "Dining slot not found.");
    check(slot.startsAt > new Date(), 409, "Past dining slots cannot be edited.");
    const minimumPartySize = number(req.body?.minimumPartySize, 1, 20),
      capacity = number(req.body?.capacity, minimumPartySize, 20),
      discountedSeats = number(req.body?.discountedSeats, capacity, 200),
      discount = number(req.body?.discount, 10, 50);
    check(
      typeof req.body?.eatTogetherEnabled === "boolean",
      400,
      "Choose EatTogether availability.",
    );
    const changed =
      minimumPartySize !== slot.minimumPartySize ||
      capacity !== slot.capacity ||
      discountedSeats !== poolSize(slot) ||
      discount !== slot.discount;
    check(
      !changed || !(await tx.slotAllocation.count({ where: { slotId: slot.id } })),
      409,
      "This slot has reservations. Its prices and seat limits are protected.",
    );
    return tx.reservationSlot.update({
      where: { id: slot.id },
      data: {
        minimumPartySize,
        capacity,
        discountedSeats,
        discount,
        eatTogetherEnabled: req.body.eatTogetherEnabled,
      },
    });
  });
  res.json({ slot: result });
});
business.post("/events", async (req, res) => {
  const title = text(req.body?.title, 80),
    description = text(req.body?.description ?? "", 500, false),
    theme = text(req.body?.theme ?? "", 80, false),
    slotId = text(req.body?.slotId, 100);
  const filters = parseEventFilters(req.body ?? {});
  check(filters, 400, "Choose valid Event Filters starting at age 18.");
  check(
    theme || !(filters.genderFilter || filters.minAge || filters.maxAge),
    400,
    "Event Filters are available only for a stated Themed Event.",
  );
  const group = await db.$transaction(async (tx) => {
    const slot = await lockSlot(tx, slotId);
    check(slot.restaurantId === res.locals.restaurantId, 404, "Dining slot not found.");
    const restaurant = await tx.restaurant.findUniqueOrThrow({
      where: { id: slot.restaurantId },
    });
    check(
      restaurant.active &&
        restaurant.corppassVerified &&
        restaurant.eatTogetherEnabled &&
        slot.eatTogetherEnabled,
      409,
      "EatTogether must be enabled for this verified restaurant and slot.",
    );
    check(
      new Date() < cutoffAt(slot.startsAt),
      409,
      "Create Restaurant Events before the two-hour Cutoff.",
    );
    const minimumPartySize = number(
        req.body?.minimumPartySize ?? slot.minimumPartySize,
        2,
        slot.capacity,
      ),
      capacity = number(
        req.body?.capacity ?? slot.capacity,
        minimumPartySize,
        slot.capacity,
      ),
      discount = number(req.body?.discount ?? slot.discount, 10, 50);
    check(
      (await availableSeats(tx, slot)) >= capacity,
      409,
      "There are not enough free seats to hold this entire table.",
    );
    const event = await tx.groupDiningSession.create({
      data: {
        slotId,
        title,
        description,
        theme,
        ...filters,
        restaurantHosted: true,
        hostId: res.locals.businessId,
        minimumPartySize,
        capacity,
        discount,
        initialHeldSeats: capacity,
      },
    });
    await holdSeats(tx, slot, event.id, capacity);
    await syncEvent(tx, event.id);
    return tx.groupDiningSession.findUniqueOrThrow({
      where: { id: event.id },
      include: groupInclude,
    });
  });
  res.status(201).json({ group: businessEvent(group) });
});
business.get("/events/:id", async (req, res) => {
  const group = await ownedEvent(String(req.params.id), res.locals.restaurantId);
  const feedbackScope = {
    groupId: group.id,
    userId: {
      notIn: group.members.filter((m) => m.attendance === "NO_SHOW").map((m) => m.userId),
    },
  };
  const average = group.restaurantHosted
    ? await db.eventFeedback.aggregate({
        where: feedbackScope,
        _avg: { overall: true, social: true, meal: true },
        _count: { overall: true },
      })
    : null;
  const safe = group.restaurantHosted
    ? await db.eventFeedback.count({ where: { ...feedbackScope, safety: "YES" } })
    : 0;
  const again = group.restaurantHosted
    ? await db.eventFeedback.count({ where: { ...feedbackScope, dineAgain: "YES" } })
    : 0;
  res.json({
    group: businessEvent(group),
    feedback: average && {
      count: average._count.overall,
      ...average._avg,
      safe,
      dineAgain: again,
    },
  });
});
business.post("/events/:id/withdraw", async (req, res) => {
  const reference = await ownedEvent(String(req.params.id), res.locals.restaurantId);
  await db.$transaction(async (tx) => {
    const slot = await lockSlot(tx, reference.slotId);
    const group = await tx.groupDiningSession.findUniqueOrThrow({
      where: { id: reference.id },
      include: { members: true },
    });
    check(
      group.restaurantHosted && group.members.length === 0 && slot.startsAt > new Date(),
      409,
      "Only an empty Restaurant Event can be withdrawn. Existing diners keep their reservations.",
    );
    await tx.groupDiningSession.update({
      where: { id: group.id },
      data: { status: "CANCELLED" },
    });
    await holdSeats(tx, slot, group.id, 0);
  });
  res.json({ saved: true });
});
business.post("/events/:id/attendance", async (req, res) => {
  const reference = await ownedEvent(String(req.params.id), res.locals.restaurantId);
  const userId = text(req.body?.userId, 100),
    status = req.body?.status;
  check(["ATTENDED", "NO_SHOW"].includes(status), 400, "Choose attended or no-show.");
  await db.$transaction(async (tx) => {
    const slot = await lockSlot(tx, reference.slotId);
    const group = await tx.groupDiningSession.findUniqueOrThrow({
      where: { id: reference.id },
      include: { members: true, booking: true, slot: true },
    });
    check(
      slot.startsAt <= new Date() &&
        group.booking?.status === "CONFIRMED" &&
        ["CONFIRMED", "FULL_PRICE"].includes(group.status),
      409,
      "Attendance opens at the booked dining time.",
    );
    const member = group.members.find((m) => m.userId === userId);
    check(member, 404, "Diner not found in this Event.");
    if (member.attendance === status) return;
    await tx.groupDiningMember.update({
      where: { groupId_userId: { groupId: group.id, userId } },
      data: { attendance: status, attendanceRecordedAt: new Date() },
    });
    if (status === "NO_SHOW") await recordNoShow(tx, userId, group.id, new Date());
    else if (member.attendance === "NO_SHOW")
      await correctNoShow(tx, userId, group.id, new Date());
    const remaining = group.members.reduce(
      (n, m) =>
        n +
        ((m.userId === userId ? status : m.attendance) === "NO_SHOW" ? 0 : m.partySize),
      0,
    );
    const fullPrice = remaining < eventMinimum(group);
    // Attendance corrections restore only this Event's agreed offer, never a
    // Cutoff full-price acceptance. A booking's original price choice is retained.
    const canRestore = group.members.every((m) => !m.priceAccepted);
    if (fullPrice || canRestore) {
      await tx.groupDiningSession.update({
        where: { id: group.id },
        data: { status: fullPrice ? "FULL_PRICE" : "CONFIRMED" },
      });
      await tx.booking.update({
        where: { groupId: group.id },
        data: { discount: fullPrice ? 0 : eventDiscount(group) },
      });
      if (group.status !== (fullPrice ? "FULL_PRICE" : "CONFIRMED"))
        for (const diner of group.members)
          await notify(
            tx,
            diner.userId,
            group.id,
            `${group.id}:attendance-price:${fullPrice ? "full" : "discount"}`,
            "Reservation price updated",
            fullPrice
              ? "The minimum was not met at arrival. Full price applies to this reservation."
              : "Attendance was corrected. Your Event’s agreed discount is restored.",
          );
    }
    await notify(
      tx,
      userId,
      group.id,
      `${group.id}:attendance:${status}`,
      "Attendance updated",
      status === "ATTENDED"
        ? "The restaurant recorded your attendance."
        : "The restaurant recorded a no-show. A private reliability strike applies.",
    );
  });
  res.json({ saved: true });
});
business.get("/events/:id/messages", async (req, res) => {
  const group = await ownedEvent(String(req.params.id), res.locals.restaurantId);
  check(
    group.restaurantHosted && group.chatOpenedAt,
    409,
    "Restaurant Host Chat opens once the Event is Confirmed.",
  );
  const messages = await db.eventMessage.findMany({
    where: { groupId: group.id },
    include: { user: { select: { name: true } } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 200,
  });
  res.json({ messages: messages.reverse() });
});
business.post("/events/:id/messages", async (req, res) => {
  const reference = await ownedEvent(String(req.params.id), res.locals.restaurantId),
    body = text(req.body?.body, 1000);
  await db.$transaction(async (tx) => {
    await lockSlot(tx, reference.slotId);
    const group = await tx.groupDiningSession.findUniqueOrThrow({
      where: { id: reference.id },
    });
    check(
      group.restaurantHosted &&
        group.chatOpenedAt &&
        !["CANCELLED", "EXPIRED"].includes(group.status),
      409,
      "This Event is not accepting restaurant messages.",
    );
    await tx.eventMessage.create({
      data: { groupId: group.id, userId: group.hostId, body },
    });
  });
  res.status(201).json({ sent: true });
});
