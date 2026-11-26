/**
 * Capa Global de Ambientación Festiva de DocentOS (Halloween & Navidad)
 * Transforma DocentOS en su totalidad durante fechas festivas:
 * - Efectos de partículas (Nieve cósmica para Navidad / Murciélagos y brumas astrales para Halloween)
 * - Tira conmemorativa de temporada
 */

import React, { useState, useEffect } from 'react';
import { useSeasonalDisplay, SEASONAL_INFO } from '../lib/seasonalTheme';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import './seasonal-christmas.css';

/** Ramita de acebo: dos hojas y tres bayas. `mirror` la gira para que el par quede simétrico. */
const HollySprig: React.FC<{ mirror?: boolean }> = ({ mirror = false }) => (
  <svg aria-hidden width="44" height="22" viewBox="0 0 44 22" className="shrink-0" style={mirror ? { transform: 'scaleX(-1)' } : undefined}>
    <path d="M22 11c-4-7-12-9-20-6 3 6 11 9 20 6z" fill="#2f9e6b" />
    <path d="M22 11c4 7 12 9 20 6-3-6-11-9-20-6z" fill="#237a53" />
    <circle cx="22" cy="9" r="3.2" fill="#dc2626" />
    <circle cx="18.5" cy="12.5" r="3" fill="#ef4444" />
    <circle cx="25.5" cy="12.5" r="3" fill="#b91c1c" />
  </svg>
);

