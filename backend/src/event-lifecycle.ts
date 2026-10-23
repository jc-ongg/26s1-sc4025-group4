import { Prisma } from "@prisma/client";
import { HttpError } from "./http-error.js";
import { db } from "./db.js";
import { holdSeats, lockSlot } from "./inventory.js";
import { matchesEvent } from "./event-eligibility.js";
import { centres, distance } from "./geography.js";

export const cutoffAt = (startsAt: Date) => new Date(startsAt.getTime() - 2 * 3600000);
export const dinerCount = (parties: { partySize: number }[]) =>
  parties.reduce((total, p) => total + p.partySize, 0);
export const eventMinimum = (event: {
  minimumPartySize?: number | null;
  slot: { minimumPartySize: number };
}) => event.minimumPartySize ?? event.slot.minimumPartySize;
export const eventDiscount = (event: {
  discount?: number | null;
  slot: { discount: number };
}) => event.discount ?? event.slot.discount;
export const joinableStatuses = ["OPEN", "FULL", "CONFIRMED", "LAST_CALL"] as const;
// Cutoff fixes the maximum headcount. Later Joins replace departures rather
// than taking newly released inventory back from the restaurant.
export function eventJoinLimit(event: {
  capacity: number;
  cutoffHeadcount?: number | null;
}) {
  return Math.min(event.capacity, event.cutoffHeadcount ?? event.capacity);
}
export async function notify(
  tx: Prisma.TransactionClient,
  userId: string,
  groupId: string,
  key: string,
  title: string,
  body: string,
) {
  await tx.notification.upsert({
    where: { userId_key: { userId, key } },
    create: { userId, groupId, key, title, body },
    update: {},
  });
}

