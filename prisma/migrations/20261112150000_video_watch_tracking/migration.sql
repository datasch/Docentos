-- Duración real del medio, para exigir el 90% visto antes de completar una lección.
ALTER TABLE "VideoDriveLink" ADD COLUMN IF NOT EXISTS "mediaDurationSeconds" INTEGER;
ALTER TABLE "VideoDriveLink" ADD COLUMN IF NOT EXISTS "mediaDurationSource" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "VideoWatch" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "rangesJson" TEXT NOT NULL DEFAULT '[]',
    "watchedSeconds" INTEGER NOT NULL DEFAULT 0,
    "lastHeartbeatAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VideoWatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "VideoWatch_userId_videoId_key" ON "VideoWatch"("userId", "videoId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "VideoWatch_videoId_idx" ON "VideoWatch"("videoId");

-- AddForeignKey
-- CASCADE (y no Restrict) en el video: los flujos de borrado de cursos y videos
-- borran `UserProgress` a mano y con Restrict se romperían.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'VideoWatch_userId_fkey'
    ) THEN
        ALTER TABLE "VideoWatch" ADD CONSTRAINT "VideoWatch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'VideoWatch_videoId_fkey'
    ) THEN
        ALTER TABLE "VideoWatch" ADD CONSTRAINT "VideoWatch_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "VideoDriveLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
