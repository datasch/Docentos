/**
 * Server Principal Express.js para DocentOS
 *
 * Integra:
 * 1. Rutas de la API con RBAC, Pase VIP y Muro de Pago
 * 2. Servicio de Google Drive para videos
 * 3. Sistema de Mentoría y Comentarios en tiempo real
 * 4. Integración con Vite para desarrollo y producción
 */

import express from 'express';
import path from 'path';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import { authenticateUser, requireRole, createCourseAccessGuard, UserRole } from './server/authMiddleware.js';
import { searchDriveVideos, getDriveFileInfo } from './server/driveService.js';
import { createSetupGuard } from './server/setupGuard.js';
import { sendTelemetryCallHome } from './server/telemetryService.js';

const app = express();
const PORT = 3000;

// Habilitar trust proxy para entornos detrás de un Reverse Proxy (Cloud Run / Nginx / Dev Server)
app.set('trust proxy', 1);

// ==================== PILAR 1: SECURITY HARDENING & CORS ====================
app.use(
  helmet({
    contentSecurityPolicy: false, // Vite inline scripts & Google Drive/YouTube embeds
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

app.use(
  cors({
    origin: process.env.ALLOWED_ORIGIN || '*',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'x-user-id', 'x-user-role', 'x-user-email'],
  })
);

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

app.use(express.json({ limit: '5mb' }));

// Anti-Brute-Force Rate Limiters
const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // Máximo 5 intentos por IP cada 15 minutos
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false, trustProxy: false },
  message: {
    success: false,
    error: 'Demasiados intentos de autenticación. Por seguridad, reintenta en 15 minutos.',
  },
});

const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false, trustProxy: false },
  message: {
    success: false,
    error: 'Límite de solicitudes de la API alcanzado. Intenta de nuevo más tarde.',
  },
});

app.use('/api/auth/login', authRateLimiter);
app.use('/api/auth/register', authRateLimiter);
app.use('/api/', apiRateLimiter);

// Strict Zod Validation Schemas
const loginSchema = z.object({
  email: z.string().email('Formato de email inválido').max(255),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres').max(128),
});

const registerSchema = z.object({
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').max(100),
  email: z.string().email('Formato de email inválido').max(255),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres').max(128),
  role: z.string().optional(),
});


// Dynamic App Name for White-Label Setup
let configuredAppName = process.env.VITE_APP_NAME || 'DocentOS';

// In-Memory Database Stores (Syncs structure with Prisma Models)
const usersStore = [
  {
    id: 'user-admin-01',
    email: 'giantucchi@academia.com',
    name: 'Prof. Giantucchi (Director General)',
    role: 'ADMIN' as UserRole,
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  },
  {
    id: 'user-mentor-01',
    email: 'sofia.mentor@giantucchi.com',
    name: 'Ing. Sofia Ruiz (Mentor Senior)',
    role: 'MENTOR' as UserRole,
    avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
  },
  {
    id: 'user-mentee-01',
    email: 'carlos.vip@giantucchi.com',
    name: 'Carlos Mendoza (Mentee / VIP)',
    role: 'MENTEE' as UserRole,
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
  },
  {
    id: 'user-public-01',
    email: 'estudiante@gmail.com',
    name: 'Ana Silva (Usuario Público)',
    role: 'PUBLIC_USER' as UserRole,
    avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
  },
];

let currentActiveUser = usersStore[3]; // Default to Public User for landing / catalog demo

// Mentees Assigned Store
const menteesStore = [
  {
    id: 'user-mentee-01',
    name: 'Carlos Mendoza',
    email: 'carlos.vip@giantucchi.com',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    assignedMentorId: 'user-mentor-01',
    courseProgress: 75,
    completedVideosCount: 6,
    totalVideosCount: 8,
    lastActiveDate: 'Hace 10 min',
    status: 'ACTIVE' as const,
  },
  {
    id: 'mentee-demo-02',
    name: 'Roberto Gómez',
    email: 'roberto@empresa.com',
    avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    assignedMentorId: 'user-mentor-01',
    courseProgress: 40,
    completedVideosCount: 3,
    totalVideosCount: 8,
    lastActiveDate: 'Ayer',
    status: 'ACTIVE' as const,
  },
  {
    id: 'mentee-demo-03',
    name: 'Mariana Torres',
    email: 'mariana.dev@gmail.com',
    avatarUrl: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&auto=format&fit=crop&q=80',
    assignedMentorId: 'user-admin-01',
    courseProgress: 100,
    completedVideosCount: 8,
    totalVideosCount: 8,
    lastActiveDate: 'Hace 2 días',
    status: 'GRADUATED' as const,
  },
];

// Plugins Store
const pluginsStore = [
  {
    id: 'pdf-certificates',
    name: 'Plugin de Certificados PDF Institucionales',
    description: 'Genera y emite un certificado oficial firmado al completar el 100% de un programa o curso de mentoría.',
    version: '1.2.0',
    enabled: true,
    category: 'certificates',
    icon: 'Award',
    config: {
      institutionName: 'DocentOS',
      signatoryTitle: 'Prof. Giantucchi - Mentor Director',
      primaryColor: '#06b6d4',
      badgeText: 'Certificado de Excelencia Técnica',
    },
  },
  {
    id: 'interactive-quizzes',
    name: 'Plugin de Exámenes & Evaluaciones Interactivos',
    description: 'Habilita cuestionarios de validación de conocimientos y exámenes rápidos al finalizar cada módulo.',
    version: '2.0.1',
    enabled: true,
    category: 'quizzes',
    icon: 'CheckSquare',
    config: {
      passingScore: 80,
      allowRetakes: true,
      showExplanations: true,
    },
  },
  {
    id: 'discord-slack-bridge',
    name: 'Plugin de Integración Discord / Slack Webhook',
    description: 'Notifica en canales de la comunidad en tiempo real cuando un alumno realiza preguntas de mentoría o completa módulos.',
    version: '1.0.4',
    enabled: true,
    category: 'integrations',
    icon: 'MessageSquare',
    config: {
      webhookUrl: 'https://discord.com/api/webhooks/demo-giantucchi-academy',
      notifyOnQnA: true,
      notifyOnCompletion: true,
    },
  },
  {
    id: 'learning-analytics',
    name: 'Plugin de Analítica de Rendimiento de Mentees',
    description: 'Visualiza mapas de calor de estudio, duraciones medias por video y tasa de retención estudiantil.',
    version: '1.1.0',
    enabled: true,
    category: 'analytics',
    icon: 'BarChart3',
    config: {
      enableHeatmaps: true,
      trackSessionDuration: true,
    },
  },
];

