import { createHash, randomBytes } from 'node:crypto';
import Stripe from 'stripe';
import { prisma } from './prisma.js';
import { config } from './config.js';

let stripeClient: Stripe | null = null;
if (config.STRIPE_SECRET_KEY) {
  stripeClient = new Stripe(config.STRIPE_SECRET_KEY);
}

export function getStripeClient(): Stripe | null {
  return stripeClient;
}

export interface CreateCheckoutParams {
  userId: string;
  courseId: string;
  userEmail: string;
  returnBaseUrl: string;
}

export interface CheckoutResult {
  paymentId: string;
  status: 'PENDING' | 'COMPLETED';
  checkoutUrl: string;
  stripeSessionId: string;
  isDevSimulation?: boolean;
}

export async function createCheckoutSession({
  userId,
  courseId,
  userEmail,
  returnBaseUrl,
}: CreateCheckoutParams): Promise<CheckoutResult> {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true, title: true, description: true, price: true, currency: true, published: true },
  });

  if (!course) {
    throw new Error('Curso no encontrado');
  }

  if (!course.published) {
    throw new Error('El curso solicitado no se encuentra publicado');
  }

  // Idempotent check: if the user already has an active enrollment or completed payment
  const existingEnrollment = await prisma.courseEnrollment.findUnique({
    where: { userId_courseId: { userId, courseId } },
  });
  if (existingEnrollment && ['ACTIVE', 'COMPLETED'].includes(existingEnrollment.status)) {
    throw new Error('Ya cuentas con una matrícula activa para este curso');
  }

  const paymentId = `pay_${randomBytes(12).toString('hex')}`;
  const idempotencyKey = `idemp_${paymentId}`;
  const currency = (course.currency || 'USD').toUpperCase();
  const amount = Number(course.price) || 0;

  if (stripeClient && config.STRIPE_SECRET_KEY) {
    const session = await stripeClient.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      customer_email: userEmail,
      client_reference_id: paymentId,
      metadata: {
        paymentId,
        userId,
        courseId,
      },
      line_items: [
        {
          price_data: {
            currency: currency.toLowerCase(),
            product_data: {
              name: course.title,
              description: course.description?.slice(0, 500) || undefined,
            },
            unit_amount: Math.round(amount * 100),
          },
          quantity: 1,
        },
      ],
      success_url: `${returnBaseUrl}/courses?payment_status=success&session_id={CHECKOUT_SESSION_ID}&course_id=${encodeURIComponent(courseId)}`,
      cancel_url: `${returnBaseUrl}/courses?payment_status=cancelled&course_id=${encodeURIComponent(courseId)}`,
    });

    const payment = await prisma.payment.create({
      data: {
        id: paymentId,
        userId,
        courseId,
        amount,
        currency,
        status: 'PENDING',
        provider: 'stripe',
        stripeSessionId: session.id,
        idempotencyKey,
        checkoutUrl: session.url || undefined,
      },
    });

    return {
      paymentId: payment.id,
      status: payment.status as 'PENDING',
      checkoutUrl: session.url || '',
      stripeSessionId: session.id,
    };
  }

  // Modo desarrollo / sin credenciales Stripe activas
  const simulatedSessionId = `cs_dev_${randomBytes(12).toString('hex')}`;
  const simulatedCheckoutUrl = `${returnBaseUrl}/courses?payment_status=dev_pending&payment_id=${encodeURIComponent(paymentId)}&session_id=${encodeURIComponent(simulatedSessionId)}&course_id=${encodeURIComponent(courseId)}`;

  const payment = await prisma.payment.create({
    data: {
      id: paymentId,
      userId,
      courseId,
      amount,
      currency,
      status: 'PENDING',
      provider: 'stripe',
      stripeSessionId: simulatedSessionId,
      idempotencyKey,
      checkoutUrl: simulatedCheckoutUrl,
    },
  });

  return {
    paymentId: payment.id,
    status: 'PENDING',
    checkoutUrl: simulatedCheckoutUrl,
    stripeSessionId: simulatedSessionId,
    isDevSimulation: true,
  };
}

