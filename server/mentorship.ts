/**
 * Reparto de cursos entre mentees.
 *
 * El panel de mentoría trabaja con personas, no con asignaciones: en «Mentees
 * Asignados» cada quien sale una sola vez, con la lista de los cursos que
 * lleva. La base guarda una fila por (mentee, curso), así que la conversión
 * entre las dos vistas vive aquí y se prueba aparte.
 */

export interface AssignmentRow {
  id: string;
  menteeId: string;
  mentorId: string;
  courseId: string;
  courseProgress: number;
  completedVideosCount: number;
  totalVideosCount: number;
  lastActiveDate: string;
  status: string;
  mentee: {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string | null;
    strikes?: number;
    isActive?: boolean;
  };
  course?: { title?: string } | null;
}

export interface MenteeCourseView {
  assignmentId: string;
  courseId: string;
  courseTitle: string;
  mentorId: string;
  courseProgress: number;
  completedVideosCount: number;
  totalVideosCount: number;
  lastActiveDate: string;
  status: string;
}

export interface MenteeView {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
  assignedMentorId: string;
  strikes?: number;
  isActive?: boolean;
  status: string;
  courseProgress: number;
  completedVideosCount: number;
  totalVideosCount: number;
  lastActiveDate: string;
  courses: MenteeCourseView[];
}

/**
 * Agrupa las asignaciones por persona.
 *
 * Antes el listado devolvía una fila por asignación, así que quien llevaba tres
 * cursos aparecía tres veces y ninguna fila decía de qué curso hablaba.
 *
 * El porcentaje global se calcula sobre el total de lecciones de todos sus
 * cursos, no promediando porcentajes: con un curso de 3 clases y otro de 130,
 * el promedio simple daba el mismo peso a los dos y bastaba con terminar el
 * corto para aparentar la mitad del camino hecho.
 */
export function groupAssignmentsByMentee(assignments: AssignmentRow[]): MenteeView[] {
  const porMentee = new Map<string, MenteeView>();

  for (const assignment of assignments) {
    const ficha =
      porMentee.get(assignment.menteeId) ||
      ({
        id: assignment.mentee.id,
        name: assignment.mentee.name,
        email: assignment.mentee.email,
        avatarUrl: assignment.mentee.avatarUrl,
        assignedMentorId: assignment.mentorId,
        strikes: assignment.mentee.strikes,
        isActive: assignment.mentee.isActive,
        status: assignment.status,
        completedVideosCount: 0,
        totalVideosCount: 0,
        courseProgress: 0,
        lastActiveDate: assignment.lastActiveDate,
        courses: [],
      } as MenteeView);

    ficha.completedVideosCount += assignment.completedVideosCount;
    ficha.totalVideosCount += assignment.totalVideosCount;
    // Con varios cursos, el estado que manda es el que sigue en marcha: alguien
    // que terminó uno y sigue en otro no está graduado.
    if (assignment.status === 'ACTIVE') ficha.status = 'ACTIVE';
    ficha.courses.push({
      assignmentId: assignment.id,
      courseId: assignment.courseId,
      courseTitle: assignment.course?.title || 'Curso sin título',
      mentorId: assignment.mentorId,
      courseProgress: assignment.courseProgress,
      completedVideosCount: assignment.completedVideosCount,
      totalVideosCount: assignment.totalVideosCount,
      lastActiveDate: assignment.lastActiveDate,
      status: assignment.status,
    });

    porMentee.set(assignment.menteeId, ficha);
  }

  return Array.from(porMentee.values()).map((ficha) => ({
    ...ficha,
    courseProgress:
      ficha.totalVideosCount > 0
        ? Math.round((ficha.completedVideosCount / ficha.totalVideosCount) * 100)
        : 0,
  }));
}

/**
 * Qué hay que crear y qué hay que borrar para dejar un reparto en la lista
 * pedida.
 *
 * Se razona sobre el estado final, no sobre «añade este»: lo que no viene en
 * `pedidos` se retira. `yaAsignados` es lo que hay ahora dentro del ámbito de
 * quien edita —un mentor solo ve y toca lo suyo—, y `permitidos` son las altas
 * nuevas que pasan el filtro de rol.
 *
 * Quien ya estaba asignado se conserva aunque no esté en `permitidos`: su rol
 * pudo cambiar después (hay cuentas VIP con asignaciones vivas) y filtrarlo
 * aquí equivaldría a expulsarlo al guardar.
 */
export function resolveRosterChanges(
  pedidos: string[],
  yaAsignados: string[],
  permitidos: string[],
): { toAdd: string[]; toRemove: string[]; ignored: string[] } {
  const pedidosUnicos = Array.from(new Set(pedidos));
  const actuales = new Set(yaAsignados);
  const altasValidas = new Set(permitidos);

  const validos = new Set(
    pedidosUnicos.filter((id) => actuales.has(id) || altasValidas.has(id)),
  );

  return {
    toAdd: Array.from(validos).filter((id) => !actuales.has(id)),
    toRemove: yaAsignados.filter((id) => !validos.has(id)),
    ignored: pedidosUnicos.filter((id) => !validos.has(id)),
  };
}
