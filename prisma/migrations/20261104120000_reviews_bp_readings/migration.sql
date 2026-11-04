-- Future review appointments (#4) and blood pressure SMS (#5).
-- Additive only. Written to be safe to re-run: Booking.orderId and the
-- 'Review' enum value already exist on production (added outside a migration).

ALTER TYPE "BookingType" ADD VALUE IF NOT EXISTS 'Review';

ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "needsBpCheck" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "orderId" INTEGER;
ALTER TABLE "SmsLog" ADD COLUMN IF NOT EXISTS "repliedAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "BpReading" (
    "id" SERIAL NOT NULL,
    "token" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "orderId" INTEGER,
    "systolic" INTEGER,
    "diastolic" INTEGER,
    "readingDate" TIMESTAMP(3),
    "reviewDate" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'pending',
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BpReading_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "BpReading_token_key" ON "BpReading"("token");
CREATE INDEX IF NOT EXISTS "BpReading_userId_createdAt_idx" ON "BpReading"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "BpReading_token_idx" ON "BpReading"("token");
CREATE UNIQUE INDEX IF NOT EXISTS "BpReading_orderId_reviewDate_key" ON "BpReading"("orderId", "reviewDate");
CREATE INDEX IF NOT EXISTS "Booking_orderId_idx" ON "Booking"("orderId");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Booking_orderId_fkey') THEN
    ALTER TABLE "Booking" ADD CONSTRAINT "Booking_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BpReading_userId_fkey') THEN
    ALTER TABLE "BpReading" ADD CONSTRAINT "BpReading_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BpReading_orderId_fkey') THEN
    ALTER TABLE "BpReading" ADD CONSTRAINT "BpReading_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
