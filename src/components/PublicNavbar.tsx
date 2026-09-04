/**
 * Barra de navegacion de la portada publica.
 *
 * Tiene dos caras segun la sesion:
 *  - visitante: enlaces del sitio y los botones de Iniciar sesion / Registrarse;
 *  - alumno con sesion abierta: buscador del catalogo, idioma y su avatar con
 *    el menu de cuenta, igual que un panel de estudio.
 * El logo de DocentOS es el mismo en ambas.
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  ArrowRight,
  ChevronDown,
  Globe,
  LayoutDashboard,
  LogOut,
  Menu,
  Search,
  Star,
  X,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { siteConfig } from '../config/theme';

export interface PublicNavLink {
  id: string;
  label: string;
  href: string;
}

interface PublicNavbarProps {
  appName?: string;
  onOpenAuth: (mode: 'login' | 'register') => void;
  /**
   * Sesion activa, si la hay. La portada es publica, pero seguia ofreciendo
   * "Iniciar sesion" a quien ya habia entrado, de modo que recargar en `/`
   * parecia haber cerrado la sesion aunque la cookie siguiera viva.
   */
  currentUser?: { name: string; role: string; avatarUrl?: string } | null;
  onGoToApp?: () => void;
  onLogout?: () => void;
  links: PublicNavLink[];
  /** Seccion visible ahora mismo, para subrayar su enlace. */
  activeSection?: string;
  /** Texto del buscador del catalogo; lo gobierna la portada. */
  searchQuery: string;
  onSearchChange: (value: string) => void;
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

export const PublicNavbar: React.FC<PublicNavbarProps> = ({
  appName,
  onOpenAuth,
  currentUser,
  onGoToApp,
  onLogout,
  links,
  activeSection,
  searchQuery,
  onSearchChange,
}) => {
  const { t, i18n } = useTranslation();
  const [langOpen, setLangOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const langRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const displayAppName = appName || siteConfig.appName || 'DocentOS';

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (langRef.current && !langRef.current.contains(target)) setLangOpen(false);
      if (profileRef.current && !profileRef.current.contains(target)) setProfileOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Ctrl+K / Cmd+K salta al buscador del catalogo; Escape cierra lo que este abierto.
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

  const currentLangCode = (i18n.language || 'es').substring(0, 2).toUpperCase();
  const roleLabel = currentUser ? ROLE_LABELS[currentUser.role] || currentUser.role : '';

  return (
    <header className="lp-header">
      <div className="lp-container">
        <nav className="lp-navbar">
          <div className="lp-nav-left">
            {/* Logo DocentOS: la unica pieza de la identidad anterior que se conserva. */}
            <a href="#inicio" className="lp-logo" aria-label={displayAppName}>
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
            </a>

            <ul className="lp-nav-links">
              {links.map((link) => (
                <li key={link.id}>
                  <a
                    href={link.href}
                    className={`lp-nav-link${activeSection === link.id ? ' is-active' : ''}`}
                  >
                    {link.label}
                  </a>
                </li>
              ))}
              <li>
                <a href="#planes" className="lp-badge-premium">
                  <Star aria-hidden className="h-3 w-3" fill="currentColor" />
                  Premium
                </a>
              </li>
            </ul>
          </div>

          <div className="lp-nav-right">
            {/* Buscador real: filtra el catalogo mientras se escribe. */}
            <div className="lp-search-box">
              <Search aria-hidden />
              <input
                ref={searchRef}
                type="search"
                className="lp-search-input"
                placeholder="Buscar cursos..."
                aria-label="Buscar cursos"
                value={searchQuery}
                onChange={(event) => onSearchChange(event.target.value)}
              />
            </div>

            {/* Idioma */}
            <div className="lp-menu-anchor" ref={langRef}>
              <button
                type="button"
                className="lp-icon-btn"
                onClick={() => {
                  setLangOpen((open) => !open);
                  setProfileOpen(false);
                }}
                aria-haspopup="menu"
                aria-expanded={langOpen}
                title="Cambiar idioma"
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

            {currentUser ? (
              <>
                <button
                  type="button"
                  onClick={onGoToApp}
                  className="lp-btn-primary lp-btn-sm lp-nav-cta-desktop"
                >
                  <span>Ir a mi panel</span>
                  <ArrowRight aria-hidden className="h-4 w-4" />
                </button>

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
                        onClick={() => {
                          setProfileOpen(false);
                          onGoToApp?.();
                        }}
                      >
                        <span className="lp-menu-item-left">
                          <LayoutDashboard aria-hidden className="h-4 w-4" />
                          Ir a mi panel
                        </span>
                      </button>

                      <button
                        type="button"
                        role="menuitem"
                        className="lp-menu-item"
                        onClick={() => {
                          setProfileOpen(false);
                          onLogout?.();
                        }}
                      >
                        <span className="lp-menu-item-left">
                          <LogOut aria-hidden className="h-4 w-4" />
                          Cerrar sesión
                        </span>
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => onOpenAuth('login')}
                  className="lp-btn-ghost lp-nav-cta-desktop"
                >
                  {t('nav.login') || 'Iniciar Sesión'}
                </button>

                <button
                  type="button"
                  onClick={() => onOpenAuth('register')}
                  className="lp-btn-primary lp-btn-sm"
                >
                  <span>{t('nav.register') || 'Registrarse'}</span>
                  <ArrowRight aria-hidden className="h-4 w-4" />
                </button>
              </>
            )}

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

      {/* Menu movil: los enlaces que la barra esconde por debajo de 1080px. */}
      <div className={`lp-mobile-panel${mobileOpen ? ' is-open' : ''}`}>
        <ul className="lp-mobile-links">
          {links.map((link) => (
            <li key={link.id}>
              <a href={link.href} onClick={() => setMobileOpen(false)}>
                {link.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="lp-mobile-actions">
          {currentUser ? (
            <>
              <button
                type="button"
                className="lp-btn-primary lp-btn-sm"
                onClick={() => {
                  setMobileOpen(false);
                  onGoToApp?.();
                }}
              >
                Ir a mi panel
              </button>
              <button
                type="button"
                className="lp-btn-ghost"
                onClick={() => {
                  setMobileOpen(false);
                  onLogout?.();
                }}
              >
                Cerrar sesión
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="lp-btn-primary lp-btn-sm"
                onClick={() => {
                  setMobileOpen(false);
                  onOpenAuth('register');
                }}
              >
                {t('nav.register') || 'Registrarse'}
              </button>
              <button
                type="button"
                className="lp-btn-ghost"
                onClick={() => {
                  setMobileOpen(false);
                  onOpenAuth('login');
                }}
              >
                {t('nav.login') || 'Iniciar Sesión'}
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
};