// Every transition runs under the slot-row lock, including the periodic worker.
// Replaying the same clock instant cannot duplicate notifications or bookings.
export async function syncEvent(
  tx: Prisma.TransactionClient,
  id: string,
  now = new Date(),
) {
  let event = await tx.groupDiningSession.findUniqueOrThrow({
    where: { id },
    include: {
      members: true,
      slot: { include: { restaurant: true } },
      booking: true,
      allocation: true,
    },
  });
  if (["CANCELLED", "EXPIRED"].includes(event.status)) return;
  const count = dinerCount(event.members),
    cutoff = cutoffAt(event.slot.startsAt);
  const send = async (key: string, title: string, body: string) => {
    for (const member of event.members)
      await notify(tx, member.userId, id, `${id}:${key}`, title, body);
  };
  if (!count) {
    if (event.restaurantHosted && now < cutoff) {
      await tx.groupDiningSession.update({ where: { id }, data: { status: "OPEN" } });
      await holdSeats(tx, event.slot, id, event.capacity);
      return;
    }
    await tx.groupDiningSession.update({
      where: { id },
      data: {
        status: "CANCELLED",
        ...(now >= cutoff &&
          !event.cutoffProcessed && {
            cutoffProcessed: true,
            cutoffHeadcount: 0,
            releasedAtCutoff: event.allocation?.seats ?? 0,
          }),
      },
    });
    await tx.booking.updateMany({
      where: { groupId: id },
      data: { status: "CANCELLED" },
    });
    await holdSeats(tx, event.slot, id, 0);
    return;
  }
  const due = now >= cutoff,
    started = now >= event.slot.startsAt,
    minimum = eventMinimum(event);
  if (due && !event.cutoffProcessed) {
    const released = Math.max(0, (event.allocation?.seats ?? minimum) - count);
    const status = count >= minimum ? "CONFIRMED" : "PRICE_DECISION";
    await tx.groupDiningSession.update({
      where: { id },
      data: {
        cutoffProcessed: true,
        cutoffHeadcount: count,
        releasedAtCutoff: released,
        status,
      },
    });
    if (!started && status === "PRICE_DECISION")
      await send(
        "cutoff",
        "Choose your booking",
        "The Event did not reach its minimum. Accept full price or decline without a penalty before dining time.",
      );
    event = { ...event, cutoffProcessed: true, cutoffHeadcount: count, status };
  }
  if (event.status === "PRICE_DECISION") {
    if (!started && event.members.some((p) => !p.priceAccepted)) {
      await holdSeats(tx, event.slot, id, count);
      if (event.booking)
        await tx.booking.update({
          where: { id: event.booking.id },
          data: { status: "PENDING", discount: 0 },
        });
      return;
    }
    const accepted = event.members.filter((p) => p.priceAccepted);
    if (!accepted.length) {
      await tx.groupDiningSession.update({ where: { id }, data: { status: "EXPIRED" } });
      await tx.booking.updateMany({
        where: { groupId: id },
        data: { status: "CANCELLED" },
      });
      await holdSeats(tx, event.slot, id, 0);
      return;
    }
    if (started)
      await tx.groupDiningMember.deleteMany({
        where: { groupId: id, priceAccepted: false },
      });
    const hostId =
      event.restaurantHosted || accepted.some((p) => p.userId === event.hostId)
        ? event.hostId
        : accepted.sort(
            (a, b) =>
              a.joinedAt.getTime() - b.joinedAt.getTime() ||
              a.userId.localeCompare(b.userId),
          )[0].userId;
    await tx.groupDiningSession.update({
      where: { id },
      data: { status: "FULL_PRICE", hostId, chatOpenedAt: event.chatOpenedAt ?? now },
    });
    const seats = dinerCount(accepted);
    await holdSeats(tx, event.slot, id, seats);
    await tx.booking.upsert({
      where: { groupId: id },
      create: {
        slotId: event.slotId,
        groupId: id,
        userId: hostId,
        partySize: seats,
        discount: 0,
      },
      update: { status: "CONFIRMED", partySize: seats, userId: hostId, discount: 0 },
    });
    if (!started)
      await send(
        "full-price",
        "Booking confirmed at full price",
        "Your accepted reservation has no Eatigo discount.",
      );
    return;
  }
  if (event.status === "FULL_PRICE") {
    await holdSeats(tx, event.slot, id, count);
    await tx.booking.updateMany({
      where: { groupId: id },
      data: { partySize: count, userId: event.hostId, discount: 0 },
    });
    return;
  }
  if (started && event.status === "LAST_CALL" && count < minimum) {
    await tx.groupDiningSession.update({ where: { id }, data: { status: "FULL_PRICE" } });
    await tx.booking.upsert({
      where: { groupId: id },
      create: {
        slotId: event.slotId,
        groupId: id,
        userId: event.hostId,
        partySize: count,
        discount: 0,
      },
      update: {
        status: "CONFIRMED",
        partySize: count,
        userId: event.hostId,
        discount: 0,
      },
    });
    await holdSeats(tx, event.slot, id, count);
    await send(
      `unfilled:${event.lastCallRound}`,
      "Last Call ended",
      "The Event was not refilled. Full price applies to the remaining reservation.",
    );
    return;
  }
  const confirmed = count >= minimum;
  const status = confirmed ? "CONFIRMED" : due ? "LAST_CALL" : "OPEN";
  const opening = status === "LAST_CALL" && event.status !== "LAST_CALL";
  const round = event.lastCallRound + Number(opening);
  await tx.groupDiningSession.update({
    where: { id },
    data: {
      status,
      lastCallRound: round,
      ...(confirmed && !event.confirmedAt && { confirmedAt: now }),
      ...(confirmed && !event.chatOpenedAt && { chatOpenedAt: now }),
    },
  });
  await holdSeats(
    tx,
    event.slot,
    id,
    due ? count : event.restaurantHosted ? event.capacity : Math.max(minimum, count),
  );
  if (confirmed) {
    await tx.booking.upsert({
      where: { groupId: id },
      create: {
        slotId: event.slotId,
        groupId: id,
        userId: event.hostId,
        partySize: count,
        discount: eventDiscount(event),
      },
      update: {
        status: "CONFIRMED",
        userId: event.hostId,
        partySize: count,
        discount: eventDiscount(event),
      },
    });
    if (event.status !== "CONFIRMED" && !started)
      await send(
        `confirmed:${event.members
          .map((p) => p.userId)
          .sort()
          .join(",")}`,
        "Event confirmed",
        "The minimum is met and your discount is secured.",
      );
  } else if (event.booking)
    await tx.booking.update({
      where: { id: event.booking.id },
      data: { status: "PENDING", userId: event.hostId, partySize: count },
    });
  if (opening && !started) {
    await send(
      `last-call:${round}`,
      "Last Call open",
      "A diner has left. If the Event is not refilled by dining time, full price applies. You may Leave without a penalty.",
    );
    const users = await tx.user.findMany({
      where: {
        singpassVerified: true,
        diningArea: { not: "" },
        OR: [{ suspendedUntil: null }, { suspendedUntil: { lte: now } }],
      },
    });
    const restaurant = event.slot.restaurant,
      blocks = await tx.dinerBlock.findMany();
    for (const user of users) {
      const centre = centres[user.diningArea.toLowerCase()];
      const blockedUserIds = blocks.flatMap((b) =>
        b.blockerId === user.id
          ? [b.blockedId]
          : b.blockedId === user.id
            ? [b.blockerId]
            : [],
      );
      if (
        event.members.some((p) => p.userId === user.id) ||
        !centre ||
        restaurant.latitude === null ||
        restaurant.longitude === null ||
        distance(restaurant.latitude, restaurant.longitude, centre) > 5 ||
        !matchesEvent({ ...user, blockedUserIds }, event, now)
      )
        continue;
      await notify(
        tx,
        user.id,
        id,
        `${id}:invite:${round}`,
        "Last Call nearby",
        `${restaurant.name} has an EatTogether seat available before ${event.slot.startsAt.toLocaleTimeString("en-SG", { timeZone: "Asia/Singapore", hour: "numeric", minute: "2-digit" })}.`,
      );
    }
  }
  if (!due && status === "OPEN") {
    const day = new Date(now.getTime() + 8 * 3600000).toISOString().slice(0, 10);
    await send(
      `reminder:${day}`,
      "Your Event needs diners",
      `${Math.max(0, minimum - count)} more ${minimum - count === 1 ? "diner is" : "diners are"} needed before Cutoff.`,
    );
  }
}

