CREATE TYPE "AccountType" AS ENUM ('DINER', 'BUSINESS');
CREATE TYPE "AttendanceStatus" AS ENUM ('UNRECORDED', 'ATTENDED', 'NO_SHOW');
ALTER TABLE "User" ADD COLUMN "accountType" "AccountType" NOT NULL DEFAULT 'DINER', ADD COLUMN "managedRestaurantId" TEXT;
ALTER TABLE "Restaurant" ADD COLUMN "corppassVerified" BOOLEAN NOT NULL DEFAULT false, ADD COLUMN "eatTogetherEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD CONSTRAINT "User_managedRestaurantId_fkey" FOREIGN KEY ("managedRestaurantId") REFERENCES "Restaurant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "GroupDiningSession" ADD COLUMN "restaurantHosted" BOOLEAN NOT NULL DEFAULT false, ADD COLUMN "minimumPartySize" INTEGER, ADD COLUMN "discount" INTEGER, ADD COLUMN "theme" TEXT NOT NULL DEFAULT '';
ALTER TABLE "GroupDiningMember" ADD COLUMN "attendance" "AttendanceStatus" NOT NULL DEFAULT 'UNRECORDED', ADD COLUMN "attendanceRecordedAt" TIMESTAMP(3);
