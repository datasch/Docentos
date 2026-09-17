import { prisma } from '../server/prisma.js';
import { hashPassword } from '../server/authService.js';
import { config } from '../server/config.js';

/** El logo de la escuela, servido desde `public/`. */
const DEFAULT_AVATAR = '/logo.avif';

const users = [
  {
    id: 'user-admin-01',
    email: 'giantucchi@academia.com',
    name: 'Prof.Giantucchi (Director General)',
    role: 'ADMIN' as const,
    avatarUrl: DEFAULT_AVATAR,
  },
  {
    id: 'user-mentor-01',
    email: 'sofia.mentor@giantucchi.com',
    name: 'Ing. Sofia Ruiz (Mentor Senior)',
    role: 'MENTOR' as const,
    avatarUrl: DEFAULT_AVATAR,
  },
  {
    id: 'user-mentee-01',
    email: 'carlos.vip@giantucchi.com',
    name: 'Carlos Mendoza (Mentee / VIP)',
    role: 'MENTEE' as const,
    avatarUrl: DEFAULT_AVATAR,
  },
  {
    id: 'user-public-01',
    email: 'estudiante@gmail.com',
    name: 'Ana Silva (Usuario Público)',
    role: 'PUBLIC_USER' as const,
    avatarUrl: DEFAULT_AVATAR,
  },
  {
    id: 'user-external-01',
    email: 'ana.external@giantucchi.com',
    name: 'Ana Silva',
    role: 'EXTERNAL' as const,
    avatarUrl: DEFAULT_AVATAR,
  },
  {
    id: 'mentee-demo-02',
    email: 'roberto@empresa.com',
    name: 'Roberto Gómez',
    role: 'MENTEE' as const,
    avatarUrl: DEFAULT_AVATAR,
  },
  {
    id: 'mentee-demo-03',
    email: 'mariana.dev@gmail.com',
    name: 'Mariana Torres',
    role: 'MENTEE' as const,
    avatarUrl: DEFAULT_AVATAR,
  },
];

const demoPasswords: Record<string, string> = {
  'user-admin-01': 'admin123',
  'user-mentor-01': 'mentor123',
  'user-mentee-01': 'vip123',
  'user-public-01': 'user123',
  'user-external-01': 'external123',
  'mentee-demo-02': 'roberto123',
  'mentee-demo-03': 'mariana123',
};

const plugins = [
  {
    id: 'pdf-certificates',
    name: 'Plugin de Certificados PDF Institucionales',
    description: 'Genera y emite un certificado oficial firmado al completar el 100% de un programa o curso de mentoría.',
    version: '1.2.0',
    category: 'certificates',
    icon: 'Award',
    config: {
      institutionName: 'Academia Giantucchi',
      signatoryTitle: 'Prof.Giantucchi - Mentor Director & Evaluador',
      primaryColor: '#06b6d4',
      badgeText: 'Certificado de Excelencia Técnica',
      backgroundColor: 'dark',
      signatureImage: '',
      universitySignatoryTitle: 'Dirección Académica - Universidad / Instituto',
      universitySignatureImage: '',
      institutionLogo: '/logo.avif',
    },
  },
  {
    id: 'interactive-quizzes',
    name: 'Plugin de Evaluaciones Interactivas',
    description: 'Añade cuestionarios por módulo y registra intentos de los estudiantes.',
    version: '1.0.0',
    category: 'quizzes',
    icon: 'ClipboardCheck',
    config: { passingScore: 70, maxAttempts: 3 },
  },
  {
    id: 'discord-webhooks',
    name: 'Plugin de Webhooks para Comunidad',
    description: 'Envía eventos de progreso y finalización a Discord o Slack.',
    version: '1.0.0',
    category: 'integrations',
    icon: 'Webhook',
    config: { webhookUrl: '', notifyOnCompletion: true },
  },
  {
    id: 'learning-analytics',
    name: 'Plugin de Analítica de Rendimiento de Mentees',
    description: 'Visualiza mapas de calor de estudio, duraciones medias por video y tasa de retención estudiantil.',
    version: '1.1.0',
    category: 'analytics',
    icon: 'BarChart3',
    config: { enableHeatmaps: true, trackSessionDuration: true },
  },
  {
    id: 'live-meetings',
    name: 'Plugin de Clases Sincrónicas & Live Meetings',
    description: 'Permite a los mentores programar y transmitir clases en vivo mediante Google Meet, Jitsi Meet abierto o grabaciones asincrónicas.',
    version: '1.0.0',
    category: 'integrations',
    icon: 'Video',
    config: {
      defaultProvider: 'jitsi',
      jitsiDomain: 'meet.jit.si',
      enableAutoRecordingLink: true,
      requireVipAccess: false,
    },
  },
  {
    id: 'google-drive',
    name: 'Plugin de Integración Google Drive Video Engine',
    description: 'Permite buscar, indexar e incrustar clases y videos directamente desde Google Drive.',
    version: '1.5.0',
    category: 'integrations',
    icon: 'HardDrive',
    config: {
      apiKeyConfigured: true,
      autoEmbedPreview: true,
      supportedMimeTypes: ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-matroska'],
      defaultFolderId: 'root',
      allowPublicSharing: true,
    },
  },
  {
    id: 'discord-slack-bridge',
    name: 'Plugin de Integración Discord / Slack Webhook',
    description: 'Notifica en canales de la comunidad en tiempo real cuando un alumno realiza preguntas de mentoría o completa módulos.',
    version: '1.0.4',
    category: 'integrations',
    icon: 'MessageSquare',
    config: {
      webhookUrl: '',
      notifyOnQnA: true,
      notifyOnCompletion: true,    },
  },
];

