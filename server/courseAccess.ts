import type { AuthenticatedUser, UserRole } from './authMiddleware.js';
import { prisma } from './prisma.js';
import { parseVideoSource } from '../src/lib/videoParser.js';

export type CourseAccessReason =
  | 'admin'
  | 'vip_membership'
  | 'free_published_course'
  | 'confirmed_payment'
  | 'active_enrollment'
  | 'mentorship_assignment'
  | 'mentor_assignment'
  | 'not_authenticated'
  | 'not_authorized';

export interface CourseAccessDecision {
  allowed: boolean;
  reason: CourseAccessReason;
  hasPaid: boolean;
  hasEnrollment: boolean;
  hasMentorshipAssignment: boolean;
}

export const COURSE_ROLE_PERMISSIONS: Record<UserRole, readonly string[]> = {
  ADMIN: ['catalog:view', 'course:manage', 'course:publish', 'content:view:any', 'enrollment:manage'],
  MENTOR: ['catalog:view', 'content:view:assigned', 'mentorship:manage:assigned'],
  MENTEE: ['catalog:view', 'content:view:enrolled', 'progress:update:self'],
  VIP: ['catalog:view', 'content:view:published', 'progress:update:self'],
  PUBLIC_USER: ['catalog:view', 'content:view:purchased', 'progress:update:self'],
  EXTERNAL: ['catalog:view', 'content:view:purchased-or-assigned', 'progress:update:self'],
};

/**
 * Convertir una cuenta existente en MENTEE le retira los accesos ligados a su
 * rol previo (por ejemplo la membresia VIP y su acceso a los cursos
 * publicados), asi que es una operacion reservada a administracion. Un mentor
 * solo puede asignar cuentas nuevas o que ya sean mentees.
 */
export function canConvertAccountToMentee(actorRole: UserRole, targetRole: UserRole | null): boolean {
  if (targetRole === null || targetRole === 'MENTEE') return true;
  return actorRole === 'ADMIN';
}

function enrollmentIsCurrent(enrollment: { status: string; accessExpiresAt: Date | null } | null) {
  if (!enrollment || !['ACTIVE', 'COMPLETED'].includes(enrollment.status)) return false;
  return !enrollment.accessExpiresAt || enrollment.accessExpiresAt.getTime() > Date.now();
}

/** Decision que no depende de pagos ni matriculas: todos los indicadores en falso. */
function decision(allowed: boolean, reason: CourseAccessReason): CourseAccessDecision {
  return { allowed, reason, hasPaid: false, hasEnrollment: false, hasMentorshipAssignment: false };
}

type CourseAccessInput = { id: string; published: boolean; price: number };

/**
 * Resuelve la parte del permiso que no necesita consultar matriculas ni pagos.
 * Devuelve null cuando el curso todavia requiere comprobar los datos del usuario.
 */
function resolveStaticDecision(
  user: AuthenticatedUser | undefined,
  course: CourseAccessInput,
): CourseAccessDecision | null {
  if (user?.role === 'ADMIN') return decision(true, 'admin');
  if (course.published && course.price <= 0) return decision(true, 'free_published_course');
  if (!user) return decision(false, 'not_authenticated');
  if (user.role === 'VIP' && course.published) return decision(true, 'vip_membership');
  return null;
}

function combineDecision(hasPaid: boolean, hasEnrollment: boolean, hasMenteeAssignment: boolean, hasMentorAssignment: boolean) {
  let reason: CourseAccessReason = 'not_authorized';
  if (hasPaid) reason = 'confirmed_payment';
  else if (hasEnrollment) reason = 'active_enrollment';
  else if (hasMenteeAssignment) reason = 'mentorship_assignment';
  else if (hasMentorAssignment) reason = 'mentor_assignment';

  return {
    allowed: hasPaid || hasEnrollment || hasMenteeAssignment || hasMentorAssignment,
    reason,
    hasPaid,
    hasEnrollment,
    hasMentorshipAssignment: hasMenteeAssignment || hasMentorAssignment,
  };
}

