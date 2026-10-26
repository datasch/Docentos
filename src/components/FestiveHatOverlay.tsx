import React from 'react';
import { useSeasonalTheme, SeasonalTheme } from '../lib/seasonalTheme';

export interface FestiveHatOverlayProps {
  /**
   * Tamaño del gorro según las dimensiones del logo contenedor:
   * - 'xs' (16-24px): logos miniatura
   * - 'sm' (28-36px): navbar y footer (defecto)
   * - 'md' (40-52px): modales y dashboard headers
   * - 'lg' (56-72px): previsualizaciones de plugins y settings
   * - 'xl' (80px+): displays destacados o hero
   */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  /**
   * Forzar festividad específica (opcional, para previsualización o testing)
   */
  forcedTheme?: SeasonalTheme;
  /**
   * Clases adicionales para afinar posicionamiento en logos atípicos
   */
  className?: string;
  /**
   * Título para tooltip accesible
   */
  title?: string;
}

const SIZE_STYLES: Record<'xs' | 'sm' | 'md' | 'lg' | 'xl', {
  container: string;
  witchOffset: string;
  santaOffset: string;
}> = {
  xs: {
    container: 'w-4 h-4',
    witchOffset: '-top-2 -left-1.5',
    santaOffset: '-top-2 -left-1.5',
  },
  sm: {
    container: 'w-6 h-6 sm:w-7 sm:h-7',
    witchOffset: '-top-3 -left-2 sm:-top-3.5 sm:-left-2.5',
    santaOffset: '-top-3 -left-2 sm:-top-3.5 sm:-left-2.5',
  },
  md: {
    container: 'w-8 h-8 sm:w-9 sm:h-9',
    witchOffset: '-top-4 -left-2.5 sm:-top-4.5 sm:-left-3',
    santaOffset: '-top-4 -left-2.5 sm:-top-4.5 sm:-left-3',
  },
  lg: {
    container: 'w-11 h-11 sm:w-13 sm:h-13',
    witchOffset: '-top-5 -left-3.5 sm:-top-6 sm:-left-4',
    santaOffset: '-top-5 -left-3.5 sm:-top-6 sm:-left-4',
  },
  xl: {
    container: 'w-14 h-14 sm:w-16 sm:h-16',
    witchOffset: '-top-7 -left-4 sm:-top-8 sm:-left-5',
    santaOffset: '-top-7 -left-4 sm:-top-8 sm:-left-5',
  },
};

/**
 * FestiveHatOverlay
 *
 * Se adapta de forma universal a CUALQUIER logo (rectangular, cuadrado, circular,
 * SVG o PNG cargado desde el Plugin de Personalización) sin romper la maquetación.
 *
 * - Si es temporada de Halloween (Octubre / principios de Noviembre):
 *   Muestra el Sombrero de Brujas 🧙‍♀️ con cono de terciopelo violeta, cinta de calabaza y hebilla dorada.
 * - Si es temporada de Navidad (finales de Noviembre a principios de Enero):
 *   Muestra el Gorro de Navidad 🎅 con terciopelo rojo, felpa de nieve esponjosa y borla pom-pom.
 * - Resto del año: no se renderiza (cero sobrecarga en el DOM).
 */