const benefits = [
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
];

const testimonials = [
  {
    id: 't1',
    name: 'Carlos Mendoza',
    role: 'Estudiante VIP & Software Engineer',
    avatarUrl: DEFAULT_AVATAR,
    comment: 'DocentOS me permitió completar la mentoría técnica con guías explicativas por audio e interactuar directamente con los mentores.',
    rating: 5,
  },
  {
    id: 't2',
    name: 'Ing. Sofia Ruiz',
    role: 'Mentor Director en DocentOS',
    avatarUrl: DEFAULT_AVATAR,
    comment: 'Gestión directa de estudiantes, revisión centralizada de preguntas y vinculación automática de videos en minutos.',
    rating: 5,
  },
];

async function seedUsers() {
  for (const user of users) {
    const existing = await prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, passwordHash: true },
    });
    if (existing?.passwordHash) continue;

    const passwordHash = await hashPassword(demoPasswords[user.id]);
    if (existing) {
      await prisma.user.update({ where: { id: existing.id }, data: { passwordHash } });
    } else {
      await prisma.user.create({ data: { ...user, passwordHash, avatarUrl: user.avatarUrl || DEFAULT_AVATAR } });
    }
  }
}

async function seedCourse() {
  await prisma.course.upsert({
    where: { id: 'course-giantucchi-mastery' },
    update: {},
    create: {
      id: 'course-giantucchi-mastery',
      title: 'Programa de Mentoría Elite Giantucchi: Full-Stack & Cloud Architecture',
      description: 'Aprende a construir aplicaciones web completas a nivel empresarial con React, Node.js, Prisma, Google Drive API y patrones de arquitectura resiliente con acceso directo a mentorías.',
      price: 149,
      published: true,
      category: 'Mentoría Premium',
      coverImage: 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=800&auto=format&fit=crop&q=80',
    },
  });

  const modules = [
    ['module-1', 'Módulo 1: Fundamentos y Mentalidad Giantucchi', 'Bases metodológicas y diseño de sistemas escalables.', 1],
    ['module-2', 'Módulo 2: Base de Datos & Prisma ORM Avanzado', 'PostgreSQL, modelado de relaciones y migraciones.', 2],
    ['module-3', 'Módulo 3: Seguridad, Roles RBAC & Muro de Pago', 'Mecanismos de autenticación y Bypass VIP.', 3],
    ['module-4', 'Módulo 4: Cloud & Despliegue en Producción', 'Integración con Google Drive API y Cloud Run.', 4],
  ] as const;

  for (const [id, title, description, order] of modules) {
    await prisma.module.upsert({
      where: { id },
      update: {},
      create: { id, title, description, order, courseId: 'course-giantucchi-mastery' },
    });
  }

  const videos = [
    ['video-1a', 'module-1', '1a_Giantucchi_Intro_Fundamentos', '01. Fundamentos de la Metodología Giantucchi & Mentalidad de Alto Impacto', 'Estructura de aprendizaje acelerado y patrones de diseño recomendados por Giantucchi.', '18:45', 'https://drive.google.com/file/d/15_m3K8e_Giantucchi_Fundamentos/preview', 1],
    ['video-1b', 'module-1', '1b_Giantucchi_Arquitectura', '02. Arquitectura de Sistemas Distribuidos y Escala Empresarial', 'Principios SOLID, separación de capas y gestión limpia de datos.', '32:10', 'https://drive.google.com/file/d/16_m3K8e_Giantucchi_Arquitectura/preview', 2],
    ['video-1c', 'module-2', '1c_Giantucchi_Postgres_Prisma', '03. Modelado Avanzado en PostgreSQL con Prisma ORM & Índices', 'Uso práctico del esquema de Prisma para Users, Payments y MentorshipComments.', '26:50', 'https://drive.google.com/file/d/17_m3K8e_Giantucchi_Postgres/preview', 1],
    ['video-2a', 'module-3', '2a_Giantucchi_Seguridad_RBAC', '04. Seguridad Robusta: Autenticación JWT, RBAC y Bypass VIP', 'Implementación de roles Admin, VIP y External con guardias de ruta en Express.', '22:15', 'https://drive.google.com/file/d/18_m3K8e_Giantucchi_Seguridad/preview', 1],
    ['video-2b', 'module-4', '2b_Giantucchi_Despliegue_Cloud', '05. Despliegue en la Nube y Optimización de Rendimiento', 'Streaming de videos desde Google Drive y bundling para producción.', '40:00', 'https://drive.google.com/file/d/19_m3K8e_Giantucchi_Despliegue/preview', 1],
  ] as const;

  for (const [id, moduleId, driveFileId, title, description, duration, embedUrl, order] of videos) {
    await prisma.videoDriveLink.upsert({
      where: { id },
      update: {},
      create: { id, moduleId, driveFileId, title, description, duration, embedUrl, order, mimeType: 'video/mp4' },
    });
  }
}

