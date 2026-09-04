import React from 'react';
import { Check, ChevronLeft, ChevronRight } from 'lucide-react';

interface LessonMetaBarProps {
  lessonTitle: string;
  moduleTitle: string;
  moduleIndex: number;
  providerLabel: string;
  lessonNumber: number;
  totalLessons: number;
  isCompleted: boolean;
  onToggleComplete: () => void;
}

/**
 * Identidad de la leccion bajo el reproductor.
 *
 * Reune lo que antes estaba repartido entre la cabecera del curso y la barra de
 * informacion del video: donde estas, que estas viendo y la unica accion que
 * cierra la clase.
 */
export const LessonMetaBar: React.FC<LessonMetaBarProps> = ({
  lessonTitle,
  moduleTitle,
  moduleIndex,
  providerLabel,
  lessonNumber,
  totalLessons,
  isCompleted,
  onToggleComplete,
}) => (
  <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6 lg:px-0">
    <div className="min-w-0">
      {/* Los títulos de módulo del catálogo ya empiezan por «Módulo N», así que
          anteponer el número otra vez lo decía dos veces seguidas. */}
      <p className="text-meta text-ink-muted">
        {/^m[óo]dulo\s/i.test(moduleTitle) ? moduleTitle : `Módulo ${moduleIndex + 1} · ${moduleTitle}`}
      </p>
      <h1 className="mt-1 text-title font-semibold text-ink">{lessonTitle}</h1>
      <p className="mt-1.5 text-meta text-ink-muted tabular-nums">
        Lección {lessonNumber} de {totalLessons} · {providerLabel}
      </p>
    </div>

    {/* Debajo de lg la misma acción ya vive en MobileLessonBar, pegada al
        reproductor; repetirla aquí la pedía dos veces en la misma pantalla. */}
    <button
      type="button"
      onClick={onToggleComplete}
      aria-pressed={isCompleted}
      className={`hidden shrink-0 items-center gap-2 rounded-lg px-4 py-2.5 text-meta font-semibold transition-colors lg:flex ${
        isCompleted
          ? 'bg-raised text-brand-blue hover:bg-line'
          : 'bg-raised text-ink hover:bg-line'
      }`}
    >
      <Check aria-hidden className="h-4 w-4" strokeWidth={isCompleted ? 3 : 2} />
      {isCompleted ? 'Clase completada' : 'Marcar completada'}
    </button>
  </div>
);

interface MobileLessonBarProps {
  lessonNumber: number;
  totalLessons: number;
  hasPrevious: boolean;
  hasNext: boolean;
  isCompleted: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onToggleComplete: () => void;
}

/**
 * Controles de avance en movil.
 *
 * En escritorio viven flotando sobre el video; a 390px esa zona la ocupa el
 * pulgar sobre los controles del reproductor, asi que bajan a una fila propia.
 */
export const MobileLessonBar: React.FC<MobileLessonBarProps> = ({
  lessonNumber,
  totalLessons,
  hasPrevious,
  hasNext,
  isCompleted,
  onPrevious,
  onNext,
  onToggleComplete,
}) => (
  <div className="flex items-center justify-between border-b border-line bg-surface px-2 py-1.5 lg:hidden">
    <button
      type="button"
      onClick={onPrevious}
      disabled={!hasPrevious}
      className="flex items-center gap-1 rounded-lg px-3 py-2 text-micro text-ink-soft transition-colors disabled:text-ink-faint"
    >
      <ChevronLeft aria-hidden className="h-4 w-4" />
      Anterior
    </button>

    <span className="text-micro text-ink-muted tabular-nums">
      {lessonNumber} / {totalLessons}
    </span>

    <button
      type="button"
      onClick={onNext}
      disabled={!hasNext}
      className="flex items-center gap-1 rounded-lg px-3 py-2 text-micro text-ink-soft transition-colors disabled:text-ink-faint"
    >
      Siguiente
      <ChevronRight aria-hidden className="h-4 w-4" />
    </button>

    <button
      type="button"
      onClick={onToggleComplete}
      aria-pressed={isCompleted}
      className={`flex items-center gap-1 rounded-lg px-3 py-2 text-micro font-semibold transition-colors ${
        isCompleted ? 'text-brand-blue' : 'text-ink-soft'
      }`}
    >
      <Check aria-hidden className="h-4 w-4" strokeWidth={isCompleted ? 3 : 2} />
      {isCompleted ? 'Hecha' : 'Marcar'}
    </button>
  </div>
);
