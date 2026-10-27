import React from 'react';
import { Star } from 'lucide-react';

export const ConstellationTestimonials: React.FC = () => {
  const testimonials = [
    {
      id: 't1',
      name: 'Carlos Mendoza',
      role: 'Estudiante VIP & Software Engineer',
      avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&q=75&auto=format&fit=crop',
      comment: 'DocentOS me permitió completar la mentoría técnica con guías explicativas por audio e interactuar directamente con los mentores.',
      rating: 5,
    },
    {
      id: 't2',
      name: 'Ing. Sofia Ruiz',
      role: 'Mentor Director en DocentOS',
      avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=80&q=75&auto=format&fit=crop',
      comment: 'Gestión directa de estudiantes, revisión centralizada de preguntas y vinculación automática de videos en minutos.',
      rating: 5,
    },
    {
      id: 't3',
      name: 'Alejandro Valdés',
      role: 'Fullstack Engineer & Alumno',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&q=75&auto=format&fit=crop',
      comment: 'La fluidez de la plataforma y el enfoque directo a código sin rodeos marca la diferencia frente a cualquier otro LMS tradicional.',
      rating: 5,
    },
  ];

  return (
    <section className="relative w-full bg-transparent py-20 select-none border-t border-slate-200 dark:border-white/[0.04]">
      <div className="max-w-[1280px] mx-auto px-6">
        
        {/* Cabecera de la Sección Testimonios */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-12">
          <div className="flex flex-col items-start gap-1">
            <div className="inline-flex items-center gap-2 text-xs font-mono font-medium text-[#a855f7] tracking-wider uppercase mb-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#a855f7] shadow-sm shadow-purple-400/50" />
              <span>Comunidad & Resultados</span>
            </div>
            <h2 className="font-constellation-display text-[32px] sm:text-[44px] md:text-[52px] leading-tight text-slate-900 dark:text-white tracking-[-0.035em]">
              Lo que opinan nuestros mentees
            </h2>
            <p className="font-constellation-body text-sm sm:text-base text-slate-600 dark:text-white/60 mt-1 max-w-2xl leading-relaxed font-extralight">
              Opiniones escritas por quienes estudian aquí. Resultados reales en proyectos de la industria.
            </p>
          </div>
        </div>

        {/* Grilla de Testimonios */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {testimonials.map((t) => (
            <article
              key={t.id}
              className="flex flex-col justify-between p-6 rounded-[24px] bg-white/80 dark:bg-[#0c0a1a]/80 hover:bg-slate-50 dark:hover:bg-[#141026] hover:-translate-y-1 border border-slate-200 dark:border-white/[0.08] hover:border-[#a855f7]/40 transition-all duration-200 group shadow-md dark:shadow-lg [content-visibility:auto]"
            >
              <div>
                {/* Cabecera con Persona y Estrellas */}
                <div className="flex items-center justify-between gap-4 mb-4">
                  <div className="flex items-center gap-3">
                    <img
                      src={t.avatarUrl}
                      alt={t.name}
                      width={40}
                      height={40}
                      decoding="async"
                      className="w-10 h-10 rounded-full object-cover border border-slate-200 dark:border-white/10"
                      loading="lazy"
                    />
                    <div>
                      <h3 className="font-constellation-display text-base text-slate-900 dark:text-white font-medium">
                        {t.name}
                      </h3>
                      <span className="font-constellation-label text-[11px] text-[#06b6d4] tracking-wider uppercase block">
                        {t.role}
                      </span>
                    </div>
                  </div>

                  {/* 5 Estrellas */}
                  <div className="flex items-center gap-0.5 text-[#eab308]">
                    {Array.from({ length: t.rating }).map((_, i) => (
                      <Star key={i} className="w-3.5 h-3.5 fill-[#eab308]" />
                    ))}
                  </div>
                </div>

                {/* Comentario */}
                <p className="font-constellation-body text-xs sm:text-sm text-slate-600 dark:text-slate-200 leading-relaxed font-extralight italic">
                  “{t.comment}”
                </p>
              </div>

              <div className="mt-6 pt-3 border-t border-slate-100 dark:border-white/[0.04] text-[10px] font-mono text-slate-600 dark:text-slate-300 flex items-center justify-between">
                <span>ESTUDIANTE VERIFICADO</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">100% Auténtico</span>
              </div>
            </article>
          ))}
        </div>

      </div>
    </section>
  );
};
