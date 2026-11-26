/**
 * Encuestas NPS de calidad de cursos (Inicio, Mitad y Final):
 * validacion, calculo de resumen por curso/etapa y exportacion CSV.
 */

import { z } from 'zod';
import { classifyNps, computeNps, type NpsResult } from '../src/lib/listening.js';
import {
  COURSE_NPS_LIMITS,
  COURSE_NPS_STAGE_LABELS,
  COURSE_NPS_STAGES,
  type CourseNpsCommentEntry,
  type CourseNpsCourseSummary,
  type CourseNpsStage,
  type CourseNpsStudentOption,
  type CourseNpsStudentResponse,
  type CourseNpsSummaryData,
} from '../src/lib/courseNps.js';
import { csvCell } from './listeningService.js';

export const submitCourseNpsSchema = z
  .object({
    stage: z.enum(COURSE_NPS_STAGES, { error: 'Etapa de encuesta no válida' }),
    npsScore: z.number().int().min(0).max(10).nullish(),
    comment: z
      .string()
      .transform((value) => value.replace(/\r\n/g, '\n').trim())
      .pipe(z.string().max(COURSE_NPS_LIMITS.commentMax, `El comentario no puede pasar de ${COURSE_NPS_LIMITS.commentMax} caracteres`))
      .optional(),
    dismissed: z.boolean().optional().default(false),
  })
  .refine((data) => data.dismissed || (typeof data.npsScore === 'number' && Number.isInteger(data.npsScore)), {
    message: 'Selecciona una calificación de 0 a 10 para enviar la encuesta',
  });

export const courseNpsFilterSchema = z.object({
  days: z.coerce.number().int().min(0).max(3650).default(90),
  courseId: z.string().trim().min(1).max(100).optional(),
  userId: z.string().trim().min(1).max(100).optional(),
});

export type CourseNpsFilter = z.infer<typeof courseNpsFilterSchema>;

