import { Router } from "express";
import { Prisma } from "@prisma/client";
import { db } from "./db.js";
import {
  dinerCount,
  syncEvent,
  cutoffAt,
  processLifecycle,
  notify,
} from "./event-lifecycle.js";
import { check, HttpError } from "./http-error.js";
export { HttpError } from "./http-error.js";
import { lockSlot, availableSeats, holdSeats, poolSize } from "./inventory.js";
import { recordLateLeave, strikeWindow } from "./reliability.js";
import {
  ageBand,
  canViewEvent,
  matchesEvent,
  parseEventFilters,
  verifiedAdult,
  type DinerIdentity,
} from "./event-eligibility.js";

const userFields = { id: true, name: true, dateOfBirth: true } as const;
export const groupInclude = {
  host: { select: userFields },
  slot: { include: { restaurant: true, allocations: true } },
  allocation: true,
  members: {
    include: { user: { select: userFields } },
    orderBy: [{ joinedAt: "asc" as const }, { userId: "asc" as const }],
  },
  booking: true,
} satisfies Prisma.GroupDiningSessionInclude;
type Transaction = Prisma.TransactionClient;
type IncludedGroup = Prisma.GroupDiningSessionGetPayload<{
  include: typeof groupInclude;
}>;

// Public participants expose an age band, never a birth date or verification payload.
export function presentGroup(group: IncludedGroup, viewer?: DinerIdentity) {
  const participant = (user: IncludedGroup["host"]) => ({
    id: user.id,
    name: user.name,
    ageBand: ageBand(user.dateOfBirth),
  });
  return {
    ...group,
    booking: group.booking ? { ...group.booking, deletedFor: undefined } : null,
    allocation: undefined,
    slot: { ...group.slot, allocations: undefined },
    heldSeats: group.allocation?.seats ?? 0,
    leavePenalty:
      !!viewer &&
      group.members.some((m) => m.userId === viewer.id) &&
      group.status === "CONFIRMED" &&
      new Date() >= cutoffAt(group.slot.startsAt) &&
      !group.members.some((m) => viewer.blockedUserIds?.includes(m.userId)),
    capacity:
      group.slot.startsAt > new Date() &&
      ["OPEN", "FULL", "CONFIRMED", "LAST_CALL"].includes(group.status)
        ? Math.max(
            dinerCount(group.members),
            Math.min(
              group.capacity,
              (group.allocation?.seats ?? 0) +
                Math.max(
                  0,
                  poolSize(group.slot) -
                    group.slot.allocations.reduce((total, a) => total + a.seats, 0),
                ),
            ),
          )
        : group.capacity,
    cutoffAt: cutoffAt(group.slot.startsAt),
    discount:
      group.status === "FULL_PRICE" || group.status === "PRICE_DECISION"
        ? 0
        : group.slot.discount,
    host: participant(group.host),
    members: group.members.map((member) => ({
      ...member,
      priceAccepted: member.userId === viewer?.id ? member.priceAccepted : undefined,
      user: participant(member.user),
    })),
  };
}

export async function presentRestaurants<
  T extends {
    slots: {
      id: string;
      capacity: number;
      minimumPartySize: number;
      discountedSeats: number | null;
      allocations: { groupId: string | null; bookingId: string | null; seats: number }[];
    }[];
  },
>(restaurants: T[], diner: DinerIdentity) {
  const ids = restaurants.flatMap((r) =>
    r.slots.flatMap((s) => s.allocations.flatMap((a) => (a.groupId ? [a.groupId] : []))),
  );
  const events = ids.length
    ? await db.groupDiningSession.findMany({
        where: { id: { in: ids } },
        include: { members: true, slot: true },
      })
    : [];
  const visible = new Set(
    events
      .filter(
        (g) =>
          canViewEvent(diner, g) &&
          ["OPEN", "FULL", "CONFIRMED", "LAST_CALL"].includes(g.status),
      )
      .map((g) => g.id),
  );
  return restaurants.map((r) => {
    const { slots, ...venue } = r;
    return {
      ...venue,
      slots: slots.map((s) => {
        const free = Math.max(
          0,
          poolSize(s) - s.allocations.reduce((n, a) => n + a.seats, 0),
        );
        const eventIds = s.allocations.flatMap((a) =>
          a.groupId && visible.has(a.groupId) ? [a.groupId] : [],
        );
        return {
          ...s,
          allocations: undefined,
          availableSeats: free,
          eventIds,
          allocation: eventIds.length
            ? { groupId: eventIds[0], bookingId: null }
            : free < s.minimumPartySize
              ? { groupId: null, bookingId: null }
              : null,
        };
      }),
    };
  });
}

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

