import { useEffect, useRef, useState } from 'react';
import { X, Search, Check, Pencil } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { MenteeStudent } from '../types';
import { avatarSrc } from '../lib/avatar.js';

const SEARCH_FROM = 8;

/** Detalle de cursos de un mentee. Vive en un panel lateral para que la
 *  tarjeta mida lo mismo con 2 cursos que con 40. */
export function MenteeCoursesDialog({ mentee, onClose, onEdit }: {
  mentee: MenteeStudent | null;
  onClose: () => void;
  onEdit: (m: MenteeStudent) => void;
}) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (mentee && !d.open) d.showModal();
    if (!mentee && d.open) d.close();
    setQuery('');
  }, [mentee?.id]);

  const q = query.trim().toLowerCase();
  // Los que siguen en curso primero: es lo que el mentor viene a mirar.
  const courses = (mentee?.courses ?? [])
    .filter(c => !q || c.courseTitle.toLowerCase().includes(q))
    .sort((a, b) => Number(a.status === 'GRADUATED') - Number(b.status === 'GRADUATED'));
  const total = mentee?.courses.length ?? 0;
  const done = mentee?.courses.filter(c => c.status === 'GRADUATED').length ?? 0;

  return (
    <dialog
      ref={ref}
      className="mentee-sheet"
      aria-labelledby="mentee-sheet-title"
      onClose={onClose}
      onClick={(e) => { if (e.target === ref.current) onClose(); }}
    >
      {mentee && (
        <div className="mentee-sheet__body">
          <header className="mentee-sheet__head">
            <img src={avatarSrc(mentee.avatarUrl)} alt="" className="mentor-mentee-avatar" />
            <div className="mentor-mentee-id">
              <strong id="mentee-sheet-title">{mentee.name}</strong>
              <span>
                {t('mentor.menteeCoursesSummary', { defaultValue: '{{done}} de {{total}} cursos graduados', done, total })}
              </span>
            </div>
            <button type="button" className="mentee-sheet__close" onClick={onClose} aria-label={t('common.close', 'Cerrar')}>
              <X aria-hidden="true" />
            </button>
          </header>

          {total > SEARCH_FROM && (
            <label className="mentor-mentee-search">
              <Search aria-hidden="true" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('mentor.courseSearch', 'Buscar curso')}
                aria-label={t('mentor.courseSearch', 'Buscar curso')}
              />
            </label>
          )}

          <ul className="mentee-sheet__list">
            {courses.length === 0 && (
              <li className="mentor-mentee-meta">{t('mentor.courseNoMatch', 'Ningún curso coincide')}</li>
            )}
            {courses.map(c => {
              const graduated = c.status === 'GRADUATED';
              return (
                <li key={c.assignmentId}>
                  <div className="mentee-course__top">
                    <span className="mentee-course__title">{c.courseTitle}</span>
                    <span className="mentor-mentee-status" data-state={graduated ? 'graduated' : 'active'}>
                      {graduated && <Check aria-hidden="true" />}
                      {graduated ? t('mentor.statusGraduated', 'Graduado') : t('mentor.statusActive', 'En curso')}
                    </span>
                  </div>
                  <div className="mentor-mentee-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={c.courseProgress} aria-label={c.courseTitle}>
                    <span style={{ width: `${c.courseProgress}%` }} />
                  </div>
                  <div className="mentor-mentee-course__meta">
                    <span>{c.completedVideosCount} de {c.totalVideosCount} lecciones</span>
                    <b>{c.courseProgress}%</b>
                  </div>
                </li>
              );
            })}
          </ul>

          <footer className="mentee-sheet__foot">
            <button type="button" className="mentor-course-control mentor-course-import" onClick={() => onEdit(mentee)}>
              <Pencil aria-hidden="true" />
              {t('mentor.editCourses', 'Editar cursos')}
            </button>
          </footer>
        </div>
      )}
    </dialog>
  );
}
