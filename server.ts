/**
 * DocentOS API server.
 *
 * PostgreSQL is the source of truth for application data and authenticated
 * sessions. Every request resolves its own user from an opaque session cookie.
 */

import 'dotenv/config';
import express, { NextFunction, Request, Response } from 'express';
import path from 'path';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import {
  AuthenticatedUser,
  requireAuthenticated,
  requireRole,
  UserRole,
} from './server/authMiddleware.js';
import {
  clearSessionCookie,
  createPasswordResetToken,
  createUserSession,
  hashPassword,
  hashSessionToken,
  recordAuditEvent,
  requireSameOrigin,
  resolveRequestSession,
  revokeAllUserSessions,
  revokeRequestSession,
  setSessionCookie,
  verifyPassword,
} from './server/authService.js';
import { searchDriveVideos, getDriveFileInfo } from './server/driveService.js';
import { createSetupGuard } from './server/setupGuard.js';
import { sendTelemetryCallHome } from './server/telemetryService.js';
import { prisma } from './server/prisma.js';
import {
  DOCENTOS_DEFAULT_EDITION,
  DOCENTOS_RELEASE_CHANNEL,
  DOCENTOS_VERSION,
} from './src/version.js';

const app = express();
const PORT = Number(process.env.PORT || 3000);
const DEFAULT_AVATAR = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80';
const ADMIN_AVATAR = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80';
const VALID_ROLES = ['ADMIN', 'MENTOR', 'MENTEE', 'PUBLIC_USER', 'VIP', 'EXTERNAL'] as const;
const DUMMY_PASSWORD_HASH = '$2b$12$ctNbBMxeBgkvW2dkZ.wCJu.3B2.bDvDg9xvBPVVBofTsF3/Fx4rTW';

function getReleaseMetadata() {
  return {
    product: 'DocentOS',
    version: DOCENTOS_VERSION,
    channel: DOCENTOS_RELEASE_CHANNEL,
    edition: process.env.DOCENTOS_EDITION?.trim() || DOCENTOS_DEFAULT_EDITION,
    revision: process.env.GIT_COMMIT_SHA?.trim() || 'development',
  };
}

type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

const asyncRoute = (handler: AsyncHandler) => (req: Request, res: Response, next: NextFunction) => {
  void handler(req, res, next).catch(next);
};

let configuredAppName = process.env.VITE_APP_NAME || 'DocentOS';

function toRuntimeUser(user: any): AuthenticatedUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role as UserRole,
    avatarUrl: user.avatarUrl,
    strikes: user.strikes,
    isActive: user.isActive,
  };
}

function parseJsonArray(value: string): any[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parsePlugin(plugin: any) {
  let config: Record<string, unknown> = {};
  try {
    config = JSON.parse(plugin.configJson || '{}');
  } catch {
    config = {};
  }

  return {
    id: plugin.id,
    name: plugin.name,
    description: plugin.description,
    version: plugin.version,
    enabled: plugin.enabled,
    category: plugin.category,
    icon: plugin.icon,
    config,
  };
}

function toLandingConfig(config: any) {
  return {
    heroTitle: config.heroTitle,
    heroSubtitle: config.heroSubtitle,
    heroMediaUrl: config.heroMediaUrl,
    heroCtaText: config.heroCtaText,
    heroCtaLink: config.heroCtaLink,
    heroSecondaryCtaText: config.heroSecondaryCtaText,
    heroSecondaryCtaLink: config.heroSecondaryCtaLink,
    featuredCourseIds: parseJsonArray(config.featuredCourseIds),
    bannerEnabled: config.bannerEnabled,
    bannerText: config.bannerText,
    bannerLinkText: config.bannerLinkText,
    bannerLinkUrl: config.bannerLinkUrl,
    benefits: parseJsonArray(config.benefitsJson),
    testimonials: parseJsonArray(config.testimonialsJson),
    footerText: config.footerText,
    githubUrl: config.githubUrl,
    discordUrl: config.discordUrl,
    twitterUrl: config.twitterUrl,
    linkedinUrl: config.linkedinUrl,
  };
}

function toApiComment(comment: any): any {
  return {
    id: comment.id,
    videoId: comment.videoId,
    userId: comment.userId,
    userName: comment.user?.name || 'Usuario DocentOS',
    userRole: comment.user?.role || 'PUBLIC_USER',
    userAvatar: comment.user?.avatarUrl || DEFAULT_AVATAR,
    content: comment.content,
    isMentorResponse: comment.isMentorResponse,
    isResolved: comment.isResolved,
    likes: comment.likes,
    createdAt: comment.createdAt.toISOString(),
    replies: (comment.replies || []).map(toApiComment),
  };
}

function hasRoleAccess(role: UserRole) {
  return ['ADMIN', 'MENTOR', 'MENTEE', 'VIP'].includes(role);
}

async function userHasCourseAccess(user: AuthenticatedUser | undefined, courseId: string) {
  if (!user) return false;
  if (hasRoleAccess(user.role)) return true;

  const payment = await prisma.payment.findFirst({
    where: { userId: user.id, courseId, status: 'COMPLETED' },
    select: { id: true },
  });
  return Boolean(payment);
}

async function userHasVideoAccess(user: AuthenticatedUser | undefined, videoId: string) {
  if (!user) return false;
  const video = await prisma.videoDriveLink.findUnique({
    where: { id: videoId },
    select: { module: { select: { courseId: true } } },
  });
  if (!video) return false;
  return userHasCourseAccess(user, video.module.courseId);
}

function hideProtectedCourseContent(course: any, hasAccess: boolean) {
  if (hasAccess) return course;
  return {
    ...course,
    modules: (course.modules || []).map((module: any) => ({
      ...module,
      videos: [],
    })),
  };
}

async function getLandingRecord() {
  return prisma.landingConfig.upsert({
    where: { id: 'singleton' },
    update: {},
    create: { id: 'singleton' },
  });
}

const loginSchema = z.object({
  email: z.string().email('Formato de email inválido').max(255),
  password: z.string().min(1, 'La contraseña es obligatoria').max(128),
});

const registerSchema = z.object({
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').max(100),
  email: z.string().email('Formato de email inválido').max(255),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres').max(128),
});

const forgotPasswordSchema = z.object({
  email: z.string().email('Formato de email inválido').max(255),
});

const resetPasswordSchema = z.object({
  token: z.string().min(32, 'Token de recuperación inválido').max(256),
  newPassword: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres').max(128),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'La contraseña actual es obligatoria').max(128),
  newPassword: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres').max(128),
});

function redirectPathForRole(role: UserRole) {
  if (role === 'ADMIN') return '/admin';
  if (role === 'MENTOR') return '/mentor/dashboard';
  return '/courses';
}

function passwordResetBaseUrl(req: Request) {
  const configuredUrl = process.env.APP_URL?.trim();
  if (configuredUrl?.startsWith('http') && configuredUrl !== 'MY_APP_URL') {
    return configuredUrl.replace(/\/$/, '');
  }
  return `${req.protocol}://${req.get('host') || `localhost:${PORT}`}`;
}

async function deliverPasswordReset(
  req: Request,
  user: { email: string; name: string },
  token: string,
  expiresAt: Date,
) {
  const resetUrl = `${passwordResetBaseUrl(req)}/?resetToken=${encodeURIComponent(token)}`;
  const webhookUrl = process.env.PASSWORD_RESET_WEBHOOK_URL?.trim();

  if (webhookUrl?.startsWith('http')) {
    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(process.env.PASSWORD_RESET_WEBHOOK_TOKEN
            ? { Authorization: `Bearer ${process.env.PASSWORD_RESET_WEBHOOK_TOKEN}` }
            : {}),
        },
        body: JSON.stringify({
          event: 'password_reset_requested',
          recipient: { email: user.email, name: user.name },
          resetUrl,
          expiresAt: expiresAt.toISOString(),
        }),
      });
      if (!response.ok) console.warn(`Webhook de recuperación respondió HTTP ${response.status}.`);
    } catch (error) {
      console.warn('No se pudo entregar el enlace de recuperación:', error);
    }
  }

  const exposeLocalToken = process.env.PASSWORD_RESET_EXPOSE_TOKEN === 'true';
  return exposeLocalToken ? { resetToken: token, resetUrl } : {};
}