function singleDiner(value: unknown) {
  check(
    value === undefined || value === 1,
    400,
    "Each account can reserve one EatTogether seat. Other diners must Join with their own accounts.",
  );
  return 1;
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
  res.locals.diner = await db.user.findUniqueOrThrow({
    where: { id: session.userId },
    select: {
      id: true,
      singpassVerified: true,
      dateOfBirth: true,
      gender: true,
      suspendedUntil: true,
    },
  });
  const blocks = await db.dinerBlock.findMany({
    where: { OR: [{ blockerId: session.userId }, { blockedId: session.userId }] },
  });
  res.locals.diner.blockedUserIds = blocks.map((b) =>
    b.blockerId === session.userId ? b.blockedId : b.blockerId,
  );
  res.set("Cache-Control", "no-store");
  await processLifecycle();
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
        include: { allocations: true },
      },
    },
  });
  res.json({ restaurants: await presentRestaurants(restaurants, res.locals.diner) });
});
dining.get("/restaurants/:id", async (req, res) => {
  const restaurant = await db.restaurant.findUnique({
    where: { id: String(req.params.id) },
    include: {
      slots: {
        where: { startsAt: { gt: new Date() } },
        orderBy: { startsAt: "asc" },
        include: { allocations: true },
      },
    },
  });
  check(restaurant, 404, "Restaurant not found.");
  const groups = await db.groupDiningSession.findMany({
    where: {
      slot: { restaurantId: restaurant.id, startsAt: { gt: new Date() } },
      status: { in: ["OPEN", "FULL", "CONFIRMED", "LAST_CALL"] },
    },
    include: groupInclude,
    orderBy: { slot: { startsAt: "asc" } },
  });
  res.json({
    restaurant: (await presentRestaurants([restaurant], res.locals.diner))[0],
    groups: groups
      .filter((g) => canViewEvent(res.locals.diner, g))
      .map((g) => presentGroup(g, res.locals.diner)),
  });
});
dining.get("/groups", async (_req, res) => {
  res.json({
    groups: (
      await db.groupDiningSession.findMany({
        where: {
          status: { in: ["OPEN", "FULL", "CONFIRMED", "LAST_CALL"] },
          slot: { startsAt: { gt: new Date() }, restaurant: { active: true } },
        },
        include: groupInclude,
        orderBy: { slot: { startsAt: "asc" } },
      })
    )
      .filter((g) => canViewEvent(res.locals.diner, g))
      .map((g) => presentGroup(g, res.locals.diner)),
  });
});
dining.get("/groups/:id", async (req, res) => {
  const reference = await db.groupDiningSession.findUnique({
    where: { id: String(req.params.id) },
    include: groupInclude,
  });
  check(reference && canViewEvent(res.locals.diner, reference), 404, "Event not found.");
  // A detail read must observe its own timing boundary even if a background
  // lifecycle pass began before this Event was created or reached Cutoff.
  const group = await db.$transaction(async (tx) => {
    await lockSlot(tx, reference.slotId);
    await syncEvent(tx, reference.id);
    return tx.groupDiningSession.findUniqueOrThrow({
      where: { id: reference.id },
      include: groupInclude,
    });
  });
  check(canViewEvent(res.locals.diner, group), 404, "Event not found.");
  res.json({ group: presentGroup(group, res.locals.diner) });
});
dining.get("/me/profile", async (_req, res) => {
  const profile = await db.user.findUniqueOrThrow({
    where: { id: res.locals.userId as string },
    select: {
      id: true,
      name: true,
      email: true,
      reliabilityStrikes: true,
      singpassVerified: true,
      dateOfBirth: true,
      gender: true,
      diningArea: true,
      suspendedUntil: true,
    },
  });
  const { dateOfBirth, ...account } = profile;
  const strikes = await db.reliabilityStrike.findMany({
    where: { userId: profile.id, createdAt: { gt: new Date(Date.now() - strikeWindow) } },
    orderBy: { createdAt: "desc" },
    select: { id: true, reason: true, createdAt: true },
  });
  res.json({
    profile: {
      ...account,
      reliabilityStrikes: strikes.length,
      strikes,
      ageBand: ageBand(dateOfBirth),
    },
  });
});