export interface CourseNpsRow {
  id: string;
  userId: string;
  courseId: string;
  courseTitle: string | null;
  stage: CourseNpsStage;
  npsScore: number | null;
  comment: string | null;
  dismissed: boolean;
  authorName: string | null;
  authorEmail: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const STAGE_ORDER: Record<CourseNpsStage, number> = {
  START: 1,
  MID: 2,
  END: 3,
};

/**
 * Para el NPS global de un curso, cada estudiante cuenta una sola vez con su
 * etapa mas avanzada respondida (END > MID > START) dentro del periodo.
 */
export function latestCourseNpsPerUser(rows: readonly CourseNpsRow[]): number[] {
  const latest = new Map<string, { stageRank: number; updatedAt: number; score: number }>();
  for (const row of rows) {
    if (row.npsScore === null) continue;
    const key = `${row.userId}::${row.courseId}`;
    const rank = STAGE_ORDER[row.stage];
    const updatedAt = row.updatedAt.getTime();
    const current = latest.get(key);
    if (!current || rank > current.stageRank || (rank === current.stageRank && updatedAt > current.updatedAt)) {
      latest.set(key, { stageRank: rank, updatedAt, score: row.npsScore });
    }
  }
  return [...latest.values()].map((item) => item.score);
}

function summarizeStages(rows: readonly CourseNpsRow[]): Record<CourseNpsStage, NpsResult> {
  const result = {} as Record<CourseNpsStage, NpsResult>;
  for (const stage of COURSE_NPS_STAGES) {
    const scores = rows
      .filter((row) => row.stage === stage && row.npsScore !== null)
      .map((row) => row.npsScore as number);
    result[stage] = computeNps(scores);
  }
  return result;
}

export function summarizeCourseNps(rows: readonly CourseNpsRow[]): CourseNpsSummaryData {
  const answeredRows = rows.filter((row) => row.npsScore !== null);
  const dismissedCount = rows.filter((row) => row.dismissed && row.npsScore === null).length;

  const overallScores = latestCourseNpsPerUser(answeredRows);
  const distribution = Array<number>(11).fill(0);
  for (const score of overallScores) distribution[score] += 1;

  const byStage = summarizeStages(answeredRows);

  const byCourseMap = new Map<string, CourseNpsRow[]>();
  for (const row of answeredRows) {
    const list = byCourseMap.get(row.courseId);
    if (list) list.push(row);
    else byCourseMap.set(row.courseId, [row]);
  }

  const byCourse: CourseNpsCourseSummary[] = [...byCourseMap.entries()]
    .map(([courseId, list]) => {
      const stages = summarizeStages(list);
      const overall = computeNps(latestCourseNpsPerUser(list));
      const startScore = stages.START.score;
      const endScore = stages.END.score;
      return {
        courseId,
        title: list[0]?.courseTitle || 'Curso eliminado',
        overall,
        stages,
        deltaStartToEnd: startScore !== null && endScore !== null ? endScore - startScore : null,
      };
    })
    .sort((a, b) => b.overall.responses - a.overall.responses || a.title.localeCompare(b.title));

  const sortedAnswered = [...answeredRows].sort(
    (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
  );

  const studentResponses: CourseNpsStudentResponse[] = sortedAnswered.map((row) => {
    const score = row.npsScore as number;
    const trimmed = row.comment?.trim() || '';
    return {
      id: row.id,
      userId: row.userId,
      studentName: row.authorName || row.authorEmail || 'Estudiante',
      studentEmail: row.authorEmail || '',
      courseId: row.courseId,
      courseTitle: row.courseTitle || 'Curso eliminado',
      stage: row.stage,
      npsScore: score,
      npsGroup: classifyNps(score),
      comment: trimmed || null,
      createdAt: row.updatedAt.toISOString(),
    };
  });

  const recentComments: CourseNpsCommentEntry[] = sortedAnswered
    .filter((row) => Boolean(row.comment && row.comment.trim()))
    .slice(0, 50)
    .map((row) => {
      const score = row.npsScore as number;
      return {
        id: row.id,
        courseId: row.courseId,
        courseTitle: row.courseTitle || 'Curso eliminado',
        stage: row.stage,
        npsScore: score,
        npsGroup: classifyNps(score),
        comment: (row.comment || '').trim(),
        author: row.authorName || row.authorEmail ? { name: row.authorName || '', email: row.authorEmail || '' } : null,
        createdAt: row.updatedAt.toISOString(),
      };
    });

  return {
    overall: { ...computeNps(overallScores), distribution },
    byStage,
    byCourse,
    recentComments,
    studentResponses,
    totalResponses: answeredRows.length,
    dismissedCount,
  };
}

export function extractCourseNpsStudents(rows: readonly CourseNpsRow[]): CourseNpsStudentOption[] {
  const map = new Map<string, CourseNpsStudentOption>();
  for (const row of rows) {
    if (row.npsScore === null) continue;
    const existing = map.get(row.userId);
    if (existing) {
      existing.responses += 1;
    } else {
      map.set(row.userId, {
        userId: row.userId,
        name: row.authorName || row.authorEmail || 'Estudiante',
        email: row.authorEmail || '',
        responses: 1,
      });
    }
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}

const COURSE_NPS_CSV_HEADERS = [
  'fecha',
  'curso',
  'etapa',
  'estudiante',
  'correo',
  'nps_0_a_10',
  'grupo_nps',
  'comentario',
];

export function courseNpsToCsv(rows: readonly CourseNpsRow[]): string {
  const answered = rows
    .filter((row) => row.npsScore !== null)
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  const lines = [COURSE_NPS_CSV_HEADERS.join(',')];
  for (const row of answered) {
    const score = row.npsScore as number;
    lines.push(
      [
        row.updatedAt.toISOString(),
        row.courseTitle || row.courseId,
        COURSE_NPS_STAGE_LABELS[row.stage],
        row.authorName || '',
        row.authorEmail || '',
        score,
        classifyNps(score),
        row.comment || '',
      ]
        .map(csvCell)
        .join(','),
    );
  }
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}
