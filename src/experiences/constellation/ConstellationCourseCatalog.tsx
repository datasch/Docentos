import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Course } from '../../types';
import { searchCourseCatalog } from '../../lib/catalogSearch';
import { SearchField } from '../../components/SearchField';
import { CourseShareButton } from '../../components/CourseShareButton';
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
      sizes: '(max-width: 640px) 92vw, (max-width: 1024px) 90vw, 520px',
    };
  }
  return {
    src: buildVariant(400, 70),
    srcSet: `${buildVariant(360, 68)} 360w, ${buildVariant(420, 70)} 420w, ${buildVariant(600, 72)} 600w`,
    sizes: '(max-width: 768px) 92vw, (max-width: 1024px) 45vw, 393px',
  };
}

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

  const featuredCourse = catalogCourses[0] || null;
  const showFeatured = Boolean(featuredCourse && activeCategory === 'todos' && searchQuery.trim() === '');
  const listedCourses = showFeatured
    ? filteredCourses.filter((course) => course.id !== featuredCourse?.id)
    : filteredCourses;

  if (featuredOnly && !featuredCourse) return null;

  return (
    <section className="academy-catalog relative w-full bg-transparent pt-4 pb-16 md:py-20 select-none">
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

        {/* Banner Destacado Spotlight (Si hay cursos) */}
        {featuredCourse && showFeatured && (
          <div
            tabIndex={0}
            role="button"
            aria-label={`${featuredCourse.title} - ${t('catalog.featuredProgram', 'Programa destacado')}`}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelectCourse(featuredCourse);
              }
            }}
            className="catalog-featured-glow order-1 mb-8 sm:mb-12 relative rounded-[28px] overflow-hidden transition-all duration-300 group cursor-pointer bg-gradient-to-br from-amber-50/50 via-white to-white dark:from-amber-950/15 dark:via-[#0b0b12] dark:to-[#08080f] focus-visible:outline-2 focus-visible:outline-amber-400 focus-visible:outline-offset-2"
            onClick={() => onSelectCourse(featuredCourse)}
          >
            <div className="flex items-center justify-between gap-2 border-b border-amber-500/15 bg-amber-500/5 px-4 py-3 sm:px-8">
              <span className="inline-flex min-w-0 items-center gap-2 rounded-full bg-amber-400 px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-950">
                <Flame aria-hidden className="lp-streak-flame h-4 w-4 shrink-0 text-orange-800 fill-orange-600/25" />
                {t('catalog.featuredProgram', 'Programa destacado')}
              </span>
              <CourseShareButton course={featuredCourse} variant="featured" iconOnly />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-12 items-center">
              
              {/* Cover Panorámico Destacado: Arriba en móvil con aspect-video natural (sin recortes), a la derecha en escritorio */}
              <div className="order-1 lg:order-2 lg:col-span-5 w-full aspect-video lg:aspect-auto lg:h-full relative overflow-hidden bg-slate-900">
                <img
                  {...getResponsiveCoverProps(featuredCourse.coverImage || FALLBACK_COVERS[0], 'featured')}
                  alt={featuredCourse.title}
                  decoding="async"
                  fetchPriority="high"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                />
                <div className="absolute inset-0 bg-gradient-to-t lg:bg-gradient-to-r from-white/80 via-transparent to-transparent dark:from-[#0a0a14] dark:via-transparent dark:to-transparent opacity-80" />
                
                {/* Floating Play Icon */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-amber-400/90 border border-amber-200/70 flex items-center justify-center text-slate-950 shadow-xl group-hover:scale-110 transition-transform">
                    <Play className="w-5 h-5 sm:w-6 sm:h-6 fill-current ml-0.5" />
                  </div>
                </div>
              </div>

              {/* Información Destacada: Abajo de la imagen en móvil, a la izquierda en escritorio */}
              <div className="order-2 lg:order-1 lg:col-span-7 p-5 sm:p-8 lg:p-12 flex flex-col items-start justify-between z-10">
                <div>
                  <div className="mb-3 sm:mb-4">
                    <span className="text-amber-700 dark:text-amber-300 text-[11px] sm:text-xs font-mono font-semibold uppercase">
                      {featuredCourse.category ? t(`categories.${featuredCourse.category}`, featuredCourse.category) : t('categories.INGENIERÍA', 'Ingeniería')}
                    </span>
                  </div>

                  <h3 className="font-constellation-display text-2xl sm:text-3xl lg:text-4xl font-semibold text-slate-900 dark:text-white group-hover:text-amber-700 dark:group-hover:text-amber-200 transition-colors leading-snug sm:leading-tight mb-3 sm:mb-4">
                    {featuredCourse.title}
                  </h3>

                  <p className="font-constellation-body text-sm lg:text-base text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-2 sm:line-clamp-3 mb-5 sm:mb-6 font-extralight max-w-xl">
                    {featuredCourse.description ||
                      t('catalog.defaultDescription', 'Domina arquitectura avanzada, buenas prácticas y despliegues empresariales guiados por mentores técnicos.')}
                  </p>
                </div>

                <div className="flex flex-wrap xl:flex-nowrap items-center justify-between gap-4 w-full pt-4 border-t border-amber-600/15 dark:border-amber-400/15">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-mono text-slate-600 dark:text-slate-300">
                    <span className="flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-amber-600 dark:text-amber-300" />
                      <span>{featuredCourse.modules?.length || 0} {t('catalog.modules', 'módulos')}</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <PlayCircle className="w-4 h-4 text-orange-600 dark:text-orange-300" />
                      <span>
                        {(featuredCourse.modules || []).reduce(
                          (acc, m) => acc + (m.videos || []).length,
                          0
                        )}{' '}
                        {t('catalog.lessons', 'lecciones')}
                      </span>
                    </span>
                  </div>

                  <button className="inline-flex min-h-12 w-full sm:w-auto items-center justify-center gap-2 rounded-full bg-amber-400 px-6 py-3 text-sm font-semibold text-slate-950 shadow-sm shadow-amber-500/20 transition-colors hover:bg-amber-300 cursor-pointer">
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>{t('catalog.startNow', 'Iniciar Ahora')}</span>
                  </button>
                </div>
              </div>

            </div>
          </div>
        )}

        {featuredOnly && onBrowseCatalog && (
          <div className="order-2 flex justify-start">
            <button type="button" className="academy-text-button" onClick={onBrowseCatalog}>
              {t('catalog.fullCatalog', 'Ver catálogo completo')} <ArrowRight size={18} aria-hidden="true" />
            </button>
          </div>
        )}
        {!featuredOnly && (<>
        {/* Barra de Filtros por Categoría y Búsqueda */}
        <div className="order-2 flex flex-col md:flex-row items-stretch md:items-start justify-between gap-3 mb-6 sm:mb-8 pb-5 border-b border-slate-200 dark:border-white/[0.06]">
          <CourseCategoryFilter
            id="catalog-category-filter"
            className="order-2 md:order-1"
            courses={catalogCourses}
            value={activeCategory}
            onChange={setActiveCategory}
          />

          {/* Input de Búsqueda Rápida y Botón Restablecer */}
          <div className="order-1 flex min-w-0 items-center gap-2.5 md:order-2 md:w-64 md:shrink-0">
            <SearchField className="min-w-0 flex-1" value={searchQuery} onChange={setSearchQuery}
              label={t('catalog.searchLabel', 'Buscar cursos y lecciones')} placeholder={t('catalog.searchPlaceholder', 'Buscar cursos o lecciones...')} />

            {(activeCategory !== 'todos' || searchQuery.trim()) && (
              <button
                type="button"
                onClick={() => {
                  setActiveCategory('todos');
                  setSearchQuery('');
                }}
                className="shrink-0 inline-flex items-center gap-1 text-xs font-constellation-label text-[#06b6d4] hover:underline min-h-11 px-2 py-1 cursor-pointer transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                <span>{t('catalog.reset', 'Restablecer')}</span>
              </button>
            )}
          </div>
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

        {listedCourses.length > 0 && (
          <div className="order-3 mb-4 flex items-center justify-between gap-4">
            <p className="text-sm text-ink-soft">
              {listedCourses.length === 1
                ? t('catalog.courseCount_one', '1 curso')
                : t('catalog.courseCount_other', { count: listedCourses.length, defaultValue: `${listedCourses.length} cursos` })}
            </p>
            <div role="group" aria-label={t('catalog.viewMode', 'Vista de los cursos')} className="hidden md:flex items-center gap-1 p-1 bg-slate-100 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 rounded-full shrink-0 self-start lg:self-auto">
              <button
                onClick={() => setViewMode('grid')}
                className={`flex h-11 w-11 items-center justify-center rounded-full transition-all cursor-pointer ${
                  viewMode === 'grid'
                    ? 'bg-surface text-ink shadow-sm'
                    : 'text-slate-500 hover:text-slate-900 dark:text-white/40 dark:hover:text-white'
                }`}
                title={t('catalog.gridView', 'Vista de Cuadrícula')}
                aria-label={t('catalog.gridView', 'Vista de cuadrícula')}
                aria-pressed={viewMode === 'grid'}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`flex h-11 w-11 items-center justify-center rounded-full transition-all cursor-pointer ${
                  viewMode === 'list'
                    ? 'bg-surface text-ink shadow-sm'
                    : 'text-slate-500 hover:text-slate-900 dark:text-white/40 dark:hover:text-white'
                }`}
                title={t('catalog.listView', 'Vista Expandida')}
                aria-label={t('catalog.listView', 'Vista de lista')}
                aria-pressed={viewMode === 'list'}
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Cuadrícula Visual de Cursos (Visual Grid) */}
        {filteredCourses.length === 0 ? (
          <div className="order-3 py-20 text-center">
            <Sparkles className="w-8 h-8 text-[#06b6d4] mx-auto mb-3 opacity-60" />
            <p className="font-constellation-display text-lg text-slate-900 dark:text-white">
              {t('catalog.noCoursesTitle', 'No se encontraron cursos en esta categoría')}
            </p>
            <p className="font-constellation-body text-xs text-slate-500 dark:text-white/40 mt-1">
              {t('catalog.noCoursesDesc', 'Prueba cambiando los filtros o borrando el término de búsqueda.')}
            </p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="academy-course-grid order-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {listedCourses.map((course, idx) => {
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
                    tabIndex={0}
                    role="button"
                    aria-label={course.title}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onSelectCourse(course);
                      }
                    }}
                    onMouseEnter={() => onPrefetchCourse?.(course.id)}
                    onClick={() => onSelectCourse(course)}
                    className="academy-course-card flex flex-col rounded-[24px] bg-white dark:bg-white/[0.02] hover:bg-slate-50/80 dark:hover:bg-white/[0.05] hover:-translate-y-1 border border-slate-200/80 dark:border-white/[0.07] hover:border-[#06b6d4]/40 overflow-hidden transition-all duration-300 group cursor-pointer shadow-sm hover:shadow-md dark:shadow-lg focus-visible:outline-2 focus-visible:outline-[#06b6d4] focus-visible:outline-offset-2 [content-visibility:auto]"
                  >
                    {/* Contenedor Visual de la Portada / Imagen */}
                    <div className="relative aspect-video w-full overflow-hidden bg-slate-950">
                      <img
                        {...getResponsiveCoverProps(cover, 'card')}
                        alt={course.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
                        loading="lazy"
                        decoding="async"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-transparent to-transparent dark:from-[#050505] dark:via-[#050505]/30" />

                      {/* Badges de Categoría y Precio (Optimizados sin backdrop-blur para scroll a 60+ FPS) */}
                      <div className="absolute top-3 inset-x-3 flex items-center justify-between gap-2 z-10">
                        <span className="min-w-0 truncate px-2.5 py-1 rounded-full text-[10px] font-mono uppercase tracking-wider font-semibold bg-black/80 border border-white/10 text-[#06b6d4]">
                          {course.category ? t(`categories.${course.category}`, course.category) : t('categories.INGENIERÍA', 'Ingeniería')}
                        </span>

                        <div className="flex shrink-0 items-center gap-2">
                          {course.price > 0 && (
                            <span className="catalog-course-badge">
                              <span className="catalog-price-amount">{course.price}</span>
                              <span className="catalog-price-currency">{course.currency || 'USD'}</span>
                            </span>
                          )}
                          <CourseShareButton course={course} variant="overlay" iconOnly />
                        </div>
                      </div>

                      {/* Botón Flotante Play al hacer Hover */}
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <div className="w-12 h-12 rounded-full bg-[#06b6d4]/30 border border-[#06b6d4]/60 flex items-center justify-center text-[#06b6d4] shadow-xl group-hover:scale-110 transition-transform">
                          <Play className="w-5 h-5 fill-[#06b6d4] ml-0.5" />
                        </div>
                      </div>
                    </div>

                    {/* Cuerpo de la Tarjeta con Tipografía Jerárquica */}
                    <div className="min-w-0 p-5 sm:p-6 flex flex-col flex-1 justify-between">
                      <div>
                        <h3 className="font-constellation-display text-lg text-slate-900 dark:text-white group-hover:text-cyan-600 dark:group-hover:text-cyan-200 transition-colors line-clamp-2 leading-snug mb-2">
                          {course.title}
                        </h3>

                        <p className="font-constellation-body text-xs text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed font-extralight mb-4">
                          {course.description ||
                            t('catalog.defaultCardDescription', 'Consulta el temario y los recursos disponibles de este curso.')}
                        </p>
                      </div>

                      {/* Metadatos Inferiores y Botón de Entrada */}
                      <div className="academy-course-meta pt-4 border-t border-slate-100 dark:border-white/[0.04] flex flex-wrap items-center justify-between gap-3 text-xs font-mono text-slate-600 dark:text-slate-300">
                        <div className="flex items-center gap-3">
                          <span className="flex items-center gap-1">
                            <Layers className="w-3.5 h-3.5 text-[#06b6d4]" />
                            <span>{course.modules?.length || 0} {t('catalog.modShort', 'mod')}</span>
                          </span>
                          <span className="flex items-center gap-1">
                            <PlayCircle className="w-3.5 h-3.5 text-[#a855f7]" />
                            <span>{totalVideos} {t('catalog.lecShort', 'lec')}</span>
                          </span>
                        </div>

                        <span className="text-[#06b6d4] font-semibold flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                          <span>{t('catalog.enterCourse', 'Entrar')}</span>
                          <ArrowRight className="w-3 h-3" />
                        </span>
                      </div>
                    </div>
                  </article>
                );
              })}
          </div>
        ) : (
          /* Vista de Lista Cinemática Expandida */
          <div className="order-3 space-y-6">
            {listedCourses.map((course, idx) => {
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
                  tabIndex={0}
                  role="button"
                  aria-label={course.title}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelectCourse(course);
                    }
                  }}
                  onMouseEnter={() => onPrefetchCourse?.(course.id)}
                  onClick={() => onSelectCourse(course)}
                  className="academy-course-card grid grid-cols-1 md:grid-cols-12 rounded-[24px] bg-white dark:bg-white/[0.02] hover:bg-slate-50/80 dark:hover:bg-white/[0.05] hover:-translate-y-1 border border-slate-200/80 dark:border-white/[0.07] hover:border-[#06b6d4]/40 overflow-hidden transition-all duration-300 group cursor-pointer shadow-sm hover:shadow-md dark:shadow-none focus-visible:outline-2 focus-visible:outline-[#06b6d4] focus-visible:outline-offset-2 [content-visibility:auto]"
                >
                  <div className="md:col-span-4 aspect-video relative overflow-hidden bg-slate-950">
                    <img
                      {...getResponsiveCoverProps(cover, 'card')}
                      alt={course.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
                      loading="lazy"
                      decoding="async"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t md:bg-gradient-to-r from-black/60 via-transparent to-transparent" />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="w-10 h-10 rounded-full bg-[#06b6d4]/30 border border-[#06b6d4]/60 flex items-center justify-center text-[#06b6d4]">
                        <Play className="w-4 h-4 fill-[#06b6d4] ml-0.5" />
                      </div>
                    </div>
                  </div>

                  <div className="min-w-0 md:col-span-8 p-5 lg:p-6 flex flex-col justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-2 text-xs font-mono">
                        <span className="text-[#06b6d4] uppercase font-semibold">
                          {course.category ? t(`categories.${course.category}`, course.category) : t('categories.INGENIERÍA', 'Ingeniería')}
                        </span>
                        <span className="text-slate-500 dark:text-slate-400">·</span>
                        <span className="text-slate-600 dark:text-slate-300">
                          {t('catalog.modulesLecCount', { modules: course.modules?.length || 0, videos: totalVideos, defaultValue: `${course.modules?.length || 0} módulos / ${totalVideos} lecciones` })}
                        </span>
                      </div>

                      <h3 className="font-constellation-display text-xl text-slate-900 dark:text-white group-hover:text-cyan-600 dark:group-hover:text-cyan-200 transition-colors mb-2">
                        {course.title}
                      </h3>

                      <p className="font-constellation-body text-xs sm:text-sm text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed font-extralight">
                        {course.description ||
                          t('catalog.defaultCardDescription', 'Consulta el temario y los recursos disponibles de este curso.')}
                      </p>
                    </div>

                    <div className="pt-4 mt-4 border-t border-slate-100 dark:border-white/[0.04] flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        {course.price > 0 && (
                          <span className="catalog-course-badge">
                            <span className="catalog-price-amount">{course.price}</span>
                            <span className="catalog-price-currency">{course.currency || 'USD'}</span>
                          </span>
                        )}
                        <CourseShareButton course={course} iconOnly />
                      </div>
                      <button className="academy-button min-h-11 text-xs">
                        <BookOpen className="w-3.5 h-3.5" />
                        <span>{t('catalog.viewSyllabus', 'Ver Temario')}</span>
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
        </>)}

      </div>
    </section>
  );
};