export async function handleStripeWebhook(
  rawBody: Buffer | string,
  signatureHeader?: string,
): Promise<{ success: boolean; duplicate?: boolean; eventType: string; eventId: string }> {
  let event: Stripe.Event;

  if (stripeClient && config.STRIPE_WEBHOOK_SECRET) {
    if (!signatureHeader) {
      throw new Error('Falta la cabecera stripe-signature requerida para verificar el webhook');
    }
    event = stripeClient.webhooks.constructEvent(
      rawBody,
      signatureHeader,
      config.STRIPE_WEBHOOK_SECRET,
    );
  } else if (config.DOCENTOS_ENV === 'production') {
    // Nunca se aceptan eventos sin firma verificada en produccion: un webhook no
    // autenticado permitiria conceder matriculas falsificando checkout.session.completed.
    throw new Error(
      'Webhook rechazado: STRIPE_SECRET_KEY y STRIPE_WEBHOOK_SECRET son obligatorios para procesar pagos en produccion.',
    );
  } else {
    // Si no hay firma configurada (entorno dev/test local), parsear el payload directamente
    try {
      const parsed = typeof rawBody === 'string' ? JSON.parse(rawBody) : JSON.parse(rawBody.toString('utf8'));
      event = parsed as Stripe.Event;
      if (!event.id || !event.type) {
        throw new Error('Formato de evento de webhook inválido');
      }
    } catch (err: any) {
      throw new Error(`Error parseando webhook: ${err.message}`);
    }
  }

  const payloadHash = createHash('sha256')
    .update(typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8'))
    .digest('hex');

  // Comprobar idempotencia
  const existingEvent = await prisma.paymentWebhookEvent.findUnique({
    where: { providerEventId: event.id },
  });

  if (existingEvent) {
    console.log(`[Stripe Webhook] Evento duplicado descartado por idempotencia: ${event.id} (${event.type})`);
    return {
      success: true,
      duplicate: true,
      eventType: event.type,
      eventId: event.id,
    };
  }

  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.paymentWebhookEvent.create({
      data: {
        id: `wev_${randomBytes(12).toString('hex')}`,
        providerEventId: event.id,
        eventType: event.type,
        payloadHash,
        processedAt: now,
      },
    });

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const paymentId = (session.client_reference_id || session.metadata?.paymentId) as string | undefined;
        const sessionId = session.id;

        const payment = await tx.payment.findFirst({
          where: {
            OR: [
              ...(sessionId ? [{ stripeSessionId: sessionId }] : []),
              ...(paymentId ? [{ id: paymentId }] : []),
            ],
          },
        });

        if (payment) {
          const paymentIntentId = typeof session.payment_intent === 'string'
            ? session.payment_intent
            : (session.payment_intent?.id || payment.stripePaymentIntentId);

          await tx.payment.update({
            where: { id: payment.id },
            data: {
              status: 'COMPLETED',
              completedAt: now,
              stripePaymentIntentId: paymentIntentId,
            },
          });

          await tx.courseEnrollment.upsert({
            where: { userId_courseId: { userId: payment.userId, courseId: payment.courseId } },
            create: {
              id: `enr_${randomBytes(12).toString('hex')}`,
              userId: payment.userId,
              courseId: payment.courseId,
              status: 'ACTIVE',
              source: 'PAYMENT',
              createdAt: now,
            },
            update: {
              status: 'ACTIVE',
              source: 'PAYMENT',
              updatedAt: now,
            },
          });
        }
        break;
      }

      case 'payment_intent.succeeded': {
        const intent = event.data.object as Stripe.PaymentIntent;
        const paymentId = intent.metadata?.paymentId;

        const payment = await tx.payment.findFirst({
          where: {
            OR: [
              { stripePaymentIntentId: intent.id },
              ...(paymentId ? [{ id: paymentId }] : []),
            ],
          },
        });

        if (payment) {
          await tx.payment.update({
            where: { id: payment.id },
            data: {
              status: 'COMPLETED',
              stripePaymentIntentId: intent.id,
              completedAt: payment.completedAt || now,
            },
          });

          await tx.courseEnrollment.upsert({
            where: { userId_courseId: { userId: payment.userId, courseId: payment.courseId } },
            create: {
              id: `enr_${randomBytes(12).toString('hex')}`,
              userId: payment.userId,
              courseId: payment.courseId,
              status: 'ACTIVE',
              source: 'PAYMENT',
              createdAt: now,
            },
            update: {
              status: 'ACTIVE',
              source: 'PAYMENT',
              updatedAt: now,
            },
          });
        }
        break;
      }

      case 'payment_intent.payment_failed': {
        const intent = event.data.object as Stripe.PaymentIntent;
        const paymentId = intent.metadata?.paymentId;

        const payment = await tx.payment.findFirst({
          where: {
            OR: [
              { stripePaymentIntentId: intent.id },
              ...(paymentId ? [{ id: paymentId }] : []),
            ],
          },
        });

        if (payment) {
          await tx.payment.update({
            where: { id: payment.id },
            data: {
              status: 'FAILED',
              failedAt: now,
              failureCode: intent.last_payment_error?.code || 'unknown_error',
              failureMessage: intent.last_payment_error?.message || 'El pago no pudo ser procesado.',
            },
          });
        }
        break;
      }

      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge;
        const paymentIntentId = typeof charge.payment_intent === 'string'
          ? charge.payment_intent
          : charge.payment_intent?.id;

        if (paymentIntentId) {
          const payment = await tx.payment.findUnique({
            where: { stripePaymentIntentId: paymentIntentId },
          });

          if (payment) {
            const refundedAmount = (charge.amount_refunded || 0) / 100;
            const isFullRefund = Boolean(charge.refunded) || refundedAmount >= payment.amount;

            await tx.payment.update({
              where: { id: payment.id },
              data: {
                status: isFullRefund ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
                refundedAt: now,
                refundedAmount,
              },
            });

            if (isFullRefund) {
              await tx.courseEnrollment.updateMany({
                where: { userId: payment.userId, courseId: payment.courseId },
                data: { status: 'REVOKED' },
              });
            }
          }
        }
        break;
      }

      default:
        console.log(`[Stripe Webhook] Evento registrado sin acción de estado: ${event.type}`);
        break;
    }
  });

  return {
    success: true,
    eventType: event.type,
    eventId: event.id,
  };
}

