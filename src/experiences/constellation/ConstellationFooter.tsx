import { useLandingConfig } from '../../lib/landingConfig';
import React, { useEffect, useRef, useState, Suspense, lazy } from 'react';
import { useTranslation } from 'react-i18next';
import { siteConfig } from '../../config/theme';
import { usePlatformBrand, DEFAULT_LOGO_URL } from '../../lib/logoConfig';
import { FestiveHatOverlay } from '../../components/FestiveHatOverlay';
import { useSeasonalTheme } from '../../lib/seasonalTheme';
import { DOCENTOS_VERSION } from '../../version';
import { CheckCircle2, Github, BookOpen, ShieldCheck, HeartHandshake, ArrowUp } from 'lucide-react';

const TermsModal = lazy(() =>
  Promise.all([
    import('../../styles/terms-paper.css'),
    import('../../components/TermsModal'),
  ]).then(([, m]) => ({ default: m.TermsModal }))
);

interface ConstellationFooterProps {
  onOpenListening?: () => void;
  unreadListening?: number;
  /** El buzón flotante se cerró: vive aquí, a la izquierda de GitHub. */
  listeningDocked?: boolean;
}

export const ConstellationFooter: React.FC<ConstellationFooterProps> = ({
  onOpenListening,
  unreadListening = 0,
  listeningDocked = false,
}) => {
  const { t } = useTranslation();
  const { brandName: appName, logoUrl, logoInitial } = usePlatformBrand();
  const seasonalTheme = useSeasonalTheme();
  const [showTermsModal, setShowTermsModal] = useState<boolean>(false);
  const custom = useLandingConfig();
  const githubUrl = custom.githubUrl || siteConfig.poweredByLink || 'https://github.com/datasch/Docentos';
  const socials = [
    { url: custom.discordUrl, label: 'Discord' },
    { url: custom.twitterUrl, label: 'X' },
    { url: custom.linkedinUrl, label: 'LinkedIn' },
  ].filter((item): item is { url: string; label: string } => Boolean(item.url));
  // Solo se anima la llegada cuando se acopla en esta visita, no al recargar.
  const wasDocked = useRef(listeningDocked);
  const [justDocked, setJustDocked] = useState(false);
  useEffect(() => {
    if (listeningDocked && !wasDocked.current) setJustDocked(true);
    wasDocked.current = listeningDocked;
  }, [listeningDocked]);

  return (
    <footer className="relative overflow-hidden w-full bg-transparent border-t border-slate-200 dark:border-white/[0.08] pt-8 sm:pt-12 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] sm:pb-8 select-none">
      <div className="relative z-10 max-w-[1280px] mx-auto px-4 sm:px-6">
        
        {/* Grilla Principal del Footer de DocentOS */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-6 sm:gap-8 pb-6 sm:pb-8 border-b border-slate-200 dark:border-white/[0.06]">
          
          {/* Columna Izquierda: Logo, Nombre y Motto de DocentOS */}
          <div className="lg:col-span-5 flex flex-col items-start gap-3">
            <div className="flex items-center gap-2.5">
              <span className="footer-logo-frame w-9 h-9 shrink-0 rounded-xl bg-gradient-to-tr from-[var(--color-brand-cyan)] via-[#8b5cf6] to-[#ec4899] p-[1.5px] flex items-center justify-center relative overflow-visible">
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
                <span className="text-[var(--color-brand-cyan)]">.</span>
              </span>
            </div>
            
            <p className="font-constellation-body text-xs sm:text-sm text-slate-600 dark:text-slate-300 max-w-sm leading-relaxed font-extralight">
              {siteConfig.appTagline || t('plataformaElearningOpenSourceDeAlto', 'Plataforma e-Learning Open Source de alto rendimiento')}
            </p>
          </div>

          {/* Columna Derecha: Enlaces Rápidos */}
          <nav aria-label={t('enlacesDelPieDePagina', 'Enlaces del pie de página')} className="lg:col-span-7 grid grid-cols-[minmax(0,1fr)_44px] items-start gap-4 text-xs text-slate-700 dark:text-slate-300">
            <div className="flex min-w-0 flex-col sm:flex-row sm:flex-wrap lg:justify-end gap-x-6 [&>a]:min-h-11 [&>button]:min-h-11 [&_svg]:shrink-0">
              {onOpenListening && listeningDocked && (
                <button
                  type="button"
                  onClick={onOpenListening}
                  onAnimationEnd={() => setJustDocked(false)}
                  aria-label={unreadListening > 0 ? t('footer.listeningBoxUnread', { count: unreadListening, defaultValue_one: 'Abrir Buzón de escucha, tienes {{count}} respuesta sin leer', defaultValue_other: 'Abrir Buzón de escucha, tienes {{count}} respuestas sin leer' }) : t('footer.listeningBox', 'Buzón de escucha')}
                  className={`footer-listening-dock hidden sm:flex items-center gap-2 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer ${justDocked ? 'footer-listening-dock--landing' : ''}`}
                >
                  <HeartHandshake aria-hidden className="h-4 w-4 text-brand-cyan dark:text-brand-cyan" />
                  <span>{t('footer.listeningBox', 'Buzón de escucha')}</span>
                  {unreadListening > 0 && (
                    <span aria-hidden className="min-w-[18px] rounded-full bg-amber-500 px-1.5 py-px text-center text-[10px] font-bold leading-4 text-white">
                      {unreadListening > 99 ? '99+' : unreadListening}
                    </span>
                  )}
                </button>
              )}
              <a href={githubUrl} target="_blank" rel="noopener noreferrer" data-footer-github className="flex items-center gap-2 hover:text-slate-900 dark:hover:text-white transition-colors">
                <Github aria-hidden className="h-4 w-4" />
                <span>{t('github', 'GitHub')}</span>
              </a>
              {socials.map((item) => (
                <a key={item.label} href={item.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:text-slate-900 dark:hover:text-white transition-colors">
                  <span>{item.label}</span>
                </a>
              ))}
              <button type="button" onClick={() => setShowTermsModal(true)} className="flex items-center gap-2 text-left hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer">
                <ShieldCheck aria-hidden className="h-4 w-4 text-brand-cyan dark:text-brand-cyan" />
                <span className="min-w-0 break-words">{t('footer.termsAndPrivacy', 'Términos y privacidad')}</span>
              </button>
              {siteConfig.complaintsBookUrl && (
                <a href={siteConfig.complaintsBookUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:text-slate-900 dark:hover:text-white transition-colors">
                  <BookOpen aria-hidden className="h-4 w-4" />
                  <span>{t('footer.complaintsBook', 'Libro de Reclamaciones')}</span>
                </a>
              )}
            </div>
            <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} aria-label={t('footer.backToTop', 'Volver arriba')} title={t('footer.backToTop', 'Volver arriba')} className="flex h-11 w-11 items-center justify-center rounded-full border border-line bg-surface text-ink-muted transition-colors hover:border-brand-cyan hover:text-brand-cyan dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300 dark:hover:text-brand-cyan">
              <ArrowUp aria-hidden className="h-4 w-4" />
            </button>
          </nav>

          {onOpenListening && (
            <button type="button" onClick={onOpenListening} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-brand-cyan/30 bg-brand-cyan/5 px-4 py-3 text-sm font-semibold text-brand-cyan dark:text-brand-cyan sm:hidden">
              <HeartHandshake aria-hidden className="h-5 w-5 shrink-0" />
              <span>{t('footer.listeningBox', 'Buzón de escucha')}</span>
              {unreadListening > 0 && <span className="rounded-full bg-brand-cyan px-2 py-0.5 text-xs text-white">{unreadListening}<span className="sr-only"> {t('footer.unreadResponses', 'respuestas sin leer')}</span></span>}
            </button>
          )}

        </div>

        {/* Barra Inferior del Footer con Copyright y Versión */}
        <div className="flex flex-col lg:flex-row items-start justify-between gap-5 pt-5 sm:pt-6 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
          <div className="flex min-w-0 flex-col items-start gap-1.5">
            <span>© {new Date().getFullYear()} {appName}. {t('footer.rightsReserved', 'Todos los derechos reservados.')}</span>
          </div>

          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 text-slate-600 dark:text-slate-300">
            <span className="flex shrink-0 items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/[0.08] text-slate-700 dark:text-slate-200">
              <CheckCircle2 className="h-3.5 w-3.5 text-[var(--color-brand-cyan)]" />
              <span>v{DOCENTOS_VERSION}</span>
            </span>
            <span className="min-w-0 break-words">{custom.footerText || siteConfig.authorCredit || t('docentosCommunityEdition', 'DocentOS Community Edition')}</span>
          </div>
        </div>

      </div>

      {/* Montaña de nieve navideña en la base del footer */}
      {seasonalTheme === 'christmas' && (
        <div className="christmas-footer-snow" aria-hidden="true">
          <svg viewBox="0 0 1440 90" preserveAspectRatio="none">
            <defs>
              <linearGradient id="footerSnowBack" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" style={{ stopColor: 'var(--christmas-snow-back-start, rgba(224,242,254,0.65))' }} />
                <stop offset="100%" style={{ stopColor: 'var(--christmas-snow-back-end, rgba(191,219,254,0.4))' }} />
              </linearGradient>
              <linearGradient id="footerSnowFront" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" style={{ stopColor: 'var(--christmas-snow-front-start, rgba(255,255,255,0.92))' }} />
                <stop offset="100%" style={{ stopColor: 'var(--christmas-snow-front-end, rgba(224,242,254,0.82))' }} />
              </linearGradient>
            </defs>
            <path
              d="M0,90 L0,46 C110,16 215,54 345,44 C470,34 555,14 685,38 C815,62 925,22 1065,36 C1205,50 1320,18 1440,42 L1440,90 Z"
              fill="url(#footerSnowBack)"
              stroke="var(--christmas-snow-stroke, transparent)"
              strokeWidth="1"
            />
            <path
              d="M0,90 L0,62 C135,38 250,70 390,58 C530,46 655,28 790,56 C925,84 1060,40 1200,56 C1305,68 1375,44 1440,58 L1440,90 Z"
              fill="url(#footerSnowFront)"
              stroke="var(--christmas-snow-stroke, transparent)"
              strokeWidth="1"
            />
          </svg>
        </div>
      )}

      {/* Modal de Términos y Condiciones */}
      {showTermsModal && (
        <Suspense fallback={null}>
          <TermsModal isOpen={showTermsModal} onClose={() => setShowTermsModal(false)} />
        </Suspense>
      )}
    </footer>
  );
};
