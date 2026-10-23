ALTER TABLE "GroupDiningSession" ADD COLUMN "cutoffHeadcount" INTEGER;
-- Older Events have no historical snapshot. Preserve their current booked size;
-- an existing Last Call can still refill to the minimum that qualified it.
UPDATE "GroupDiningSession" AS g SET "cutoffHeadcount" = GREATEST(
  COALESCE((SELECT SUM(m."partySize") FROM "GroupDiningMember" m WHERE m."groupId" = g.id), 0),
  CASE WHEN g.status = 'LAST_CALL' THEN COALESCE(g."minimumPartySize", s."minimumPartySize") ELSE 0 END
) FROM "ReservationSlot" s WHERE g."slotId" = s.id AND g."cutoffProcessed" = true;
