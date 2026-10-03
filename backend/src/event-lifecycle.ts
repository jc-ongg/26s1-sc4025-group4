import type { Prisma } from "@prisma/client";

export const dinerCount = (parties: { partySize: number }[]) =>
  parties.reduce((total, party) => total + party.partySize, 0);

// Call only while holding the slot row lock: membership, status and booking must agree.
export async function syncEvent(tx: Prisma.TransactionClient, id: string) {
  const event = await tx.groupDiningSession.findUniqueOrThrow({
    where: { id },
    include: { members: true, slot: true, booking: true },
  });
  const partySize = dinerCount(event.members);
  if (!partySize) {
    await tx.groupDiningSession.update({ where: { id }, data: { status: "CANCELLED" } });
    await tx.booking.updateMany({
      where: { groupId: id },
      data: { status: "CANCELLED" },
    });
    await tx.slotAllocation.deleteMany({ where: { groupId: id } });
    return;
  }
  const confirmed = partySize >= event.slot.minimumPartySize;
  await tx.groupDiningSession.update({
    where: { id },
    data: { status: confirmed ? "CONFIRMED" : "OPEN" },
  });
  if (confirmed) {
    await tx.booking.upsert({
      where: { groupId: id },
      create: { slotId: event.slotId, groupId: id, userId: event.hostId, partySize },
      update: { status: "CONFIRMED", userId: event.hostId, partySize },
    });
  } else if (event.booking) {
    // Keep one booking identity across qualification changes; pending bookings are
    // excluded from Reservations and cannot be deleted as cancelled history.
    await tx.booking.update({
      where: { id: event.booking.id },
      data: { status: "PENDING", userId: event.hostId, partySize },
    });
  }
}
