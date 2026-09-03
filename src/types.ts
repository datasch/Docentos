/**
 * Tipos de Datos y Modelos
 * Academia Giantucchi
 */

export type UserRole = 'ADMIN' | 'MENTOR' | 'MENTEE' | 'PUBLIC_USER' | 'VIP' | 'EXTERNAL';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatarUrl?: string;
  strikes?: number;
  isActive?: boolean;
}

export interface MenteeStudent {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  assignedMentorId?: string;
  courseProgress: number; // 0 to 100
  completedVideosCount: number;
  totalVideosCount: number;
  lastActiveDate: string;
  status: 'ACTIVE' | 'PENDING' | 'GRADUATED';
  strikes?: number;
  isActive?: boolean;
}

export interface AcademiaPlugin {
  id: string;
  name: string;
  description: string;
  version: string;
  enabled: boolean;
  category: 'certificates' | 'quizzes' | 'integrations' | 'analytics' | 'custom';
  icon: string;
  config: Record<string, any>;
}

export interface CourseResource {
  id: string;
  courseId: string;
  moduleId?: string | null;
  title: string;
  description?: string | null;
  kind: 'FILE' | 'LINK';
  source: 'GOOGLE_DRIVE' | 'EXTERNAL_URL' | 'DEMO';
  mimeType?: string | null;
  sizeBytes?: string | null;
  order: number;
  downloadUrl: string;
  createdAt?: string;
  updatedAt?: string;
}

// ── Importación de cursos desde Google Drive ────────────────────────
// Reflejan lo que devuelve `server/courseImportPlan.ts`. El plan viaja entero
// del servidor al navegador y de vuelta: aquí se edita, allí se revalida.

export type ImportContentKind =
  | 'video'
  | 'audio'
  | 'pdf'
  | 'doc'
  | 'slides'
  | 'sheet'
  | 'image'
  | 'note'
  | 'web'
  | 'subtitle'
  | 'archive'
  | 'other';

export interface PlannedLesson {
  key: string;
  title: string;
  originalName: string;
  driveFileId: string;
  embedUrl: string;
  mimeType: string;
  contentKind: ImportContentKind;
  duration: string;
  durationSeconds: number;
  durationEstimated: boolean;
  sizeBytes: number;
  include: boolean;
}

export interface PlannedResource {
  key: string;
  kind: 'subtitle' | 'attachment';
  title: string;
  originalName: string;
  driveFileId: string;
  downloadUrl: string;
  mimeType: string;
  sizeBytes: number;
  contentKind: ImportContentKind;
  pairedWithLessonKey: string | null;
  include: boolean;
}

export interface PlannedModule {
  key: string;
  title: string;
  originalName: string;
  path: string[];
  lessons: PlannedLesson[];
  resources: PlannedResource[];
  include: boolean;
}

export interface ImportPlan {
  title: string;
  category: string;
  description: string;
  sourceUrl: string;
  sourceFolderId: string;
  strategy: 'public' | 'apikey';
  modules: PlannedModule[];
  aiOrganized: boolean;
  stats: {
    foldersScanned: number;
    filesFound: number;
    lessons: number;
    resources: number;
    subtitles: number;
    skipped: number;
    minutes: number;
  };
  limits: { depthReached: boolean; nodeLimitReached: boolean; timedOut: boolean };
  incomplete: boolean;
}

export interface ImportPreviewResponse {
  success: boolean;
  plan: ImportPlan;
  existingCourse: { id: string; title: string; createdAt: string } | null;
  aiAvailable: boolean;
  aiProvider: 'openai' | 'deepseek' | 'none';
  elapsedMs: number;
}

export interface ImportOrganizeResponse {
  success: boolean;
  organized: boolean;
  plan: ImportPlan;
  provider?: string;
  model?: string;
  elapsedMs?: number;
  /** Por qué la propuesta de la IA no se aplicó, cuando no se aplicó. */
  reason?: string;
}

