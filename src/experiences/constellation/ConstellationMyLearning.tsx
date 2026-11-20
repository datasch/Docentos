import React, { useEffect, useState } from 'react';
import { BookOpen, LogIn, Play, RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Course, User } from '../../types';
import { api } from '../../lib/api';
import { courseLearningProgress, learningCourses, nextLearningCourse } from '../../lib/myLearning';

import { LearningCertificates } from './LearningCertificates';

type ProgressData = Awaited<ReturnType<typeof api.getProgress>>;

interface MyLearningProps {
  user: User | null;
  courses: Course[];
  accessReady: boolean;
  onContinue: (course: Course) => void;
  onBrowse: () => void;
  onLogin: () => void;
  onVerifyCertificate?: (code: string) => void;
}

export function ConstellationMyLearning({ user, courses, accessReady, onContinue, onBrowse, onLogin, onVerifyCertificate }: MyLearningProps) {
  const { t } = useTranslation();
  const [snapshot, setSnapshot] = useState<{ owner: User; data?: ProgressData; failed?: boolean } | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setSnapshot(null);
    if (!user || !accessReady) return;
    api.getProgress().then(data => {
      if (!cancelled) setSnapshot({ owner: user, data });
    }).catch(() => {
      if (!cancelled) setSnapshot({ owner: user, failed: true });
    });
    return () => { cancelled = true; };
  }, [user, accessReady, retry]);

  const current = user && snapshot?.owner === user ? snapshot : null;
  const progress = current?.data;
  const available = learningCourses(courses, accessReady, Boolean(user));
  const certificates = progress?.certificates || [];
  const next = progress ? nextLearningCourse(available, progress.completedVideos, certificates, progress.lastCourseId) : undefined;
  const rest = available.filter(course => course.id !== next?.id);

  function courseCard(course: Course, recommended = false) {
    const stats = progress ? courseLearningProgress(course, progress.completedVideos, certificates) : null;
    const label = stats?.certificate
      ? t('myLearning.completed', 'Completado')
      : stats?.total && stats.done === stats.total
        ? t('myLearning.lessonsCompleted', 'Lecciones completadas')
        : stats && stats.done > 0
          ? t('myLearning.inProgress', 'En curso')
          : stats?.total
            ? t('myLearning.toStart', 'Por comenzar')
            : t('myLearning.courseContent', 'Contenido del curso');
    const eyebrow = recommended
      ? t('myLearning.continueLearning', 'Continúa aprendiendo')
      : progress
        ? label
        : t('myLearning.availableCourse', 'Curso disponible');
    const action =
      stats?.certificate || !stats?.total || stats.done === stats.total
        ? t('myLearning.viewCourse', 'Ver curso')
        : stats.done > 0
          ? t('myLearning.continueAction', 'Continuar')
          : t('myLearning.startAction', 'Comenzar');
    const cover = course.coverImage ? (
      <img
        src={course.coverImage}
        alt=""
        loading={recommended ? 'eager' : 'lazy'}
        decoding="async"
        className={`h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.02] ${recommended ? 'rounded-xl' : ''}`}
      />
    ) : (
      <span className="grid h-full w-full place-items-center text-ink-faint"><BookOpen size={32} aria-hidden="true" /></span>
    );
    const progressBlock =
      stats?.percent !== null && stats?.percent !== undefined ? (
        <div className="mt-4">
          <div
            className="h-1.5 overflow-hidden rounded-full bg-line"
            role="progressbar"
            aria-label={t('leccionesCompletadasDeTitle', 'Lecciones completadas de {{title}}', { title: course.title })}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={stats.percent}
            aria-valuetext={t('doneDeTotalLecciones', '{{done}} de {{total}} lecciones', { done: stats.done, total: stats.total })}
          >
            <span className="block h-full rounded-full bg-brand-cyan transition-[width] duration-500 ease-out" style={{ width: `${stats.percent}%` }} />
          </div>
          <p className="mt-2 flex items-baseline justify-between text-sm text-ink-muted">
            <span>{t('myLearning.progressCount', { done: stats.done, total: stats.total, defaultValue: `${stats.done} de ${stats.total} lecciones` })}</span>
            <span className="tabular-nums">{stats.percent}%</span>
          </p>
        </div>
      ) : null;
    const button = (
      <button
        type="button"
        onClick={(event) => { event.stopPropagation(); onContinue(course); }}
        className={`flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-brand-cyan text-sm font-semibold text-on-brand transition-opacity hover:opacity-90 ${recommended ? 'md:max-w-xs' : ''}`}
      >
        <Play aria-hidden className="h-4 w-4 fill-current" />
        {action}
      </button>
    );

    if (recommended) {
      return (
        <article
          key={course.id}
          aria-label={`${course.title} - ${label}`}
          onClick={() => onContinue(course)}
          className="academy-course-card group grid cursor-pointer grid-cols-1 overflow-hidden rounded-2xl border border-line bg-surface transition-colors hover:border-line-strong lg:grid-cols-2"
        >
          <div className="flex items-center p-5 sm:p-8 lg:order-2">
            <div className="aspect-video w-full overflow-hidden rounded-xl bg-raised">{cover}</div>
          </div>
          <div className="flex min-w-0 flex-col justify-center px-5 pb-6 sm:px-8 sm:pb-8 lg:order-1 lg:p-12">
            <p className="text-sm text-ink-muted">{eyebrow}</p>
            <h3 className="mt-2 text-3xl font-semibold leading-tight text-ink lg:text-4xl">{course.title}</h3>
            {progressBlock}
            <div className="mt-6">{button}</div>
          </div>
        </article>
      );
    }

    return (
      <article
        key={course.id}
        aria-label={`${course.title} - ${label}`}
        onClick={() => onContinue(course)}
        className="academy-course-card group flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-line bg-surface transition-colors hover:border-line-strong"
      >
        <div className="aspect-video w-full overflow-hidden bg-raised">{cover}</div>
        <div className="flex min-w-0 flex-1 flex-col p-5">
          <p className="text-sm text-ink-muted">{eyebrow}</p>
          <h3 className="mt-1 text-lg font-semibold leading-snug text-ink">{course.title}</h3>
          {progressBlock}
          <div className="mt-auto pt-5">{button}</div>
        </div>
      </article>
    );
  }

  return (
    <section className="academy-my-learning academy-container">
      <header className="academy-learning-header">
        <h1 className="academy-section-title">{t('myLearning.title', 'Mi aprendizaje')}</h1>
        <p>{t('myLearning.subtitle', 'Retoma tus cursos y consulta tu avance.')}</p>
      </header>

      {!user ? (
        <div className="academy-learning-empty">
          <LogIn size={28} aria-hidden="true" />
          <h2>{t('myLearning.emptyAccountTitle', 'Tu aprendizaje empieza con tu cuenta')}</h2>
          <p>{t('myLearning.emptyAccountDesc', 'Inicia sesión para consultar tus cursos y tu progreso.')}</p>
          <button type="button" className="academy-button" onClick={onLogin}>{t('myLearning.loginAction', 'Iniciar sesión')}</button>
        </div>
      ) : !accessReady || !current ? (
        <p role="status" className="py-10 text-ink-soft">{t('myLearning.loading', 'Cargando tu aprendizaje…')}</p>
      ) : (
        <>
          {current.failed && (
            <div role="alert" className="academy-learning-notice">
              <p>{t('myLearning.failedNotice', 'No pudimos cargar tu progreso. Puedes abrir tus cursos o volver a intentarlo.')}</p>
              <button type="button" className="academy-text-button" onClick={() => setRetry(value => value + 1)}><RotateCcw size={16} aria-hidden="true" /> {t('myLearning.retry', 'Reintentar')}</button>
            </div>
          )}
          {available.length === 0 ? (
            <div className="academy-learning-empty">
              <BookOpen size={28} aria-hidden="true" />
              <h2>{t('myLearning.noCoursesTitle', 'Aún no tienes cursos disponibles')}</h2>
              <p>{t('myLearning.noCoursesDesc', 'Cuando se confirme tu acceso, encontrarás aquí tus cursos.')}</p>
              <button type="button" className="academy-button" onClick={onBrowse}>{t('hero.exploreCourses', 'Explorar cursos')}</button>
            </div>
          ) : (
            <>
              {next && <section aria-label={t('myLearning.continueLearning', 'Continúa aprendiendo')}>{courseCard(next, true)}</section>}
              {rest.length > 0 && (
                <section className="academy-learning-section">
                  <h2>{next ? (t('myLearning.moreCourses', 'Más cursos')) : (t('myLearning.myCourses', 'Mis cursos'))}</h2>
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">{rest.map(course => courseCard(course))}</div>
                </section>
              )}
            </>
          )}
          <LearningCertificates key={user.id} certificates={certificates} studentName={user.name} onVerify={onVerifyCertificate} />
        </>
      )}
    </section>
  );
}
