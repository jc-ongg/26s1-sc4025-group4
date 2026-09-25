CREATE EXTENSION IF NOT EXISTS vector;
ALTER TABLE "Restaurant"
  ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "address" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "latitude" DOUBLE PRECISION,
  ADD COLUMN "longitude" DOUBLE PRECISION,
  ADD COLUMN "imagePath" TEXT,
  ADD COLUMN "imageSource" TEXT,
  ADD COLUMN "sourceUrl" TEXT,
  ADD COLUMN "sourceCheckedAt" TEXT,
  ADD COLUMN "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "signatureDishes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "embedding" vector(384),
  ADD COLUMN "embeddingHash" TEXT;
ALTER TABLE "GroupDiningSession" ADD COLUMN "embedding" vector(384), ADD COLUMN "embeddingHash" TEXT;
CREATE TABLE "DiscoveryDecision" (
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "targetKey" TEXT NOT NULL,
  "decision" TEXT NOT NULL CHECK ("decision" IN ('SAVE','SKIP')),
  "updatedAt" TIMESTAMP(3) NOT NULL,
  PRIMARY KEY ("userId", "targetKey")
);
