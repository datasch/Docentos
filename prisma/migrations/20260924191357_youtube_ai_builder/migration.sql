-- CreateEnum
CREATE TYPE "YouTubePrivacyStatus" AS ENUM ('PUBLIC', 'UNLISTED', 'PRIVATE', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "AIJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- AlterEnum
ALTER TYPE "ContentSource" ADD VALUE 'YOUTUBE';



-- CreateTable
CREATE TABLE "YouTubeConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "googleEmail" TEXT NOT NULL,
    "accessTokenEnc" TEXT NOT NULL,
    "refreshTokenEnc" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "scopesGranted" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "YouTubeConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "YouTubePlaylist" (
    "id" TEXT NOT NULL,
    "youtubeId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "channelTitle" TEXT NOT NULL DEFAULT '',
    "thumbnailUrl" TEXT NOT NULL DEFAULT '',
    "privacyStatus" "YouTubePrivacyStatus" NOT NULL DEFAULT 'UNKNOWN',
    "itemCount" INTEGER NOT NULL DEFAULT 0,
    "publishedAt" TIMESTAMP(3),
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "YouTubePlaylist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "YouTubeVideo" (
    "id" TEXT NOT NULL,
    "youtubeId" TEXT NOT NULL,
    "playlistId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "thumbnailUrl" TEXT NOT NULL DEFAULT '',
    "channelTitle" TEXT NOT NULL DEFAULT '',
    "durationSeconds" INTEGER NOT NULL DEFAULT 0,
    "privacyStatus" "YouTubePrivacyStatus" NOT NULL DEFAULT 'UNKNOWN',
    "position" INTEGER NOT NULL DEFAULT 0,
    "customOrder" INTEGER NOT NULL DEFAULT 0,
    "excluded" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "YouTubeVideo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIJob" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "playlistId" TEXT,
    "courseRequest" TEXT NOT NULL,
    "inputJson" TEXT NOT NULL DEFAULT '{}',
    "resultJson" TEXT,
    "courseId" TEXT,
    "status" "AIJobStatus" NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "provider" TEXT NOT NULL DEFAULT 'gemini',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AIJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "YouTubeConnection_userId_key" ON "YouTubeConnection"("userId");

-- CreateIndex
CREATE INDEX "YouTubeConnection_userId_idx" ON "YouTubeConnection"("userId");

-- CreateIndex
CREATE INDEX "YouTubePlaylist_connectionId_idx" ON "YouTubePlaylist"("connectionId");

-- CreateIndex
CREATE UNIQUE INDEX "YouTubePlaylist_connectionId_youtubeId_key" ON "YouTubePlaylist"("connectionId", "youtubeId");

-- CreateIndex
CREATE INDEX "YouTubeVideo_playlistId_customOrder_idx" ON "YouTubeVideo"("playlistId", "customOrder");

-- CreateIndex
CREATE UNIQUE INDEX "YouTubeVideo_playlistId_youtubeId_key" ON "YouTubeVideo"("playlistId", "youtubeId");

-- CreateIndex
CREATE UNIQUE INDEX "AIJob_courseId_key" ON "AIJob"("courseId");

-- CreateIndex
CREATE INDEX "AIJob_userId_status_idx" ON "AIJob"("userId", "status");

-- CreateIndex
CREATE INDEX "AIJob_createdAt_idx" ON "AIJob"("createdAt");

-- AddForeignKey
ALTER TABLE "YouTubeConnection" ADD CONSTRAINT "YouTubeConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "YouTubePlaylist" ADD CONSTRAINT "YouTubePlaylist_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "YouTubeConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "YouTubeVideo" ADD CONSTRAINT "YouTubeVideo_playlistId_fkey" FOREIGN KEY ("playlistId") REFERENCES "YouTubePlaylist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIJob" ADD CONSTRAINT "AIJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIJob" ADD CONSTRAINT "AIJob_playlistId_fkey" FOREIGN KEY ("playlistId") REFERENCES "YouTubePlaylist"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIJob" ADD CONSTRAINT "AIJob_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;
