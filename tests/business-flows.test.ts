/**
 * Pruebas Automatizadas de Flujos de Negocio - DocentOS LMS
 * Fase 3: Pagos, Idempotencia, Matrículas, Contenido Protegido y Certificados
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../server/prisma.js';
import {
  createCheckoutSession,
  handleStripeWebhook,
  simulateDevPaymentSuccess,
} from '../server/paymentService.js';
import {
  getCourseAccessDecision,
  serializeCourseForViewer,
  userHasVideoAccess,
} from '../server/courseAccess.js';
import { calculateCourseProgress } from '../server/progressService.js';
import { User } from '../src/types.js';

const TEST_COURSE_ID = 'course-giantucchi-mastery';
const TEST_USER_ID = 'user-public-01'; // Ana Silva (PUBLIC_USER)

test('Flujo de Negocio: Pagos, Webhooks e Idempotencia', async (t) => {
  // Limpieza previa de pruebas anteriores
  await prisma.courseEnrollment.deleteMany({
    where: { userId: TEST_USER_ID, courseId: TEST_COURSE_ID },
  });
  await prisma.payment.deleteMany({
    where: { userId: TEST_USER_ID, courseId: TEST_COURSE_ID },
  });

  let paymentId: string = '';
  let stripeSessionId: string = '';

  await t.test('1. Debe generar una sesión de checkout con pago en estado PENDING', async () => {
    const session = await createCheckoutSession({
      userId: TEST_USER_ID,
      courseId: TEST_COURSE_ID,
      userEmail: 'estudiante@gmail.com',
      returnBaseUrl: 'http://localhost:3000',
    });

    assert.ok(session.paymentId, 'Debe devolver un paymentId');
    assert.ok(session.stripeSessionId, 'Debe devolver un stripeSessionId');
    paymentId = session.paymentId;
    stripeSessionId = session.stripeSessionId;

    const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
    assert.ok(payment, 'El pago debe existir en la base de datos');
    assert.equal(payment.status, 'PENDING', 'El estado inicial debe ser PENDING');
    assert.equal(payment.userId, TEST_USER_ID);
    assert.equal(payment.courseId, TEST_COURSE_ID);
  });

  await t.test('2. Webhook checkout.session.completed activa matrícula y completa pago', async () => {
    const eventId = `evt_test_checkout_${Date.now()}`;
    const mockWebhookPayload = {
      id: eventId,
      type: 'checkout.session.completed',
      data: {
        object: {
          id: stripeSessionId,
          payment_intent: `pi_test_${Date.now()}`,
          client_reference_id: TEST_USER_ID,
          metadata: {
            userId: TEST_USER_ID,
            courseId: TEST_COURSE_ID,
            paymentId,
          },
        },
      },
    };

    const res = await handleStripeWebhook(JSON.stringify(mockWebhookPayload));
    assert.equal(res.success, true);
    assert.equal(res.duplicate, undefined);

    // Verificar estado del pago
    const updatedPayment = await prisma.payment.findUnique({ where: { id: paymentId } });
    assert.equal(updatedPayment?.status, 'COMPLETED');

    // Verificar matrícula creada
    const enrollment = await prisma.courseEnrollment.findUnique({
      where: { userId_courseId: { userId: TEST_USER_ID, courseId: TEST_COURSE_ID } },
    });
    assert.ok(enrollment, 'La matrícula debe haberse creado');
    assert.equal(enrollment.status, 'ACTIVE');
    assert.equal(enrollment.source, 'PAYMENT');
  });

  await t.test('3. Idempotencia estricta ante webhooks duplicados', async () => {
    // Reenviar exactamente el mismo payload con el mismo providerEventId
    const lastEvent = await prisma.paymentWebhookEvent.findFirst({
      orderBy: { processedAt: 'desc' },
    });
    assert.ok(lastEvent, 'Debe haber un evento registrado');

    const duplicatePayload = {
      id: lastEvent.providerEventId,
      type: 'checkout.session.completed',
      data: {
        object: {
          id: stripeSessionId,
        },
      },
    };

    const res = await handleStripeWebhook(JSON.stringify(duplicatePayload));
    assert.equal(res.success, true);
    assert.equal(res.duplicate, true, 'Debe detectar evento duplicado y responder idempotente');
  });

  await t.test('4. Reembolso total (charge.refunded) revoca matrícula y cambia pago a REFUNDED', async () => {
    const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
    assert.ok(payment?.stripePaymentIntentId);

    const refundEventId = `evt_test_refund_${Date.now()}`;
    const refundPayload = {
      id: refundEventId,
      type: 'charge.refunded',
      data: {
        object: {
          payment_intent: payment.stripePaymentIntentId,
          amount_refunded: payment.amount * 100,
          amount: payment.amount * 100,
        },
      },
    };

    const res = await handleStripeWebhook(JSON.stringify(refundPayload));
    assert.equal(res.success, true);

    const refundedPayment = await prisma.payment.findUnique({ where: { id: paymentId } });
    assert.equal(refundedPayment?.status, 'REFUNDED');

    const revokedEnrollment = await prisma.courseEnrollment.findUnique({
      where: { userId_courseId: { userId: TEST_USER_ID, courseId: TEST_COURSE_ID } },
    });
    assert.equal(revokedEnrollment?.status, 'REVOKED', 'La matrícula debe haber sido revocada');
  });
});

test('Flujo de Negocio: Control de Acceso y Protección de Contenidos', async (t) => {
  const publicUser: User = {
    id: TEST_USER_ID,
    email: 'estudiante@gmail.com',
    name: 'Ana Silva',
    role: 'PUBLIC_USER',
  };

  const course = await prisma.course.findUnique({
    where: { id: TEST_COURSE_ID },
    include: {
      resources: true,
      modules: { include: { videos: true, resources: true } },
    },
  });
  assert.ok(course, 'El curso demo debe existir');

  await t.test('1. Usuario sin matrícula activa recibe temario sanitizado (sin módulos ni recursos)', async () => {
    const decision = await getCourseAccessDecision(publicUser, TEST_COURSE_ID);
    assert.equal(decision.allowed, false);

    const sanitized = serializeCourseForViewer(course, false);
    assert.equal(sanitized.modules.length, 0, 'No debe exponer lecciones a usuarios no matriculados');
    assert.equal(sanitized.resources.length, 0, 'No debe exponer recursos a usuarios no matriculados');
  });

  await t.test('2. Usuario con matrícula activa recibe enlaces virtuales protegidos (/api/content/...) sin URLs privadas', async () => {
    // Activar matrícula
    await prisma.courseEnrollment.upsert({
      where: { userId_courseId: { userId: TEST_USER_ID, courseId: TEST_COURSE_ID } },
      create: { userId: TEST_USER_ID, courseId: TEST_COURSE_ID, status: 'ACTIVE', source: 'ADMIN' },
      update: { status: 'ACTIVE' },
    });

    const decision = await getCourseAccessDecision(publicUser, TEST_COURSE_ID);
    assert.equal(decision.allowed, true);

    const authorizedView = serializeCourseForViewer(course, true);
    assert.ok(authorizedView.modules.length > 0, 'Debe incluir módulos');

    const firstVideo = authorizedView.modules[0].videos[0];
    assert.ok(firstVideo.playbackUrl?.startsWith('/api/content/videos/'), 'Debe usar URL virtual protegida');

    // Verificar que ninguna URL privada directa se filtre en el payload
    const jsonStr = JSON.stringify(authorizedView);
    assert.ok(!jsonStr.includes('privateUrl'), 'No debe existir el campo privateUrl en la vista autorizada');
  });

  await t.test('3. Verificación de permisos de videos y recursos', async () => {
    const firstVideoId = course.modules[0].videos[0]?.id;
    assert.ok(firstVideoId);

    const hasVideoAccess = await userHasVideoAccess(publicUser, firstVideoId);
    assert.equal(hasVideoAccess, true, 'Usuario matriculado debe tener acceso al video');

    const unauthorizedUser: User = {
      id: 'user-unauthorized',
      email: 'hacker@anonymous.com',
      name: 'No Matriculado',
      role: 'PUBLIC_USER',
    };
    const deniedVideoAccess = await userHasVideoAccess(unauthorizedUser, firstVideoId);
    assert.equal(deniedVideoAccess, false, 'Usuario no matriculado debe ser denegado');
  });
});

test('Flujo de Negocio: Progreso al 100%, Certificado Persistente y Verificación', async (t) => {
  const menteeId = 'mentee-demo-02'; // Roberto Gómez

  // Asegurar matrícula activa
  await prisma.courseEnrollment.upsert({
    where: { userId_courseId: { userId: menteeId, courseId: TEST_COURSE_ID } },
    create: { userId: menteeId, courseId: TEST_COURSE_ID, status: 'ACTIVE', source: 'MENTORSHIP' },
    update: { status: 'ACTIVE' },
  });

  // Limpiar progreso y certificado previo para la prueba
  await prisma.certificate.deleteMany({
    where: { userId: menteeId, courseId: TEST_COURSE_ID },
  });
  await prisma.userProgress.deleteMany({
    where: { userId: menteeId },
  });

  await t.test('1. Marcar todos los videos del curso como completados', async () => {
    const videos = await prisma.videoDriveLink.findMany({
      where: { module: { courseId: TEST_COURSE_ID } },
    });
    assert.ok(videos.length > 0, 'Debe haber videos en el curso');

    for (const v of videos) {
      await prisma.userProgress.create({
        data: { userId: menteeId, videoId: v.id, completed: true },
      });
    }

    const progress = await calculateCourseProgress(menteeId, TEST_COURSE_ID);
    assert.equal(progress.percentage, 100, 'El progreso debe ser 100%');
    assert.equal(progress.completed, true, 'El curso debe figurar completado');
    assert.ok(progress.certificate, 'Debe emitir automáticamente el certificado');
    assert.ok(progress.certificate.verificationCode.startsWith('DOC-'), 'El código debe comenzar con DOC-');

    // Verificar que CourseEnrollment se marcó como COMPLETED
    const enrollment = await prisma.courseEnrollment.findUnique({
      where: { userId_courseId: { userId: menteeId, courseId: TEST_COURSE_ID } },
    });
    assert.equal(enrollment?.status, 'COMPLETED');
  });

  await t.test('2. Verificación de autenticidad del certificado emitido', async () => {
    const cert = await prisma.certificate.findUnique({
      where: { userId_courseId: { userId: menteeId, courseId: TEST_COURSE_ID } },
    });
    assert.ok(cert);
    assert.equal(cert.revokedAt, null, 'El certificado no debe estar revocado inicialmente');
    assert.equal(cert.completionPercent, 100);

    // Simular revocación administrativa
    const revoked = await prisma.certificate.update({
      where: { id: cert.id },
      data: { revokedAt: new Date(), revocationReason: 'Prueba de revocación automatizada' },
    });
    assert.ok(revoked.revokedAt, 'Debe registrar la fecha de revocación');
  });
});

test('Seguridad de Pagos: la simulación de desarrollo no puede conceder acceso ajeno', async (t) => {
  const OWNER_ID = TEST_USER_ID;
  const ATTACKER_ID = 'mentee-demo-02';

  await prisma.courseEnrollment.deleteMany({
    where: { userId: { in: [OWNER_ID, ATTACKER_ID] }, courseId: TEST_COURSE_ID },
  });
  await prisma.payment.deleteMany({
    where: { userId: OWNER_ID, courseId: TEST_COURSE_ID },
  });

  const checkout = await createCheckoutSession({
    userId: OWNER_ID,
    courseId: TEST_COURSE_ID,
    userEmail: 'estudiante@gmail.com',
    returnBaseUrl: 'http://localhost:3000',
  });

  await t.test('1. Otro usuario autenticado no puede completar un pago que no le pertenece', async () => {
    await assert.rejects(
      () => simulateDevPaymentSuccess(checkout.paymentId, ATTACKER_ID),
      /no pertenece a la sesión actual/,
      'La simulación debe rechazar un paymentId de otro usuario',
    );

    const payment = await prisma.payment.findUnique({ where: { id: checkout.paymentId } });
    assert.equal(payment?.status, 'PENDING', 'El pago debe seguir pendiente tras el intento');

    const enrollment = await prisma.courseEnrollment.findUnique({
      where: { userId_courseId: { userId: ATTACKER_ID, courseId: TEST_COURSE_ID } },
    });
    assert.equal(enrollment, null, 'El atacante no debe obtener matrícula');
  });

  await t.test('2. El propietario del pago sí puede completarlo fuera de producción', async () => {
    const result = await simulateDevPaymentSuccess(checkout.paymentId, OWNER_ID);
    assert.equal(result.success, true);

    const payment = await prisma.payment.findUnique({ where: { id: checkout.paymentId } });
    assert.equal(payment?.status, 'COMPLETED');
  });
});
