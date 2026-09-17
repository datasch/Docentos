-- Migración para el plugin LiveMeetings (Clases Sincrónicas y Asincrónicas)

-- Columnas opcionales en VideoDriveLink para lecciones con sesión en vivo
ALTER TABLE "VideoDriveLink" ADD COLUMN IF NOT EXISTS "meetingType" TEXT;
ALTER TABLE "VideoDriveLink" ADD COLUMN IF NOT EXISTS "meetingUrl" TEXT;
ALTER TABLE "VideoDriveLink" ADD COLUMN IF NOT EXISTS "scheduledAt" TIMESTAMP(3);
ALTER TABLE "VideoDriveLink" ADD COLUMN IF NOT EXISTS "isLive" BOOLEAN NOT NULL DEFAULT false;

-- Tabla principal de Meetings (Sesiones Sincrónicas y Asincrónicas)
CREATE TABLE IF NOT EXISTS "Meeting" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "meetingType" TEXT NOT NULL DEFAULT 'meet',
    "meetingUrl" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isLive" BOOLEAN NOT NULL DEFAULT false,
    "courseId" TEXT,
    "moduleId" TEXT,
    "hostId" TEXT,
    "recordingUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Meeting_pkey" PRIMARY KEY ("id")
);

-- Índices de búsqueda
CREATE INDEX IF NOT EXISTS "Meeting_courseId_scheduledAt_idx" ON "Meeting"("courseId", "scheduledAt");
CREATE INDEX IF NOT EXISTS "Meeting_isLive_idx" ON "Meeting"("isLive");
CREATE INDEX IF NOT EXISTS "Meeting_hostId_idx" ON "Meeting"("hostId");

-- Claves Foráneas
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'Meeting_courseId_fkey'
    ) THEN
        ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'Meeting_moduleId_fkey'
    ) THEN
        ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'Meeting_hostId_fkey'
    ) THEN
        ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
