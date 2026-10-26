import React from 'react';
import { Check, ChevronLeft, ChevronRight, ExternalLink, PlaySquare, Lock, Unlock } from 'lucide-react';

interface LessonMetaBarProps {
  lessonTitle: string;
  moduleTitle: string;
  moduleIndex: number;
  providerLabel: string;
  lessonNumber: number;
  totalLessons: number;
  isCompleted: boolean;
  canComplete?: boolean;
  canUncomplete?: boolean;
  lockedReason?: 'video' | 'quiz';
  onToggleComplete: () => void;
  playbackUrl?: string;
  isLive?: boolean;
  meetingType?: string;
  meetingUrl?: string;
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
  canUncomplete = true,
  lockedReason = 'video',
  onToggleComplete,
  playbackUrl,
  isLive,
  meetingType,
  meetingUrl,
}) => (
  <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6 lg:px-0">
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-meta text-ink-muted">
          {/^m[óo]dulo\s/i.test(moduleTitle) ? moduleTitle : `Módulo ${moduleIndex + 1} · ${moduleTitle}`}
        </p>
        {isLive && (meetingType === 'meet' || meetingType === 'jitsi') && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-brand-cyan)]/20 px-2 py-0.5 text-micro font-bold uppercase text-[var(--color-brand-cyan)] border border-[var(--color-brand-cyan)]/50 animate-pulse-slow">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-brand-cyan)] animate-ping" />
            ¡CLASE EN VIVO!
          </span>
        )}
        {meetingType === 'async_record' && (
          <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-micro font-bold text-success-light border border-success/30">
            <PlaySquare className="h-2.5 w-2.5" />
            Grabación Asincrónica
          </span>
        )}
      </div>
      <h1 className="mt-1 text-title font-semibold text-ink">{lessonTitle}</h1>
      <p className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-meta text-ink-muted">
        <span className="tabular-nums">
          Lección {lessonNumber} de {totalLessons}
        </span>
        <span aria-hidden>·</span>
        <span>{providerLabel}</span>
        {playbackUrl && (
          <>
            <span aria-hidden>·</span>
            <a
              href={playbackUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-brand-cyan hover:underline"
            >
              Abrir el video aparte
              <ExternalLink aria-hidden className="h-3 w-3" />
            </a>
          </>
        )}
      </p>
    </div>

    {/* Botón estricto de completar o desmarcar misión */}
    <div className="hidden shrink-0 flex-col items-end gap-1.5 lg:flex">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onToggleComplete}
          disabled={(!isCompleted && !canComplete) || (isCompleted && !canUncomplete)}
          aria-pressed={isCompleted}
          title={
            !isCompleted && !canComplete
              ? lockedReason === 'quiz'
                ? 'Debes aprobar el examen del módulo para poder completar esta misión'
                : 'Debes ver el video completo para poder marcar la misión como completada'
              : isCompleted
                ? !canUncomplete
                  ? 'No puedes desmarcar esta misión porque tienes misiones posteriores completadas. Para retroceder, desmarca una por una hacia atrás.'
                  : 'Desmarcar misión completada'
                : 'Marcar misión como completada'
          }
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-meta font-bold transition-all ${
            isCompleted
              ? !canUncomplete
                ? 'bg-purple-100/70 dark:bg-purple-950/30 text-purple-700/60 dark:text-purple-300/50 border border-purple-200 dark:border-purple-500/20 cursor-not-allowed'
                : 'bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-500/50 hover:bg-purple-200/80 dark:hover:bg-purple-900/60 cursor-pointer shadow-sm'
              : !canComplete
                ? 'bg-slate-100 dark:bg-raised/40 text-slate-500 dark:text-ink-muted border border-slate-200 dark:border-line/60 cursor-not-allowed opacity-75'
                : 'bg-slate-100 dark:bg-raised text-slate-900 dark:text-ink border border-slate-200 dark:border-line hover:bg-slate-200/80 dark:hover:bg-line cursor-pointer shadow-sm'
          }`}
        >
          {!isCompleted && !canComplete ? (
            <Lock aria-hidden className="h-4 w-4 text-amber-400 shrink-0" />
          ) : (
            <Check aria-hidden className="h-4 w-4 shrink-0 text-cyan-400" strokeWidth={isCompleted ? 3 : 2} />
          )}
          {isCompleted
            ? 'Misión completada'
            : !canComplete
              ? lockedReason === 'quiz'
                ? 'Aprobar examen para completar'
                : 'Ver video para completar'
              : 'Marcar completada'}
        </button>
      </div>
    </div>
  </div>
);

interface MobileLessonBarProps {
  lessonNumber: number;
  totalLessons: number;
  hasPrevious: boolean;
  hasNext: boolean;
  isCompleted: boolean;
  canComplete?: boolean;
  canUncomplete?: boolean;
  lockedReason?: 'video' | 'quiz';
  onPrevious: () => void;
  onNext: () => void;
  onToggleComplete: () => void;
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
  canUncomplete = true,
  lockedReason = 'video',
  onPrevious,
  onNext,
  onToggleComplete,
}) => (
  <div className="flex border-b border-line bg-surface lg:hidden px-1.5 py-1.5 items-center justify-between gap-0.5">
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
      disabled={(!isCompleted && !canComplete) || (isCompleted && !canUncomplete)}
      aria-pressed={isCompleted}
      title={
        isCompleted && !canUncomplete
          ? 'No puedes desmarcar esta misión porque tienes misiones posteriores completadas'
          : undefined
      }
      className={`flex min-w-0 items-center gap-1 rounded-lg px-2 py-2 text-micro font-semibold transition-colors ${
        isCompleted
          ? !canUncomplete
            ? 'text-purple-600/50 dark:text-purple-300/50 cursor-not-allowed'
            : 'text-purple-700 dark:text-purple-300'
          : !canComplete
            ? 'text-slate-400 dark:text-ink-muted opacity-60 cursor-not-allowed'
            : 'text-slate-800 dark:text-ink-soft'
      }`}
    >
      {!isCompleted && !canComplete ? (
        <Lock aria-hidden className="h-3.5 w-3.5 shrink-0 text-amber-400" />
      ) : (
        <Check aria-hidden className="h-4 w-4 shrink-0" strokeWidth={isCompleted ? 3 : 2} />
      )}
      <span className="truncate">
        {isCompleted
          ? 'Hecha'
          : !canComplete
            ? lockedReason === 'quiz' ? 'Examen' : 'Bloqueada'
            : 'Marcar'}
      </span>
    </button>
  </div>
);
