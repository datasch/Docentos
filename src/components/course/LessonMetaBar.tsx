import React from 'react';
import { Check, ChevronLeft, ChevronRight, PlaySquare, Lock, Timer } from 'lucide-react';
import { useTranslation } from 'react-i18next'

interface LessonMetaBarProps {
  lessonTitle: string;
  moduleTitle: string;
  moduleIndex: number;
  providerLabel: string;
  lessonNumber: number;
  totalLessons: number;
  isCompleted: boolean;
  canComplete?: boolean;
  lockedReason?: 'video' | 'quiz';
  onToggleComplete: () => void;
  playbackUrl?: string;
  isLive?: boolean;
  meetingType?: string;
  meetingUrl?: string;
  /**
   * El servidor acaba de confirmar el 90% visto: el botón «Marcar como
   * completado» aparece con una animación y se anuncia a lectores de pantalla.
   */
  highlightComplete?: boolean;
  /** Segundos que faltan para que la lección se complete sola (últimos segundos del video). */
  autoCompleteIn?: number | null;
}

/**
 * Identidad de la lección bajo el reproductor.
 *
 * Reúne ubicación, título y la acción de completar o desmarcar la misión.
 * Bloquea estrictamente la opción de marcar completada hasta ver el video
 * completo y haber aprobado el examen (quiz) si la lección lo exige.
 */
export const LessonMetaBar: React.FC<LessonMetaBarProps> = ({
  lessonTitle,
  moduleTitle,
  moduleIndex,
  providerLabel,
  lessonNumber,
  totalLessons,
  isCompleted,
  canComplete = true,
  lockedReason = 'video',
  onToggleComplete,
  playbackUrl,
  isLive,
  meetingType,
  meetingUrl,
  highlightComplete = false,
  autoCompleteIn = null,
}) => {
  const { t } = useTranslation()
  return (
  <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6 lg:px-0">
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm leading-relaxed text-ink-soft">
          {/^m[óo]dulo\s/i.test(moduleTitle) ? moduleTitle : t('moduloModuleIndexModuleTitle', 'Módulo {{moduleIndex}} · {{moduleTitle}}', { moduleIndex: moduleIndex + 1, moduleTitle })}
        </p>
        {isLive && (meetingType === 'meet' || meetingType === 'jitsi') && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-brand-cyan)]/20 px-2 py-0.5 text-micro font-medium uppercase text-[var(--color-brand-cyan)] border border-[var(--color-brand-cyan)]/50 animate-pulse-slow">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-brand-cyan)] animate-ping" />
            {t('claseEnVivo', '¡CLASE EN VIVO!')}
          </span>
        )}
        {meetingType === 'async_record' && (
          <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-micro font-medium text-success-light border border-success/30">
            <PlaySquare className="h-2.5 w-2.5" />
            {t('grabacionAsincronica', 'Grabación Asincrónica')}
          </span>
        )}
      </div>
      <h1 className="academy-lesson-heading mt-2 text-2xl font-semibold leading-snug text-ink">{lessonTitle}</h1>
      <p className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm leading-relaxed text-ink-soft">
        <span className="tabular-nums">
          {t('leccionLessonNumberDeTotalLessons', 'Lección {{lessonNumber}} de {{totalLessons}}', { lessonNumber, totalLessons })}
        </span>
        <span aria-hidden>·</span>
        <span>{providerLabel}</span>
      </p>
    </div>

    {/* Completar la misión: el contador de los últimos segundos va dentro del mismo botón. */}
    <div className="hidden shrink-0 flex-col items-end gap-1.5 lg:flex">
      {isCompleted ? (
        <div role="status" className="lesson-done-badge" title={t('misionCompletadaBloqueada', 'Misión completada: el avance queda guardado y no se puede desmarcar.')}>
          <span aria-hidden className="lesson-done-badge__check"><Check className="h-3 w-3" strokeWidth={3.5} /></span>
          {t('misionCompletada', 'Misión completada')}
        </div>
      ) : (
        <>
          <button
            type="button"
            onClick={onToggleComplete}
            disabled={!canComplete}
            title={
              autoCompleteIn !== null
                ? t('lessonAutoCompleteHint', 'Al terminar el video, la misión se completa sola y pasas a la siguiente lección.')
                : !canComplete
                  ? lockedReason === 'quiz'
                    ? t('debesAprobarElExamenDelModuloParaPoder', 'Debes aprobar el examen del módulo para poder completar esta misión')
                    : t('debesVerAlMenosEl90DelVideoSin', 'Debes ver al menos el 90% del video, sin adelantarlo, para poder completar esta misión')
                  : t('marcarMisionComoCompletada', 'Marcar misión como completada')
            }
            className={`${highlightComplete && canComplete ? 'lesson-complete-ready ' : ''}flex items-center gap-2 rounded-xl px-4 py-2.5 text-meta font-medium tabular-nums transition-all ${
              autoCompleteIn !== null
                ? 'bg-slate-100 dark:bg-raised text-slate-900 dark:text-ink border border-slate-300 dark:border-line cursor-progress'
                : !canComplete
                  ? 'bg-slate-100 dark:bg-raised/40 text-slate-600 dark:text-ink-muted border border-slate-300 dark:border-line/60 cursor-not-allowed'
                  : 'bg-slate-100 dark:bg-raised text-slate-900 dark:text-ink border border-slate-200 dark:border-line hover:bg-slate-200/80 dark:hover:bg-line cursor-pointer shadow-sm'
            }`}
          >
            {autoCompleteIn !== null ? (
              <Timer aria-hidden className="h-4 w-4 shrink-0 text-brand-cyan" />
            ) : !canComplete ? (
              <Lock aria-hidden className="h-4 w-4 text-amber-400 shrink-0" />
            ) : (
              <Check aria-hidden className="h-4 w-4 shrink-0 text-brand-cyan" strokeWidth={2} />
            )}
            {autoCompleteIn !== null
              ? t('lessonAutoCompleteIn', 'Completando en {{seconds}} s', { seconds: autoCompleteIn })
              : !canComplete
                ? lockedReason === 'quiz'
                  ? t('aprobarExamenParaCompletar', 'Aprobar examen para completar')
                  : t('verVideoParaCompletar', 'Ver video para completar')
                : t('marcarComoCompletado', 'Marcar como completado')}
          </button>
          {highlightComplete && canComplete && autoCompleteIn === null && (
            <span role="status" className="sr-only">{t('yaPuedesMarcarEstaLeccionComoCompletada', 'Ya puedes marcar esta lección como completada.')}</span>
          )}
        </>
      )}
    </div>
  </div>
)
};