// ==================== LANDING PAGE CMS CONFIG STORE ====================
let landingConfigStore = {
  heroTitle: 'El Motor de Aprendizaje Abierto con IA Nativa & Mentoría',
  heroSubtitle: 'DocentOS es la alternativa moderna, liviana y modular de código abierto frente a plataformas LMS tradicionales monolíticas como Moodle u Odoo LMS.',
  heroMediaUrl: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=1200&auto=format&fit=crop',
  heroCtaText: 'Explorar Cursos',
  heroCtaLink: '#courses',
  heroSecondaryCtaText: 'Pase VIP',
  heroSecondaryCtaLink: '#vip',
  featuredCourseIds: ['course-giantucchi-mastery'],
  bannerEnabled: true,
  bannerText: '🚀 ¡Novedad en DocentOS v2.5! Motor de IA optimizado, gestión de guías vocales e integración con Drive.',
  bannerLinkText: 'Ver Novedades',
  bannerLinkUrl: '#',
  benefits: [
    {
      id: 'b1',
      icon: 'Brain',
      title: 'Motor AI-Native Integrado',
      description: 'Generación dinámica de contenidos, guías vocales de mentoría en tiempo real y asistente IA "Ian".',
    },
    {
      id: 'b2',
      icon: 'Video',
      title: 'Streaming Nativo con Google Drive',
      description: 'Indexación automática de lecciones y videos en streaming directamente desde carpetas de Google Drive.',
    },
    {
      id: 'b3',
      icon: 'ShieldCheck',
      title: 'Control de Roles RBAC & Single-Admin',
      description: 'Permisos jerárquicos estrictos con garantía de Administrador Único y pases VIP de acceso ilimitado.',
    },
    {
      id: 'b4',
      icon: 'Layers',
      title: 'Arquitectura Modular de Plugins',
      description: 'Amplía la funcionalidad del LMS con módulos de Certificados PDF, Exámenes interconectados y Webhooks.',
    },
  ],
  testimonials: [
    {
      id: 't1',
      name: 'Carlos Mendoza',
      role: 'Estudiante VIP & Software Engineer',
      avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
      comment: 'DocentOS me permitió completar la mentoría técnica con guías explicativas por audio e interactuar directamente con los mentores.',
      rating: 5,
    },
    {
      id: 't2',
      name: 'Ing. Sofia Ruiz',
      role: 'Mentor Director en DocentOS',
      avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150',
      comment: 'Gestión directa de estudiantes, revisión centralizada de preguntas y vinculación automática de videos en minutos.',
      rating: 5,
    },
  ],
  footerText: 'DocentOS Community Edition',
  githubUrl: 'https://github.com/giantucchi/docentos',
  discordUrl: '',
  twitterUrl: '',
  linkedinUrl: '',
};

// ==================== FIRST RUN SETUP & TELEMETRY API ====================

// Check if setup is required
app.get('/api/setup/status', (req, res) => {
  const isSetupRequired = usersStore.length === 0;
  res.json({
    isSetupRequired,
    userCount: usersStore.length,
    appName: configuredAppName,
  });
});

// Process First Run Setup (Initial Admin Creation & Telemetry "Call Home")
app.post('/api/setup', async (req, res) => {
  const { name, email, password, appName, consentTelemetry } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Nombre, email y contraseña son obligatorios' });
  }

  // Single-Admin Rule Validation
  const existingAdmin = usersStore.find((u) => u.role === 'ADMIN');
  if (existingAdmin) {
    return res.status(400).json({
      error: `Regla de Administrador Único: Ya existe un Administrador registrado (${existingAdmin.email}). No se puede ejecutar el setup para crear un segundo ADMIN.`,
    });
  }

  if (appName) {
    configuredAppName = appName;
  }

  // Create Initial Super Admin User
  const newAdminUser = {
    id: `user-admin-${Date.now()}`,
    email,
    name,
    role: 'ADMIN' as UserRole,
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  };

  usersStore.unshift(newAdminUser);
  currentActiveUser = newAdminUser;

  // Execute Telemetry ("Call Home")
  const telemetryResult = await sendTelemetryCallHome({
    adminEmail: email,
    adminName: name,
    appName: configuredAppName,
    consentTelemetry: consentTelemetry !== false,
  });

  res.json({
    success: true,
    message: '¡Instalación inicial completada con éxito! Usuario Administrador registrado.',
    user: newAdminUser,
    appName: configuredAppName,
    telemetry: telemetryResult,
  });
});


// Setup Guard Middleware - Protects all API routes if user count === 0
app.use(createSetupGuard(() => usersStore.length));

// Store user payments: Map<userId, Set<courseId>>
const paymentsStore = new Map<string, Set<string>>();

