import { useLandingConfig } from '../../lib/landingConfig';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Course } from '../../types';
import { searchCourseCatalog } from '../../lib/catalogSearch';
import { SearchField } from '../../components/SearchField';
import { CourseShareButton } from '../../components/CourseShareButton';
import { ExpandableDescription } from './ExpandableDescription';
import {
  Play,
  Layers,
  PlayCircle,
  Sparkles,
  ArrowRight,
  BookOpen,
  LayoutGrid,
  List,
  Flame,
  RotateCcw,
} from 'lucide-react';
import { CourseCategoryFilter } from '../../components/CourseCategoryFilter';
import {
  isStandardCategory,
} from '../../lib/courseCategories';
import i18next from 'i18next'

interface ConstellationCourseCatalogProps {
  courses: Course[];
  onSelectCourse: (course: Course) => void;
  onPrefetchCourse?: (courseId: string) => void;
  featuredOnly?: boolean;
  onBrowseCatalog?: () => void;
}

const FALLBACK_COVERS = [
  'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=640&auto=format&fit=crop&q=72', // Matrix/Code
  'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=640&auto=format&fit=crop&q=72', // Cyber/Security
  'https://images.unsplash.com/photo-1518770660439-4636190af475?w=640&auto=format&fit=crop&q=72', // Circuit/Microchip
  'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=640&auto=format&fit=crop&q=72', // 3D Fluid Abstract
  'https://images.unsplash.com/photo-1504639725590-34d0984388bd?w=640&auto=format&fit=crop&q=72', // Frontend Development
  'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=640&auto=format&fit=crop&q=72', // AI Neural Network
];

function getResponsiveCoverProps(rawUrl: string, variant: 'featured' | 'card') {
  if (!rawUrl || (!rawUrl.includes('images.unsplash.com') && !rawUrl.includes('plus.unsplash.com'))) {
    return { src: rawUrl };
  }
  const buildVariant = (w: number, q: number) => {
    try {
      const u = new URL(rawUrl);
      u.searchParams.set('w', String(w));
      u.searchParams.set('q', String(q));
      u.searchParams.set('auto', 'format');
      u.searchParams.set('fit', 'crop');
      return u.toString();
    } catch {
      return rawUrl;
    }
  };
  if (variant === 'featured') {
    return {
      src: buildVariant(600, 72),
      srcSet: `${buildVariant(400, 70)} 400w, ${buildVariant(600, 72)} 600w, ${buildVariant(800, 74)} 800w`,
      sizes: i18next.t('maxwidth640px92vwMaxwidth1024px90vw520px', '(max-width: 640px) 92vw, (max-width: 1024px) 90vw, 520px'),
    };
  }
  return {
    src: buildVariant(400, 70),
    srcSet: `${buildVariant(360, 68)} 360w, ${buildVariant(420, 70)} 420w, ${buildVariant(600, 72)} 600w`,
    sizes: i18next.t('maxwidth768px92vwMaxwidth1024px45vw393px', '(max-width: 768px) 92vw, (max-width: 1024px) 45vw, 393px'),
  };
}