app.set('trust proxy', 1);
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }),
);
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGIN || '*',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  }),
);
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});
app.use(express.json({ limit: '5mb' }));
app.use('/api', requireSameOrigin);

const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false, trustProxy: false },
  message: { success: false, error: 'Demasiados intentos de autenticación. Por seguridad, reintenta en 15 minutos.' },
});

const passwordResetRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false, trustProxy: false },
  message: { success: false, error: 'Demasiadas solicitudes de recuperación. Reintenta en 15 minutos.' },
});

const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false, trustProxy: false },
  message: { success: false, error: 'Límite de solicitudes de la API alcanzado. Intenta de nuevo más tarde.' },
});

app.use('/api/auth/login', authRateLimiter);
app.use('/api/auth/register', authRateLimiter);
app.use('/api/auth/password/forgot', passwordResetRateLimiter);
app.use('/api/auth/password/reset', passwordResetRateLimiter);
app.use('/api/', apiRateLimiter);

// Database health and first-run setup
app.get('/api/version', (_req, res) => {
  res.json(getReleaseMetadata());
});

app.get(
  '/api/health',
  asyncRoute(async (_req, res) => {
    await prisma.$queryRaw`SELECT 1`;
    const [users, courses] = await Promise.all([prisma.user.count(), prisma.course.count()]);
    res.json({
      status: 'ok',
      database: 'postgresql',
      connected: true,
      users,
      courses,
      ...getReleaseMetadata(),
    });
  }),
);

app.get(
  '/api/setup/status',
  asyncRoute(async (_req, res) => {
    const userCount = await prisma.user.count();
    res.json({ isSetupRequired: userCount === 0, userCount, appName: configuredAppName });
  }),
);

app.post(
  '/api/setup',
  asyncRoute(async (req, res) => {
    const { name, email, password, appName, consentTelemetry } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Nombre, email y contraseña son obligatorios' });
    }
    if (String(password).length < 8 || String(password).length > 128) {
      return res.status(400).json({ error: 'La contraseña debe tener entre 8 y 128 caracteres.' });
    }

    const existingAdmin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
    if (existingAdmin) {
      return res.status(400).json({
        error: `Regla de Administrador Único: Ya existe un Administrador registrado (${existingAdmin.email}).`,
      });
    }

    configuredAppName = appName || configuredAppName;
    const normalizedEmail = String(email).trim().toLowerCase();
    const passwordHash = await hashPassword(String(password));
    const newAdminUser = await prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        name: String(name).trim(),
        role: 'ADMIN',
        avatarUrl: ADMIN_AVATAR,
      },
    });
    const { token } = await createUserSession(newAdminUser.id, req);
    setSessionCookie(res, token);
    await recordAuditEvent(req, {
      actorUserId: newAdminUser.id,
      action: 'setup.admin_created',
      targetType: 'User',
      targetId: newAdminUser.id,
    });

    const telemetryResult =
      consentTelemetry === true
        ? await sendTelemetryCallHome({
            adminEmail: normalizedEmail,
            adminName: String(name).trim(),
            appName: configuredAppName,
            consentTelemetry: true,
          })
        : { success: true, message: 'Telemetría no autorizada; no se enviaron datos.' };

    res.json({
      success: true,
      message: '¡Instalación inicial completada con éxito! Usuario Administrador registrado.',
      user: toRuntimeUser(newAdminUser),
      appName: configuredAppName,
      telemetry: telemetryResult,
    });
  }),
);

app.use(createSetupGuard(() => prisma.user.count()));

// Resolve an optional, independent user session for every API request.
app.use(
  '/api',
  asyncRoute(async (req, _res, next) => {
    const authentication = await resolveRequestSession(req);
    if (authentication) {
      req.user = authentication.user;
      req.authSession = authentication.session;
    }
    next();
  }),
);

// Users and current session
app.get(
  '/api/me',
  requireAuthenticated,
  asyncRoute(async (req, res) => {
    const payment = await prisma.payment.findFirst({
      where: { userId: req.user!.id, courseId: 'course-giantucchi-mastery', status: 'COMPLETED' },
    });
    res.json({
      authenticated: true,
      user: req.user,
      hasPaidDefaultCourse: Boolean(payment),
    });
  }),
);

