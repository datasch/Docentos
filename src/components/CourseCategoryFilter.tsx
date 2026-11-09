import React, { useEffect, useRef } from 'react';
import { ChevronDown } from 'lucide-react';
import { getCanonicalCategory, STANDARD_COURSE_CATEGORIES } from '../lib/courseCategories';

interface CourseCategoryFilterProps {
  id: string;
  courses: ReadonlyArray<{ category?: string | null }>;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function CourseCategoryFilter({ id, courses, value, onChange, className = '' }: CourseCategoryFilterProps) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const counts = new Map<string, number>();
  for (const course of courses) {
    const category = getCanonicalCategory(course.category);
    if (category) counts.set(category, (counts.get(category) ?? 0) + 1);
  }
  const options = ['todos', ...STANDARD_COURSE_CATEGORIES.filter((category) => counts.has(category) || category === value)];
  const countFor = (category: string) => category === 'todos' ? courses.length : counts.get(category) ?? 0;

  useEffect(() => {
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Node && !detailsRef.current?.contains(event.target)) {
        detailsRef.current?.removeAttribute('open');
      }
    };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, []);

  return (
    <div className={`min-w-0 w-full md:flex-1 ${className}`}>
    <details
      ref={detailsRef}
      className="course-category-filter lg:hidden"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          detailsRef.current?.removeAttribute('open');
          detailsRef.current?.querySelector('summary')?.focus();
        }
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          event.currentTarget.open = false;
        }
      }}
    >
      <summary id={id} aria-label={`Filtrar por categoría: ${value === 'todos' ? 'Todos' : value}`}>
        <span className="course-category-filter__label">{value === 'todos' ? 'Todas las categorías' : value}</span>
        <ChevronDown size={16} className="course-category-filter__chevron" aria-hidden="true" />
      </summary>
      <div className="course-category-filter__options" role="group" aria-labelledby={id}>
        {options.filter((category) => category !== value).map((category) => (
          <button
            key={category}
            type="button"
            onClick={() => {
              onChange(category);
              detailsRef.current?.removeAttribute('open');
              detailsRef.current?.querySelector('summary')?.focus();
            }}
          >
            <span>{category === 'todos' ? 'Todos' : category}</span>
            <span className="course-category-filter__count">{countFor(category)}</span>
          </button>
        ))}
      </div>
    </details>
    <div role="group" aria-label="Filtrar por categoría" className="hidden min-w-0 flex-wrap items-center gap-2 lg:flex">
      {options.map((category) => (
        <button key={category} type="button" onClick={() => onChange(category)}
          aria-pressed={category === value}
          className={`inline-flex min-h-11 max-w-full items-center justify-center gap-2 rounded-full px-3 py-2 font-constellation-label text-xs tracking-wide transition-colors cursor-pointer ${category === value
            ? 'bg-brand-cyan text-on-brand font-bold'
            : 'bg-slate-100 text-slate-600 border border-slate-200/60 hover:bg-slate-200/80 hover:text-slate-900 dark:bg-white/[0.03] dark:text-white/60 dark:border-white/[0.05] dark:hover:bg-white/[0.07] dark:hover:text-white'}`}
        >
          <span className="min-w-0 break-words text-left">{category === 'todos' ? 'Todos' : category}</span>
          <span className={`shrink-0 rounded-full px-1.5 text-[10px] tabular-nums ${category === value ? 'bg-black/10' : 'bg-slate-200/70 dark:bg-white/10'}`}>{countFor(category)}</span>
        </button>
      ))}
    </div>
    </div>
  );
}
