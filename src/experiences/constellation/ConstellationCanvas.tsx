import React, { useRef, useEffect } from 'react';
import { getCustomLogoUrl, DEFAULT_LOGO_URL, LOGO_CHANGE_EVENT } from '../../lib/logoConfig';
import { getSeasonalTheme, SeasonalTheme, SEASONAL_EVENT_NAME } from '../../lib/seasonalTheme';

// Espectro oficial de 6 colores Giantucchi (Dala Style) - Modo Oscuro
const GIANTUCCHI_SPECTRUM = [
  '#06b6d4', // Cyan
  '#3b82f6', // Blue
  '#a855f7', // Purple
  '#ec4899', // Magenta
  '#f97316', // Orange
  '#eab308', // Yellow
];

// Tonos Joya Saturados para Modo Claro (Garantizan visibilidad y contraste AAA en fondo blanco/off-white)
const COLOR_MAP_LIGHT: Record<string, string> = {
  '#06b6d4': '#0891b2', // Deep Cyan
  '#3b82f6': '#2563eb', // Royal Blue
  '#a855f7': '#7c3aed', // Vivid Violet
  '#ec4899': '#db2777', // Vivid Magenta
  '#f97316': '#ea580c', // Vivid Orange
  '#eab308': '#ca8a04', // Amber Gold
};

interface Particle3D {
  baseX: number;
  baseY: number;
  baseZ: number;
  // Objetivos de la forma del Logo Giantucchi + Gorro Festivo (formado con triángulos)
  logoX: number;
  logoY: number;
  logoZ: number;
  logoColor: string;
  // Posición actual
  x: number;
  y: number;
  z: number;
  dirX: number;
  dirY: number;
  dirZ: number;
  disperseDist: number;
  size: number;
  baseSize: number;
  color: string;
  rotation: number;
  rotSpeed: number;
  pulsePhase: number;
  pulseSpeed: number;
  hemisphere: number; // -1: left, 1: right
}

interface AmbientTriangle {
  x: number;
  y: number;
  size: number;
  color: string;
  vx: number;
  vy: number;
  rotation: number;
  vRot: number;
  opacity: number;
}

interface SynapsePulse {
  fromIdx: number;
  toIdx: number;
  progress: number;
  speed: number;
  color: string;
}

interface ConstellationPoint {
  x: number;
  y: number;
  z: number;
  color: string;
}

// ============================================================================
// GENERADORES GEOMÉTRICOS: GORROS FESTIVOS FORMADOS CON TRIÁNGULOS 3D
// ============================================================================

/**
 * Genera la matriz de coordenadas y colores para formar el Sombrero de Brujas 🧙‍♀️
 * PURAMENTE con los micro-triángulos del scroll animation (sin siluetas 2D sólidas).
 */