export const SeasonalGlobalOverlay: React.FC = () => {
  const { t } = useTranslation();
  const { theme, showBanner, showParticles } = useSeasonalDisplay();
  const [dismissBanner, setDismissBanner] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(() => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [narrowScreen, setNarrowScreen] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches);

  useEffect(() => {
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const widthQuery = window.matchMedia('(max-width: 767px)');
    const updateMotion = () => setReduceMotion(motionQuery.matches);
    const updateWidth = () => setNarrowScreen(widthQuery.matches);
    updateMotion();
    updateWidth();
    motionQuery.addEventListener('change', updateMotion);
    widthQuery.addEventListener('change', updateWidth);
    return () => {
      motionQuery.removeEventListener('change', updateMotion);
      widthQuery.removeEventListener('change', updateWidth);
    };
  }, []);

  if (theme === 'none') return null;

  const info = SEASONAL_INFO[theme];
  const snowCount = narrowScreen ? 18 : 36;
  const batCount = narrowScreen ? 2 : 6;
  const emberCount = narrowScreen ? 4 : 10;

  return (
    <>
      {/* 1. Efecto Ambiental de Fondo en TODO DocentOS (Adaptativo y optimizado para móviles) */}
      {showParticles && theme === 'christmas' && !reduceMotion && (
        <>
          <div className="nevada-container pointer-events-none fixed inset-0 z-30 overflow-hidden [will-change:transform]" aria-hidden="true">
            {Array.from({ length: snowCount }).map((_, i) => {
              const baseLeft = ((i + 0.5) / snowCount) * 94 + 3;
              const jitter = ((i * 17) % 5) - 2;
              const left = Math.min(97, Math.max(2, baseLeft + jitter));
              const size = 3.5 + (i % 3) * 1.9;
              return (
                <div
                  key={i}
                  className="copo-nieve"
                  style={{
                    left: `${left.toFixed(2)}%`,
                    animationDelay: `${((i * 1.73) % 5.6).toFixed(2)}s`,
                    animationDuration: `${(5.0 + ((i * 1.37) % 4.5)).toFixed(2)}s`,
                    width: `${size}px`,
                    height: `${size}px`,
                    opacity: 0.52 + (i % 4) * 0.12,
                  }}
                />
              );
            })}
          </div>

          {/* Bancos de nieve suaves en los laterales inferiores */}
          <div className="christmas-side-snowbanks" aria-hidden="true">
            <svg className="christmas-side-snowbank" viewBox="0 0 260 90" fill="none">
              <defs>
                <linearGradient id="sideSnowLeftBack" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" style={{ stopColor: 'var(--christmas-snow-back-start, rgba(224,242,254,0.65))' }} />
                  <stop offset="100%" style={{ stopColor: 'var(--christmas-snow-back-end, rgba(191,219,254,0.4))' }} />
                </linearGradient>
                <linearGradient id="sideSnowLeftFront" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" style={{ stopColor: 'var(--christmas-snow-front-start, rgba(255,255,255,0.95))' }} />
                  <stop offset="100%" style={{ stopColor: 'var(--christmas-snow-front-end, rgba(219,234,254,0.82))' }} />
                </linearGradient>
              </defs>
              <path
                d="M0 90V28C32 24 54 44 86 48C122 52 142 36 178 52C210 66 232 76 260 90H0Z"
                fill="url(#sideSnowLeftBack)"
                stroke="var(--christmas-snow-stroke, transparent)"
                strokeWidth="1"
              />
              <path
                d="M0 90V52C28 48 58 64 94 68C136 72 162 60 202 74C224 82 242 86 260 90H0Z"
                fill="url(#sideSnowLeftFront)"
                stroke="var(--christmas-snow-stroke, transparent)"
                strokeWidth="1"
              />
            </svg>
            <svg className="christmas-side-snowbank" viewBox="0 0 260 90" fill="none">
              <defs>
                <linearGradient id="sideSnowRightBack" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" style={{ stopColor: 'var(--christmas-snow-back-start, rgba(224,242,254,0.65))' }} />
                  <stop offset="100%" style={{ stopColor: 'var(--christmas-snow-back-end, rgba(191,219,254,0.4))' }} />
                </linearGradient>
                <linearGradient id="sideSnowRightFront" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" style={{ stopColor: 'var(--christmas-snow-front-start, rgba(255,255,255,0.95))' }} />
                  <stop offset="100%" style={{ stopColor: 'var(--christmas-snow-front-end, rgba(219,234,254,0.82))' }} />
                </linearGradient>
              </defs>
              <path
                d="M260 90V26C228 22 206 44 172 48C136 52 114 38 78 54C46 68 24 78 0 90H260Z"
                fill="url(#sideSnowRightBack)"
                stroke="var(--christmas-snow-stroke, transparent)"
                strokeWidth="1"
              />
              <path
                d="M260 90V50C232 46 202 64 166 68C124 72 98 60 58 74C36 82 18 86 0 90H260Z"
                fill="url(#sideSnowRightFront)"
                stroke="var(--christmas-snow-stroke, transparent)"
                strokeWidth="1"
              />
            </svg>
          </div>
        </>
      )}

      {showParticles && theme === 'halloween' && (
        <div className="halloween-ambient-container pointer-events-none fixed inset-0 z-30 overflow-hidden [will-change:transform]" aria-hidden="true">
          {/* Murciélagos flotantes (solo 2 en móviles) */}
          {Array.from({ length: batCount }).map((_, i) => (
            <div
              key={`bat-${i}`}
              className="absolute pointer-events-none opacity-20 dark:opacity-30 [will-change:transform]"
              style={{
                top: `${14 + (i * 14) % 70}%`,
                left: `${(((i + 0.5) / batCount) * 82 + 6).toFixed(2)}%`,
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
          {Array.from({ length: emberCount }).map((_, i) => (
            <div
              key={`ember-${i}`}
              className="absolute w-3 h-3 rounded-full pointer-events-none [will-change:transform]"
              style={{
                top: `${(i * 19 + 8) % 88}%`,
                left: `${(((i + 0.5) / emberCount) * 90 + 4).toFixed(2)}%`,
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

      {/* 2. Franja festiva: bastón de caramelo abajo, acebo a los lados, el mensaje al centro */}
      {showBanner && !dismissBanner && (
        <aside
          role="region"
          aria-label={t('avisoDeFestividadActiva', 'Aviso de festividad activa')}
          className="seasonal-banner relative z-40 w-full select-none"
          style={{ backgroundColor: theme === 'halloween' ? '#2a1608' : '#12382a', color: theme === 'halloween' ? '#fed7aa' : '#fef3c7' }}
        >
          <div className="mx-auto flex min-h-11 max-w-[1280px] items-center justify-center gap-3 px-12 py-2 text-center text-sm font-medium leading-snug">
            {theme === 'christmas' ? <HollySprig /> : <span aria-hidden className="text-lg">{info.emoji}</span>}
            <span>{info.mensaje}</span>
            {theme === 'christmas' ? <HollySprig mirror /> : <span aria-hidden className="text-lg">{info.emoji}</span>}
          </div>
          <button
            type="button"
            onClick={() => setDismissBanner(true)}
            className="absolute right-2 top-1/2 grid h-11 w-11 -translate-y-1/2 cursor-pointer place-items-center rounded-lg text-current opacity-80 transition-opacity hover:opacity-100"
            aria-label={t('ocultarAvisoDeFestividad', 'Ocultar aviso de festividad')}
            title={t('ocultarAvisoDeFestividad', 'Ocultar aviso de festividad')}
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
          <div
            aria-hidden
            className="seasonal-banner__stripe h-[3px] w-full"
            style={{
              backgroundImage:
                theme === 'halloween'
                  ? 'repeating-linear-gradient(45deg, #f97316 0 8px, #2a1608 8px 16px)'
                  : 'repeating-linear-gradient(45deg, #dc2626 0 8px, #fef3c7 8px 16px)',
            }}
          />
        </aside>
      )}
    </>
  );
};
