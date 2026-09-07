import React from 'react';
import { Check, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';

interface LessonMetaBarProps {
  lessonTitle: string;
  moduleTitle: string;
  moduleIndex: number;
  providerLabel: string;
  lessonNumber: number;
  totalLessons: number;
  isCompleted: boolean;
  onToggleComplete: () => void;
  /**
   * Ruta de reproduccion de la clase, para abrirla fuera del marco.
   *
   * Es la nuestra —`/api/content/videos/<id>`, que comprueba el acceso antes de
   * redirigir—, no la del archivo: la salida de emergencia no puede saltarse el
   * control que protege el video.
   */
  playbackUrl?: string;
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
  playbackUrl,
}) => (
  <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6 lg:px-0">
    <div className="min-w-0">
      {/* Los títulos de módulo del catálogo ya empiezan por «Módulo N», así que
          anteponer el número otra vez lo decía dos veces seguidas. */}
      <p className="text-meta text-ink-muted">
        {/^m[óo]dulo\s/i.test(moduleTitle) ? moduleTitle : `Módulo ${moduleIndex + 1} · ${moduleTitle}`}
      </p>
      <h1 className="mt-1 text-title font-semibold text-ink">{lessonTitle}</h1>
      {/* El marco embebido es de un tercero y puede negarse a reproducir: el
          archivo ya no esta, dejo de estar compartido, o el navegador del
          telefono bloquea el reproductor incrustado. Sin esta salida el alumno
          se queda mirando el error de Google sin nada que pulsar. */}
      <p className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-meta text-ink-muted">
        <span className="tabular-nums">
          Lección {lessonNumber} de {totalLessons} · {providerLabel}
        </span>
        {playbackUrl && (
          <>
            <span aria-hidden>·</span>
            <a
              href={playbackUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded text-brand-cyan transition-colors hover:text-ink"
            >
              Abrir el video aparte
              <ExternalLink aria-hidden className="h-3 w-3" />
            </a>
          </>
        )}
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
          ? 'bg-raised text-brand-violet-light hover:bg-line'
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
  /* Las cuatro piezas comparten una fila de 360px o menos, asi que las
     etiquetas se recortan antes de desbordar y los iconos nunca lo hacen: en un
     telefono estrecho «Marcar» se salia por el borde derecho. */
  <div className="flex items-center justify-between gap-0.5 border-b border-line bg-surface px-1.5 py-1.5 lg:hidden">
    <button
      type="button"
      onClick={onPrevious}
      disabled={!hasPrevious}
      className="flex min-w-0 items-center gap-1 rounded-lg px-2 py-2 text-micro text-ink-soft transition-colors disabled:text-ink-faint"
    >
      <ChevronLeft aria-hidden className="h-4 w-4 shrink-0" />
      <span className="truncate">Anterior</span>
    </button>

    <span className="shrink-0 text-micro text-ink-muted tabular-nums">
      {lessonNumber} / {totalLessons}
    </span>

    <button
      type="button"
      onClick={onNext}
      disabled={!hasNext}
      className="flex min-w-0 items-center gap-1 rounded-lg px-2 py-2 text-micro text-ink-soft transition-colors disabled:text-ink-faint"
    >
      <span className="truncate">Siguiente</span>
      <ChevronRight aria-hidden className="h-4 w-4 shrink-0" />
    </button>

    <button
      type="button"
      onClick={onToggleComplete}
      aria-pressed={isCompleted}
      className={`flex min-w-0 items-center gap-1 rounded-lg px-2 py-2 text-micro font-semibold transition-colors ${
        isCompleted ? 'text-brand-violet-light' : 'text-ink-soft'
      }`}
    >
      <Check aria-hidden className="h-4 w-4 shrink-0" strokeWidth={isCompleted ? 3 : 2} />
      <span className="truncate">{isCompleted ? 'Hecha' : 'Marcar'}</span>
    </button>
  </div>
);
