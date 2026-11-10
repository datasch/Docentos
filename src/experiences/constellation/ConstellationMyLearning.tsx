import React, { useEffect, useState } from 'react';
import { ArrowRight, BookOpen, LogIn, RotateCcw } from 'lucide-react';
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
    return (
      <article
        key={course.id}
        tabIndex={0}
        role="button"
        aria-label={`${course.title} - ${label}`}
        onClick={() => onContinue(course)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onContinue(course);
          }
        }}
        className={`academy-learning-course group cursor-pointer ${recommended ? 'academy-learning-course--next' : ''}`}
      >
        <div className="academy-learning-course__cover">
          {course.coverImage ? (
            <img
              src={course.coverImage}
              alt={course.title}
              loading="lazy"
              decoding="async"
              className="group-hover:scale-105 transition-transform duration-500 ease-out"
            />
          ) : (
            <BookOpen size={32} aria-hidden="true" />
          )}
        </div>
        <div className="academy-learning-course__body">
          <span className="academy-learning-course__status">
            {recommended
              ? t('myLearning.continueLearning', 'Continúa aprendiendo')
              : progress
                ? label
                : t('myLearning.availableCourse', 'Curso disponible')}
          </span>
          <h3 className="group-hover:text-cyan-600 dark:group-hover:text-cyan-300 transition-colors">
            {course.title}
          </h3>
          {stats?.percent !== null && stats?.percent !== undefined && (
            <div className="academy-learning-progress">
              <div className="academy-learning-progress__track" role="progressbar" aria-label={`Lecciones completadas de ${course.title}`}
                aria-valuemin={0} aria-valuemax={100} aria-valuenow={stats.percent} aria-valuetext={`${stats.done} de ${stats.total} lecciones`}>
                <span style={{ width: `${stats.percent}%` }} />
              </div>
              <p>
                {t('myLearning.progressCount', { done: stats.done, total: stats.total, defaultValue: `${stats.done} de ${stats.total} lecciones` })} <span>{stats.percent}%</span>
              </p>
            </div>
          )}
          <div className="mt-auto pt-3 flex items-center">
            <span
              className={`inline-flex items-center gap-1.5 transition-all select-none ${
                recommended
                  ? 'academy-button'
                  : 'text-sm font-semibold text-cyan-600 dark:text-cyan-400 group-hover:translate-x-1'
              }`}
            >
              <span>
                {stats?.certificate || !stats?.total || stats.done === stats.total
                  ? t('myLearning.viewCourse', 'Ver curso')
                  : stats.done > 0
                    ? t('myLearning.continueAction', 'Continuar')
                    : t('myLearning.startAction', 'Comenzar')}
              </span>
              <ArrowRight size={18} aria-hidden="true" />
            </span>
          </div>
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
              <button type="button" className="academy-button" onClick={onBrowse}>{t('hero.exploreCourses', 'Explorar catálogo')}</button>
            </div>
          ) : (
            <>
              {next && <section aria-label={t('myLearning.continueLearning', 'Continuar aprendiendo')}>{courseCard(next, true)}</section>}
              {rest.length > 0 && (
                <section className="academy-learning-section">
                  <h2>{next ? (t('myLearning.moreCourses', 'Más cursos')) : (t('myLearning.myCourses', 'Mis cursos'))}</h2>
                  <div className="academy-learning-grid">{rest.map(course => courseCard(course))}</div>
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
