import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, CheckCircle2, Loader2, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { classifyNps } from '../lib/listening';
import {
  COURSE_NPS_LIMITS,
  NPS_SELECTED,
  NPS_TONE,
  type CourseNpsStage,
} from '../lib/courseNps';
import { api } from '../lib/api';
import { useBodyScrollLock } from '../lib/useBodyScrollLock';

interface CourseNpsModalProps {
  isOpen: boolean;
  courseId: string;
  courseTitle: string;
  stage: CourseNpsStage | null;
  onCompleted: (resolvedStages: CourseNpsStage[]) => void;
  onDismissed: (resolvedStages: CourseNpsStage[]) => void;
}

const DISPLAY_FONT = { fontFamily: 'var(--academy-font-display, inherit)' } as const;

export const CourseNpsModal: React.FC<CourseNpsModalProps> = ({
  isOpen,
  courseId,
  courseTitle,
  stage,
  onCompleted,
  onDismissed,
}) => {
  const { t } = useTranslation();
  const [score, setScore] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [thankYou, setThankYou] = useState(false);

  useBodyScrollLock(isOpen && stage !== null);

  useEffect(() => {
    if (!isOpen || !stage) return;
    setScore(null);
    setComment('');
    setError(null);
    setThankYou(false);
  }, [isOpen, stage, courseId]);

  if (!isOpen || !stage) return null;

  const stageCopy: Record<
    CourseNpsStage,
    { badge: string; title: string; question: string; placeholder: string }
  > = {
    START: {
      badge: t('courseNps.stageStartBadge', 'Inicio del curso'),
      title: t('courseNps.stageStartTitle', 'Tu primera impresión cuenta'),
      question: t(
        'courseNps.stageStartQuestion',
        'Del 0 al 10, ¿qué tan probable es que recomiendes este curso según su enfoque y presentación inicial?',
      ),
      placeholder: t(
        'courseNps.stageStartPlaceholder',
        '¿Qué esperas lograr con este curso o qué te pareció la bienvenida? (opcional)',
      ),
    },
    MID: {
      badge: t('courseNps.stageMidBadge', 'Mitad del curso · 50%'),
      title: t('courseNps.stageMidTitle', '¿Cómo va tu experiencia hasta aquí?'),
      question: t(
        'courseNps.stageMidQuestion',
        'Ya avanzaste la mitad. Del 0 al 10, ¿qué tan probable es que recomiendes la calidad de este curso hasta ahora?',
      ),
      placeholder: t(
        'courseNps.stageMidPlaceholder',
        '¿Qué es lo más valioso hasta ahora o qué mejorarías de las clases? (opcional)',
      ),
    },
    END: {
      badge: t('courseNps.stageEndBadge', 'Curso completado · 100%'),
      title: t('courseNps.stageEndTitle', '¡Felicitaciones por completar el curso!'),
      question: t(
        'courseNps.stageEndQuestion',
        'Ahora que lo terminaste, del 0 al 10, ¿qué tan probable es que recomiendes este curso a un colega?',
      ),
      placeholder: t(
        'courseNps.stageEndPlaceholder',
        'Cuéntanos qué te dejó el curso o qué ajustarías para futuros estudiantes (opcional)',
      ),
    },
  };

  const copy = stageCopy[stage];

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (score === null || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await api.submitCourseNps(courseId, {
        stage,
        npsScore: score,
        comment: comment.trim() || undefined,
        dismissed: false,
      });
      setThankYou(true);
      setTimeout(() => {
        onCompleted(res.resolvedStages);
      }, 850);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : t('courseNps.submitError', 'No pudimos guardar tu respuesta. Inténtalo de nuevo.'),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const modal = (
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-backdrop-fade overscroll-contain"
      role="dialog"
      aria-modal="true"
      aria-labelledby="course-nps-title"
    >
      <div className="app-dialog relative w-full max-w-xl overflow-hidden rounded-2xl border border-line bg-card shadow-2xl animate-modal-card">
        <header className="flex items-start justify-between gap-4 border-b border-line bg-surface px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-cyan/35 bg-brand-cyan/10 px-2.5 py-0.5 text-xs font-semibold text-brand-cyan">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              {copy.badge}
            </span>
            <h2
              id="course-nps-title"
              style={DISPLAY_FONT}
              className="mt-2 text-lg font-bold leading-snug text-ink sm:text-xl"
            >
              {copy.title}
            </h2>
            <p className="mt-0.5 truncate text-xs text-ink-muted" title={courseTitle}>
              {courseTitle}
            </p>
          </div>
          <span className="shrink-0 rounded-full border border-line bg-raised px-2.5 py-1 text-[11px] font-semibold text-ink-soft">
            {t('courseNps.requiredBadge', 'Obligatoria')}
          </span>
        </header>

        {thankYou ? (
          <div className="flex flex-col items-center justify-center gap-2 px-6 py-10 text-center">
            <div className="grid h-12 w-12 place-items-center rounded-full bg-success-light/15 text-success-light">
              <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
            </div>
            <p className="text-base font-semibold text-ink">
              {t('courseNps.thankYouTitle', '¡Gracias por ayudarnos a mejorar este curso!')}
            </p>
            <p className="text-sm text-ink-muted">
              {t('courseNps.thankYouDesc', 'Tu calificación se registró para medir la calidad del contenido.')}
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5 px-5 py-5 sm:px-6">
            <fieldset>
              <legend className="mb-3 text-sm font-semibold leading-relaxed text-ink">
                {copy.question}
              </legend>
              <div
                className="grid grid-cols-6 gap-1.5 sm:grid-cols-11"
                role="radiogroup"
                aria-label={t('courseNps.scaleAria', 'Calificación NPS del curso de 0 a 10')}
              >
                {Array.from({ length: 11 }, (_, value) => {
                  const group = classifyNps(value);
                  const selected = score === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setScore(value)}
                      className={`min-h-11 cursor-pointer rounded-lg border-2 text-sm font-bold tabular-nums transition-colors ${
                        selected ? NPS_SELECTED[group] : `bg-canvas/40 ${NPS_TONE[group]}`
                      }`}
                    >
                      {value}
                    </button>
                  );
                })}
              </div>
              <div className="mt-1.5 flex justify-between text-xs text-ink-muted">
                <span>{t('0NadaProbable', '0 · Nada probable')}</span>
                <span>{t('muyProbable10', 'Muy probable · 10')}</span>
              </div>
            </fieldset>

            <label className="block">
              <span className="mb-1.5 flex items-center justify-between text-xs font-semibold text-ink-soft">
                <span>{t('courseNps.commentLabel', 'Comentario sobre la calidad del curso (opcional)')}</span>
                <span className="font-normal text-ink-muted">
                  {comment.length}/{COURSE_NPS_LIMITS.commentMax}
                </span>
              </span>
              <textarea
                rows={3}
                maxLength={COURSE_NPS_LIMITS.commentMax}
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                placeholder={copy.placeholder}
                className="w-full resize-y rounded-xl border border-line bg-canvas/50 px-3.5 py-2.5 text-base text-ink outline-none placeholder:text-ink-faint focus:border-brand-cyan sm:text-sm"
              />
            </label>

            {error && (
              <div
                role="alert"
                className="flex items-center gap-2 rounded-xl border border-danger/30 bg-danger/10 p-3 text-sm text-danger-light"
              >
                <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex flex-col gap-2.5 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-ink-muted">
                {t('courseNps.requiredHint', 'Selecciona una puntuación del 0 al 10 para continuar.')}
              </p>
              <button
                type="submit"
                disabled={score === null || submitting}
                className="btn-brand-primary flex min-h-11 cursor-pointer items-center justify-center gap-2 px-5 py-2 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                {t('courseNps.submit', 'Enviar calificación')}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modal, document.body) : modal;
};