/**
 * Version por lotes de getCourseAccessDecision para el catalogo. Resolver curso
 * por curso lanzaba cinco consultas por cada fila listada; aqui se agrupan en
 * cuatro consultas totales, con las mismas reglas de permiso.
 */
export async function getCourseAccessDecisions(
  user: AuthenticatedUser | undefined,
  courses: CourseAccessInput[],
): Promise<Map<string, CourseAccessDecision>> {
  const decisions = new Map<string, CourseAccessDecision>();
  const pendingIds: string[] = [];

  for (const course of courses) {
    const staticDecision = resolveStaticDecision(user, course);
    if (staticDecision) decisions.set(course.id, staticDecision);
    else pendingIds.push(course.id);
  }

  if (!user || pendingIds.length === 0) return decisions;

  const [payments, enrollments, menteeAssignments, mentorAssignments] = await Promise.all([
    prisma.payment.findMany({
      where: {
        userId: user.id,
        courseId: { in: pendingIds },
        status: { in: ['COMPLETED', 'PARTIALLY_REFUNDED'] },
      },
      select: { courseId: true },
    }),
    prisma.courseEnrollment.findMany({
      where: { userId: user.id, courseId: { in: pendingIds } },
      select: { courseId: true, status: true, accessExpiresAt: true },
    }),
    prisma.menteeAssignment.findMany({
      where: { menteeId: user.id, courseId: { in: pendingIds }, status: { in: ['ACTIVE', 'GRADUATED'] } },
      select: { courseId: true },
    }),
    user.role === 'MENTOR'
      ? prisma.menteeAssignment.findMany({
          where: { mentorId: user.id, courseId: { in: pendingIds }, status: { in: ['ACTIVE', 'GRADUATED'] } },
          select: { courseId: true },
        })
      : Promise.resolve([] as { courseId: string }[]),
  ]);

  const paidCourseIds = new Set(payments.map((payment) => payment.courseId));
  const menteeCourseIds = new Set(menteeAssignments.map((assignment) => assignment.courseId));
  const mentorCourseIds = new Set(mentorAssignments.map((assignment) => assignment.courseId));
  const enrollmentByCourse = new Map(enrollments.map((enrollment) => [enrollment.courseId, enrollment]));

  for (const courseId of pendingIds) {
    decisions.set(
      courseId,
      combineDecision(
        paidCourseIds.has(courseId),
        enrollmentIsCurrent(enrollmentByCourse.get(courseId) || null),
        menteeCourseIds.has(courseId),
        mentorCourseIds.has(courseId),
      ),
    );
  }

  return decisions;
}

export async function getCourseAccessDecision(
  user: AuthenticatedUser | undefined,
  courseId: string,
): Promise<CourseAccessDecision> {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true, published: true, price: true },
  });

  if (!course) return decision(false, 'not_authorized');

  const staticDecision = resolveStaticDecision(user, course);
  if (staticDecision) return staticDecision;

  const [payment, enrollment, menteeAssignment, mentorAssignment] = await Promise.all([
    prisma.payment.findFirst({
      where: {
        userId: user.id,
        courseId,
        status: { in: ['COMPLETED', 'PARTIALLY_REFUNDED'] },
      },
      select: { id: true },
    }),
    prisma.courseEnrollment.findUnique({
      where: { userId_courseId: { userId: user.id, courseId } },
      select: { status: true, accessExpiresAt: true },
    }),
    prisma.menteeAssignment.findFirst({
      where: { menteeId: user.id, courseId, status: { in: ['ACTIVE', 'GRADUATED'] } },
      select: { id: true },
    }),
    user.role === 'MENTOR'
      ? prisma.menteeAssignment.findFirst({
          where: { mentorId: user.id, courseId, status: { in: ['ACTIVE', 'GRADUATED'] } },
          select: { id: true },
        })
      : Promise.resolve(null),
  ]);

  return combineDecision(
    Boolean(payment),
    enrollmentIsCurrent(enrollment),
    Boolean(menteeAssignment),
    Boolean(mentorAssignment),
  );
}

