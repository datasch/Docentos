import React, { useState, useEffect, useRef } from 'react';
import { User, Course } from '../../types';
import {
  GraduationCap,
  BookOpen,
  Users,
  Search,
  LogOut,
  Shield,
  Sun,
  Moon,
  Home,
  Bot,
  Award,
  HeartHandshake,
  KeyRound,
  ChevronDown,
  Globe,
  Sparkles,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getCurrentColorMode, toggleColorMode, ColorMode } from '../../lib/themeApplicator';
import { getSeasonalTheme, SeasonalTheme } from '../../lib/seasonalTheme';
import { avatarSrc } from '../../lib/avatar';
import { usePlatformBrand, DEFAULT_LOGO_URL } from '../../lib/logoConfig';

export type ConstellationTab = 'explore' | 'learning' | 'courses' | 'viewer' | 'mentor' | 'admin';

const LANGUAGES = [
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'en', label: 'English', flag: '🇺🇸' },
  { code: 'pt', label: 'Português', flag: '🇧🇷' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'it', label: 'Italiano', flag: '🇮🇹' },
];

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'ADMIN',
  MENTOR: 'MENTOR',
  MENTEE: 'MENTEE',
  VIP: 'VIP',
  PUBLIC_USER: 'ESTUDIANTE',
  EXTERNAL: 'INVITADO',
};

