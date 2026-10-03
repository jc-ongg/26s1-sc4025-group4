ALTER TABLE "GroupDiningMember" ADD COLUMN "partySize" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "GroupDiningMember" ADD CONSTRAINT "GroupDiningMember_partySize_check" CHECK ("partySize" BETWEEN 1 AND 20);
ALTER TYPE "BookingStatus" ADD VALUE 'PENDING';
