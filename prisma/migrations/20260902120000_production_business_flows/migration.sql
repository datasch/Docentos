-- Fase 3: pagos verificables, matriculas, contenido protegido y certificados.

ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'PARTIALLY_REFUNDED';
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'REFUNDED';

CREATE TYPE "EnrollmentStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'REVOKED', 'EXPIRED');
CREATE TYPE "EnrollmentSource" AS ENUM ('PAYMENT', 'ADMIN', 'MENTORSHIP', 'IMPORT');
CREATE TYPE "ContentSource" AS ENUM ('GOOGLE_DRIVE', 'EXTERNAL_URL', 'DEMO');
CREATE TYPE "ResourceKind" AS ENUM ('FILE', 'LINK');

ALTER TABLE "Course"
  ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'USD',
  ADD COLUMN "publishedAt" TIMESTAMP(3),
  ADD COLUMN "isDemo" BOOLEAN NOT NULL DEFAULT false;

UPDATE "Course"
SET "publishedAt" = COALESCE("createdAt", CURRENT_TIMESTAMP)
WHERE "published" = true;

UPDATE "Course"
SET "isDemo" = true
WHERE "id" = 'course-giantucchi-mastery';

ALTER TABLE "MenteeAssignment"
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "VideoDriveLink"
  ADD COLUMN "source" "ContentSource" NOT NULL DEFAULT 'EXTERNAL_URL';

UPDATE "VideoDriveLink"
SET "source" = 'DEMO'
WHERE "id" IN ('video-1a', 'video-1b', 'video-1c', 'video-2a', 'video-2b');

ALTER TABLE "Payment"
  ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'USD',
  ADD COLUMN "provider" TEXT NOT NULL DEFAULT 'stripe',
  ADD COLUMN "stripePaymentIntentId" TEXT,
  ADD COLUMN "idempotencyKey" TEXT,
  ADD COLUMN "checkoutUrl" TEXT,
  ADD COLUMN "failureCode" TEXT,
  ADD COLUMN "failureMessage" TEXT,
  ADD COLUMN "refundedAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "completedAt" TIMESTAMP(3),
  ADD COLUMN "failedAt" TIMESTAMP(3),
  ADD COLUMN "refundedAt" TIMESTAMP(3),
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "Payment" ALTER COLUMN "status" SET DEFAULT 'PENDING';

UPDATE "Payment"
SET "completedAt" = "createdAt"
WHERE "status" = 'COMPLETED' AND "completedAt" IS NULL;

CREATE UNIQUE INDEX "Payment_stripeSessionId_key" ON "Payment"("stripeSessionId");
CREATE UNIQUE INDEX "Payment_stripePaymentIntentId_key" ON "Payment"("stripePaymentIntentId");
CREATE UNIQUE INDEX "Payment_idempotencyKey_key" ON "Payment"("idempotencyKey");
CREATE INDEX "Payment_userId_courseId_status_idx" ON "Payment"("userId", "courseId", "status");
CREATE INDEX "Payment_createdAt_idx" ON "Payment"("createdAt");
CREATE INDEX "Module_courseId_order_idx" ON "Module"("courseId", "order");
CREATE INDEX "VideoDriveLink_moduleId_order_idx" ON "VideoDriveLink"("moduleId", "order");

