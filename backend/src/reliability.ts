import type { Prisma } from "@prisma/client";
export const strikeWindow = 90 * 86400000;
export const suspensionLength = 7 * 86400000;
export async function recordLateLeave(
  tx: Prisma.TransactionClient,
  userId: string,
  groupId: string,
  now: Date,
) {
  // Slot first, then account: all penalties use this lock order. Deduplication
  // prevents a retried Leave or repeated Leave/rejoin from creating extra strikes.
  await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
  const existing = await tx.reliabilityStrike.findUnique({
    where: { userId_groupId_reason: { userId, groupId, reason: "LATE_LEAVE" } },
  });
  if (existing) return;
  await tx.reliabilityStrike.create({
    data: { userId, groupId, reason: "LATE_LEAVE", createdAt: now },
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
  await tx.notification.create({
    data: {
      userId,
      key: `${groupId}:late-leave`,
      title: "Reliability updated",
      body: `A late Leave recorded a strike. You have ${count} in the last 90 days.${count >= 3 ? " EatTogether is suspended for one week. Ordinary bookings remain available." : ""}`,
    },
  });
}
