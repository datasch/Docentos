/**
 * Navbar Component - Academia Giantucchi
 * Navegación privada basada en la identidad autenticada y sus permisos RBAC.
 */

import React, { useState, useRef, useEffect } from 'react';
import { Shield, Crown, UserCheck, PlayCircle, HardDrive, Settings, Menu, X, Sparkles, ChevronDown, Globe, Bot, LogOut, KeyRound } from 'lucide-react';
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
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  activeTab,
  setActiveTab,
  hasAccess,
  onRestartTour,
  onChangePassword,
  onLogout,
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

  return (
    <header className="sticky top-0 z-50 bg-[#141420]/95 backdrop-blur-md border-b border-[#2d2d44] text-white shadow-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Logo & Brand */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveTab('courses')}>
            <div className="w-10 h-10 rounded-xl bg-brand-gradient flex items-center justify-center text-white font-extrabold shadow-lg shadow-[#06b6d4]/20 ring-1 ring-white/20 overflow-hidden shrink-0">
              {siteConfig.logoUrl ? (
                <img src={siteConfig.logoUrl} alt={siteConfig.appName} className="w-full h-full object-cover" />
              ) : (
                <span className="text-xl tracking-tighter font-black text-white">{siteConfig.logoInitial}</span>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base sm:text-lg tracking-tight text-white uppercase">
                  {siteConfig.appName}
                </span>
                <span className="text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-gradient text-white uppercase tracking-widest shadow-sm">
                  {siteConfig.appTagline}
                </span>
              </div>
            </div>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-1 bg-[#0a0a0f] p-1.5 rounded-xl border border-[#2d2d44]">
            <button
              onClick={() => setActiveTab('courses')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'courses'
                  ? 'btn-brand-primary'
                  : 'text-slate-400 hover:text-white hover:bg-[#141420]'
              }`}
            >
              <PlayCircle className="w-3.5 h-3.5" />
              {t('nav.courses')}
            </button>

            {(currentUser.role === 'MENTOR' || currentUser.role === 'ADMIN') && (
              <button
                onClick={() => setActiveTab('mentor')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === 'mentor'
                    ? 'bg-[#a855f7] text-white shadow-md shadow-[#a855f7]/30'
                    : 'text-slate-400 hover:text-white hover:bg-[#141420]'
                }`}
              >
                <UserCheck className="w-3.5 h-3.5 text-[#06b6d4]" />
                Panel Mentor
              </button>
            )}

            {currentUser.role === 'ADMIN' && (
              <button
                onClick={() => setActiveTab('admin')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === 'admin'
                    ? 'bg-[#a855f7] text-white shadow-md'
                    : 'text-slate-400 hover:text-white hover:bg-[#141420]'
                }`}
              >
                <Shield className="w-3.5 h-3.5 text-amber-400" />
                Admin Roles
              </button>
            )}

            {(currentUser.role === 'ADMIN' || currentUser.role === 'MENTOR') && (
              <button
                onClick={() => setActiveTab('plugins')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === 'plugins'
                    ? 'bg-[#06b6d4] text-black font-extrabold shadow-md'
                    : 'text-slate-400 hover:text-white hover:bg-[#141420]'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                Plugins
              </button>
            )}

            {(currentUser.role === 'ADMIN' || currentUser.role === 'MENTOR') && (
              <button
                onClick={() => setActiveTab('drive')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === 'drive'
                    ? 'btn-brand-primary'
                    : 'text-slate-400 hover:text-white hover:bg-[#141420]'
                }`}
              >
                <HardDrive className="w-3.5 h-3.5" />
                Drive
              </button>
            )}

            <button
              onClick={() => setActiveTab('vip')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'vip'
                  ? 'bg-brand-gradient text-white shadow-md'
                  : 'text-[#06b6d4] hover:bg-[#141420]'
              }`}
            >
              <Crown className="w-3.5 h-3.5 text-[#eab308]" />
              Pase VIP
            </button>
          </nav>

          {/* Sleek User Profile Dropdown Button */}
          <div className="hidden md:flex items-center relative" ref={dropdownRef}>
            <button
              onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
              className="flex items-center gap-2.5 bg-[#0a0a0f] hover:bg-[#1a1a2e] p-1.5 pr-3 rounded-xl border border-[#2d2d44] transition-all hover:border-[#06b6d4]/50"
            >
              <img
                src={currentUser.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
                alt={currentUser.name}
                className="w-7 h-7 rounded-full ring-2 ring-[#06b6d4]/40 object-cover"
              />
              <div className="text-left text-xs">
                <p className="font-bold text-white leading-tight flex items-center gap-1.5">
                  {currentUser.name}
                  {currentUser.role === 'ADMIN' && <Shield className="w-3 h-3 text-[#a855f7]" />}
                  {currentUser.role === 'VIP' && <Crown className="w-3 h-3 text-[#eab308]" />}
                </p>
                <span className="text-[10px] text-slate-400 uppercase font-mono">{currentUser.role}</span>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-1" />
            </button>

            {/* Profile Dropdown Menu */}
            {profileDropdownOpen && (
              <div className="absolute right-0 top-12 w-72 bg-[#1a1a2e] border border-[#2d2d44] rounded-2xl p-4 shadow-2xl z-50 animate-fade-in space-y-3">
                <div className="flex items-center gap-3 border-b border-[#2d2d44] pb-3">
                  <img
                    src={currentUser.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
                    alt={currentUser.name}
                    className="w-10 h-10 rounded-full object-cover ring-2 ring-[#06b6d4]"
                  />
                  <div>
                    <p className="font-bold text-xs text-white">{currentUser.name}</p>
                    <p className="text-[10px] text-slate-400">{currentUser.email}</p>
                    <span className="inline-block mt-1 text-[9px] font-extrabold px-2 py-0.5 rounded-full bg-[#06b6d4]/10 text-[#06b6d4] border border-[#06b6d4]/30 uppercase">
                      Rol: {currentUser.role}
                    </span>
                  </div>
                </div>

                {/* Global i18n Language Selector */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                    <Globe className="w-3 h-3 text-[#06b6d4]" /> {t('nav.language')} (i18n)
                  </label>
                  <div className="grid grid-cols-5 gap-1">
                    {[
                      { code: 'es', flag: '🇪🇸', label: 'ES' },
                      { code: 'en', flag: '🇺🇸', label: 'EN' },
                      { code: 'pt', flag: '🇧🇷', label: 'PT' },
                      { code: 'fr', flag: '🇫🇷', label: 'FR' },
                      { code: 'it', flag: '🇮🇹', label: 'IT' },
                    ].map((item) => (
                      <button
                        key={item.code}
                        onClick={() => handleLanguageChange(item.code)}
                        className={`py-1 rounded-lg text-[10px] font-bold transition-all flex flex-col items-center gap-0.5 ${
                          i18n.language.startsWith(item.code)
                            ? 'bg-[#06b6d4] text-black shadow-sm font-extrabold'
                            : 'bg-[#0a0a0f] text-slate-400 hover:text-white border border-[#2d2d44]'
                        }`}
                      >
                        <span className="text-xs">{item.flag}</span>
                        <span>{item.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Restart Virtual Assistant Tour Button */}
                {onRestartTour && (
                  <button
                    onClick={() => {
                      onRestartTour();
                      setProfileDropdownOpen(false);
                    }}
                    className="w-full py-2 bg-[#0a0a0f] hover:bg-[#141420] border border-[#2d2d44] hover:border-[#06b6d4] text-[#06b6d4] text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all"
                  >
                    <Bot className="w-4 h-4" /> {t('nav.restartTour')}
                  </button>
                )}

                {onChangePassword && (
                  <button
                    onClick={() => {
                      onChangePassword();
                      setProfileDropdownOpen(false);
                    }}
                    className="w-full py-2 bg-[#0a0a0f] hover:bg-[#141420] border border-[#2d2d44] hover:border-[#06b6d4] text-slate-200 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all"
                  >
                    <KeyRound className="w-4 h-4 text-[#06b6d4]" /> Cambiar contraseña
                  </button>
                )}

                {/* Access Status */}
                <div className="pt-2 border-t border-[#2d2d44] flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">{t('nav.accessStatus')}:</span>
                  <strong className={hasAccess ? 'text-[#06b6d4]' : 'text-[#f97316]'}>
                    {hasAccess ? t('nav.unlimited') : t('nav.noPayment')}
                  </strong>
                </div>

                {/* Logout Button */}
                {onLogout && (
                  <button
                    onClick={() => {
                      setProfileDropdownOpen(false);
                      onLogout();
                    }}
                    className="w-full py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 hover:text-red-300 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all mt-2"
                  >
                    <LogOut className="w-4 h-4" /> {t('nav.logout')}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Mobile Menu Toggle Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-[#1a1a2e]"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (

        <div className="md:hidden bg-[#141420] border-b border-[#2d2d44] p-4 space-y-3 animate-fade-in">
          <div className="space-y-1">
            <button
              onClick={() => {
                setActiveTab('courses');
                setMobileMenuOpen(false);
              }}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-200 hover:bg-[#1a1a2e]"
            >
              <PlayCircle className="w-5 h-5 text-[#06b6d4]" />
              Cursos & Clases
            </button>
            {(currentUser.role === 'ADMIN' || currentUser.role === 'MENTOR') && (
              <button
                onClick={() => {
                  setActiveTab('drive');
                  setMobileMenuOpen(false);
                }}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-200 hover:bg-[#1a1a2e]"
              >
                <HardDrive className="w-5 h-5 text-[#06b6d4]" />
                Buscador Google Drive
              </button>
            )}
            {(currentUser.role === 'ADMIN' || currentUser.role === 'MENTOR') && (
              <button
                onClick={() => {
                  setActiveTab('mentor');
                  setMobileMenuOpen(false);
                }}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-200 hover:bg-[#1a1a2e]"
              >
                <UserCheck className="w-5 h-5 text-[#06b6d4]" />
                Panel Mentor
              </button>
            )}
            {currentUser.role === 'ADMIN' && (
              <button
                onClick={() => {
                  setActiveTab('admin');
                  setMobileMenuOpen(false);
                }}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-200 hover:bg-[#1a1a2e]"
              >
                <Settings className="w-5 h-5 text-[#a855f7]" />
                Panel Admin / Mentor
              </button>
            )}
            {(currentUser.role === 'ADMIN' || currentUser.role === 'MENTOR') && (
              <button
                onClick={() => {
                  setActiveTab('plugins');
                  setMobileMenuOpen(false);
                }}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-200 hover:bg-[#1a1a2e]"
              >
                <Sparkles className="w-5 h-5 text-[#a855f7]" />
                Plugins
              </button>
            )}
            <button
              onClick={() => {
                setActiveTab('vip');
                setMobileMenuOpen(false);
              }}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-white bg-brand-gradient"
            >
              <Crown className="w-5 h-5 text-[#eab308]" />
              Activar Pase VIP
            </button>
            {onLogout && (
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onLogout();
                }}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-red-400 bg-red-500/10 border border-red-500/30"
              >
                <LogOut className="w-5 h-5" />
                {t('nav.logout')}
              </button>
            )}
            {onChangePassword && (
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onChangePassword();
                }}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-200 bg-[#1a1a2e] border border-[#2d2d44]"
              >
                <KeyRound className="w-5 h-5 text-[#06b6d4]" />
                Cambiar contraseña
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
