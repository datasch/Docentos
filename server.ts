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
import {
  searchDriveVideos,
  getDriveFileInfo,
  extractDriveFileId,
  buildDriveEmbedUrl,
  isDriveConfigured,
} from './server/driveService.js';
import {
  DriveFolderError,
  countTreeFiles,
  countTreeFolders,
  looksLikeDriveFileLink,
  parseDriveFolderId,
  resolveWalkStrategy,
  walkDriveFolder,
} from './server/driveFolder.js';
import {
  ImportPlanError,
  buildImportPlan,
  sanitizeImportPlan,
  type ImportPlan,
  type SanitizedPlan,
} from './server/courseImportPlan.js';
import { organizeImportPlan } from './server/courseImportAi.js';
import { createSetupGuard } from './server/setupGuard.js';
import { sendTelemetryCallHome } from './server/telemetryService.js';
import { prisma } from './server/prisma.js';
import { config } from './server/config.js';
import {
  canConvertAccountToMentee,
  getCourseAccessDecision,
  getCourseAccessDecisions,
  userHasCourseAccess,
  userHasVideoAccess,
  userHasResourceAccess,
  serializeCourseForViewer,
  serializeCourseForAdmin,
} from './server/courseAccess.js';
import { calculateCourseProgress } from './server/progressService.js';
import {
  createCheckoutSession,
  handleStripeWebhook,
  getPaymentStatus,
  simulateDevPaymentSuccess,
} from './server/paymentService.js';
import {
  DOCENTOS_DEFAULT_EDITION,
  DOCENTOS_RELEASE_CHANNEL,
  DOCENTOS_VERSION,
} from './src/version.js';
import { requestTracingMiddleware, logger, getMetricsSnapshot } from './server/logger.js';
import { escapeHtml, isCrawlerUserAgent, renderSeoLandingHtml } from './server/seo.js';

const app = express();
const PORT = config.PORT;
const DEFAULT_AVATAR = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80';
const ADMIN_AVATAR = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80';
const VALID_ROLES = ['ADMIN', 'MENTOR', 'MENTEE', 'PUBLIC_USER', 'VIP', 'EXTERNAL'] as const;
const DUMMY_PASSWORD_HASH = '$2b$12$ctNbBMxeBgkvW2dkZ.wCJu.3B2.bDvDg9xvBPVVBofTsF3/Fx4rTW';

function getReleaseMetadata() {
  return {
    product: 'DocentOS',
    version: DOCENTOS_VERSION,
    channel: DOCENTOS_RELEASE_CHANNEL,
    edition: config.DOCENTOS_EDITION || DOCENTOS_DEFAULT_EDITION,
    revision: config.GIT_COMMIT_SHA || 'development',
  };
}

type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

const asyncRoute = (handler: AsyncHandler) => (req: Request, res: Response, next: NextFunction) => {
  void handler(req, res, next).catch(next);
};

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


async function getLandingRecord() {
  return prisma.landingConfig.upsert({
    where: { id: 'singleton' },
    update: {},
    create: { id: 'singleton' },
  });
}

function instanceConfigDefaults() {
  return {
    institutionName: config.APP_NAME,
    appTagline: config.APP_TAGLINE,
    logoInitial: config.APP_LOGO_INITIAL.slice(0, 4),
    logoUrl: config.APP_LOGO_URL,
    poweredByText: config.POWERED_BY_TEXT,
    poweredByLink: config.POWERED_BY_LINK,
    authorCredit: config.AUTHOR_CREDIT,
    defaultLanguage: config.DEFAULT_LANG,
    assistantName: config.AI_ASSISTANT_NAME,
  };
}

async function ensureLegacyInstanceConfig() {
  const [instance, admin] = await Promise.all([
    prisma.instanceConfig.findUnique({ where: { id: 'singleton' } }),
    prisma.user.findFirst({ where: { role: 'ADMIN' }, orderBy: { createdAt: 'asc' } }),
  ]);
  if (!admin || instance?.setupCompletedAt) return;

  await prisma.instanceConfig.upsert({
    where: { id: 'singleton' },
    update: { setupCompletedAt: admin.createdAt },
    create: {
      id: 'singleton',
      ...instanceConfigDefaults(),
      telemetryConsent: false,
      setupCompletedAt: admin.createdAt,
    },
  });
}

async function isSetupComplete() {
  const [instance, adminCount] = await Promise.all([
    prisma.instanceConfig.findUnique({ where: { id: 'singleton' }, select: { setupCompletedAt: true } }),
    prisma.user.count({ where: { role: 'ADMIN' } }),
  ]);
  return Boolean(instance?.setupCompletedAt) && adminCount > 0;
}

async function getPublicRuntimeConfig() {
  const instance = await prisma.instanceConfig.findUnique({ where: { id: 'singleton' } });
  const defaults = instanceConfigDefaults();
  return {
    appName: instance?.institutionName || defaults.institutionName,
    appTagline: instance?.appTagline || defaults.appTagline,
    logoInitial: instance?.logoInitial || defaults.logoInitial,
    logoUrl: instance?.logoUrl || defaults.logoUrl,
    poweredByText: instance?.poweredByText || defaults.poweredByText,
    poweredByLink: instance?.poweredByLink || defaults.poweredByLink,
    authorCredit: instance?.authorCredit || defaults.authorCredit,
    defaultLanguage: instance?.defaultLanguage || defaults.defaultLanguage,
    assistantName: instance?.assistantName || defaults.assistantName,
  };
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

const setupSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(255).transform((value) => value.toLowerCase()),
  password: z.string().min(12, 'La contraseña debe tener al menos 12 caracteres').max(128),
  appName: z.string().trim().min(2).max(100),
  consentTelemetry: z.boolean().default(false),
});

function redirectPathForRole(role: UserRole) {
  if (role === 'ADMIN') return '/admin';
  if (role === 'MENTOR') return '/mentor/dashboard';
  return '/courses';
}

function passwordResetBaseUrl(req: Request) {
  const configuredUrl = config.APP_URL;
  if (configuredUrl.startsWith('http')) return configuredUrl.replace(/\/$/, '');
  return `${req.protocol}://${req.get('host') || `localhost:${PORT}`}`;
}

async function deliverPasswordReset(
  req: Request,
  user: { email: string; name: string },
  token: string,
  expiresAt: Date,
) {
  const resetUrl = `${passwordResetBaseUrl(req)}/?resetToken=${encodeURIComponent(token)}`;
  const webhookUrl = config.PASSWORD_RESET_WEBHOOK_URL;

  if (webhookUrl?.startsWith('http')) {
    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(config.PASSWORD_RESET_WEBHOOK_TOKEN
            ? { Authorization: `Bearer ${config.PASSWORD_RESET_WEBHOOK_TOKEN}` }
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

  const exposeLocalToken = config.PASSWORD_RESET_EXPOSE_TOKEN;
  return exposeLocalToken ? { resetToken: token, resetUrl } : {};
}

// Sin proxy declarado no se confia en X-Forwarded-For: de lo contrario, un
// cliente directo puede falsear su IP y esquivar los limitadores de intentos.
app.set('trust proxy', config.TRUST_PROXY);
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }),
);
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || config.ALLOWED_ORIGINS.includes(origin.replace(/\/$/, ''))) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Request-ID'],
  }),
);
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  // El filtro XSS heredado se desactiva de forma explicita: su modo de bloqueo
  // introduce vectores propios y los navegadores actuales lo ignoran.
  res.setHeader('X-XSS-Protection', '0');
  next();
});
app.use(requestTracingMiddleware);
app.use(
  express.json({
    limit: '5mb',
    verify: (req: any, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);
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

/**
 * Escanear una carpeta abre decenas de peticiones hacia Google. Un limite
 * propio evita que una cuenta de administrador comprometida —o un bucle en la
 * interfaz— convierta a DocentOS en un amplificador de trafico.
 */
const driveImportRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false, trustProxy: false },
  message: {
    success: false,
    error: 'Demasiadas importaciones seguidas desde Google Drive. Reintenta en unos minutos.',
  },
});

