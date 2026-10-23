import { Router } from "express";
import { db } from "./db.js";
import { check } from "./http-error.js";
import { groupInclude } from "./dining.js";
import { canViewEvent } from "./event-eligibility.js";
import { centres } from "./geography.js";
import { lockSlot } from "./inventory.js";

export const social = Router();
function text(value: unknown, max: number) {
  check(
    typeof value === "string" && value.trim().length > 0 && value.trim().length <= max,
    400,
    `Enter 1–${max} characters.`,
  );
  return value.trim();
}
async function participation(groupId: string, userId: string) {
  const group = await db.groupDiningSession.findUnique({
    where: { id: groupId },
    include: groupInclude,
  });
  check(group && group.members.some((m) => m.userId === userId), 404, "Event not found.");
  return group;
}

social.post("/me/profile", async (req, res) => {
  check(
    typeof req.body?.diningArea === "string" && req.body.diningArea.length <= 120,
    400,
    "Enter a dining area.",
  );
  const area = req.body.diningArea.trim().toLowerCase().replace(/\s+/g, " ");
  check(
    !area || Object.hasOwn(centres, area),
    400,
    "Area not recognised. Enter a neighbourhood such as Jurong East, Orchard or Clementi.",
  );
  await db.user.update({ where: { id: res.locals.userId }, data: { diningArea: area } });
  res.json({ saved: true });
});
social.get("/me/notifications", async (_req, res) => {
  const records = await db.notification.findMany({
    where: { userId: res.locals.userId },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { group: { include: { members: true, slot: true } } },
  });
  const notifications = records
    .filter(
      (n) =>
        !n.group ||
        (canViewEvent(res.locals.diner, n.group) &&
          (!n.key.includes(":invite:") || n.group.status === "LAST_CALL")),
    )
    .map(({ group, key, ...notice }) => ({
      ...notice,
      eventTitle: group?.title ?? null,
    }));
  res.json({ notifications, unread: notifications.filter((n) => !n.readAt).length });
});
social.post("/me/notifications/read", async (req, res) => {
  const id = req.body?.id;
  check(id === undefined || typeof id === "string", 400, "Invalid notification.");
  if (id)
    check(
      await db.notification.findFirst({ where: { id, userId: res.locals.userId } }),
      404,
      "Notification not found.",
    );
  await db.notification.updateMany({
    where: { userId: res.locals.userId, readAt: null, ...(id && { id }) },
    data: { readAt: new Date() },
  });
  res.json({ read: true });
});
social.get("/me/blocks", async (_req, res) => {
  const records = await db.dinerBlock.findMany({
    where: { blockerId: res.locals.userId },
    include: { blocked: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });
  res.json({ blocks: records.map((b) => b.blocked) });
});
social.post("/me/blocks/:id/remove", async (req, res) => {
  await db.dinerBlock.deleteMany({
    where: { blockerId: res.locals.userId, blockedId: String(req.params.id) },
  });
  res.json({ removed: true });
});

social.post("/groups/:id/safety", async (req, res) => {
  const groupId = String(req.params.id),
    userId = res.locals.userId as string;
  const targetId = text(req.body?.targetId, 100),
    action = req.body?.action;
  check(["BLOCK", "REPORT"].includes(action), 400, "Choose report or block.");
  const group = await participation(groupId, userId);
  check(
    targetId !== userId &&
      (group.members.some((m) => m.userId === targetId) ||
        (group.restaurantHosted && group.hostId === targetId) ||
        (await db.eventMessage.count({ where: { groupId, userId: targetId } }))),
    400,
    "Choose another diner from this Event.",
  );
  if (action === "BLOCK")
    await db.dinerBlock.upsert({
      where: { blockerId_blockedId: { blockerId: userId, blockedId: targetId } },
      create: { blockerId: userId, blockedId: targetId },
      update: {},
    });
  else
    await db.safetyReport.create({
      data: {
        groupId,
        reporterId: userId,
        targetId,
        reason: text(req.body?.reason, 1000),
      },
    });
  // Blocking never alerts the target and does not impose an automatic strike.
  res.json({ saved: true });
});
social.get("/groups/:id/messages", async (req, res) => {
  const group = await participation(String(req.params.id), res.locals.userId);
  check(group.chatOpenedAt, 409, "Chat opens once your Event is Confirmed.");
  const messages = await db.eventMessage.findMany({
    where: { groupId: group.id, userId: { notIn: res.locals.diner.blockedUserIds } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 200,
    include: { user: { select: { id: true, name: true } } },
  });
  res.json({ messages: messages.reverse() });
});
social.post("/groups/:id/messages", async (req, res) => {
  const group = await participation(String(req.params.id), res.locals.userId);
  const body = text(req.body?.body, 1000);
  await db.$transaction(async (tx) => {
    await lockSlot(tx, group.slotId);
    const current = await tx.groupDiningSession.findUniqueOrThrow({
      where: { id: group.id },
      include: { members: true },
    });
    check(
      current.chatOpenedAt &&
        !["CANCELLED", "EXPIRED"].includes(current.status) &&
        current.members.some((m) => m.userId === res.locals.userId),
      409,
      "This Event is not accepting messages.",
    );
    await tx.eventMessage.create({
      data: { groupId: group.id, userId: res.locals.userId, body },
    });
  });
  res.status(201).json({ sent: true });
});
social.get("/groups/:id/feedback", async (req, res) => {
  const group = await participation(String(req.params.id), res.locals.userId);
  const feedback = await db.eventFeedback.findUnique({
    where: { groupId_userId: { groupId: group.id, userId: res.locals.userId } },
  });
  res.json({ feedback });
});
social.post("/groups/:id/feedback", async (req, res) => {
  const group = await participation(String(req.params.id), res.locals.userId);
  check(
    group.slot.startsAt <= new Date() &&
      group.booking?.status === "CONFIRMED" &&
      ["CONFIRMED", "FULL_PRICE"].includes(group.status) &&
      group.members.find((m) => m.userId === res.locals.userId)?.attendance !== "NO_SHOW",
    409,
    "Feedback opens after your booked dining time.",
  );
  const {
    overall,
    safety,
    social,
    meal,
    dineAgain,
    attended,
    suggestions = "",
  } = req.body ?? {};
  check(
    [overall, social, meal].every(
      (v) => typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 5,
    ) &&
      ["YES", "SOMEWHAT", "NO"].includes(safety) &&
      ["YES", "MAYBE", "NO"].includes(dineAgain) &&
      attended === true &&
      typeof suggestions === "string" &&
      suggestions.length <= 1000,
    400,
    "Complete the ratings and confirm you attended the meal.",
  );
  const data = {
    overall,
    safety,
    social,
    meal,
    dineAgain,
    attended,
    suggestions: suggestions.trim(),
  };
  await db.eventFeedback.upsert({
    where: { groupId_userId: { groupId: group.id, userId: res.locals.userId } },
    create: { groupId: group.id, userId: res.locals.userId, ...data },
    update: data,
  });
  res.json({ saved: true });
});