function initialsOf(name?: string | null): string {
  if (!name) return 'U';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'U';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

interface ConstellationNavbarProps {
  currentUser: User | null;
  courses: Course[];
  activeCourse: Course | null;
  activeTab: ConstellationTab;
  hasAccess?: boolean;
  onSelectTab: (tab: ConstellationTab) => void;
  onOpenAuth: () => void;
  onLogout: () => void;
  onRestartTour?: () => void;
  onOpenVerifyModal?: () => void;
  onOpenListening?: () => void;
  onChangePassword?: () => void;
  unreadListening?: number;
}

export const ConstellationNavbar: React.FC<ConstellationNavbarProps> = ({
  currentUser,
  courses,
  activeCourse,
  activeTab,
  hasAccess = false,
  onSelectTab,
  onOpenAuth,
  onLogout,
  onRestartTour,
  onOpenVerifyModal,
  onOpenListening,
  onChangePassword,
  unreadListening = 0,
}) => {
  const { t, i18n } = useTranslation();
  const [isScrolled, setIsScrolled] = useState(false);
  const [colorMode, setColorModeState] = useState<ColorMode>(getCurrentColorMode());
  const [seasonalTheme, setSeasonalThemeState] = useState<SeasonalTheme>(getSeasonalTheme());
  const [profileOpen, setProfileOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);

  const profileRef = useRef<HTMLDivElement>(null);
  const langRef = useRef<HTMLDivElement>(null);

  const currentLangCode = (i18n.language || 'es').substring(0, 2).toUpperCase();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 30);
    };
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const handleThemeChange = (e: any) => {
      if (e.detail?.colorMode) setColorModeState(e.detail.colorMode);
      else setColorModeState(getCurrentColorMode());
    };
    window.addEventListener('docentos-theme-change', handleThemeChange);
    return () => window.removeEventListener('docentos-theme-change', handleThemeChange);
  }, []);

  useEffect(() => {
    const handleSeasonalChange = (e: any) => {
      if (e.detail?.theme) setSeasonalThemeState(e.detail.theme);
      else setSeasonalThemeState(getSeasonalTheme());
    };
    window.addEventListener('docentos-seasonal-change', handleSeasonalChange);
    return () => window.removeEventListener('docentos-seasonal-change', handleSeasonalChange);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (profileRef.current && !profileRef.current.contains(target)) {
        setProfileOpen(false);
      }
      if (langRef.current && !langRef.current.contains(target)) {
        setLangOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setProfileOpen(false);
        setLangOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleLanguageSelect = (langCode: string) => {
    i18n.changeLanguage(langCode);
    localStorage.setItem('giantucchi_lang', langCode);
    setLangOpen(false);
  };

  const handleToggleTheme = () => {
    const next = toggleColorMode();
    setColorModeState(next);
  };

  const isStaff = currentUser && (currentUser.role === 'ADMIN' || currentUser.role === 'MENTOR');
  const isAdmin = currentUser && currentUser.role === 'ADMIN';

  const getRoleLabel = (role: string) => {
    if (role === 'PUBLIC_USER') return t('nav.roles.student', 'ESTUDIANTE');
    if (role === 'EXTERNAL') return t('nav.roles.guest', 'INVITADO');
    return ROLE_LABELS[role] || role;
  };

  const accessNote = isAdmin
    ? { label: t('nav.accessTotal', 'Acceso total'), tone: 'lp-tone-accent' }
    : currentUser?.role === 'VIP'
      ? { label: t('nav.accessUnlimited', '¡Ilimitado!'), tone: 'lp-tone-gold' }
      : isStaff
        ? { label: t('nav.accessMentor', 'Acceso de mentor'), tone: 'lp-tone-cyan' }
        : hasAccess
          ? { label: t('nav.accessActive', 'Acceso activo'), tone: 'lp-tone-green' }
          : { label: currentUser?.role === 'EXTERNAL' ? t('nav.noCoursesPurchased', 'Sin cursos adquiridos') : t('nav.noAccess', 'Sin acceso'), tone: 'lp-tone-warn' };

  const { logoUrl: customLogoUrl, brandName } = usePlatformBrand();

  return (
    <header
      className={`lp-header constellation-navbar sticky top-0 z-50 w-full transition-[background-color,border-color,box-shadow] duration-200 select-none py-3 sm:py-3.5 ${isScrolled
        ? 'bg-surface border-b border-line shadow-sm'
        : 'bg-surface border-b border-line'
        }`}
    >
      <div className="academy-nav-layout max-w-[1280px] w-full mx-auto px-3 sm:px-6 flex min-h-11 items-center justify-between gap-2 sm:gap-6 min-w-0">

        {/* 1. Logo Lockup con soporte para logo personalizado y adorno festivo */}
        <button
          onClick={() => {
            onSelectTab('explore');
            if (activeTab === 'explore') window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className="academy-nav-brand flex items-center gap-2 sm:gap-3 group text-left cursor-pointer select-none bg-transparent border-0 p-0 min-w-0 shrink relative"
        >
          {/* Logo Mark Oficial o Personalizado del Campus */}
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-105 relative">
            <img
              src={customLogoUrl === DEFAULT_LOGO_URL ? '/logo-64.avif' : customLogoUrl}
              srcSet={customLogoUrl === DEFAULT_LOGO_URL ? '/logo-64.avif 64w, /logo.avif 256w' : undefined}
              sizes={customLogoUrl === DEFAULT_LOGO_URL ? '32px' : undefined}
              width={32}
              height={32}
              alt={brandName}
              className="w-full h-full object-contain filter drop-shadow-[0_0_12px_rgba(128,82,255,0.4)]"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = DEFAULT_LOGO_URL;
              }}
            />
            {/* Adorno Festivo sobre el Logo */}
            {seasonalTheme === 'halloween' && (
              <span className="absolute -top-2.5 -right-2 text-xs filter drop-shadow-[0_0_6px_rgba(249,115,22,0.8)] animate-bounce" title="¡Feliz Halloween!">
                🎃
              </span>
            )}
            {seasonalTheme === 'christmas' && (
              <span className="absolute -top-2.5 -right-2 text-xs filter drop-shadow-[0_0_6px_rgba(239,68,68,0.8)] animate-pulse" title="¡Feliz Navidad!">
                🎅
              </span>
            )}
          </div>

          {/* Wordmark tipográfico estable sin reflow en scroll */}
          <div className="academy-nav-wordmark flex items-center min-w-0">
            <span
              title={brandName}
              className="font-constellation-display text-base sm:text-[22px] tracking-[-0.03em] text-slate-900 dark:text-white font-normal truncate block"
            >
              {brandName}
            </span>
          </div>
        </button>

        {/* 2. Navegación Principal Fantasma (Mayúsculas 13px weight 600, tracking 0.05em estilo Dala) */}
        <nav aria-label="Navegación principal" className="academy-navigation hidden xl:flex items-center gap-5 2xl:gap-7 font-constellation-label text-[13px] tracking-[0.05em] uppercase font-semibold">
          <button
            onClick={() => {
              onSelectTab('explore');
              if (activeTab === 'explore') window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            aria-current={activeTab === 'explore' ? 'page' : undefined}
            className={`transition-colors duration-200 cursor-pointer whitespace-nowrap ${activeTab === 'explore'
              ? 'text-slate-900 dark:text-white font-bold'
              : 'text-slate-500 dark:text-[#9a9a9a] hover:text-slate-900 dark:hover:text-white'
              }`}
          >
            <Home size={18} aria-hidden="true" /><span>{t('nav.home', 'Inicio')}</span>
          </button>

          <button
            onClick={() => {
              onSelectTab('courses');
              if (activeTab === 'courses') window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            aria-current={activeTab === 'courses' ? 'page' : undefined}
            className={`transition-colors duration-200 cursor-pointer whitespace-nowrap ${activeTab === 'courses'
              ? 'text-slate-900 dark:text-white font-bold'
              : 'text-slate-500 dark:text-[#9a9a9a] hover:text-slate-900 dark:hover:text-white'
              }`}
          >
            <BookOpen size={18} aria-hidden="true" /><span>{t('nav.catalog', 'Catálogo')}</span>
          </button>

          <button
            onClick={() => {
              onSelectTab('learning');
              if ((activeTab === 'learning' || activeTab === 'viewer')) window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            aria-current={(activeTab === 'learning' || activeTab === 'viewer') ? 'page' : undefined}
            className={`transition-colors duration-200 cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${(activeTab === 'learning' || activeTab === 'viewer')
              ? 'text-slate-900 dark:text-white font-bold'
              : 'text-slate-500 dark:text-[#9a9a9a] hover:text-slate-900 dark:hover:text-white'
              }`}
          >
            <GraduationCap size={18} aria-hidden="true" /><span>{t('nav.myLearning', 'Mi aprendizaje')}</span>
          </button>

          {isStaff && (
            <button
              onClick={() => onSelectTab('mentor')}
              aria-current={activeTab === 'mentor' ? 'page' : undefined}
            className={`transition-colors duration-200 cursor-pointer whitespace-nowrap ${activeTab === 'mentor'
                ? 'text-slate-900 dark:text-white font-bold'
                : 'text-slate-500 dark:text-[#9a9a9a] hover:text-slate-900 dark:hover:text-white'
                }`}
            >
              <Users size={18} aria-hidden="true" /><span>{t('nav.mentorship', 'Mentoría')}</span>
            </button>
          )}

          {isAdmin && (
            <button
              onClick={() => onSelectTab('admin')}
              aria-current={activeTab === 'admin' ? 'page' : undefined}
            className={`transition-colors duration-200 cursor-pointer flex items-center gap-1 whitespace-nowrap ${activeTab === 'admin'
                ? 'text-slate-900 dark:text-white font-bold'
                : 'text-slate-500 dark:text-[#9a9a9a] hover:text-slate-900 dark:hover:text-white'
                }`}
            >
              <Shield className="w-3.5 h-3.5 text-amber-600 dark:text-[#eab308]" />
              <span>{t('nav.admin', 'Admin')}</span>
            </button>
          )}
        </nav>

        {/* 3. Acciones Derechas: Idioma + Modo Claro/Oscuro + Command Palette + Perfil con Desplegable */}
        <div className="academy-nav-actions flex items-center gap-1.5 sm:gap-3 shrink-0">

          {/* Selector de idioma */}
          <div className="lp-menu-anchor" ref={langRef}>
            <button
              type="button"
              className="flex items-center justify-center gap-1.5 min-h-11 min-w-11 px-2 sm:px-2.5 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] text-slate-700 dark:text-white/70 hover:text-slate-900 dark:hover:text-white text-xs transition-all border border-slate-200 dark:border-white/[0.06] cursor-pointer"
              onClick={() => {
                setLangOpen((open) => !open);
                setProfileOpen(false);
              }}
              aria-haspopup="menu"
              aria-expanded={langOpen}
              title={t('nav.language', 'Idioma')}
            >
              <Globe className="w-3.5 h-3.5 text-slate-500 dark:text-white/50" />
              <span className="hidden sm:inline font-semibold text-[11px]">{currentLangCode}</span>
              <ChevronDown className="hidden sm:block w-3 h-3 text-slate-400" />
            </button>

            {langOpen && (
              <div className="lp-menu" role="menu">
                {LANGUAGES.map((lang) => (
                  <button
                    key={lang.code}
                    type="button"
                    role="menuitem"
                    onClick={() => handleLanguageSelect(lang.code)}
                    className={`lp-menu-item${(i18n.language || 'es').startsWith(lang.code) ? ' is-active' : ''}`}
                  >
                    <span className="lp-menu-item-left">
                      <span aria-hidden>{lang.flag}</span>
                      <span>{lang.label}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Botón Selector Modo Claro / Modo Oscuro */}
          <button
            onClick={handleToggleTheme}
            title={colorMode === 'dark' ? t('nav.themeLight', 'Modo Blanco / Claro') : t('nav.themeDark', 'Modo Oscuro')}
            className="inline-flex min-h-11 min-w-11 items-center justify-center p-2 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] text-slate-600 dark:text-white/60 hover:text-slate-900 dark:hover:text-white transition-all border border-slate-200 dark:border-white/[0.06] cursor-pointer"
          >
            {colorMode === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-slate-700" />
            )}
          </button>

          {/* Perfil de usuario con menú desplegable (matching diseño oficial DocentOS) */}
          {currentUser ? (
            <div className="lp-menu-anchor" ref={profileRef}>
              <button
                type="button"
                className="lp-user-profile flex min-h-11 items-center gap-1.5 p-0.5 rounded-full hover:opacity-90 transition-all cursor-pointer border-0 bg-transparent"
                onClick={() => {
                  setProfileOpen((prev) => !prev);
                  setLangOpen(false);
                }}
                aria-haspopup="menu"
                aria-expanded={profileOpen}
                aria-label={t('nav.accountMenu', 'Menú de cuenta')}
              >
                <span className="lp-avatar-wrapper relative w-9 h-9 shrink-0 rounded-full block">
                  {currentUser.avatarUrl ? (
                    <img className="lp-avatar-img w-full h-full rounded-full object-cover" src={avatarSrc(currentUser.avatarUrl)} alt={currentUser.name || ''} />
                  ) : (
                    <span className="lp-avatar-fallback w-full h-full rounded-full flex items-center justify-center">{initialsOf(currentUser.name || currentUser.email)}</span>
                  )}
                  <span className="lp-status-badge" title={t('nav.online', 'En línea')} />
                </span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-slate-400 dark:text-white/50 transition-transform duration-200 ${profileOpen ? 'rotate-180' : ''
                    }`}
                />
              </button>

              {profileOpen && (
                <div className="lp-menu" role="menu">
                  <div className="lp-menu-head">
                    <span className="lp-menu-name">{currentUser.name || currentUser.email}</span>
                    <span className="lp-menu-role">{getRoleLabel(currentUser.role)}</span>
                  </div>

                  {/* Secciones de navegación en móviles dentro del menú */}
                  <div className="xl:hidden py-1 border-b border-slate-100 dark:border-white/[0.06]">
                    <button
                      type="button"
                      role="menuitem"
                      className={`lp-menu-item ${activeTab === 'explore' ? 'is-active text-[#06b6d4] font-bold' : ''}`}
                      onClick={() => {
                        setProfileOpen(false);
                        onSelectTab('explore');
                        if (activeTab === 'explore') window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                    >
                      <span className="lp-menu-item-left">
                        <Home className="w-4 h-4 text-[#06b6d4]" />
                        <span>{t('nav.home', 'Inicio')}</span>
                      </span>
                    </button>

                    <button
                      type="button"
                      role="menuitem"
                      className={`lp-menu-item ${activeTab === 'courses' ? 'is-active text-[#06b6d4] font-bold' : ''}`}
                      onClick={() => {
                        setProfileOpen(false);
                        onSelectTab('courses');
                        if (activeTab === 'courses') window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                    >
                      <span className="lp-menu-item-left">
                        <Search className="w-4 h-4 text-[#06b6d4]" />
                        <span>{t('nav.catalog', 'Catálogo')}</span>
                      </span>
                    </button>

                    <button
                      type="button"
                      role="menuitem"
                      className={`lp-menu-item ${(activeTab === 'learning' || activeTab === 'viewer') ? 'is-active text-[#06b6d4] font-bold' : ''}`}
                      onClick={() => {
                        setProfileOpen(false);
                        onSelectTab('learning');
                        if ((activeTab === 'learning' || activeTab === 'viewer')) window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                    >
                      <span className="lp-menu-item-left">
                        <GraduationCap className="w-4 h-4 text-brand-cyan" />
                        <span>{t('nav.myLearning', 'Mi aprendizaje')}</span>
                      </span>
                    </button>

                    {isStaff && (
                      <button
                        type="button"
                        role="menuitem"
                        className={`lp-menu-item ${activeTab === 'mentor' ? 'is-active text-[#a855f7] font-bold' : ''}`}
                        onClick={() => {
                          setProfileOpen(false);
                          onSelectTab('mentor');
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                      >
                        <span className="lp-menu-item-left">
                          <Sparkles className="w-4 h-4 text-[#a855f7]" />
                          <span>{t('nav.mentorship', 'Mentoría')}</span>
                        </span>
                      </button>
                    )}

                    {isAdmin && (
                      <button
                        type="button"
                        role="menuitem"
                        className={`lp-menu-item ${activeTab === 'admin' ? 'is-active text-[#eab308] font-bold' : ''}`}
                        onClick={() => {
                          setProfileOpen(false);
                          onSelectTab('admin');
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                      >
                        <span className="lp-menu-item-left">
                          <Shield className="w-4 h-4 text-[#eab308]" />
                          <span>{t('nav.administration', 'Administración')}</span>
                        </span>
                      </button>
                    )}
                  </div>

                  {onRestartTour && (
                    <button
                      type="button"
                      role="menuitem"
                      className="lp-menu-item"
                      onClick={() => {
                        setProfileOpen(false);
                        onRestartTour();
                      }}
                    >
                      <span className="lp-menu-item-left">
                        <Bot className="w-4 h-4" />
                        {t('nav.restartTour', 'Asistente Ian (Tour)')}
                      </span>
                    </button>
                  )}

                  {onOpenVerifyModal && (
                    <button
                      type="button"
                      role="menuitem"
                      className="lp-menu-item"
                      onClick={() => {
                        setProfileOpen(false);
                        onOpenVerifyModal();
                      }}
                    >
                      <span className="lp-menu-item-left">
                        <Award className="w-4 h-4" />
                        {t('nav.verifyDiploma', 'Verificar diploma')}
                      </span>
                    </button>
                  )}

                  {onOpenListening && (
                    <button
                      type="button"
                      role="menuitem"
                      className="lp-menu-item"
                      onClick={() => {
                        setProfileOpen(false);
                        onOpenListening();
                      }}
                    >
                      <span className="lp-menu-item-left">
                        <HeartHandshake className="w-4 h-4" />
                        {t('nav.listeningBox', 'Buzón de escucha')}
                      </span>
                      {unreadListening > 0 && (
                        <span className="lp-badge-premium" title="Tienes respuestas nuevas">
                          {unreadListening}
                        </span>
                      )}
                    </button>
                  )}

                  {onChangePassword && (
                    <button
                      type="button"
                      role="menuitem"
                      className="lp-menu-item"
                      onClick={() => {
                        setProfileOpen(false);
                        onChangePassword();
                      }}
                    >
                      <span className="lp-menu-item-left">
                        <KeyRound className="w-4 h-4" />
                        {t('nav.accountSecurity', 'Seguridad de la cuenta')}
                      </span>
                    </button>
                  )}

                  <button
                    type="button"
                    role="menuitem"
                    className="lp-menu-item"
                    onClick={() => {
                      handleToggleTheme();
                    }}
                  >
                    <span className="lp-menu-item-left">
                      {colorMode === 'dark' ? (
                        <>
                          <Sun className="w-4 h-4 text-amber-400" />
                          <span>{t('nav.themeLight', 'Modo Blanco / Claro')}</span>
                        </>
                      ) : (
                        <>
                          <Moon className="w-4 h-4 text-cyan-500" />
                          <span>{t('nav.themeDark', 'Modo Oscuro')}</span>
                        </>
                      )}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-white/[0.08] border border-slate-200 dark:border-white/[0.08] text-slate-600 dark:text-white/70">
                      {colorMode === 'dark' ? t('nav.dark', 'Oscuro') : t('nav.light', 'Claro')}
                    </span>
                  </button>

                  <p className="lp-menu-note">
                    <span>{t('nav.accessStatus', 'Estado de Acceso')}</span>
                    <strong className={accessNote.tone}>{accessNote.label}</strong>
                  </p>

                  <button
                    type="button"
                    role="menuitem"
                    className="lp-menu-item is-danger"
                    onClick={() => {
                      setProfileOpen(false);
                      onLogout();
                    }}
                  >
                    <span className="lp-menu-item-left">
                      <LogOut className="w-4 h-4" />
                      {t('nav.logout', 'Cerrar Sesión')}
                    </span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={onOpenAuth}
              className="academy-button px-3 sm:px-6"
            >
              <span>{t('nav.loginButton', 'Acceder')}</span>
            </button>
          )}

        </div>

      </div>

    </header>
  );
};
