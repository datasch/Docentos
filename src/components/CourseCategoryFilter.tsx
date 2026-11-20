import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const counts = new Map<string, number>();
  for (const course of courses) {
    const category = getCanonicalCategory(course.category);
    if (category) counts.set(category, (counts.get(category) ?? 0) + 1);
  }
  const options = ['todos', ...STANDARD_COURSE_CATEGORIES.filter((category) => counts.has(category) || category === value)];
  const countFor = (category: string) => category === 'todos' ? courses.length : counts.get(category) ?? 0;

  const getCategoryLabel = (cat: string) => {
    if (cat === 'todos') return t('categories.todos', 'Todos');
    return t(`categories.${cat}`, cat);
  };

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
    <div className={`min-w-0 w-full md:w-72 md:flex-none ${className}`}>
    <details
      ref={detailsRef}
      className="course-category-filter"
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
      <summary id={id} aria-label={`${t('catalog.filterByCategory', 'Filtrar por categoría')}: ${getCategoryLabel(value)}`}>
        <span className="course-category-filter__label"><span className="text-ink-muted">{t('catalog.categoryLabel', 'Categoría')}: </span>{value === 'todos' ? t('catalog.allCategories', 'Todas') : getCategoryLabel(value)}</span>
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
            <span>{getCategoryLabel(category)}</span>
            <span className="course-category-filter__count">{countFor(category)}</span>
          </button>
        ))}
      </div>
    </details>
    </div>
  );
}