interface MobileLessonBarProps {
  lessonNumber: number;
  totalLessons: number;
  hasPrevious: boolean;
  hasNext: boolean;
  isCompleted: boolean;
  canComplete?: boolean;
  lockedReason?: 'video' | 'quiz';
  onPrevious: () => void;
  onNext: () => void;
  onToggleComplete: () => void;
  /**
   * El servidor acaba de confirmar el 90% visto: el botón «Marcar como
   * completado» aparece con una animación y se anuncia a lectores de pantalla.
   */
  highlightComplete?: boolean;
  /** Segundos que faltan para que la lección se complete sola. */
  autoCompleteIn?: number | null;
}

/**
 * Controles de avance en móvil.
 */
export const MobileLessonBar: React.FC<MobileLessonBarProps> = ({
  lessonNumber,
  totalLessons,
  hasPrevious,
  hasNext,
  isCompleted,
  canComplete = true,
  lockedReason = 'video',
  onPrevious,
  onNext,
  onToggleComplete,
  highlightComplete = false,
  autoCompleteIn = null,
}) => {
  const { t } = useTranslation()
  return (
  <div className="flex border-b border-line bg-surface lg:hidden px-1.5 py-1.5 items-center justify-between gap-0.5">
    <button
      type="button"
      onClick={onPrevious}
      disabled={!hasPrevious}
      className="flex min-w-0 items-center gap-1 rounded-lg px-2 py-2 text-micro text-ink-soft transition-colors disabled:text-ink-faint"
    >
      <ChevronLeft aria-hidden className="h-4 w-4 shrink-0" />
      <span className="truncate">{t('anterior', 'Anterior')}</span>
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
      <span className="truncate">{t('siguiente', 'Siguiente')}</span>
      <ChevronRight aria-hidden className="h-4 w-4 shrink-0" />
    </button>

    {isCompleted ? (
      <div role="status" className="lesson-done-badge lesson-done-badge--compact" title={t('misionCompletadaBloqueada', 'Misión completada: el avance queda guardado y no se puede desmarcar.')}>
        <span aria-hidden className="lesson-done-badge__check"><Check className="h-3 w-3" strokeWidth={3.5} /></span>
        {t('hecha', 'Hecha')}
      </div>
    ) : (
      <button
        type="button"
        onClick={onToggleComplete}
        disabled={!canComplete}
        title={
          !canComplete && lockedReason !== 'quiz'
            ? t('debesVerAlMenosEl90DelVideoSin', 'Debes ver al menos el 90% del video, sin adelantarlo, para poder completar esta misión')
            : undefined
        }
        className={`${highlightComplete && canComplete ? 'lesson-complete-ready ' : ''}flex min-w-0 items-center gap-1 rounded-lg px-2 py-2 text-micro font-semibold tabular-nums transition-colors ${
          autoCompleteIn !== null
            ? 'text-slate-900 dark:text-ink cursor-progress'
            : !canComplete
              ? 'text-slate-600 dark:text-ink-muted cursor-not-allowed'
              : 'text-slate-800 dark:text-ink-soft'
        }`}
      >
        {autoCompleteIn !== null ? (
          <Timer aria-hidden className="h-4 w-4 shrink-0" />
        ) : !canComplete ? (
          <Lock aria-hidden className="h-3.5 w-3.5 shrink-0 text-amber-400" />
        ) : (
          <Check aria-hidden className="h-4 w-4 shrink-0" strokeWidth={2} />
        )}
        <span className="truncate">
          {autoCompleteIn !== null
            ? t('lessonAutoCompleteShort', '{{seconds}} s', { seconds: autoCompleteIn })
            : !canComplete
              ? lockedReason === 'quiz'
                ? t('examen', 'Examen')
                : t('verVideo', 'Ver video')
              : t('completar', 'Completar')}
        </span>
      </button>
    )}
  </div>
)
};
