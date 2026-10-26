import React, { useState, useEffect, useRef } from 'react';
import { User, Course } from '../../types';
import {
  Command,
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

export type ConstellationTab = 'explore' | 'search' | 'courses' | 'viewer' | 'mentor' | 'admin';

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
  // Atajo global ⌘K o Ctrl+K para abrir búsqueda sináptica
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onSelectTab('search');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onSelectTab]);
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

  const accessNote = isAdmin
    ? { label: 'Acceso total', tone: 'lp-tone-accent' }
    : currentUser?.role === 'VIP'
      ? { label: '¡Ilimitado!', tone: 'lp-tone-gold' }
      : isStaff
        ? { label: 'Acceso de mentor', tone: 'lp-tone-cyan' }
        : hasAccess
          ? { label: '¡Ilimitado!', tone: 'lp-tone-green' }
          : { label: 'Sin acceso', tone: 'lp-tone-warn' };

  const { logoUrl: customLogoUrl, brandName } = usePlatformBrand();

  return (
    <header
      className={`lp-header sticky top-0 z-50 w-full transition-all duration-300 select-none ${isScrolled
        ? 'bg-white/95 dark:bg-[#07070b]/90 backdrop-blur-md border-b border-slate-200/80 dark:border-white/[0.06] shadow-sm py-2 sm:py-3.5'
        : 'bg-white/80 dark:bg-[#07070b]/80 md:bg-transparent backdrop-blur-md md:backdrop-blur-none border-b border-slate-200/60 dark:border-white/[0.06] md:border-transparent py-2.5 sm:py-5'
        }`}
    >
      <div className="max-w-[1280px] w-full mx-auto px-6 flex items-center justify-between gap-6">

        {/* 1. Logo Lockup con soporte para logo personalizado y adorno festivo */}
        <button
          onClick={() => {
            onSelectTab('explore');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className="flex items-center gap-3 group text-left cursor-pointer select-none bg-transparent border-0 p-0 shrink-0 relative"
        >
          {/* Logo Mark Oficial o Personalizado del Campus */}
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-105 relative">
            <img
              src={customLogoUrl}
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

          {/* Wordmark tipográfico que colapsa suavemente al hacer scroll */}
          <div
            className={`overflow-hidden transition-all duration-500 ease-out flex items-center ${isScrolled
              ? 'max-w-0 opacity-0 -translate-x-3 pointer-events-none'
              : 'max-w-[320px] opacity-100 translate-x-0'
              }`}
          >
            <span className="font-constellation-display text-[22px] tracking-[-0.03em] text-slate-900 dark:text-white font-normal whitespace-nowrap">
              {brandName}
            </span>
          </div>
        </button>

        {/* 2. Navegación Principal Fantasma (Mayúsculas 13px weight 600, tracking 0.05em estilo Dala) */}
        <nav className="hidden md:flex items-center gap-6 lg:gap-8 font-constellation-label text-[13px] tracking-[0.05em] uppercase font-semibold">
          <button
            onClick={() => {
              onSelectTab('explore');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className={`transition-colors duration-200 cursor-pointer whitespace-nowrap ${activeTab === 'explore'
              ? 'text-slate-900 dark:text-white font-bold'
              : 'text-slate-500 dark:text-[#9a9a9a] hover:text-slate-900 dark:hover:text-white'
              }`}
          >
            Explorar
          </button>

          <button
            onClick={() => {
              onSelectTab('courses');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className={`transition-colors duration-200 cursor-pointer whitespace-nowrap ${activeTab === 'courses'
              ? 'text-slate-900 dark:text-white font-bold'
              : 'text-slate-500 dark:text-[#9a9a9a] hover:text-slate-900 dark:hover:text-white'
              }`}
          >
            Catálogo
          </button>

          <button
            onClick={() => {
              onSelectTab('search');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className={`transition-colors duration-200 cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${activeTab === 'search'
              ? 'text-slate-900 dark:text-white font-bold'
              : 'text-slate-500 dark:text-[#9a9a9a] hover:text-slate-900 dark:hover:text-white'
              }`}
          >
            <span>Búsqueda</span>
          </button>

          {activeCourse && (
            <button
              onClick={() => onSelectTab('viewer')}
              title={activeCourse.title}
              className={`transition-colors duration-200 cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${activeTab === 'viewer'
                ? 'text-cyan-700 dark:text-white font-bold'
                : 'text-cyan-600 dark:text-[#06b6d4] hover:text-cyan-800 dark:hover:text-cyan-300'
                }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 dark:bg-[#06b6d4] animate-ping" />
              <span>En Curso</span>
            </button>
          )}

          {isStaff && (
            <button
              onClick={() => onSelectTab('mentor')}
              className={`transition-colors duration-200 cursor-pointer whitespace-nowrap ${activeTab === 'mentor'
                ? 'text-slate-900 dark:text-white font-bold'
                : 'text-slate-500 dark:text-[#9a9a9a] hover:text-slate-900 dark:hover:text-white'
                }`}
            >
              Mentoría
            </button>
          )}

          {isAdmin && (
            <button
              onClick={() => onSelectTab('admin')}
              className={`transition-colors duration-200 cursor-pointer flex items-center gap-1 whitespace-nowrap ${activeTab === 'admin'
                ? 'text-slate-900 dark:text-white font-bold'
                : 'text-slate-500 dark:text-[#9a9a9a] hover:text-slate-900 dark:hover:text-white'
                }`}
            >
              <Shield className="w-3.5 h-3.5 text-amber-600 dark:text-[#eab308]" />
              <span>Admin</span>
            </button>
          )}
        </nav>

        {/* 3. Acciones Derechas: Idioma + Modo Claro/Oscuro + Command Palette + Perfil con Desplegable */}
        <div className="flex items-center gap-2 sm:gap-3">

          {/* Selector de idioma */}
          <div className="lp-menu-anchor" ref={langRef}>
            <button
              type="button"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] text-slate-700 dark:text-white/70 hover:text-slate-900 dark:hover:text-white text-xs transition-all border border-slate-200 dark:border-white/[0.06] cursor-pointer"
              onClick={() => {
                setLangOpen((open) => !open);
                setProfileOpen(false);
              }}
              aria-haspopup="menu"
              aria-expanded={langOpen}
              title="Idioma"
            >
              <Globe className="w-3.5 h-3.5 text-slate-500 dark:text-white/50" />
              <span className="font-semibold text-[11px]">{currentLangCode}</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {langOpen && (
              <div className="lp-menu !bg-white dark:!bg-[#111119] !border-slate-200 dark:!border-white/10 !shadow-2xl" role="menu">
                {LANGUAGES.map((lang) => (
                  <button
                    key={lang.code}
                    type="button"
                    role="menuitem"
                    onClick={() => handleLanguageSelect(lang.code)}
                    className={`lp-menu-item${i18n.language.startsWith(lang.code) ? ' is-active' : ''}`}
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
            title={colorMode === 'dark' ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro'}
            className="p-2 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] text-slate-600 dark:text-white/60 hover:text-slate-900 dark:hover:text-white transition-all border border-slate-200 dark:border-white/[0.06] cursor-pointer"
          >
            {colorMode === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-slate-700" />
            )}
          </button>

          {/* Acceso directo Command Palette (⌘K) */}
          <button
            onClick={() => onSelectTab('search')}
            title="Abrir Command Palette (⌘K)"
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] text-slate-600 dark:text-white/50 hover:text-slate-900 dark:hover:text-white text-xs transition-all border border-slate-200 dark:border-white/[0.06] cursor-pointer"
          >
            <Command className="w-3 h-3 text-cyan-600 dark:text-[#06b6d4]" />
            <span className="font-mono text-[10px]">⌘K</span>
          </button>

          {/* Perfil de usuario con menú desplegable (matching diseño oficial DocentOS) */}
          {currentUser ? (
            <div className="lp-menu-anchor" ref={profileRef}>
              <button
                type="button"
                className="lp-user-profile flex items-center gap-1.5 p-0.5 rounded-full hover:opacity-90 transition-all cursor-pointer border-0 bg-transparent"
                onClick={() => {
                  setProfileOpen((prev) => !prev);
                  setLangOpen(false);
                }}
                aria-haspopup="menu"
                aria-expanded={profileOpen}
                aria-label="Menú de cuenta"
              >
                <span className="lp-avatar-wrapper">
                  {currentUser.avatarUrl ? (
                    <img className="lp-avatar-img" src={avatarSrc(currentUser.avatarUrl)} alt={currentUser.name || ''} />
                  ) : (
                    <span className="lp-avatar-fallback">{initialsOf(currentUser.name || currentUser.email)}</span>
                  )}
                  <span className="lp-status-badge" title="En línea" />
                </span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-slate-400 dark:text-white/50 transition-transform duration-200 ${profileOpen ? 'rotate-180' : ''
                    }`}
                />
              </button>

              {profileOpen && (
                <div className="lp-menu !bg-white dark:!bg-[#111119] !border-slate-200 dark:!border-white/10 !shadow-2xl" role="menu">
                  <div className="lp-menu-head">
                    <span className="lp-menu-name">{currentUser.name || currentUser.email}</span>
                    <span className="lp-menu-role">{ROLE_LABELS[currentUser.role] || currentUser.role}</span>
                  </div>

                  {/* Secciones de navegación en móviles dentro del menú */}
                  <div className="md:hidden py-1 border-b border-slate-100 dark:border-white/[0.06]">
                    <button
                      type="button"
                      role="menuitem"
                      className={`lp-menu-item ${activeTab === 'explore' ? 'is-active text-[#06b6d4] font-bold' : ''}`}
                      onClick={() => {
                        setProfileOpen(false);
                        onSelectTab('explore');
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                    >
                      <span className="lp-menu-item-left">
                        <Home className="w-4 h-4 text-[#06b6d4]" />
                        <span>Explorar</span>
                      </span>
                    </button>

                    <button
                      type="button"
                      role="menuitem"
                      className={`lp-menu-item ${activeTab === 'courses' ? 'is-active text-[#06b6d4] font-bold' : ''}`}
                      onClick={() => {
                        setProfileOpen(false);
                        onSelectTab('courses');
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                    >
                      <span className="lp-menu-item-left">
                        <Search className="w-4 h-4 text-[#06b6d4]" />
                        <span>Catálogo</span>
                      </span>
                    </button>

                    <button
                      type="button"
                      role="menuitem"
                      className={`lp-menu-item ${activeTab === 'search' ? 'is-active text-[#06b6d4] font-bold' : ''}`}
                      onClick={() => {
                        setProfileOpen(false);
                        onSelectTab('search');
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                    >
                      <span className="lp-menu-item-left">
                        <Command className="w-4 h-4 text-[#06b6d4]" />
                        <span>Búsqueda</span>
                      </span>
                    </button>

                    {activeCourse && (
                      <button
                        type="button"
                        role="menuitem"
                        className={`lp-menu-item ${activeTab === 'viewer' ? 'is-active text-cyan-400 font-bold' : ''}`}
                        onClick={() => {
                          setProfileOpen(false);
                          onSelectTab('viewer');
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                      >
                        <span className="lp-menu-item-left">
                          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping inline-block" />
                          <span>En Curso</span>
                        </span>
                      </button>
                    )}

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
                          <span>Mentoría</span>
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
                          <span>Administración</span>
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
                        Asistente Ian (Tour)
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
                        Verificar diploma
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
                        Buzón de escucha
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
                        Seguridad de la cuenta
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
                          <span>Modo Blanco / Claro</span>
                        </>
                      ) : (
                        <>
                          <Moon className="w-4 h-4 text-cyan-500" />
                          <span>Modo Oscuro</span>
                        </>
                      )}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-white/[0.08] border border-slate-200 dark:border-white/[0.08] text-slate-600 dark:text-white/70">
                      {colorMode === 'dark' ? 'Oscuro' : 'Claro'}
                    </span>
                  </button>

                  <p className="lp-menu-note">
                    <span>Estado de Acceso</span>
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
                      Cerrar Sesión
                    </span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={onOpenAuth}
              className="cursor-pointer px-6 py-2.5 rounded-full bg-[#8052ff] hover:bg-[#7042f0] text-white font-constellation-label text-xs sm:text-[13px] font-semibold tracking-[0.05em] uppercase transition-all shadow-[0_0_20px_rgba(128,82,255,0.35)] hover:shadow-[0_0_30px_rgba(128,82,255,0.55)] active:scale-95"
            >
              <span>Acceder</span>
            </button>
          )}

        </div>

      </div>

      {/* 4. Barra de Navegación Rápida Móvil (Visible únicamente en móviles < md) */}
      <nav
        aria-label="Navegación principal móvil"
        className="md:hidden w-full border-t border-slate-200/80 dark:border-white/[0.06] bg-slate-50/90 dark:bg-[#07070b]/95 backdrop-blur-md px-4 py-2 flex items-center gap-2 overflow-x-auto no-scrollbar shadow-xs"
      >
        <button
          onClick={() => {
            onSelectTab('explore');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className={`shrink-0 px-3 py-1 rounded-full font-constellation-label text-[11px] tracking-wider uppercase font-semibold transition-all cursor-pointer ${activeTab === 'explore'
            ? 'bg-[#06b6d4] text-[#050505] font-bold shadow-sm shadow-cyan-500/25'
            : 'text-slate-600 dark:text-white/60 bg-slate-200/60 dark:bg-white/[0.04] hover:text-slate-900 dark:hover:text-white'
            }`}
        >
          Explorar
        </button>

        <button
          onClick={() => {
            onSelectTab('courses');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className={`shrink-0 px-3 py-1 rounded-full font-constellation-label text-[11px] tracking-wider uppercase font-semibold transition-all cursor-pointer ${activeTab === 'courses'
            ? 'bg-[#06b6d4] text-[#050505] font-bold shadow-sm shadow-cyan-500/25'
            : 'text-slate-600 dark:text-white/60 bg-slate-200/60 dark:bg-white/[0.04] hover:text-slate-900 dark:hover:text-white'
            }`}
        >
          Catálogo
        </button>

        <button
          onClick={() => {
            onSelectTab('search');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className={`shrink-0 px-3 py-1 rounded-full font-constellation-label text-[11px] tracking-wider uppercase font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${activeTab === 'search'
            ? 'bg-[#06b6d4] text-[#050505] font-bold shadow-sm shadow-cyan-500/25'
            : 'text-slate-600 dark:text-white/60 bg-slate-200/60 dark:bg-white/[0.04] hover:text-slate-900 dark:hover:text-white'
            }`}
        >
          <Search className="w-3 h-3" />
          <span>Búsqueda</span>
        </button>

        {activeCourse && (
          <button
            onClick={() => {
              onSelectTab('viewer');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className={`shrink-0 px-3 py-1 rounded-full font-constellation-label text-[11px] tracking-wider uppercase font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${activeTab === 'viewer'
              ? 'bg-cyan-500 text-[#050505] font-bold shadow-sm shadow-cyan-500/30'
              : 'text-cyan-600 dark:text-[#06b6d4] bg-cyan-500/10 border border-cyan-500/30'
              }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
            <span>En Curso</span>
          </button>
        )}

        {isStaff && (
          <button
            onClick={() => {
              onSelectTab('mentor');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className={`shrink-0 px-3 py-1 rounded-full font-constellation-label text-[11px] tracking-wider uppercase font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${activeTab === 'mentor'
              ? 'bg-[#a855f7] text-white font-bold shadow-sm shadow-purple-500/30'
              : 'text-purple-600 dark:text-[#a855f7] bg-purple-500/10 border border-purple-500/30'
              }`}
          >
            <Sparkles className="w-3 h-3" />
            <span>Mentoría</span>
          </button>
        )}

        {isAdmin && (
          <button
            onClick={() => {
              onSelectTab('admin');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className={`shrink-0 px-3 py-1 rounded-full font-constellation-label text-[11px] tracking-wider uppercase font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${activeTab === 'admin'
              ? 'bg-[#eab308] text-black font-bold shadow-sm shadow-amber-500/30'
              : 'text-amber-600 dark:text-[#eab308] bg-amber-500/10 border border-amber-500/30'
              }`}
          >
            <Shield className="w-3 h-3" />
            <span>Admin</span>
          </button>
        )}
      </nav>
    </header>
  );
};