app.use('/api/auth/login', authRateLimiter);
app.use('/api/auth/register', authRateLimiter);
app.use('/api/auth/password/forgot', passwordResetRateLimiter);
app.use('/api/auth/password/reset', passwordResetRateLimiter);
app.use('/api/admin/drive/', driveImportRateLimiter);
app.use('/api/', apiRateLimiter);

// Database health, observability probes and first-run setup
app.get('/api/version', (_req, res) => {
  res.json(getReleaseMetadata());
});

// Sonda Liveness: comprobación de proceso en ejecución
app.get('/api/live', (_req, res) => {
  res.json({
    status: 'ok',
    uptimeSeconds: Math.round(process.uptime()),
    ...getReleaseMetadata(),
  });
});

// Sonda Health retrocompatible
app.get(
  '/api/health',
  asyncRoute(async (_req, res) => {
    try {
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
    } catch (error: any) {
      res.status(503).json({
        status: 'error',
        database: 'disconnected',
        error: error?.message || 'Database unreachable',
        ...getReleaseMetadata(),
      });
    }
  }),
);

// Sonda Readiness: comprobación activa de PostgreSQL con medición de latencia
app.get(
  '/api/ready',
  asyncRoute(async (_req, res) => {
    const startDb = Date.now();
    try {
      await prisma.$queryRaw`SELECT 1`;
      const dbLatencyMs = Date.now() - startDb;
      res.json({
        status: 'ready',
        database: 'connected',
        dbLatencyMs,
        ...getReleaseMetadata(),
      });
    } catch (error: any) {
      logger.error('Sonda de readiness fallida: error de conexión a PostgreSQL', { error: error?.message });
      res.status(503).json({
        status: 'unavailable',
        database: 'disconnected',
        error: 'No se pudo verificar la conexión con PostgreSQL',
        ...getReleaseMetadata(),
      });
    }
  }),
);

// Endpoint de Métricas operativas de sistema
app.get(
  '/api/admin/metrics',
  requireAuthenticated,
  requireRole(['ADMIN']),
  asyncRoute(async (_req, res) => {
    const [userCount, courseCount, activeSessions] = await Promise.all([
      prisma.user.count(),
      prisma.course.count(),
      prisma.session.count({ where: { expiresAt: { gt: new Date() } } }),
    ]);

    const snapshot = getMetricsSnapshot();
    res.json({
      ...snapshot,
      database: {
        users: userCount,
        courses: courseCount,
        activeSessions,
      },
      ...getReleaseMetadata(),
    });
  }),
);

app.get(
  '/api/setup/status',
  asyncRoute(async (_req, res) => {
    const [setupComplete, userCount, runtimeConfig] = await Promise.all([
      isSetupComplete(),
      prisma.user.count(),
      getPublicRuntimeConfig(),
    ]);
    res.json({ isSetupRequired: !setupComplete, userCount, appName: runtimeConfig.appName });
  }),
);

app.get(
  '/api/runtime-config',
  asyncRoute(async (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json(await getPublicRuntimeConfig());
  }),
);

app.get(
  '/runtime-config.js',
  asyncRoute(async (_req, res) => {
    const serialized = JSON.stringify(await getPublicRuntimeConfig()).replace(/</g, '\\u003c');
    res.setHeader('Cache-Control', 'no-store');
    res.type('application/javascript').send(`window.__DOCENTOS_CONFIG__ = Object.freeze(${serialized});`);
  }),
);

app.post(
  '/api/setup',
  asyncRoute(async (req, res) => {
    const parsedSetup = setupSchema.safeParse(req.body);
    if (!parsedSetup.success) {
      return res.status(400).json({
        error: parsedSetup.error.issues[0]?.message || 'Datos de instalacion invalidos.',
      });
    }

    const setupData = parsedSetup.data;
    const passwordHash = await hashPassword(setupData.password);
    const setupResult = await prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw`
        WITH installation_lock AS (SELECT pg_advisory_xact_lock(736228104))
        SELECT 1::integer AS acquired FROM installation_lock
      `;
      const instance = await transaction.instanceConfig.findUnique({ where: { id: 'singleton' } });
      const existingAdmin = await transaction.user.findFirst({
        where: { role: 'ADMIN' },
        select: { email: true },
      });
      const existingEmail = await transaction.user.findUnique({
        where: { email: setupData.email },
        select: { id: true },
      });

      if (instance?.setupCompletedAt || existingAdmin) {
        return {
          created: false as const,
          error: existingAdmin
            ? `La instalacion ya fue completada por ${existingAdmin.email}.`
            : 'La instalacion inicial ya fue completada.',
        };
      }
      if (existingEmail) {
        return { created: false as const, error: 'El correo del administrador ya esta registrado.' };
      }

      const newAdminUser = await transaction.user.create({
        data: {
          email: setupData.email,
          passwordHash,
          name: setupData.name,
          role: 'ADMIN',
          avatarUrl: ADMIN_AVATAR,
        },
      });
      await transaction.instanceConfig.upsert({
        where: { id: 'singleton' },
        update: {
          ...instanceConfigDefaults(),
          institutionName: setupData.appName,
          telemetryConsent: setupData.consentTelemetry,
          setupCompletedAt: new Date(),
        },
        create: {
          id: 'singleton',
          ...instanceConfigDefaults(),
          institutionName: setupData.appName,
          telemetryConsent: setupData.consentTelemetry,
          setupCompletedAt: new Date(),
        },
      });
      return { created: true as const, user: newAdminUser };
    });

    if (!setupResult.created) return res.status(409).json({ error: setupResult.error });

    const newAdminUser = setupResult.user;
    const { token } = await createUserSession(newAdminUser.id, req);
    setSessionCookie(res, token);
    await recordAuditEvent(req, {
      actorUserId: newAdminUser.id,
      action: 'setup.admin_created',
      targetType: 'User',
      targetId: newAdminUser.id,
    });

    const telemetryResult = await sendTelemetryCallHome({
      adminEmail: setupData.email,
      adminName: setupData.name,
      appName: setupData.appName,
      consentTelemetry: setupData.consentTelemetry,
    });

    res.json({
      success: true,
      message: '¡Instalación inicial completada con éxito! Usuario Administrador registrado.',
      user: toRuntimeUser(newAdminUser),
      appName: setupData.appName,
      telemetry: telemetryResult,
    });
  }),
);

app.use(createSetupGuard(isSetupComplete));

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
    const defaultCourseId = 'course-giantucchi-mastery';
    const decision = await getCourseAccessDecision(req.user, defaultCourseId);
    res.json({
      authenticated: true,
      user: req.user,
      hasPaidDefaultCourse: decision.allowed,
      accessDecision: decision,
    });
  }),
);