function generateWitchHatTrianglePoints(hatX: number, hatY: number, size: number): ConstellationPoint[] {
  const points: ConstellationPoint[] = [];
  const s = size;
  const cosT = Math.cos(-0.24); // ~ -14 deg de inclinación orgánica
  const sinT = Math.sin(-0.24);

  const rotate = (px: number, py: number) => ({
    x: hatX + (px * cosT - py * sinT),
    y: hatY + (px * sinT + py * cosT),
  });

  // 1. Ala ancha (Brim): elipse densa de triángulos violeta eléctrico y púrpura luminoso
  const brimSteps = 55;
  const brimColors = ['#a855f7', '#9333ea', '#c084fc', '#7c3aed', '#8b5cf6', '#d8b4fe'];
  for (let i = 0; i < brimSteps; i++) {
    const angle = (i / brimSteps) * Math.PI * 2;
    const r = 0.45 + Math.random() * 0.55;
    const px = Math.cos(angle) * s * 0.68 * r;
    const py = Math.sin(angle) * s * 0.18 * r;
    const p = rotate(px, py);
    points.push({
      x: p.x,
      y: p.y,
      z: (Math.random() - 0.5) * 0.08,
      color: brimColors[Math.floor(Math.random() * brimColors.length)],
    });
  }

  // 2. Cinta naranja de calabaza (Band): franja densa en tonos calabaza neón muy visibles
  const bandSteps = 35;
  const orangeColors = ['#ff7800', '#f97316', '#fb923c', '#ea580c', '#fdba74'];
  for (let i = 0; i < bandSteps; i++) {
    const t = (i / bandSteps) * 2 - 1; // -1 a 1
    const px = t * s * 0.30;
    const py = -s * 0.05 - Math.random() * (s * 0.07);
    const p = rotate(px, py);
    points.push({
      x: p.x,
      y: p.y,
      z: (Math.random() - 0.5) * 0.06,
      color: orangeColors[Math.floor(Math.random() * orangeColors.length)],
    });
  }

  // 3. Hebilla dorada (Gold Buckle): micro-triángulos en oro brillante en el centro
  const goldColors = ['#fde047', '#facc15', '#fbbf24', '#ffffff', '#eab308'];
  for (let i = 0; i < 16; i++) {
    const px = (Math.random() - 0.5) * s * 0.14;
    const py = -s * 0.08 + (Math.random() - 0.5) * s * 0.08;
    const p = rotate(px, py);
    points.push({
      x: p.x,
      y: p.y,
      z: (Math.random() - 0.5) * 0.05,
      color: goldColors[Math.floor(Math.random() * goldColors.length)],
    });
  }

  // 4. Cono curvado de hechicera (Cone): triángulos violeta vibrante que ascienden y doblan a la derecha
  const coneSteps = 80;
  for (let i = 0; i < coneSteps; i++) {
    const h = i / coneSteps; // 0 (base) a 1 (punta)
    const curWidth = s * 0.28 * (1 - Math.pow(h, 0.85));
    const offsetX = (Math.random() - 0.5) * 2 * curWidth;
    // Curvatura progresiva hacia la derecha
    const bendX = Math.pow(h, 1.9) * s * 0.32;
    const px = bendX + offsetX;
    const py = -s * 0.12 - h * s * 0.72;
    const p = rotate(px, py);

    let coneColor = '#7c3aed';
    if (h < 0.25) coneColor = '#7c3aed';
    else if (h < 0.55) coneColor = '#9333ea';
    else if (h < 0.8) coneColor = '#a855f7';
    else coneColor = '#c084fc';

    points.push({
      x: p.x,
      y: p.y,
      z: (Math.random() - 0.5) * 0.1,
      color: coneColor,
    });
  }

  // 5. Destello de estrella mágica en la punta (Sparkle tip)
  const tipColors = ['#fef08a', '#fef9c3', '#ffffff', '#38bdf8', '#f472b6'];
  for (let i = 0; i < 15; i++) {
    const px = s * 0.32 + (Math.random() - 0.5) * s * 0.10;
    const py = -s * 0.84 + (Math.random() - 0.5) * s * 0.10;
    const p = rotate(px, py);
    points.push({
      x: p.x,
      y: p.y,
      z: (Math.random() - 0.5) * 0.04,
      color: tipColors[Math.floor(Math.random() * tipColors.length)],
    });
  }

  return points;
}

/**
 * Genera la matriz de coordenadas y colores para formar el Gorro de Navidad 🎅
 * PURAMENTE con los micro-triángulos del scroll animation (sin siluetas 2D sólidas).
 */
function generateSantaHatTrianglePoints(hatX: number, hatY: number, size: number): ConstellationPoint[] {
  const points: ConstellationPoint[] = [];
  const s = size;
  const cosT = Math.cos(-0.16); // ~ -9 deg de inclinación
  const sinT = Math.sin(-0.16);

  const rotate = (px: number, py: number) => ({
    x: hatX + (px * cosT - py * sinT),
    y: hatY + (px * sinT + py * cosT),
  });

  // 1. Felpa blanca de la base (White Fur Rim): fila densa de triángulos blancos/nieve
  const rimSteps = 55;
  const whiteColors = ['#ffffff', '#f8fafc', '#f1f5f9', '#e2e8f0'];
  for (let i = 0; i < rimSteps; i++) {
    const t = (i / rimSteps) * 2 - 1; // -1 a 1
    const px = t * s * 0.42;
    const py = (Math.random() - 0.5) * s * 0.14;
    const p = rotate(px, py);
    points.push({
      x: p.x,
      y: p.y,
      z: (Math.random() - 0.5) * 0.08,
      color: whiteColors[Math.floor(Math.random() * whiteColors.length)],
    });
  }

  // 2. Cono rojo de terciopelo (Red Velvet Cone): triángulos que suben y caen a la derecha
  const coneSteps = 85;
  const redColors = ['#ef4444', '#dc2626', '#f87171', '#ff2a4b', '#e11d48', '#b91c1c'];
  for (let i = 0; i < coneSteps; i++) {
    const h = i / coneSteps; // 0 a 1
    const curWidth = s * 0.35 * (1 - Math.pow(h, 0.88));
    const offsetX = (Math.random() - 0.5) * 2 * curWidth;

    let px = 0;
    let py = 0;
    if (h < 0.58) {
      // Ascenso hacia la cumbre
      px = offsetX + (h / 0.58) * s * 0.15;
      py = -s * 0.08 - (h / 0.58) * s * 0.55;
    } else {
      // Caída plegada hacia la derecha
      const dropProgress = (h - 0.58) / 0.42;
      px = offsetX + s * 0.15 + dropProgress * s * 0.35;
      py = -s * 0.63 + Math.pow(dropProgress, 1.35) * s * 0.40;
    }

    const p = rotate(px, py);
    points.push({
      x: p.x,
      y: p.y,
      z: (Math.random() - 0.5) * 0.1,
      color: redColors[Math.floor(Math.random() * redColors.length)],
    });
  }

  // 3. Borla / Pom-pom blanco en la punta caída (Pom-pom)
  const pomSteps = 30;
  for (let i = 0; i < pomSteps; i++) {
    const angle = (i / pomSteps) * Math.PI * 2;
    const r = Math.random() * s * 0.13;
    const px = s * 0.50 + Math.cos(angle) * r;
    const py = -s * 0.23 + Math.sin(angle) * r;
    const p = rotate(px, py);
    points.push({
      x: p.x,
      y: p.y,
      z: (Math.random() - 0.5) * 0.08,
      color: Math.random() > 0.2 ? '#ffffff' : '#fef08a',
    });
  }

  return points;
}

