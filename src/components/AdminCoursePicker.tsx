import { useEffect, useRef, useState } from 'react';
import { BookOpen, Check, ChevronDown } from 'lucide-react';
import type { Course } from '../types';
import { AdminSearchField } from './AdminListKit';
import { useTranslation } from 'react-i18next'

interface Props {
  courses: Course[];
  value: string;
  onChange: (courseId: string) => void;
}

export function AdminCoursePicker({ courses, value, onChange }: Props) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const selected = courses.find((course) => course.id === value) || courses[0];
  const matches = courses.filter((course) => course.title.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));

  useEffect(() => {
    if (!open) return;
    const closeOnOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    const closeOnFocusOutside = (event: FocusEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutside);
    document.addEventListener('keydown', closeOnEscape);
    document.addEventListener('focusin', closeOnFocusOutside);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutside);
      document.removeEventListener('keydown', closeOnEscape);
      document.removeEventListener('focusin', closeOnFocusOutside);
    };
  }, [open, courses.length]);

  const choose = (courseId: string) => {
    onChange(courseId);
    setOpen(false);
    setQuery('');
    triggerRef.current?.focus();
  };

  return (
    <div className="admin-course-picker" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="admin-course-picker__trigger"
        aria-expanded={open}
        aria-controls="admin-resource-course-options"
        aria-label={selected ? t('cursoTitleElegirOtroCurso', 'Curso: {{title}}. Elegir otro curso', { title: selected.title }) : t('elegirCurso', 'Elegir curso')}
        disabled={courses.length === 0}
        onClick={() => { setQuery(''); setOpen((current) => !current); }}
      >
        <BookOpen className="admin-course-picker__icon" aria-hidden="true" />
        <span className="admin-course-picker__text"><span>{t('curso', 'Curso')}</span><strong title={selected?.title}>{selected?.title || t('noHayCursosDisponibles', 'No hay cursos disponibles')}</strong></span>
        {selected && !selected.published && <span className="admin-course-picker__draft">{t('borrador', 'Borrador')}</span>}
        <ChevronDown className="admin-course-picker__chevron" aria-hidden="true" />
      </button>
      {open && (
        <div id="admin-resource-course-options" className="admin-course-picker__panel" role="group" aria-label={t('cursosDisponibles', 'Cursos disponibles')}>
          {courses.length > 5 && <AdminSearchField className="admin-course-picker__search" value={query} onChange={setQuery} placeholder={t('buscarCurso', 'Buscar curso')} label={t('buscarCurso', 'Buscar curso')} autoFocus />}
          <div className="admin-course-picker__options">
            {matches.map((course) => (
              <button key={course.id} type="button" className="admin-course-picker__option" aria-pressed={course.id === selected?.id} onClick={() => choose(course.id)}>
                <span className="admin-course-picker__option-text"><strong>{course.title}</strong><small>{course.published ? t('publicado', 'Publicado') : t('borrador', 'Borrador')}</small></span>
                {course.id === selected?.id && <Check aria-hidden="true" />}
              </button>
            ))}
            {matches.length === 0 && <p className="admin-course-picker__empty">{t('noHayCursosConEseNombre', 'No hay cursos con ese nombre.')}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
