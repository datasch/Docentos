-- AlterTable
ALTER TABLE "CourseResource" ADD COLUMN     "videoId" TEXT;

-- CreateIndex
CREATE INDEX "CourseResource_videoId_idx" ON "CourseResource"("videoId");

-- AddForeignKey
ALTER TABLE "CourseResource" ADD CONSTRAINT "CourseResource_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "VideoDriveLink"("id") ON DELETE SET NULL ON UPDATE CASCADE;