// Courses, access and payments
app.get(
  '/api/courses',
  asyncRoute(async (req, res) => {
    const user = req.user;
    const viewerRole: UserRole = user?.role || 'PUBLIC_USER';
    const [courses, payments] = await Promise.all([
      prisma.course.findMany({
        where: { published: true },
        include: { modules: { orderBy: { order: 'asc' }, include: { videos: { orderBy: { order: 'asc' } } } } },
        orderBy: { createdAt: 'asc' },
      }),
      user
        ? prisma.payment.findMany({ where: { userId: user.id, status: 'COMPLETED' }, select: { courseId: true } })
        : Promise.resolve([]),
    ]);
    const paidCourseIds = new Set(payments.map((payment) => payment.courseId));
    const roleAccess = Boolean(user && hasRoleAccess(user.role));
    const formattedCourses = courses.map((course) => {
      const hasAccess = roleAccess || paidCourseIds.has(course.id);
      return {
        ...hideProtectedCourseContent(course, hasAccess),
        hasAccess,
        userRole: viewerRole,
        requiresPaywall: !hasAccess,
      };
    });
    res.json({ courses: formattedCourses, userRole: viewerRole, hasAccess: roleAccess || paidCourseIds.size > 0 });
  }),
);

app.get(
  '/api/courses/:courseId',
  asyncRoute(async (req, res) => {
    const course = await prisma.course.findUnique({
      where: { id: req.params.courseId },
      include: { modules: { orderBy: { order: 'asc' }, include: { videos: { orderBy: { order: 'asc' } } } } },
    });
    if (!course) return res.status(404).json({ error: 'Curso no encontrado' });

    const viewerRole: UserRole = req.user?.role || 'PUBLIC_USER';
    const hasAccess = await userHasCourseAccess(req.user, course.id);
    res.json({
      course: hideProtectedCourseContent(course, hasAccess),
      hasAccess,
      userRole: viewerRole,
      requiresPaywall: !hasAccess,
    });
  }),
);

app.get(
  '/api/courses/:courseId/access',
  asyncRoute(async (req, res) => {
    const user = req.user;
    const payment = user
      ? await prisma.payment.findFirst({
          where: { userId: user.id, courseId: req.params.courseId, status: 'COMPLETED' },
        })
      : null;
    const isVipOrAdmin = Boolean(user && hasRoleAccess(user.role));
    const hasPaid = Boolean(user && payment);
    res.json({
      courseId: req.params.courseId,
      userRole: user?.role || 'PUBLIC_USER',
      hasAccess: isVipOrAdmin || hasPaid,
      isVipOrAdmin,
      hasPaid,
      priceUSD: 149,
    });
  }),
);

app.post(
  '/api/payments/checkout',
  requireAuthenticated,
  asyncRoute(async (req, res) => {
    const courseId = req.body.courseId || 'course-giantucchi-mastery';
    const course = await prisma.course.findUnique({ where: { id: courseId } });
    if (!course) return res.status(404).json({ error: 'Curso no encontrado' });

    const stripeSessionId = `cs_test_${Math.random().toString(36).substring(2)}`;
    const payment = await prisma.payment.create({
      data: {
        userId: req.user!.id,
        courseId,
        amount: course.price,
        status: 'COMPLETED',
        stripeSessionId,
      },
    });
    res.json({ success: true, message: '¡Pago procesado con éxito! Tienes acceso ilimitado al curso.', payment });
  }),
);

app.post(
  '/api/vip/activate',
  requireAuthenticated,
  (_req, res) =>
    res.status(501).json({
      error: 'La activación VIP directa está deshabilitada hasta integrar un pago verificado.',
    }),
);

// Google Drive integration
app.get(
  '/api/drive/videos',
  requireRole(['ADMIN', 'MENTOR']),
  asyncRoute(async (req, res) => {
    const videos = await searchDriveVideos(req.query.q as string, req.query.folderId as string);
    res.json({ success: true, count: videos.length, videos });
  }),
);

app.get(
  '/api/drive/file/:fileId',
  requireRole(['ADMIN', 'MENTOR']),
  asyncRoute(async (req, res) => {
    const fileInfo = await getDriveFileInfo(req.params.fileId);
    res.json({ success: true, file: fileInfo });
  }),
);

