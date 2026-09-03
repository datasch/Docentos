/**
 * Recorrido de un curso: la lista plana de lecciones y cómo moverse por ella.
 *
 * El temario está anidado (curso → módulos → vídeos), pero el alumno lo vive
 * como una secuencia: anterior, siguiente, y «por dónde iba». Aquí se aplana
 * una vez y se resuelven esas tres preguntas, sin tocar la interfaz.
 */

import type { Course } from '../types';

export interface LessonPosition {
  moduleIndex: number;
  videoIndex: number;
}

export interface FlatLesson extends LessonPosition {
  videoId: string;
  title: string;
  moduleTitle: string;
  /** Posición dentro del curso completo, empezando en 1. */
  number: number;
}

/** Todas las lecciones del curso en el orden en que se estudian. */
export function flattenLessons(course: Pick<Course, 'modules'> | null | undefined): FlatLesson[] {
  if (!course?.modules) return [];
  const lessons: FlatLesson[] = [];
  course.modules.forEach((moduleEntry, moduleIndex) => {
    moduleEntry.videos.forEach((video, videoIndex) => {
      lessons.push({
        moduleIndex,
        videoIndex,
        videoId: video.id,
        title: video.title,
        moduleTitle: moduleEntry.title,
        number: lessons.length + 1,
      });
    });
  });
  return lessons;
}

function samePosition(a: LessonPosition, b: LessonPosition): boolean {
  return a.moduleIndex === b.moduleIndex && a.videoIndex === b.videoIndex;
}

export function indexOfLesson(lessons: FlatLesson[], position: LessonPosition): number {
  return lessons.findIndex((lesson) => samePosition(lesson, position));
}

/**
 * La lección anterior o la siguiente, cruzando el salto de módulo. Devuelve
 * `null` en los extremos, que es lo que deshabilita el botón.
 */
export function stepLesson(
  course: Pick<Course, 'modules'> | null | undefined,
  position: LessonPosition,
  direction: 1 | -1,
): LessonPosition | null {
  const lessons = flattenLessons(course);
  const current = indexOfLesson(lessons, position);
  if (current === -1) return null;
  const target = lessons[current + direction];
  return target ? { moduleIndex: target.moduleIndex, videoIndex: target.videoIndex } : null;
}

/**
 * Dónde retomar el curso: la primera lección sin completar.
 *
 * Abrir siempre por la primera obliga a buscar a mano por dónde iba uno, y en
 * un curso de cincuenta clases eso es una tarea. Si están todas completadas se
 * vuelve al principio, que es lo que se espera al repasar.
 */
export function findResumePosition(
  course: Pick<Course, 'modules'> | null | undefined,
  completedVideos: Record<string, boolean>,
): LessonPosition | null {
  const lessons = flattenLessons(course);
  if (lessons.length === 0) return null;
  const pending = lessons.find((lesson) => !completedVideos[lesson.videoId]);
  const target = pending ?? lessons[0];
  return { moduleIndex: target.moduleIndex, videoIndex: target.videoIndex };
}

/** Cuántas lecciones del curso están completadas. */
export function countCompleted(
  course: Pick<Course, 'modules'> | null | undefined,
  completedVideos: Record<string, boolean>,
): number {
  return flattenLessons(course).filter((lesson) => completedVideos[lesson.videoId]).length;
}
