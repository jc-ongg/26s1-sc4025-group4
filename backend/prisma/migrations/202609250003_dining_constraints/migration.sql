ALTER TABLE "ReservationSlot" ADD CONSTRAINT "slot_party_limits"
  CHECK ("minimumPartySize" >= 1 AND "capacity" >= "minimumPartySize" AND "capacity" <= 20);
ALTER TABLE "ReservationSlot" ADD CONSTRAINT "slot_discount_range"
  CHECK ("discount" >= 0 AND "discount" <= 100);
ALTER TABLE "SlotAllocation" ADD CONSTRAINT "allocation_one_owner"
  CHECK (("groupId" IS NOT NULL)::integer + ("bookingId" IS NOT NULL)::integer = 1);
ALTER TABLE "GroupDiningSession" ADD CONSTRAINT "group_capacity_range"
  CHECK ("capacity" BETWEEN 1 AND 20);
ALTER TABLE "Booking" ADD CONSTRAINT "booking_party_size_range"
  CHECK ("partySize" BETWEEN 1 AND 20);
