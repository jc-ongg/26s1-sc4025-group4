import { Router } from "express";
import { Prisma } from "@prisma/client";
import { db } from "./db.js";
import { dinerCount, syncEvent } from "./event-lifecycle.js";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
function check(condition: unknown, status: number, message: string): asserts condition {
  if (!condition) throw new HttpError(status, message);
}
const userFields = { id: true, name: true } as const;
export const groupInclude = {
  host: { select: userFields },
  slot: { include: { restaurant: true } },
  members: {
    include: { user: { select: userFields } },
    orderBy: [{ joinedAt: "asc" as const }, { userId: "asc" as const }],
  },
  booking: true,
} satisfies Prisma.GroupDiningSessionInclude;
type Transaction = Prisma.TransactionClient;

function text(value: unknown, max: number, required = true): string {
  check(typeof value === "string", 400, "Please provide valid text.");
  const result = value.trim();
  check(
    (!required || result.length > 0) && result.length <= max,
    400,
    `Text must be ${required ? "1" : "0"}–${max} characters.`,
  );
  return result;
}
function size(value: unknown) {
  check(
    typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 20,
    400,
    "Choose a valid party size.",
  );
  return value;
}

// Every inventory mutation takes the same slot-row lock first. This serializes
// competing joins, confirmation, cancellation, and ordinary booking requests.
async function lockSlot(tx: Transaction, id: string) {
  const rows = await tx.$queryRaw<
    { id: string }[]
  >`SELECT id FROM "ReservationSlot" WHERE id = ${id} FOR UPDATE`;
  check(rows.length, 404, "Dining slot not found.");
  return tx.reservationSlot.findUniqueOrThrow({ where: { id } });
}
async function expireSlot(tx: Transaction, slotId: string) {
  const expired = await tx.groupDiningSession.findMany({
    where: {
      slotId,
      status: { in: ["OPEN", "FULL"] },
      slot: { startsAt: { lte: new Date() } },
    },
  });
  for (const group of expired) {
    await tx.booking.updateMany({
      where: { groupId: group.id },
      data: { status: "CANCELLED" },
    });
    await tx.slotAllocation.deleteMany({ where: { groupId: group.id } });
    await tx.groupDiningSession.update({
      where: { id: group.id },
      data: { status: "EXPIRED" },
    });
  }
}
async function expireGroups() {
  const groups = await db.groupDiningSession.findMany({
    where: {
      status: { in: ["OPEN", "FULL"] },
      slot: { startsAt: { lte: new Date() } },
    },
    select: { slotId: true },
  });
  for (const group of groups)
    await db.$transaction(async (tx) => {
      await lockSlot(tx, group.slotId);
      await expireSlot(tx, group.slotId);
    });
}
export const dining = Router();
dining.use(async (req, res, next) => {
  const token: unknown = req.cookies.eatigo_session;
  const session =
    typeof token === "string" ? await db.session.findUnique({ where: { token } }) : null;
  check(
    session && session.expiresAt > new Date(),
    401,
    "Your session has expired. Please log in again.",
  );
  res.locals.userId = session.userId;
  res.set("Cache-Control", "no-store");
  await expireGroups();
  next();
});

