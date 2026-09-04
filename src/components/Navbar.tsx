/**
 * Navbar Component - Academia Giantucchi
 * Navegación privada basada en la identidad autenticada y sus permisos RBAC.
 *
 * El gradiente de marca aparece una sola vez, en el logo. En el reproductor el
 * espectro codifica avance —se destapa segun progresas y cada modulo toma su
 * tono—, asi que repetirlo aqui como adorno, tres veces en la misma fila de
 * 64px, vaciaba de significado esa lectura. El resto del header usa cian para
 * decir «estas aqui» y superficies neutras para todo lo demas.
 */

import React, { useState, useRef, useEffect } from 'react';
import { Shield, Crown, UserCheck, PlayCircle, HardDrive, Settings, Menu, X, Sparkles, ChevronDown, Globe, Bot, LogOut, KeyRound, Award } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { User } from '../types';
import { siteConfig } from '../config/theme';

interface NavbarProps {
  currentUser: User;
  activeTab: 'landing' | 'courses' | 'mentor' | 'admin' | 'plugins' | 'drive' | 'vip';
  setActiveTab: (tab: 'landing' | 'courses' | 'mentor' | 'admin' | 'plugins' | 'drive' | 'vip') => void;
  hasAccess: boolean;
  onRestartTour?: () => void;
  onChangePassword?: () => void;
  onLogout?: () => void;
  onOpenVerifyModal?: () => void;
}

/** Un destino del nav: apagado por defecto, cian cuando es el que se está viendo. */
const navItem = (isActive: boolean) =>
  `flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-meta transition-colors ${
    isActive ? 'bg-raised font-medium text-brand-cyan' : 'text-ink-muted hover:bg-raised hover:text-ink'
  }`;

/** Fila del cajón móvil. */
const drawerItem = 'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-section text-ink-soft transition-colors hover:bg-raised hover:text-ink';