// Initial Courses & Drive Video Links
const coursesStore = [
  {
    id: 'course-giantucchi-mastery',
    title: 'Programa de Mentoría Elite Giantucchi: Full-Stack & Cloud Architecture',
    description: 'Aprende a construir aplicaciones web completas a nivel empresarial con React, Node.js, Prisma, Google Drive API y patrones de arquitectura resiliente con acceso directo a mentorías.',
    price: 149.0,
    published: true,
    category: 'Mentoría Premium',
    coverImage: 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=800&auto=format&fit=crop&q=80',
    modules: [
      {
        id: 'module-1',
        title: 'Módulo 1: Fundamentos y Mentalidad Giantucchi',
        description: 'Bases metodológicas y diseño de sistemas escalables.',
        order: 1,
        videos: [
          {
            id: 'video-1a',
            driveFileId: '1a_Giantucchi_Intro_Fundamentos',
            title: '01. Fundamentos de la Metodología Giantucchi & Mentalidad de Alto Impacto',
            duration: '18:45',
            description: 'Estructura de aprendizaje acelerado y patrones de diseño recomendados por Giantucchi.',
            mimeType: 'video/mp4',
            embedUrl: 'https://drive.google.com/file/d/15_m3K8e_Giantucchi_Fundamentos/preview',
            order: 1,
          },
          {
            id: 'video-1b',
            driveFileId: '1b_Giantucchi_Arquitectura',
            title: '02. Arquitectura de Sistemas Distribuidos y Escala Empresarial',
            duration: '32:10',
            description: 'Principios SOLID, separación de capas y gestión limpia de datos.',
            mimeType: 'video/mp4',
            embedUrl: 'https://drive.google.com/file/d/16_m3K8e_Giantucchi_Arquitectura/preview',
            order: 2,
          },
        ],
      },
      {
        id: 'module-2',
        title: 'Módulo 2: Base de Datos & Prisma ORM Avanzado',
        description: 'PostgreSQL, modelado de relaciones y migraciones.',
        order: 2,
        videos: [
          {
            id: 'video-1c',
            driveFileId: '1c_Giantucchi_Postgres_Prisma',
            title: '03. Modelado Avanzado en PostgreSQL con Prisma ORM & Índices',
            duration: '26:50',
            description: 'Uso práctico del esquema de Prisma para Users, Payments y MentorshipComments.',
            mimeType: 'video/mp4',
            embedUrl: 'https://drive.google.com/file/d/17_m3K8e_Giantucchi_Postgres/preview',
            order: 1,
          },
        ],
      },
      {
        id: 'module-3',
        title: 'Módulo 3: Seguridad, Roles RBAC & Muro de Pago',
        description: 'Mecanismos de autenticación y Bypass VIP.',
        order: 3,
        videos: [
          {
            id: 'video-2a',
            driveFileId: '2a_Giantucchi_Seguridad_RBAC',
            title: '04. Seguridad Robusta: Autenticación JWT, RBAC y Bypass VIP',
            duration: '22:15',
            description: 'Implementación de roles Admin, VIP y External con guardias de ruta en Express.',
            mimeType: 'video/mp4',
            embedUrl: 'https://drive.google.com/file/d/18_m3K8e_Giantucchi_Seguridad/preview',
            order: 1,
          },
        ],
      },
      {
        id: 'module-4',
        title: 'Módulo 4: Cloud & Despliegue en Producción',
        description: 'Integración con Google Drive API y Cloud Run.',
        order: 4,
        videos: [
          {
            id: 'video-2b',
            driveFileId: '2b_Giantucchi_Despliegue_Cloud',
            title: '05. Despliegue en la Nube y Optimización de Rendimiento',
            duration: '40:00',
            description: 'Streaming de videos desde Google Drive y bundling para producción.',
            mimeType: 'video/mp4',
            embedUrl: 'https://drive.google.com/file/d/19_m3K8e_Giantucchi_Despliegue/preview',
            order: 1,
          },
        ],
      },
    ],
  },
];

// Mentorship Comments Store
const commentsStore = [
  {
    id: 'comment-1',
    videoId: 'video-1a',
    userId: 'user-external-01',
    userName: 'Ana Silva',
    userRole: 'EXTERNAL' as UserRole,
    userAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
    content: '¿Cómo puedo aplicar la separación de capas cuando tengo llamadas asíncronas intensivas en el backend?',
    isMentorResponse: false,
    isResolved: true,
    likes: 4,
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    replies: [
      {
        id: 'comment-reply-1',
        videoId: 'video-1a',
        userId: 'user-admin-01',
        userName: 'Prof. Giantucchi (Mentor)',
        userRole: 'ADMIN' as UserRole,
        userAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
        content: '¡Excelente pregunta Ana! La clave reside en aislar el `DriveService` o adaptador externo dentro de una capa de infraestructura y consumirlo mediante controladores ligeros.',
        isMentorResponse: true,
        isResolved: true,
        likes: 9,
        createdAt: new Date(Date.now() - 86400000).toISOString(),
      },
    ],
  },
  {
    id: 'comment-2',
    videoId: 'video-1c',
    userId: 'user-vip-01',
    userName: 'Carlos Mendoza (VIP)',
    userRole: 'VIP' as UserRole,
    userAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    content: '¿El esquema de Prisma soporta consultas inversas cuando se agregan respuestas anidadas en los comentarios?',
    isMentorResponse: false,
    isResolved: false,
    likes: 2,
    createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
    replies: [],
  },
];

// User Progress store: Set of `${userId}_${videoId}`
const userProgressStore = new Set<string>();

// TTS Gamified Mentorship Guides Store
const ttsGuidesStore = [
  {
    id: 'tts-guide-1',
    courseId: 'course-giantucchi-mastery',
    moduleId: 'module-1',
    videoId: 'video-1a',
    title: 'Guía de Orientación: Metodología Giantucchi',
    scriptText: '¡Hola! Bienvenido al Módulo 1 de la Academia Giantucchi. En este video aprenderás los 3 pilares clave para construir arquitecturas limpias y dominar el desarrollo Full-Stack. ¡Presta atención especial al minuto 5 para el tip de optimización de bases de datos!',
    voiceId: 'es-ES-Carlos',
    voiceSpeed: 1.0,
    mentorName: 'Prof. Giantucchi',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    xpReward: 50,
    createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
  },
  {
    id: 'tts-guide-2',
    courseId: 'course-giantucchi-mastery',
    moduleId: 'module-3',
    videoId: 'video-2a',
    title: 'Guía Gamificada: Control de Acceso RBAC & Pase VIP',
    scriptText: '¡Socio VIP! En esta clase técnica abordaremos la protección de rutas con tokens JWT y el bypass VIP en Express. Revisa el código del servidor y activa los guards de seguridad al finalizar.',
    voiceId: 'es-MX-Sofia',
    voiceSpeed: 1.0,
    mentorName: 'Sofia VIP Mentor',
    avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
    xpReward: 50,
    createdAt: new Date(Date.now() - 86400000).toISOString(),
  },
];


// Global middleware for user injection
app.use((req, res, next) => {
  req.headers['x-user-id'] = currentActiveUser.id;
  req.headers['x-user-role'] = currentActiveUser.role;
  req.headers['x-user-email'] = currentActiveUser.email;
  req.headers['x-user-name'] = currentActiveUser.name;
  authenticateUser(req, res, next);
});

