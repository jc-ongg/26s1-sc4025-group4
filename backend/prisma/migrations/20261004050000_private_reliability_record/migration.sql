-- The private record starts empty; Cutoff and attendance tracking are deferred.
ALTER TABLE "User" ADD COLUMN "reliabilityStrikes" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD CONSTRAINT "User_reliabilityStrikes_nonnegative" CHECK ("reliabilityStrikes" >= 0);