// Mentorship comments
app.get(
  '/api/videos/:videoId/comments',
  requireAuthenticated,
  asyncRoute(async (req, res) => {
    if (!(await userHasVideoAccess(req.user, req.params.videoId))) {
      return res.status(403).json({ error: 'No tienes acceso a este contenido.' });
    }
    const comments = await prisma.mentorshipComment.findMany({
      where: { videoId: req.params.videoId, parentId: null },
      include: {
        user: true,
        replies: { include: { user: true }, orderBy: { createdAt: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ comments: comments.map(toApiComment) });
  }),
);

app.post(
  '/api/videos/:videoId/comments',
  requireAuthenticated,
  asyncRoute(async (req, res) => {
    if (!(await userHasVideoAccess(req.user, req.params.videoId))) {
      return res.status(403).json({ error: 'No tienes acceso a este contenido.' });
    }
    const content = String(req.body.content || '').trim();
    if (!content) return res.status(400).json({ error: 'El contenido del comentario es obligatorio' });

    const comment = await prisma.mentorshipComment.create({
      data: {
        videoId: req.params.videoId,
        userId: req.user!.id,
        content,
        isMentorResponse: ['ADMIN', 'MENTOR'].includes(req.user!.role),
      },
      include: { user: true, replies: { include: { user: true } } },
    });
    res.json({ success: true, comment: toApiComment(comment) });
  }),
);

app.post(
  '/api/comments/:commentId/reply',
  requireAuthenticated,
  asyncRoute(async (req, res) => {
    const content = String(req.body.content || '').trim();
    if (!content) return res.status(400).json({ error: 'El contenido de la respuesta es obligatorio' });

    const parent = await prisma.mentorshipComment.findUnique({ where: { id: req.params.commentId } });
    if (!parent) return res.status(404).json({ error: 'Comentario original no encontrado' });
    if (!(await userHasVideoAccess(req.user, parent.videoId))) {
      return res.status(403).json({ error: 'No tienes acceso a este contenido.' });
    }

    const isMentor = ['ADMIN', 'MENTOR'].includes(req.user!.role);
    const reply = await prisma.mentorshipComment.create({
      data: {
        videoId: parent.videoId,
        userId: req.user!.id,
        parentId: parent.id,
        content,
        isMentorResponse: isMentor,
        isResolved: isMentor,
        likes: isMentor ? 1 : 0,
      },
      include: { user: true, replies: { include: { user: true } } },
    });
    if (isMentor) {
      await prisma.mentorshipComment.update({ where: { id: parent.id }, data: { isResolved: true } });
    }
    res.json({ success: true, reply: toApiComment(reply) });
  }),
);

app.post(
  '/api/comments/:commentId/like',
  requireAuthenticated,
  asyncRoute(async (req, res) => {
    const existing = await prisma.mentorshipComment.findUnique({ where: { id: req.params.commentId } });
    if (!existing) return res.status(404).json({ error: 'Comentario no encontrado' });
    if (!(await userHasVideoAccess(req.user, existing.videoId))) {
      return res.status(403).json({ error: 'No tienes acceso a este contenido.' });
    }
    const comment = await prisma.mentorshipComment.update({
      where: { id: existing.id },
      data: { likes: { increment: 1 } },
    });
    res.json({ success: true, likes: comment.likes });
  }),
);

// Progress and notes
app.get(
  '/api/progress',
  requireAuthenticated,
  asyncRoute(async (req, res) => {
    const progress = await prisma.userProgress.findMany({ where: { userId: req.user!.id, completed: true } });
    const completedVideos = Object.fromEntries(progress.map((item) => [item.videoId, true]));
    res.json({ success: true, completedVideos });
  }),
);

app.post(
  '/api/progress',
  requireAuthenticated,
  asyncRoute(async (req, res) => {
    const { videoId, completed } = req.body;
    if (!videoId) return res.status(400).json({ error: 'videoId es requerido' });
    if (!(await userHasVideoAccess(req.user, videoId))) {
      return res.status(403).json({ error: 'No tienes acceso a este contenido.' });
    }

    if (completed === false) {
      await prisma.userProgress.deleteMany({ where: { userId: req.user!.id, videoId } });
    } else {
      await prisma.userProgress.upsert({
        where: { userId_videoId: { userId: req.user!.id, videoId } },
        update: { completed: true, completedAt: new Date() },
        create: { userId: req.user!.id, videoId, completed: true },
      });
    }
    res.json({ success: true, videoId, completed: completed !== false });
  }),
);

app.get(
  '/api/notes/:videoId',
  requireAuthenticated,
  asyncRoute(async (req, res) => {
    if (!(await userHasVideoAccess(req.user, req.params.videoId))) {
      return res.status(403).json({ error: 'No tienes acceso a este contenido.' });
    }
    const notes = await prisma.videoNote.findMany({
      where: { videoId: req.params.videoId, userId: req.user!.id },
      include: { user: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json({
      success: true,
      notes: notes.map((note) => ({
        id: note.id,
        videoId: note.videoId,
        userId: note.userId,
        userName: note.user.name,
        timestampSeconds: note.timestampSeconds,
        content: note.content,
        createdAt: note.createdAt.toISOString(),
      })),
    });
  }),
);

app.post(
  '/api/notes',
  requireAuthenticated,
  asyncRoute(async (req, res) => {
    const { videoId, timestampSeconds, content } = req.body;
    if (!videoId || !String(content || '').trim()) {
      return res.status(400).json({ error: 'videoId y content son obligatorios' });
    }
    if (!(await userHasVideoAccess(req.user, videoId))) {
      return res.status(403).json({ error: 'No tienes acceso a este contenido.' });
    }
    const note = await prisma.videoNote.create({
      data: {
        videoId,
        userId: req.user!.id,
        timestampSeconds: Number(timestampSeconds) || 0,
        content: String(content).trim(),
      },
      include: { user: true },
    });
    res.json({
      success: true,
      note: {
        id: note.id,
        videoId: note.videoId,
        userId: note.userId,
        userName: note.user.name,
        timestampSeconds: note.timestampSeconds,
        content: note.content,
        createdAt: note.createdAt.toISOString(),
      },
    });
  }),
);

// Admin operations
app.put(
  '/api/admin/users/:userId/moderation',
  requireRole(['ADMIN']),
  asyncRoute(async (req, res) => {
    const data: { strikes?: number; isActive?: boolean } = {};
    if (typeof req.body.strikes === 'number') data.strikes = req.body.strikes;
    if (typeof req.body.isActive === 'boolean') data.isActive = req.body.isActive;
    const existing = await prisma.user.findUnique({ where: { id: req.params.userId } });
    if (!existing) return res.status(404).json({ error: 'Usuario no encontrado' });
    if (existing.role === 'ADMIN' && data.isActive === false) {
      return res.status(400).json({ error: 'El Administrador único no puede desactivar su propia cuenta.' });
    }
    const user = await prisma.user.update({ where: { id: existing.id }, data });
    if (data.isActive === false) await revokeAllUserSessions(user.id);
    await recordAuditEvent(req, {
      action: 'user.moderation_updated',
      targetType: 'User',
      targetId: user.id,
      metadata: {
        previousStrikes: existing.strikes,
        strikes: user.strikes,
        previousIsActive: existing.isActive,
        isActive: user.isActive,
      },
    });
    res.json({ success: true, user: toRuntimeUser(user) });
  }),
);

app.put(
  '/api/courses/:courseId/price',
  requireRole(['ADMIN']),
  asyncRoute(async (req, res) => {
    const existing = await prisma.course.findUnique({ where: { id: req.params.courseId } });
    if (!existing) return res.status(404).json({ error: 'Curso no encontrado' });
    const course = await prisma.course.update({
      where: { id: existing.id },
      data: { price: Number(req.body.price) || 0 },
    });
    res.json({ success: true, course });
  }),
);

// Authentication backed by password hashes and independent persistent sessions.
app.post(
  '/api/auth/login',
  asyncRoute(async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Error de validación de entrada',
        details: parsed.error.issues.map((issue) => issue.message),
      });
    }

    const email = parsed.data.email.toLowerCase();
    const user = await prisma.user.findUnique({ where: { email } });
    const passwordMatches = await verifyPassword(
      parsed.data.password,
      user?.passwordHash || DUMMY_PASSWORD_HASH,
    );

    if (!user || !user.passwordHash || !passwordMatches) {
      return res.status(401).json({ error: 'Correo o contraseña incorrectos.' });
    }

    if (!user.isActive) return res.status(403).json({ error: 'La cuenta se encuentra desactivada.' });
    await revokeRequestSession(req);
    const { token } = await createUserSession(user.id, req);
    setSessionCookie(res, token);
    await recordAuditEvent(req, {
      actorUserId: user.id,
      action: 'auth.login_succeeded',
      targetType: 'User',
      targetId: user.id,
    });

    res.json({
      success: true,
      user: toRuntimeUser(user),
      redirectPath: redirectPathForRole(user.role),
    });
  }),
);

app.post(
  '/api/auth/register',
  asyncRoute(async (req, res) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Error de validación de entrada',
        details: parsed.error.issues.map((issue) => issue.message),
      });
    }

    const { name, password } = parsed.data;
    const email = parsed.data.email.toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(400).json({ error: 'El email ya se encuentra registrado. Inicia sesión.' });

    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: { name, email, passwordHash, role: 'PUBLIC_USER', avatarUrl: DEFAULT_AVATAR },
    });
    await revokeRequestSession(req);
    const { token } = await createUserSession(user.id, req);
    setSessionCookie(res, token);
    await recordAuditEvent(req, {
      actorUserId: user.id,
      action: 'auth.user_registered',
      targetType: 'User',
      targetId: user.id,
      metadata: { role: user.role },
    });

    res.json({
      success: true,
      user: toRuntimeUser(user),
      redirectPath: '/courses',
    });
  }),
);