// ============================================================================
// COMPONENTE PRINCIPAL CONSTELLATION CANVAS
// ============================================================================

export const ConstellationCanvas: React.FC<{
  className?: string;
  particleCount?: number;
  fullScreen?: boolean;
}> = ({ className = '', particleCount, fullScreen = true }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let animationFrameId: number;
    let width = window.innerWidth;
    let height = window.innerHeight;
    let isTabVisible = !document.hidden;
    let isCanvasPaused = false;

    // Estado reactivo de festividad estacional
    let currentSeasonalTheme: SeasonalTheme = getSeasonalTheme();

    // Mouse / Cursor Parallax
    let targetRotY = 0;
    let targetRotX = 0;
    let currentRotY = 0;
    let currentRotX = 0;

    // Scroll Animation Tracking (Interpolación con inercia continua)
    let targetScrollY = window.scrollY;
    let currentScrollY = window.scrollY;
    let lastScrollY = window.scrollY;
    let scrollVelocity = 0;

    // Intro animación de ensamblaje inicial
    let introProgress = 0;

    const handleScroll = () => {
      targetScrollY = window.scrollY;
      const isMobileNow = window.innerWidth < 768;
      const cutoffY = isMobileNow ? 900 : 1400;

      // Si el lienzo estaba pausado por scroll profundo y el usuario regresa arriba, reactivar de inmediato
      if (targetScrollY < cutoffY && isCanvasPaused && isTabVisible) {
        isCanvasPaused = false;
        currentScrollY = Math.min(currentScrollY, cutoffY - 10);
        cancelAnimationFrame(animationFrameId);
        animationFrameId = requestAnimationFrame(render);
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });

    const handleMouseMove = (e: MouseEvent) => {
      const x = e.clientX - width / 2;
      const y = e.clientY - height / 2;
      targetRotY = (x / width) * 0.7;
      targetRotX = -(y / height) * 0.5;
    };
    window.addEventListener('mousemove', handleMouseMove, { passive: true });

    const resize = () => {
      const isMobile = window.innerWidth < 768;
      const dpr = isMobile ? 1.0 : Math.min(window.devicePixelRatio || 1, 1.25);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.scale(dpr, dpr);
    };

    resize();
    window.addEventListener('resize', resize);

    // Detección reactiva de modo claro
    let isLight =
      document.documentElement.getAttribute('data-color-mode') === 'light' ||
      document.documentElement.classList.contains('mode-light') ||
      !document.documentElement.classList.contains('dark');

    const handleThemeChange = () => {
      isLight =
        document.documentElement.getAttribute('data-color-mode') === 'light' ||
        document.documentElement.classList.contains('mode-light') ||
        !document.documentElement.classList.contains('dark');
    };

    window.addEventListener('docentos-theme-change', handleThemeChange);
    const themeObserver = new MutationObserver(handleThemeChange);
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-color-mode', 'class'],
    });

    // 1. Inicialización de partículas con geometría base cerebral y fallback del Logo Giantucchi + Gorro de triángulos
    const particles: Particle3D[] = [];
    const isMobileInitial = width < 768;
    const actualParticleCount = particleCount ?? (isMobileInitial ? 180 : 420);
    const brainScale = Math.min(width, height) * (isMobileInitial ? 0.32 : 0.38);

    // Generar puntos iniciales del gorro sobre el fallback si hay festividad
    const fallbackHatPoints =
      currentSeasonalTheme === 'halloween'
        ? generateWitchHatTrianglePoints(-0.28, -0.72, 0.52)
        : currentSeasonalTheme === 'christmas'
        ? generateSantaHatTrianglePoints(-0.28, -0.72, 0.52)
        : [];

    const fallbackHatCount = fallbackHatPoints.length > 0 ? Math.floor(actualParticleCount * 0.34) : 0;

    for (let i = 0; i < actualParticleCount; i++) {
      const hemisphere = Math.random() > 0.5 ? 1 : -1;

      // Forma de cerebro 3D base
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0);

      const rBase = 0.72 + 0.28 * Math.cbrt(Math.random());
      const sulciNoise = Math.sin(theta * 6) * Math.cos(phi * 5) * 0.08 + Math.sin(phi * 8) * 0.04;
      const r = rBase + sulciNoise;

      let px = r * Math.sin(phi) * Math.cos(theta);
      let py = r * Math.sin(phi) * Math.sin(theta) * 0.78;
      let pz = r * Math.cos(phi) * 1.08;

      px = (px * 0.78 + hemisphere * 0.24) * 0.85;

      const baseX = px * brainScale;
      const baseY = py * brainScale;
      const baseZ = pz * brainScale;

      const mag = Math.sqrt(baseX * baseX + baseY * baseY + baseZ * baseZ) || 1;
      const dirX = baseX / mag;
      const dirY = baseY / mag;
      const dirZ = baseZ / mag;
      const disperseDist = (0.8 + Math.random() * 2.6) * Math.max(width, height) * 0.45;

      const color = GIANTUCCHI_SPECTRUM[Math.floor(Math.random() * GIANTUCCHI_SPECTRUM.length)];
      const baseSize = (i < fallbackHatCount && fallbackHatPoints.length > 0)
        ? 1.9 + Math.random() * 2.2
        : 1.1 + Math.random() * 2.4;

      let initLogoX = 0;
      let initLogoY = 0;
      let initLogoZ = (Math.random() - 0.5) * 0.15;
      let initLogoColor = '#06b6d4';

      if (i < fallbackHatCount && fallbackHatPoints.length > 0) {
        // Asignar al gorro festivo formado con triángulos
        const hp = fallbackHatPoints[i % fallbackHatPoints.length];
        initLogoX = hp.x;
        initLogoY = hp.y;
        initLogoZ = hp.z;
        initLogoColor = hp.color;
      } else {
        // Asignar al logotipo "G" base
        const logoIdx = i - fallbackHatCount;
        const totalLogo = actualParticleCount - fallbackHatCount;
        const t = logoIdx / totalLogo;

        if (t < 0.7) {
          const angle = t * Math.PI * 2 * 0.85 - Math.PI * 0.75;
          initLogoX = Math.cos(angle) * 0.85;
          initLogoY = Math.sin(angle) * 0.85;
          initLogoColor = GIANTUCCHI_SPECTRUM[Math.floor(t * 6)];
        } else {
          const at = (t - 0.7) / 0.3;
          initLogoX = 0.15 + at * 0.35;
          initLogoY = 0.15 - at * 0.35;
          initLogoColor = '#f97316';
        }
      }

      particles.push({
        baseX,
        baseY,
        baseZ,
        logoX: initLogoX,
        logoY: initLogoY,
        logoZ: initLogoZ,
        logoColor: initLogoColor,
        x: initLogoX * brainScale,
        y: initLogoY * brainScale,
        z: 0,
        dirX,
        dirY,
        dirZ,
        disperseDist,
        size: baseSize,
        baseSize,
        color,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.04,
        pulsePhase: Math.random() * Math.PI * 2,
        pulseSpeed: 0.02 + Math.random() * 0.03,
        hemisphere,
      });
    }

    // Cargar y muestrear con precisión los píxeles del logo y generar el gorro con triángulos
    const loadAndSampleLogo = (logoUrl: string) => {
      const logoImg = new Image();
      if (!logoUrl.startsWith('data:') && !logoUrl.startsWith('/')) {
        logoImg.crossOrigin = 'anonymous';
      }
      logoImg.src = logoUrl || DEFAULT_LOGO_URL;

      logoImg.onload = () => {
        try {
          const offCanvas = document.createElement('canvas');
          offCanvas.width = 256;
          offCanvas.height = 256;
          const offCtx = offCanvas.getContext('2d');
          if (!offCtx) return;

          offCtx.drawImage(logoImg, 0, 0, 256, 256);
          const data = offCtx.getImageData(0, 0, 256, 256).data;

          // 1. Encontrar límites de píxeles del logotipo
          let minX = 256, maxX = 0, minY = 256, maxY = 0;
          for (let y = 0; y < 256; y++) {
            for (let x = 0; x < 256; x++) {
              const alpha = data[(y * 256 + x) * 4 + 3];
              if (alpha > 50) {
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
              }
            }
          }

          if (minX >= maxX || minY >= maxY) {
            minX = 40; maxX = 216; minY = 40; maxY = 216;
          }

          const logoW = maxX - minX;
          const logoH = maxY - minY;
          const cx = (minX + maxX) / 2;
          const cy = (minY + maxY) / 2;
          const halfSize = Math.max(logoW, logoH) / 2 || 1;

          // 2. Muestrear los puntos reales del logotipo cargado
          const logoPoints: ConstellationPoint[] = [];
          for (let y = minY; y <= maxY; y += 2) {
            for (let x = minX; x <= maxX; x += 2) {
              const idx = (y * 256 + x) * 4;
              if (data[idx + 3] > 60) {
                logoPoints.push({
                  x: (x - cx) / halfSize,
                  y: (y - cy) / halfSize,
                  z: (Math.random() - 0.5) * 0.18,
                  color: `rgb(${data[idx]},${data[idx + 1]},${data[idx + 2]})`,
                });
              }
            }
          }

          // 3. Generar los puntos del gorro adaptado a la forma del logotipo
          const isWide = logoW > logoH * 1.35;
          const hatNormScale = 0.52;
          const hatNormX = isWide ? -0.36 : -0.28;
          const hatNormY = ((minY - cy) / halfSize) + 0.12;

          let hatPoints: ConstellationPoint[] = [];
          if (currentSeasonalTheme === 'halloween') {
            hatPoints = generateWitchHatTrianglePoints(hatNormX, hatNormY, hatNormScale);
          } else if (currentSeasonalTheme === 'christmas') {
            hatPoints = generateSantaHatTrianglePoints(hatNormX, hatNormY, hatNormScale);
          }

          // 4. Distribuir las partículas: 34% de triángulos dedicados a formar el gorro y 66% al logotipo
          const hatParticleCount = hatPoints.length > 0 ? Math.floor(particles.length * 0.34) : 0;
          const logoParticleCount = particles.length - hatParticleCount;

          for (let i = 0; i < particles.length; i++) {
            if (i < hatParticleCount && hatPoints.length > 0) {
              const hp = hatPoints[i % hatPoints.length];
              particles[i].logoX = hp.x;
              particles[i].logoY = hp.y;
              particles[i].logoZ = hp.z;
              particles[i].logoColor = hp.color;
              particles[i].baseSize = 1.9 + Math.random() * 2.2;
            } else if (logoPoints.length > 0) {
              const logoIdx = Math.floor(((i - hatParticleCount) / logoParticleCount) * logoPoints.length);
              const lp = logoPoints[logoIdx] || logoPoints[i % logoPoints.length];
              particles[i].logoX = lp.x;
              particles[i].logoY = lp.y;
              particles[i].logoZ = lp.z;
              particles[i].logoColor = lp.color;
            }
          }
        } catch (e) {
          console.warn('Fallback al muestreo de logo:', e);
        }
      };

      logoImg.onerror = () => {
        if (logoUrl !== DEFAULT_LOGO_URL) {
          loadAndSampleLogo(DEFAULT_LOGO_URL);
        }
      };
    };

    // Muestreo inicial con el logo actualmente configurado
    loadAndSampleLogo(getCustomLogoUrl());

    // Escuchar cambios reactivos en caliente desde el Plugin de Personalización
    const handleLogoUpdate = (e: any) => {
      const newUrl = e.detail?.logoUrl || e.detail?.customLogoUrl || getCustomLogoUrl();
      loadAndSampleLogo(newUrl);
    };
    window.addEventListener(LOGO_CHANGE_EVENT, handleLogoUpdate);
    window.addEventListener('docentos-customizer-change', handleLogoUpdate);

    // Escuchar cambios de festividad estacional para re-ensamblar los triángulos del gorro
    const handleSeasonalUpdate = () => {
      currentSeasonalTheme = getSeasonalTheme();
      loadAndSampleLogo(getCustomLogoUrl());
    };
    window.addEventListener(SEASONAL_EVENT_NAME, handleSeasonalUpdate);

    // 2. Partículas ambientales flotantes en todo el espacio
    const isMobileScreen = width < 768;
    const ambientCount = isMobileScreen ? 12 : 28;
    const ambientParticles: AmbientTriangle[] = [];
    for (let i = 0; i < ambientCount; i++) {
      ambientParticles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        size: 1.4 + Math.random() * 3.2,
        color: GIANTUCCHI_SPECTRUM[Math.floor(Math.random() * GIANTUCCHI_SPECTRUM.length)],
        vx: (Math.random() - 0.5) * 0.25,
        vy: (Math.random() - 0.5) * 0.25,
        rotation: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 0.015,
        opacity: 0.12 + Math.random() * 0.35,
      });
    }

    // 3. Impulsos sinápticos entre nodos
    const synapses: SynapsePulse[] = [];

    const spawnSynapse = (scrollActivity: number) => {
      const maxAllowedSynapses = isMobileScreen ? 1 : (3 + Math.floor(scrollActivity * 2));
      if (synapses.length >= maxAllowedSynapses || particles.length < 2) return;
      const fromIdx = Math.floor(Math.random() * particles.length);
      const toIdx = (fromIdx + Math.floor(Math.random() * 36) + 1) % particles.length;
      synapses.push({
        fromIdx,
        toIdx,
        progress: 0,
        speed: 0.018 + Math.random() * 0.022 + scrollActivity * 0.025,
        color: GIANTUCCHI_SPECTRUM[Math.floor(Math.random() * GIANTUCCHI_SPECTRUM.length)],
      });
    };

    let globalAngle = 0;

    const handleVisibilityChange = () => {
      isTabVisible = !document.hidden;
      if (isTabVisible) {
        animationFrameId = requestAnimationFrame(render);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Dibujo ultrarrápido de micro-triángulo con faceta cristalina semi-rellena y borde luminoso
    const drawFastTriangle = (
      context: CanvasRenderingContext2D,
      tX: number,
      tY: number,
      size: number,
      rot: number,
      color: string,
      alpha: number
    ) => {
      const cosR = Math.cos(rot);
      const sinR = Math.sin(rot);
      const h = size * 1.5;
      const halfW = size * 0.866;

      const yA = -h * 0.65;
      const yBC = h * 0.35;

      const ax = tX - yA * sinR;
      const ay = tY + yA * cosR;

      const bx = tX + halfW * cosR - yBC * sinR;
      const by = tY + halfW * sinR + yBC * cosR;

      const cxPt = tX - halfW * cosR - yBC * sinR;
      const cyPt = tY - halfW * sinR + yBC * cosR;

      const minAlpha = isLight ? 0.32 : 0.05;
      const clampedAlpha = Math.max(minAlpha, Math.min(1, alpha));

      context.beginPath();
      context.moveTo(ax, ay);
      context.lineTo(bx, by);
      context.lineTo(cxPt, cyPt);
      context.closePath();

      // Faceta cristalina semi-rellena: le da cuerpo y presencia geométrica reconocible al sombrero y logo
      context.fillStyle = color;
      context.globalAlpha = clampedAlpha * 0.65;
      context.fill();

      // Arista brillante de la constelación
      context.strokeStyle = color;
      context.globalAlpha = clampedAlpha;
      context.stroke();
    };

    const render = () => {
      if (!isTabVisible) return;

      // 1. Interpolación suave del scroll con inercia (calculada SIEMPRE al inicio de cada frame)
      const scrollDelta = targetScrollY - currentScrollY;
      currentScrollY += scrollDelta * 0.08;
      scrollVelocity = targetScrollY - lastScrollY;
      lastScrollY = targetScrollY;

      const isMobileNow = width < 768;
      const cutoffY = isMobileNow ? 900 : 1400;

      // Pausar y vaciar renderizado ÚNICAMENTE si tanto el scroll real como el interpolado están lejos del hero
      if (currentScrollY > cutoffY && targetScrollY > cutoffY) {
        isCanvasPaused = true;
        ctx.clearRect(0, 0, width, height);
        return;
      }

      ctx.clearRect(0, 0, width, height);
      ctx.lineWidth = isLight ? 1.35 : 1.15;

      // 2. Intro animación suave al inicio
      introProgress = Math.min(introProgress + 0.022, 1.0);
      const introEase = 1 - Math.pow(1 - introProgress, 3);

      // Lerp del mouse
      currentRotY += (targetRotY - currentRotY) * 0.05;
      currentRotX += (targetRotX - currentRotX) * 0.05;
      globalAngle += 0.003;

      // Peso de deformación del logo en scroll
      const morphProgress = Math.min(currentScrollY / 320, 1.0);
      const logoWeight = Math.max(0, 1.0 - Math.pow(morphProgress, 1.25)) * introEase;

      // Dispersión cósmica en scroll más profundo
      const deepScrollFactor = Math.max(0, (currentScrollY - 140) / 540);
      const dispersionEase = Math.pow(Math.min(deepScrollFactor, 2.0), 1.25);

      // Rotación 3D impulsada dinámicamente por el scroll
      const rotDampener = (1 - logoWeight * 0.85);
      const scrollRotY = currentScrollY * 0.0028 * rotDampener;
      const scrollRotX = (Math.sin(currentScrollY * 0.0014) * 0.4 + Math.min(Math.max(scrollVelocity * 0.005, -0.45), 0.45)) * rotDampener;

      const totalRotY = (globalAngle * 0.2 * (1 - logoWeight)) + currentRotY * 0.4 + scrollRotY;
      const totalRotX = currentRotX * 0.4 + Math.sin(globalAngle * 0.5) * 0.04 * (1 - logoWeight) + scrollRotX;

      const cosY = Math.cos(totalRotY);
      const sinY = Math.sin(totalRotY);
      const cosX = Math.cos(totalRotX);
      const sinX = Math.sin(totalRotX);

      // Posicionamiento dinámico del centro focal
      const isDesktop = width >= 1024;
      const heroCenterX = isDesktop ? width * 0.72 : width * 0.5;
      const heroCenterY = isDesktop ? Math.min(height * 0.46, 440) : height * 0.42;

      const centerTransition = Math.min(currentScrollY / 500, 1.0);
      const cx = heroCenterX + (width * 0.5 - heroCenterX) * centerTransition;
      const cy = heroCenterY + (height * 0.5 - heroCenterY) * centerTransition;

      const fov = 440 + dispersionEase * 80;

      // Partículas ambientales de fondo
      for (let i = 0; i < ambientParticles.length; i++) {
        const ap = ambientParticles[i];
        ap.x += ap.vx;
        ap.y += ap.vy - scrollVelocity * 0.18;
        ap.rotation += ap.vRot;

        if (ap.x < -30) ap.x = width + 30;
        if (ap.x > width + 30) ap.x = -30;
        if (ap.y < -30) ap.y = height + 30;
        if (ap.y > height + 30) ap.y = -30;

        drawFastTriangle(ctx, ap.x, ap.y, ap.size, ap.rotation, ap.color, ap.opacity);
      }

      // Impulsos sinápticos
      const scrollActivity = Math.min(Math.abs(scrollVelocity) * 0.04, 1);
      const synapseChance = 0.05 + Math.min(scrollActivity * 0.03, 0.3);
      if (Math.random() < synapseChance) spawnSynapse(scrollActivity);

      for (let s = synapses.length - 1; s >= 0; s--) {
        const syn = synapses[s];
        syn.progress += syn.speed;

        const pA = particles[syn.fromIdx];
        const pB = particles[syn.toIdx];

        if (pA && pB && syn.progress < 1) {
          const xA1 = pA.x * cosY - pA.z * sinY;
          const zA1 = pA.x * sinY + pA.z * cosY;
          const yA2 = pA.y * cosX - zA1 * sinX;
          const zA2 = pA.y * sinX + zA1 * cosX;
          const scaleA = fov / (fov + zA2);
          const xA2d = cx + xA1 * scaleA;
          const yA2d = cy + yA2 * scaleA;

          const xB1 = pB.x * cosY - pB.z * sinY;
          const zB1 = pB.x * sinY + pB.z * cosY;
          const yB2 = pB.y * cosX - zB1 * sinX;
          const zB2 = pB.y * sinX + zB1 * cosX;
          const scaleB = fov / (fov + zB2);
          const xB2d = cx + xB1 * scaleB;
          const yB2d = cy + yB2 * scaleB;

          const lineAlpha = (1 - syn.progress) * (isLight ? 0.75 : 0.55);
          const synColor = isLight ? (COLOR_MAP_LIGHT[syn.color] || syn.color) : syn.color;
          ctx.strokeStyle = synColor;
          ctx.lineWidth = isLight ? 1.35 : 1.0;
          ctx.globalAlpha = lineAlpha;
          ctx.beginPath();
          ctx.moveTo(xA2d, yA2d);
          ctx.lineTo(xB2d, yB2d);
          ctx.stroke();

          const sparkX = xA2d + (xB2d - xA2d) * syn.progress;
          const sparkY = yA2d + (yB2d - yA2d) * syn.progress;
          ctx.fillStyle = isLight ? '#0f172a' : '#ffffff';
          ctx.globalAlpha = (1 - syn.progress) * 0.95;
          ctx.beginPath();
          ctx.arc(sparkX, sparkY, isLight ? 2.5 : 2.0, 0, Math.PI * 2);
          ctx.fill();
        } else {
          synapses.splice(s, 1);
        }
      }

      ctx.lineWidth = isLight ? 1.35 : 1.15;

      const swirlAngle = dispersionEase * 1.4;
      const cosS = Math.cos(swirlAngle);
      const sinS = Math.sin(swirlAngle);

      const logoScale = brainScale * 0.95;

      // Iteración y dibujado de los triángulos 3D de la constelación:
      // Forman el logotipo y el sombrero festivo 100% con triángulos reactivos
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.rotation += p.rotSpeed + Math.abs(scrollVelocity) * 0.004;
        p.pulsePhase += p.pulseSpeed;

        // 1. Posición Logo + Sombrero de Triángulos
        const lX = p.logoX * logoScale;
        const lY = p.logoY * logoScale;
        const lZ = p.logoZ * logoScale;

        // 2. Posición Red Neuronal / Nebulosa
        const expandX = p.dirX * p.disperseDist * dispersionEase;
        const expandY = p.dirY * p.disperseDist * dispersionEase;
        const expandZ = p.dirZ * p.disperseDist * dispersionEase;

        const bX = p.baseX + (expandX * cosS - expandZ * sinS);
        const bY = p.baseY + expandY;
        const bZ = p.baseZ + (expandX * sinS + expandZ * cosS);

        // Interpolación fluida: Logo y Sombrero -> Dispersión en Scroll
        const deformWave = Math.sin(p.pulsePhase + globalAngle * 2) * (1 - logoWeight) * 12;

        p.x = lX * logoWeight + bX * (1 - logoWeight) + deformWave * 0.2;
        p.y = lY * logoWeight + bY * (1 - logoWeight) + deformWave * 0.2;
        p.z = lZ * logoWeight + bZ * (1 - logoWeight);

        // Rotación 3D
        const x1 = p.x * cosY - p.z * sinY;
        const z1 = p.x * sinY + p.z * cosY;

        const y2 = p.y * cosX - z1 * sinX;
        const z2 = p.y * sinX + z1 * cosX;

        const dist = fov + z2;
        if (dist <= 10) continue;

        const scale = fov / dist;
        const x2d = cx + x1 * scale;
        const y2d = cy + y2 * scale;

        if (x2d < -80 || x2d > width + 80 || y2d < -80 || y2d > height + 80) continue;

        // Opacidad y brillo
        const depthAlpha = Math.max(0.18, Math.min(1.0, (z2 + brainScale * (1 + dispersionEase)) / (brainScale * 2.5)));
        const pulse = 0.85 + 0.25 * Math.sin(p.pulsePhase);
        const alpha = Math.min(1.0, depthAlpha * pulse * (0.4 + logoWeight * 0.6));

        // Color
        let displayColor = logoWeight > 0.4 ? p.logoColor : p.color;
        if (isLight && COLOR_MAP_LIGHT[displayColor]) {
          displayColor = COLOR_MAP_LIGHT[displayColor];
        }

        const dynamicSize = p.baseSize * (1 + dispersionEase * 0.35);

        // Todos los elementos (logo + sombrero festivo) se dibujan exclusivamente como micro-triángulos 3D
        drawFastTriangle(ctx, x2d, y2d, dynamicSize, p.rotation, displayColor, alpha);
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', resize);
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('docentos-theme-change', handleThemeChange);
      window.removeEventListener(LOGO_CHANGE_EVENT, handleLogoUpdate);
      window.removeEventListener('docentos-customizer-change', handleLogoUpdate);
      window.removeEventListener(SEASONAL_EVENT_NAME, handleSeasonalUpdate);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      themeObserver.disconnect();
    };
  }, [particleCount]);

  if (fullScreen) {
    return (
      <div className={`fixed inset-0 w-full h-full pointer-events-none z-0 overflow-hidden ${className}`}>
        {/* Resplandor atmosférico etéreo: activo solo en pantallas medianas/grandes para no ralentizar móviles */}
        <div
          aria-hidden="true"
          className="hidden md:block absolute top-1/4 right-1/4 w-[480px] h-[480px] rounded-full blur-[140px] opacity-15 dark:opacity-25 pointer-events-none -z-10 bg-gradient-to-tr from-[#06b6d4] via-[#a855f7] to-[#eab308]"
        />
        <canvas
          ref={canvasRef}
          className="w-full h-full block"
          style={{ touchAction: 'none' }}
        />
      </div>
    );
  }

  return (
    <div className={`relative w-full h-full flex items-center justify-center select-none ${className}`}>
      <canvas
        ref={canvasRef}
        className="w-full h-full block cursor-crosshair"
        style={{ minHeight: '400px', touchAction: 'none' }}
      />
    </div>
  );
};