// Guard helper for course paywall access
const courseAccessGuard = createCourseAccessGuard(paymentsStore);

// ==================== API ROUTES ====================

// 1. Get Current User Info
app.get('/api/me', (req, res) => {
  res.json({
    user: currentActiveUser,
    allDemoUsers: usersStore,
    hasPaidDefaultCourse: paymentsStore.get(currentActiveUser.id)?.has('course-giantucchi-mastery') || false,
  });
});

// 2. Switch Role / Active User (For Live Demo & Testing)
app.post('/api/users/switch-role', (req, res) => {
  const { role, userId } = req.body;
  if (userId) {
    const found = usersStore.find((u) => u.id === userId);
    if (found) {
      currentActiveUser = found;
      return res.json({ success: true, user: currentActiveUser });
    }
  }

  if (role) {
    const targetUser = usersStore.find((u) => u.role === role);
    if (targetUser) {
      currentActiveUser = targetUser;
    } else {
      currentActiveUser.role = role as UserRole;
    }
    return res.json({ success: true, user: currentActiveUser });
  }

  res.status(400).json({ error: 'Rol o UserId no provisto' });
});

// 3. Get All Courses with Access Status
app.get('/api/courses', (req, res) => {
  const user = req.user!;
  const hasAccess =
    user.role === 'ADMIN' ||
    user.role === 'VIP' ||
    (paymentsStore.get(user.id)?.has('course-giantucchi-mastery') ?? false);

  const formattedCourses = coursesStore.map((course) => ({
    ...course,
    hasAccess,
    userRole: user.role,
    requiresPaywall: !hasAccess,
  }));

  res.json({ courses: formattedCourses, userRole: user.role, hasAccess });
});

// 4. Get Course Details with Access Validation
app.get('/api/courses/:courseId', (req, res) => {
  const { courseId } = req.params;
  const course = coursesStore.find((c) => c.id === courseId);

  if (!course) {
    return res.status(404).json({ error: 'Curso no encontrado' });
  }

  const user = req.user!;
  const hasAccess =
    user.role === 'ADMIN' ||
    user.role === 'VIP' ||
    (paymentsStore.get(user.id)?.has(courseId) ?? false);

  res.json({
    course,
    hasAccess,
    userRole: user.role,
    requiresPaywall: !hasAccess,
  });
});

// 5. Check Course Access Endpoint
app.get('/api/courses/:courseId/access', (req, res) => {
  const { courseId } = req.params;
  const user = req.user!;

  const isVipOrAdmin = user.role === 'ADMIN' || user.role === 'VIP';
  const hasPaid = paymentsStore.get(user.id)?.has(courseId) || false;
  const hasAccess = isVipOrAdmin || hasPaid;

  res.json({
    courseId,
    userRole: user.role,
    hasAccess,
    isVipOrAdmin,
    hasPaid,
    priceUSD: 149.0,
  });
});

// 6. Simulate Stripe Payment Checkout for External User
app.post('/api/payments/checkout', (req, res) => {
  const { courseId } = req.body;
  const user = req.user!;

  if (!paymentsStore.has(user.id)) {
    paymentsStore.set(user.id, new Set());
  }
  paymentsStore.get(user.id)!.add(courseId || 'course-giantucchi-mastery');

  res.json({
    success: true,
    message: '¡Pago procesado con éxito! Tienes acceso ilimitado a los contenidos de Academia Giantucchi.',
    payment: {
      id: `pay-${Date.now()}`,
      userId: user.id,
      courseId: courseId || 'course-giantucchi-mastery',
      amount: 149.0,
      status: 'COMPLETED',
      stripeSessionId: `cs_test_${Math.random().toString(36).substring(2)}`,
      createdAt: new Date().toISOString(),
    },
  });
});

// 7. Activate VIP Pass (Bypass Paywall)
app.post('/api/vip/activate', (req, res) => {
  const user = req.user!;

  currentActiveUser.role = 'VIP';
  user.role = 'VIP';

  res.json({
    success: true,
    message: '¡Pase VIP Activado con éxito! Has obtenido acceso total y mentoría prioritaria.',
    user: currentActiveUser,
  });
});

// 8. Google Drive API Search & Video Listing
app.get('/api/drive/videos', async (req, res) => {
  const query = req.query.q as string;
  const folderId = req.query.folderId as string;

  try {
    const videos = await searchDriveVideos(query, folderId);
    res.json({ success: true, count: videos.length, videos });
  } catch (error) {
    res.status(500).json({ error: 'Error al buscar videos en Google Drive' });
  }
});

// 9. Google Drive File Details
app.get('/api/drive/file/:fileId', async (req, res) => {
  const { fileId } = req.params;
  try {
    const fileInfo = await getDriveFileInfo(fileId);
    res.json({ success: true, file: fileInfo });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener información del archivo de Drive' });
  }
});

// 10. Get Comments for a Video
app.get('/api/videos/:videoId/comments', (req, res) => {
  const { videoId } = req.params;
  const videoComments = commentsStore.filter((c) => c.videoId === videoId);
  res.json({ comments: videoComments });
});

// 11. Add Question / Comment to Video
app.post('/api/videos/:videoId/comments', (req, res) => {
  const { videoId } = req.params;
  const { content } = req.body;
  const user = req.user!;

  if (!content || !content.trim()) {
    return res.status(400).json({ error: 'El contenido del comentario es obligatorio' });
  }

  const newComment = {
    id: `comment-${Date.now()}`,
    videoId,
    userId: user.id,
    userName: user.name,
    userRole: user.role,
    userAvatar: currentActiveUser.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
    content: content.trim(),
    isMentorResponse: user.role === 'ADMIN',
    isResolved: false,
    likes: 0,
    createdAt: new Date().toISOString(),
    replies: [],
  };

  commentsStore.unshift(newComment);
  res.json({ success: true, comment: newComment });
});