dining.get("/restaurants", async (_req, res) => {
  const restaurants = await db.restaurant.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    include: {
      slots: {
        where: { startsAt: { gt: new Date() } },
        orderBy: { startsAt: "asc" },
        include: { allocation: true },
      },
    },
  });
  res.json({ restaurants });
});
dining.get("/restaurants/:id", async (req, res) => {
  const restaurant = await db.restaurant.findUnique({
    where: { id: String(req.params.id) },
    include: {
      slots: {
        where: { startsAt: { gt: new Date() } },
        orderBy: { startsAt: "asc" },
        include: { allocation: true },
      },
    },
  });
  check(restaurant, 404, "Restaurant not found.");
  const groups = await db.groupDiningSession.findMany({
    where: {
      slot: { restaurantId: restaurant.id, startsAt: { gt: new Date() } },
      status: { in: ["OPEN", "FULL", "CONFIRMED"] },
    },
    include: groupInclude,
    orderBy: { slot: { startsAt: "asc" } },
  });
  res.json({ restaurant, groups });
});
dining.get("/groups", async (_req, res) => {
  res.json({
    groups: await db.groupDiningSession.findMany({
      where: {
        status: { in: ["OPEN", "FULL", "CONFIRMED"] },
        slot: { startsAt: { gt: new Date() }, restaurant: { active: true } },
      },
      include: groupInclude,
      orderBy: { slot: { startsAt: "asc" } },
    }),
  });
});
dining.get("/groups/:id", async (req, res) => {
  const group = await db.groupDiningSession.findUnique({
    where: { id: String(req.params.id) },
    include: groupInclude,
  });
  check(group, 404, "Group not found.");
  res.json({ group });
});
dining.get("/me/groups", async (_req, res) => {
  res.json({
    groups: await db.groupDiningSession.findMany({
      where: {
        NOT: { booking: { deletedFor: { has: res.locals.userId } } },
        OR: [
          { hostId: res.locals.userId },
          { members: { some: { userId: res.locals.userId } } },
        ],
      },
      include: groupInclude,
      orderBy: { createdAt: "desc" },
    }),
  });
});
dining.get("/me/bookings", async (_req, res) => {
  res.json({
    bookings: await db.booking.findMany({
      where: {
        status: { in: ["CONFIRMED", "CANCELLED"] },
        NOT: { deletedFor: { has: res.locals.userId } },
        OR: [
          { userId: res.locals.userId },
          { group: { members: { some: { userId: res.locals.userId } } } },
        ],
      },
      include: {
        slot: { include: { restaurant: true } },
        group: { select: { id: true, title: true, hostId: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  });
});
dining.post("/groups", async (req, res) => {
  const slotId = text(req.body?.slotId, 100),
    title = text(req.body?.title, 80);
  const description = text(req.body?.description ?? "", 500, false),
    partySize = size(req.body?.partySize === undefined ? 1 : req.body.partySize);
  const group = await db.$transaction(async (tx) => {
    const slot = await lockSlot(tx, slotId);
    check(
      (
        await tx.restaurant.findUniqueOrThrow({
          where: { id: slot.restaurantId },
        })
      ).active,
      409,
      "This restaurant is no longer available for new reservations.",
    );
    check(slot.startsAt > new Date(), 409, "This dining slot has already started.");
    const capacity = size(
      req.body?.capacity === undefined ? slot.capacity : req.body.capacity,
    );
    check(
      partySize < slot.minimumPartySize,
      400,
      "A Party that meets the minimum can book directly.",
    );
    check(
      capacity >= slot.minimumPartySize && capacity <= slot.capacity,
      400,
      "Group size must fit the restaurant’s party limits.",
    );
    check(
      !(await tx.slotAllocation.findUnique({ where: { slotId } })),
      409,
      "Someone has already reserved this slot. Choose another time.",
    );
    const group = await tx.groupDiningSession.create({
      data: {
        slotId,
        title,
        description,
        capacity,
        hostId: res.locals.userId,
        status: "OPEN",
        members: { create: { userId: res.locals.userId, partySize } },
      },
      include: groupInclude,
    });
    await tx.slotAllocation.create({ data: { slotId, groupId: group.id } });
    return group;
  });
  res.status(201).json({ group });
});
dining.post("/groups/:id/:action", async (req, res) => {
  const id = String(req.params.id),
    action = String(req.params.action),
    userId: string = res.locals.userId;
  check(
    ["join", "leave", "resize", "confirm", "cancel"].includes(action),
    404,
    "Action not found.",
  );
  const reference = await db.groupDiningSession.findUnique({
    where: { id },
    select: { slotId: true },
  });
  check(reference, 404, "Event not found.");
  const result = await db.$transaction(async (tx) => {
    const slot = await lockSlot(tx, reference.slotId);
    const event = await tx.groupDiningSession.findUniqueOrThrow({
      where: { id },
      include: { members: { orderBy: [{ joinedAt: "asc" }, { userId: "asc" }] } },
    });
    const party = event.members.find((m) => m.userId === userId);
    if (action === "cancel") {
      check(event.hostId === userId, 403, "Only the Host can cancel this Event.");
      check(event.status !== "EXPIRED", 409, "This Event has expired.");
      if (event.status !== "CANCELLED") {
        check(slot.startsAt > new Date(), 409, "This reservation has already started.");
        await tx.groupDiningSession.update({
          where: { id },
          data: { status: "CANCELLED" },
        });
        await tx.booking.updateMany({
          where: { groupId: id },
          data: { status: "CANCELLED" },
        });
        await tx.slotAllocation.deleteMany({ where: { groupId: id } });
      }
    } else {
      check(
        ["OPEN", "FULL", "CONFIRMED"].includes(event.status) &&
          slot.startsAt > new Date(),
        409,
        "This Event is no longer accepting changes.",
      );
      const allocation = await tx.slotAllocation.findUnique({
        where: { slotId: slot.id },
      });
      check(
        allocation?.groupId === id,
        409,
        "This table is no longer held by this Event.",
      );
      if (action === "join" || action === "resize") {
        const restaurant = await tx.restaurant.findUniqueOrThrow({
          where: { id: slot.restaurantId },
        });
        check(restaurant.active, 409, "This restaurant is no longer accepting Parties.");
      }
      if (action === "join") {
        if (!party) {
          const partySize = size(
            req.body?.partySize === undefined ? 1 : req.body.partySize,
          );
          check(
            partySize < slot.minimumPartySize,
            400,
            "A Party that meets the minimum can book directly.",
          );
          check(
            dinerCount(event.members) + partySize <= event.capacity,
            409,
            "There are not enough seats for your Party.",
          );
          await tx.groupDiningMember.create({ data: { groupId: id, userId, partySize } });
        }
      } else if (action === "resize") {
        check(party, 403, "Only a Party in this Event can change its size.");
        const partySize = size(req.body?.partySize);
        check(
          dinerCount(event.members) - party.partySize + partySize <= event.capacity,
          409,
          "There are not enough seats for your Party.",
        );
        await tx.groupDiningMember.update({
          where: { groupId_userId: { groupId: id, userId } },
          data: { partySize },
        });
      } else if (action === "leave") {
        if (party) {
          await tx.groupDiningMember.delete({
            where: { groupId_userId: { groupId: id, userId } },
          });
          if (event.hostId === userId) {
            // joinedAt orders Parties; userId breaks equal-timestamp ties deterministically.
            const successor = event.members.find((m) => m.userId !== userId);
            if (successor)
              await tx.groupDiningSession.update({
                where: { id },
                data: { hostId: successor.userId },
              });
          }
        }
      } else {
        // Retain the old endpoint for existing clients; it cannot force qualification.
        check(event.hostId === userId, 403, "Only the Host can do this.");
        check(
          dinerCount(event.members) >= slot.minimumPartySize,
          409,
          `At least ${slot.minimumPartySize} diners are needed to confirm.`,
        );
      }
      await syncEvent(tx, id);
    }
    return tx.groupDiningSession.findUniqueOrThrow({
      where: { id },
      include: groupInclude,
    });
  });
  res.json({ group: result });
});

dining.post("/bookings", async (req, res) => {
  const slotId = text(req.body?.slotId, 100),
    partySize = size(req.body?.partySize);
  const booking = await db.$transaction(async (tx) => {
    const slot = await lockSlot(tx, slotId);
    check(
      (
        await tx.restaurant.findUniqueOrThrow({
          where: { id: slot.restaurantId },
        })
      ).active,
      409,
      "This restaurant is no longer available for new reservations.",
    );
    check(slot.startsAt > new Date(), 409, "This dining slot has already started.");
    check(
      partySize >= slot.minimumPartySize && partySize <= slot.capacity,
      400,
      "Your party size must fit the restaurant’s limits.",
    );
    check(
      !(await tx.slotAllocation.findUnique({ where: { slotId } })),
      409,
      "Someone has already reserved this slot.",
    );
    const booking = await tx.booking.create({
      data: { slotId, userId: res.locals.userId, partySize },
    });
    await tx.slotAllocation.create({ data: { slotId, bookingId: booking.id } });
    return booking;
  });
  res.status(201).json({ booking });
});
dining.post("/bookings/:id/cancel", async (req, res) => {
  const id = String(req.params.id);
  const reference = await db.booking.findUnique({ where: { id } });
  check(reference, 404, "Booking not found.");
  const booking = await db.$transaction(async (tx) => {
    const slot = await lockSlot(tx, reference.slotId);
    const booking = await tx.booking.findUniqueOrThrow({ where: { id } });
    check(
      booking.userId === res.locals.userId,
      403,
      "Only the booking owner can cancel.",
    );
    check(!booking.groupId, 409, "Cancel a shared booking from its group page.");
    if (booking.status !== "CANCELLED") {
      check(slot.startsAt > new Date(), 409, "This reservation has already started.");
      await tx.slotAllocation.deleteMany({ where: { bookingId: id } });
    }
    return tx.booking.update({ where: { id }, data: { status: "CANCELLED" } });
  });
  res.json({ booking });
});

// Deleting a cancelled shared booking only removes it from this diner's history.
// Other members retain their record, and cancelled inventory remains released.
dining.post("/bookings/:id/delete", async (req, res) => {
  const userId = res.locals.userId as string;
  const booking = await db.booking.findUnique({
    where: { id: String(req.params.id) },
    include: { group: { include: { members: true } } },
  });
  check(booking, 404, "Booking not found.");
  check(
    booking.userId === userId || booking.group?.members.some((m) => m.userId === userId),
    403,
    "This booking does not belong to you.",
  );
  check(booking.status === "CANCELLED", 409, "Cancel this booking before deleting it.");
  await db.booking.updateMany({
    where: { id: booking.id, NOT: { deletedFor: { has: userId } } },
    data: { deletedFor: { push: userId } },
  });
  res.json({ deleted: true });
});
