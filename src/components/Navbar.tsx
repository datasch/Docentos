/**
 * Navbar Component - DocentOS
 * Navegación privada basada en la identidad autenticada y sus permisos RBAC.
 *
 * Es la misma barra de la portada (`PublicNavbar`, hoja `styles/landing.css`,
 * prefijo `lp-`) con otro contenido: quien entra al panel no debería sentir
 * que ha cambiado de producto. Lo que cambia respecto a la pública:
 *  - los enlaces son destinos de la aplicación filtrados por rol, no anclas;
 *  - el buscador salta a un curso del catálogo propio en vez de filtrar la
 *    rejilla de la portada;
 *  - el menú de cuenta añade lo que solo existe con sesión abierta (tour,
 *    contraseña, diploma, estado de acceso).
 *
 * El gradiente de marca sigue apareciendo una sola vez, en el logo: en el
 * reproductor el espectro codifica avance, y repetirlo aquí como adorno vacía
 * de significado esa lectura. El cian dice «estás aquí» y nada más.
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  Shield,
  Crown,
  UserCheck,
  PlayCircle,
  HardDrive,
  Home,
  Menu,
  X,
  Search,
  Sparkles,
  ChevronDown,
  Globe,
  Bot,
  LogOut,
  KeyRound,
  Award,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { User, Course } from '../types';
import { siteConfig } from '../config/theme';

type Tab = 'landing' | 'courses' | 'mentor' | 'admin' | 'plugins' | 'drive' | 'vip';

interface NavbarProps {
  currentUser: User;
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  hasAccess: boolean;
  onRestartTour?: () => void;
  onChangePassword?: () => void;
  onLogout?: () => void;
  onOpenVerifyModal?: () => void;
  /** Catálogo al que puede saltar el buscador de la barra. */
  courses?: Course[];
  onSelectCourse?: (course: Course) => void;
}

const LANGUAGES = [
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'en', label: 'English', flag: '🇺🇸' },
  { code: 'pt', label: 'Português', flag: '🇧🇷' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'it', label: 'Italiano', flag: '🇮🇹' },
];

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Administrador',
  MENTOR: 'Mentor',
  MENTEE: 'Mentee',
  VIP: 'Pase VIP',
  PUBLIC_USER: 'Estudiante',
  EXTERNAL: 'Invitado',
};