/** Contenido de una tarjeta de curso: se usa igual en la cuadrícula y en la lista. */
const CourseCardBody: React.FC<{ course: Course; totalVideos: number; onSelect: (course: Course) => void }> = ({ course, totalVideos, onSelect }) => {
  const { t } = useTranslation();
  return (
    <div className="flex min-w-0 flex-1 flex-col p-5 lg:p-6">
      <p className="text-sm text-ink-muted">
        {course.category ? t(`categories.${course.category}`, course.category) : t('categories.INGENIERÍA', 'Ingeniería')}
      </p>
      <h3 className="mt-1 text-lg font-semibold leading-snug text-ink">{course.title}</h3>

      <ExpandableDescription
        text={(course.description || t('catalog.defaultCardDescription', 'Consulta el temario y los recursos disponibles de este curso.')).replace(/\*\*/g, '')}
        className="text-sm leading-relaxed text-ink-soft"
        clampClassName="line-clamp-3"
        wrapperClassName="mt-2"
      />

      <p className="mt-auto pt-5 text-sm text-ink-muted">
        {t('catalog.modulesCount', { count: course.modules?.length || 0, defaultValue_one: '{{count}} módulo', defaultValue_other: '{{count}} módulos' })}
        {' · '}
        {t('catalog.lessonsCount', { count: totalVideos, defaultValue_one: '{{count}} lección', defaultValue_other: '{{count}} lecciones' })}
        {course.price > 0 && (
          <>
            {' · '}
            <span className="font-medium text-ink">{course.price} {course.currency || t('usd', 'USD')}</span>
          </>
        )}
      </p>

      <div className={`mt-4 grid gap-3 md:max-w-md ${course.published ? 'grid-cols-2' : 'grid-cols-1'}`}>
        <CourseShareButton course={course} variant="card" />
        <button
          type="button"
          onClick={(event) => { event.stopPropagation(); onSelect(course); }}
          className="flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-brand-cyan text-sm font-semibold text-on-brand transition-opacity hover:opacity-90"
        >
          <Play aria-hidden className="h-4 w-4 fill-current" />
          {t('catalog.enterCourseFull', 'Entrar al curso')}
        </button>
      </div>
    </div>
  );
};