export async function simulateDevPaymentSuccess(paymentId: string, requestingUserId?: string) {
  // La simulacion concede matricula sin cobro real: solo puede existir fuera de
  // produccion y nunca cuando hay credenciales de Stripe activas.
  if (config.DOCENTOS_ENV === 'production') {
    throw new Error('La simulación de pagos está deshabilitada en producción.');
  }
  if (stripeClient) {
    throw new Error('La simulación de pagos no está disponible con Stripe configurado.');
  }

  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    select: { id: true, userId: true, courseId: true, stripeSessionId: true, status: true },
  });

  if (!payment) {
    throw new Error('Pago no encontrado');
  }

  if (requestingUserId && payment.userId !== requestingUserId) {
    throw new Error('El pago indicado no pertenece a la sesión actual.');
  }

  const simulatedEventId = `evt_sim_${randomBytes(10).toString('hex')}`;
  const simulatedEvent = {
    id: simulatedEventId,
    type: 'checkout.session.completed',
    data: {
      object: {
        id: payment.stripeSessionId || `cs_sim_${payment.id}`,
        client_reference_id: payment.id,
        payment_intent: `pi_sim_${randomBytes(8).toString('hex')}`,
        metadata: {
          paymentId: payment.id,
          userId: payment.userId,
          courseId: payment.courseId,
        },
      },
    },
  };

  return handleStripeWebhook(JSON.stringify(simulatedEvent));
}

export async function getPaymentStatus(params: { paymentId?: string; sessionId?: string; userId?: string }) {
  const where: any = {};
  if (params.paymentId) where.id = params.paymentId;
  if (params.sessionId) where.stripeSessionId = params.sessionId;
  if (params.userId) where.userId = params.userId;

  const payment = await prisma.payment.findFirst({
    where,
    include: {
      course: { select: { id: true, title: true, price: true, currency: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!payment) return null;

  const enrollment = await prisma.courseEnrollment.findUnique({
    where: { userId_courseId: { userId: payment.userId, courseId: payment.courseId } },
  });

  return {
    id: payment.id,
    courseId: payment.courseId,
    courseTitle: payment.course.title,
    amount: payment.amount,
    currency: payment.currency,
    status: payment.status,
    completedAt: payment.completedAt?.toISOString() || null,
    hasAccess: enrollment ? ['ACTIVE', 'COMPLETED'].includes(enrollment.status) : false,
    enrollmentStatus: enrollment?.status || null,
  };
}
