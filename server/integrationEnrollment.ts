/**
 * Alta de alumno y matricula desde un sistema de pagos externo (la API de
 * pagos de las landings de Giantucchi, que cobra con Culqi).
 *
 * Reglas, y por que:
 *
 * - **Idempotente por pedido.** La clave es `orderId`, guardada como
 *   `Payment.idempotencyKey = "ext:<orderId>"`. La API de pagos reintenta hasta
 *   recibir un 2xx; un reintento devuelve el mismo alumno y la misma matricula,
 *   nunca un segundo pago ni una segunda cuenta.
 * - **No toca cuentas existentes.** Si el correo ya tiene cuenta, se le suma la
 *   matricula y nada mas: ni rol, ni nombre, ni contraseña. (Ver
 *   tests/http-mentorship.test.ts: cambiar el rol de una cuenta VIP le quitaba
 *   accesos.)
 * - **Nunca emite un enlace de activacion para una cuenta con contraseña.** El
 *   enlace permite fijar la contraseña; si se emitiera para cualquier correo,
 *   pagar a nombre de otro serviria para quedarse con su cuenta. Solo lo reciben
 *   las cuentas que aun no tienen contraseña, y el enlace va a su propio correo.
 */
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import type { Role } from '../generated/prisma/client.js';
import { prisma } from './prisma.js';
import { config } from './config.js';
import { createPasswordResetToken } from './authService.js';

export const integrationEnrollmentSchema = z.object({
  orderId: z.string().trim().min(8).max(100).regex(/^[A-Za-z0-9:_-]+$/, 'orderId con caracteres no permitidos'),
  courseId: z.string().trim().min(1).max(100),
  student: z.object({
    name: z.string().trim().min(2).max(100),
    email: z.string().trim().email().max(255).transform((value) => value.toLowerCase()),
    phone: z.string().trim().max(20).optional().nullable(),
  }),
  payment: z.object({
    amount: z.number().finite().positive().max(1_000_000),
    currency: z.string().regex(/^[A-Z]{3}$/),
    provider: z.enum(['culqi', 'transferencia']),
    reference: z.string().trim().max(100).optional().nullable(),
  }),
});

export type IntegrationEnrollmentInput = z.infer<typeof integrationEnrollmentSchema>;

export class IntegrationError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const digest = (value: string) => createHash('sha256').update(value).digest();

/**
 * Compara el `Authorization: Bearer …` con el token configurado en tiempo
 * constante. Se comparan los resumenes SHA-256 para que la longitud del token
 * tampoco se filtre.
 */
export function isIntegrationAuthorized(authorizationHeader: string | undefined): boolean {
  const expected = config.INTEGRATION_API_TOKEN;
  if (!expected || !authorizationHeader?.startsWith('Bearer ')) return false;
  return timingSafeEqual(digest(authorizationHeader.slice('Bearer '.length).trim()), digest(expected));
}

export interface IntegrationEnrollmentResult {
  userId: string;
  enrollmentId: string;
  paymentId: string;
  newAccount: boolean;
  accountActive: boolean;
  activationUrl: string | null;
  activationExpiresAt: string | null;
  activationPending: boolean;
  loginUrl: string;
  courseTitle: string;
}

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/**
 * Mentor de un alumno que llega pagando. Mismo criterio que el panel
 * (mentorForNewAssignment y "Asignar Mentee"): se respeta el mentor que ya lo
 * lleva en otro curso; si no, INTEGRATION_MENTOR_EMAIL; si no, la primera
 * cuenta activa de ADMIN o MENTOR.
 */
async function mentorForPaidStudent(tx: Tx, menteeId: string): Promise<string | null> {
  const previa = await tx.menteeAssignment.findFirst({
    where: { menteeId },
    orderBy: { createdAt: 'asc' },
    select: { mentorId: true },
  });
  if (previa) return previa.mentorId;
  const staff = { role: { in: ['ADMIN', 'MENTOR'] as Role[] }, isActive: true };
  if (config.INTEGRATION_MENTOR_EMAIL) {
    const elegido = await tx.user.findFirst({
      where: { email: config.INTEGRATION_MENTOR_EMAIL.toLowerCase(), ...staff },
      select: { id: true },
    });
    if (elegido) return elegido.id;
    console.warn(`[integracion] INTEGRATION_MENTOR_EMAIL=${config.INTEGRATION_MENTOR_EMAIL} no es un ADMIN o MENTOR activo; se usa el primero disponible.`);
  }
  const primero = await tx.user.findFirst({ where: staff, orderBy: { createdAt: 'asc' }, select: { id: true } });
  return primero?.id ?? null;
}

