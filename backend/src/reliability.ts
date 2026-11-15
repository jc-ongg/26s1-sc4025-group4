import type { Prisma } from "@prisma/client";
export const strikeWindow = 90 * 86400000;
export const suspensionLength = 7 * 86400000;
async function recordStrike(
  tx: Prisma.TransactionClient,
  userId: string,
  groupId: string,
  now: Date,
  reason: "LATE_LEAVE" | "NO_SHOW",
) {
  // Slot first, then account: all penalties use this lock order. Deduplication
  // prevents a retried Leave or repeated Leave/rejoin from creating extra strikes.
  await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
  const existing = await tx.reliabilityStrike.findUnique({
    where: { userId_groupId_reason: { userId, groupId, reason } },
  });
  if (existing) return;
  await tx.reliabilityStrike.create({
    data: { userId, groupId, reason, createdAt: now },
  });
  const count = await tx.reliabilityStrike.count({
    where: { userId, createdAt: { gt: new Date(now.getTime() - strikeWindow) } },
  });
  await tx.user.update({
    where: { id: userId },
    data: {
      reliabilityStrikes: count,
      ...(count >= 3 && { suspendedUntil: new Date(now.getTime() + suspensionLength) }),
    },
  });
  const notification = {
    userId,
    key: `${groupId}:${reason === "NO_SHOW" ? "no-show" : "late-leave"}`,
    title: "Reliability updated",
    body: `A ${reason === "NO_SHOW" ? "restaurant-recorded no-show" : "late Leave"} recorded a strike. You have ${count} in the last 90 days.${count >= 3 ? " EatTogether is suspended for one week. Ordinary bookings remain available." : ""}`,
  };
  await tx.notification.upsert({
    where: { userId_key: { userId, key: notification.key } },
    create: notification,
    update: { body: notification.body, readAt: null, createdAt: now },
  });
}
export const recordLateLeave = (
  tx: Prisma.TransactionClient,
  userId: string,
  groupId: string,
  now: Date,
) => recordStrike(tx, userId, groupId, now, "LATE_LEAVE");
export const recordNoShow = (
  tx: Prisma.TransactionClient,
  userId: string,
  groupId: string,
  now: Date,
) => recordStrike(tx, userId, groupId, now, "NO_SHOW");
export async function correctNoShow(
  tx: Prisma.TransactionClient,
  userId: string,
  groupId: string,
  now: Date,
) {
  await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
  await tx.reliabilityStrike.deleteMany({
    where: { userId, groupId, reason: "NO_SHOW" },
  });
  const strikes = await tx.reliabilityStrike.findMany({
    where: { userId, createdAt: { gt: new Date(now.getTime() - strikeWindow) } },
    orderBy: { createdAt: "desc" },
  });
  await tx.user.update({
    where: { id: userId },
    data: {
      reliabilityStrikes: strikes.length,
      suspendedUntil:
        strikes.length >= 3
          ? new Date(strikes[0].createdAt.getTime() + suspensionLength)
          : null,
    },
  });
}