dining.get("/me/groups", async (_req, res) => {
  res.json({
    groups: (
      await db.groupDiningSession.findMany({
        where: {
          NOT: { booking: { deletedFor: { has: res.locals.userId } } },
          OR: [
            { hostId: res.locals.userId },
            { members: { some: { userId: res.locals.userId } } },
          ],
        },
        include: groupInclude,
        orderBy: { createdAt: "desc" },
      })
    ).map((g) => presentGroup(g, res.locals.diner)),
  });
});
dining.get("/me/bookings", async (_req, res) => {
  const userId = res.locals.userId as string;
  const bookings = await db.booking.findMany({
    where: {
      status: { in: ["CONFIRMED", "CANCELLED"] },
      NOT: { deletedFor: { has: userId } },
      OR: [{ userId }, { group: { members: { some: { userId } } } }],
    },
    include: {
      slot: { include: { restaurant: true } },
      group: {
        select: {
          id: true,
          title: true,
          hostId: true,
          members: { where: { userId }, select: { partySize: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
  res.json({
    bookings: bookings.map(({ group, deletedFor: _deletedFor, ...booking }) => {
      // Return this account's Party size alongside the Event total for the booking card.
      const { members, ...event } = group ?? { members: [] };
      return {
        ...booking,
        group: group ? event : null,
        yourPartySize: group ? (members[0]?.partySize ?? null) : booking.partySize,
      };
    }),
  });
});

dining.post("/groups", async (req, res) => {
  const slotId = text(req.body?.slotId, 100),
    title = text(req.body?.title, 80);
  const description = text(req.body?.description ?? "", 500, false),
    partySize = singleDiner(req.body?.partySize);
  const filters = parseEventFilters(req.body ?? {});
  check(filters, 400, "Choose a valid gender and age range starting at 18.");
  check(
    verifiedAdult(res.locals.diner),
    403,
    "Singpass verification is required for EatTogether.",
  );
  const group = await db.$transaction(async (tx) => {
    const slot = await lockSlot(tx, slotId);
    const identity = await tx.user.findUniqueOrThrow({
      where: { id: res.locals.userId },
    });
    check(
      !identity.suspendedUntil || identity.suspendedUntil <= new Date(),
      403,
      "EatTogether is temporarily suspended for this account. Ordinary bookings are still available.",
    );
    check(
      slot.eatTogetherEnabled && slot.discount > 0,
      409,
      "EatTogether is unavailable at this time.",
    );
    check(
      new Date() < cutoffAt(slot.startsAt),
      409,
      "New Events close two hours before dining time. You can still Join a Confirmed or Last Call Event.",
    );
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
      matchesEvent(res.locals.diner, { ...filters, slot }),
      400,
      "Your Event preferences must include your own age and gender.",
    );
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
    const existing = await tx.groupDiningSession.findMany({
      where: { slotId, status: { in: ["OPEN", "FULL", "CONFIRMED", "LAST_CALL"] } },
      include: { members: true, slot: true, allocation: true },
    });
    const free = await availableSeats(tx, slot);
    check(
      !existing.some((g) => g.members.some((m) => m.userId === identity.id)),
      409,
      "You already have an EatTogether seat at this time. Manage your existing Event first.",
    );
    check(
      !existing.some(
        (g) =>
          matchesEvent(res.locals.diner, g) &&
          (g.members.some((m) => m.userId === identity.id) ||
            dinerCount(g.members) <
              Math.min(g.capacity, (g.allocation?.seats ?? 0) + free)),
      ),
      409,
      "An eligible Event already has a seat. Join it instead of creating another.",
    );
    check(
      free >= slot.minimumPartySize,
      409,
      "There are not enough seats to hold the minimum for a new Event.",
    );
    const group = await tx.groupDiningSession.create({
      data: {
        slotId,
        title,
        description,
        ...filters,
        capacity,
        hostId: res.locals.userId,
        status: "OPEN",
        initialHeldSeats: slot.minimumPartySize,
        members: { create: { userId: res.locals.userId, partySize } },
      },
      include: groupInclude,
    });
    await holdSeats(tx, slot, group.id, slot.minimumPartySize);
    await syncEvent(tx, group.id);
    return tx.groupDiningSession.findUniqueOrThrow({
      where: { id: group.id },
      include: groupInclude,
    });
  });
  res.status(201).json({ group: presentGroup(group, res.locals.diner) });
});
dining.post("/groups/:id/:action", async (req, res, next) => {
  const id = String(req.params.id),
    action = String(req.params.action),
    userId: string = res.locals.userId;
  // Social endpoints share the Event prefix and are handled by the next router.
  if (["messages", "feedback", "safety"].includes(action)) return next();
  check(
    [
      "join",
      "leave",
      "resize",
      "confirm",
      "cancel",
      "accept-price",
      "decline-price",
    ].includes(action),
    404,
    "Action not found.",
  );
  check(
    !["genderFilter", "minAge", "maxAge"].some((field) =>
      Object.hasOwn(req.body ?? {}, field),
    ),
    400,
    "Event preferences are fixed at creation.",
  );
  const reference = await db.groupDiningSession.findUnique({
    where: { id },
    select: { slotId: true },
  });
  check(reference, 404, "Event not found.");
  const result = await db.$transaction(async (tx) => {
    const slot = await lockSlot(tx, reference.slotId);
    await syncEvent(tx, id);
    const event = await tx.groupDiningSession.findUniqueOrThrow({
      where: { id },
      include: { members: { orderBy: [{ joinedAt: "asc" }, { userId: "asc" }] } },
    });
    check(canViewEvent(res.locals.diner, { ...event, slot }), 404, "Event not found.");
    const party = event.members.find((m) => m.userId === userId);
    const blocked = event.members.some((m) =>
      res.locals.diner.blockedUserIds.includes(m.userId),
    );
    const late =
      party &&
      event.status === "CONFIRMED" &&
      new Date() >= cutoffAt(slot.startsAt) &&
      !blocked;
    if (
      (["leave", "cancel"].includes(action) ||
        (action === "resize" &&
          party &&
          party.partySize > 1 &&
          req.body?.partySize === 1)) &&
      late
    ) {
      check(
        req.body?.acknowledgeStrike === true,
        409,
        "Leaving after Cutoff records a reliability strike. Confirm the warning to continue.",
      );
      await recordLateLeave(tx, userId, id, new Date());
    }
    if (action === "accept-price" || action === "decline-price") {
      check(
        party && event.status === "PRICE_DECISION" && slot.startsAt > new Date(),
        409,
        "This price choice is no longer available.",
      );
      if (action === "accept-price")
        await tx.groupDiningMember.update({
          where: { groupId_userId: { groupId: id, userId } },
          data: { priceAccepted: true },
        });
      else
        await tx.groupDiningMember.delete({
          where: { groupId_userId: { groupId: id, userId } },
        });
      if (action === "decline-price" && event.hostId === userId) {
        const next = event.members.find((m) => m.userId !== userId);
        if (next)
          await tx.groupDiningSession.update({
            where: { id },
            data: { hostId: next.userId },
          });
      }
      await syncEvent(tx, id);
      return tx.groupDiningSession.findUniqueOrThrow({
        where: { id },
        include: groupInclude,
      });
    }
    if (action === "cancel") {
      check(event.hostId === userId, 403, "Only the Host can cancel this Event.");
      check(event.status !== "EXPIRED", 409, "This Event has expired.");
      if (event.status !== "CANCELLED") {
        for (const m of event.members)
          await notify(
            tx,
            m.userId,
            id,
            `${id}:cancelled`,
            "Event cancelled",
            "The Host cancelled this Event. Your reservation has been released.",
          );
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
        [
          "OPEN",
          "FULL",
          "CONFIRMED",
          "LAST_CALL",
          "PRICE_DECISION",
          "FULL_PRICE",
        ].includes(event.status) && slot.startsAt > new Date(),
        409,
        "This Event is no longer accepting changes.",
      );
      const allocation = await tx.slotAllocation.findUnique({
        where: { groupId: id },
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
        const partySize = singleDiner(req.body?.partySize);
        check(
          ["OPEN", "FULL", "CONFIRMED", "LAST_CALL"].includes(event.status),
          409,
          "This Event is closed to Joins.",
        );
        const identity = await tx.user.findUniqueOrThrow({ where: { id: userId } });
        check(
          !identity.suspendedUntil || identity.suspendedUntil <= new Date(),
          403,
          "EatTogether is temporarily suspended for this account.",
        );
        check(
          matchesEvent(res.locals.diner, { ...event, slot }),
          403,
          "Singpass verification and matching Event preferences are required to Join.",
        );
        if (!party) {
          check(
            !(await tx.groupDiningMember.findFirst({
              where: {
                userId,
                group: {
                  slotId: slot.id,
                  id: { not: id },
                  status: { notIn: ["CANCELLED", "EXPIRED"] },
                },
              },
            })),
            409,
            "You already have an EatTogether seat at this time.",
          );
          check(
            partySize < slot.minimumPartySize,
            400,
            "A Party that meets the minimum can book directly.",
          );
          check(
            dinerCount(event.members) + partySize <=
              Math.min(
                event.capacity,
                allocation.seats + (await availableSeats(tx, slot)),
              ),
            409,
            "There are not enough seats for your Party.",
          );
          await tx.groupDiningMember.create({ data: { groupId: id, userId, partySize } });
          for (const member of event.members)
            await notify(
              tx,
              member.userId,
              id,
              `${id}:joined:${userId}`,
              "A diner joined",
              "Your Event has a new diner.",
            );
        }
      } else if (action === "resize") {
        check(party, 403, "Only a Party in this Event can change its size.");
        // Retain a way to reduce an existing multi-diner reservation to this account's seat.
        check(req.body?.partySize !== undefined, 400, "Confirm the change to one seat.");
        const partySize = singleDiner(req.body?.partySize);
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
          for (const member of event.members.filter((m) => m.userId !== userId))
            await notify(
              tx,
              member.userId,
              id,
              `${id}:left:${userId}`,
              "A diner left",
              "A seat was released from your Event.",
            );
          if (event.hostId === userId) {
            // joinedAt orders Parties; userId breaks equal-timestamp ties deterministically.
            const successor = event.members.find((m) => m.userId !== userId);
            if (successor) {
              await tx.groupDiningSession.update({
                where: { id },
                data: { hostId: successor.userId },
              });
              await notify(
                tx,
                successor.userId,
                id,
                `${id}:handover:${userId}:${successor.userId}`,
                "You are now the Host",
                "The previous Host left. You now host this Event.",
              );
            }
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
  res.json({ group: presentGroup(result, res.locals.diner) });
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
      (await availableSeats(tx, slot)) >= partySize,
      409,
      "There are not enough seats at this time.",
    );
    const booking = await tx.booking.create({
      data: { slotId, userId: res.locals.userId, partySize, discount: slot.discount },
    });
    await tx.slotAllocation.create({
      data: { slotId, bookingId: booking.id, seats: partySize },
    });
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
