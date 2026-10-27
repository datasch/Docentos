import React, { useState } from 'react';
import { siteConfig } from '../../config/theme';
import { usePlatformBrand, DEFAULT_LOGO_URL } from '../../lib/logoConfig';
import { FestiveHatOverlay } from '../../components/FestiveHatOverlay';
import { DOCENTOS_VERSION } from '../../version';
import { CheckCircle2, Github, BookOpen, ShieldCheck } from 'lucide-react';
import { TermsModal } from '../../components/TermsModal';

interface ConstellationFooterProps {
  onGoToCourses?: () => void;
  onGoToSearch?: () => void;
}

export const ConstellationFooter: React.FC<ConstellationFooterProps> = ({
  onGoToCourses,
  onGoToSearch,
}) => {
  const { brandName: appName, logoUrl, logoInitial } = usePlatformBrand();
  const [showTermsModal, setShowTermsModal] = useState<boolean>(false);
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
                  <img
                    src={logoUrl === DEFAULT_LOGO_URL ? '/logo-64.avif' : logoUrl}
                    srcSet={logoUrl === DEFAULT_LOGO_URL ? '/logo-64.avif 64w, /logo.avif 256w' : undefined}
                    sizes={logoUrl === DEFAULT_LOGO_URL ? '32px' : undefined}
                    width={32}
                    height={32}
                    alt={appName}
                    className="w-full h-full object-contain rounded-[10px] bg-[#050505] p-0.5"
                  />
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
            
            <p className="font-constellation-body text-xs sm:text-sm text-slate-600 dark:text-slate-300 max-w-sm leading-relaxed font-extralight">
              {siteConfig.appTagline || 'Plataforma e-Learning Open Source de alto rendimiento'}
            </p>
          </div>

          {/* Columna Derecha: Enlaces Rápidos */}
          <div className="md:col-span-6 flex flex-wrap items-center justify-start md:justify-end gap-x-8 gap-y-3 font-constellation-label text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300">
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

            <button
              type="button"
              onClick={() => setShowTermsModal(true)}
              className="flex items-center gap-1.5 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
            >
              <ShieldCheck className="h-4 w-4 text-[#06b6d4]" />
              <span>Términos & Privacidad</span>
            </button>
          </div>

        </div>

        {/* Barra Inferior del Footer con Copyright y Versión */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-8 text-xs font-mono text-slate-600 dark:text-slate-300">
          <div className="flex items-center gap-2 flex-wrap">
            <span>© {new Date().getFullYear()} {appName}. Todos los derechos reservados.</span>
            <span className="text-slate-400 dark:text-slate-600">·</span>
            <button
              type="button"
              onClick={() => setShowTermsModal(true)}
              className="underline hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer text-[11px]"
            >
              Términos de Servicio & Custodia
            </button>
          </div>

          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/[0.08] text-slate-700 dark:text-slate-200">
              <CheckCircle2 className="h-3.5 w-3.5 text-[#06b6d4]" />
              <span>v{DOCENTOS_VERSION}</span>
            </span>
            <span className="text-slate-500 dark:text-slate-400">·</span>
            <span>{siteConfig.authorCredit || 'DocentOS Community Edition'}</span>
          </div>
        </div>

      </div>

      {/* Modal de Términos y Condiciones */}
      <TermsModal isOpen={showTermsModal} onClose={() => setShowTermsModal(false)} />
    </footer>
  );
};