// 12. Reply to a Comment (Mentor Response)
app.post('/api/comments/:commentId/reply', (req, res) => {
  const { commentId } = req.params;
  const { content } = req.body;
  const user = req.user!;

  const parentComment = commentsStore.find((c) => c.id === commentId);
  if (!parentComment) {
    return res.status(404).json({ error: 'Comentario original no encontrado' });
  }

  const reply = {
    id: `reply-${Date.now()}`,
    videoId: parentComment.videoId,
    userId: user.id,
    userName: user.role === 'ADMIN' ? 'Prof. Giantucchi (Mentor)' : user.name,
    userRole: user.role,
    userAvatar: currentActiveUser.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    content: content.trim(),
    isMentorResponse: user.role === 'ADMIN',
    isResolved: true,
    likes: 1,
    createdAt: new Date().toISOString(),
  };

  if (!parentComment.replies) parentComment.replies = [];
  parentComment.replies.push(reply);

  if (user.role === 'ADMIN') {
    parentComment.isResolved = true;
  }

  res.json({ success: true, reply, parentComment });
});

// 13. Like / Upvote Comment
app.post('/api/comments/:commentId/like', (req, res) => {
  const { commentId } = req.params;
  const comment = commentsStore.find((c) => c.id === commentId);

  if (comment) {
    comment.likes += 1;
    return res.json({ success: true, likes: comment.likes });
  }

  res.status(404).json({ error: 'Comentario no encontrado' });
});

// 14. Video Progress
app.get('/api/progress', (req, res) => {
  const user = req.user!;
  const prefix = `${user.id}_`;
  const completedMap: Record<string, boolean> = {};

  userProgressStore.forEach((key) => {
    if (key.startsWith(prefix)) {
      const videoId = key.substring(prefix.length);
      completedMap[videoId] = true;
    }
  });

  res.json({ success: true, completedVideos: completedMap });
});

app.post('/api/progress', (req, res) => {
  const user = req.user!;
  const { videoId, completed } = req.body;

  if (!videoId) {
    return res.status(400).json({ error: 'videoId es requerido' });
  }

  const key = `${user.id}_${videoId}`;
  if (completed !== false) {
    userProgressStore.add(key);
  } else {
    userProgressStore.delete(key);
  }

  res.json({ success: true, videoId, completed: completed !== false });
});

// Video Notes Store & Endpoints
const videoNotesStore: Array<{
  id: string;
  videoId: string;
  userId: string;
  userName: string;
  timestampSeconds: number;
  content: string;
  createdAt: string;
}> = [
  {
    id: 'note-1',
    videoId: 'vid-101',
    userId: 'user-admin-01',
    userName: 'Prof. Giantucchi',
    timestampSeconds: 45,
    content: 'Punto clave sobre desacoplamiento de servicios y arquitectura modular.',
    createdAt: new Date().toISOString(),
  },
];

app.get('/api/notes/:videoId', (req, res) => {
  const { videoId } = req.params;
  const notes = videoNotesStore.filter((n) => n.videoId === videoId);
  res.json({ success: true, notes });
});

app.post('/api/notes', (req, res) => {
  const user = req.user || currentActiveUser;
  const { videoId, timestampSeconds, content } = req.body;

  if (!videoId || !content) {
    return res.status(400).json({ error: 'videoId y content son obligatorios' });
  }

  const newNote = {
    id: `note-${Date.now()}`,
    videoId,
    userId: user.id,
    userName: user.name,
    timestampSeconds: Number(timestampSeconds) || 0,
    content: String(content),
    createdAt: new Date().toISOString(),
  };

  videoNotesStore.unshift(newNote);
  res.json({ success: true, note: newNote });
});

// Moderation Endpoint
app.put('/api/admin/users/:userId/moderation', (req, res) => {
  const { userId } = req.params;
  const { strikes, isActive } = req.body;

  const targetUser = usersStore.find((u) => u.id === userId);
  if (!targetUser) {
    return res.status(404).json({ error: 'Usuario no encontrado' });
  }

  if (typeof strikes === 'number') {
    (targetUser as any).strikes = strikes;
  }
  if (typeof isActive === 'boolean') {
    (targetUser as any).isActive = isActive;
  }

  // Also sync in menteesStore if exists
  const targetMentee = menteesStore.find((m) => m.id === userId);
  if (targetMentee) {
    if (typeof strikes === 'number') (targetMentee as any).strikes = strikes;
    if (typeof isActive === 'boolean') (targetMentee as any).isActive = isActive;
  }

  res.json({ success: true, user: targetUser });
});

// Course Price Update Endpoint
app.put('/api/courses/:courseId/price', (req, res) => {
  const { courseId } = req.params;
  const { price } = req.body;

  const course = coursesStore.find((c) => c.id === courseId);
  if (!course) {
    return res.status(404).json({ error: 'Curso no encontrado' });
  }

  course.price = Number(price) || 0;
  res.json({ success: true, course });
});

// 15. Authentication Endpoints (Login / Register / Me)
app.post('/api/auth/login', (req, res) => {
  const parseResult = loginSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      error: 'Error de validación de entrada',
      details: parseResult.error.issues.map((issue) => issue.message),
    });
  }

  const { email, password } = parseResult.data;

  let user = usersStore.find((u) => u.email.toLowerCase() === email.toLowerCase());

  // If user doesn't exist, create a new demo user with requested role
  if (!user) {
    const isMentor = email.includes('mentor');
    const isAdmin = email.includes('admin') || email.includes('giantucchi');
    const isMentee = email.includes('vip') || email.includes('mentee');

    let role: UserRole = 'PUBLIC_USER';
    if (isAdmin) role = 'ADMIN';
    else if (isMentor) role = 'MENTOR';
    else if (isMentee) role = 'MENTEE';

    user = {
      id: `user-${Date.now()}`,
      email,
      name: email.split('@')[0],
      role,
      avatarUrl: `https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80`,
    };
    usersStore.push(user);
  }

  currentActiveUser = user;

  // Determine smart redirect path based on role
  let redirectPath = '/courses';
  if (user.role === 'ADMIN') redirectPath = '/admin';
  else if (user.role === 'MENTOR') redirectPath = '/mentor/dashboard';
  else if (user.role === 'MENTEE' || user.role === 'VIP') redirectPath = '/courses';

  res.json({
    success: true,
    token: `jwt-token-${user.id}-${Date.now()}`,
    user,
    redirectPath,
  });
});

