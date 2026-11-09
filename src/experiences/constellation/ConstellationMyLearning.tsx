import React, { useEffect, useState } from 'react';
import { ArrowRight, BookOpen, LogIn, RotateCcw } from 'lucide-react';
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
    const label = stats?.certificate ? 'Completado' : stats?.total && stats.done === stats.total ? 'Lecciones completadas' : stats && stats.done > 0 ? 'En curso' : stats?.total ? 'Por comenzar' : 'Contenido del curso';
    return (
      <article key={course.id} className={`academy-learning-course ${recommended ? 'academy-learning-course--next' : ''}`}>
        <div className="academy-learning-course__cover">
          {course.coverImage ? <img src={course.coverImage} alt="" loading="lazy" decoding="async" /> : <BookOpen size={32} aria-hidden="true" />}
        </div>
        <div className="academy-learning-course__body">
          <span className="academy-learning-course__status">{recommended ? 'Continúa aprendiendo' : progress ? label : 'Curso disponible'}</span>
          <h3>{course.title}</h3>
          {stats?.percent !== null && stats?.percent !== undefined && (
            <div className="academy-learning-progress">
              <div className="academy-learning-progress__track" role="progressbar" aria-label={`Lecciones completadas de ${course.title}`}
                aria-valuemin={0} aria-valuemax={100} aria-valuenow={stats.percent} aria-valuetext={`${stats.done} de ${stats.total} lecciones`}>
                <span style={{ width: `${stats.percent}%` }} />
              </div>
              <p>{stats.done} de {stats.total} lecciones <span>{stats.percent}%</span></p>
            </div>
          )}
          <button type="button" className={recommended ? 'academy-button' : 'academy-text-button'} onClick={() => onContinue(course)}>
            {stats?.certificate || !stats?.total || stats.done === stats.total ? 'Ver curso' : stats.done > 0 ? 'Continuar' : 'Comenzar'}
            <ArrowRight size={18} aria-hidden="true" />
          </button>
        </div>
      </article>
    );
  }

  return (
    <section className="academy-my-learning academy-container">
      <header className="academy-learning-header">
        <h1 className="academy-section-title">Mi aprendizaje</h1>
        <p>Retoma tus cursos y consulta tu avance.</p>
      </header>

      {!user ? (
        <div className="academy-learning-empty">
          <LogIn size={28} aria-hidden="true" />
          <h2>Tu aprendizaje empieza con tu cuenta</h2>
          <p>Inicia sesión para consultar tus cursos y tu progreso.</p>
          <button type="button" className="academy-button" onClick={onLogin}>Iniciar sesión</button>
        </div>
      ) : !accessReady || !current ? (
        <p role="status" className="py-10 text-ink-soft">Cargando tu aprendizaje…</p>
      ) : (
        <>
          {current.failed && (
            <div role="alert" className="academy-learning-notice">
              <p>No pudimos cargar tu progreso. Puedes abrir tus cursos o volver a intentarlo.</p>
              <button type="button" className="academy-text-button" onClick={() => setRetry(value => value + 1)}><RotateCcw size={16} aria-hidden="true" /> Reintentar</button>
            </div>
          )}
          {available.length === 0 ? (
            <div className="academy-learning-empty">
              <BookOpen size={28} aria-hidden="true" />
              <h2>Aún no tienes cursos disponibles</h2>
              <p>Cuando se confirme tu acceso, encontrarás aquí tus cursos.</p>
              <button type="button" className="academy-button" onClick={onBrowse}>Explorar catálogo</button>
            </div>
          ) : (
            <>
              {next && <section aria-label="Continuar aprendiendo">{courseCard(next, true)}</section>}
              {rest.length > 0 && (
                <section className="academy-learning-section">
                  <h2>{next ? 'Más cursos' : 'Mis cursos'}</h2>
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
