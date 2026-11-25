/**
 * Capa Global de Ambientación Festiva de DocentOS (Halloween & Navidad)
 * Transforma DocentOS en su totalidad durante fechas festivas:
 * - Efectos de partículas (Nieve cósmica para Navidad / Murciélagos y brumas astrales para Halloween)
 * - Tira conmemorativa de temporada
 */

import React, { useState, useEffect } from 'react';
import { useSeasonalDisplay, SEASONAL_INFO } from '../lib/seasonalTheme';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next'
import Snowfall from 'react-snowfall';
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

const snowSprites = [
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="5" fill="#f7fbf8" stroke="#779588" stroke-opacity=".42" stroke-width="1.5"/></svg>',
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 2v20M3.34 7l17.32 10M3.34 17 20.66 7M12 5l-2-2m2 2 2-2m-2 16-2 2m2-2 2 2M5.9 8.5l-2.7.5m2.7-.5-.9-2.5m13.1 9.5 2.7-.5m-2.7.5.9 2.5M5.9 15.5l-.9 2.5m.9-2.5-2.7-.5m13.1-6.5.9-2.5m-.9 2.5 2.7.5" fill="none" stroke="#e9f4ef" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 2v20M2 12h20M5 5l14 14M19 5 5 19M12 5l-2-2m2 2 2-2m-2 14-2 2m2-2 2 2M5 12l-2-2m2 2-2 2m14-2 2-2m-2 2 2 2" fill="none" stroke="#f4f9f6" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
];

export const SeasonalGlobalOverlay: React.FC = () => {
  const { t } = useTranslation();
  const { theme, showBanner, showParticles } = useSeasonalDisplay();
  const [dismissBanner, setDismissBanner] = useState(false);
  const [snowImages, setSnowImages] = useState<HTMLImageElement[]>([]);
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

  useEffect(() => {
    if (theme !== 'christmas') return;
    let active = true;
    Promise.all(snowSprites.map((sprite) => new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = `data:image/svg+xml,${encodeURIComponent(sprite)}`;
    }))).then((images) => {
      if (active) setSnowImages([images[0], images[0], images[0], images[1], images[2]]);
    }).catch(() => {
      if (active) setSnowImages([]);
    });
    return () => { active = false; };
  }, [theme]);

  if (theme === 'none') return null;

  const info = SEASONAL_INFO[theme];

  return (
    <>
      {/* 1. Efecto Ambiental de Fondo en TODO DocentOS (Adaptativo y optimizado para móviles) */}
      {showParticles && theme === 'christmas' && !reduceMotion && (
        <div className="nevada-container pointer-events-none fixed inset-0 z-30 overflow-hidden" aria-hidden="true">
          <Snowfall
            images={snowImages}
            snowflakeCount={narrowScreen ? 14 : 30}
            radius={[2, 6]}
            speed={[0.35, 1.15]}
            wind={[-0.35, 0.35]}
            opacity={[0.3, 0.62]}
            rotationSpeed={[-0.35, 0.35]}
            changeFrequency={180}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
          />
        </div>
      )}

      {showParticles && theme === 'halloween' && (
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