async function enrollInTransaction(input: IntegrationEnrollmentInput) {
  return prisma.$transaction(async (tx) => {
    const course = await tx.course.findUnique({ where: { id: input.courseId }, select: { id: true, title: true } });
    if (!course) throw new IntegrationError(404, 'Curso no encontrado.');

    const idempotencyKey = `ext:${input.orderId}`;
    const previous = await tx.payment.findUnique({ where: { idempotencyKey }, include: { user: true } });
    if (previous) {
      if (previous.courseId !== course.id || previous.user.email !== input.student.email) {
        throw new IntegrationError(409, 'Ese pedido ya se registro con otro alumno o curso.');
      }
      const enrollment = await tx.courseEnrollment.findUnique({
        where: { userId_courseId: { userId: previous.userId, courseId: course.id } },
      });
      if (!enrollment) throw new IntegrationError(409, 'Ese pedido ya existe sin matrícula; requiere revisión.');
      return { user: previous.user, course, payment: previous, enrollment, previous: true };
    }

    let user = await tx.user.findUnique({ where: { email: input.student.email } });
    let createdNow = false;
    if (!user) {
      user = await tx.user.create({
        data: {
          email: input.student.email,
          name: input.student.name,
          role: 'PUBLIC_USER',
          avatarUrl: '/logo.avif',
          passwordHash: null,
        },
      });
      createdNow = true;
    }

    const now = new Date();
    const payment = await tx.payment.create({
      data: {
        userId: user.id,
        courseId: course.id,
        amount: input.payment.amount,
        currency: input.payment.currency,
        status: 'COMPLETED',
        provider: input.payment.provider,
        idempotencyKey,
        completedAt: now,
      },
    });

    const existingEnrollment = await tx.courseEnrollment.findUnique({
      where: { userId_courseId: { userId: user.id, courseId: course.id } },
    });
    const enrollment = existingEnrollment
      ? await tx.courseEnrollment.update({
        where: { id: existingEnrollment.id },
        // Una matricula terminada se queda terminada; una revocada o vencida vuelve a estar activa.
        data: existingEnrollment.status === 'COMPLETED' ? { accessExpiresAt: null } : { status: 'ACTIVE', accessExpiresAt: null },
      })
      : await tx.courseEnrollment.create({
        data: {
          id: `enr_${randomBytes(12).toString('hex')}`,
          userId: user.id,
          courseId: course.id,
          status: 'ACTIVE',
          source: 'PAYMENT',
        },
      });

    // Quien paga queda en la mentoria del curso: sin asignacion no aparece en
    // "Mentees asignados" del panel. No se cambia el mentor de una asignacion
    // que ya existia.
    const mentorId = await mentorForPaidStudent(tx, user.id);
    if (mentorId) {
      await tx.menteeAssignment.upsert({
        where: { menteeId_courseId: { menteeId: user.id, courseId: course.id } },
        update: { status: 'ACTIVE' },
        create: {
          menteeId: user.id,
          mentorId,
          courseId: course.id,
          totalVideosCount: await tx.videoDriveLink.count({ where: { module: { courseId: course.id } } }),
        },
      });
    } else {
      console.warn(`[integracion] Sin mentor activo: ${input.student.email} queda matriculado sin asignacion de mentoria.`);
    }

    await tx.auditLog.create({
      data: {
        actorUserId: null,
        action: 'integration.enrollment_created',
        targetType: 'CourseEnrollment',
        targetId: enrollment.id,
        metadataJson: JSON.stringify({
          orderId: input.orderId,
          provider: input.payment.provider,
          reference: input.payment.reference ?? null,
          amount: input.payment.amount,
          currency: input.payment.currency,
          userCreated: createdNow,
        }),
      },
    });

    return { user, course, payment, enrollment, previous: false };
  });
}

export async function enrollFromIntegration(input: IntegrationEnrollmentInput): Promise<IntegrationEnrollmentResult> {
  let result: Awaited<ReturnType<typeof enrollInTransaction>> | undefined;
  // Dos entregas simultaneas del mismo pedido (o dos pedidos del mismo correo
  // nuevo) chocan en un indice unico. La segunda se repite y encuentra lo que
  // creo la primera.
  for (let attempt = 1; !result; attempt++) {
    try {
      result = await enrollInTransaction(input);
    } catch (error) {
      const uniqueClash = (error as { code?: unknown } | null)?.code === 'P2002';
      if (!uniqueClash || attempt >= 3) throw error;
    }
  }

  const { user, course, payment, enrollment } = result;
  const needsActivation = user.isActive && !user.passwordHash;
  let activationUrl: string | null = null;
  let activationExpiresAt: string | null = null;
  if (needsActivation) {
    const { token, expiresAt } = await createPasswordResetToken(user.id, config.ACTIVATION_TTL_HOURS * 60, { preserveExisting: true });
    activationUrl = `${config.APP_URL.replace(/\/$/, '')}/?resetToken=${encodeURIComponent(token)}`;
    activationExpiresAt = expiresAt.toISOString();
  }

  return {
    userId: user.id,
    enrollmentId: enrollment.id,
    paymentId: payment.id,
    newAccount: !user.passwordHash,
    accountActive: user.isActive,
    activationUrl,
    activationExpiresAt,
    activationPending: false,
    loginUrl: config.APP_URL.replace(/\/$/, ''),
    courseTitle: course.title,
  };
}