export const FestiveHatOverlay: React.FC<FestiveHatOverlayProps> = ({
  size = 'sm',
  forcedTheme,
  className = '',
  title,
}) => {
  const currentTheme = useSeasonalTheme();
  const theme = forcedTheme !== undefined ? forcedTheme : currentTheme;

  if (theme === 'none') {
    return null;
  }

  const config = SIZE_STYLES[size] || SIZE_STYLES.sm;
  const offsetClass = theme === 'halloween' ? config.witchOffset : config.santaOffset;
  const defaultTitle = theme === 'halloween' ? '¡Especial de Halloween!' : '¡Especial de Navidad!';

  return (
    <div
      className={`absolute ${offsetClass} ${config.container} pointer-events-none select-none z-20 transition-transform duration-300 ${className}`}
      title={title || defaultTitle}
      aria-hidden="true"
    >
      {theme === 'halloween' ? (
        /* Sombrero de Brujas - Vector SVG de alta fidelidad adaptativo */
        <svg
          viewBox="0 0 100 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full drop-shadow-[0_2px_8px_rgba(249,115,22,0.45)] transform -rotate-[14deg]"
        >
          <defs>
            <linearGradient id="docentosWitchCone" x1="20" y1="10" x2="80" y2="85" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#7c3aed" />
              <stop offset="35%" stopColor="#4c1d95" />
              <stop offset="70%" stopColor="#2e1065" />
              <stop offset="100%" stopColor="#17062e" />
            </linearGradient>

            <linearGradient id="docentosWitchBrim" x1="10" y1="65" x2="90" y2="85" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#581c87" />
              <stop offset="50%" stopColor="#2e1065" />
              <stop offset="100%" stopColor="#0f031e" />
            </linearGradient>

            <linearGradient id="docentosWitchBand" x1="25" y1="62" x2="75" y2="62" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#fb923c" />
              <stop offset="50%" stopColor="#f97316" />
              <stop offset="100%" stopColor="#c2410c" />
            </linearGradient>

            <linearGradient id="docentosWitchBuckle" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#fef08a" />
              <stop offset="50%" stopColor="#f59e0b" />
              <stop offset="100%" stopColor="#b45309" />
            </linearGradient>
          </defs>

          {/* Sombra base */}
          <ellipse cx="48" cy="74" rx="38" ry="10" fill="#000000" opacity="0.35" />

          {/* Ala ancha ondulada del sombrero */}
          <path
            d="M 12 73 C 14 62, 42 58, 86 64 C 92 68, 88 78, 72 82 C 48 86, 18 84, 12 73 Z"
            fill="url(#docentosWitchBrim)"
          />
          <path
            d="M 16 73 C 32 78, 68 76, 84 66 C 70 70, 36 71, 16 73 Z"
            fill="#090310"
            opacity="0.4"
          />

          {/* Cono torcido y puntiagudo de bruja */}
          <path
            d="M 28 67 C 32 50, 36 34, 48 20 C 53 14, 62 13, 67 19 C 65 27, 59 36, 63 48 C 65 54, 68 59, 70 63 Z"
            fill="url(#docentosWitchCone)"
          />

          {/* Pliegues mágicos */}
          <path
            d="M 48 27 C 44 33, 46 39, 53 45"
            stroke="#9333ea"
            strokeWidth="2"
            strokeLinecap="round"
            fill="none"
            opacity="0.6"
          />
          <path
            d="M 42 44 C 39 49, 42 54, 50 58"
            stroke="#6b21a8"
            strokeWidth="1.8"
            strokeLinecap="round"
            fill="none"
            opacity="0.5"
          />

          {/* Cinta naranja de calabaza */}
          <path
            d="M 27.5 67 C 38 70, 58 68, 70.5 63 L 71 58 C 58 62, 38 64, 28 61 Z"
            fill="url(#docentosWitchBand)"
          />

          {/* Hebilla dorada con reflejos */}
          <g transform="rotate(-6 48 64)">
            <rect x="42" y="59" width="13" height="10" rx="2.5" fill="url(#docentosWitchBuckle)" stroke="#78350f" strokeWidth="0.8" />
            <rect x="45" y="61.5" width="7" height="5" rx="1.5" fill="#1e1035" />
            <line x1="48.5" y1="60" x2="48.5" y2="68" stroke="url(#docentosWitchBuckle)" strokeWidth="1.5" strokeLinecap="round" />
          </g>

          {/* Destello estelar mágico */}
          <path
            d="M 72 16 Q 72 20 76 20 Q 72 20 72 24 Q 72 20 68 20 Q 72 20 72 16 Z"
            fill="#fde047"
            className="animate-pulse"
          />
        </svg>
      ) : (
        /* Gorro de Navidad - Vector SVG de alta fidelidad adaptativo */
        <svg
          viewBox="0 0 100 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full drop-shadow-[0_2px_8px_rgba(239,68,68,0.5)] transform -rotate-[12deg]"
        >
          <defs>
            <linearGradient id="docentosSantaRed" x1="20" y1="15" x2="85" y2="70" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#f87171" />
              <stop offset="30%" stopColor="#ef4444" />
              <stop offset="70%" stopColor="#dc2626" />
              <stop offset="100%" stopColor="#881337" />
            </linearGradient>

            <linearGradient id="docentosSantaFur" x1="15" y1="60" x2="75" y2="75" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="50%" stopColor="#f8fafc" />
              <stop offset="100%" stopColor="#cbd5e1" />
            </linearGradient>

            <radialGradient id="docentosSantaPom" cx="30%" cy="30%" r="70%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="70%" stopColor="#f1f5f9" />
              <stop offset="100%" stopColor="#94a3b8" />
            </radialGradient>
          </defs>

          {/* Sombra base */}
          <ellipse cx="44" cy="74" rx="30" ry="6" fill="#000000" opacity="0.3" />

          {/* Cono rojo festivo que cae hacia la derecha */}
          <path
            d="M 22 64 C 22 42, 34 20, 52 14 C 64 10, 78 18, 80 32 C 82 42, 78 50, 72 54 C 68 46, 67 28, 52 26 C 38 26, 30 42, 28 64 Z"
            fill="url(#docentosSantaRed)"
          />

          {/* Reflejo aterciopelado */}
          <path
            d="M 33 46 C 36 34, 44 23, 53 19"
            stroke="#fca5a5"
            strokeWidth="2.5"
            strokeLinecap="round"
            fill="none"
            opacity="0.65"
          />

          {/* Borla blanca pom-pom en la punta caída */}
          <circle cx="75" cy="54" r="10" fill="url(#docentosSantaPom)" filter="drop-shadow(0 2px 4px rgba(0,0,0,0.25))" />
          <circle cx="73" cy="52" r="8" fill="#ffffff" opacity="0.8" />

          {/* Ribete de felpa blanca / nieve acolchada en la base */}
          <path
            d="M 16 66 C 16 59, 24 58, 28 61 C 32 57, 40 57, 44 60 C 48 56, 56 56, 60 60 C 64 56, 72 58, 74 63 C 76 69, 70 74, 64 72 C 59 74, 50 74, 44 72 C 38 74, 28 74, 22 72 C 17 70, 15 68, 16 66 Z"
            fill="url(#docentosSantaFur)"
            filter="drop-shadow(0 2px 4px rgba(0,0,0,0.25))"
          />

          {/* Destello de estrella invernal */}
          <path
            d="M 52 10 Q 52 14 55 14 Q 52 14 52 18 Q 52 14 49 14 Q 52 14 52 10 Z"
            fill="#fef08a"
            className="animate-pulse"
          />
        </svg>
      )}
    </div>
  );
};