app.get('/api/auth/me', (req, res) => {
  if (!req.user || !req.authSession) {
    return res.json({ authenticated: false, user: null, hasAccess: false });
  }
  res.json({
    authenticated: true,
    user: req.user,
    hasAccess: hasRoleAccess(req.user.role),
    sessionExpiresAt: req.authSession.expiresAt,
  });
});

app.post(
  '/api/auth/logout',
  asyncRoute(async (req, res) => {
    if (req.user) {
      await recordAuditEvent(req, {
        action: 'auth.logout',
        targetType: 'Session',
        targetId: req.authSession?.id,
      });
    }
    await revokeRequestSession(req);
    clearSessionCookie(res);
    res.json({ success: true, message: 'Sesión cerrada correctamente' });
  }),
);

app.post(
  '/api/auth/password/forgot',
  asyncRoute(async (req, res) => {
    const parsed = forgotPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Error de validación de entrada',
        details: parsed.error.issues.map((issue) => issue.message),
      });
    }

    const user = await prisma.user.findUnique({
      where: { email: parsed.data.email.toLowerCase() },
      select: { id: true, email: true, name: true, isActive: true },
    });
    let developmentReset: { resetToken?: string; resetUrl?: string } = {};

    if (user?.isActive) {
      const { token, expiresAt } = await createPasswordResetToken(user.id);
      developmentReset = await deliverPasswordReset(req, user, token, expiresAt);
      await recordAuditEvent(req, {
        actorUserId: user.id,
        action: 'auth.password_reset_requested',
        targetType: 'User',
        targetId: user.id,
      });
    }

    res.json({
      success: true,
      message: 'Si la cuenta existe, se enviaron las instrucciones para restablecer la contraseña.',
      ...developmentReset,
    });
  }),
);

app.post(
  '/api/auth/password/reset',
  asyncRoute(async (req, res) => {
    const parsed = resetPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Error de validación de entrada',
        details: parsed.error.issues.map((issue) => issue.message),
      });
    }

    const tokenRecord = await prisma.passwordResetToken.findUnique({
      where: { tokenHash: hashSessionToken(parsed.data.token) },
      include: { user: true },
    });
    if (!tokenRecord || tokenRecord.usedAt || tokenRecord.expiresAt <= new Date() || !tokenRecord.user.isActive) {
      return res.status(400).json({ error: 'El enlace de recuperación es inválido o ha expirado.' });
    }

    const passwordHash = await hashPassword(parsed.data.newPassword);
    const changedAt = new Date();
    const passwordChanged = await prisma.$transaction(async (tx) => {
      const consumed = await tx.passwordResetToken.updateMany({
        where: { id: tokenRecord.id, usedAt: null, expiresAt: { gt: changedAt } },
        data: { usedAt: changedAt },
      });
      if (consumed.count !== 1) return false;

      await tx.user.update({ where: { id: tokenRecord.userId }, data: { passwordHash } });
      await tx.session.updateMany({
        where: { userId: tokenRecord.userId, revokedAt: null },
        data: { revokedAt: changedAt },
      });
      return true;
    });

    if (!passwordChanged) {
      return res.status(400).json({ error: 'El enlace de recuperación ya fue utilizado.' });
    }
    clearSessionCookie(res);
    await recordAuditEvent(req, {
      actorUserId: tokenRecord.userId,
      action: 'auth.password_reset_completed',
      targetType: 'User',
      targetId: tokenRecord.userId,
    });
    res.json({ success: true, message: 'Contraseña actualizada. Inicia sesión con tu nueva contraseña.' });
  }),
);

app.put(
  '/api/auth/password',
  requireAuthenticated,
  asyncRoute(async (req, res) => {
    const parsed = changePasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Error de validación de entrada',
        details: parsed.error.issues.map((issue) => issue.message),
      });
    }

    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user?.passwordHash || !(await verifyPassword(parsed.data.currentPassword, user.passwordHash))) {
      return res.status(401).json({ error: 'La contraseña actual es incorrecta.' });
    }
    if (await verifyPassword(parsed.data.newPassword, user.passwordHash)) {
      return res.status(400).json({ error: 'La nueva contraseña debe ser diferente de la actual.' });
    }

    const passwordHash = await hashPassword(parsed.data.newPassword);
    const changedAt = new Date();
    await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { passwordHash } }),
      prisma.session.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: changedAt },
      }),
      prisma.passwordResetToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: changedAt },
      }),
    ]);
    await recordAuditEvent(req, {
      actorUserId: user.id,
      action: 'auth.password_changed',
      targetType: 'User',
      targetId: user.id,
    });
    clearSessionCookie(res);
    res.json({
      success: true,
      requiresLogin: true,
      message: 'Contraseña actualizada. Se cerraron todas las sesiones por seguridad.',
    });
  }),
);

// Plugins
app.get(
  '/api/plugins',
  requireRole(['ADMIN', 'MENTOR']),
  asyncRoute(async (_req, res) => {
    const plugins = await prisma.plugin.findMany({ orderBy: { createdAt: 'asc' } });
    res.json({ success: true, plugins: plugins.map(parsePlugin) });
  }),
);

app.post(
  '/api/plugins/toggle',
  requireRole(['ADMIN']),
  asyncRoute(async (req, res) => {
    const plugin = await prisma.plugin.findUnique({ where: { id: req.body.pluginId } });
    if (!plugin) return res.status(404).json({ error: 'Plugin no encontrado' });
    const updated = await prisma.plugin.update({
      where: { id: plugin.id },
      data: { enabled: req.body.enabled !== undefined ? Boolean(req.body.enabled) : !plugin.enabled },
    });
    const plugins = await prisma.plugin.findMany({ orderBy: { createdAt: 'asc' } });
    res.json({ success: true, plugin: parsePlugin(updated), plugins: plugins.map(parsePlugin) });
  }),
);