export async function userHasCourseAccess(user: AuthenticatedUser | undefined, courseId: string) {
  return (await getCourseAccessDecision(user, courseId)).allowed;
}

export async function userHasVideoAccess(user: AuthenticatedUser | undefined, videoId: string) {
  const video = await prisma.videoDriveLink.findUnique({
    where: { id: videoId },
    select: { module: { select: { courseId: true } } },
  });
  return video ? userHasCourseAccess(user, video.module.courseId) : false;
}

export async function userHasResourceAccess(user: AuthenticatedUser | undefined, resourceId: string) {
  const resource = await prisma.courseResource.findUnique({
    where: { id: resourceId },
    select: { courseId: true },
  });
  return resource ? userHasCourseAccess(user, resource.courseId) : false;
}

function serializeResource(resource: any) {
  return {
    id: resource.id,
    courseId: resource.courseId,
    moduleId: resource.moduleId,
    title: resource.title,
    description: resource.description,
    kind: resource.kind,
    source: resource.source,
    mimeType: resource.mimeType,
    sizeBytes: resource.sizeBytes == null ? null : String(resource.sizeBytes),
    order: resource.order,
    downloadUrl: `/api/content/resources/${encodeURIComponent(resource.id)}`,
    createdAt: resource.createdAt,
    updatedAt: resource.updatedAt,
  };
}

function serializeVideo(video: any) {
  return {
    id: video.id,
    title: video.title,
    description: video.description,
    duration: video.duration,
    mimeType: video.mimeType,
    source: video.source,
    // Quien reproduce, sin decir que archivo. `playbackUrl` apunta a nuestra
    // ruta de acceso, asi que el navegador no puede deducir el proveedor de
    // ella, y `source` no basta: hay clases guardadas como EXTERNAL_URL cuya
    // URL es un `preview` de Drive. El reproductor necesita el dato porque cada
    // proveedor pide un alto minimo distinto, y sin el se maquetaba a ciegas.
    provider: parseVideoSource(video.embedUrl || video.previewUrl || video.driveFileId || '').provider,
    order: video.order,
    playbackUrl: `/api/content/videos/${encodeURIComponent(video.id)}`,
    createdAt: video.createdAt,
    updatedAt: video.updatedAt,
  };
}

export function serializeCourseForViewer(course: any, hasAccess: boolean) {
  const base = {
    id: course.id,
    title: course.title,
    description: course.description,
    price: course.price,
    currency: course.currency,
    published: course.published,
    publishedAt: course.publishedAt,
    isDemo: course.isDemo,
    coverImage: course.coverImage,
    category: course.category,
    // El temario del alumno necesita saber si el curso abre los modulos de uno
    // en uno: sin este dato el candado no se puede pintar.
    sequentialUnlock: Boolean(course.sequentialUnlock),
    createdAt: course.createdAt,
    updatedAt: course.updatedAt,
  };

  if (!hasAccess) return { ...base, modules: [], resources: [] };

  return {
    ...base,
    resources: (course.resources || []).filter((resource: any) => !resource.moduleId).map(serializeResource),
    modules: (course.modules || []).map((module: any) => ({
      id: module.id,
      title: module.title,
      description: module.description,
      order: module.order,
      videos: (module.videos || []).map(serializeVideo),
      resources: (module.resources || []).map(serializeResource),
      createdAt: module.createdAt,
      updatedAt: module.updatedAt,
    })),
  };
}

export function serializeCourseForAdmin(course: any) {
  return {
    ...course,
    resources: (course.resources || []).map((resource: any) => ({
      ...resource,
      sizeBytes: resource.sizeBytes == null ? null : String(resource.sizeBytes),
    })),
    modules: (course.modules || []).map((module: any) => ({
      ...module,
      resources: (module.resources || []).map((resource: any) => ({
        ...resource,
        sizeBytes: resource.sizeBytes == null ? null : String(resource.sizeBytes),
      })),
    })),
  };
}