let ticking: Promise<void> | undefined;
async function inviteEventFeedback(now: Date) {
  const events = await db.groupDiningSession.findMany({
    where: {
      status: { in: ["CONFIRMED", "FULL_PRICE"] },
      booking: { status: "CONFIRMED" },
      slot: { startsAt: { lte: new Date(now.getTime() - 2 * 3600000) } },
      notifications: { none: { key: { endsWith: ":feedback-invitation" } } },
    },
    select: { id: true, slotId: true },
  });
  for (const event of events) {
    await db.$transaction(async (tx) => {
      await lockSlot(tx, event.slotId);
      const current = await tx.groupDiningSession.findUnique({
        where: { id: event.id },
        include: { members: true, booking: true, slot: true },
      });
      if (
        !current ||
        !["CONFIRMED", "FULL_PRICE"].includes(current.status) ||
        current.booking?.status !== "CONFIRMED" ||
        current.slot.startsAt.getTime() > now.getTime() - 2 * 3600000
      )
        return;
      // This is an invitation after dining time, not proof of attendance or a
      // completed meal. The feedback form still requires the diner's attestation.
      for (const member of current.members.filter((m) => m.attendance !== "NO_SHOW"))
        await notify(
          tx,
          member.userId,
          event.id,
          `${event.id}:feedback-invitation`,
          "How was your EatTogether Event?",
          "If you attended, share your optional private Event Feedback. Skipping it does not affect your Reliability Score.",
        );
    });
  }
}
export function processLifecycle() {
  if (ticking) return ticking;
  ticking = (async () => {
    const events = await db.groupDiningSession.findMany({
      where: {
        OR: [
          { status: { in: ["OPEN", "FULL", "LAST_CALL", "PRICE_DECISION"] } },
          {
            status: "CONFIRMED",
            cutoffProcessed: false,
            slot: { startsAt: { lte: new Date(Date.now() + 2 * 3600000) } },
          },
        ],
      },
      select: { id: true, slotId: true },
    });
    for (const event of events) {
      try {
        await db.$transaction(async (tx) => {
          await lockSlot(tx, event.slotId);
          await syncEvent(tx, event.id);
        });
      } catch (error) {
        // A maintenance/fixture cleanup can remove a row after the worker's
        // snapshot. Skip that vanished row; all other failures must surface.
        if (
          (error instanceof HttpError && error.status === 404) ||
          (error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === "P2025")
        )
          continue;
        throw error;
      }
    }
    await inviteEventFeedback(new Date());
  })().finally(() => {
    ticking = undefined;
  });
  return ticking;
}
