-- Migración para el plugin Customer Voice (Escucha Activa y Atención al Alumno)

DO $$ BEGIN
    CREATE TYPE "VoiceSentiment" AS ENUM ('MOTIVATED', 'CONFUSED', 'FRUSTRATED', 'INSPIRED', 'NEUTRAL');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "VoiceCategory" AS ENUM ('COURSE_CONTENT', 'PLATFORM_UX', 'MENTORSHIP_CARE', 'FEATURE_REQUEST', 'BUG_REPORT', 'OTHER');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "VoiceStatus" AS ENUM ('RECEIVED', 'IN_REVIEW', 'ACTION_TAKEN', 'RESOLVED', 'ARCHIVED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "StudentVoice" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "courseId" TEXT,
    "sentiment" "VoiceSentiment" NOT NULL DEFAULT 'NEUTRAL',
    "category" "VoiceCategory" NOT NULL DEFAULT 'COURSE_CONTENT',
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "isAnonymous" BOOLEAN NOT NULL DEFAULT false,
    "status" "VoiceStatus" NOT NULL DEFAULT 'RECEIVED',
    "aiEmpathyReply" TEXT,
    "mentorReply" TEXT,
    "mentorRepliedAt" TIMESTAMP(3),
    "mentorRepliedBy" TEXT,
    "adminNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentVoice_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "StudentVoice_userId_createdAt_idx" ON "StudentVoice"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "StudentVoice_status_createdAt_idx" ON "StudentVoice"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "StudentVoice_sentiment_idx" ON "StudentVoice"("sentiment");
CREATE INDEX IF NOT EXISTS "StudentVoice_category_idx" ON "StudentVoice"("category");
CREATE INDEX IF NOT EXISTS "StudentVoice_courseId_idx" ON "StudentVoice"("courseId");

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'StudentVoice_userId_fkey'
    ) THEN
        ALTER TABLE "StudentVoice" ADD CONSTRAINT "StudentVoice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'StudentVoice_courseId_fkey'
    ) THEN
        ALTER TABLE "StudentVoice" ADD CONSTRAINT "StudentVoice_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