export const ConstellationCourseCatalog: React.FC<ConstellationCourseCatalogProps> = ({
  courses,
  onSelectCourse,
  onPrefetchCourse,
  featuredOnly = false,
  onBrowseCatalog,
}) => {
  const { t } = useTranslation();
  const [activeCategory, setActiveCategory] = useState<string>('todos');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const PAGE_SIZE = 9;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  useEffect(() => setVisibleCount(PAGE_SIZE), [activeCategory, searchQuery]);

  useEffect(() => {
    const mobile = window.matchMedia('(max-width: 767px)');
    const resetMobileView = () => {
      if (mobile.matches) setViewMode('grid');
    };
    resetMobileView();
    mobile.addEventListener('change', resetMobileView);
    return () => mobile.removeEventListener('change', resetMobileView);
  }, []);

  // Filtra cursos dentro del estándar oficial de DocentOS (omite cursos de prueba con categorías obsoletas)
  const catalogCourses = useMemo(() => {
    const valid = courses.filter((c) => isStandardCategory(c.category));
    return valid.length > 0 ? valid : courses;
  }, [courses]);

  const searchResults = useMemo(() => searchCourseCatalog(catalogCourses, searchQuery, activeCategory), [catalogCourses, searchQuery, activeCategory]);
  const filteredCourses = searchResults.courses;

  const customLanding = useLandingConfig();
  const featuredCourse = (customLanding.featuredCourseId && catalogCourses.find((course) => course.id === customLanding.featuredCourseId)) || catalogCourses[0] || null;
  const showFeatured = Boolean(featuredCourse && activeCategory === 'todos' && searchQuery.trim() === '');
  const listedCourses = showFeatured
    ? filteredCourses.filter((course) => course.id !== featuredCourse?.id)
    : filteredCourses;
  const visibleCourses = listedCourses.slice(0, visibleCount);

  if (featuredOnly && !featuredCourse) return null;

  return (
    <section id={featuredOnly ? 'cursos' : undefined} className="academy-catalog relative w-full bg-transparent pt-4 pb-16 md:py-20 select-none">
      <div className="max-w-[1280px] mx-auto flex flex-col px-4 sm:px-6">
        
        {!featuredOnly && (<>
        {/* Cabecera del Catálogo */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 sm:gap-6 mb-6 sm:mb-8">
          <div>
            <h2 className="font-constellation-display text-[36px] sm:text-[48px] md:text-[56px] leading-[1.05] tracking-[-0.035em] text-slate-900 dark:text-white">
              {t('catalog.title', 'Encuentra tu próxima especialización')}
            </h2>
            <p className="font-constellation-body text-sm sm:text-base text-slate-600 dark:text-white/60 mt-2 max-w-2xl font-extralight">
              {t('catalog.subtitle', 'Explora los cursos y revisa su temario para elegir tu siguiente paso.')}
            </p>
          </div>

        </div>

        </>)}

        {/* Programa destacado: dos mitades iguales (texto y portada), con el brillo dorado que lo distingue del resto */}
        {featuredCourse && showFeatured && (
          <article
            aria-label={`${featuredCourse.title} - ${t('catalog.featuredProgram', 'Programa destacado')}`}
            onClick={() => onSelectCourse(featuredCourse)}
            className="catalog-featured-glow academy-course-card group relative order-1 mb-8 grid cursor-pointer grid-cols-1 overflow-hidden rounded-2xl border border-brand-cyan/35 bg-surface transition-colors hover:border-brand-cyan/70 sm:mb-12 lg:grid-cols-2"
          >
            <div className="flex items-center p-5 sm:p-8 lg:order-2">
              <img
                {...getResponsiveCoverProps(featuredCourse.coverImage || FALLBACK_COVERS[0], 'featured')}
                alt=""
                decoding="async"
                fetchPriority="high"
                className="aspect-video w-full rounded-xl object-cover ring-1 ring-brand-cyan/25"
              />
            </div>

            <div className="flex min-w-0 flex-col justify-center px-5 pb-6 sm:px-8 sm:pb-8 lg:order-1 lg:p-12">
              <span className="featured-badge inline-flex w-fit items-center gap-2 rounded-full bg-brand-cyan px-3 py-1.5 text-xs font-semibold text-on-brand">
                <Flame aria-hidden className="lp-streak-flame h-4 w-4 shrink-0" />
                {t('catalog.featuredProgram', 'Programa destacado')}
              </span>
              <p className="mt-4 text-sm text-ink-muted">
                {featuredCourse.category ? t(`categories.${featuredCourse.category}`, featuredCourse.category) : t('categories.INGENIERÍA', 'Ingeniería')}
              </p>
              <h3 className="mt-1 text-3xl font-semibold leading-tight text-ink lg:text-4xl">{featuredCourse.title}</h3>

              <ExpandableDescription
                text={featuredCourse.description ||
                  t('catalog.defaultDescription', 'Domina arquitectura avanzada, buenas prácticas y despliegues empresariales guiados por mentores técnicos.')}
                className="text-base leading-relaxed text-ink-soft"
                clampClassName="line-clamp-3"
                wrapperClassName="mt-4 max-w-xl"
              />

              <p className="mt-6 text-sm text-ink-muted">
                {t('catalog.modulesCount', { count: featuredCourse.modules?.length || 0, defaultValue_one: '{{count}} módulo', defaultValue_other: '{{count}} módulos' })}
                {' · '}
                {t('catalog.lessonsCount', {
                  count: (featuredCourse.modules || []).reduce((acc, m) => acc + (m.videos || []).length, 0),
                  defaultValue_one: '{{count}} lección',
                  defaultValue_other: '{{count}} lecciones',
                })}
                {featuredCourse.price > 0 && (
                  <>
                    {' · '}
                    <span className="font-medium text-ink">{featuredCourse.price} {featuredCourse.currency || t('usd', 'USD')}</span>
                  </>
                )}
              </p>

              <div className={`mt-5 grid max-w-md gap-3 ${featuredCourse.published ? 'grid-cols-2' : 'grid-cols-1'}`}>
                <CourseShareButton course={featuredCourse} variant="card" />
                <button
                  type="button"
                  onClick={(event) => { event.stopPropagation(); onSelectCourse(featuredCourse); }}
                  className="flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-brand-cyan text-sm font-semibold text-on-brand transition-opacity hover:opacity-90"
                >
                  <Play aria-hidden className="h-4 w-4 fill-current" />
                  {t('catalog.enterCourseFull', 'Entrar al curso')}
                </button>
              </div>
            </div>
          </article>
        )}

        {featuredOnly && onBrowseCatalog && (
          <div className="order-2 flex justify-start">
            <button type="button" className="academy-text-button" onClick={onBrowseCatalog}>
              {t('catalog.fullCatalog', 'Ver catálogo completo')} <ArrowRight size={18} aria-hidden="true" />
            </button>
          </div>
        )}
        {!featuredOnly && (<>
        {/* Una sola barra: categoría, buscador, conteo y tipo de vista */}
        <div className="order-2 mb-6 flex flex-col gap-3 border-b border-line pb-5 sm:mb-8 md:flex-row md:items-center">
          <CourseCategoryFilter
            id="catalog-category-filter"
            courses={catalogCourses}
            value={activeCategory}
            onChange={setActiveCategory}
          />

          <div className="flex min-w-0 items-center gap-2 md:flex-1">
            <SearchField className="min-w-0 flex-1" value={searchQuery} onChange={setSearchQuery}
              label={t('catalog.searchLabel', 'Buscar cursos y lecciones')} placeholder={t('catalog.searchPlaceholder', 'Buscar cursos o lecciones...')} />

            {(activeCategory !== 'todos' || searchQuery.trim()) && (
              <button
                type="button"
                onClick={() => {
                  setActiveCategory('todos');
                  setSearchQuery('');
                }}
                className="inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-1.5 px-2 text-sm text-ink-soft underline-offset-4 transition-colors hover:text-ink hover:underline"
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{t('catalog.reset', 'Restablecer')}</span>
              </button>
            )}
          </div>

          {listedCourses.length > 0 && (
            <div className="flex shrink-0 items-center justify-between gap-4">
            <p className="whitespace-nowrap text-sm text-ink-soft">
            {showFeatured ? `${t('catalog.moreCourses', 'Más cursos')} · ${listedCourses.length}` : t('catalog.courseCount', { count: listedCourses.length, defaultValue_one: '{{count}} curso', defaultValue_other: '{{count}} cursos' })}
            </p>

            <div role="group" aria-label={t('catalog.viewMode', 'Vista de los cursos')} className="hidden md:flex items-center gap-1 p-1 bg-surface border border-line rounded-xl shrink-0 self-start lg:self-auto">
            <button
              onClick={() => setViewMode('grid')}
              className={`flex h-11 w-11 items-center justify-center rounded-lg transition-[color,background-color,box-shadow] cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-surface text-ink shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:text-white/40 dark:hover:text-white'
              }`}
              title={t('catalog.gridView', 'Vista de Cuadrícula')}
              aria-label={t('catalog.gridView', 'Vista de Cuadrícula')}
              aria-pressed={viewMode === 'grid'}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`flex h-11 w-11 items-center justify-center rounded-lg transition-[color,background-color,box-shadow] cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-surface text-ink shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:text-white/40 dark:hover:text-white'
              }`}
              title={t('catalog.listView', 'Vista Expandida')}
              aria-label={t('catalog.listView', 'Vista Expandida')}
              aria-pressed={viewMode === 'list'}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
            </div>
          )}
        </div>

        {searchResults.lessons.length > 0 && (
          <section className="academy-catalog-lessons order-3" aria-label={t('catalog.lessonsFound', 'Lecciones encontradas')}>
            <h3>{t('catalog.lessonsFound', 'Lecciones encontradas')} <span>({searchResults.lessons.length})</span></h3>
            <ul>
              {searchResults.lessons.slice(0, 6).map(({ course, module, video }) => (
                <li key={`${course.id}-${video.id}`}>
                  <button type="button" onClick={() => onSelectCourse(course)}>
                    <div><strong>{video.title}</strong><span>{course.title} · {module.title}</span></div>
                    <span className="shrink-0 text-sm text-brand-cyan">{t('catalog.viewCourse', 'Ver curso')} <ArrowRight size={16} aria-hidden="true" /></span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}


        {/* Cuadrícula Visual de Cursos (Visual Grid) */}
        {filteredCourses.length === 0 ? (
          <div className="order-3 py-20 text-center">
            <Sparkles className="w-8 h-8 text-[var(--color-brand-cyan)] mx-auto mb-3 opacity-60" />
            <p className="font-constellation-display text-lg text-slate-900 dark:text-white">
              {t('catalog.noCoursesTitle', 'No se encontraron cursos en esta categoría')}
            </p>
            <p className="font-constellation-body text-xs text-slate-500 dark:text-white/40 mt-1">
              {t('catalog.noCoursesDesc', 'Prueba cambiando los filtros o borrando el término de búsqueda.')}
            </p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="academy-course-grid order-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {visibleCourses.map((course, idx) => {
                const totalVideos = (course.modules || []).reduce(
                  (acc, m) => acc + (m.videos || []).length,
                  0
                );
                const cover =
                  course.coverImage ||
                  FALLBACK_COVERS[idx % FALLBACK_COVERS.length];

                return (
                  <article
                    key={course.id}
                    onMouseEnter={() => onPrefetchCourse?.(course.id)}
                    onClick={() => onSelectCourse(course)}
                    className="academy-course-card group flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-line bg-surface transition-colors hover:border-line-strong"
                  >
                    <div className="aspect-video w-full overflow-hidden bg-raised">
                      <img
                        {...getResponsiveCoverProps(cover, 'card')}
                        alt=""
                        className="h-full w-full object-cover"
                        loading="lazy"
                        decoding="async"
                      />
                    </div>
                    <CourseCardBody course={course} totalVideos={totalVideos} onSelect={onSelectCourse} />
                  </article>
                );
              })}
          </div>
        ) : (
          /* Vista de Lista Cinemática Expandida */
          <div className="order-3 space-y-6">
            {visibleCourses.map((course, idx) => {
              const totalVideos = (course.modules || []).reduce(
                (acc, m) => acc + (m.videos || []).length,
                0
              );
              const cover =
                course.coverImage ||
                FALLBACK_COVERS[idx % FALLBACK_COVERS.length];

              return (
                <article
                  key={course.id}
                  onMouseEnter={() => onPrefetchCourse?.(course.id)}
                  onClick={() => onSelectCourse(course)}
                  className="academy-course-card group grid cursor-pointer grid-cols-1 overflow-hidden rounded-2xl border border-line bg-surface transition-colors hover:border-line-strong md:grid-cols-12"
                >
                  <div className="aspect-video self-center overflow-hidden bg-raised md:col-span-4">
                    <img
                      {...getResponsiveCoverProps(cover, 'card')}
                      alt=""
                      className="h-full w-full object-cover"
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                  <div className="flex min-w-0 md:col-span-8">
                    <CourseCardBody course={course} totalVideos={totalVideos} onSelect={onSelectCourse} />
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {listedCourses.length > visibleCount && (
          <div className="order-4 mt-8 flex flex-col items-center gap-3">
            <p className="text-sm text-ink-muted">
              {t('catalog.showing', 'Mostrando {{shown}} de {{total}} cursos', { shown: visibleCourses.length, total: listedCourses.length })}
            </p>
            <button
              type="button"
              onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
              className="flex min-h-11 w-full max-w-xs cursor-pointer items-center justify-center rounded-lg border border-line px-6 text-sm font-medium text-ink transition-colors hover:bg-ink/5"
            >
              {t('catalog.showMore', 'Mostrar más cursos')}
            </button>
          </div>
        )}
        </>)}

      </div>
    </section>
  );
};
