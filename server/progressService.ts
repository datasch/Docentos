import { randomBytes } from 'node:crypto';
import { prisma } from './prisma.js';

function newVerificationCode() {
  return `DOC-${randomBytes(8).toString('hex').toUpperCase()}`;
}

export async function calculateCourseProgress(userId: string, courseId: string) {
  const [user, course, totalVideos, completedVideos] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true } }),
    prisma.course.findUnique({ where: { id: courseId }, select: { id: true, title: true } }),
    prisma.videoDriveLink.count({ where: { module: { courseId } } }),
    prisma.userProgress.count({
      where: { userId, completed: true, video: { module: { courseId } } },
    }),
  ]);

  if (!user || !course) return null;

  const percentage = totalVideos > 0 ? Math.round((completedVideos / totalVideos) * 100) : 0;
  const completed = totalVideos > 0 && completedVideos === totalVideos;
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.menteeAssignment.updateMany({
      where: { menteeId: userId, courseId },
      data: {
        completedVideosCount: completedVideos,
        totalVideosCount: totalVideos,
        courseProgress: percentage,
        lastActiveDate: 'Ahora',
        status: completed ? 'GRADUATED' : 'ACTIVE',
      },
    });

    const enrollment = await tx.courseEnrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
      select: { status: true },
    });
    if (enrollment && ['ACTIVE', 'COMPLETED'].includes(enrollment.status)) {
      await tx.courseEnrollment.update({
        where: { userId_courseId: { userId, courseId } },
        data: {
          status: completed ? 'COMPLETED' : 'ACTIVE',
          completedAt: completed ? now : null,
        },
      });
    }

    if (completed) {
      await tx.certificate.upsert({
        where: { userId_courseId: { userId, courseId } },
        update: {
          recipientName: user.name,
          courseTitle: course.title,
          completionPercent: percentage,
        },
        create: {
          verificationCode: newVerificationCode(),
          userId,
          courseId,
          recipientName: user.name,
          courseTitle: course.title,
          completionPercent: percentage,
          metadataJson: JSON.stringify({ totalVideos, completedVideos }),
        },
      });
    }
  });

  const certificate = await prisma.certificate.findUnique({
    where: { userId_courseId: { userId, courseId } },
  });

  return {
    courseId,
    completedVideos,
    totalVideos,
    percentage,
    completed,
    certificate: certificate
      ? {
          id: certificate.id,
          // Sin el curso al que pertenece, el navegador no puede comprobar que
          // el diploma que enseña es el de la pantalla en la que está.
          courseId: certificate.courseId,
          verificationCode: certificate.verificationCode,
          recipientName: certificate.recipientName,
          courseTitle: certificate.courseTitle,
          completionPercent: certificate.completionPercent,
          issuedAt: certificate.issuedAt.toISOString(),
          revokedAt: certificate.revokedAt?.toISOString() || null,
        }
      : null,
  };
}