app.post('/api/auth/register', (req, res) => {
  const parseResult = registerSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      error: 'Error de validación de entrada',
      details: parseResult.error.issues.map((issue) => issue.message),
    });
  }

  const { name, email, password, role } = parseResult.data;

  const existing = usersStore.find((u) => u.email.toLowerCase() === email.toLowerCase());
  if (existing) {
    return res.status(400).json({ error: 'El email ya se encuentra registrado. Inicia sesión.' });
  }


  // Single-Admin Rule Enforcement
  if (role === 'ADMIN') {
    const existingAdmin = usersStore.find((u) => u.role === 'ADMIN');
    if (existingAdmin) {
      return res.status(400).json({
        error: `Regla de Administrador Único: Ya existe un Administrador registrado en el sistema (${existingAdmin.email}). No se permite crear una segunda cuenta con rol ADMIN.`,
      });
    }
  }

  const newUser = {
    id: `user-${Date.now()}`,
    email,
    name,
    role: (role as UserRole) || 'PUBLIC_USER',
    avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
  };

  usersStore.push(newUser);
  currentActiveUser = newUser;

  let redirectPath = '/courses';
  if (newUser.role === 'ADMIN') redirectPath = '/admin';
  else if (newUser.role === 'MENTOR') redirectPath = '/mentor/dashboard';

  res.json({
    success: true,
    token: `jwt-token-${newUser.id}-${Date.now()}`,
    user: newUser,
    redirectPath,
  });
});


app.get('/api/auth/me', (req, res) => {
  res.json({
    user: currentActiveUser,
    hasAccess: ['ADMIN', 'MENTOR', 'MENTEE', 'VIP'].includes(currentActiveUser.role),
  });
});

app.post('/api/auth/logout', (req, res) => {
  // Reset to default public user
  const publicUser = usersStore.find((u) => u.role === 'PUBLIC_USER') || usersStore[3];
  currentActiveUser = publicUser;
  res.json({ success: true, message: 'Sesión cerrada correctamente' });
});

// 16. Plugin System API
app.get('/api/plugins', (req, res) => {
  res.json({ success: true, plugins: pluginsStore });
});

app.post('/api/plugins/toggle', (req, res) => {
  const { pluginId, enabled } = req.body;
  const plugin = pluginsStore.find((p) => p.id === pluginId);

  if (!plugin) {
    return res.status(404).json({ error: 'Plugin no encontrado' });
  }

  plugin.enabled = enabled !== undefined ? enabled : !plugin.enabled;
  res.json({ success: true, plugin, plugins: pluginsStore });
});

app.post('/api/plugins/config', (req, res) => {
  const { pluginId, config } = req.body;
  const plugin = pluginsStore.find((p) => p.id === pluginId);

  if (!plugin) {
    return res.status(404).json({ error: 'Plugin no encontrado' });
  }

  plugin.config = { ...plugin.config, ...config };
  res.json({ success: true, plugin, plugins: pluginsStore });
});

// 17. Mentor Panel API (Mentees & Q&A)
app.get('/api/mentor/mentees', (req, res) => {
  res.json({ success: true, mentees: menteesStore });
});

app.post('/api/mentor/assign-mentee', (req, res) => {
  const { name, email, mentorId } = req.body;

  if (!name || !email) {
    return res.status(400).json({ error: 'Nombre y email son requeridos' });
  }

  const newMentee = {
    id: `mentee-${Date.now()}`,
    name,
    email,
    avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
    assignedMentorId: mentorId || 'user-mentor-01',
    courseProgress: 0,
    completedVideosCount: 0,
    totalVideosCount: 8,
    lastActiveDate: 'Reciente',
    status: 'ACTIVE' as const,
  };

  menteesStore.unshift(newMentee);
  res.json({ success: true, mentee: newMentee });
});

app.get('/api/mentor/qna', (req, res) => {
  res.json({ success: true, comments: commentsStore });
});

// 15. Admin Endpoint: Manage User Roles
app.get('/api/admin/users', requireRole(['ADMIN']), (req, res) => {
  res.json({ users: usersStore });
});

app.put('/api/admin/users/:userId/role', requireRole(['ADMIN']), (req, res) => {
  const { userId } = req.params;
  const { role } = req.body;

  const targetUser = usersStore.find((u) => u.id === userId);
  if (!targetUser) {
    return res.status(404).json({ error: 'Usuario no encontrado' });
  }

  // Single-Admin Rule Enforcement
  if (role === 'ADMIN' && targetUser.role !== 'ADMIN') {
    const existingAdmin = usersStore.find((u) => u.role === 'ADMIN' && u.id !== userId);
    if (existingAdmin) {
      return res.status(400).json({
        error: `Regla de Administrador Único: Ya existe un Administrador activo en el sistema (${existingAdmin.name} - ${existingAdmin.email}). Solo puede existir un único Administrador en DocentOS. Para promover a este usuario, primero debes degradar al administrador actual.`,
      });
    }
  }

  targetUser.role = role as UserRole;
  res.json({ success: true, user: targetUser });
});

// ==================== LANDING PAGE CMS ENDPOINTS ====================
app.get('/api/public/landing-config', (req, res) => {
  res.json({ success: true, config: landingConfigStore });
});

app.put('/api/admin/landing-config', requireRole(['ADMIN']), (req, res) => {
  const newConfig = req.body;

  if (!newConfig || typeof newConfig !== 'object') {
    return res.status(400).json({ error: 'Configuración no válida' });
  }

  landingConfigStore = {
    ...landingConfigStore,
    ...newConfig,
  };

  res.json({
    success: true,
    config: landingConfigStore,
    message: '¡Configuración de la portada actualizada exitosamente!',
  });
});