app.post(
  '/api/plugins/config',
  requireRole(['ADMIN']),
  asyncRoute(async (req, res) => {
    const plugin = await prisma.plugin.findUnique({ where: { id: req.body.pluginId } });
    if (!plugin) return res.status(404).json({ error: 'Plugin no encontrado' });
    const mergedConfig = { ...parsePlugin(plugin).config, ...(req.body.config || {}) };
    const updated = await prisma.plugin.update({
      where: { id: plugin.id },
      data: { configJson: JSON.stringify(mergedConfig) },
    });
    const plugins = await prisma.plugin.findMany({ orderBy: { createdAt: 'asc' } });
    res.json({ success: true, plugin: parsePlugin(updated), plugins: plugins.map(parsePlugin) });
  }),
);

// Mentor dashboard
app.get(
  '/api/mentor/mentees',
  requireRole(['ADMIN', 'MENTOR']),
  asyncRoute(async (req, res) => {
    const assignments = await prisma.menteeAssignment.findMany({
      where: req.user!.role === 'MENTOR' ? { mentorId: req.user!.id } : undefined,
      include: { mentee: true },
      orderBy: { createdAt: 'asc' },
    });
    const mentees = assignments.map((assignment) => ({
      id: assignment.mentee.id,
      name: assignment.mentee.name,
      email: assignment.mentee.email,
      avatarUrl: assignment.mentee.avatarUrl,
      assignedMentorId: assignment.mentorId,
      courseProgress: assignment.courseProgress,
      completedVideosCount: assignment.completedVideosCount,
      totalVideosCount: assignment.totalVideosCount,
      lastActiveDate: assignment.lastActiveDate,
      status: assignment.status,
      strikes: assignment.mentee.strikes,
      isActive: assignment.mentee.isActive,
    }));
    res.json({ success: true, mentees });
  }),
);

app.post(
  '/api/mentor/assign-mentee',
  requireRole(['ADMIN', 'MENTOR']),
  asyncRoute(async (req, res) => {
    const { name, mentorId } = req.body;
    const email = String(req.body.email || '').toLowerCase();
    if (!name || !email) return res.status(400).json({ error: 'Nombre y email son requeridos' });

    const assignedMentorId = req.user!.role === 'MENTOR' ? req.user!.id : mentorId;
    const mentor = await prisma.user.findFirst({
      where: assignedMentorId
        ? { id: assignedMentorId, role: { in: ['ADMIN', 'MENTOR'] }, isActive: true }
        : { role: { in: ['ADMIN', 'MENTOR'] }, isActive: true },
      orderBy: { createdAt: 'asc' },
    });
    const course = await prisma.course.findFirst({ where: { published: true }, orderBy: { createdAt: 'asc' } });
    if (!mentor || !course) return res.status(400).json({ error: 'No existe mentor o curso disponible para la asignación.' });

    const existingMentee = await prisma.user.findUnique({ where: { email } });
    if (existingMentee && ['ADMIN', 'MENTOR'].includes(existingMentee.role)) {
      return res.status(409).json({
        error: 'Una cuenta administrativa o de mentor no puede reasignarse como mentee.',
      });
    }
    if (existingMentee && !existingMentee.isActive) {
      return res.status(409).json({ error: 'La cuenta indicada está desactivada.' });
    }
    const mentee = existingMentee
      ? await prisma.user.update({ where: { id: existingMentee.id }, data: { name, role: 'MENTEE' } })
      : await prisma.user.create({ data: { name, email, role: 'MENTEE', avatarUrl: DEFAULT_AVATAR } });
    const totalVideosCount = await prisma.videoDriveLink.count({ where: { module: { courseId: course.id } } });
    const assignment = await prisma.menteeAssignment.upsert({
      where: { menteeId_courseId: { menteeId: mentee.id, courseId: course.id } },
      update: { mentorId: mentor.id },
      create: { menteeId: mentee.id, mentorId: mentor.id, courseId: course.id, totalVideosCount },
    });
    res.json({
      success: true,
      mentee: {
        ...toRuntimeUser(mentee),
        assignedMentorId: assignment.mentorId,
        courseProgress: assignment.courseProgress,
        completedVideosCount: assignment.completedVideosCount,
        totalVideosCount: assignment.totalVideosCount,
        lastActiveDate: assignment.lastActiveDate,
        status: assignment.status,
      },
    });
  }),
);

