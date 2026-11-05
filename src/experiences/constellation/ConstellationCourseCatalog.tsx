import React, { useEffect, useRef, useState } from 'react';
import { Course } from '../../types';
import { CourseShareButton } from '../../components/CourseShareButton';
import {
  Play,
  Layers,
  PlayCircle,
  Search,
  Sparkles,
  ArrowRight,
  BookOpen,
  LayoutGrid,
  List,
  Flame,
  ChevronDown,
} from 'lucide-react';

interface ConstellationCourseCatalogProps {
  courses: Course[];
  onSelectCourse: (course: Course) => void;
  onPrefetchCourse?: (courseId: string) => void;
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
}) => {
  const [activeCategory, setActiveCategory] = useState<string>('todos');
  const categoryDetailsRef = useRef<HTMLDetailsElement>(null);
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

  const categories = ['todos', ...Array.from(new Set(courses.map((c) => c.category || 'General').filter(Boolean)))];

  const filteredCourses = courses.filter((c) => {
    const matchCategory =
      activeCategory === 'todos' ||
      (c.category || 'General').toLowerCase() === activeCategory.toLowerCase();
    const matchSearch =
      searchQuery.trim() === '' ||
      c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.description || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchCategory && matchSearch;
  });

  const featuredCourse = courses[0] || null;
  const showFeatured = Boolean(featuredCourse && activeCategory === 'todos' && searchQuery.trim() === '');
  const listedCourses = showFeatured
    ? filteredCourses.filter((course) => course.id !== featuredCourse?.id)
    : filteredCourses;

  return (
    <section className="relative w-full bg-transparent pt-4 pb-16 md:py-20 select-none">
      <div className="max-w-[1280px] mx-auto flex flex-col px-4 sm:px-6">
        
        {/* Cabecera del Catálogo */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 sm:gap-6 mb-6 sm:mb-8">
          <div>
            <div className="inline-flex items-center gap-2 text-[10px] sm:text-xs font-mono font-medium text-[#eab308] tracking-wider uppercase mb-2">
              <span className="w-1.5 h-1.5 shrink-0 rounded-full bg-[#eab308] shadow-sm shadow-amber-400/50" />
              <span>Programas Académicos & Masterclasses</span>
            </div>
            <h2 className="font-constellation-display text-[36px] sm:text-[48px] md:text-[56px] leading-[1.05] tracking-[-0.035em] text-slate-900 dark:text-white">
              Catálogo de Especialización
            </h2>
            <p className="font-constellation-body text-sm sm:text-base text-slate-600 dark:text-white/60 mt-2 max-w-2xl font-extralight">
              Rutas pedagógicas estructuradas en módulos prácticos con streaming de alta definición e inteligencia artificial.
            </p>
          </div>

          {/* Selector de Modo de Visualización */}
          <div className="hidden md:flex items-center gap-1 p-1 bg-slate-100 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 rounded-full shrink-0 self-start lg:self-auto">
            <button
              onClick={() => setViewMode('grid')}
              className={`flex h-11 w-11 items-center justify-center rounded-full transition-all cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-[#06b6d4] text-[#050505] shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:text-white/40 dark:hover:text-white'
              }`}
              title="Vista de Cuadrícula"
              aria-label="Vista de cuadrícula"
              aria-pressed={viewMode === 'grid'}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`flex h-11 w-11 items-center justify-center rounded-full transition-all cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-[#06b6d4] text-[#050505] shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:text-white/40 dark:hover:text-white'
              }`}
              title="Vista Expandida"
              aria-label="Vista de lista"
              aria-pressed={viewMode === 'list'}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Banner Destacado Spotlight (Si hay cursos) */}
        {featuredCourse && showFeatured && (
          <div
            className="catalog-featured-glow order-1 mb-8 sm:mb-12 relative rounded-[28px] overflow-hidden transition-all duration-300 group cursor-pointer bg-gradient-to-br from-amber-50/50 via-white to-white dark:from-amber-950/15 dark:via-[#0b0b12] dark:to-[#08080f]"
            onClick={() => onSelectCourse(featuredCourse)}
          >
            <div className="flex items-center justify-between gap-2 border-b border-amber-500/15 bg-amber-500/5 px-4 py-3 sm:px-8">
              <span className="inline-flex min-w-0 items-center gap-2 rounded-full bg-amber-400 px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-950">
                <Flame aria-hidden className="lp-streak-flame h-4 w-4 shrink-0 text-orange-800 fill-orange-600/25" />
                Programa destacado
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
                      {featuredCourse.category || 'INGENIERÍA'}
                    </span>
                  </div>

                  <h3 className="font-constellation-display text-2xl sm:text-3xl lg:text-4xl font-semibold text-slate-900 dark:text-white group-hover:text-amber-700 dark:group-hover:text-amber-200 transition-colors leading-snug sm:leading-tight mb-3 sm:mb-4">
                    {featuredCourse.title}
                  </h3>

                  <p className="font-constellation-body text-sm lg:text-base text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-2 sm:line-clamp-3 mb-5 sm:mb-6 font-extralight max-w-xl">
                    {featuredCourse.description ||
                      'Domina arquitectura avanzada, buenas prácticas y despliegues empresariales guiados por mentores técnicos.'}
                  </p>
                </div>

                <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-4 w-full pt-4 border-t border-amber-600/15 dark:border-amber-400/15">
                  <div className="flex items-center gap-4 text-xs font-mono text-slate-600 dark:text-slate-300">
                    <span className="flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-amber-600 dark:text-amber-300" />
                      <span>{featuredCourse.modules?.length || 0} módulos</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <PlayCircle className="w-4 h-4 text-orange-600 dark:text-orange-300" />
                      <span>
                        {(featuredCourse.modules || []).reduce(
                          (acc, m) => acc + (m.videos || []).length,
                          0
                        )}{' '}
                        lecciones
                      </span>
                    </span>
                  </div>

                  <button className="inline-flex min-h-12 w-full sm:w-auto items-center justify-center gap-2 rounded-full bg-amber-400 px-6 py-3 text-sm font-semibold text-slate-950 shadow-sm shadow-amber-500/20 transition-colors hover:bg-amber-300 cursor-pointer">
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Iniciar Ahora</span>
                  </button>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* Barra de Filtros por Categoría y Búsqueda */}
        <div className="order-2 flex flex-col lg:flex-row items-stretch lg:items-start justify-between gap-4 mb-6 sm:mb-8 pb-5 border-b border-slate-200 dark:border-white/[0.06]">
          {/* Píldoras de Categoría */}
          <div className="order-2 lg:order-1 min-w-0 lg:flex-1">
            <details ref={categoryDetailsRef} className="group/category min-w-0 rounded-xl sm:rounded-full sm:open:rounded-3xl border border-slate-200 bg-white text-slate-900 shadow-sm transition-colors dark:border-white/10 dark:bg-white/[0.03] dark:text-white dark:shadow-none has-[:focus-visible]:border-[#06b6d4] lg:hidden">
              <summary className="flex min-h-[46px] cursor-pointer list-none items-center justify-between gap-3 rounded-xl sm:rounded-full px-4 py-3 font-constellation-body text-base sm:text-sm focus-visible:outline-none [&::-webkit-details-marker]:hidden">
                <span className="min-w-0 truncate">{activeCategory === 'todos' ? 'Todas las categorías' : activeCategory}</span>
                <ChevronDown aria-hidden className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-open/category:rotate-180 dark:text-white/40" />
              </summary>
              <div role="group" aria-label="Filtrar por categoría" className="max-h-[40dvh] overflow-x-hidden overflow-y-auto overscroll-contain px-2 pb-2">
                {categories.filter((cat) => cat !== activeCategory).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => {
                      setActiveCategory(cat);
                      if (categoryDetailsRef.current) {
                        categoryDetailsRef.current.open = false;
                        categoryDetailsRef.current.querySelector('summary')?.focus();
                      }
                    }}
                    className="flex min-h-11 w-full items-center justify-between gap-3 rounded-md px-2 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/5"
                  >
                    <span className="min-w-0 break-words">{cat === 'todos' ? 'Todas las categorías' : cat}</span>
                    <span className="shrink-0 text-xs tabular-nums text-slate-500 dark:text-slate-400">{cat === 'todos' ? courses.length : courses.filter((course) => (course.category || 'General').toLowerCase() === cat.toLowerCase()).length}</span>
                  </button>
                ))}
              </div>
            </details>
            <div role="group" aria-label="Filtrar por categoría" className="hidden min-w-0 flex-wrap items-center gap-2 lg:flex">
              {categories.map((cat) => {
                const count =
                  cat === 'todos'
                    ? courses.length
                    : courses.filter(
                        (c) => (c.category || 'General').toLowerCase() === cat.toLowerCase()
                      ).length;

                return (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    aria-pressed={activeCategory === cat}
                    className={`min-h-11 max-w-full font-constellation-label text-xs tracking-wide px-3 py-2 rounded-full transition-all cursor-pointer flex items-center justify-center gap-2 ${
                      activeCategory === cat
                        ? 'bg-[#06b6d4] text-[#050505] font-bold shadow-[0_0_15px_rgba(6,182,212,0.35)]'
                        : 'bg-slate-100 hover:bg-slate-200/80 text-slate-600 hover:text-slate-900 border border-slate-200/60 dark:bg-white/[0.03] dark:text-white/50 dark:hover:text-white dark:hover:bg-white/[0.07] dark:border-white/[0.05]'
                    }`}
                  >
                    <span className="min-w-0 break-words text-left">{cat === 'todos' ? 'Todos' : cat}</span>
                    <span
                      className={`shrink-0 text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                        activeCategory === cat
                          ? 'bg-black/20 text-[#050505]'
                          : 'bg-slate-200/70 text-slate-600 dark:bg-white/10 dark:text-white/60'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Input de Búsqueda Rápida */}
          <div className="order-1 lg:order-2 relative w-full min-w-0 lg:w-64 lg:shrink-0">
            <Search className="w-4 h-4 text-slate-400 dark:text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              aria-label="Buscar cursos"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar cursos..."
              className="min-h-12 w-full bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 focus:border-[#06b6d4] focus:outline-none rounded-xl sm:rounded-full pl-10 pr-4 py-3 text-base sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-white/30 font-constellation-body transition-colors shadow-sm dark:shadow-none"
            />
          </div>
        </div>

        {/* Cuadrícula Visual de Cursos (Visual Grid) */}
        {filteredCourses.length === 0 ? (
          <div className="order-3 py-20 text-center">
            <Sparkles className="w-8 h-8 text-[#06b6d4] mx-auto mb-3 opacity-60" />
            <p className="font-constellation-display text-lg text-slate-900 dark:text-white">
              No se encontraron cursos en esta categoría
            </p>
            <p className="font-constellation-body text-xs text-slate-500 dark:text-white/40 mt-1">
              Prueba cambiando los filtros o borrando el término de búsqueda.
            </p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="order-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
                    onMouseEnter={() => onPrefetchCourse?.(course.id)}
                    onClick={() => onSelectCourse(course)}
                    className="flex flex-col rounded-[24px] bg-white dark:bg-white/[0.02] hover:bg-slate-50/80 dark:hover:bg-white/[0.05] hover:-translate-y-1 border border-slate-200/80 dark:border-white/[0.07] hover:border-[#06b6d4]/40 overflow-hidden transition-all duration-300 group cursor-pointer shadow-sm hover:shadow-md dark:shadow-lg [content-visibility:auto]"
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
                          {course.category || 'INGENIERÍA'}
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
                            'Aprende técnicas aplicadas, arquitectura y dominio técnico con evaluación continua.'}
                        </p>
                      </div>

                      {/* Metadatos Inferiores y Botón de Entrada */}
                      <div className="pt-4 border-t border-slate-100 dark:border-white/[0.04] flex items-center justify-between text-xs font-mono text-slate-600 dark:text-slate-300">
                        <div className="flex items-center gap-3">
                          <span className="flex items-center gap-1">
                            <Layers className="w-3.5 h-3.5 text-[#06b6d4]" />
                            <span>{course.modules?.length || 0} mod</span>
                          </span>
                          <span className="flex items-center gap-1">
                            <PlayCircle className="w-3.5 h-3.5 text-[#a855f7]" />
                            <span>{totalVideos} lec</span>
                          </span>
                        </div>

                        <span className="text-[#06b6d4] font-semibold flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                          <span>Entrar</span>
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
                  onMouseEnter={() => onPrefetchCourse?.(course.id)}
                  onClick={() => onSelectCourse(course)}
                  className="grid grid-cols-1 md:grid-cols-12 rounded-[24px] bg-white dark:bg-white/[0.02] hover:bg-slate-50/80 dark:hover:bg-white/[0.05] hover:-translate-y-1 border border-slate-200/80 dark:border-white/[0.07] hover:border-[#06b6d4]/40 overflow-hidden transition-all duration-300 group cursor-pointer shadow-sm hover:shadow-md dark:shadow-none [content-visibility:auto]"
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

                  <div className="md:col-span-8 p-6 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-2 text-xs font-mono">
                        <span className="text-[#06b6d4] uppercase font-semibold">
                          {course.category || 'INGENIERÍA'}
                        </span>
                        <span className="text-slate-500 dark:text-slate-400">·</span>
                        <span className="text-slate-600 dark:text-slate-300">
                          {course.modules?.length || 0} módulos / {totalVideos} lecciones
                        </span>
                      </div>

                      <h3 className="font-constellation-display text-xl text-slate-900 dark:text-white group-hover:text-cyan-600 dark:group-hover:text-cyan-200 transition-colors mb-2">
                        {course.title}
                      </h3>

                      <p className="font-constellation-body text-xs sm:text-sm text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed font-extralight">
                        {course.description ||
                          'Domina la teoría y ejecución práctica con retroalimentación automatizada y recursos de estudio sintético.'}
                      </p>
                    </div>

                    <div className="pt-4 mt-4 border-t border-slate-100 dark:border-white/[0.04] flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {course.price > 0 && (
                          <span className="catalog-course-badge">
                            <span className="catalog-price-amount">{course.price}</span>
                            <span className="catalog-price-currency">{course.currency || 'USD'}</span>
                          </span>
                        )}
                        <CourseShareButton course={course} iconOnly />
                      </div>
                      <button className="btn-constellation-pill text-xs">
                        <BookOpen className="w-3.5 h-3.5" />
                        <span>Ver Temario</span>
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

      </div>
    </section>
  );
};
