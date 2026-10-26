import React from 'react';
import { motion } from 'motion/react';
import { Brain, Video, ShieldCheck, Layers, CheckCircle2 } from 'lucide-react';

export const ConstellationPillars: React.FC = () => {
  const pillars = [
    {
      id: 'p1',
      icon: Brain,
      tag: 'ENGINE CORE',
      title: 'Motor AI-Native Integrado',
      description: 'Generación dinámica de contenidos, guías vocales de mentoría en tiempo real y asistente de estudio sintético.',
    },
    {
      id: 'p2',
      icon: Video,
      tag: 'STREAMING PIPELINE',
      title: 'Streaming Nativo con Google Drive',
      description: 'Indexación automática de lecciones e integración directa de videos almacenados en carpetas de Google Drive.',
    },
    {
      id: 'p3',
      icon: ShieldCheck,
      tag: 'SECURITY & RBAC',
      title: 'Control de Roles RBAC & Single-Admin',
      description: 'Permisos jerárquicos estrictos con garantía de Administrador Único y Pases VIP de acceso ilimitado.',
    },
    {
      id: 'p4',
      icon: Layers,
      tag: 'EXTENSIBILITY',
      title: 'Arquitectura Modular de Plugins',
      description: 'Amplía la funcionalidad del LMS con módulos de Certificados PDF, Exámenes interconectados y Webhooks.',
    },
  ];

  return (
    <section className="relative w-full bg-transparent py-20 select-none border-t border-slate-200 dark:border-white/[0.04]">
      <div className="max-w-[1280px] mx-auto px-6">
        
        {/* Cabecera de la Sección Pilares */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-12">
          <div className="flex flex-col items-start gap-1">
            <div className="inline-flex items-center gap-2 text-xs font-mono font-medium text-[#06b6d4] tracking-wider uppercase mb-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#06b6d4] shadow-sm shadow-cyan-400/50" />
              <span>Metodología & Arquitectura</span>
            </div>
            <h2 className="font-constellation-display text-[32px] sm:text-[44px] md:text-[52px] leading-tight text-slate-900 dark:text-white tracking-[-0.035em]">
              Pilares de metodología y tecnología
            </h2>
            <p className="font-constellation-body text-sm sm:text-base text-slate-600 dark:text-white/60 mt-1 max-w-2xl leading-relaxed font-extralight">
              Las piezas del motor que sostienen la retención y la aplicación de lo aprendido.
            </p>
          </div>
        </div>

        {/* Bento Grid con el Espectro Giantucchi sobre Lienzo Negro */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {pillars.map((pillar, idx) => {
            const IconComp = pillar.icon;

            return (
              <motion.article
                key={pillar.id}
                whileHover={{ y: -4, transition: { duration: 0.2 } }}
                className="flex flex-col justify-between p-6 rounded-[24px] bg-white dark:bg-white/[0.02] hover:bg-slate-50/80 dark:hover:bg-white/[0.05] border border-slate-200/80 dark:border-white/[0.06] hover:border-[#06b6d4]/40 transition-all group cursor-default shadow-sm dark:shadow-none"
              >
                <div>
                  <div className="flex items-center justify-between mb-5">
                    <div className="p-3 rounded-2xl bg-slate-100 dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/10 group-hover:border-[#06b6d4]/40 group-hover:bg-[#06b6d4]/10 text-[#06b6d4] transition-colors">
                      <IconComp aria-hidden className="h-5 w-5" />
                    </div>
                    <span className="font-mono text-xs text-slate-400 dark:text-white/30 font-bold">
                      0{idx + 1}
                    </span>
                  </div>

                  <h3 className="font-constellation-display text-lg text-slate-900 dark:text-white group-hover:text-cyan-600 dark:group-hover:text-cyan-200 transition-colors mb-2 leading-snug">
                    {pillar.title}
                  </h3>
                  
                  <p className="font-constellation-body text-xs text-slate-600 dark:text-white/60 leading-relaxed font-extralight">
                    {pillar.description}
                  </p>
                </div>

                <div className="mt-8 pt-3 border-t border-slate-100 dark:border-white/[0.04] flex items-center justify-between text-[10px] font-mono text-slate-500 dark:text-white/40">
                  <span className="text-[#06b6d4] font-semibold">{pillar.tag}</span>
                  <span className="flex items-center gap-1 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
                    <span>Verificado</span>
                    <CheckCircle2 className="w-3 h-3 text-[#06b6d4]" />
                  </span>
                </div>
              </motion.article>
            );
          })}
        </div>

      </div>
    </section>
  );
};
