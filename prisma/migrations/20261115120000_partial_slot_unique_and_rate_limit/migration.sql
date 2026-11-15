-- F-01: a cancelled meeting must not block its slot forever.
DROP INDEX "Meeting_scheduledAt_key";
CREATE INDEX "Meeting_scheduledAt_idx" ON "Meeting"("scheduledAt");
CREATE UNIQUE INDEX "Meeting_scheduledAt_confirmed_key" ON "Meeting"("scheduledAt") WHERE "status" = 'CONFIRMED';

-- F-02 / F-04: throttling counters.
CREATE TABLE "RateLimit" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "resetAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("key")
);
