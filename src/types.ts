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

export interface VideoDriveLink {
  id: string;
  driveFileId: string;
  title: string;
  description?: string;
  duration?: string;
  mimeType: string;
  embedUrl: string;
  order: number;
}

export interface Module {
  id: string;
  title: string;
  description?: string;
  order: number;
  videos: VideoDriveLink[];
}

export interface Course {
  id: string;
  title: string;
  description: string;
  price: number;
  published: boolean;
  category: string;
  coverImage: string;
  modules: Module[];
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