CREATE TABLE "PaymentWebhookEvent" (
  "id" TEXT NOT NULL,
  "providerEventId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "payloadHash" TEXT NOT NULL,
  "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PaymentWebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PaymentWebhookEvent_providerEventId_key" ON "PaymentWebhookEvent"("providerEventId");
CREATE INDEX "PaymentWebhookEvent_eventType_idx" ON "PaymentWebhookEvent"("eventType");
CREATE INDEX "PaymentWebhookEvent_processedAt_idx" ON "PaymentWebhookEvent"("processedAt");

CREATE TABLE "CourseEnrollment" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "courseId" TEXT NOT NULL,
  "status" "EnrollmentStatus" NOT NULL DEFAULT 'ACTIVE',
  "source" "EnrollmentSource" NOT NULL,
  "accessExpiresAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CourseEnrollment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CourseEnrollment_userId_courseId_key" ON "CourseEnrollment"("userId", "courseId");
CREATE INDEX "CourseEnrollment_courseId_status_idx" ON "CourseEnrollment"("courseId", "status");
CREATE INDEX "CourseEnrollment_accessExpiresAt_idx" ON "CourseEnrollment"("accessExpiresAt");

ALTER TABLE "CourseEnrollment"
  ADD CONSTRAINT "CourseEnrollment_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CourseEnrollment"
  ADD CONSTRAINT "CourseEnrollment_courseId_fkey"
  FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "CourseEnrollment" (
  "id", "userId", "courseId", "status", "source", "createdAt", "updatedAt"
)
SELECT
  'payment-' || md5("userId" || ':' || "courseId"),
  "userId",
  "courseId",
  'ACTIVE'::"EnrollmentStatus",
  'PAYMENT'::"EnrollmentSource",
  MIN("createdAt"),
  CURRENT_TIMESTAMP
FROM "Payment"
WHERE "status" = 'COMPLETED'
GROUP BY "userId", "courseId"
ON CONFLICT ("userId", "courseId") DO NOTHING;

INSERT INTO "CourseEnrollment" (
  "id", "userId", "courseId", "status", "source", "completedAt", "createdAt", "updatedAt"
)
SELECT
  'mentorship-' || md5("menteeId" || ':' || "courseId"),
  "menteeId",
  "courseId",
  CASE WHEN "status" = 'GRADUATED' THEN 'COMPLETED'::"EnrollmentStatus" ELSE 'ACTIVE'::"EnrollmentStatus" END,
  'MENTORSHIP'::"EnrollmentSource",
  CASE WHEN "status" = 'GRADUATED' THEN CURRENT_TIMESTAMP ELSE NULL END,
  "createdAt",
  CURRENT_TIMESTAMP
FROM "MenteeAssignment"
WHERE "status" IN ('ACTIVE', 'GRADUATED')
ON CONFLICT ("userId", "courseId") DO UPDATE
SET "status" = EXCLUDED."status", "source" = 'MENTORSHIP', "updatedAt" = CURRENT_TIMESTAMP;

CREATE TABLE "CourseResource" (
  "id" TEXT NOT NULL,
  "courseId" TEXT NOT NULL,
  "moduleId" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "kind" "ResourceKind" NOT NULL DEFAULT 'FILE',
  "source" "ContentSource" NOT NULL DEFAULT 'EXTERNAL_URL',
  "externalFileId" TEXT,
  "privateUrl" TEXT NOT NULL,
  "mimeType" TEXT,
  "sizeBytes" BIGINT,
  "order" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CourseResource_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CourseResource_courseId_order_idx" ON "CourseResource"("courseId", "order");
CREATE INDEX "CourseResource_moduleId_order_idx" ON "CourseResource"("moduleId", "order");

ALTER TABLE "CourseResource"
  ADD CONSTRAINT "CourseResource_courseId_fkey"
  FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CourseResource"
  ADD CONSTRAINT "CourseResource_moduleId_fkey"
  FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "Certificate" (
  "id" TEXT NOT NULL,
  "verificationCode" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "courseId" TEXT NOT NULL,
  "recipientName" TEXT NOT NULL,
  "courseTitle" TEXT NOT NULL,
  "completionPercent" INTEGER NOT NULL DEFAULT 100,
  "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP(3),
  "revocationReason" TEXT,
  "metadataJson" TEXT NOT NULL DEFAULT '{}',
  CONSTRAINT "Certificate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Certificate_verificationCode_key" ON "Certificate"("verificationCode");
CREATE UNIQUE INDEX "Certificate_userId_courseId_key" ON "Certificate"("userId", "courseId");
CREATE INDEX "Certificate_issuedAt_idx" ON "Certificate"("issuedAt");

ALTER TABLE "Certificate"
  ADD CONSTRAINT "Certificate_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Certificate"
  ADD CONSTRAINT "Certificate_courseId_fkey"
  FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