app.get(
  '/api/mentor/qna',
  requireRole(['ADMIN', 'MENTOR']),
  asyncRoute(async (_req, res) => {
    const comments = await prisma.mentorshipComment.findMany({
      where: { parentId: null },
      include: { user: true, replies: { include: { user: true }, orderBy: { createdAt: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, comments: comments.map(toApiComment) });
  }),
);

app.get(
  '/api/admin/users',
  requireRole(['ADMIN']),
  asyncRoute(async (_req, res) => {
    const users = await prisma.user.findMany({ orderBy: { createdAt: 'asc' } });
    res.json({ users: users.map(toRuntimeUser) });
  }),
);

app.get(
  '/api/admin/audit-logs',
  requireRole(['ADMIN']),
  asyncRoute(async (req, res) => {
    const requestedLimit = Number(req.query.limit || 50);
    const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 100) : 50;
    const action = typeof req.query.action === 'string' ? req.query.action.trim() : '';
    const logs = await prisma.auditLog.findMany({
      where: action ? { action } : undefined,
      include: { actor: { select: { id: true, name: true, email: true, role: true } } },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    res.json({
      logs: logs.map((log) => ({
        id: log.id,
        action: log.action,
        targetType: log.targetType,
        targetId: log.targetId,
        metadata: JSON.parse(log.metadataJson || '{}'),
        ipAddress: log.ipAddress,
        userAgent: log.userAgent,
        actor: log.actor,
        createdAt: log.createdAt.toISOString(),
      })),
    });
  }),
);

app.put(
  '/api/admin/users/:userId/role',
  requireRole(['ADMIN']),
  asyncRoute(async (req, res) => {
    const role = req.body.role as UserRole;
    if (!VALID_ROLES.includes(role)) return res.status(400).json({ error: 'Rol no válido' });
    const target = await prisma.user.findUnique({ where: { id: req.params.userId } });
    if (!target) return res.status(404).json({ error: 'Usuario no encontrado' });
    if (target.role === 'ADMIN' && role !== 'ADMIN') {
      return res.status(400).json({ error: 'El Administrador único no puede perder su rol.' });
    }
    if (role === 'ADMIN' && target.role !== 'ADMIN') {
      const existingAdmin = await prisma.user.findFirst({ where: { role: 'ADMIN', id: { not: target.id } } });
      if (existingAdmin) {
        return res.status(400).json({
          error: `Regla de Administrador Único: Ya existe un Administrador activo (${existingAdmin.name} - ${existingAdmin.email}).`,
        });
      }
    }
    const user = await prisma.user.update({ where: { id: target.id }, data: { role } });
    await recordAuditEvent(req, {
      action: 'user.role_changed',
      targetType: 'User',
      targetId: user.id,
      metadata: { previousRole: target.role, role: user.role },
    });
    res.json({ success: true, user: toRuntimeUser(user) });
  }),
);

// Landing page CMS
app.get(
  '/api/public/landing-config',
  asyncRoute(async (_req, res) => {
    res.json({ success: true, config: toLandingConfig(await getLandingRecord()) });
  }),
);

app.put(
  '/api/admin/landing-config',
  requireRole(['ADMIN']),
  asyncRoute(async (req, res) => {
    if (!req.body || typeof req.body !== 'object') return res.status(400).json({ error: 'Configuración no válida' });
    const current = toLandingConfig(await getLandingRecord());
    const merged = { ...current, ...req.body };
    const config = await prisma.landingConfig.update({
      where: { id: 'singleton' },
      data: {
        heroTitle: String(merged.heroTitle),
        heroSubtitle: String(merged.heroSubtitle),
        heroMediaUrl: String(merged.heroMediaUrl),
        heroCtaText: String(merged.heroCtaText),
        heroCtaLink: String(merged.heroCtaLink),
        heroSecondaryCtaText: String(merged.heroSecondaryCtaText),
        heroSecondaryCtaLink: String(merged.heroSecondaryCtaLink),
        featuredCourseIds: JSON.stringify(merged.featuredCourseIds || []),
        bannerEnabled: Boolean(merged.bannerEnabled),
        bannerText: String(merged.bannerText),
        bannerLinkText: String(merged.bannerLinkText),
        bannerLinkUrl: String(merged.bannerLinkUrl),
        benefitsJson: JSON.stringify(merged.benefits || []),
        testimonialsJson: JSON.stringify(merged.testimonials || []),
        footerText: String(merged.footerText),
        githubUrl: String(merged.githubUrl),
        discordUrl: String(merged.discordUrl || ''),
        twitterUrl: String(merged.twitterUrl || ''),
        linkedinUrl: String(merged.linkedinUrl || ''),
      },
    });
    res.json({
      success: true,
      config: toLandingConfig(config),
      message: '¡Configuración de la portada actualizada exitosamente!',
    });
  }),
);

app.post(
  '/api/admin/modules/:moduleId/videos',
  requireRole(['ADMIN']),
  asyncRoute(async (req, res) => {
    const targetModule = await prisma.module.findUnique({
      where: { id: req.params.moduleId },
      include: { videos: true },
    });
    if (!targetModule) return res.status(404).json({ error: 'Módulo no encontrado' });
    const driveFileId = req.body.driveFileId || `drive-${Date.now()}`;
    const video = await prisma.videoDriveLink.create({
      data: {
        moduleId: targetModule.id,
        driveFileId,
        title: req.body.title || 'Nuevo Video de Mentoría',
        duration: req.body.duration || '20:00',
        description: req.body.description || 'Video importado desde Google Drive.',
        mimeType: 'video/mp4',
        embedUrl: req.body.embedUrl || `https://drive.google.com/file/d/${driveFileId}/preview`,
        order: targetModule.videos.length + 1,
      },
    });
    const moduleWithVideos = await prisma.module.findUnique({
      where: { id: targetModule.id },
      include: { videos: { orderBy: { order: 'asc' } } },
    });
    res.json({ success: true, video, module: moduleWithVideos });
  }),
);

// TTS guides and feedback
app.get(
  '/api/tts-guides',
  requireAuthenticated,
  asyncRoute(async (req, res) => {
    if (req.query.videoId && !(await userHasVideoAccess(req.user, String(req.query.videoId)))) {
      return res.status(403).json({ error: 'No tienes acceso a este contenido.' });
    }
    if (req.query.courseId && !(await userHasCourseAccess(req.user, String(req.query.courseId)))) {
      return res.status(403).json({ error: 'No tienes acceso a este curso.' });
    }
    if (!req.query.videoId && !req.query.courseId && !['ADMIN', 'MENTOR'].includes(req.user!.role)) {
      return res.status(403).json({ error: 'Debes indicar un curso o video autorizado.' });
    }
    const where = req.query.videoId
      ? { videoId: String(req.query.videoId) }
      : req.query.courseId
        ? { courseId: String(req.query.courseId) }
        : {};
    const guides = await prisma.tTSGuide.findMany({ where, orderBy: { createdAt: 'desc' } });
    res.json({ guides: guides.map((guide) => ({ ...guide, createdAt: guide.createdAt.toISOString() })) });
  }),
);

app.post(
  '/api/tts-guides',
  requireRole(['ADMIN']),
  asyncRoute(async (req, res) => {
    const scriptText = String(req.body.scriptText || '').trim();
    if (!scriptText) return res.status(400).json({ error: 'El texto del guion de la guía es obligatorio' });
    const guide = await prisma.tTSGuide.create({
      data: {
        courseId: req.body.courseId || 'course-giantucchi-mastery',
        moduleId: req.body.moduleId || 'module-1',
        videoId: req.body.videoId || 'video-1a',
        title: req.body.title || 'Guía Gamificada de Mentoría',
        scriptText,
        voiceId: req.body.voiceId || 'es-ES-Carlos',
        voiceSpeed: Number(req.body.voiceSpeed) || 1,
        mentorName: req.user!.name || 'Prof. Giantucchi',
        avatarUrl: req.user!.avatarUrl || ADMIN_AVATAR,
        xpReward: Number(req.body.xpReward) || 50,
      },
    });
    res.json({
      success: true,
      guide: { ...guide, createdAt: guide.createdAt.toISOString() },
      message: '¡Guía de mentoría TTS generada y guardada con éxito!',
    });
  }),
);

app.delete(
  '/api/tts-guides/:id',
  requireRole(['ADMIN']),
  asyncRoute(async (req, res) => {
    const existing = await prisma.tTSGuide.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Guía no encontrada' });
    await prisma.tTSGuide.delete({ where: { id: existing.id } });
    res.json({ success: true, message: 'Guía eliminada correctamente' });
  }),
);

app.post(
  '/api/feedback',
  requireAuthenticated,
  asyncRoute(async (req, res) => {
    const feedback = await prisma.feedback.create({
      data: {
        userId: req.user!.id,
        rating: Math.min(5, Math.max(1, Number(req.body.rating) || 5)),
        comment: String(req.body.comment || ''),
      },
      include: { user: true },
    });
    res.json({
      success: true,
      feedback: {
        id: feedback.id,
        userId: feedback.userId,
        userName: feedback.user.name,
        rating: feedback.rating,
        comment: feedback.comment,
        createdAt: feedback.createdAt.toISOString(),
      },
      message: '¡Gracias por tu opinión!',
    });
  }),
);

app.get(
  '/api/feedback',
  requireRole(['ADMIN']),
  asyncRoute(async (_req, res) => {
    const feedback = await prisma.feedback.findMany({ include: { user: true }, orderBy: { createdAt: 'desc' } });
    res.json({
      feedback: feedback.map((item) => ({
        id: item.id,
        userId: item.userId,
        userName: item.user.name,
        rating: item.rating,
        comment: item.comment,
        createdAt: item.createdAt.toISOString(),
      })),
    });
  }),
);

// AI script generation
app.post(
  '/api/ai/generate-script',
  requireRole(['ADMIN']),
  asyncRoute(async (req, res) => {
    const targetLang = req.body.language || 'es';
    const topic = req.body.lessonTitle || 'Lección de Mentoría Técnica';
    let generatedScript = '';

    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (apiKey && apiKey !== 'MY_GEMINI_API_KEY' && apiKey.length > 5) {
        const ai = new GoogleGenAI({ apiKey });
        const prompt = `Actúa como Mentor Senior. Redacta un guion introductorio motivador de máximo 90 palabras para "${topic}". Idioma: ${targetLang}. Instrucciones: ${req.body.customInstructions || 'Ninguna'}. Devuelve sólo texto apto para TTS.`;
        const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
        generatedScript = response.text?.trim() || '';
      }
    } catch (error) {
      console.warn('Gemini no disponible; se usará el guion local:', error);
    }

    if (!generatedScript) {
      if (String(targetLang).startsWith('en')) {
        generatedScript = `Welcome to the lesson "${topic}". Today we will explore the key strategies to master this topic step by step. Review the resources and share your questions in the mentorship forum. Let's begin!`;
      } else {
        generatedScript = `¡Hola! Bienvenido a la lección "${topic}". En esta clase exploraremos las estrategias clave para dominar este concepto paso a paso. Revisa los recursos y deja tus dudas en la zona de mentoría al finalizar. ¡Comencemos!`;
      }
    }
    res.json({ success: true, scriptText: generatedScript, message: 'Guion generado exitosamente con IA.' });
  }),
);

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Endpoint de API no encontrado.' });
});

// SEO endpoints
app.get(
  '/sitemap.xml',
  asyncRoute(async (req, res) => {
    const host = req.get('host') || `localhost:${PORT}`;
    const baseUrl = `${req.protocol || 'http'}://${host}`;
    const currentDate = new Date().toISOString().split('T')[0];
    const courses = await prisma.course.findMany({ where: { published: true }, select: { id: true } });
    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;
    xml += `  <url><loc>${baseUrl}/</loc><lastmod>${currentDate}</lastmod><changefreq>daily</changefreq><priority>1.0</priority></url>\n`;
    xml += `  <url><loc>${baseUrl}/catalog</loc><lastmod>${currentDate}</lastmod><changefreq>daily</changefreq><priority>0.8</priority></url>\n`;
    for (const course of courses) {
      xml += `  <url><loc>${baseUrl}/courses/${course.id}</loc><lastmod>${currentDate}</lastmod><changefreq>weekly</changefreq><priority>0.9</priority></url>\n`;
    }
    xml += '</urlset>';
    res.header('Content-Type', 'application/xml').send(xml);
  }),
);

app.get('/robots.txt', (req, res) => {
  const host = req.get('host') || `localhost:${PORT}`;
  const baseUrl = `${req.protocol || 'http'}://${host}`;
  res.header('Content-Type', 'text/plain').send(`User-agent: *
Allow: /
Allow: /catalog
Allow: /courses
Disallow: /admin
Disallow: /mentor
Disallow: /api/

Sitemap: ${baseUrl}/sitemap.xml`);
});

app.use(
  asyncRoute(async (req, res, next) => {
    const userAgent = (req.headers['user-agent'] || '').toLowerCase();
    const isBot = /googlebot|bingbot|yandex|baiduspider|gptbot|claude-web|perplexity|twitterbot|facebookexternalhit|linkedinbot|whatsapp|slackbot/i.test(userAgent);
    if (!isBot || (req.path !== '/' && req.path !== '/catalog')) return next();

    const [landingRecord, courses] = await Promise.all([
      getLandingRecord(),
      prisma.course.findMany({ where: { published: true }, orderBy: { createdAt: 'asc' } }),
    ]);
    const landing = toLandingConfig(landingRecord);
    const baseUrl = `${req.protocol}://${req.get('host') || `localhost:${PORT}`}`;
    const courseItems = courses.map((course, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      item: {
        '@type': 'Course',
        name: course.title,
        description: course.description,
        provider: { '@type': 'EducationalOrganization', name: 'Giantucchi Inc. EIRL' },
      },
    }));
    const schema = {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      itemListElement: courseItems,
    };
    const html = `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"><title>${landing.heroTitle} | DocentOS</title>
<meta name="description" content="${landing.heroSubtitle}"><link rel="canonical" href="${baseUrl}">
<meta property="og:image" content="${landing.heroMediaUrl}"><script type="application/ld+json">${JSON.stringify(schema)}</script>
</head><body><h1>${landing.heroTitle}</h1><p>${landing.heroSubtitle}</p>
${courses.map((course) => `<article><h2>${course.title}</h2><p>${course.description}</p><p>Precio: $${course.price} USD</p></article>`).join('')}
<footer>${landing.footerText}</footer></body></html>`;
    res.setHeader('Content-Type', 'text/html').send(html);
  }),
);

async function startServer() {
  await prisma.$connect();

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error('Error procesando la solicitud:', error);
    if (!res.headersSent) res.status(500).json({ error: 'Error interno del servidor' });
  });

  const httpServer = app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 DocentOS v${DOCENTOS_VERSION} activo en http://localhost:${PORT}`);
    console.log('🗄️ PostgreSQL conectado mediante Prisma');
  });

  const shutdown = async () => {
    httpServer.close(async () => {
      await prisma.$disconnect();
      process.exit(0);
    });
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

startServer().catch(async (error) => {
  console.error('❌ No se pudo iniciar DocentOS:', error);
  await prisma.$disconnect();
  process.exitCode = 1;
});
