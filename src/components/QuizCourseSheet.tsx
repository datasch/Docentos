import { useEffect, useRef, useState } from 'react';
import { X, Search, Check } from 'lucide-react';
import type { Course, Module, QuizQuestion } from '../types';
import { stripEmoji } from '../lib/stripEmoji';

const SEARCH_FROM = 8;

/** Módulos de un curso con el estado de su examen. Vive en un panel lateral
 *  para que la tarjeta del curso mida lo mismo con 2 módulos que con 40. */
export function QuizCourseSheet({ course, questionsOf, onClose, onOpenEditor }: {
  course: Course | null;
  questionsOf: (moduleId: string) => QuizQuestion[];
  onClose: () => void;
  onOpenEditor: (module: Module) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (course && !d.open) d.showModal();
    if (!course && d.open) d.close();
    setQuery('');
  }, [course?.id]);

  const modules = [...(course?.modules ?? [])].sort((a, b) => a.order - b.order);
  const withExam = modules.filter((m) => questionsOf(m.id).length > 0).length;
  const q = query.trim().toLowerCase();
  const shown = modules.filter((m) => !q || m.title.toLowerCase().includes(q));

  return (
    <dialog
      ref={ref}
      className="mentee-sheet"
      aria-labelledby="quiz-sheet-title"
      onClose={onClose}
      onClick={(e) => { if (e.target === ref.current) onClose(); }}
    >
      {course && (
        <div className="mentee-sheet__body">
          <header className="mentee-sheet__head mentee-sheet__head--plain">
            <div className="mentor-mentee-id">
              <strong id="quiz-sheet-title">{stripEmoji(course.title)}</strong>
              <span>{withExam} de {modules.length} módulos con examen</span>
            </div>
            <button type="button" className="mentee-sheet__close" onClick={onClose} aria-label="Cerrar">
              <X aria-hidden="true" />
            </button>
          </header>

          {modules.length > SEARCH_FROM && (
            <label className="mentor-mentee-search">
              <Search aria-hidden="true" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar módulo"
                aria-label="Buscar módulo"
              />
            </label>
          )}

          <ul className="mentee-sheet__list quiz-modules">
            {modules.length === 0 && <li className="mentee-sheet__empty">Este curso aún no tiene módulos</li>}
            {modules.length > 0 && shown.length === 0 && <li className="mentee-sheet__empty">Ningún módulo coincide</li>}
            {shown.map((m) => {
              const count = questionsOf(m.id).length;
              return (
                <li key={m.id} className="quiz-module">
                  <div className="quiz-module__top">
                    <span className="quiz-module__title">{stripEmoji(m.title)}</span>
                    <span className="mentor-mentee-status" data-state={count > 0 ? 'graduated' : 'active'}>
                      {count > 0 && <Check aria-hidden="true" />}
                      {count > 0 ? 'Con examen' : 'Sin examen'}
                    </span>
                  </div>
                  <div className="quiz-module__meta">
                    <span>Módulo {m.order}</span>
                    <span>{m.videos?.length || 0} {(m.videos?.length || 0) === 1 ? 'clase' : 'clases'}</span>
                    <span>{count > 0 ? `${count} ${count === 1 ? 'pregunta' : 'preguntas'}` : 'Sin preguntas'}</span>
                  </div>
                  <button
                    type="button"
                    className={`mentor-course-control${count > 0 ? '' : ' mentor-course-import'}`}
                    onClick={() => onOpenEditor(m)}
                  >
                    {count > 0 ? 'Editar examen' : 'Crear examen'}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </dialog>
  );
}
