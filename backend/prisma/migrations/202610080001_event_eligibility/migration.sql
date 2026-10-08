CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE');

ALTER TABLE "User"
  ADD COLUMN "singpassVerified" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "dateOfBirth" DATE,
  ADD COLUMN "gender" "Gender";

-- Existing Events remain open to all verified adults; no membership is rewritten.
ALTER TABLE "GroupDiningSession"
  ADD COLUMN "genderFilter" "Gender",
  ADD COLUMN "minAge" INTEGER,
  ADD COLUMN "maxAge" INTEGER,
  ADD CONSTRAINT "GroupDiningSession_age_range" CHECK (
    ("minAge" IS NULL OR "minAge" BETWEEN 18 AND 120) AND
    ("maxAge" IS NULL OR "maxAge" BETWEEN 18 AND 120) AND
    ("maxAge" IS NULL OR "maxAge" >= COALESCE("minAge", 18))
  );
