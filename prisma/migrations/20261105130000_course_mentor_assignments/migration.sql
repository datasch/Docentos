-- CreateTable
CREATE TABLE IF NOT EXISTS "CourseMentor" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "mentorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourseMentor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "CourseMentor_courseId_mentorId_key" ON "CourseMentor"("courseId", "mentorId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CourseMentor_mentorId_idx" ON "CourseMentor"("mentorId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CourseMentor_courseId_idx" ON "CourseMentor"("courseId");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'CourseMentor_courseId_fkey'
    ) THEN
        ALTER TABLE "CourseMentor" ADD CONSTRAINT "CourseMentor_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'CourseMentor_mentorId_fkey'
    ) THEN
        ALTER TABLE "CourseMentor" ADD CONSTRAINT "CourseMentor_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- Backfill existing mentor-course assignments from MenteeAssignment
INSERT INTO "CourseMentor" ("id", "courseId", "mentorId", "createdAt")
SELECT gen_random_uuid(), ma."courseId", ma."mentorId", NOW()
FROM "MenteeAssignment" ma
JOIN "User" u ON u."id" = ma."mentorId" AND u."role" = 'MENTOR'
JOIN "Course" c ON c."id" = ma."courseId"
GROUP BY ma."courseId", ma."mentorId"
ON CONFLICT ("courseId", "mentorId") DO NOTHING;

