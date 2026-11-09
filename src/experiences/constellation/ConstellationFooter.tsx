import React, { useState } from 'react';
import { siteConfig } from '../../config/theme';
import { usePlatformBrand, DEFAULT_LOGO_URL } from '../../lib/logoConfig';
import { FestiveHatOverlay } from '../../components/FestiveHatOverlay';
import { DOCENTOS_VERSION } from '../../version';
import { CheckCircle2, Github, BookOpen, ShieldCheck, HeartHandshake, ArrowUp } from 'lucide-react';
import { TermsModal } from '../../components/TermsModal';

interface ConstellationFooterProps {
  onOpenListening?: () => void;
  unreadListening?: number;
}

export const ConstellationFooter: React.FC<ConstellationFooterProps> = ({
  onOpenListening,
  unreadListening = 0,
}) => {
  const { brandName: appName, logoUrl, logoInitial } = usePlatformBrand();
  const [showTermsModal, setShowTermsModal] = useState<boolean>(false);
  const githubUrl = siteConfig.poweredByLink || 'https://github.com/datasch/Docentos';

  return (
    <footer className="w-full bg-transparent border-t border-slate-200 dark:border-white/[0.08] pt-8 sm:pt-12 pb-[calc(6rem+env(safe-area-inset-bottom,0px))] sm:pb-24 select-none">
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6">
        
        {/* Grilla Principal del Footer de DocentOS */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-6 sm:gap-8 pb-6 sm:pb-8 border-b border-slate-200 dark:border-white/[0.06]">
          
          {/* Columna Izquierda: Logo, Nombre y Motto de DocentOS */}
          <div className="lg:col-span-5 flex flex-col items-start gap-3">
            <div className="flex items-center gap-2.5">
              <span className="w-9 h-9 shrink-0 rounded-xl bg-gradient-to-tr from-[#06b6d4] via-[#8b5cf6] to-[#ec4899] p-[1.5px] flex items-center justify-center relative overflow-visible">
                {logoUrl ? (
                  <img
                    src={logoUrl === DEFAULT_LOGO_URL ? '/logo-64.avif' : logoUrl}
                    srcSet={logoUrl === DEFAULT_LOGO_URL ? '/logo-64.avif 64w, /logo.avif 256w' : undefined}
                    sizes={logoUrl === DEFAULT_LOGO_URL ? '36px' : undefined}
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
              <span className="min-w-0 break-words font-constellation-display text-xl font-semibold tracking-tight text-slate-900 dark:text-white">
                {appName}
                <span className="text-[#06b6d4]">.</span>
              </span>
            </div>
            
            <p className="font-constellation-body text-xs sm:text-sm text-slate-600 dark:text-slate-300 max-w-sm leading-relaxed font-extralight">
              {siteConfig.appTagline || 'Plataforma e-Learning Open Source de alto rendimiento'}
            </p>
          </div>

          {/* Columna Derecha: Enlaces Rápidos */}
          <nav aria-label="Enlaces del pie de página" className="lg:col-span-7 grid grid-cols-[minmax(0,1fr)_44px] items-start gap-4 text-xs text-slate-700 dark:text-slate-300">
            <div className="flex min-w-0 flex-col sm:flex-row sm:flex-wrap lg:justify-end gap-x-6 [&>a]:min-h-11 [&>button]:min-h-11 [&_svg]:shrink-0">
              <a href={githubUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:text-slate-900 dark:hover:text-white transition-colors">
                <Github aria-hidden className="h-4 w-4" />
                <span>GitHub</span>
              </a>
              <button type="button" onClick={() => setShowTermsModal(true)} className="flex items-center gap-2 text-left hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer">
                <ShieldCheck aria-hidden className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                <span className="min-w-0 break-words">Términos y privacidad</span>
              </button>
              {siteConfig.complaintsBookUrl && (
                <a href={siteConfig.complaintsBookUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:text-slate-900 dark:hover:text-white transition-colors">
                  <BookOpen aria-hidden className="h-4 w-4" />
                  <span>Libro de Reclamaciones</span>
                </a>
              )}
            </div>
            <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} aria-label="Volver arriba" title="Volver arriba" className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition-colors hover:border-cyan-500 hover:text-cyan-600 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300 dark:hover:text-cyan-300">
              <ArrowUp aria-hidden className="h-4 w-4" />
            </button>
          </nav>

          {onOpenListening && (
            <button type="button" onClick={onOpenListening} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-cyan-500/30 bg-cyan-500/5 px-4 py-3 text-sm font-semibold text-cyan-700 dark:text-cyan-300 sm:hidden">
              <HeartHandshake aria-hidden className="h-5 w-5 shrink-0" />
              <span>Buzón de escucha</span>
              {unreadListening > 0 && <span className="rounded-full bg-cyan-600 px-2 py-0.5 text-xs text-white">{unreadListening}<span className="sr-only"> respuestas sin leer</span></span>}
            </button>
          )}

        </div>

        {/* Barra Inferior del Footer con Copyright y Versión */}
        <div className="flex flex-col lg:flex-row items-start justify-between gap-5 pt-5 sm:pt-6 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
          <div className="flex min-w-0 flex-col items-start gap-1.5">
            <span>© {new Date().getFullYear()} {appName}. Todos los derechos reservados.</span>
          </div>

          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 text-slate-600 dark:text-slate-300">
            <span className="flex shrink-0 items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/[0.08] text-slate-700 dark:text-slate-200">
              <CheckCircle2 className="h-3.5 w-3.5 text-[#06b6d4]" />
              <span>v{DOCENTOS_VERSION}</span>
            </span>
            <span className="min-w-0 break-words">{siteConfig.authorCredit || 'DocentOS Community Edition'}</span>
          </div>
        </div>

      </div>

      {/* Modal de Términos y Condiciones */}
      <TermsModal isOpen={showTermsModal} onClose={() => setShowTermsModal(false)} />
    </footer>
  );
};
