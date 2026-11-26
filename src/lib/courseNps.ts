/**
 * Encuesta NPS de calidad por curso (Inicio, Mitad y Final):
 * reglas, tipos y constantes compartidas entre servidor e interfaz.
 */

import type { NpsGroup, NpsResult } from './listening';

export const COURSE_NPS_STAGES = ['START', 'MID', 'END'] as const;
export type CourseNpsStage = (typeof COURSE_NPS_STAGES)[number];

export const COURSE_NPS_STAGE_LABELS: Record<CourseNpsStage, string> = {
  START: 'Inicio',
  MID: 'Mitad',
  END: 'Final',
};

export const COURSE_NPS_LIMITS = {
  commentMax: 1000,
} as const;

export const NPS_TONE: Record<NpsGroup, string> = {
  DETRACTOR: 'border-danger/40 text-danger-light hover:bg-danger/15',
  PASSIVE: 'border-warning-light/40 text-warning-light hover:bg-warning-light/15',
  PROMOTER: 'border-success-light/40 text-success-light hover:bg-success-light/15',
};

export const NPS_SELECTED: Record<NpsGroup, string> = {
  DETRACTOR: 'border-danger-light bg-danger text-ink',
  PASSIVE: 'border-warning-light bg-warning-light text-canvas',
  PROMOTER: 'border-success-light bg-success-light text-canvas',
};

/**
 * Determina que hito de encuesta NPS corresponde mostrar segun el avance actual
 * del curso y los hitos ya respondidos o descartados. Prioriza END > MID > START
 * para no encadenar varios modales en cursos cortos o al retomar un curso avanzado.
 */
export function resolveCourseNpsStage(
  completedCount: number,
  totalCount: number,
  resolvedStages: ReadonlySet<CourseNpsStage>,
): CourseNpsStage | null {
  if (totalCount <= 0) return null;
  const safeCompleted = Math.max(0, completedCount);
  const progressRatio = safeCompleted / totalCount;

  if (safeCompleted >= totalCount) {
    return resolvedStages.has('END') ? null : 'END';
  }
  if (progressRatio >= 0.5) {
    return resolvedStages.has('MID') ? null : 'MID';
  }
  return resolvedStages.has('START') ? null : 'START';
}

export interface CourseNpsSubmission {
  stage: CourseNpsStage;
  npsScore?: number | null;
  comment?: string;
  dismissed?: boolean;
}

export interface CourseNpsStatusResponse {
  eligible: boolean;
  resolvedStages: CourseNpsStage[];
  answered: Array<{
    stage: CourseNpsStage;
    npsScore: number;
    createdAt: string;
  }>;
}

export interface CourseNpsCourseSummary {
  courseId: string;
  title: string;
  overall: NpsResult;
  stages: Record<CourseNpsStage, NpsResult>;
  deltaStartToEnd: number | null;
}

export interface CourseNpsCommentEntry {
  id: string;
  courseId: string;
  courseTitle: string;
  stage: CourseNpsStage;
  npsScore: number;
  npsGroup: NpsGroup;
  comment: string;
  author: { name: string; email: string } | null;
  createdAt: string;
}

export interface CourseNpsStudentResponse {
  id: string;
  userId: string;
  studentName: string;
  studentEmail: string;
  courseId: string;
  courseTitle: string;
  stage: CourseNpsStage;
  npsScore: number;
  npsGroup: NpsGroup;
  comment: string | null;
  createdAt: string;
}

export interface CourseNpsStudentOption {
  userId: string;
  name: string;
  email: string;
  responses: number;
}

export interface CourseNpsSummaryData {
  overall: NpsResult & { distribution: number[] };
  byStage: Record<CourseNpsStage, NpsResult>;
  byCourse: CourseNpsCourseSummary[];
  recentComments: CourseNpsCommentEntry[];
  studentResponses: CourseNpsStudentResponse[];
  totalResponses: number;
  dismissedCount: number;
}

export interface CourseNpsSummaryResponse {
  summary: CourseNpsSummaryData;
  courses: { id: string; title: string }[];
  students: CourseNpsStudentOption[];
}
