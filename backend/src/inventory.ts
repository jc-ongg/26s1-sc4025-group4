import type { Prisma, ReservationSlot } from "@prisma/client";
import { check } from "./http-error.js";

export async function lockSlot(tx: Prisma.TransactionClient, id: string) {
  const rows = await tx.$queryRaw<
    { id: string }[]
  >`SELECT id FROM "ReservationSlot" WHERE id = ${id} FOR UPDATE`;
  check(rows.length, 404, "Dining slot not found.");
  return tx.reservationSlot.findUniqueOrThrow({ where: { id } });
}
export const poolSize = (slot: Pick<ReservationSlot, "capacity" | "discountedSeats">) =>
  slot.discountedSeats ?? slot.capacity;
export async function availableSeats(
  tx: Prisma.TransactionClient,
  slot: ReservationSlot,
) {
  const held = await tx.slotAllocation.aggregate({
    where: { slotId: slot.id },
    _sum: { seats: true },
  });
  return Math.max(0, poolSize(slot) - (held._sum.seats ?? 0));
}
export async function holdSeats(
  tx: Prisma.TransactionClient,
  slot: ReservationSlot,
  groupId: string,
  seats: number,
) {
  const own = await tx.slotAllocation.findUnique({ where: { groupId } });
  check(
    seats <= (own?.seats ?? 0) + (await availableSeats(tx, slot)),
    409,
    "There are not enough seats at this time.",
  );
  if (!seats) {
    await tx.slotAllocation.deleteMany({ where: { groupId } });
    return;
  }
  await tx.slotAllocation.upsert({
    where: { groupId },
    create: { slotId: slot.id, groupId, seats },
    update: { seats },
  });
}
