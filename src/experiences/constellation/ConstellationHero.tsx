import React, { useRef } from 'react';
import { motion, useScroll, useTransform, useSpring } from 'motion/react';
import { Search, Compass } from 'lucide-react';
import { User } from '../../types';
import { formatDisplayName } from '../../lib/avatar';

interface ConstellationHeroProps {
  currentUser?: User | null;
  onExploreCourses: () => void;
  onOpenSearch: () => void;
  totalCoursesCount: number;
}

export const ConstellationHero: React.FC<ConstellationHeroProps> = ({
  currentUser,
  onExploreCourses,
  onOpenSearch,
  totalCoursesCount,
}) => {
  const sectionRef = useRef<HTMLElement>(null);

  // Scroll Progress conectado a la física de Framer Motion
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start start', 'end start'],
  });

  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 85,
    damping: 24,
    restDelta: 0.001,
  });

  // Parallax cinematográfico para el bloque tipográfico
  const textY = useTransform(smoothProgress, [0, 1], [0, -45]);
  const textOpacity = useTransform(smoothProgress, [0, 0.88], [1, 0.7]);

  return (
    <section
      ref={sectionRef}
      className="relative w-full bg-transparent overflow-hidden select-none pt-8 pb-4 md:py-20 lg:py-24"
    >
      <div className="max-w-[1280px] mx-auto px-6">
        
        {/* Grilla Asimétrica en 2 Columnas */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-center">
          
          {/* Columna Izquierda: Bloque Tipográfico Monolítico */}
          <motion.div
            style={{ y: textY, opacity: textOpacity }}
            className="lg:col-span-7 flex flex-col items-start z-10 [will-change:transform]"
          >
            {/* Etiqueta superior en Amarillo/Oro Giantucchi */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              className="flex items-center gap-2 mb-6"
            >
              <span className="w-2 h-2 rounded-full bg-[#eab308] animate-pulse" />
              <span className="font-constellation-label text-xs sm:text-[13px] text-[#eab308] tracking-[0.25em] uppercase font-bold">
                INTELIGENCIA DISTRIBUIDA · DOCENTOS CONSTELLATION
              </span>
            </motion.div>

            {/* Titular Monolítico a Gran Escala Display (peso 400, tracking -3.12px, sin negritas) */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.1, ease: 'easeOut' }}
              className="font-constellation-display text-[48px] sm:text-[68px] md:text-[84px] lg:text-[92px] leading-[0.98] tracking-[-0.04em] text-slate-900 dark:text-white mb-8"
            >
              {currentUser ? (
                <>
                  Bienvenido, <br />
                  <span className="text-cyan-600 dark:text-[#06b6d4]">
                    {formatDisplayName(currentUser.name)}.
                  </span>
                </>
              ) : (
                <>
                  Tu academia tiene la respuesta. <br />
                  <span className="text-slate-700 dark:text-white/95">Pregúntale a DocentOS.</span>
                </>
              )}
            </motion.h1>

            {/* Párrafo de Cuerpo a 18px en Peso 200 Ultra-Ligero */}
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2, ease: 'easeOut' }}
              className="font-constellation-body text-base sm:text-lg md:text-[19px] text-slate-600 dark:text-white/70 max-w-[540px] mb-10 leading-relaxed font-extralight"
            >
              {currentUser ? (
                <>
                  Continúa dominando tus rutas pedagógicas estructuradas, consultas sinápticas y proyectos de alta ingeniería. Tu progreso y certificaciones están al día.
                </>
              ) : (
                <>
                  El conocimiento deja de ser una biblioteca estática para convertirse en una red neuronal viva.
                  Explora rutas de aprendizaje sintetizadas, lecciones interactivas y material pedagógico flotando directamente sobre el vacío cuántico.
                </>
              )}
            </motion.p>

            {/* Botón Píldora Cyan Giantucchi y Enlace Fantasma */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.3, ease: 'easeOut' }}
              className="flex flex-wrap items-center gap-6"
            >
              <button
                onClick={onExploreCourses}
                className="btn-constellation-pill cursor-pointer shadow-[0_0_30px_rgba(6,182,212,0.3)] hover:shadow-[0_0_40px_rgba(6,182,212,0.5)]"
              >
                <Compass className="w-4 h-4" />
                <span>Explorar Catálogo ({totalCoursesCount})</span>
              </button>

              <button
                onClick={onOpenSearch}
                className="btn-constellation-ghost group font-constellation-label text-xs tracking-wider uppercase cursor-pointer text-slate-700 dark:text-white"
              >
                <Search className="w-4 h-4 text-[#06b6d4] group-hover:scale-110 transition-transform" />
                <span>Consultar Red Sináptica →</span>
              </button>
            </motion.div>
          </motion.div>

          {/* Columna Derecha: Espaciador Focal Transparente para la Constelación Neural 3D (Solo en Desktop) */}
          <div className="hidden lg:flex lg:col-span-5 relative w-full lg:h-[580px] items-center justify-center pointer-events-none" />

        </div>

      </div>
    </section>
  );
};
