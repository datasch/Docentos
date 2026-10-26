import React, { useState } from 'react';
import { Course } from '../../types';
import { motion, AnimatePresence } from 'motion/react';
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
} from 'lucide-react';

interface ConstellationCourseCatalogProps {
  courses: Course[];
  onSelectCourse: (course: Course) => void;
  onPrefetchCourse?: (courseId: string) => void;
}

const FALLBACK_COVERS = [
  'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=900&auto=format&fit=crop&q=80', // Matrix/Code
  'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=900&auto=format&fit=crop&q=80', // Cyber/Security
  'https://images.unsplash.com/photo-1518770660439-4636190af475?w=900&auto=format&fit=crop&q=80', // Circuit/Microchip
  'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=900&auto=format&fit=crop&q=80', // 3D Fluid Abstract
  'https://images.unsplash.com/photo-1504639725590-34d0984388bd?w=900&auto=format&fit=crop&q=80', // Frontend Development
  'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=900&auto=format&fit=crop&q=80', // AI Neural Network
];

export const ConstellationCourseCatalog: React.FC<ConstellationCourseCatalogProps> = ({
  courses,
  onSelectCourse,
  onPrefetchCourse,
}) => {
  const [activeCategory, setActiveCategory] = useState<string>('todos');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

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

  return (
    <section className="relative w-full bg-transparent pt-4 pb-16 md:py-20 select-none">
      <div className="max-w-[1280px] mx-auto px-6">
        
        {/* Cabecera del Catálogo */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-mono font-medium text-[#eab308] tracking-wider uppercase mb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#eab308] shadow-sm shadow-amber-400/50" />
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
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 rounded-full self-start md:self-auto">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-full transition-all cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-[#06b6d4] text-[#050505] shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:text-white/40 dark:hover:text-white'
              }`}
              title="Vista de Cuadrícula"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-full transition-all cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-[#06b6d4] text-[#050505] shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:text-white/40 dark:hover:text-white'
              }`}
              title="Vista Expandida"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Banner Destacado Spotlight (Si hay cursos) */}
        {featuredCourse && activeCategory === 'todos' && searchQuery === '' && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-14 relative rounded-[28px] overflow-hidden border border-slate-200/80 dark:border-white/10 hover:border-[#06b6d4]/40 transition-all duration-300 group cursor-pointer bg-gradient-to-tr from-white via-slate-50 to-white dark:from-[#0a0a14] dark:via-[#08080f] dark:to-[#050505] shadow-sm dark:shadow-2xl"
            onClick={() => onSelectCourse(featuredCourse)}
          >
            <div className="grid grid-cols-1 lg:grid-cols-12 items-center">
              
              {/* Información Destacada */}
              <div className="lg:col-span-7 p-8 sm:p-12 flex flex-col items-start justify-between z-10">
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-mono font-semibold bg-[#eab308]/15 text-[#eab308] border border-[#eab308]/30">
                      <Flame className="w-3.5 h-3.5" />
                      <span>PROGRAMA DESTACADO</span>
                    </span>
                    <span className="text-slate-300 dark:text-white/30 text-xs">·</span>
                    <span className="text-[#06b6d4] text-xs font-mono font-semibold uppercase">
                      {featuredCourse.category || 'INGENIERÍA'}
                    </span>
                  </div>

                  <h3 className="font-constellation-display text-2xl sm:text-3xl md:text-4xl text-slate-900 dark:text-white group-hover:text-cyan-600 dark:group-hover:text-cyan-200 transition-colors leading-tight mb-4">
                    {featuredCourse.title}
                  </h3>

                  <p className="font-constellation-body text-sm sm:text-base text-slate-600 dark:text-white/65 leading-relaxed line-clamp-3 mb-6 font-extralight max-w-xl">
                    {featuredCourse.description ||
                      'Domina arquitectura avanzada, buenas prácticas y despliegues empresariales guiados por mentores técnicos.'}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-6 w-full pt-4 border-t border-slate-200 dark:border-white/[0.06]">
                  <div className="flex items-center gap-4 text-xs font-mono text-slate-500 dark:text-white/50">
                    <span className="flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-[#06b6d4]" />
                      <span>{featuredCourse.modules?.length || 0} módulos</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <PlayCircle className="w-4 h-4 text-[#a855f7]" />
                      <span>
                        {(featuredCourse.modules || []).reduce(
                          (acc, m) => acc + (m.videos || []).length,
                          0
                        )}{' '}
                        lecciones
                      </span>
                    </span>
                  </div>

                  <button className="btn-constellation-pill text-xs ml-auto cursor-pointer">
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Iniciar Ahora</span>
                  </button>
                </div>
              </div>

              {/* Cover Panorámico Destacado */}
              <div className="lg:col-span-5 h-[280px] sm:h-[340px] relative overflow-hidden bg-slate-900">
                <img
                  src={
                    featuredCourse.coverImage ||
                    FALLBACK_COVERS[0]
                  }
                  alt={featuredCourse.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                />
                <div className="absolute inset-0 bg-gradient-to-t lg:bg-gradient-to-r from-white/90 via-transparent to-transparent dark:from-[#0a0a14] dark:via-transparent dark:to-transparent opacity-90" />
                
                {/* Floating Play Icon */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-14 h-14 rounded-full bg-[#06b6d4]/30 border border-[#06b6d4]/60 flex items-center justify-center text-[#06b6d4] shadow-xl group-hover:scale-110 transition-transform">
                    <Play className="w-6 h-6 fill-[#06b6d4] ml-0.5" />
                  </div>
                </div>
              </div>

            </div>
          </motion.div>
        )}

        {/* Barra de Filtros por Categoría y Búsqueda */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mb-10 pb-6 border-b border-slate-200 dark:border-white/[0.06]">
          {/* Píldoras de Categoría */}
          <div className="flex flex-wrap items-center gap-2">
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
                  className={`font-constellation-label text-xs uppercase tracking-wider px-3.5 py-1.5 rounded-full transition-all cursor-pointer flex items-center gap-2 ${
                    activeCategory === cat
                      ? 'bg-[#06b6d4] text-[#050505] font-bold shadow-[0_0_15px_rgba(6,182,212,0.35)]'
                      : 'bg-slate-100 hover:bg-slate-200/80 text-slate-600 hover:text-slate-900 border border-slate-200/60 dark:bg-white/[0.03] dark:text-white/50 dark:hover:text-white dark:hover:bg-white/[0.07] dark:border-white/[0.05]'
                  }`}
                >
                  <span>{cat}</span>
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
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

          {/* Input de Búsqueda Rápida */}
          <div className="relative min-w-[260px]">
            <Search className="w-4 h-4 text-slate-400 dark:text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filtrar cursos..."
              className="w-full bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 focus:border-[#06b6d4] focus:outline-none rounded-full pl-10 pr-4 py-1.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-white/30 font-constellation-body transition-colors shadow-sm dark:shadow-none"
            />
          </div>
        </div>

        {/* Cuadrícula Visual de Cursos (Visual Grid) */}
        {filteredCourses.length === 0 ? (
          <div className="py-20 text-center">
            <Sparkles className="w-8 h-8 text-[#06b6d4] mx-auto mb-3 opacity-60" />
            <p className="font-constellation-display text-lg text-slate-900 dark:text-white">
              No se encontraron cursos en esta categoría
            </p>
            <p className="font-constellation-body text-xs text-slate-500 dark:text-white/40 mt-1">
              Prueba cambiando los filtros o borrando el término de búsqueda.
            </p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <AnimatePresence>
              {filteredCourses.map((course, idx) => {
                const totalVideos = (course.modules || []).reduce(
                  (acc, m) => acc + (m.videos || []).length,
                  0
                );
                const cover =
                  course.coverImage ||
                  FALLBACK_COVERS[idx % FALLBACK_COVERS.length];

                return (
                  <motion.article
                    key={course.id}
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    whileHover={{ y: -5, transition: { duration: 0.2 } }}
                    onMouseEnter={() => onPrefetchCourse?.(course.id)}
                    onClick={() => onSelectCourse(course)}
                    className="flex flex-col rounded-[24px] bg-white dark:bg-white/[0.02] hover:bg-slate-50/80 dark:hover:bg-white/[0.05] border border-slate-200/80 dark:border-white/[0.07] hover:border-[#06b6d4]/40 overflow-hidden transition-all duration-300 group cursor-pointer shadow-sm hover:shadow-md dark:shadow-lg [content-visibility:auto]"
                  >
                    {/* Contenedor Visual de la Portada / Imagen */}
                    <div className="relative aspect-video w-full overflow-hidden bg-slate-950">
                      <img
                        src={cover}
                        alt={course.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
                        loading="lazy"
                        decoding="async"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-transparent to-transparent dark:from-[#050505] dark:via-[#050505]/30" />

                      {/* Badges de Categoría y Precio (Optimizados sin backdrop-blur para scroll a 60+ FPS) */}
                      <div className="absolute top-3 inset-x-3 flex items-center justify-between z-10">
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-mono uppercase tracking-wider font-semibold bg-black/80 border border-white/10 text-[#06b6d4]">
                          {course.category || 'INGENIERÍA'}
                        </span>

                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-bold ${
                            course.price && course.price > 0
                              ? 'bg-black/80 text-white border border-white/20'
                              : 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/30'
                          }`}
                        >
                          {course.price && course.price > 0
                            ? `$${course.price} USD`
                            : 'ACCESO LIBRE'}
                        </span>
                      </div>

                      {/* Botón Flotante Play al hacer Hover */}
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <div className="w-12 h-12 rounded-full bg-[#06b6d4]/30 border border-[#06b6d4]/60 flex items-center justify-center text-[#06b6d4] shadow-xl group-hover:scale-110 transition-transform">
                          <Play className="w-5 h-5 fill-[#06b6d4] ml-0.5" />
                        </div>
                      </div>
                    </div>

                    {/* Cuerpo de la Tarjeta con Tipografía Jerárquica */}
                    <div className="p-5 sm:p-6 flex flex-col flex-1 justify-between">
                      <div>
                        <h4 className="font-constellation-display text-lg text-slate-900 dark:text-white group-hover:text-cyan-600 dark:group-hover:text-cyan-200 transition-colors line-clamp-2 leading-snug mb-2">
                          {course.title}
                        </h4>

                        <p className="font-constellation-body text-xs text-slate-600 dark:text-white/60 line-clamp-2 leading-relaxed font-extralight mb-4">
                          {course.description ||
                            'Aprende técnicas aplicadas, arquitectura y dominio técnico con evaluación continua.'}
                        </p>
                      </div>

                      {/* Metadatos Inferiores y Botón de Entrada */}
                      <div className="pt-4 border-t border-slate-100 dark:border-white/[0.04] flex items-center justify-between text-xs font-mono text-slate-500 dark:text-white/40">
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
                  </motion.article>
                );
              })}
            </AnimatePresence>
          </div>
        ) : (
          /* Vista de Lista Cinemática Expandida */
          <div className="space-y-6">
            {filteredCourses.map((course, idx) => {
              const totalVideos = (course.modules || []).reduce(
                (acc, m) => acc + (m.videos || []).length,
                0
              );
              const cover =
                course.coverImage ||
                FALLBACK_COVERS[idx % FALLBACK_COVERS.length];

              return (
                <motion.article
                  key={course.id}
                  whileHover={{ y: -3, transition: { duration: 0.2 } }}
                  onMouseEnter={() => onPrefetchCourse?.(course.id)}
                  onClick={() => onSelectCourse(course)}
                  className="grid grid-cols-1 md:grid-cols-12 rounded-[24px] bg-white dark:bg-white/[0.02] hover:bg-slate-50/80 dark:hover:bg-white/[0.05] border border-slate-200/80 dark:border-white/[0.07] hover:border-[#06b6d4]/40 overflow-hidden transition-all duration-300 group cursor-pointer shadow-sm hover:shadow-md dark:shadow-none [content-visibility:auto]"
                >
                  <div className="md:col-span-4 aspect-video relative overflow-hidden bg-slate-950">
                    <img
                      src={cover}
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
                        <span className="text-slate-300 dark:text-white/30">·</span>
                        <span className="text-slate-500 dark:text-white/40">
                          {course.modules?.length || 0} módulos / {totalVideos} lecciones
                        </span>
                      </div>

                      <h4 className="font-constellation-display text-xl text-slate-900 dark:text-white group-hover:text-cyan-600 dark:group-hover:text-cyan-200 transition-colors mb-2">
                        {course.title}
                      </h4>

                      <p className="font-constellation-body text-xs sm:text-sm text-slate-600 dark:text-white/60 line-clamp-2 leading-relaxed font-extralight">
                        {course.description ||
                          'Domina la teoría y ejecución práctica con retroalimentación automatizada y recursos de estudio sintético.'}
                      </p>
                    </div>

                    <div className="pt-4 mt-4 border-t border-slate-100 dark:border-white/[0.04] flex items-center justify-between">
                      <span className="font-mono text-xs text-[#eab308]">
                        {course.price && course.price > 0
                          ? `$${course.price} USD`
                          : 'Acceso Estudiante'}
                      </span>
                      <button className="btn-constellation-pill text-xs">
                        <BookOpen className="w-3.5 h-3.5" />
                        <span>Ver Temario</span>
                      </button>
                    </div>
                  </div>
                </motion.article>
              );
            })}
          </div>
        )}

      </div>
    </section>
  );
};
