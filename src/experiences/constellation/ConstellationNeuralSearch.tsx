import React, { useState, useMemo } from 'react';
import { Course, VideoDriveLink, Module } from '../../types';
import { Search, Sparkles, ArrowRight, Play, SlidersHorizontal, ChevronDown, X, RotateCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  isStandardCategory,
  getCanonicalCategory,
  MENTORSHIP_CATEGORIES,
  TECHNICAL_CATEGORIES,
} from '../../lib/courseCategories';

interface ConstellationNeuralSearchProps {
  courses: Course[];
  onSelectCourse: (course: Course) => void;
  onOpenLesson?: (course: Course, module: Module, video: VideoDriveLink) => void;
}

export const ConstellationNeuralSearch: React.FC<ConstellationNeuralSearchProps> = ({
  courses,
  onSelectCourse,
  onOpenLesson,
}) => {
  const [query, setQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string>('todos');

  // Solo consideramos cursos dentro del estándar oficial de DocentOS (excluye cursos de prueba o categorías obsoletas)
  const standardCourses = useMemo(() => {
    return courses.filter((c) => isStandardCategory(c.category));
  }, [courses]);

  // Buscar resultados en vivo en cursos, módulos y lecciones
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const isAll = selectedTag === 'todos';
    const tagLower = selectedTag.toLowerCase();

    const matchedCourses = standardCourses.filter((c) => {
      const titleMatch = c.title.toLowerCase().includes(q);
      const descMatch = (c.description || '').toLowerCase().includes(q);
      const courseCat = (getCanonicalCategory(c.category) || c.category || '').trim().toLowerCase();
      const tagMatch = isAll || courseCat === tagLower || courseCat.includes(tagLower);
      return (q === '' || titleMatch || descMatch) && tagMatch;
    });

    const matchedLessons: { course: Course; module: Module; video: VideoDriveLink }[] = [];

    if (q.length >= 2) {
      standardCourses.forEach((c) => {
        const courseCat = (getCanonicalCategory(c.category) || c.category || '').trim().toLowerCase();
        const tagMatch = isAll || courseCat === tagLower || courseCat.includes(tagLower);
        if (!tagMatch) return;

        (c.modules || []).forEach((m) => {
          (m.videos || []).forEach((v) => {
            if (v.title.toLowerCase().includes(q) || (v.description || '').toLowerCase().includes(q)) {
              matchedLessons.push({ course: c, module: m, video: v });
            }
          });
        });
      });
    }

    let aiSummary: string | null = null;
    if (q.length >= 3) {
      const categoryHint = isAll ? '' : ` en la categoría "${selectedTag}"`;
      aiSummary = `La red sináptica de DocentOS localizó ${matchedCourses.length} cursos y ${matchedLessons.length} lecciones directamente vinculadas con "${query}"${categoryHint}. Los módulos prioritarios profundizan en diseño de software moderno, optimización de pipelines y casos de aplicación en producción.`;
    }

    return {
      matchedCourses: !q && isAll ? standardCourses.slice(0, 6) : matchedCourses,
      totalMatchedCourses: matchedCourses.length,
      matchedLessons: matchedLessons.slice(0, 6),
      aiSummary,
    };
  }, [query, selectedTag, standardCourses]);

  return (
    <section className="relative w-full bg-[#f8fafc] dark:bg-[#050505] py-16 md:py-24 select-none">
      <div className="max-w-[1280px] mx-auto px-6">
        
        {/* Cabecera de la Sección */}
        <div className="mb-12">
          <span className="font-constellation-label text-xs text-[#06b6d4] tracking-[0.2em] uppercase block mb-3 font-semibold">
            NEURAL SEARCH · CONSULTA DIRECTA
          </span>
          <h2 className="font-constellation-display text-[38px] sm:text-[54px] md:text-[68px] leading-[1.05] tracking-[-0.04em] text-slate-900 dark:text-white">
            Tu academia tiene la respuesta.
          </h2>
          <p className="font-constellation-body text-base sm:text-lg text-slate-600 dark:text-white/60 mt-3 max-w-[620px] font-extralight">
            Pregunta directamente a la red de conocimiento de DocentOS para localizar lecciones específicas, conceptos técnicos y clases grabadas.
          </p>
        </div>

        {/* Input de Búsqueda Flotante en el Vacío */}
        <div className="relative w-full max-w-3xl mb-8">
          <div className="relative flex items-center w-full rounded-full bg-white dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.12] hover:border-[#06b6d4]/50 focus-within:border-[#06b6d4] transition-all px-6 py-4 shadow-sm dark:shadow-[0_10px_35px_rgba(0,0,0,0.8)]">
            <Search className="w-5 h-5 text-[#06b6d4] mr-4 shrink-0" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Escribe un concepto (e.g. React, Arquitectura, TypeScript, APIs)..."
              className="w-full bg-transparent text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-white/35 font-constellation-body text-base outline-none"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="text-slate-400 hover:text-slate-700 dark:text-white/40 dark:hover:text-white text-xs px-2 py-1 rounded cursor-pointer"
              >
                Limpiar
              </button>
            )}
          </div>

          {/* Barra de Control de Filtros Limpia y Ordenada */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 px-1">
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Selector Desplegable de Categoría */}
              <div className="relative inline-flex items-center">
                <label
                  htmlFor="neural-search-category-filter"
                  className="font-constellation-label text-xs uppercase tracking-wider text-slate-500 dark:text-white/50 font-semibold flex items-center gap-1.5 mr-2"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5 text-[#06b6d4]" />
                  <span>Filtro:</span>
                </label>

                <div className="relative inline-block">
                  <select
                    id="neural-search-category-filter"
                    aria-label="Filtrar por categoría"
                    value={selectedTag}
                    onChange={(e) => setSelectedTag(e.target.value)}
                    className="appearance-none cursor-pointer pl-3.5 pr-8 py-1.5 rounded-full text-xs font-constellation-body bg-white dark:bg-white/[0.05] border border-slate-200 dark:border-white/10 hover:border-[#06b6d4]/60 dark:hover:border-[#06b6d4]/60 focus:border-[#06b6d4] focus:outline-none text-slate-800 dark:text-white transition-all shadow-sm"
                  >
                    <option value="todos" className="bg-white dark:bg-[#121212] text-slate-900 dark:text-white font-medium">
                      Todas las categorías ({standardCourses.length})
                    </option>
                    <optgroup label="Modalidades de Mentoría" className="bg-white dark:bg-[#121212] text-slate-500 dark:text-white/60 font-semibold">
                      {MENTORSHIP_CATEGORIES.map((cat) => {
                        const count = standardCourses.filter((c) => getCanonicalCategory(c.category) === cat).length;
                        return (
                          <option key={cat} value={cat} className="bg-white dark:bg-[#121212] text-slate-900 dark:text-white">
                            {cat} ({count})
                          </option>
                        );
                      })}
                    </optgroup>
                    <optgroup label="Áreas Temáticas Técnicas" className="bg-white dark:bg-[#121212] text-slate-500 dark:text-white/60 font-semibold">
                      {TECHNICAL_CATEGORIES.map((cat) => {
                        const count = standardCourses.filter((c) => getCanonicalCategory(c.category) === cat).length;
                        return (
                          <option key={cat} value={cat} className="bg-white dark:bg-[#121212] text-slate-900 dark:text-white">
                            {cat} ({count})
                          </option>
                        );
                      })}
                    </optgroup>
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 dark:text-white/40 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              {/* Chip Activo para Categoría Seleccionada */}
              {selectedTag !== 'todos' && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-constellation-label tracking-wide uppercase bg-[#06b6d4]/10 text-[#0891b2] dark:text-[#22d3ee] border border-[#06b6d4]/30 shadow-sm animate-fadeIn">
                  <span>{selectedTag}</span>
                  <button
                    type="button"
                    onClick={() => setSelectedTag('todos')}
                    aria-label="Quitar filtro de categoría"
                    className="hover:text-red-500 dark:hover:text-red-400 transition-colors p-0.5 rounded cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
            </div>

            {/* Contador de Resultados y Botón de Reset */}
            <div className="flex items-center gap-3 text-xs font-constellation-label text-slate-500 dark:text-white/50">
              <span className="tracking-wide">
                {results.matchedCourses.length}{' '}
                {results.matchedCourses.length === 1 ? 'curso disponible' : 'cursos disponibles'}
                {results.matchedLessons.length > 0 && ` · ${results.matchedLessons.length} lecciones`}
              </span>

              {(query.trim() || selectedTag !== 'todos') && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery('');
                    setSelectedTag('todos');
                  }}
                  className="inline-flex items-center gap-1 text-[#06b6d4] hover:text-[#0891b2] dark:hover:text-[#22d3ee] font-semibold cursor-pointer transition-colors"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Restablecer</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Síntesis Neural DocentOS */}
        <AnimatePresence>
          {results.aiSummary && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="max-w-3xl mb-12 p-6 rounded-[24px] bg-gradient-to-r from-cyan-50 via-purple-50 to-transparent dark:from-cyan-950/20 dark:via-purple-950/20 to-transparent border-l-2 border-[#06b6d4] shadow-sm dark:shadow-none"
            >
              <div className="flex items-center gap-2 mb-2 text-[#06b6d4] font-constellation-label text-xs uppercase tracking-wider font-bold">
                <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                <span>Síntesis de Inteligencia DocentOS</span>
              </div>
              <p className="font-constellation-body text-slate-700 dark:text-white/85 text-sm sm:text-base leading-relaxed">
                {results.aiSummary}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Lecciones Específicas Encontradas */}
        {results.matchedLessons.length > 0 && (
          <div className="mb-14">
            <span className="font-constellation-label text-xs text-[#eab308] tracking-widest uppercase block mb-4">
              LECCIONES Y VIDEOS RELEVANTES ({results.matchedLessons.length})
            </span>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {results.matchedLessons.map(({ course, module, video }) => (
                <div
                  key={video.id}
                  onClick={() => {
                    onSelectCourse(course);
                    if (onOpenLesson) onOpenLesson(course, module, video);
                  }}
                  className="group cursor-pointer p-5 rounded-[20px] bg-white dark:bg-white/[0.02] hover:bg-slate-50/80 dark:hover:bg-white/[0.05] border border-slate-200/80 dark:border-white/[0.05] hover:border-[#06b6d4]/40 transition-all flex flex-col justify-between shadow-sm dark:shadow-none"
                >
                  <div>
                    <div className="flex items-center justify-between text-[11px] text-slate-400 dark:text-white/40 mb-2">
                      <span className="truncate max-w-[180px] text-[#06b6d4] uppercase font-mono">
                        {course.title}
                      </span>
                      <span>{video.duration || 'Lección'}</span>
                    </div>
                    <h4 className="font-constellation-display text-lg text-slate-900 dark:text-white group-hover:text-cyan-600 dark:group-hover:text-cyan-300 transition-colors line-clamp-2 mb-2">
                      {video.title}
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-white/50 line-clamp-2 font-constellation-body">
                      Módulo: {module.title}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-[#06b6d4] mt-4 font-constellation-label">
                    <Play className="w-3 h-3 fill-[#06b6d4]" />
                    <span>Reproducir lección</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Cursos Encontrados */}
        <div>
          <span className="font-constellation-label text-xs text-slate-500 dark:text-white/50 tracking-widest uppercase block mb-6">
            CURSOS EN EL CATÁLOGO ({results.matchedCourses.length})
          </span>

          {results.matchedCourses.length === 0 ? (
            <div className="py-12 text-center text-slate-400 dark:text-white/40 font-constellation-body">
              {query
                ? `No se encontraron cursos con el término "${query}". Intenta con otra palabra clave o restablece los filtros.`
                : 'No se encontraron cursos en la categoría seleccionada.'}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {results.matchedCourses.map((c) => (
                <div
                  key={c.id}
                  onClick={() => onSelectCourse(c)}
                  className="group cursor-pointer flex flex-col justify-between p-6 rounded-[24px] bg-white dark:bg-white/[0.02] hover:bg-slate-50/80 dark:hover:bg-white/[0.06] border border-slate-200/80 dark:border-white/[0.06] hover:border-[#06b6d4]/40 transition-all shadow-sm dark:shadow-none"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-constellation-label text-xs text-[#eab308] tracking-wider uppercase font-semibold">
                        {c.category || 'PROGRAMA ACADÉMICO'}
                      </span>
                      <span className="text-xs font-mono text-slate-400 dark:text-white/40">
                        {c.modules?.length || 0} módulos
                      </span>
                    </div>

                    <h3 className="font-constellation-display text-2xl sm:text-3xl text-slate-900 dark:text-white group-hover:text-cyan-600 dark:group-hover:text-cyan-200 transition-colors mb-3 leading-snug">
                      {c.title}
                    </h3>

                    <p className="font-constellation-body text-sm sm:text-base text-slate-600 dark:text-white/60 line-clamp-3 leading-relaxed mb-6 font-extralight">
                      {c.description || 'Formación completa con metodología práctica y proyectos en vivo.'}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-white/[0.04]">
                    <span className="text-xs font-constellation-label text-slate-400 dark:text-white/40">
                      Categoría: {c.category || 'General'}
                    </span>
                    <button className="btn-constellation-ghost font-constellation-label text-xs tracking-wider uppercase group-hover:text-[#06b6d4]">
                      <span>Acceder al curso</span>
                      <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </section>
  );
};