// Courses, access and protected content
app.get(
  '/api/courses',
  asyncRoute(async (req, res) => {
    const user = req.user;
    const viewerRole: UserRole = user?.role || 'PUBLIC_USER';
    const courses = await prisma.course.findMany({
      where: user?.role === 'ADMIN' ? {} : { published: true },
      include: {
        resources: { orderBy: { order: 'asc' } },
        modules: {
          orderBy: { order: 'asc' },
          include: {
            videos: { orderBy: { order: 'asc' } },
            resources: { orderBy: { order: 'asc' } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const decisions = await getCourseAccessDecisions(user, courses);
    const formattedCourses = courses.map((course) => {
      const decision = decisions.get(course.id)!;
      const serialized = serializeCourseForViewer(course, decision.allowed);
      return {
        ...serialized,
        hasAccess: decision.allowed,
        accessReason: decision.reason,
        userRole: viewerRole,
        requiresPaywall: !decision.allowed,
      };
    });

    const hasAnyAccess = formattedCourses.some((c) => c.hasAccess);
    res.json({ courses: formattedCourses, userRole: viewerRole, hasAccess: hasAnyAccess });
  }),
);

app.get(
  '/api/courses/:courseId',
  asyncRoute(async (req, res) => {
    const course = await prisma.course.findUnique({
      where: { id: req.params.courseId },
      include: {
        resources: { orderBy: { order: 'asc' } },
        modules: {
          orderBy: { order: 'asc' },
          include: {
            videos: { orderBy: { order: 'asc' } },
            resources: { orderBy: { order: 'asc' } },
          },
        },
      },
    });
    if (!course) return res.status(404).json({ error: 'Curso no encontrado' });

    const viewerRole: UserRole = req.user?.role || 'PUBLIC_USER';
    const decision = await getCourseAccessDecision(req.user, course.id);
    const serialized = serializeCourseForViewer(course, decision.allowed);

    res.json({
      course: {
        ...serialized,
        hasAccess: decision.allowed,
        accessReason: decision.reason,
        userRole: viewerRole,
        requiresPaywall: !decision.allowed,
      },
      hasAccess: decision.allowed,
      accessReason: decision.reason,
      userRole: viewerRole,
      requiresPaywall: !decision.allowed,
    });
  }),
);

app.get(
  '/api/courses/:courseId/access',
  asyncRoute(async (req, res) => {
    const course = await prisma.course.findUnique({
      where: { id: req.params.courseId },
      select: { id: true, price: true, currency: true },
    });
    const decision = await getCourseAccessDecision(req.user, req.params.courseId);
    res.json({
      courseId: req.params.courseId,
      userRole: req.user?.role || 'PUBLIC_USER',
      hasAccess: decision.allowed,
      reason: decision.reason,
      hasPaid: decision.hasPaid,
      hasEnrollment: decision.hasEnrollment,
      hasMentorshipAssignment: decision.hasMentorshipAssignment,
      priceUSD: course?.price || 0,
      currency: course?.currency || 'USD',
    });
  }),
);

// Protected content delivery: keeps private URLs protected from unauthenticated access
app.get(
  '/api/content/videos/:videoId',
  asyncRoute(async (req, res) => {
    const video = await prisma.videoDriveLink.findUnique({
      where: { id: req.params.videoId },
      include: { module: { select: { courseId: true } } },
    });
    if (!video) return res.status(404).json({ error: 'Video no encontrado.' });

    const hasAccess = await userHasCourseAccess(req.user, video.module.courseId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'No tienes autorización para ver este video.' });
    }

    const targetUrl = video.embedUrl || video.previewUrl;
    if (!targetUrl) {
      return res.status(404).json({ error: 'URL del video no disponible.' });
    }

    if (req.headers.accept?.includes('application/json')) {
      return res.json({
        id: video.id,
        playbackUrl: targetUrl,
        mimeType: video.mimeType,
        source: video.source,
      });
    }

    return res.redirect(targetUrl);
  }),
);

app.get(
  '/api/content/resources/:resourceId',
  asyncRoute(async (req, res) => {
    const resource = await prisma.courseResource.findUnique({
      where: { id: req.params.resourceId },
    });
    if (!resource) return res.status(404).json({ error: 'Recurso no encontrado.' });

    const hasAccess = await userHasResourceAccess(req.user, resource.id);
    if (!hasAccess) {
      return res.status(403).json({ error: 'No tienes autorización para acceder a este recurso.' });
    }

    if (req.headers.accept?.includes('application/json')) {
      return res.json({
        id: resource.id,
        downloadUrl: resource.privateUrl,
        title: resource.title,
        kind: resource.kind,
        mimeType: resource.mimeType,
      });
    }

    return res.redirect(resource.privateUrl);
  }),
);

// Payments & Checkout
app.post(
  '/api/payments/checkout',
  requireAuthenticated,
  asyncRoute(async (req, res) => {
    const courseId = req.body.courseId || 'course-giantucchi-mastery';
    const originUrl = `${req.protocol}://${req.get('host') || 'localhost:3000'}`;

    try {
      const result = await createCheckoutSession({
        userId: req.user!.id,
        courseId,
        userEmail: req.user!.email,
        returnBaseUrl: originUrl,
      });
      res.json({ success: true, ...result });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'No se pudo generar la sesión de pago.' });
    }
  }),
);

app.post(
  '/api/payments/webhook',
  asyncRoute(async (req, res) => {
    const signature = req.headers['stripe-signature'] as string | undefined;
    const rawBody = (req as any).rawBody || req.body;

    try {
      const result = await handleStripeWebhook(rawBody, signature);
      res.json(result);
    } catch (err: any) {
      console.error('[Webhook Error]:', err);
      res.status(400).json({ error: err.message || 'Error procesando webhook.' });
    }
  }),
);

app.get(
  '/api/payments/:paymentId/status',
  requireAuthenticated,
  asyncRoute(async (req, res) => {
    const status = await getPaymentStatus({
      paymentId: req.params.paymentId,
      userId: req.user!.role === 'ADMIN' ? undefined : req.user!.id,
    });
    if (!status) return res.status(404).json({ error: 'Registro de pago no encontrado.' });
    res.json(status);
  }),
);

app.post(
  '/api/payments/dev-simulate',
  requireAuthenticated,
  asyncRoute(async (req, res) => {
    if (config.DOCENTOS_ENV === 'production') {
      return res.status(404).json({ error: 'Recurso no disponible.' });
    }
    const paymentId = String(req.body.paymentId || '');
    if (!paymentId) return res.status(400).json({ error: 'paymentId es requerido.' });
    try {
      const result = await simulateDevPaymentSuccess(paymentId, req.user!.id);
      res.json(result);
    } catch (err: any) {
      res.status(403).json({ error: err.message || 'No se pudo simular el pago.' });
    }
  }),
);

app.post(
  '/api/vip/activate',
  requireAuthenticated,
  (_req, res) =>
    res.status(501).json({
      error: 'La activación VIP directa está deshabilitada. Los pases VIP se gestionan mediante pago verificado o asignación administrativa.',
    }),
);

// Google Drive integration
app.get(
  '/api/drive/videos',
  requireRole(['ADMIN', 'MENTOR']),
  asyncRoute(async (req, res) => {
    const videos = await searchDriveVideos(req.query.q as string, req.query.folderId as string);
    // Sin credenciales el buscador devuelve un catalogo de demostracion con
    // identificadores ficticios: enlazarlos deja el reproductor vacio, asi que
    // la interfaz necesita poder advertirlo.
    const configured = isDriveConfigured();
    res.json({
      success: true,
      count: videos.length,
      videos,
      configured,
      isDemo: !configured,
    });
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

/**
 * Traduce el fallo del lector a un codigo HTTP. Cada motivo tiene una salida
 * distinta para el administrador, asi que no se colapsan todos en un 400.
 */
const DRIVE_ERROR_STATUS: Record<DriveFolderError['code'], number> = {
  invalid_link: 400,
  not_public: 403,
  not_found: 404,
  format_changed: 502,
  upstream: 502,
  timeout: 504,
};

app.post(
  '/api/admin/drive/scan',
  requireRole(['ADMIN']),
  asyncRoute(async (req, res) => {
    if (!config.DRIVE_IMPORT_ENABLED) {
      return res.status(503).json({
        error: 'La importación desde Google Drive está desactivada en esta instancia (DRIVE_IMPORT_ENABLED).',
      });
    }

    const input = String(req.body.url ?? req.body.folderUrl ?? '').trim();
    if (!input) {
      return res.status(400).json({ error: 'Pega el enlace de la carpeta de Google Drive.' });
    }

    const folderId = parseDriveFolderId(input);
    if (!folderId) {
      return res.status(400).json({
        error: looksLikeDriveFileLink(input)
          ? 'Ese es el enlace de un archivo suelto, no de una carpeta. Abre la carpeta que contiene el curso y copia su enlace.'
          : 'No se reconoce el enlace. Debe ser una carpeta de Google Drive, por ejemplo https://drive.google.com/drive/folders/ABC123...',
      });
    }

    const startedAt = Date.now();
    try {
      const result = await walkDriveFolder(folderId, {
        maxDepth: config.DRIVE_IMPORT_MAX_DEPTH,
        maxNodes: config.DRIVE_IMPORT_MAX_NODES,
        concurrency: config.DRIVE_IMPORT_CONCURRENCY,
        timeoutMs: config.DRIVE_IMPORT_TIMEOUT_MS,
      });

      const incomplete =
        result.limits.depthReached || result.limits.nodeLimitReached || result.limits.timedOut;

      res.json({
        success: true,
        folderId,
        strategy: result.strategy,
        tree: result.tree,
        stats: {
          foldersScanned: result.scannedFolders,
          foldersInTree: countTreeFolders(result.tree),
          filesFound: countTreeFiles(result.tree),
          elapsedMs: Date.now() - startedAt,
        },
        limits: result.limits,
        incomplete,
      });
    } catch (error) {
      if (error instanceof DriveFolderError) {
        return res.status(DRIVE_ERROR_STATUS[error.code]).json({ error: error.message, code: error.code });
      }
      throw error;
    }
  }),
);

/**
 * Lee la carpeta y devuelve el plan de curso propuesto.
 *
 * Es deliberadamente de solo lectura: no crea nada. El administrador revisa el
 * plan, ajusta lo que quiera y solo entonces confirma. Importar de una sola
 * pasada sobre una carpeta ajena produce cursos basura dificiles de deshacer.
 */
app.post(
  '/api/admin/drive/import/preview',
  requireRole(['ADMIN']),
  asyncRoute(async (req, res) => {
    if (!config.DRIVE_IMPORT_ENABLED) {
      return res.status(503).json({
        error: 'La importación desde Google Drive está desactivada en esta instancia (DRIVE_IMPORT_ENABLED).',
      });
    }

    const input = String(req.body.url ?? req.body.folderUrl ?? '').trim();
    if (!input) {
      return res.status(400).json({ error: 'Pega el enlace de la carpeta de Google Drive.' });
    }

    const folderId = parseDriveFolderId(input);
    if (!folderId) {
      return res.status(400).json({
        error: looksLikeDriveFileLink(input)
          ? 'Ese es el enlace de un archivo suelto, no de una carpeta. Abre la carpeta que contiene el curso y copia su enlace.'
          : 'No se reconoce el enlace. Debe ser una carpeta de Google Drive, por ejemplo https://drive.google.com/drive/folders/ABC123...',
      });
    }

    const startedAt = Date.now();
    try {
      const walk = await walkDriveFolder(folderId, {
        maxDepth: config.DRIVE_IMPORT_MAX_DEPTH,
        maxNodes: config.DRIVE_IMPORT_MAX_NODES,
        concurrency: config.DRIVE_IMPORT_CONCURRENCY,
        timeoutMs: config.DRIVE_IMPORT_TIMEOUT_MS,
      });

      const plan = buildImportPlan({
        tree: walk.tree,
        sourceUrl: input,
        sourceFolderId: folderId,
        strategy: walk.strategy,
        foldersScanned: walk.scannedFolders,
        filesFound: walk.filesFound,
        limits: walk.limits,
      });

      // Si esta carpeta ya se importo, la interfaz debe decirlo antes de que
      // el administrador confirme, no despues con un 409 en la cara.
      const existing = await prisma.course.findFirst({
        where: { driveFolderId: folderId },
        select: { id: true, title: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      });

      res.json({
        success: true,
        plan,
        existingCourse: existing,
        aiAvailable: config.AI_PROVIDER !== 'none',
        aiProvider: config.AI_PROVIDER,
        elapsedMs: Date.now() - startedAt,
      });
    } catch (error) {
      if (error instanceof DriveFolderError) {
        return res.status(DRIVE_ERROR_STATUS[error.code]).json({ error: error.message, code: error.code });
      }
      throw error;
    }
  }),
);

/**
 * Crea el curso a partir de un plan revisado.
 *
 * El plan llega editado desde el navegador, asi que se revalida entero antes de
 * tocar la base de datos: los identificadores de Drive se comprueban y las URLs
 * se reconstruyen aqui (nunca se guardan las del cuerpo de la peticion).
 *
 * Reimportar la misma carpeta no duplica nada: si ya existe un curso con ese
 * `driveFolderId` se avisa con un 409 y, cuando el administrador confirma
 * `onDuplicate: 'append'`, solo se anade lo que falte.
 */
app.post(
  '/api/admin/drive/import/apply',
  requireRole(['ADMIN']),
  asyncRoute(async (req, res) => {
    if (!config.DRIVE_IMPORT_ENABLED) {
      return res.status(503).json({
        error: 'La importación desde Google Drive está desactivada en esta instancia (DRIVE_IMPORT_ENABLED).',
      });
    }

    let plan: SanitizedPlan;
    try {
      plan = sanitizeImportPlan(req.body.plan);
    } catch (error) {
      if (error instanceof ImportPlanError) {
        return res.status(400).json({ error: error.message, code: error.code });
      }
      throw error;
    }

    const onDuplicate = String(req.body.onDuplicate ?? '');
    const requestedCourseId = String(req.body.courseId ?? '').trim();
    const withContent = {
      modules: { include: { videos: { select: { driveFileId: true, order: true } } } },
      resources: { select: { externalFileId: true, order: true, moduleId: true } },
    } as const;

    let target = requestedCourseId
      ? await prisma.course.findUnique({ where: { id: requestedCourseId }, include: withContent })
      : await prisma.course.findFirst({
          where: { driveFolderId: plan.sourceFolderId },
          include: withContent,
          orderBy: { createdAt: 'asc' },
        });

    if (requestedCourseId && !target) {
      return res.status(404).json({ error: 'El curso al que querías añadir el contenido ya no existe.' });
    }

    // Reimportacion no confirmada: se para y se pregunta en vez de crear un
    // curso gemelo que despues hay que localizar y borrar a mano.
    if (!requestedCourseId && target && onDuplicate !== 'append' && onDuplicate !== 'create') {
      return res.status(409).json({
        code: 'duplicate',
        error: `Esta carpeta de Drive ya se importó como "${target.title}".`,
        course: { id: target.id, title: target.title, modules: target.modules.length },
      });
    }
    if (!requestedCourseId && target && onDuplicate === 'create') target = null;

    const appending = target !== null;
    // Lo que ya esta importado no se vuelve a crear: el reparto se hace por
    // identificador de Drive, no por titulo, porque el titulo se puede editar.
    const knownFileIds = new Set<string>();
    if (target) {
      for (const moduleEntry of target.modules) {
        for (const video of moduleEntry.videos) knownFileIds.add(video.driveFileId);
      }
      for (const resource of target.resources) {
        if (resource.externalFileId) knownFileIds.add(resource.externalFileId);
      }
    }

    const published = Boolean(req.body.published);
    const created = { modules: 0, lessons: 0, resources: 0 };
    const skipped = { lessons: 0, resources: 0 };

    const courseId = await prisma.$transaction(
      async (tx) => {
        let id: string;
        let moduleOrder: number;
        const modulesByTitle = new Map<string, { id: string; videoOrder: number; resourceOrder: number }>();

        if (target) {
          id = target.id;
          moduleOrder = target.modules.reduce((max, entry) => Math.max(max, entry.order), 0);
          for (const moduleEntry of target.modules) {
            modulesByTitle.set(moduleEntry.title.trim().toLocaleLowerCase(), {
              id: moduleEntry.id,
              videoOrder: moduleEntry.videos.reduce((max, video) => Math.max(max, video.order), 0),
              resourceOrder: target.resources
                .filter((resource) => resource.moduleId === moduleEntry.id)
                .reduce((max, resource) => Math.max(max, resource.order), 0),
            });
          }
          // La carpeta de origen queda anotada tambien cuando el curso se creo a
          // mano y ahora recibe contenido importado.
          if (!target.driveFolderId) {
            await tx.course.update({
              where: { id },
              data: { driveFolderId: plan.sourceFolderId },
            });
          }
        } else {
          const course = await tx.course.create({
            data: {
              title: String(req.body.title || plan.title).trim().slice(0, 200),
              description: String(req.body.description || plan.description).trim().slice(0, 2_000),
              price: Math.max(0, Number(req.body.price) || 0),
              currency: String(req.body.currency || 'USD').toUpperCase().slice(0, 8),
              published,
              publishedAt: published ? new Date() : null,
              coverImage: String(
                req.body.coverImage ||
                  'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800',
              ).trim(),
              category: String(req.body.category || plan.category).trim().slice(0, 80),
              isDemo: false,
              driveFolderId: plan.sourceFolderId,
            },
          });
          id = course.id;
          moduleOrder = 0;
        }

        for (const plannedModule of plan.modules) {
          const lessons = plannedModule.lessons.filter((lesson) => !knownFileIds.has(lesson.driveFileId));
          const resources = plannedModule.resources.filter(
            (resource) => !knownFileIds.has(resource.driveFileId),
          );
          skipped.lessons += plannedModule.lessons.length - lessons.length;
          skipped.resources += plannedModule.resources.length - resources.length;
          if (lessons.length === 0 && resources.length === 0) continue;

          const key = plannedModule.title.trim().toLocaleLowerCase();
          let slot = modulesByTitle.get(key);
          if (!slot) {
            const moduleRecord = await tx.module.create({
              data: { courseId: id, title: plannedModule.title, order: ++moduleOrder },
            });
            slot = { id: moduleRecord.id, videoOrder: 0, resourceOrder: 0 };
            modulesByTitle.set(key, slot);
            created.modules++;
          }

          if (lessons.length > 0) {
            await tx.videoDriveLink.createMany({
              data: lessons.map((lesson, index) => ({
                moduleId: slot!.id,
                driveFileId: lesson.driveFileId,
                title: lesson.title,
                duration: lesson.duration,
                mimeType: lesson.mimeType,
                embedUrl: lesson.embedUrl,
                source: 'GOOGLE_DRIVE' as const,
                order: slot!.videoOrder + index + 1,
              })),
            });
            slot.videoOrder += lessons.length;
            created.lessons += lessons.length;
          }

          if (resources.length > 0) {
            await tx.courseResource.createMany({
              data: resources.map((resource, index) => ({
                courseId: id,
                moduleId: slot!.id,
                title: resource.title,
                description: resource.isSubtitle ? 'Subtítulos de la lección.' : null,
                kind: 'FILE' as const,
                source: 'GOOGLE_DRIVE' as const,
                externalFileId: resource.driveFileId,
                privateUrl: resource.downloadUrl,
                mimeType: resource.mimeType,
                sizeBytes: resource.sizeBytes === null ? null : BigInt(resource.sizeBytes),
                order: slot!.resourceOrder + index + 1,
              })),
            });
            slot.resourceOrder += resources.length;
            created.resources += resources.length;
          }

          for (const lesson of lessons) knownFileIds.add(lesson.driveFileId);
          for (const resource of resources) knownFileIds.add(resource.driveFileId);
        }

        return id;
      },
      // Un curso de doscientos archivos no cabe en los cinco segundos que
      // Prisma da por defecto, y a medias no sirve de nada.
      { timeout: 120_000, maxWait: 20_000 },
    );

    const course = await prisma.course.findUnique({
      where: { id: courseId },
      include: { modules: { include: { videos: true }, orderBy: { order: 'asc' } } },
    });

    await recordAuditEvent(req, {
      action: appending ? 'course.import.drive.append' : 'course.import.drive',
      targetType: 'Course',
      targetId: courseId,
      metadata: {
        driveFolderId: plan.sourceFolderId,
        title: plan.title,
        created,
        skipped,
      },
    });

    res.json({
      success: true,
      mode: appending ? 'append' : 'create',
      courseId,
      course: course ? serializeCourseForAdmin(course) : null,
      created,
      skipped,
    });
  }),
);

/**
 * Pule el plan con IA, sin tocar la base de datos.
 *
 * Es un paso intermedio y opcional entre `preview` y `apply`: devuelve otro
 * plan para que el administrador lo revise. Si la IA no esta configurada, falla
 * o propone algo que no cuadra, se devuelve el plan tal cual con el motivo en
 * `reason` y `organized: false`; nunca es un error para quien importa.
 */
app.post(
  '/api/admin/drive/import/organize',
  requireRole(['ADMIN']),
  asyncRoute(async (req, res) => {
    if (!config.DRIVE_IMPORT_ENABLED) {
      return res.status(503).json({
        error: 'La importación desde Google Drive está desactivada en esta instancia (DRIVE_IMPORT_ENABLED).',
      });
    }
    if (config.AI_PROVIDER === 'none') {
      return res.status(503).json({
        code: 'ai_disabled',
        error:
          'No hay proveedor de IA configurado. Añade OPENAI_API_KEY o DEEPSEEK_API_KEY para organizar el curso automáticamente; la importación funciona igual sin ello.',
      });
    }

    // El plan se revalida antes de gastar una llamada al modelo: si trae basura,
    // el problema esta en el navegador y no en la IA.
    try {
      sanitizeImportPlan(req.body.plan);
    } catch (error) {
      if (error instanceof ImportPlanError) {
        return res.status(400).json({ error: error.message, code: error.code });
      }
      throw error;
    }

    const outcome = await organizeImportPlan(req.body.plan as ImportPlan);

    res.json({
      success: true,
      organized: outcome.organized,
      plan: outcome.plan,
      provider: outcome.provider ?? config.AI_PROVIDER,
      model: outcome.model,
      elapsedMs: outcome.elapsedMs,
      reason: outcome.reason,
    });
  }),
);

/** Estado de la integracion, para que la interfaz sepa que puede ofrecer. */
app.get(
  '/api/admin/drive/status',
  requireRole(['ADMIN']),
  asyncRoute(async (_req, res) => {
    res.json({
      success: true,
      importEnabled: config.DRIVE_IMPORT_ENABLED,
      strategy: resolveWalkStrategy(),
      driveConfigured: isDriveConfigured(),
      aiProvider: config.AI_PROVIDER,
      limits: {
        maxDepth: config.DRIVE_IMPORT_MAX_DEPTH,
        maxNodes: config.DRIVE_IMPORT_MAX_NODES,
        timeoutMs: config.DRIVE_IMPORT_TIMEOUT_MS,
      },
    });
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

// Progress, tracking and certificates
app.get(
  '/api/progress',
  requireAuthenticated,
  asyncRoute(async (req, res) => {
    const [progress, certificates] = await Promise.all([
      prisma.userProgress.findMany({ where: { userId: req.user!.id, completed: true } }),
      prisma.certificate.findMany({
        where: { userId: req.user!.id },
        select: {
          id: true,
          verificationCode: true,
          courseId: true,
          courseTitle: true,
          completionPercent: true,
          issuedAt: true,
          revokedAt: true,
        },
      }),
    ]);
    const completedVideos = Object.fromEntries(progress.map((item) => [item.videoId, true]));
    res.json({
      success: true,
      completedVideos,
      certificates: certificates.map((c) => ({
        ...c,
        issuedAt: c.issuedAt.toISOString(),
        revokedAt: c.revokedAt?.toISOString() || null,
      })),
    });
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

    const video = await prisma.videoDriveLink.findUnique({
      where: { id: videoId },
      select: { module: { select: { courseId: true } } },
    });

    let progressReport = null;
    if (video) {
      progressReport = await calculateCourseProgress(req.user!.id, video.module.courseId);
    }

    res.json({
      success: true,
      videoId,
      completed: completed !== false,
      progress: progressReport,
      certificate: progressReport?.certificate || null,
    });
  }),
);

// Public certificate verification endpoint (no auth required)
app.get(
  '/api/certificates/verify/:code',
  asyncRoute(async (req, res) => {
    const code = req.params.code.trim().toUpperCase();
    const certificate = await prisma.certificate.findUnique({
      where: { verificationCode: code },
      include: {
        course: { select: { id: true, title: true, coverImage: true } },
      },
    });

    if (!certificate) {
      return res.status(404).json({
        valid: false,
        error: 'Certificado no encontrado con el código proporcionado.',
      });
    }

    const isRevoked = Boolean(certificate.revokedAt);

    res.json({
      valid: !isRevoked,
      isRevoked,
      certificate: {
        verificationCode: certificate.verificationCode,
        recipientName: certificate.recipientName,
        courseTitle: certificate.courseTitle,
        completionPercent: certificate.completionPercent,
        issuedAt: certificate.issuedAt.toISOString(),
        revokedAt: certificate.revokedAt?.toISOString() || null,
        revocationReason: certificate.revocationReason || null,
      },
    });
  }),
);

// Student: get certificate for specific course
app.get(
  '/api/courses/:courseId/certificate',
  requireAuthenticated,
  asyncRoute(async (req, res) => {
    const certificate = await prisma.certificate.findUnique({
      where: {
        userId_courseId: {
          userId: req.user!.id,
          courseId: req.params.courseId,
        },
      },
    });
    if (!certificate) {
      return res.status(404).json({ error: 'Aún no se ha emitido un certificado para este curso.' });
    }
    res.json({
      certificate: {
        id: certificate.id,
        verificationCode: certificate.verificationCode,
        recipientName: certificate.recipientName,
        courseTitle: certificate.courseTitle,
        completionPercent: certificate.completionPercent,
        issuedAt: certificate.issuedAt.toISOString(),
        revokedAt: certificate.revokedAt?.toISOString() || null,
      },
    });
  }),
);

// Admin: list all issued certificates
app.get(
  '/api/admin/certificates',
  requireRole(['ADMIN']),
  asyncRoute(async (_req, res) => {
    const certificates = await prisma.certificate.findMany({
      include: {
        user: { select: { id: true, name: true, email: true } },
        course: { select: { id: true, title: true } },
      },
      orderBy: { issuedAt: 'desc' },
    });
    res.json({
      certificates: certificates.map((c) => ({
        id: c.id,
        verificationCode: c.verificationCode,
        recipientName: c.recipientName,
        courseTitle: c.courseTitle,
        userName: c.user.name,
        userEmail: c.user.email,
        completionPercent: c.completionPercent,
        issuedAt: c.issuedAt.toISOString(),
        revokedAt: c.revokedAt?.toISOString() || null,
        revocationReason: c.revocationReason || null,
      })),
    });
  }),
);

// Admin: revoke certificate
app.put(
  '/api/admin/certificates/:id/revoke',
  requireRole(['ADMIN']),
  asyncRoute(async (req, res) => {
    const reason = String(req.body.reason || 'Revocado por administración').trim();
    const certificate = await prisma.certificate.findUnique({
      where: { id: req.params.id },
    });
    if (!certificate) return res.status(404).json({ error: 'Certificado no encontrado.' });

    const updated = await prisma.certificate.update({
      where: { id: certificate.id },
      data: {
        revokedAt: new Date(),
        revocationReason: reason,
      },
    });

    await recordAuditEvent(req, {
      action: 'certificate.revoke',
      targetType: 'Certificate',
      targetId: certificate.id,
      metadata: { verificationCode: certificate.verificationCode, reason },
    });

    res.json({ success: true, message: 'Certificado revocado exitosamente.', certificate: updated });
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
    hasAccess: ['ADMIN', 'MENTOR', 'MENTEE', 'VIP'].includes(req.user.role),
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
    if (!canConvertAccountToMentee(req.user!.role, (existingMentee?.role as UserRole) ?? null)) {
      return res.status(403).json({
        error: `La cuenta ${email} tiene el rol ${existingMentee!.role}. Solo un administrador puede convertirla en mentee.`,
      });
    }

    const mentee = existingMentee
      ? await prisma.user.update({ where: { id: existingMentee.id }, data: { name, role: 'MENTEE' } })
      : await prisma.user.create({ data: { name, email, role: 'MENTEE', avatarUrl: DEFAULT_AVATAR } });

    if (existingMentee && existingMentee.role !== mentee.role) {
      await recordAuditEvent(req, {
        action: 'user.role_changed',
        targetType: 'User',
        targetId: mentee.id,
        metadata: { previousRole: existingMentee.role, role: mentee.role, via: 'mentor.assign_mentee' },
      });
    }
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

/**
 * Decide el origen de reproduccion de un video a partir de lo que escribio el
 * administrador. Acepta un enlace de Drive completo, un ID suelto o una URL de
 * reproduccion propia, y rechaza con un mensaje util lo que no sirve, en lugar
 * de guardar un enlace roto que solo se descubre al abrir el reproductor.
 */
function resolveVideoSource(
  rawDriveInput: unknown,
  rawEmbedUrl: unknown,
): { driveFileId: string; embedUrl: string } | { error: string } {
  const driveInput = String(rawDriveInput ?? '').trim();
  const embedInput = String(rawEmbedUrl ?? '').trim();

  if (driveInput) {
    const fileId = extractDriveFileId(driveInput);
    if (!fileId) {
      return {
        error:
          'No se reconoce el archivo de Google Drive. Pega el enlace completo (por ejemplo https://drive.google.com/file/d/ABC123.../view) o solo su identificador.',
      };
    }
    return { driveFileId: fileId, embedUrl: embedInput || buildDriveEmbedUrl(fileId) };
  }

  if (embedInput) {
    if (!/^https?:\/\//i.test(embedInput)) {
      return { error: 'La URL de reproducción debe empezar por http:// o https://.' };
    }
    return { driveFileId: `external-${Date.now()}`, embedUrl: embedInput };
  }

  // Sin origen: se crea un marcador de posicion que el administrador completara.
  const placeholderId = `pending-${Date.now()}`;
  return { driveFileId: placeholderId, embedUrl: '' };
}

app.post(
  '/api/admin/modules/:moduleId/videos',
  requireRole(['ADMIN']),
  asyncRoute(async (req, res) => {
    const targetModule = await prisma.module.findUnique({
      where: { id: req.params.moduleId },
      include: { videos: true },
    });
    if (!targetModule) return res.status(404).json({ error: 'Módulo no encontrado' });

    const resolved = resolveVideoSource(req.body.driveFileId, req.body.embedUrl);
    if ('error' in resolved) return res.status(400).json({ error: resolved.error });

    const video = await prisma.videoDriveLink.create({
      data: {
        moduleId: targetModule.id,
        driveFileId: resolved.driveFileId,
        title: req.body.title || 'Nuevo Video de Mentoría',
        duration: req.body.duration || '20:00',
        description: req.body.description || 'Video importado desde Google Drive.',
        mimeType: 'video/mp4',
        embedUrl: resolved.embedUrl,
        // Se usa el maximo y no la cantidad: tras borrar un video intermedio, la
        // cantidad reutilizaria un `order` ya ocupado y romperia el reordenado.
        order: targetModule.videos.reduce((max, v) => Math.max(max, v.order), 0) + 1,
      },
    });
    const moduleWithVideos = await prisma.module.findUnique({
      where: { id: targetModule.id },
      include: { videos: { orderBy: { order: 'asc' } } },
    });
    res.json({ success: true, video, module: moduleWithVideos });
  }),
);

// --- LMS Course Admin Management ---
app.post(
  '/api/admin/courses',
  requireRole(['ADMIN']),
  asyncRoute(async (req, res) => {
    const title = String(req.body.title || '').trim();
    if (!title) return res.status(400).json({ error: 'El título del curso es obligatorio.' });

    const course = await prisma.course.create({
      data: {
        title,
        description: String(req.body.description || '').trim(),
        price: Math.max(0, Number(req.body.price) || 0),
        currency: String(req.body.currency || 'USD').toUpperCase(),
        published: Boolean(req.body.published),
        publishedAt: req.body.published ? new Date() : null,
        coverImage: String(req.body.coverImage || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800'),
        category: String(req.body.category || 'Mentoría Elite').trim(),
        isDemo: Boolean(req.body.isDemo),
      },
    });

    await recordAuditEvent(req, {
      action: 'course.create',
      targetType: 'Course',
      targetId: course.id,
      metadata: { title: course.title, price: course.price },
    });

    res.json({ success: true, course });
  }),
);

app.put(
  '/api/admin/courses/:courseId',
  requireRole(['ADMIN']),
  asyncRoute(async (req, res) => {
    const existing = await prisma.course.findUnique({ where: { id: req.params.courseId } });
    if (!existing) return res.status(404).json({ error: 'Curso no encontrado.' });

    const published = req.body.published !== undefined ? Boolean(req.body.published) : existing.published;
    const publishedAt = published && !existing.published ? new Date() : existing.publishedAt;

    const updated = await prisma.course.update({
      where: { id: existing.id },
      data: {
        ...(req.body.title !== undefined ? { title: String(req.body.title).trim() } : {}),
        ...(req.body.description !== undefined ? { description: String(req.body.description).trim() } : {}),
        ...(req.body.price !== undefined ? { price: Math.max(0, Number(req.body.price) || 0) } : {}),
        ...(req.body.currency !== undefined ? { currency: String(req.body.currency).toUpperCase() } : {}),
        ...(req.body.coverImage !== undefined ? { coverImage: String(req.body.coverImage).trim() } : {}),
        ...(req.body.category !== undefined ? { category: String(req.body.category).trim() } : {}),
        published,
        publishedAt,
      },
    });

    await recordAuditEvent(req, {
      action: 'course.update',
      targetType: 'Course',
      targetId: updated.id,
      metadata: req.body,
    });

    res.json({ success: true, course: updated });
  }),
);

app.delete(
  '/api/admin/courses/:courseId',
  requireRole(['ADMIN']),
  asyncRoute(async (req, res) => {
    const existing = await prisma.course.findUnique({ where: { id: req.params.courseId } });
    if (!existing) return res.status(404).json({ error: 'Curso no encontrado.' });

    await prisma.course.delete({ where: { id: existing.id } });

    await recordAuditEvent(req, {
      action: 'course.delete',
      targetType: 'Course',
      targetId: existing.id,
      metadata: { title: existing.title },
    });

    res.json({ success: true, message: 'Curso eliminado exitosamente.' });
  }),
);

// --- Modules Management ---
app.post(
  '/api/admin/courses/:courseId/modules',
  requireRole(['ADMIN']),
  asyncRoute(async (req, res) => {
    const title = String(req.body.title || '').trim();
    if (!title) return res.status(400).json({ error: 'El título del módulo es obligatorio.' });

    const maxOrder = await prisma.module.aggregate({
      where: { courseId: req.params.courseId },
      _max: { order: true },
    });
    const order = req.body.order !== undefined ? Number(req.body.order) : (maxOrder._max.order || 0) + 1;

    const moduleRecord = await prisma.module.create({
      data: {
        courseId: req.params.courseId,
        title,
        description: req.body.description ? String(req.body.description).trim() : null,
        order,
      },
    });

    res.json({ success: true, module: moduleRecord });
  }),
);

app.put(
  '/api/admin/modules/:moduleId',
  requireRole(['ADMIN']),
  asyncRoute(async (req, res) => {
    const existing = await prisma.module.findUnique({ where: { id: req.params.moduleId } });
    if (!existing) return res.status(404).json({ error: 'Módulo no encontrado.' });

    const updated = await prisma.module.update({
      where: { id: existing.id },
      data: {
        ...(req.body.title !== undefined ? { title: String(req.body.title).trim() } : {}),
        ...(req.body.description !== undefined ? { description: String(req.body.description).trim() } : {}),
        ...(req.body.order !== undefined ? { order: Number(req.body.order) } : {}),
      },
    });

    res.json({ success: true, module: updated });
  }),
);

app.delete(
  '/api/admin/modules/:moduleId',
  requireRole(['ADMIN']),
  asyncRoute(async (req, res) => {
    const existing = await prisma.module.findUnique({ where: { id: req.params.moduleId } });
    if (!existing) return res.status(404).json({ error: 'Módulo no encontrado.' });

    await prisma.module.delete({ where: { id: existing.id } });
    res.json({ success: true, message: 'Módulo eliminado exitosamente.' });
  }),
);

// --- Videos Management ---
app.put(
  '/api/admin/videos/:videoId',
  requireRole(['ADMIN', 'MENTOR']),
  asyncRoute(async (req, res) => {
    const existing = await prisma.videoDriveLink.findUnique({ where: { id: req.params.videoId } });
    if (!existing) return res.status(404).json({ error: 'Video no encontrado.' });

    // El origen se renormaliza igual que al crear, para que corregir un enlace
    // roto desde la ficha del video baste para dejarlo reproducible.
    let sourceUpdate: { driveFileId: string; embedUrl: string } | null = null;
    if (req.body.driveFileId !== undefined || req.body.embedUrl !== undefined) {
      const resolved = resolveVideoSource(
        req.body.driveFileId !== undefined ? req.body.driveFileId : '',
        req.body.embedUrl !== undefined ? req.body.embedUrl : '',
      );
      if ('error' in resolved) return res.status(400).json({ error: resolved.error });
      sourceUpdate = resolved;
    }

    const updated = await prisma.videoDriveLink.update({
      where: { id: existing.id },
      data: {
        ...(req.body.title !== undefined ? { title: String(req.body.title).trim() } : {}),
        ...(req.body.description !== undefined ? { description: String(req.body.description).trim() } : {}),
        ...(req.body.duration !== undefined ? { duration: String(req.body.duration).trim() } : {}),
        ...(sourceUpdate && req.body.driveFileId !== undefined
          ? { driveFileId: sourceUpdate.driveFileId }
          : {}),
        ...(sourceUpdate ? { embedUrl: sourceUpdate.embedUrl } : {}),
        ...(req.body.order !== undefined ? { order: Number(req.body.order) } : {}),
        ...(req.body.source !== undefined ? { source: req.body.source } : {}),
      },
    });

    res.json({ success: true, video: updated });
  }),
);

app.delete(
  '/api/admin/videos/:videoId',
  requireRole(['ADMIN']),
  asyncRoute(async (req, res) => {
    const existing = await prisma.videoDriveLink.findUnique({ where: { id: req.params.videoId } });
    if (!existing) return res.status(404).json({ error: 'Video no encontrado.' });

    await prisma.videoDriveLink.delete({ where: { id: existing.id } });
    res.json({ success: true, message: 'Video eliminado exitosamente.' });
  }),
);

// --- Course Resources Management ---
app.post(
  '/api/admin/courses/:courseId/resources',
  requireRole(['ADMIN']),
  asyncRoute(async (req, res) => {
    const title = String(req.body.title || '').trim();
    const privateUrl = String(req.body.privateUrl || '').trim();
    if (!title || !privateUrl) {
      return res.status(400).json({ error: 'El título y la URL privada del recurso son obligatorios.' });
    }

    const resource = await prisma.courseResource.create({
      data: {
        courseId: req.params.courseId,
        moduleId: req.body.moduleId || null,
        title,
        description: req.body.description ? String(req.body.description).trim() : null,
        kind: req.body.kind || 'FILE',
        source: req.body.source || 'EXTERNAL_URL',
        privateUrl,
        mimeType: req.body.mimeType || 'application/octet-stream',
        sizeBytes: req.body.sizeBytes ? BigInt(req.body.sizeBytes) : null,
        order: Number(req.body.order) || 1,
      },
    });

    res.json({
      success: true,
      resource: {
        ...resource,
        sizeBytes: resource.sizeBytes ? String(resource.sizeBytes) : null,
      },
    });
  }),
);

app.delete(
  '/api/admin/resources/:resourceId',
  requireRole(['ADMIN']),
  asyncRoute(async (req, res) => {
    const existing = await prisma.courseResource.findUnique({ where: { id: req.params.resourceId } });
    if (!existing) return res.status(404).json({ error: 'Recurso no encontrado.' });

    await prisma.courseResource.delete({ where: { id: existing.id } });
    res.json({ success: true, message: 'Recurso eliminado exitosamente.' });
  }),
);

// --- Enrollments Admin Management ---
app.get(
  '/api/admin/enrollments',
  requireRole(['ADMIN']),
  asyncRoute(async (_req, res) => {
    const enrollments = await prisma.courseEnrollment.findMany({
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
        course: { select: { id: true, title: true, price: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({
      enrollments: enrollments.map((e) => ({
        id: e.id,
        userId: e.userId,
        userName: e.user.name,
        userEmail: e.user.email,
        courseId: e.courseId,
        courseTitle: e.course.title,
        status: e.status,
        source: e.source,
        accessExpiresAt: e.accessExpiresAt?.toISOString() || null,
        completedAt: e.completedAt?.toISOString() || null,
        createdAt: e.createdAt.toISOString(),
      })),
    });
  }),
);

app.post(
  '/api/admin/enrollments',
  requireRole(['ADMIN']),
  asyncRoute(async (req, res) => {
    const { userId, courseId, status = 'ACTIVE', source = 'ADMIN', accessExpiresAt } = req.body;
    if (!userId || !courseId) {
      return res.status(400).json({ error: 'userId y courseId son obligatorios.' });
    }

    const enrollment = await prisma.courseEnrollment.upsert({
      where: { userId_courseId: { userId, courseId } },
      create: {
        userId,
        courseId,
        status,
        source,
        accessExpiresAt: accessExpiresAt ? new Date(accessExpiresAt) : null,
      },
      update: {
        status,
        source,
        accessExpiresAt: accessExpiresAt ? new Date(accessExpiresAt) : null,
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
        course: { select: { id: true, title: true } },
      },
    });

    await recordAuditEvent(req, {
      action: 'enrollment.create_or_update',
      targetType: 'CourseEnrollment',
      targetId: enrollment.id,
      metadata: { userId, courseId, status, source },
    });

    res.json({ success: true, enrollment });
  }),
);

app.put(
  '/api/admin/enrollments/:id/status',
  requireRole(['ADMIN']),
  asyncRoute(async (req, res) => {
    const status = req.body.status;
    if (!['ACTIVE', 'COMPLETED', 'REVOKED', 'EXPIRED'].includes(status)) {
      return res.status(400).json({ error: 'Estado de matrícula no válido.' });
    }

    const enrollment = await prisma.courseEnrollment.update({
      where: { id: req.params.id },
      data: { status },
      include: {
        user: { select: { id: true, name: true } },
        course: { select: { id: true, title: true } },
      },
    });

    await recordAuditEvent(req, {
      action: 'enrollment.status_change',
      targetType: 'CourseEnrollment',
      targetId: enrollment.id,
      metadata: { newStatus: status },
    });

    res.json({ success: true, enrollment });
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
      xml += `  <url><loc>${escapeHtml(baseUrl)}/courses/${escapeHtml(encodeURIComponent(course.id))}</loc><lastmod>${currentDate}</lastmod><changefreq>weekly</changefreq><priority>0.9</priority></url>\n`;
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
    const userAgent = String(req.headers['user-agent'] || '');
    if (!isCrawlerUserAgent(userAgent) || (req.path !== '/' && req.path !== '/catalog')) return next();

    const [landingRecord, courses] = await Promise.all([
      getLandingRecord(),
      prisma.course.findMany({ where: { published: true }, orderBy: { createdAt: 'asc' } }),
    ]);
    const landing = toLandingConfig(landingRecord);
    const html = renderSeoLandingHtml({
      landing,
      courses,
      baseUrl: `${req.protocol}://${req.get('host') || `localhost:${PORT}`}`,
    });
    res.setHeader('Content-Type', 'text/html').send(html);
  }),
);

async function startServer() {
  await prisma.$connect();
  await ensureLegacyInstanceConfig();

  if (config.NODE_ENV !== 'production') {
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
