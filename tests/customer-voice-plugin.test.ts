/**
 * Pruebas de Integración y Seguridad del Plugin de Escucha Activa, NPS & Perfilado de Afinidad
 * DocentOS / Academia Giantucchi
 *
 * Valida:
 * 1. Envío de feedback y generación de respuesta empática inmediata con IA
 * 2. Protección de privacidad en aportes anónimos
 * 3. Aislamiento de historial de aportes por estudiante
 * 4. Control de acceso RBAC a la bandeja de moderación docente
 * 5. Ciclo de respuesta y resolución directa por parte de mentores
 * 6. Métricas de satisfacción y detección temprana de frustración
 * 7. Mapeo Cuantitativo de NPS (1-5) e Inferencia Inteligente de Tópicos
 * 8. Analítica NPS Global (/api/customer-voice/nps-analytics) con Promotores y Detractores
 * 9. Perfil de Afinidad del Estudiante (/api/customer-voice/my-affinity) y Recomendaciones
 * 10. Vista de Perfil Docente (/api/customer-voice/student-profile/:userId) y Alertas de Riesgo
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import type { Request } from 'express';

process.env.DOCENTOS_SKIP_LISTEN = '1';

const { app, ensureLegacyInstanceConfig } = await import('../server.js');
const { prisma } = await import('../server/prisma.js');
const { createUserSession } = await import('../server/authService.js');
const { config } = await import('../server/config.js');

const SUFIJO = `voice-${Date.now()}`;
const cuentasCreadas: string[] = [];
let cursoId = '';
let cursoRecomendableId = '';

const servidor = app.listen(0);
const base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;

async function crearUsuario(nombre: string, rol: 'ADMIN' | 'MENTOR' | 'PUBLIC_USER') {
  const user = await prisma.user.create({
    data: {
      name: nombre,
      email: `${rol.toLowerCase()}-${cuentasCreadas.length}-${SUFIJO}@ejemplo.invalid`,
      role: rol,
      avatarUrl: '/logo.avif',
    },
  });
  cuentasCreadas.push(user.id);
  return user;
}

async function cookieDe(userId: string) {
  const reqFalso = { get: () => undefined, ip: '127.0.0.1' } as unknown as Request;
  const { token } = await createUserSession(userId, reqFalso);
  return `${config.SESSION_COOKIE_NAME}=${token}`;
}

test.before(async () => {
  await ensureLegacyInstanceConfig();
  const curso = await prisma.course.create({
    data: {
      title: `Arquitectura Backend y Microservicios en Node.js ${SUFIJO}`,
      description: 'Curso intensivo de desarrollo backend y APIs de alta concurrencia',
      category: 'Backend & APIs',
      price: 150,
      currency: 'USD',
      coverImage: '/logo.avif',
    },
  });
  cursoId = curso.id;

  const cursoRec = await prisma.course.create({
    data: {
      title: `Despliegue Cloud y DevOps con Docker & Kubernetes ${SUFIJO}`,
      description: 'Aprende contenedores docker y orquestación cloud',
      category: 'Cloud & DevOps',
      price: 200,
      currency: 'USD',
      coverImage: '/logo.avif',
    },
  });
  cursoRecomendableId = cursoRec.id;
});

test.after(async () => {
  await prisma.studentTopicAffinity.deleteMany({
    where: { userId: { in: cuentasCreadas } },
  });
  await prisma.studentVoice.deleteMany({
    where: { userId: { in: cuentasCreadas } },
  });
  await prisma.user.deleteMany({
    where: { id: { in: cuentasCreadas } },
  });
  if (cursoId) {
    await prisma.course.deleteMany({ where: { id: cursoId } });
  }
  if (cursoRecomendableId) {
    await prisma.course.deleteMany({ where: { id: cursoRecomendableId } });
  }
  await new Promise((resolve) => servidor.close(resolve));
  await prisma.$disconnect();
});

test('1. Alumno envía mensaje con sentimiento FRUSTRATED y recibe respuesta empática de escucha activa', async () => {
  const alumno = await crearUsuario('Carlos Estudiante', 'PUBLIC_USER');
  const cookie = await cookieDe(alumno.id);

  const res = await fetch(`${base}/api/customer-voice`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookie,
    },
    body: JSON.stringify({
      sentiment: 'FRUSTRATED',
      category: 'COURSE_CONTENT',
      subject: 'Me siento atascado con los ejercicios del módulo 2',
      message: 'No logro que compile el contenedor docker y me siento muy frustrado.',
      courseId: cursoId,
    }),
  });

  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.ok(data.voice);
  assert.equal(data.voice.sentiment, 'FRUSTRATED');
  assert.equal(data.voice.npsScore, 1, 'FRUSTRATED debe mapear automáticamente a score 1');
  assert.equal(data.voice.status, 'RECEIVED');
  assert.ok(data.voice.aiEmpathyReply, 'Debe incluir respuesta de escucha activa');
  assert.ok(
    data.voice.aiEmpathyReply.length > 20,
    'La respuesta empática debe contener un mensaje cálido y estructurado',
  );
});

test('2. Aporte anónimo enmascara identidad del estudiante para el equipo docente', async () => {
  const alumnoAnon = await crearUsuario('Ana Secreta', 'PUBLIC_USER');
  const admin = await crearUsuario('Director Admin', 'ADMIN');
  const cookieAlumno = await cookieDe(alumnoAnon.id);
  const cookieAdmin = await cookieDe(admin.id);

  const createRes = await fetch(`${base}/api/customer-voice`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookieAlumno,
    },
    body: JSON.stringify({
      sentiment: 'INSPIRED',
      category: 'FEATURE_REQUEST',
      subject: 'Idea para las clases en vivo',
      message: 'Sería genial tener sesiones de preguntas y respuestas los sábados.',
      isAnonymous: true,
    }),
  });

  assert.equal(createRes.status, 200);
  const createData = await createRes.json();
  const voiceId = createData.voice.id;

  // Consulta por el Administrador
  const adminRes = await fetch(`${base}/api/customer-voice/all?search=Idea+para+las+clases`, {
    headers: { Cookie: cookieAdmin },
  });
  assert.equal(adminRes.status, 200);
  const adminData = await adminRes.json();
  const encontrada = adminData.voices.find((v: any) => v.id === voiceId);
  assert.ok(encontrada);
  assert.equal(encontrada.isAnonymous, true);
  assert.equal(encontrada.userName, 'Alumno Anónimo');
  assert.equal(encontrada.userEmail, 'Protegido (Anónimo)');
});

test('3. Historial del estudiante (/api/customer-voice/my) aísla mensajes privados entre alumnos', async () => {
  const alumnoA = await crearUsuario('Estudiante A', 'PUBLIC_USER');
  const alumnoB = await crearUsuario('Estudiante B', 'PUBLIC_USER');
  const cookieA = await cookieDe(alumnoA.id);
  const cookieB = await cookieDe(alumnoB.id);

  await fetch(`${base}/api/customer-voice`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookieA },
    body: JSON.stringify({
      sentiment: 'MOTIVATED',
      category: 'OTHER',
      subject: 'Mensaje Privado de A',
      message: 'Me encanta este contenido exclusivo.',
    }),
  });

  const resB = await fetch(`${base}/api/customer-voice/my`, {
    headers: { Cookie: cookieB },
  });
  assert.equal(resB.status, 200);
  const dataB = await resB.json();
  const mensajeDeAenB = dataB.voices.find((v: any) => v.subject === 'Mensaje Privado de A');
  assert.equal(mensajeDeAenB, undefined, 'El estudiante B no debe ver los mensajes privados del estudiante A');
});

test('4. Seguridad RBAC: un estudiante común no puede acceder a /api/customer-voice/all', async () => {
  const alumno = await crearUsuario('Intruso Estudiante', 'PUBLIC_USER');
  const cookie = await cookieDe(alumno.id);

  const res = await fetch(`${base}/api/customer-voice/all`, {
    headers: { Cookie: cookie },
  });
  assert.equal(res.status, 403, 'Debe rechazar con 403 Forbidden a roles que no sean ADMIN o MENTOR');
});

test('5. Mentor responde directamente al alumno y cambia estado a RESOLVED', async () => {
  const alumno = await crearUsuario('Laura Mentee', 'PUBLIC_USER');
  const mentor = await crearUsuario('Profesor Giancarlo', 'MENTOR');
  const cookieAlumno = await cookieDe(alumno.id);
  const cookieMentor = await cookieDe(mentor.id);

  // Alumno envía mensaje
  const envio = await fetch(`${base}/api/customer-voice`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookieAlumno },
    body: JSON.stringify({
      sentiment: 'CONFUSED',
      category: 'MENTORSHIP_CARE',
      subject: 'Duda con el cronograma',
      message: '¿Cuándo es la próxima sesión grupal?',
    }),
  });
  const voiceData = await envio.json();
  const voiceId = voiceData.voice.id;

  // Mentor responde
  const replyRes = await fetch(`${base}/api/customer-voice/${voiceId}/reply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookieMentor },
    body: JSON.stringify({
      mentorReply: 'Hola Laura, la sesión grupal será este jueves a las 7 PM. Ya actualizamos el calendario.',
      status: 'RESOLVED',
      adminNotes: 'Aclarado en calendario',
    }),
  });

  assert.equal(replyRes.status, 200);
  const replyData = await replyRes.json();
  assert.equal(replyData.success, true);
  assert.equal(replyData.voice.status, 'RESOLVED');
  assert.equal(replyData.voice.mentorRepliedBy, 'Profesor Giancarlo');

  // Alumno consulta su historial y comprueba la respuesta oficial de su mentor
  const myRes = await fetch(`${base}/api/customer-voice/my`, {
    headers: { Cookie: cookieAlumno },
  });
  const myData = await myRes.json();
  const voiceVerificada = myData.voices.find((v: any) => v.id === voiceId);
  assert.ok(voiceVerificada);
  assert.equal(voiceVerificada.status, 'RESOLVED');
  assert.ok(voiceVerificada.mentorReply.includes('jueves a las 7 PM'));
});

test('6. Métricas y alerta temprana (/api/customer-voice/stats) reportan frustraciones y satisfacción', async () => {
  const mentor = await crearUsuario('Coordinador Mentor', 'MENTOR');
  const cookie = await cookieDe(mentor.id);

  const res = await fetch(`${base}/api/customer-voice/stats`, {
    headers: { Cookie: cookie },
  });

  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.ok(typeof data.stats.total === 'number');
  assert.ok(typeof data.stats.urgentFrustrations === 'number');
  assert.ok(data.stats.sentiments);
  assert.ok('MOTIVATED' in data.stats.sentiments);
  assert.ok('FRUSTRATED' in data.stats.sentiments);
});

test('7. Mapeo Cuantitativo de NPS e inferencia inteligente de área temática', async () => {
  const alumno = await crearUsuario('Mateo Developer', 'PUBLIC_USER');
  const cookie = await cookieDe(alumno.id);

  // 1. Envío Motivado en Backend
  const res1 = await fetch(`${base}/api/customer-voice`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({
      sentiment: 'MOTIVATED',
      category: 'COURSE_CONTENT',
      subject: 'Excelente clase de APIs y Microservicios',
      message: 'Me encantó cómo explicaron la arquitectura de Node.js y Express.',
      courseId: cursoId,
    }),
  });
  const data1 = await res1.json();
  assert.equal(data1.success, true);
  assert.equal(data1.voice.npsScore, 5);
  assert.equal(data1.voice.topicTag, 'Backend & APIs');

  // 2. Envío con score explícito y tópico DevOps
  const res2 = await fetch(`${base}/api/customer-voice`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({
      sentiment: 'INSPIRED',
      npsScore: 4,
      topicTag: 'Cloud & DevOps',
      category: 'FEATURE_REQUEST',
      subject: 'Propuesta de Kubernetes',
      message: 'Podríamos añadir un laboratorio de despliegue con Docker y Helm.',
    }),
  });
  const data2 = await res2.json();
  assert.equal(data2.success, true);
  assert.equal(data2.voice.npsScore, 4);
  assert.equal(data2.voice.topicTag, 'Cloud & DevOps');
});

test('8. Analítica NPS Global (/api/customer-voice/nps-analytics) calcula promotores, detractores y ranking de cursos', async () => {
  const admin = await crearUsuario('Super Admin NPS', 'ADMIN');
  const cookieAdmin = await cookieDe(admin.id);

  const res = await fetch(`${base}/api/customer-voice/nps-analytics?courseId=${cursoId}`, {
    headers: { Cookie: cookieAdmin },
  });

  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.ok(data.analytics);
  assert.ok(typeof data.analytics.total === 'number');
  assert.ok(typeof data.analytics.npsScore === 'number');
  assert.ok(typeof data.analytics.averageSatisfaction === 'number');
  assert.ok(data.analytics.promoters);
  assert.ok(data.analytics.detractors);
  assert.ok(data.analytics.passives);
  assert.ok(data.analytics.healthStatus);
  assert.ok(Array.isArray(data.analytics.courseBreakdown));
  assert.ok(Array.isArray(data.analytics.topicBreakdown));
});

test('9. Perfil de Afinidad del Estudiante (/api/customer-voice/my-affinity) y Recomendaciones Inteligentes', async () => {
  const alumno = await crearUsuario('Sofia Ingeniera', 'PUBLIC_USER');
  const cookie = await cookieDe(alumno.id);

  // Registrar alta motivación en Cloud & DevOps
  await fetch(`${base}/api/customer-voice`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({
      sentiment: 'MOTIVATED',
      topicTag: 'Cloud & DevOps',
      category: 'COURSE_CONTENT',
      subject: 'Me apasiona Docker',
      message: 'He disfrutado mucho aprender sobre contenedores y despliegue cloud.',
    }),
  });

  // Consultar su perfil de afinidad
  const affinityRes = await fetch(`${base}/api/customer-voice/my-affinity`, {
    headers: { Cookie: cookie },
  });

  assert.equal(affinityRes.status, 200);
  const data = await affinityRes.json();
  assert.equal(data.success, true);
  assert.ok(data.profile);
  assert.equal(data.profile.userId, alumno.id);
  assert.ok(data.profile.topInterests.length > 0);
  assert.equal(data.profile.topInterests[0].topic, 'Cloud & DevOps');
  assert.equal(data.profile.topInterests[0].score, 5);
  assert.equal(data.profile.riskLevel, 'LOW');
  assert.ok(Array.isArray(data.profile.smartRecommendations));
  // Debe recomendar el curso de DevOps disponible
  const recDevOps = data.profile.smartRecommendations.find((r: any) => r.courseId === cursoRecomendableId);
  assert.ok(recDevOps, 'Debe recomendar el curso de Kubernetes & Docker por afinidad');
});

test('10. Vista de Perfil Docente (/api/customer-voice/student-profile/:userId) y Alertas de Riesgo', async () => {
  const mentor = await crearUsuario('Mentor Lead', 'MENTOR');
  const alumnoRiesgo = await crearUsuario('Alumno Bloqueado', 'PUBLIC_USER');
  const cookieMentor = await cookieDe(mentor.id);
  const cookieAlumno = await cookieDe(alumnoRiesgo.id);

  // Alumno registra frustración
  await fetch(`${base}/api/customer-voice`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookieAlumno },
    body: JSON.stringify({
      sentiment: 'FRUSTRATED',
      topicTag: 'Backend & APIs',
      category: 'COURSE_CONTENT',
      subject: 'Bloqueado con bases de datos',
      message: 'No logro conectar con postgresql y llevo 3 días sin avanzar.',
    }),
  });

  // Mentor consulta el perfil del alumno
  const profileRes = await fetch(`${base}/api/customer-voice/student-profile/${alumnoRiesgo.id}`, {
    headers: { Cookie: cookieMentor },
  });

  assert.equal(profileRes.status, 200);
  const data = await profileRes.json();
  assert.equal(data.success, true);
  assert.equal(data.profile.userId, alumnoRiesgo.id);
  assert.equal(data.profile.riskLevel, 'HIGH', 'Debe marcar nivel de riesgo ALTO por frustración reciente');
  assert.ok(data.profile.riskReason.includes('frustración reciente'));
  assert.ok(data.profile.growthAreas.length > 0);
  assert.equal(data.profile.growthAreas[0].topic, 'Backend & APIs');
});
