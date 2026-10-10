-- Buzon de Escucha Activa.
--
-- Una persona deja una recomendacion, queja, felicitacion o duda, y elige una
-- carita (1 a 5) y, si quiere, un NPS (0 a 10). Quien administra responde, y la
-- respuesta le llega a ella. Las dos medidas son numericas a proposito: quien
-- analiza los datos las lee sin interpretar texto.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ListeningType') THEN
    CREATE TYPE "ListeningType" AS ENUM ('SUGGESTION', 'COMPLAINT', 'PRAISE', 'QUESTION');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ListeningTopic') THEN
    CREATE TYPE "ListeningTopic" AS ENUM ('CONTENT', 'PLATFORM', 'TEACHING', 'FEATURE', 'BUG', 'OTHER');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ListeningStatus') THEN
    CREATE TYPE "ListeningStatus" AS ENUM ('NEW', 'IN_REVIEW', 'ANSWERED', 'CLOSED');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS "ListeningEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "courseId" TEXT,
    "type" "ListeningType" NOT NULL,
    "topic" "ListeningTopic" NOT NULL,
    "mood" INTEGER NOT NULL,
    "npsScore" INTEGER,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "anonymous" BOOLEAN NOT NULL DEFAULT false,
    "status" "ListeningStatus" NOT NULL DEFAULT 'NEW',
    "reply" TEXT,
    "repliedAt" TIMESTAMP(3),
    "repliedById" TEXT,
    "replySeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ListeningEntry_pkey" PRIMARY KEY ("id"),
    -- Defensa en la base: si un cliente salta la validacion de la API, las
    -- medidas no pueden salirse de su escala y falsear el NPS.
    CONSTRAINT "ListeningEntry_mood_range" CHECK ("mood" BETWEEN 1 AND 5),
    CONSTRAINT "ListeningEntry_nps_range" CHECK ("npsScore" IS NULL OR "npsScore" BETWEEN 0 AND 10)
);

CREATE INDEX IF NOT EXISTS "ListeningEntry_userId_createdAt_idx" ON "ListeningEntry"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "ListeningEntry_status_createdAt_idx" ON "ListeningEntry"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "ListeningEntry_createdAt_idx" ON "ListeningEntry"("createdAt");
CREATE INDEX IF NOT EXISTS "ListeningEntry_courseId_createdAt_idx" ON "ListeningEntry"("courseId", "createdAt");

ALTER TABLE "ListeningEntry" ADD CONSTRAINT "ListeningEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ListeningEntry" ADD CONSTRAINT "ListeningEntry_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ListeningEntry" ADD CONSTRAINT "ListeningEntry_repliedById_fkey" FOREIGN KEY ("repliedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