// 16. Admin Endpoint: Add Video to Module from Google Drive
app.post('/api/admin/modules/:moduleId/videos', requireRole(['ADMIN']), (req, res) => {
  const { moduleId } = req.params;
  const { driveFileId, title, duration, description, embedUrl } = req.body;

  let targetModule: any = null;
  for (const course of coursesStore) {
    const mod = course.modules.find((m) => m.id === moduleId);
    if (mod) {
      targetModule = mod;
      break;
    }
  }

  if (!targetModule) {
    return res.status(404).json({ error: 'Módulo no encontrado' });
  }

  const newVideo = {
    id: `video-${Date.now()}`,
    driveFileId: driveFileId || `drive-${Date.now()}`,
    title: title || 'Nuevo Video de Mentoría',
    duration: duration || '20:00',
    description: description || 'Video importado desde Google Drive.',
    mimeType: 'video/mp4',
    embedUrl: embedUrl || `https://drive.google.com/file/d/${driveFileId}/preview`,
    order: targetModule.videos.length + 1,
  };

  targetModule.videos.push(newVideo);
  res.json({ success: true, video: newVideo, module: targetModule });
});

// 17. TTS Gamified Mentorship Guides Endpoints
app.get('/api/tts-guides', (req, res) => {
  const { videoId, courseId } = req.query;
  let guides = ttsGuidesStore;

  if (videoId) {
    guides = guides.filter((g) => g.videoId === videoId);
  } else if (courseId) {
    guides = guides.filter((g) => g.courseId === courseId);
  }

  res.json({ guides });
});

app.post('/api/tts-guides', requireRole(['ADMIN']), (req, res) => {
  const { title, scriptText, voiceId, voiceSpeed, courseId, moduleId, videoId, xpReward } = req.body;

  if (!scriptText || !scriptText.trim()) {
    return res.status(400).json({ error: 'El texto del guion de la guía es obligatorio' });
  }

  const newGuide = {
    id: `tts-guide-${Date.now()}`,
    courseId: courseId || 'course-giantucchi-mastery',
    moduleId: moduleId || 'module-1',
    videoId: videoId || 'video-1a',
    title: title || 'Guía Gamificada de Mentoría',
    scriptText: scriptText.trim(),
    voiceId: voiceId || 'es-ES-Carlos',
    voiceSpeed: Number(voiceSpeed) || 1.0,
    mentorName: currentActiveUser.name || 'Prof. Giantucchi',
    avatarUrl: currentActiveUser.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    xpReward: Number(xpReward) || 50,
    createdAt: new Date().toISOString(),
  };

  ttsGuidesStore.unshift(newGuide);
  res.json({ success: true, guide: newGuide, message: '¡Guía de mentoría TTS generada y guardada con éxito!' });
});

app.delete('/api/tts-guides/:id', requireRole(['ADMIN']), (req, res) => {
  const { id } = req.params;
  const index = ttsGuidesStore.findIndex((g) => g.id === id);

  if (index !== -1) {
    ttsGuidesStore.splice(index, 1);
    return res.json({ success: true, message: 'Guía eliminada correctamente' });
  }

  res.status(404).json({ error: 'Guía no encontrada' });
});

// 18. Feedback Store & Endpoints
const feedbackStore: Array<{
  id: string;
  userId: string;
  userName: string;
  rating: number;
  comment: string;
  createdAt: string;
}> = [];

app.post('/api/feedback', (req, res) => {
  const { rating, comment } = req.body;
  const newFeedback = {
    id: `fb-${Date.now()}`,
    userId: currentActiveUser.id,
    userName: currentActiveUser.name,
    rating: Number(rating) || 5,
    comment: comment || '',
    createdAt: new Date().toISOString(),
  };

  feedbackStore.unshift(newFeedback);
  res.json({ success: true, feedback: newFeedback, message: '¡Gracias por tu opinión!' });
});

app.get('/api/feedback', requireRole(['ADMIN']), (req, res) => {
  res.json({ feedback: feedbackStore });
});

// 19. AI Script Generator Endpoint (Hybrid Manual + Gemini AI)
app.post('/api/ai/generate-script', requireRole(['ADMIN']), async (req, res) => {
  const { lessonTitle, language, customInstructions } = req.body;

  const targetLang = language || 'es';
  const topic = lessonTitle || 'Lección de Mentoría Técnica';

  let generatedScript = '';

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey && apiKey !== 'MY_GEMINI_API_KEY' && apiKey.length > 5) {
      const ai = new GoogleGenAI({ apiKey });
      const prompt = `Actúa como el Mentor Senior de la Academia Educativa. Redacta un guion introductorio motivador y conciso (máximo 2 párrafos, 90 palabras) para la clase "${topic}".
Idioma del guion: ${targetLang}. Instrucciones especiales: ${customInstructions || 'Ninguna'}.
No incluyas corchetes ni marcas de tiempo, sólo el texto para ser leído por un motor de voz TTS.`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });

      if (response.text) {
        generatedScript = response.text.trim();
      }
    }
  } catch (err) {
    console.warn('Gemini AI note (using structured fallback):', err);
  }

  // Fallback if no API key or call exception
  if (!generatedScript) {
    if (targetLang.startsWith('en')) {
      generatedScript = `Welcome to the lesson "${topic}". Today we will explore key technical strategies to master this topic step by step. Pay close attention to the optimization tips.\n\nMake sure to review the code repository and ask any questions in the VIP mentorship forum at the end. Let's begin!`;
    } else if (targetLang.startsWith('pt')) {
      generatedScript = `Bem-vindo à aula "${topic}". Hoje exploraremos estratégias técnicas fundamentais para dominar este tópico passo a passo. Preste atenção especial às dicas de otimização.\n\nCertifique-se de revisar o código e tirar suas dúvidas no fórum de mentoria VIP ao final. Vamos começar!`;
    } else if (targetLang.startsWith('fr')) {
      generatedScript = `Bienvenue dans le cours "${topic}". Aujourd'hui, nous allons explorer les stratégies techniques clés pour maîtriser ce sujet étape par étape. Portez une attention particulière aux conseils d'optimisation.\n\nAssurez-vous de consulter le code et de poser vos questions dans le forum de mentorat VIP à la fin. C'est parti !`;
    } else if (targetLang.startsWith('it')) {
      generatedScript = `Benvenuto alla lezione "${topic}". Oggi esploreremo le strategie tecniche chiave per padroneggiare questo argomento passo dopo passo. Presta particolare attenzione ai suggerimenti di ottimizzazione.\n\nAssicurati di rivedere il codice e di porre domande nel forum di mentoring VIP al termine. Iniziamo!`;
    } else {
      generatedScript = `¡Hola! Bienvenido a la lección "${topic}". En esta clase exploraremos las estrategias técnicas clave para dominar este concepto paso a paso. Presta especial atención a los tips de optimización y arquitectura.\n\nAsegúrate de revisar los recursos adjuntos y de dejar tus dudas en la zona de mentoría interactiva VIP al finalizar. ¡Comencemos!`;
    }
  }

  res.json({
    success: true,
    scriptText: generatedScript,
    message: 'Guion generado exitosamente con IA.',
  });
});

