-- Historial trazable de moderación (strikes, suspensiones y reactivaciones). Migración aditiva.
CREATE TABLE IF NOT EXISTS "ModerationEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "actorName" TEXT NOT NULL DEFAULT '',
    "actorEmail" TEXT NOT NULL DEFAULT '',
    "action" TEXT NOT NULL,
    "strikesBefore" INTEGER NOT NULL,
    "strikesAfter" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModerationEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ModerationEvent_userId_createdAt_idx" ON "ModerationEvent"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "ModerationEvent_actorUserId_idx" ON "ModerationEvent"("actorUserId");

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ModerationEvent_userId_fkey') THEN
        ALTER TABLE "ModerationEvent" ADD CONSTRAINT "ModerationEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ModerationEvent_actorUserId_fkey') THEN
        ALTER TABLE "ModerationEvent" ADD CONSTRAINT "ModerationEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
