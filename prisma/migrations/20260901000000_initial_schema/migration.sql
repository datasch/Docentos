-- Fase 0: esquema inicial persistente de DocentOS.
-- Esta migracion formaliza las instalaciones que originalmente se crearon con
-- `prisma db push`. El script prepare-migration-history.mjs solo la marca como
-- aplicada cuando reconoce el esquema completo; en una base vacia se ejecuta.

CREATE SCHEMA IF NOT EXISTS "public";

CREATE TYPE "Role" AS ENUM ('ADMIN', 'MENTOR', 'MENTEE', 'PUBLIC_USER', 'VIP', 'EXTERNAL');
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'PUBLIC_USER',
    "avatarUrl" TEXT,
    "strikes" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Plugin" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "category" TEXT NOT NULL,
    "icon" TEXT NOT NULL DEFAULT 'Puzzle',
    "configJson" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Plugin_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MenteeAssignment" (
    "id" TEXT NOT NULL,
    "mentorId" TEXT NOT NULL,
    "menteeId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "courseProgress" INTEGER NOT NULL DEFAULT 0,
    "completedVideosCount" INTEGER NOT NULL DEFAULT 0,
    "totalVideosCount" INTEGER NOT NULL DEFAULT 0,
    "lastActiveDate" TEXT NOT NULL DEFAULT 'Reciente',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MenteeAssignment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Course" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "coverImage" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'Mentoría Elite',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Module" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL,
    "courseId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Module_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VideoDriveLink" (
    "id" TEXT NOT NULL,
    "driveFileId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "duration" TEXT,
    "mimeType" TEXT NOT NULL DEFAULT 'video/mp4',
    "embedUrl" TEXT NOT NULL,
    "previewUrl" TEXT,
    "order" INTEGER NOT NULL,
    "moduleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "VideoDriveLink_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'COMPLETED',
    "stripeSessionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MentorshipComment" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isMentorResponse" BOOLEAN NOT NULL DEFAULT false,
    "isResolved" BOOLEAN NOT NULL DEFAULT false,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "userId" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MentorshipComment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT true,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserProgress_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VideoNote" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "timestampSeconds" INTEGER NOT NULL DEFAULT 0,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "VideoNote_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LandingConfig" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "heroTitle" TEXT NOT NULL DEFAULT 'El Motor de Aprendizaje Abierto con IA Nativa & Mentoría',
    "heroSubtitle" TEXT NOT NULL DEFAULT 'DocentOS es la alternativa moderna, liviana y modular de código abierto frente a plataformas LMS tradicionales monolíticas como Moodle u Odoo LMS.',
    "heroMediaUrl" TEXT NOT NULL DEFAULT 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=1200&auto=format&fit=crop',
    "heroCtaText" TEXT NOT NULL DEFAULT 'Explorar Cursos',
    "heroCtaLink" TEXT NOT NULL DEFAULT '#courses',
    "heroSecondaryCtaText" TEXT NOT NULL DEFAULT 'Pase VIP',
    "heroSecondaryCtaLink" TEXT NOT NULL DEFAULT '#vip',
    "featuredCourseIds" TEXT NOT NULL DEFAULT '[]',
    "bannerEnabled" BOOLEAN NOT NULL DEFAULT true,
    "bannerText" TEXT NOT NULL DEFAULT '🚀 ¡Novedad en DocentOS v2.5! Motor de IA optimizado, gestión de guías vocales e integración con Drive.',
    "bannerLinkText" TEXT NOT NULL DEFAULT 'Ver Novedades',
    "bannerLinkUrl" TEXT NOT NULL DEFAULT '#',
    "benefitsJson" TEXT NOT NULL DEFAULT '[]',
    "testimonialsJson" TEXT NOT NULL DEFAULT '[]',
    "footerText" TEXT NOT NULL DEFAULT 'Created and maintained by Giantucchi (Jose Luis Hernandez Hernandez)',
    "githubUrl" TEXT NOT NULL DEFAULT 'https://github.com/giantucchi/docentos',
    "discordUrl" TEXT NOT NULL DEFAULT '',
    "twitterUrl" TEXT NOT NULL DEFAULT '',
    "linkedinUrl" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LandingConfig_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TTSGuide" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "moduleId" TEXT,
    "videoId" TEXT,
    "title" TEXT NOT NULL,
    "scriptText" TEXT NOT NULL,
    "voiceId" TEXT NOT NULL,
    "voiceSpeed" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "mentorName" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "xpReward" INTEGER NOT NULL DEFAULT 50,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TTSGuide_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Feedback" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL DEFAULT 5,
    "comment" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "MenteeAssignment_menteeId_courseId_key" ON "MenteeAssignment"("menteeId", "courseId");
CREATE UNIQUE INDEX "UserProgress_userId_videoId_key" ON "UserProgress"("userId", "videoId");

ALTER TABLE "MenteeAssignment" ADD CONSTRAINT "MenteeAssignment_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MenteeAssignment" ADD CONSTRAINT "MenteeAssignment_menteeId_fkey" FOREIGN KEY ("menteeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MenteeAssignment" ADD CONSTRAINT "MenteeAssignment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Module" ADD CONSTRAINT "Module_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VideoDriveLink" ADD CONSTRAINT "VideoDriveLink_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MentorshipComment" ADD CONSTRAINT "MentorshipComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MentorshipComment" ADD CONSTRAINT "MentorshipComment_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "VideoDriveLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MentorshipComment" ADD CONSTRAINT "MentorshipComment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "MentorshipComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserProgress" ADD CONSTRAINT "UserProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserProgress" ADD CONSTRAINT "UserProgress_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "VideoDriveLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VideoNote" ADD CONSTRAINT "VideoNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VideoNote" ADD CONSTRAINT "VideoNote_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "VideoDriveLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