// ==================== PILAR 2, 3 & 4: TECHNICAL SEO, AEO PRE-RENDER, SITEMAP & ROBOTS ====================

// 1. Dynamic Sitemap.xml Endpoint
app.get('/sitemap.xml', (req, res) => {
  const host = req.get('host') || 'localhost:3000';
  const protocol = req.protocol || 'http';
  const baseUrl = `${protocol}://${host}`;
  const currentDate = new Date().toISOString().split('T')[0];

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

  xml += `  <url>\n    <loc>${baseUrl}/</loc>\n    <lastmod>${currentDate}</lastmod>\n    <changefreq>daily</changefreq>\n    <priority>1.0</priority>\n  </url>\n`;
  xml += `  <url>\n    <loc>${baseUrl}/catalog</loc>\n    <lastmod>${currentDate}</lastmod>\n    <changefreq>daily</changefreq>\n    <priority>0.8</priority>\n  </url>\n`;

  coursesStore.forEach((course) => {
    xml += `  <url>\n    <loc>${baseUrl}/courses/${course.id}</loc>\n    <lastmod>${currentDate}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.9</priority>\n  </url>\n`;
  });

  xml += `</urlset>`;

  res.header('Content-Type', 'application/xml');
  res.send(xml);
});

// 2. Dynamic Robots.txt Endpoint
app.get('/robots.txt', (req, res) => {
  const host = req.get('host') || 'localhost:3000';
  const protocol = req.protocol || 'http';
  const baseUrl = `${protocol}://${host}`;

  const content = `User-agent: *
Allow: /
Allow: /catalog
Allow: /courses
Disallow: /admin
Disallow: /mentor
Disallow: /api/

Sitemap: ${baseUrl}/sitemap.xml`;

  res.header('Content-Type', 'text/plain');
  res.send(content);
});

// 3. Pre-rendering SSG/SSR Bot Handler Middleware for AI & Search Crawlers
app.use((req, res, next) => {
  const userAgent = (req.headers['user-agent'] || '').toLowerCase();
  const isBot = /googlebot|bingbot|yandex|baiduspider|gptbot|claude-web|perplexity|twitterbot|facebookexternalhit|linkedinbot|whatsapp|slackbot/i.test(userAgent);

  if (isBot && (req.path === '/' || req.path === '/catalog')) {
    const host = req.get('host') || 'localhost:3000';
    const baseUrl = `${req.protocol}://${host}`;

    const softwareSchema = {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      'name': 'DocentOS',
      'operatingSystem': 'Web, Linux, Docker',
      'applicationCategory': 'EducationalApplication',
      'offers': { '@type': 'Offer', 'price': '0', 'priceCurrency': 'USD' },
      'description': landingConfigStore.heroSubtitle,
    };

    const orgSchema = {
      '@context': 'https://schema.org',
      '@type': 'EducationalOrganization',
      'name': 'Giantucchi Inc. EIRL',
      'alternateName': 'DocentOS Open Source LMS',
      'url': baseUrl,
      'logo': landingConfigStore.heroMediaUrl,
      'description': 'Institución líder en programas e-Learning de alto rendimiento, IA Nativa y Mentoría de Software.',
    };

    const coursesSchema = {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      'itemListElement': coursesStore.map((c, idx) => ({
        '@type': 'ListItem',
        'position': idx + 1,
        'item': {
          '@type': 'Course',
          'name': c.title,
          'description': c.description,
          'provider': { '@type': 'EducationalOrganization', 'name': 'Giantucchi Inc. EIRL' },
        },
      })),
    };

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>${landingConfigStore.heroTitle} | DocentOS Open Source LMS</title>
  <meta name="description" content="${landingConfigStore.heroSubtitle}">
  <meta name="keywords" content="DocentOS, LMS, Open Source, Giantucchi, Cursos, Mentoría, IA">
  <link rel="canonical" href="${baseUrl}">
  <meta property="og:title" content="${landingConfigStore.heroTitle} | DocentOS">
  <meta property="og:description" content="${landingConfigStore.heroSubtitle}">
  <meta property="og:image" content="${landingConfigStore.heroMediaUrl}">
  <meta property="og:url" content="${baseUrl}">
  <meta name="twitter:card" content="summary_large_image">
  <script type="application/ld+json">${JSON.stringify(softwareSchema)}</script>
  <script type="application/ld+json">${JSON.stringify(orgSchema)}</script>
  <script type="application/ld+json">${JSON.stringify(coursesSchema)}</script>
</head>
<body style="font-family: sans-serif; background: #000; color: #fff; padding: 20px;">
  <header>
    <h1>${landingConfigStore.heroTitle}</h1>
    <p>${landingConfigStore.heroSubtitle}</p>
  </header>
  <main>
    <section>
      <h2>Beneficios Clave de DocentOS</h2>
      <ul>
        ${landingConfigStore.benefits.map((b) => `<li><strong>${b.title}</strong>: ${b.description}</li>`).join('')}
      </ul>
    </section>
    <section>
      <h2>Catálogo de Cursos Públicos Destacados</h2>
      ${coursesStore
        .map(
          (c) => `
        <article>
          <h3>${c.title}</h3>
          <p>${c.description}</p>
          <p>Precio: $${c.price} USD | Categoría: ${c.category}</p>
        </article>
      `
        )
        .join('')}
    </section>
  </main>
  <footer>
    <p>${landingConfigStore.footerText}</p>
  </footer>
</body>
</html>`;

    return res.setHeader('Content-Type', 'text/html').send(html);
  }

  next();
});

// Vite Integration & Static Fallback

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Academia Giantucchi activa en puerto ${PORT}`);
  });
}

startServer();
