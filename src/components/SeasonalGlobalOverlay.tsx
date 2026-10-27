/**
 * Capa Global de Ambientación Festiva de DocentOS (Halloween & Navidad)
 * Transforma DocentOS en su totalidad durante fechas festivas:
 * - Efectos de partículas (Nieve cósmica para Navidad / Murciélagos y brumas astrales para Halloween)
 * - Tira conmemorativa de temporada
 */

import React, { useState, useEffect } from 'react';
import { getSeasonalTheme, SeasonalTheme, SEASONAL_INFO } from '../lib/seasonalTheme';
import { X, Sparkles } from 'lucide-react';

export const SeasonalGlobalOverlay: React.FC = () => {
  const [theme, setTheme] = useState<SeasonalTheme>(getSeasonalTheme);
  const [dismissBanner, setDismissBanner] = useState(false);

  useEffect(() => {
    const handleSeasonalChange = (e: any) => {
      if (e.detail?.theme) setTheme(e.detail.theme);
      else setTheme(getSeasonalTheme());
    };
    window.addEventListener('docentos-seasonal-change', handleSeasonalChange);
    return () => window.removeEventListener('docentos-seasonal-change', handleSeasonalChange);
  }, []);

  if (theme === 'none') return null;

  const info = SEASONAL_INFO[theme];

  return (
    <>
      {/* 1. Efecto Ambiental de Fondo en TODO DocentOS (Adaptativo y optimizado para móviles) */}
      {theme === 'christmas' && (
        <div className="nevada-container pointer-events-none fixed inset-0 z-30 overflow-hidden [will-change:transform]" aria-hidden="true">
          {Array.from({ length: typeof window !== 'undefined' && window.innerWidth < 768 ? 12 : 24 }).map((_, i) => (
            <div
              key={i}
              className="copo-nieve"
              style={{
                left: `${(i * 3.8 + 1.2) % 100}%`,
                animationDelay: `${(i * 0.45) % 6}s`,
                animationDuration: `${5.0 + ((i * 1.2) % 5)}s`,
                width: `${2.5 + (i % 3) * 1.5}px`,
                height: `${2.5 + (i % 3) * 1.5}px`,
                opacity: 0.35 + (i % 4) * 0.12,
              }}
            />
          ))}
        </div>
      )}

      {theme === 'halloween' && (
        <div className="halloween-ambient-container pointer-events-none fixed inset-0 z-30 overflow-hidden [will-change:transform]" aria-hidden="true">
          {/* Murciélagos flotantes (solo 2 en móviles) */}
          {Array.from({ length: typeof window !== 'undefined' && window.innerWidth < 768 ? 2 : 6 }).map((_, i) => (
            <div
              key={`bat-${i}`}
              className="absolute pointer-events-none opacity-20 dark:opacity-30 [will-change:transform]"
              style={{
                top: `${14 + (i * 14) % 70}%`,
                left: `${(i * 16 + 6) % 88}%`,
                transform: `scale(${0.6 + (i % 3) * 0.2}) rotate(${(i % 2 === 0 ? 1 : -1) * 6}deg) translate3d(0, 0, 0)`,
                animationDuration: `${4 + i}s`,
              }}
            >
              <svg width="32" height="18" viewBox="0 0 48 24" fill="#a855f7">
                <path d="M 0 12 C 8 4, 14 6, 20 14 C 22 8, 26 8, 28 14 C 34 6, 40 4, 48 12 C 40 18, 36 24, 24 20 C 12 24, 8 18, 0 12 Z" />
              </svg>
            </div>
          ))}

          {/* Destellos de fuego fatuo optimizados con radial-gradient (cero repaints en GPU) */}
          {Array.from({ length: typeof window !== 'undefined' && window.innerWidth < 768 ? 4 : 10 }).map((_, i) => (
            <div
              key={`ember-${i}`}
              className="absolute w-3 h-3 rounded-full pointer-events-none [will-change:transform]"
              style={{
                top: `${(i * 8.8 + 5) % 92}%`,
                left: `${(i * 8.4 + 4) % 94}%`,
                background:
                  i % 2 === 0
                    ? 'radial-gradient(circle, rgba(249,115,22,0.9) 0%, rgba(249,115,22,0.25) 45%, transparent 72%)'
                    : 'radial-gradient(circle, rgba(168,85,247,0.9) 0%, rgba(168,85,247,0.25) 45%, transparent 72%)',
                opacity: 0.35 + (i % 3) * 0.15,
                transform: 'translate3d(0, 0, 0)',
                animation: `float ${4.5 + (i % 3)}s ease-in-out infinite`,
                animationDelay: `${i * 0.5}s`,
              }}
            />
          ))}
        </div>
      )}

      {/* 2. Banner Festivo Superior de Temporada (Discreto y Elegante) */}
      {!dismissBanner && (
        <aside
          role="region"
          aria-label="Aviso de festividad activa"
          className="relative z-40 w-full py-1.5 px-4 text-xs font-semibold flex items-center justify-between transition-all select-none shadow-sm backdrop-blur-md"
          style={{
            backgroundColor:
              theme === 'halloween'
                ? 'rgba(35, 14, 5, 0.94)'
                : 'rgba(15, 30, 20, 0.94)',
            borderBottom:
              theme === 'halloween'
                ? '1px solid rgba(249, 115, 22, 0.35)'
                : '1px solid rgba(16, 185, 129, 0.35)',
            color: theme === 'halloween' ? '#fed7aa' : '#d1fae5',
          }}
        >
          <div className="max-w-[1280px] w-full mx-auto flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm">{info.emoji}</span>
              <span className="font-extrabold uppercase tracking-wider text-[11px]" style={{ color: info.colorAcento }}>
                {info.nombre}
              </span>
              <span className="hidden sm:inline text-[11px] opacity-90">
                — {info.mensaje}
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider"
                style={{
                  backgroundColor: `${info.colorAcento}25`,
                  color: info.colorAcento,
                  border: `1px solid ${info.colorAcento}40`,
                }}
              >
                Temporada Activa
              </span>
              <button
                type="button"
                onClick={() => setDismissBanner(true)}
                className="p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer text-white/70 hover:text-white"
                title="Ocultar aviso de festividad"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </aside>
      )}
    </>
  );
};
