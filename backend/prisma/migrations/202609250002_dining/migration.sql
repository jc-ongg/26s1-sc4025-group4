-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "GroupStatus" AS ENUM ('OPEN', 'FULL', 'CONFIRMED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('CONFIRMED', 'CANCELLED');

-- CreateTable
CREATE TABLE "Restaurant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cuisine" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "price" TEXT NOT NULL,
    "artwork" TEXT NOT NULL,

    CONSTRAINT "Restaurant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReservationSlot" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "minimumPartySize" INTEGER NOT NULL,
    "capacity" INTEGER NOT NULL,
    "discount" INTEGER NOT NULL,

    CONSTRAINT "ReservationSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SlotAllocation" (
    "slotId" TEXT NOT NULL,
    "groupId" TEXT,
    "bookingId" TEXT,

    CONSTRAINT "SlotAllocation_pkey" PRIMARY KEY ("slotId")
);

-- CreateTable
CREATE TABLE "GroupDiningSession" (
    "id" TEXT NOT NULL,
    "hostId" TEXT NOT NULL,
    "slotId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "capacity" INTEGER NOT NULL,
    "status" "GroupStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupDiningSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupDiningMember" (
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupDiningMember_pkey" PRIMARY KEY ("groupId","userId")
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" TEXT NOT NULL,
    "slotId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "groupId" TEXT,
    "partySize" INTEGER NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'CONFIRMED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReservationSlot_restaurantId_startsAt_key" ON "ReservationSlot"("restaurantId", "startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "SlotAllocation_groupId_key" ON "SlotAllocation"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX "SlotAllocation_bookingId_key" ON "SlotAllocation"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_groupId_key" ON "Booking"("groupId");

-- AddForeignKey
ALTER TABLE "ReservationSlot" ADD CONSTRAINT "ReservationSlot_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlotAllocation" ADD CONSTRAINT "SlotAllocation_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "ReservationSlot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlotAllocation" ADD CONSTRAINT "SlotAllocation_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "GroupDiningSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlotAllocation" ADD CONSTRAINT "SlotAllocation_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupDiningSession" ADD CONSTRAINT "GroupDiningSession_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupDiningSession" ADD CONSTRAINT "GroupDiningSession_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "ReservationSlot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupDiningMember" ADD CONSTRAINT "GroupDiningMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "GroupDiningSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupDiningMember" ADD CONSTRAINT "GroupDiningMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "ReservationSlot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "GroupDiningSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