/** Acción secundaria del menú de perfil. */
const menuAction = 'flex w-full items-center justify-center gap-2 rounded-xl border border-line bg-canvas py-2 text-meta text-ink-soft transition-colors hover:bg-raised hover:text-ink';

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  activeTab,
  setActiveTab,
  hasAccess,
  onRestartTour,
  onChangePassword,
  onLogout,
  onOpenVerifyModal,
}) => {
  const { t, i18n } = useTranslation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handleLanguageChange = (lang: string) => {
    i18n.changeLanguage(lang);
    localStorage.setItem('giantucchi_lang', lang);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setProfileDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isStaff = currentUser.role === 'ADMIN' || currentUser.role === 'MENTOR';

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-surface/95 text-ink backdrop-blur-md">
      <div className="mx-auto w-full max-w-[1800px] px-4 sm:px-6">
        <div className="flex h-16 items-center justify-between gap-4">

          {/* Logo & Brand */}
          <button
            type="button"
            className="flex shrink-0 items-center gap-2.5"
            onClick={() => setActiveTab('landing')}
          >
            {/* La misma marca que la cabecera publica: anillo de gradiente,
                nucleo oscuro y la inicial recortada sobre cian-morado. La
                version anterior rellenaba los 36px con el gradiente entero y
                ponia la letra en blanco, que sobre esas seis paradas se queda
                entre 1.9:1 y 4:1; sobre el nucleo oscuro no baja de 5:1. */}
            <span className="bg-brand-gradient shadow-brand-cyan/20 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl p-0.5 shadow-lg">
              <span className="flex h-full w-full items-center justify-center overflow-hidden rounded-[10px] bg-canvas">
                {siteConfig.logoUrl ? (
                  <img src={siteConfig.logoUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="bg-gradient-to-r from-brand-cyan to-brand-purple bg-clip-text text-lg font-black text-transparent">
                    {siteConfig.logoInitial}
                  </span>
                )}
              </span>
            </span>
            <span className="text-section font-semibold tracking-tight text-ink">{siteConfig.appName}</span>
          </button>

          {/* Desktop Navigation */}
          <nav className="hidden items-center gap-1 lg:flex">
            <button onClick={() => setActiveTab('courses')} className={navItem(activeTab === 'courses')}>
              <PlayCircle aria-hidden className="h-4 w-4" />
              {t('nav.courses')}
            </button>

            {isStaff && (
              <button onClick={() => setActiveTab('mentor')} className={navItem(activeTab === 'mentor')}>
                <UserCheck aria-hidden className="h-4 w-4" />
                Mentoría
              </button>
            )}

            {currentUser.role === 'ADMIN' && (
              <button onClick={() => setActiveTab('admin')} className={navItem(activeTab === 'admin')}>
                <Shield aria-hidden className="h-4 w-4" />
                Administración
              </button>
            )}

            {isStaff && (
              <button onClick={() => setActiveTab('plugins')} className={navItem(activeTab === 'plugins')}>
                <Sparkles aria-hidden className="h-4 w-4" />
                Plugins
              </button>
            )}

            {isStaff && (
              <button onClick={() => setActiveTab('drive')} className={navItem(activeTab === 'drive')}>
                <HardDrive aria-hidden className="h-4 w-4" />
                Drive
              </button>
            )}

            {onOpenVerifyModal && (
              <button onClick={onOpenVerifyModal} className={navItem(false)}>
                <Award aria-hidden className="h-4 w-4 text-brand-yellow" />
                Verificar diploma
              </button>
            )}

            <button onClick={() => setActiveTab('vip')} className={navItem(activeTab === 'vip')}>
              <Crown aria-hidden className="h-4 w-4 text-brand-yellow" />
              Pase VIP
            </button>
          </nav>

          {/* Sleek User Profile Dropdown Button */}
          <div className="relative hidden shrink-0 items-center md:flex" ref={dropdownRef}>
            <button
              onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
              aria-expanded={profileDropdownOpen}
              className="flex items-center gap-2.5 rounded-xl py-1.5 pr-2 pl-1.5 transition-colors hover:bg-raised"
            >
              <img
                src={currentUser.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
                alt=""
                className="h-7 w-7 rounded-full object-cover"
              />
              <span className="text-left">
                <span className="flex items-center gap-1.5 text-meta font-medium text-ink">
                  {currentUser.name}
                  {currentUser.role === 'ADMIN' && <Shield aria-hidden className="h-3 w-3 text-brand-purple" />}
                  {currentUser.role === 'VIP' && <Crown aria-hidden className="h-3 w-3 text-brand-yellow" />}
                </span>
                <span className="block text-micro text-ink-muted">{currentUser.role}</span>
              </span>
              <ChevronDown aria-hidden className="h-3.5 w-3.5 text-ink-muted" />
            </button>

            {/* Profile Dropdown Menu */}
            {profileDropdownOpen && (
              <div className="animate-fade-in absolute top-14 right-0 z-50 w-72 space-y-3 rounded-2xl border border-line bg-raised p-4 shadow-2xl">
                <div className="flex items-center gap-3 border-b border-line pb-3">
                  <img
                    src={currentUser.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
                    alt=""
                    className="h-10 w-10 rounded-full object-cover"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-meta font-medium text-ink">{currentUser.name}</p>
                    <p className="truncate text-micro text-ink-muted">{currentUser.email}</p>
                    <span className="mt-1 inline-block text-micro text-brand-cyan">{currentUser.role}</span>
                  </div>
                </div>

                {/* Global i18n Language Selector */}
                <div>
                  <span className="mb-1.5 flex items-center gap-1.5 text-micro text-ink-muted">
                    <Globe aria-hidden className="h-3 w-3" /> {t('nav.language')}
                  </span>
                  <div className="grid grid-cols-5 gap-1">
                    {[
                      { code: 'es', flag: '🇪🇸', label: 'ES' },
                      { code: 'en', flag: '🇺🇸', label: 'EN' },
                      { code: 'pt', flag: '🇧🇷', label: 'PT' },
                      { code: 'fr', flag: '🇫🇷', label: 'FR' },
                      { code: 'it', flag: '🇮🇹', label: 'IT' },
                    ].map((item) => {
                      const isCurrent = i18n.language.startsWith(item.code);
                      return (
                        <button
                          key={item.code}
                          onClick={() => handleLanguageChange(item.code)}
                          aria-pressed={isCurrent}
                          className={`flex flex-col items-center gap-0.5 rounded-lg py-1 text-micro transition-colors ${
                            isCurrent
                              ? 'bg-brand-cyan font-semibold text-canvas'
                              : 'border border-line bg-canvas text-ink-muted hover:text-ink'
                          }`}
                        >
                          <span className="text-meta">{item.flag}</span>
                          <span>{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Restart Virtual Assistant Tour Button */}
                {onRestartTour && (
                  <button
                    onClick={() => {
                      onRestartTour();
                      setProfileDropdownOpen(false);
                    }}
                    className={menuAction}
                  >
                    <Bot aria-hidden className="h-4 w-4 text-brand-cyan" /> {t('nav.restartTour')}
                  </button>
                )}

                {onOpenVerifyModal && (
                  <button
                    onClick={() => {
                      onOpenVerifyModal();
                      setProfileDropdownOpen(false);
                    }}
                    className={menuAction}
                  >
                    <Award aria-hidden className="h-4 w-4 text-brand-yellow" /> Verificar diploma
                  </button>
                )}

                {onChangePassword && (
                  <button
                    onClick={() => {
                      onChangePassword();
                      setProfileDropdownOpen(false);
                    }}
                    className={menuAction}
                  >
                    <KeyRound aria-hidden className="h-4 w-4 text-brand-cyan" /> Cambiar contraseña
                  </button>
                )}

                {/* Access Status */}
                <div className="flex items-center justify-between border-t border-line pt-3 text-meta">
                  <span className="text-ink-muted">{t('nav.accessStatus')}</span>
                  <span className={hasAccess ? 'text-brand-cyan' : 'text-brand-orange'}>
                    {hasAccess ? t('nav.unlimited') : t('nav.noPayment')}
                  </span>
                </div>

                {/* Logout Button */}
                {onLogout && (
                  <button
                    onClick={() => {
                      setProfileDropdownOpen(false);
                      onLogout();
                    }}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-brand-orange/30 bg-brand-orange/10 py-2 text-meta font-medium text-brand-orange transition-colors hover:bg-brand-orange/20"
                  >
                    <LogOut aria-hidden className="h-4 w-4" /> {t('nav.logout')}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Mobile Menu Toggle Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-expanded={mobileMenuOpen}
            aria-label={mobileMenuOpen ? 'Cerrar menú' : 'Abrir menú'}
            className="rounded-lg p-2 text-ink-muted transition-colors hover:bg-raised hover:text-ink md:hidden"
          >
            {mobileMenuOpen ? <X aria-hidden className="h-6 w-6" /> : <Menu aria-hidden className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="animate-fade-in space-y-1 border-b border-line bg-surface p-3 md:hidden">
          <button
            onClick={() => {
              setActiveTab('courses');
              setMobileMenuOpen(false);
            }}
            className={drawerItem}
          >
            <PlayCircle aria-hidden className="h-5 w-5 text-brand-cyan" />
            Cursos y clases
          </button>

          {isStaff && (
            <button
              onClick={() => {
                setActiveTab('drive');
                setMobileMenuOpen(false);
              }}
              className={drawerItem}
            >
              <HardDrive aria-hidden className="h-5 w-5 text-brand-cyan" />
              Buscador de Drive
            </button>
          )}

          {isStaff && (
            <button
              onClick={() => {
                setActiveTab('mentor');
                setMobileMenuOpen(false);
              }}
              className={drawerItem}
            >
              <UserCheck aria-hidden className="h-5 w-5 text-brand-cyan" />
              Mentoría
            </button>
          )}

          {currentUser.role === 'ADMIN' && (
            <button
              onClick={() => {
                setActiveTab('admin');
                setMobileMenuOpen(false);
              }}
              className={drawerItem}
            >
              <Settings aria-hidden className="h-5 w-5 text-brand-purple" />
              Administración
            </button>
          )}

          {isStaff && (
            <button
              onClick={() => {
                setActiveTab('plugins');
                setMobileMenuOpen(false);
              }}
              className={drawerItem}
            >
              <Sparkles aria-hidden className="h-5 w-5 text-brand-purple" />
              Plugins
            </button>
          )}

          <button
            onClick={() => {
              setActiveTab('vip');
              setMobileMenuOpen(false);
            }}
            className={drawerItem}
          >
            <Crown aria-hidden className="h-5 w-5 text-brand-yellow" />
            Pase VIP
          </button>

          {onChangePassword && (
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                onChangePassword();
              }}
              className={drawerItem}
            >
              <KeyRound aria-hidden className="h-5 w-5 text-brand-cyan" />
              Cambiar contraseña
            </button>
          )}

          {onLogout && (
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                onLogout();
              }}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-section text-brand-orange transition-colors hover:bg-brand-orange/10"
            >
              <LogOut aria-hidden className="h-5 w-5" />
              {t('nav.logout')}
            </button>
          )}
        </div>
      )}
    </header>
  );
};
