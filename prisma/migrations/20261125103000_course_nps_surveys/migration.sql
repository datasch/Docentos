-- CreateEnum
CREATE TYPE "CourseNpsStage" AS ENUM ('START', 'MID', 'END');

-- CreateTable
CREATE TABLE "CourseNpsSurvey" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "stage" "CourseNpsStage" NOT NULL,
    "npsScore" INTEGER,
    "comment" TEXT,
    "dismissed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseNpsSurvey_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CourseNpsSurvey_nps_range" CHECK ("npsScore" IS NULL OR "npsScore" BETWEEN 0 AND 10)
);

-- CreateIndex
CREATE UNIQUE INDEX "CourseNpsSurvey_userId_courseId_stage_key" ON "CourseNpsSurvey"("userId", "courseId", "stage");

-- CreateIndex
CREATE INDEX "CourseNpsSurvey_courseId_stage_createdAt_idx" ON "CourseNpsSurvey"("courseId", "stage", "createdAt");

-- CreateIndex
CREATE INDEX "CourseNpsSurvey_userId_courseId_idx" ON "CourseNpsSurvey"("userId", "courseId");

-- AddForeignKey
ALTER TABLE "CourseNpsSurvey" ADD CONSTRAINT "CourseNpsSurvey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseNpsSurvey" ADD CONSTRAINT "CourseNpsSurvey_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