export interface ImportApplyResponse {
  success: boolean;
  mode: 'create' | 'append';
  courseId: string;
  course: Course | null;
  created: { modules: number; lessons: number; resources: number };
  skipped: { lessons: number; resources: number };
}

export interface CertificateRecord {
  id: string;
  verificationCode: string;
  courseId: string;
  courseTitle: string;
  recipientName: string;
  completionPercent: number;
  issuedAt: string;
  revokedAt?: string | null;
  revocationReason?: string | null;
  userName?: string;
  userEmail?: string;
}

export interface CourseEnrollmentRecord {
  id: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  courseId: string;
  courseTitle?: string;
  status: 'ACTIVE' | 'COMPLETED' | 'REVOKED' | 'EXPIRED';
  source: 'PAYMENT' | 'ADMIN' | 'MENTORSHIP' | 'IMPORT';
  accessExpiresAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
}

export interface PaymentRecord {
  id: string;
  courseId: string;
  courseTitle?: string;
  amount: number;
  currency: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'PARTIALLY_REFUNDED' | 'REFUNDED';
  completedAt?: string | null;
  hasAccess?: boolean;
}

export interface VideoDriveLink {
  id: string;
  driveFileId: string;
  title: string;
  description?: string;
  duration?: string;
  mimeType: string;
  embedUrl: string;
  playbackUrl?: string;
  source?: 'GOOGLE_DRIVE' | 'EXTERNAL_URL' | 'DEMO';
  order: number;
}

export interface Module {
  id: string;
  title: string;
  description?: string;
  order: number;
  videos: VideoDriveLink[];
  resources?: CourseResource[];
}

export interface Course {
  id: string;
  title: string;
  description: string;
  price: number;
  currency?: string;
  published: boolean;
  publishedAt?: string | null;
  isDemo?: boolean;
  category: string;
  coverImage: string;
  modules: Module[];
  resources?: CourseResource[];
  hasAccess?: boolean;
  userRole?: UserRole;
  requiresPaywall?: boolean;
}

export interface MentorshipComment {
  id: string;
  videoId: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  userAvatar?: string;
  content: string;
  isMentorResponse: boolean;
  isResolved: boolean;
  likes: number;
  createdAt: string;
  replies?: MentorshipComment[];
}

export interface DriveVideoFile {
  id: string;
  name: string;
  mimeType: string;
  thumbnailLink?: string;
  webContentLink?: string;
  webViewLink?: string;
  embedUrl: string;
  duration?: string;
  size?: string;
  createdTime?: string;
}

export interface CourseAccessStatus {
  courseId: string;
  userRole: UserRole;
  hasAccess: boolean;
  isVipOrAdmin: boolean;
  hasPaid: boolean;
  priceUSD: number;
}

export interface TTSGuide {
  id: string;
  courseId: string;
  moduleId?: string;
  videoId?: string;
  title: string;
  scriptText: string;
  voiceId: string;
  voiceSpeed: number;
  mentorName: string;
  avatarUrl?: string;
  xpReward: number;
  createdAt: string;
}

export interface LandingTestimonial {
  id: string;
  name: string;
  role: string;
  avatarUrl: string;
  comment: string;
  rating: number;
}

export interface LandingBenefit {
  id: string;
  icon: string;
  title: string;
  description: string;
}

export interface LandingConfig {
  heroTitle: string;
  heroSubtitle: string;
  heroMediaUrl: string;
  heroCtaText: string;
  heroCtaLink: string;
  heroSecondaryCtaText: string;
  heroSecondaryCtaLink: string;
  featuredCourseIds: string[];
  bannerEnabled: boolean;
  bannerText: string;
  bannerLinkText: string;
  bannerLinkUrl: string;
  benefits: LandingBenefit[];
  testimonials: LandingTestimonial[];
  footerText: string;
  githubUrl: string;
  discordUrl: string;
  twitterUrl: string;
  linkedinUrl: string;
}

export interface VideoNote {
  id: string;
  videoId: string;
  userId: string;
  timestampSeconds: number;
  content: string;
  createdAt: string;
}


