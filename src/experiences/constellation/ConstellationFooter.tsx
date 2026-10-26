import React from 'react';
import { siteConfig } from '../../config/theme';
import { usePlatformBrand, DEFAULT_LOGO_URL } from '../../lib/logoConfig';
import { FestiveHatOverlay } from '../../components/FestiveHatOverlay';
import { DOCENTOS_VERSION } from '../../version';
import { CheckCircle2, Github, BookOpen } from 'lucide-react';

interface ConstellationFooterProps {
  onGoToCourses?: () => void;
  onGoToSearch?: () => void;
}

export const ConstellationFooter: React.FC<ConstellationFooterProps> = ({
  onGoToCourses,
  onGoToSearch,
}) => {
  const { brandName: appName, logoUrl, logoInitial } = usePlatformBrand();
  const githubUrl = siteConfig.poweredByLink || 'https://github.com/datasch/Docentos';

  return (
    <footer className="w-full bg-transparent border-t border-slate-200 dark:border-white/[0.08] pt-16 pb-12 select-none">
      <div className="max-w-[1280px] mx-auto px-6">
        
        {/* Grilla Principal del Footer de DocentOS */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 pb-12 border-b border-slate-200 dark:border-white/[0.06]">
          
          {/* Columna Izquierda: Logo, Nombre y Motto de DocentOS */}
          <div className="md:col-span-6 flex flex-col items-start gap-3">
            <div className="flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#06b6d4] via-[#8b5cf6] to-[#ec4899] p-[1.5px] flex items-center justify-center relative overflow-visible">
                {logoUrl ? (
                  <img src={logoUrl} alt={appName} className="w-full h-full object-contain rounded-[10px] bg-[#050505] p-0.5" />
                ) : (
                  <span className="w-full h-full rounded-[10px] bg-[#050505] flex items-center justify-center text-xs font-bold text-white">
                    {logoInitial}
                  </span>
                )}
                {/* Gorro Festivo Estacional */}
                <FestiveHatOverlay size="sm" />
              </span>
              <span className="font-constellation-display text-xl font-semibold tracking-tight text-slate-900 dark:text-white">
                {appName}
                <span className="text-[#06b6d4]">.</span>
              </span>
            </div>
            
            <p className="font-constellation-body text-xs sm:text-sm text-slate-500 dark:text-white/50 max-w-sm leading-relaxed font-extralight">
              {siteConfig.appTagline || 'Plataforma e-Learning Open Source de alto rendimiento'}
            </p>
          </div>

          {/* Columna Derecha: Enlaces Rápidos */}
          <div className="md:col-span-6 flex flex-wrap items-center justify-start md:justify-end gap-x-8 gap-y-3 font-constellation-label text-xs uppercase tracking-wider text-slate-600 dark:text-white/60">
            {onGoToCourses && (
              <button
                onClick={onGoToCourses}
                className="hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
              >
                Catálogo
              </button>
            )}

            <a
              href={githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              <Github className="h-4 w-4" />
              <span>GitHub</span>
            </a>

            {siteConfig.complaintsBookUrl && (
              <a
                href={siteConfig.complaintsBookUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                <BookOpen className="h-4 w-4" />
                <span>Libro de Reclamaciones</span>
              </a>
            )}
          </div>

        </div>

        {/* Barra Inferior del Footer con Copyright y Versión */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-8 text-xs font-mono text-slate-500 dark:text-white/40">
          <div>
            © {new Date().getFullYear()} {appName}. Todos los derechos reservados.
          </div>

          <div className="flex items-center gap-2 text-slate-500 dark:text-white/50">
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/[0.08] text-slate-700 dark:text-white/70">
              <CheckCircle2 className="h-3.5 w-3.5 text-[#06b6d4]" />
              <span>v{DOCENTOS_VERSION}</span>
            </span>
            <span className="text-slate-300 dark:text-white/20">·</span>
            <span>{siteConfig.authorCredit || 'DocentOS Community Edition'}</span>
          </div>
        </div>

      </div>
    </footer>
  );
};