async function seedApplicationData() {
  for (const plugin of plugins) {
    await prisma.plugin.upsert({
      where: { id: plugin.id },
      update: {
        name: plugin.name,
        description: plugin.description,
        version: plugin.version,
        category: plugin.category,
        icon: plugin.icon,
      },
      create: {
        id: plugin.id,
        name: plugin.name,
        description: plugin.description,
        version: plugin.version,
        category: plugin.category,
        icon: plugin.icon,
        configJson: JSON.stringify(plugin.config),
      },
    });
  }

  await prisma.landingConfig.upsert({
    where: { id: 'singleton' },
    update: {},
    create: {
      id: 'singleton',
      featuredCourseIds: JSON.stringify(['course-giantucchi-mastery']),
      benefitsJson: JSON.stringify(benefits),
      testimonialsJson: JSON.stringify(testimonials),
      footerText: 'DocentOS Community Edition',
    },
  });

  const guides = [
    {
      id: 'tts-guide-1',
      courseId: 'course-giantucchi-mastery',
      moduleId: 'module-1',
      videoId: 'video-1a',
      title: 'Guía de Orientación: Metodología Giantucchi',
      scriptText: '¡Hola! Bienvenido al Módulo 1 de la Academia Giantucchi. En este video aprenderás los 3 pilares clave para construir arquitecturas limpias y dominar el desarrollo Full-Stack.',
      voiceId: 'es-ES-Carlos',
      voiceSpeed: 1,
      mentorName: 'Prof.Giantucchi',
      avatarUrl: DEFAULT_AVATAR,
      xpReward: 50,
    },
    {
      id: 'tts-guide-2',
      courseId: 'course-giantucchi-mastery',
      moduleId: 'module-3',
      videoId: 'video-2a',
      title: 'Guía Gamificada: Control de Acceso RBAC & Pase VIP',
      scriptText: '¡Socio VIP! En esta clase técnica abordaremos la protección de rutas con tokens JWT y el bypass VIP en Express.',
      voiceId: 'es-MX-Sofia',
      voiceSpeed: 1,
      mentorName: 'Sofia VIP Mentor',
      avatarUrl: DEFAULT_AVATAR,
      xpReward: 50,
    },
  ];

  for (const guide of guides) {
    await prisma.tTSGuide.upsert({ where: { id: guide.id }, update: {}, create: guide });
  }

  const assignments = [
    ['assignment-1', 'user-mentor-01', 'user-mentee-01', 75, 6, 8, 'Hace 10 min', 'ACTIVE'],
    ['assignment-2', 'user-mentor-01', 'mentee-demo-02', 40, 3, 8, 'Ayer', 'ACTIVE'],
    ['assignment-3', 'user-admin-01', 'mentee-demo-03', 100, 8, 8, 'Hace 2 días', 'GRADUATED'],
  ] as const;

  for (const [id, mentorId, menteeId, courseProgress, completedVideosCount, totalVideosCount, lastActiveDate, status] of assignments) {
    await prisma.menteeAssignment.upsert({
      where: { menteeId_courseId: { menteeId, courseId: 'course-giantucchi-mastery' } },
      update: {
        mentorId,
        courseProgress,
        completedVideosCount,
        totalVideosCount,
        lastActiveDate,
        status,
      },
      create: {
        id,
        mentorId,
        menteeId,
        courseId: 'course-giantucchi-mastery',
        courseProgress,
        completedVideosCount,
        totalVideosCount,
        lastActiveDate,
        status,
      },
    });
  }

  await prisma.mentorshipComment.upsert({
    where: { id: 'comment-1' },
    update: {},
    create: {
      id: 'comment-1',
      videoId: 'video-1a',
      userId: 'user-external-01',
      content: '¿Cómo puedo aplicar la separación de capas cuando tengo llamadas asíncronas intensivas en el backend?',
      isResolved: true,
      likes: 4,
    },
  });

  await prisma.mentorshipComment.upsert({
    where: { id: 'comment-reply-1' },
    update: {},
    create: {
      id: 'comment-reply-1',
      videoId: 'video-1a',
      userId: 'user-admin-01',
      parentId: 'comment-1',
      content: '¡Excelente pregunta Ana! La clave reside en aislar el DriveService dentro de una capa de infraestructura.',
      isMentorResponse: true,
      isResolved: true,
      likes: 9,
    },
  });

  await prisma.mentorshipComment.upsert({
    where: { id: 'comment-2' },
    update: {},
    create: {
      id: 'comment-2',
      videoId: 'video-1c',
      userId: 'user-mentee-01',
      content: '¿El esquema de Prisma soporta consultas inversas cuando se agregan respuestas anidadas en los comentarios?',
      likes: 2,
    },
  });

  await prisma.videoNote.upsert({
    where: { id: 'note-1' },
    update: {},
    create: {
      id: 'note-1',
      videoId: 'video-1a',
      userId: 'user-admin-01',
      timestampSeconds: 45,
      content: 'Punto clave sobre desacoplamiento de servicios y arquitectura modular.',
    },
  });

  // Seed Phase 3: Course Resources
  const resources = [
    {
      id: 'res-seed-1',
      courseId: 'course-giantucchi-mastery',
      moduleId: 'module-1',
      title: 'Guía de Arquitectura de Software Limpia (PDF)',
      description: 'Manual de buenas prácticas para desacoplar modelos y servicios en Node.js.',
      kind: 'FILE' as const,
      source: 'DEMO' as const,
      privateUrl: 'https://drive.google.com/file/d/demo_clean_arch_guide/view',
      mimeType: 'application/pdf',
      order: 1,
    },
    {
      id: 'res-seed-2',
      courseId: 'course-giantucchi-mastery',
      moduleId: null,
      title: 'Repositorio Plantilla de Microservicios DocentOS',
      description: 'Código base para desplegar nuevos plugins y pasarelas de pago con idempotencia.',
      kind: 'LINK' as const,
      source: 'DEMO' as const,
      privateUrl: 'https://github.com/docentos/docentos-template',
      mimeType: 'text/html',
      order: 2,
    },
  ];

  for (const res of resources) {
    await prisma.courseResource.upsert({
      where: { id: res.id },
      update: {},
      create: res,
    });
  }

  // Seed Phase 3: Formal Enrollments
  const enrollments = [
    {
      id: 'enr-mentee-01',
      userId: 'user-mentee-01',
      courseId: 'course-giantucchi-mastery',
      status: 'ACTIVE' as const,
      source: 'MENTORSHIP' as const,
    },
    {
      id: 'enr-mentee-02',
      userId: 'mentee-demo-02',
      courseId: 'course-giantucchi-mastery',
      status: 'ACTIVE' as const,
      source: 'MENTORSHIP' as const,
    },
    {
      id: 'enr-mentee-03',
      userId: 'mentee-demo-03',
      courseId: 'course-giantucchi-mastery',
      status: 'COMPLETED' as const,
      source: 'MENTORSHIP' as const,
      completedAt: new Date('2026-08-30'),
    },
  ];

  for (const enr of enrollments) {
    await prisma.courseEnrollment.upsert({
      where: { userId_courseId: { userId: enr.userId, courseId: enr.courseId } },
      update: {},
      create: enr,
    });
  }

  // Seed Phase 3: Demo Verified Certificate for Graduated Mentee
  await prisma.certificate.upsert({
    where: { verificationCode: 'DOC-MARIANA2026' },
    update: {},
    create: {
      verificationCode: 'DOC-MARIANA2026',
      userId: 'mentee-demo-03',
      courseId: 'course-giantucchi-mastery',
      recipientName: 'Mariana Torres',
      courseTitle: 'Mastery en Arquitectura de Software & Google Drive',
      completionPercent: 100,
      issuedAt: new Date('2026-08-30'),
    },
  });

  // Seed Phase 4: Sample Live and Async Meetings
  const sampleMeetings = [
    {
      id: 'meeting-live-jitsi-01',
      title: '🔴 Masterclass Sincrónica: Arquitectura Distribuida y Despliegue en Vivo',
      description: 'Sesión interactiva en vivo con la Ing. Sofia Ruiz para resolver dudas de microservicios y streaming.',
      meetingType: 'jitsi',
      meetingUrl: 'https://meet.jit.si/docentos-mastery-live-session',
      scheduledAt: new Date(),
      isLive: true,
      courseId: 'course-giantucchi-mastery',
      moduleId: 'module-1',
      hostId: 'user-mentor-01',
      recordingUrl: null,
    },
    {
      id: 'meeting-scheduled-meet-02',
      title: '📅 Mentoría Grupal Google Meet: Modelado de Datos y PostgreSQL',
      description: 'Revisión en directo de consultas Prisma y relaciones de bases de datos.',
      meetingType: 'meet',
      meetingUrl: 'https://meet.google.com/giantucchi-mastery-meet',
      scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Mañana
      isLive: false,
      courseId: 'course-giantucchi-mastery',
      moduleId: 'module-2',
      hostId: 'user-admin-01',
      recordingUrl: null,
    },
    {
      id: 'meeting-async-record-03',
      title: '📼 Grabación Asincrónica: Seguridad JWT & Bypass VIP en Producción',
      description: 'Grabación de la clase magistral sobre autenticación segura y políticas de acceso.',
      meetingType: 'async_record',
      meetingUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      scheduledAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
      isLive: false,
      courseId: 'course-giantucchi-mastery',
      moduleId: 'module-3',
      hostId: 'user-mentor-01',
      recordingUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    },
  ];

  for (const m of sampleMeetings) {
    await prisma.meeting.upsert({
      where: { id: m.id },
      update: {
        title: m.title,
        description: m.description,
        meetingType: m.meetingType,
        meetingUrl: m.meetingUrl,
        scheduledAt: m.scheduledAt,
        isLive: m.isLive,
        courseId: m.courseId,
        moduleId: m.moduleId,
        hostId: m.hostId,
        recordingUrl: m.recordingUrl,
      },
      create: m,
    });
  }
}

async function main() {
  if (!config.SEED_DEMO_DATA) {
    console.log('Datos demo omitidos: establece SEED_DEMO_DATA=true en un entorno no productivo para cargarlos.');
    return;
  }
  await seedUsers();
  await seedCourse();
  await seedApplicationData();
  console.log('✅ Base de datos DocentOS inicializada con datos de demostración.');
}

main()
  .catch((error) => {
    console.error('❌ No se pudo inicializar la base de datos:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
