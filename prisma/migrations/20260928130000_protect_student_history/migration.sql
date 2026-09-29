-- Los pagos, matrículas, certificados y trabajo del alumno sobreviven a cambios de contenido.
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_courseId_fkey";
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CourseEnrollment" DROP CONSTRAINT "CourseEnrollment_courseId_fkey";
ALTER TABLE "CourseEnrollment" ADD CONSTRAINT "CourseEnrollment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Certificate" DROP CONSTRAINT "Certificate_courseId_fkey";
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "QuizAttempt" DROP CONSTRAINT "QuizAttempt_moduleId_fkey";
ALTER TABLE "QuizAttempt" ADD CONSTRAINT "QuizAttempt_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "UserProgress" DROP CONSTRAINT "UserProgress_videoId_fkey";
ALTER TABLE "UserProgress" ADD CONSTRAINT "UserProgress_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "VideoDriveLink"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "VideoNote" DROP CONSTRAINT "VideoNote_videoId_fkey";
ALTER TABLE "VideoNote" ADD CONSTRAINT "VideoNote_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "VideoDriveLink"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MentorshipComment" DROP CONSTRAINT "MentorshipComment_videoId_fkey";
ALTER TABLE "MentorshipComment" ADD CONSTRAINT "MentorshipComment_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "VideoDriveLink"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
