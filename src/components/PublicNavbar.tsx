import React, { useState, useRef, useEffect } from 'react';
import { Globe, ArrowRight, ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { siteConfig } from '../config/theme';

interface PublicNavbarProps {
  appName?: string;
  onOpenAuth: (mode: 'login' | 'register') => void;
}

const LANGUAGES = [
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'en', label: 'English', flag: '🇺🇸' },
  { code: 'pt', label: 'Português', flag: '🇧🇷' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'it', label: 'Italiano', flag: '🇮🇹' },
];

export const PublicNavbar: React.FC<PublicNavbarProps> = ({
  appName,
  onOpenAuth,
}) => {
  const { t, i18n } = useTranslation();
  const [langDropdownOpen, setLangDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const displayAppName = appName || siteConfig.appName || 'DocentOS';

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setLangDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLanguageSelect = (langCode: string) => {
    i18n.changeLanguage(langCode);
    localStorage.setItem('giantucchi_lang', langCode);
    setLangDropdownOpen(false);
  };

  const currentLangCode = (i18n.language || 'es').substring(0, 2).toUpperCase();

  return (
    <header className="sticky top-0 z-40 bg-[#0a0a0f]/90 backdrop-blur-md border-b border-[#262626] px-4 sm:px-8 py-3.5 flex items-center justify-between">
      {/* Logo Limpio: Solo el nombre de la app (DocentOS), sin subtítulos */}
      <a href="#" className="flex items-center gap-3 group">
        <div className="w-9 h-9 rounded-xl bg-brand-gradient p-0.5 shadow-lg shadow-[#06b6d4]/20 flex items-center justify-center">
          <div className="w-full h-full bg-[#0a0a0f] rounded-[10px] flex items-center justify-center">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#06b6d4] to-[#a855f7] font-black text-lg">
              {siteConfig.logoInitial || displayAppName.charAt(0)}
            </span>
          </div>
        </div>
        <span className="font-extrabold text-base tracking-tight text-white group-hover:text-[#06b6d4] transition-colors">
          {displayAppName}
        </span>
      </a>

      {/* Enlaces Minimalistas: exactamente Catálogo, Metodología, Planes, Testimonios */}
      <nav className="hidden md:flex items-center gap-6 text-xs font-semibold text-slate-400">
        <a href="#cursos" className="hover:text-[#06b6d4] transition-colors">
          Catálogo
        </a>
        <a href="#beneficios" className="hover:text-[#06b6d4] transition-colors">
          Metodología
        </a>
        <a href="#planes" className="hover:text-[#06b6d4] transition-colors">
          Planes
        </a>
        <a href="#testimonios" className="hover:text-[#06b6d4] transition-colors">
          Testimonios
        </a>
      </nav>

      {/* Botones de Acción & Selector de Idioma Limpio */}
      <div className="flex items-center gap-3">
        {/* Selector de Idioma Desplegable Discreto */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setLangDropdownOpen(!langDropdownOpen)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#141420] border border-[#262626] hover:border-[#06b6d4]/50 text-slate-300 hover:text-white text-xs font-bold transition-all"
            title="Cambiar idioma"
          >
            <Globe className="w-3.5 h-3.5 text-[#06b6d4]" />
            <span>{currentLangCode}</span>
            <ChevronDown className="w-3 h-3 text-slate-500" />
          </button>

          {langDropdownOpen && (
            <div className="absolute right-0 mt-2 w-36 bg-[#141420] border border-[#262626] rounded-xl shadow-2xl py-1 z-50">
              {LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => handleLanguageSelect(lang.code)}
                  className={`w-full text-left px-3 py-1.5 text-xs font-semibold flex items-center justify-between hover:bg-[#1a1a2e] transition-colors ${
                    i18n.language.startsWith(lang.code) ? 'text-[#06b6d4] font-extrabold bg-[#06b6d4]/10' : 'text-slate-300'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span>{lang.flag}</span>
                    <span>{lang.label}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={() => onOpenAuth('login')}
          className="px-4 py-2 bg-[#141420] hover:bg-[#1f1f33] border border-[#262626] hover:border-[#06b6d4] text-white text-xs font-bold rounded-xl transition-all"
        >
          {t('nav.login') || 'Iniciar Sesión'}
        </button>

        <button
          onClick={() => onOpenAuth('register')}
          className="px-4 py-2 bg-gradient-to-r from-[#06b6d4] to-[#a855f7] hover:opacity-90 text-black text-xs font-extrabold rounded-xl shadow-lg transition-all flex items-center gap-1.5"
        >
          <span>{t('nav.register') || 'Registrarse'}</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </header>
  );
};
