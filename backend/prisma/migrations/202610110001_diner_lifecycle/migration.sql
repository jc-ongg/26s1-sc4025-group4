ALTER TYPE "GroupStatus" ADD VALUE 'LAST_CALL';
ALTER TYPE "GroupStatus" ADD VALUE 'PRICE_DECISION';
ALTER TYPE "GroupStatus" ADD VALUE 'FULL_PRICE';

ALTER TABLE "User" ADD COLUMN "suspendedUntil" TIMESTAMP(3), ADD COLUMN "diningArea" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ReservationSlot" ADD COLUMN "discountedSeats" INTEGER, ADD COLUMN "eatTogetherEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "ReservationSlot" ADD CONSTRAINT "slot_seat_pool" CHECK ("discountedSeats" IS NULL OR "discountedSeats" BETWEEN "capacity" AND 200);
ALTER TABLE "Booking" ADD COLUMN "discount" INTEGER;
ALTER TABLE "Booking" ADD CONSTRAINT "booking_discount" CHECK ("discount" IS NULL OR "discount" BETWEEN 0 AND 100);

ALTER TABLE "GroupDiningSession"
  ADD COLUMN "cutoffProcessed" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "lastCallRound" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "chatOpenedAt" TIMESTAMP(3),
  ADD COLUMN "confirmedAt" TIMESTAMP(3),
  ADD COLUMN "initialHeldSeats" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "releasedAtCutoff" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "GroupDiningMember" ADD COLUMN "priceAccepted" BOOLEAN NOT NULL DEFAULT false;

-- Retain every existing allocation and booking identity while permitting a shared pool.
ALTER TABLE "SlotAllocation" ADD COLUMN "id" TEXT, ADD COLUMN "seats" INTEGER;
UPDATE "SlotAllocation" a SET "id" = a."slotId", "seats" = CASE
  WHEN a."bookingId" IS NOT NULL THEN (SELECT "partySize" FROM "Booking" WHERE id = a."bookingId")
  ELSE GREATEST(
    (SELECT "minimumPartySize" FROM "ReservationSlot" WHERE id = a."slotId"),
    COALESCE((SELECT SUM("partySize") FROM "GroupDiningMember" WHERE "groupId" = a."groupId"), 0)
  ) END;
ALTER TABLE "SlotAllocation" ALTER COLUMN "id" SET NOT NULL, ALTER COLUMN "seats" SET NOT NULL;
ALTER TABLE "SlotAllocation" DROP CONSTRAINT "SlotAllocation_pkey", ADD CONSTRAINT "SlotAllocation_pkey" PRIMARY KEY ("id");
ALTER TABLE "SlotAllocation" ADD CONSTRAINT "allocation_seats" CHECK ("seats" BETWEEN 1 AND 200);
CREATE INDEX "SlotAllocation_slotId_idx" ON "SlotAllocation"("slotId");
UPDATE "GroupDiningSession" g SET "initialHeldSeats" = s."minimumPartySize"
  FROM "ReservationSlot" s WHERE g."slotId" = s.id;
UPDATE "GroupDiningSession" SET "chatOpenedAt" = "createdAt", "confirmedAt" = "createdAt" WHERE status = 'CONFIRMED';

CREATE TABLE "ReliabilityStrike" (
  "id" TEXT PRIMARY KEY, "userId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  "groupId" TEXT NOT NULL REFERENCES "GroupDiningSession"(id) ON DELETE CASCADE,
  "reason" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "ReliabilityStrike_userId_groupId_reason_key" ON "ReliabilityStrike"("userId", "groupId", "reason");
CREATE INDEX "ReliabilityStrike_userId_createdAt_idx" ON "ReliabilityStrike"("userId", "createdAt");
CREATE TABLE "Notification" (
  "id" TEXT PRIMARY KEY, "userId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  "groupId" TEXT REFERENCES "GroupDiningSession"(id) ON DELETE CASCADE,
  "key" TEXT NOT NULL, "title" TEXT NOT NULL, "body" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "readAt" TIMESTAMP(3)
);
CREATE UNIQUE INDEX "Notification_userId_key_key" ON "Notification"("userId", "key");
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");
CREATE TABLE "DinerBlock" (
  "blockerId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  "blockedId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("blockerId", "blockedId"), CHECK ("blockerId" <> "blockedId")
);
CREATE TABLE "EventMessage" (
  "id" TEXT PRIMARY KEY, "groupId" TEXT NOT NULL REFERENCES "GroupDiningSession"(id) ON DELETE CASCADE,
  "userId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  "body" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "EventMessage_groupId_createdAt_idx" ON "EventMessage"("groupId", "createdAt");
CREATE TABLE "EventFeedback" (
  "groupId" TEXT NOT NULL REFERENCES "GroupDiningSession"(id) ON DELETE CASCADE,
  "userId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  "overall" INTEGER NOT NULL CHECK ("overall" BETWEEN 1 AND 5),
  "safety" TEXT NOT NULL CHECK ("safety" IN ('YES','SOMEWHAT','NO')),
  "social" INTEGER NOT NULL CHECK ("social" BETWEEN 1 AND 5),
  "meal" INTEGER NOT NULL CHECK ("meal" BETWEEN 1 AND 5),
  "dineAgain" TEXT NOT NULL CHECK ("dineAgain" IN ('YES','MAYBE','NO')),
  "suggestions" TEXT NOT NULL DEFAULT '', "attended" BOOLEAN NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("groupId", "userId")
);
CREATE TABLE "SafetyReport" (
  "id" TEXT PRIMARY KEY, "groupId" TEXT NOT NULL REFERENCES "GroupDiningSession"(id) ON DELETE CASCADE,
  "reporterId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  "targetId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  "reason" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "SafetyReport_reporterId_createdAt_idx" ON "SafetyReport"("reporterId", "createdAt");