/** Iniciales para el avatar de quien no ha subido foto. */
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  activeTab,
  setActiveTab,
  hasAccess,
  onRestartTour,
  onChangePassword,
  onLogout,
  onOpenVerifyModal,
  courses = [],
  onSelectCourse,
}) => {
  const { t, i18n } = useTranslation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);

  const langRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const searchBoxRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const isStaff = currentUser.role === 'ADMIN' || currentUser.role === 'MENTOR';
  const isAdmin = currentUser.role === 'ADMIN';
  const displayAppName = siteConfig.appName || 'DocentOS';
  const currentLangCode = (i18n.language || 'es').substring(0, 2).toUpperCase();
  const roleLabel = ROLE_LABELS[currentUser.role] || currentUser.role;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (langRef.current && !langRef.current.contains(target)) setLangOpen(false);
      if (profileRef.current && !profileRef.current.contains(target)) setProfileOpen(false);
      if (searchBoxRef.current && !searchBoxRef.current.contains(target)) setSearchOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Ctrl+K / Cmd+K salta al buscador; Escape cierra lo que esté abierto.
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchRef.current?.focus();
        return;
      }
      if (event.key === 'Escape') {
        setLangOpen(false);
        setProfileOpen(false);
        setMobileOpen(false);
        setSearchOpen(false);
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, []);

  const handleLanguageSelect = (langCode: string) => {
    i18n.changeLanguage(langCode);
    localStorage.setItem('giantucchi_lang', langCode);
    setLangOpen(false);
  };

  /** Ir a un destino cerrando lo que hubiera abierto encima. */
  const goTo = (tab: Tab) => {
    setActiveTab(tab);
    setMobileOpen(false);
    setProfileOpen(false);
  };

  const query = searchQuery.trim().toLowerCase();
  const matches = query
    ? courses.filter(
        (item) =>
          item.title.toLowerCase().includes(query) ||
          (item.description || '').toLowerCase().includes(query),
      )
    : [];

  const openCourse = (selected: Course) => {
    onSelectCourse?.(selected);
    setActiveTab('courses');
    setSearchQuery('');
    setSearchOpen(false);
  };

  /**
   * Qué puede ver hoy quien está mirando. Para el personal es su rol —tienen
   * el catálogo entero— y para el alumnado, si el curso abierto está pagado.
   */
  const accessNote = isAdmin
    ? { label: 'Acceso total', tone: 'lp-tone-accent' }
    : currentUser.role === 'VIP'
      ? { label: t('nav.unlimited'), tone: 'lp-tone-gold' }
      : isStaff
        ? { label: 'Acceso de mentor', tone: 'lp-tone-cyan' }
        : hasAccess
          ? { label: t('nav.unlimited'), tone: 'lp-tone-green' }
          : { label: t('nav.noPayment'), tone: 'lp-tone-warn' };

  /** Los destinos de la barra, ya filtrados por permisos. */
  const destinations: { tab: Tab; label: string; icon: React.ReactNode }[] = [
    { tab: 'courses', label: t('nav.courses'), icon: <PlayCircle aria-hidden className="h-4 w-4" /> },
    ...(isStaff
      ? [{ tab: 'mentor' as Tab, label: 'Mentoría', icon: <UserCheck aria-hidden className="h-4 w-4" /> }]
      : []),
    ...(isAdmin
      ? [{ tab: 'admin' as Tab, label: 'Administración', icon: <Shield aria-hidden className="h-4 w-4" /> }]
      : []),
    ...(isStaff
      ? [
          { tab: 'plugins' as Tab, label: 'Plugins', icon: <Sparkles aria-hidden className="h-4 w-4" /> },
          { tab: 'drive' as Tab, label: 'Drive', icon: <HardDrive aria-hidden className="h-4 w-4" /> },
        ]
      : []),
  ];

  return (
    <header className="lp-header">
      <div className="lp-container lp-container-wide">
        <nav className="lp-navbar">
          <div className="lp-nav-left">
            {/* Mismo logo que la portada; aquí devuelve a la portada. */}
            <button
              type="button"
              onClick={() => goTo('landing')}
              className="lp-logo"
              aria-label={`${displayAppName} — ir a la portada`}
            >
              {siteConfig.logoUrl ? (
                <img src={siteConfig.logoUrl} alt="" className="lp-logo-img" />
              ) : (
                <span className="lp-logo-badge">
                  <span className="lp-logo-badge-inner">
                    <span>{siteConfig.logoInitial || displayAppName.charAt(0)}</span>
                  </span>
                </span>
              )}
              <span className="lp-logo-text">
                {displayAppName}
                <span>.</span>
              </span>
            </button>

            <ul className="lp-nav-links">
              {destinations.map((destination) => (
                <li key={destination.tab}>
                  <button
                    type="button"
                    onClick={() => goTo(destination.tab)}
                    aria-current={activeTab === destination.tab ? 'page' : undefined}
                    className={`lp-nav-link${activeTab === destination.tab ? ' is-active' : ''}`}
                  >
                    {destination.icon}
                    <span>{destination.label}</span>
                  </button>
                </li>
              ))}

              {/* El equivalente del «Premium» de la portada. */}
              <li>
                <button type="button" onClick={() => goTo('vip')} className="lp-badge-premium">
                  <Crown aria-hidden className="h-3 w-3" fill="currentColor" />
                  Pase VIP
                </button>
              </li>
            </ul>
          </div>

          <div className="lp-nav-right">
            {/* Buscador: salta al curso, no filtra una rejilla. */}
            <div className="lp-search-box" ref={searchBoxRef}>
              <Search aria-hidden />
              <input
                ref={searchRef}
                type="search"
                className="lp-search-input"
                placeholder="Buscar cursos..."
                aria-label="Buscar cursos"
                value={searchQuery}
                onChange={(event) => {
                  setSearchQuery(event.target.value);
                  setSearchOpen(true);
                }}
                onFocus={() => setSearchOpen(true)}
              />

              {searchOpen && query && (
                <div className="lp-menu lp-search-results" role="menu">
                  <div className="lp-menu-head">
                    <span className="lp-menu-role">
                      {matches.length} {matches.length === 1 ? 'curso' : 'cursos'}
                    </span>
                  </div>
                  {matches.length > 0 ? (
                    matches.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        role="menuitem"
                        className="lp-menu-item"
                        onClick={() => openCourse(item)}
                      >
                        <span className="lp-menu-item-left">
                          <PlayCircle aria-hidden className="lp-tone-cyan h-4 w-4 shrink-0" />
                          <span className="truncate">{item.title}</span>
                        </span>
                      </button>
                    ))
                  ) : (
                    <p className="lp-search-empty">Ningún curso coincide.</p>
                  )}
                </div>
              )}
            </div>

            {/* Idioma */}
            <div className="lp-menu-anchor lp-nav-lang" ref={langRef}>
              <button
                type="button"
                className="lp-icon-btn"
                onClick={() => {
                  setLangOpen((open) => !open);
                  setProfileOpen(false);
                }}
                aria-haspopup="menu"
                aria-expanded={langOpen}
                title={t('nav.language')}
              >
                <Globe aria-hidden className="h-4 w-4" />
                <span>{currentLangCode}</span>
                <ChevronDown aria-hidden className="h-3 w-3" />
              </button>

              {langOpen && (
                <div className="lp-menu" role="menu">
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

            {/* Cuenta */}
            <div className="lp-menu-anchor" ref={profileRef}>
              <button
                type="button"
                className="lp-user-profile"
                onClick={() => {
                  setProfileOpen((open) => !open);
                  setLangOpen(false);
                }}
                aria-haspopup="menu"
                aria-expanded={profileOpen}
                aria-label="Menú de cuenta"
              >
                <span className="lp-avatar-wrapper">
                  {currentUser.avatarUrl ? (
                    <img className="lp-avatar-img" src={currentUser.avatarUrl} alt="" />
                  ) : (
                    <span className="lp-avatar-fallback">{initialsOf(currentUser.name)}</span>
                  )}
                  <span className="lp-status-badge" title="En línea" />
                </span>
                <ChevronDown aria-hidden className="h-3.5 w-3.5 text-slate-400" />
              </button>

              {profileOpen && (
                <div className="lp-menu" role="menu">
                  <div className="lp-menu-head">
                    <span className="lp-menu-name">{currentUser.name}</span>
                    <span className="lp-menu-role">{roleLabel}</span>
                  </div>

                  <button
                    type="button"
                    role="menuitem"
                    className="lp-menu-item"
                    onClick={() => goTo('landing')}
                  >
                    <span className="lp-menu-item-left">
                      <Home aria-hidden className="h-4 w-4" />
                      Ir a la portada
                    </span>
                  </button>

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
                        <Bot aria-hidden className="h-4 w-4" />
                        {t('nav.restartTour')}
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
                        <Award aria-hidden className="h-4 w-4" />
                        Verificar diploma
                      </span>
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
                        <KeyRound aria-hidden className="h-4 w-4" />
                        Cambiar contraseña
                      </span>
                    </button>
                  )}

                  <p className="lp-menu-note">
                    <span>{t('nav.accessStatus')}</span>
                    <strong className={accessNote.tone}>{accessNote.label}</strong>
                  </p>

                  {onLogout && (
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
                        <LogOut aria-hidden className="h-4 w-4" />
                        {t('nav.logout')}
                      </span>
                    </button>
                  )}
                </div>
              )}
            </div>

            <button
              type="button"
              className="lp-icon-btn lp-mobile-btn"
              onClick={() => setMobileOpen((open) => !open)}
              aria-expanded={mobileOpen}
              aria-label={mobileOpen ? 'Cerrar menú' : 'Abrir menú'}
            >
              {mobileOpen ? <X aria-hidden className="h-5 w-5" /> : <Menu aria-hidden className="h-5 w-5" />}
            </button>
          </div>
        </nav>
      </div>

      {/* Cajón móvil: los destinos que la barra esconde por debajo de 1280px. */}
      <div className={`lp-mobile-panel${mobileOpen ? ' is-open' : ''}`}>
        <ul className="lp-mobile-links">
          {destinations.map((destination) => (
            <li key={destination.tab}>
              <button
                type="button"
                onClick={() => goTo(destination.tab)}
                className={activeTab === destination.tab ? 'is-active' : undefined}
              >
                {destination.icon}
                <span>{destination.label}</span>
              </button>
            </li>
          ))}

          <li>
            <button
              type="button"
              onClick={() => goTo('vip')}
              className={activeTab === 'vip' ? 'is-active' : undefined}
            >
              <Crown aria-hidden className="lp-tone-gold h-4 w-4" />
              <span>Pase VIP</span>
            </button>
          </li>

          {onOpenVerifyModal && (
            <li>
              <button
                type="button"
                onClick={() => {
                  setMobileOpen(false);
                  onOpenVerifyModal();
                }}
              >
                <Award aria-hidden className="lp-tone-gold h-4 w-4" />
                <span>Verificar diploma</span>
              </button>
            </li>
          )}
        </ul>

        <div className="lp-mobile-lang">
          <span className="inline-flex items-center gap-2">
            <Globe aria-hidden className="h-4 w-4" />
            {t('nav.language')}
          </span>
          <span className="lp-mobile-lang-options">
            {LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                type="button"
                onClick={() => handleLanguageSelect(lang.code)}
                aria-pressed={i18n.language.startsWith(lang.code)}
                className={i18n.language.startsWith(lang.code) ? 'is-active' : undefined}
              >
                <span aria-hidden className="mr-1">
                  {lang.flag}
                </span>
                {lang.code.toUpperCase()}
              </button>
            ))}
          </span>
        </div>

        <div className="lp-mobile-actions is-stacked">
          <button type="button" className="lp-btn-ghost" onClick={() => goTo('landing')}>
            <Home aria-hidden className="h-4 w-4" />
            Ir a la portada
          </button>

          {onChangePassword && (
            <button
              type="button"
              className="lp-btn-ghost"
              onClick={() => {
                setMobileOpen(false);
                onChangePassword();
              }}
            >
              <KeyRound aria-hidden className="h-4 w-4" />
              Cambiar contraseña
            </button>
          )}

          {onLogout && (
            <button
              type="button"
              className="lp-btn-ghost is-danger"
              onClick={() => {
                setMobileOpen(false);
                onLogout();
              }}
            >
              <LogOut aria-hidden className="h-4 w-4" />
              {t('nav.logout')}
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
