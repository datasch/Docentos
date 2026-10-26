import React from 'react';
import { SeasonalTheme } from '../../lib/seasonalTheme';

interface ModuleSideDecorationsProps {
  seasonalTheme: SeasonalTheme;
  modIdx: number;
  height: number;
}

export const ModuleSideDecorations: React.FC<ModuleSideDecorationsProps> = ({
  seasonalTheme,
  modIdx,
  height,
}) => {
  const variant = modIdx % 4;
  const leftY = Math.round(height * 0.28);
  const rightY = Math.round(height * 0.62);

  if (seasonalTheme === 'halloween') {
    return (
      <div aria-hidden="true" className="pointer-events-none select-none absolute inset-0 z-0 overflow-visible hidden md:block">
        {/* Decoración Izquierda */}
        <div
          className="absolute -left-20 sm:-left-32 lg:-left-44 animate-[float_6s_ease-in-out_infinite] opacity-95 transition-transform duration-300 hover:scale-110"
          style={{ top: `${leftY}px` }}
        >
          {variant === 0 && (
            <div className="flex flex-col items-center">
              <svg className="w-16 h-16 sm:w-22 sm:h-22 filter drop-shadow-[0_0_24px_rgba(249,115,22,0.75)]" viewBox="0 0 100 100" fill="none">
                <defs>
                  <radialGradient id={`pump-b-${modIdx}`} cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#fb923c" />
                    <stop offset="65%" stopColor="#ea580c" />
                    <stop offset="100%" stopColor="#9a3412" />
                  </radialGradient>
                </defs>
                <path d="M47 18 C46 10, 56 6, 62 8 C58 13, 53 16, 51 22 Z" fill="#65a30d" stroke="#3f6212" strokeWidth="1.5" />
                <ellipse cx="50" cy="56" rx="38" ry="34" fill={`url(#pump-b-${modIdx})`} stroke="#7c2d12" strokeWidth="2" />
                <polygon points="34,44 44,48 38,55" fill="#fef08a" className="animate-pulse" />
                <polygon points="66,44 56,48 62,55" fill="#fef08a" className="animate-pulse" />
                <polygon points="50,56 46,62 54,62" fill="#fef08a" />
                <path d="M30 68 Q50 86 70 68 Q64 74 58 70 Q54 77 50 71 Q46 77 42 70 Q36 74 30 68 Z" fill="#fef08a" />
              </svg>
              <span className="text-[10px] font-black uppercase tracking-wider text-orange-400 font-mono mt-1 bg-black/60 dark:bg-black/80 px-2 py-0.5 rounded-full border border-orange-500/30">
                🎃 Jack-o'
              </span>
            </div>
          )}

          {variant === 1 && (
            <div className="flex flex-col items-center">
              <svg className="w-16 h-16 sm:w-22 sm:h-22 filter drop-shadow-[0_0_24px_rgba(34,197,94,0.7)]" viewBox="0 0 100 100" fill="none">
                <ellipse cx="50" cy="38" rx="36" ry="10" fill="#1e1b4b" stroke="#818cf8" strokeWidth="2" />
                <path d="M16 40 C14 74, 30 88, 50 88 C70 88, 86 74, 84 40 Z" fill="#0f172a" stroke="#818cf8" strokeWidth="2.5" />
                <path d="M26 84 L20 94 M74 84 L80 94 M50 88 L50 96" stroke="#6366f1" strokeWidth="3" strokeLinecap="round" />
                <ellipse cx="50" cy="38" rx="30" ry="7" fill="#22c55e" />
                <circle cx="42" cy="28" r="4.5" fill="#4ade80" className="animate-bounce" />
                <circle cx="58" cy="22" r="3" fill="#86efac" className="animate-ping" />
              </svg>
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 font-mono mt-1 bg-black/60 dark:bg-black/80 px-2 py-0.5 rounded-full border border-emerald-500/30">
                🧪 Poción IA
              </span>
            </div>
          )}

          {variant === 2 && (
            <div className="flex flex-col items-center">
              <svg className="w-15 h-16 sm:w-20 sm:h-22 filter drop-shadow-[0_0_22px_rgba(251,191,36,0.75)]" viewBox="0 0 100 100" fill="none">
                <rect x="34" y="45" width="14" height="40" rx="3" fill="#fef3c7" stroke="#d97706" strokeWidth="1.5" />
                <ellipse cx="41" cy="45" rx="7" ry="2.5" fill="#fde68a" />
                <path d="M41 44 L41 36" stroke="#78350f" strokeWidth="2" />
                <path d="M41 36 Q37 26 41 20 Q45 26 41 36 Z" fill="#f59e0b" className="animate-pulse" />
                <circle cx="41" cy="27" r="2" fill="#ffffff" />
                <rect x="56" y="55" width="14" height="30" rx="3" fill="#fef3c7" stroke="#d97706" strokeWidth="1.5" />
                <ellipse cx="63" cy="55" rx="7" ry="2.5" fill="#fde68a" />
                <path d="M63 54 L63 46" stroke="#78350f" strokeWidth="2" />
                <path d="M63 46 Q59 38 63 32 Q67 38 63 46 Z" fill="#ea580c" className="animate-pulse" />
              </svg>
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 font-mono mt-1 bg-black/60 dark:bg-black/80 px-2 py-0.5 rounded-full border border-amber-500/30">
                🕯 Vigilia
              </span>
            </div>
          )}

          {variant === 3 && (
            <div className="flex flex-col items-center">
              <svg className="w-16 h-16 sm:w-20 sm:h-20 filter drop-shadow-[0_0_24px_rgba(168,85,247,0.7)]" viewBox="0 0 100 100" fill="none">
                <ellipse cx="50" cy="46" rx="30" ry="26" fill="#f1f5f9" stroke="#9333ea" strokeWidth="2" />
                <ellipse cx="38" cy="44" rx="8" ry="10" fill="#1e1b4b" />
                <ellipse cx="62" cy="44" rx="8" ry="10" fill="#1e1b4b" />
                <polygon points="50,56 46,64 54,64" fill="#1e1b4b" />
                <rect x="36" y="70" width="28" height="12" rx="4" fill="#f1f5f9" stroke="#9333ea" strokeWidth="1.5" />
                <line x1="43" y1="70" x2="43" y2="82" stroke="#9333ea" strokeWidth="1.5" />
                <line x1="50" y1="70" x2="50" y2="82" stroke="#9333ea" strokeWidth="1.5" />
                <line x1="57" y1="70" x2="57" y2="82" stroke="#9333ea" strokeWidth="1.5" />
              </svg>
              <span className="text-[10px] font-black uppercase tracking-wider text-purple-400 font-mono mt-1 bg-black/60 dark:bg-black/80 px-2 py-0.5 rounded-full border border-purple-500/30">
                💀 Calavera IA
              </span>
            </div>
          )}
        </div>

        {/* Decoración Derecha */}
        <div
          className="absolute -right-20 sm:-right-32 lg:-right-44 animate-[float_7s_ease-in-out_infinite_1.5s] opacity-95 transition-transform duration-300 hover:scale-110"
          style={{ top: `${rightY}px` }}
        >
          {variant === 0 && (
            <div className="flex flex-col items-center">
              <svg className="w-18 h-14 sm:w-24 sm:h-18 filter drop-shadow-[0_0_22px_rgba(168,85,247,0.7)]" viewBox="0 0 120 80" fill="none">
                <path
                  d="M60 42 C64 36, 75 22, 95 24 C108 26, 118 35, 114 44 C106 44, 100 50, 92 48 C84 48, 80 56, 74 54 C68 54, 64 50, 60 48 C56 50, 52 54, 46 54 C40 56, 36 48, 28 48 C20 50, 14 44, 6 44 C2 35, 12 26, 25 24 C45 22, 56 36, 60 42 Z"
                  fill="#3b0764"
                  stroke="#c084fc"
                  strokeWidth="2.5"
                />
                <circle cx="56" cy="40" r="2.5" fill="#f97316" className="animate-ping" />
                <circle cx="64" cy="40" r="2.5" fill="#f97316" className="animate-ping" />
              </svg>
              <span className="text-[10px] font-black uppercase tracking-wider text-purple-400 font-mono mt-1 bg-black/60 dark:bg-black/80 px-2 py-0.5 rounded-full border border-purple-500/30">
                🦇 Murciélago
              </span>
            </div>
          )}

          {variant === 1 && (
            <div className="flex flex-col items-center">
              <svg className="w-16 h-18 sm:w-22 sm:h-24 filter drop-shadow-[0_0_24px_rgba(167,139,250,0.7)]" viewBox="0 0 100 110" fill="none">
                <path
                  d="M50 16 C30 16, 20 34, 20 60 C20 84, 25 96, 32 88 C38 82, 44 94, 50 88 C56 82, 62 94, 68 88 C75 96, 80 84, 80 60 C80 34, 70 16, 50 16 Z"
                  fill="#ffffff"
                  stroke="#a78bfa"
                  strokeWidth="2"
                  opacity="0.9"
                />
                <polygon points="50,4 34,18 66,18" fill="#581c87" stroke="#f59e0b" strokeWidth="1.5" />
                <ellipse cx="50" cy="18" rx="20" ry="4" fill="#3b0764" />
                <ellipse cx="42" cy="42" rx="4" ry="6" fill="#1e1b4b" />
                <ellipse cx="58" cy="42" rx="4" ry="6" fill="#1e1b4b" />
                <ellipse cx="50" cy="54" rx="3.5" ry="5" fill="#312e81" />
              </svg>
              <span className="text-[10px] font-black uppercase tracking-wider text-indigo-400 font-mono mt-1 bg-black/60 dark:bg-black/80 px-2 py-0.5 rounded-full border border-indigo-500/30">
                👻 Espectro
              </span>
            </div>
          )}

          {variant === 2 && (
            <div className="flex flex-col items-center">
              <svg className="w-16 h-16 sm:w-20 sm:h-20 filter drop-shadow-[0_0_20px_rgba(244,63,94,0.7)]" viewBox="0 0 100 100" fill="none">
                <path d="M90 10 L10 90 M50 10 L50 90 M10 50 L90 50 M10 10 L90 90" stroke="rgba(244,63,94,0.4)" strokeWidth="1.5" />
                <circle cx="50" cy="50" r="16" stroke="rgba(244,63,94,0.5)" strokeWidth="1.5" fill="none" />
                <circle cx="50" cy="50" r="28" stroke="rgba(244,63,94,0.4)" strokeWidth="1.5" fill="none" />
                <circle cx="50" cy="50" r="8" fill="#e11d48" stroke="#ffffff" strokeWidth="2" className="animate-ping" />
              </svg>
              <span className="text-[10px] font-black uppercase tracking-wider text-rose-400 font-mono mt-1 bg-black/60 dark:bg-black/80 px-2 py-0.5 rounded-full border border-rose-500/30">
                🕸 Telaraña
              </span>
            </div>
          )}

          {variant === 3 && (
            <div className="flex flex-col items-center">
              <svg className="w-16 h-16 sm:w-20 sm:h-20 filter drop-shadow-[0_0_22px_rgba(234,179,8,0.75)]" viewBox="0 0 100 100" fill="none">
                <ellipse cx="50" cy="50" rx="20" ry="14" fill="#f59e0b" stroke="#b45309" strokeWidth="2" transform="rotate(-30 50 50)" />
                <polygon points="34,58 20,68 28,52" fill="#ef4444" />
                <polygon points="66,42 80,32 72,48" fill="#ef4444" />
                <line x1="42" y1="44" x2="58" y2="56" stroke="#ffffff" strokeWidth="2" />
              </svg>
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 font-mono mt-1 bg-black/60 dark:bg-black/80 px-2 py-0.5 rounded-full border border-amber-500/30">
                🍬 Dulce Lunar
              </span>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (seasonalTheme === 'christmas') {
    return (
      <div aria-hidden="true" className="pointer-events-none select-none absolute inset-0 z-0 overflow-visible hidden md:block">
        {/* Decoración Izquierda */}
        <div
          className="absolute -left-20 sm:-left-32 lg:-left-44 animate-[float_6.5s_ease-in-out_infinite] opacity-95 transition-transform duration-300 hover:scale-110"
          style={{ top: `${leftY}px` }}
        >
          {variant === 0 && (
            <div className="flex flex-col items-center">
              <svg className="w-18 h-22 sm:w-24 sm:h-28 filter drop-shadow-[0_0_26px_rgba(16,185,129,0.75)]" viewBox="0 0 100 120" fill="none">
                <rect x="44" y="94" width="12" height="18" rx="2" fill="#78350f" stroke="#451a03" strokeWidth="1.5" />
                <polygon points="50,18 20,54 80,54" fill="#059669" stroke="#047857" strokeWidth="2" />
                <polygon points="50,40 14,74 86,74" fill="#059669" stroke="#047857" strokeWidth="2" />
                <polygon points="50,60 8,96 92,96" fill="#059669" stroke="#047857" strokeWidth="2" />
                <polygon points="50,6 53,14 62,14 55,19 57,27 50,22 43,27 45,19 38,14 47,14" fill="#fbbf24" stroke="#f59e0b" strokeWidth="1.5" className="animate-pulse" />
                <circle cx="36" cy="46" r="3.5" fill="#ef4444" className="animate-ping" />
                <circle cx="64" cy="48" r="3.5" fill="#3b82f6" />
                <circle cx="50" cy="66" r="3.5" fill="#ec4899" className="animate-ping" />
              </svg>
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 font-mono mt-1 bg-black/60 dark:bg-black/80 px-2 py-0.5 rounded-full border border-emerald-500/30">
                🎄 Árbol Polar
              </span>
            </div>
          )}

          {variant === 1 && (
            <div className="flex flex-col items-center">
              <svg className="w-16 h-16 sm:w-22 sm:h-22 filter drop-shadow-[0_0_24px_rgba(251,191,36,0.75)]" viewBox="0 0 100 100" fill="none">
                <rect x="22" y="38" width="56" height="48" rx="5" fill="#dc2626" stroke="#991b1b" strokeWidth="2" />
                <rect x="18" y="30" width="64" height="14" rx="3" fill="#ef4444" stroke="#991b1b" strokeWidth="2" />
                <rect x="45" y="30" width="10" height="56" fill="#fbbf24" stroke="#d97706" strokeWidth="1" />
                <rect x="22" y="56" width="56" height="10" fill="#fbbf24" stroke="#d97706" strokeWidth="1" />
                <ellipse cx="40" cy="24" rx="10" ry="7" fill="#f59e0b" stroke="#b45309" strokeWidth="1.5" transform="rotate(-20 40 24)" />
                <ellipse cx="60" cy="24" rx="10" ry="7" fill="#f59e0b" stroke="#b45309" strokeWidth="1.5" transform="rotate(20 60 24)" />
              </svg>
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-300 font-mono mt-1 bg-black/60 dark:bg-black/80 px-2 py-0.5 rounded-full border border-amber-500/30">
                🎁 Regalo Pro
              </span>
            </div>
          )}

          {variant === 2 && (
            <div className="flex flex-col items-center">
              <svg className="w-16 h-20 sm:w-22 sm:h-26 filter drop-shadow-[0_0_24px_rgba(186,230,253,0.75)]" viewBox="0 0 100 110" fill="none">
                <circle cx="50" cy="74" r="28" fill="#ffffff" stroke="#bae6fd" strokeWidth="2.5" />
                <circle cx="50" cy="38" r="20" fill="#ffffff" stroke="#bae6fd" strokeWidth="2.5" />
                <circle cx="44" cy="34" r="2.5" fill="#0f172a" />
                <circle cx="56" cy="34" r="2.5" fill="#0f172a" />
                <polygon points="50,38 68,40 50,42" fill="#f97316" stroke="#c2410c" strokeWidth="1" />
                <path d="M34 50 Q50 56 66 50 Q66 58 50 60 Q34 58 34 50 Z" fill="#dc2626" />
                <circle cx="50" cy="66" r="2.5" fill="#0f172a" />
                <circle cx="50" cy="78" r="2.5" fill="#0f172a" />
              </svg>
              <span className="text-[10px] font-black uppercase tracking-wider text-sky-300 font-mono mt-1 bg-black/60 dark:bg-black/80 px-2 py-0.5 rounded-full border border-sky-500/30">
                ⛄ Muñeco Nieve
              </span>
            </div>
          )}

          {variant === 3 && (
            <div className="flex flex-col items-center">
              <svg className="w-16 h-16 sm:w-22 sm:h-22 filter drop-shadow-[0_0_24px_rgba(250,204,21,0.8)]" viewBox="0 0 100 100" fill="none">
                <circle cx="50" cy="50" r="32" stroke="#10b981" strokeWidth="10" strokeDasharray="8 6" fill="none" />
                <circle cx="50" cy="50" r="32" stroke="#ef4444" strokeWidth="10" strokeDasharray="3 24" fill="none" />
                <circle cx="50" cy="20" r="6" fill="#dc2626" />
                <polygon points="50,20 40,8 44,22" fill="#ef4444" />
                <polygon points="50,20 60,8 56,22" fill="#ef4444" />
              </svg>
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 font-mono mt-1 bg-black/60 dark:bg-black/80 px-2 py-0.5 rounded-full border border-emerald-500/30">
                🌿 Corona Polar
              </span>
            </div>
          )}
        </div>

        {/* Decoración Derecha */}
        <div
          className="absolute -right-20 sm:-right-32 lg:-right-44 animate-[float_7s_ease-in-out_infinite_1.2s] opacity-95 transition-transform duration-300 hover:scale-110"
          style={{ top: `${rightY}px` }}
        >
          {variant === 0 && (
            <div className="flex flex-col items-center">
              <svg className="w-16 h-18 sm:w-22 sm:h-24 filter drop-shadow-[0_0_24px_rgba(239,68,68,0.75)]" viewBox="0 0 100 100" fill="none">
                <path d="M32 85 L32 35 C32 18, 52 18, 52 32" stroke="#ffffff" strokeWidth="12" strokeLinecap="round" fill="none" />
                <path d="M32 85 L32 35 C32 18, 52 18, 52 32" stroke="#dc2626" strokeWidth="12" strokeLinecap="round" strokeDasharray="6 8" fill="none" />
                <circle cx="42" cy="50" r="6" fill="#fbbf24" stroke="#d97706" strokeWidth="2" />
              </svg>
              <span className="text-[10px] font-black uppercase tracking-wider text-red-400 font-mono mt-1 bg-black/60 dark:bg-black/80 px-2 py-0.5 rounded-full border border-red-500/30">
                🍬 Bastón Festivo
              </span>
            </div>
          )}

          {variant === 1 && (
            <div className="flex flex-col items-center">
              <svg className="w-16 h-16 sm:w-22 sm:h-22 filter drop-shadow-[0_0_24px_rgba(250,204,21,0.8)]" viewBox="0 0 100 100" fill="none">
                <path d="M50 24 C40 24, 30 38, 28 62 C26 70, 20 74, 20 78 C20 84, 80 84, 80 78 C80 74, 74 70, 72 62 C70 38, 60 24, 50 24 Z" fill="#fbbf24" stroke="#d97706" strokeWidth="2.5" />
                <ellipse cx="50" cy="78" rx="28" ry="6" fill="#f59e0b" stroke="#b45309" strokeWidth="2" />
                <circle cx="50" cy="85" r="6" fill="#78350f" />
                <circle cx="50" cy="22" r="5" fill="#ef4444" />
              </svg>
              <span className="text-[10px] font-black uppercase tracking-wider text-yellow-300 font-mono mt-1 bg-black/60 dark:bg-black/80 px-2 py-0.5 rounded-full border border-yellow-500/30">
                🔔 Campanas
              </span>
            </div>
          )}

          {variant === 2 && (
            <div className="flex flex-col items-center">
              <svg className="w-16 h-16 sm:w-22 sm:h-22 filter drop-shadow-[0_0_24px_rgba(244,63,94,0.7)]" viewBox="0 0 100 100" fill="none">
                <circle cx="50" cy="54" r="32" fill="#059669" stroke="#10b981" strokeWidth="2.5" />
                <ellipse cx="40" cy="42" rx="10" ry="16" fill="#ffffff" opacity="0.35" transform="rotate(-30 40 42)" />
                <rect x="42" y="16" width="16" height="8" rx="2" fill="#fbbf24" stroke="#d97706" strokeWidth="1.5" />
                <circle cx="50" cy="12" r="5" fill="none" stroke="#fbbf24" strokeWidth="2" />
              </svg>
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-300 font-mono mt-1 bg-black/60 dark:bg-black/80 px-2 py-0.5 rounded-full border border-emerald-500/30">
                ❄ Esfera Polar
              </span>
            </div>
          )}

          {variant === 3 && (
            <div className="flex flex-col items-center">
              <svg className="w-16 h-16 sm:w-22 sm:h-22 filter drop-shadow-[0_0_26px_rgba(250,204,21,0.85)]" viewBox="0 0 100 100" fill="none">
                <polygon points="50,10 58,35 85,35 64,52 72,78 50,62 28,78 36,52 15,35 42,35" fill="#facc15" stroke="#f59e0b" strokeWidth="2" className="animate-pulse" />
                <circle cx="50" cy="46" r="6" fill="#ffffff" />
              </svg>
              <span className="text-[10px] font-black uppercase tracking-wider text-yellow-300 font-mono mt-1 bg-black/60 dark:bg-black/80 px-2 py-0.5 rounded-full border border-yellow-500/30">
                ⭐ Estrella Belén
              </span>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Cósmico Estándar
  return (
    <div aria-hidden="true" className="pointer-events-none select-none absolute inset-0 z-0 overflow-visible hidden md:block">
      {/* Decoración Izquierda */}
      <div
        className="absolute -left-20 sm:-left-32 lg:-left-44 animate-[float_7s_ease-in-out_infinite] opacity-95 transition-transform duration-300 hover:scale-110"
        style={{ top: `${leftY}px` }}
      >
        {variant === 0 && (
          <div className="flex flex-col items-center">
            <svg className="w-18 h-18 sm:w-24 sm:h-24 filter drop-shadow-[0_0_24px_rgba(6,182,212,0.7)]" viewBox="0 0 120 120" fill="none">
              <ellipse cx="60" cy="60" rx="52" ry="16" stroke="rgba(6,182,212,0.5)" strokeWidth="6" fill="none" transform="rotate(-25 60 60)" />
              <circle cx="60" cy="60" r="30" fill="#0891b2" stroke="#06b6d4" strokeWidth="1.5" />
              <path d="M12 60 C12 72, 108 72, 108 60" stroke="#a5f3fc" strokeWidth="5" strokeLinecap="round" fill="none" transform="rotate(-25 60 60)" />
            </svg>
            <span className="text-[10px] font-black uppercase tracking-wider text-cyan-400 font-mono mt-1 bg-black/60 dark:bg-black/80 px-2 py-0.5 rounded-full border border-cyan-500/30">
              ✦ Saturno IA
            </span>
          </div>
        )}

        {variant === 1 && (
          <div className="flex flex-col items-center">
            <svg className="w-18 h-16 sm:w-24 sm:h-20 filter drop-shadow-[0_0_24px_rgba(59,130,246,0.7)]" viewBox="0 0 110 90" fill="none">
              <path d="M70 20 L10 80 M74 24 L22 84 M78 28 L34 88" stroke="#38bdf8" strokeWidth="3" strokeLinecap="round" opacity="0.75" />
              <circle cx="76" cy="22" r="9" fill="#ffffff" stroke="#38bdf8" strokeWidth="2.5" className="animate-pulse" />
            </svg>
            <span className="text-[10px] font-black uppercase tracking-wider text-sky-400 font-mono mt-1 bg-black/60 dark:bg-black/80 px-2 py-0.5 rounded-full border border-sky-500/30">
              ☄ Cometa
            </span>
          </div>
        )}

        {variant === 2 && (
          <div className="flex flex-col items-center">
            <svg className="w-16 h-16 sm:w-22 sm:h-22 filter drop-shadow-[0_0_22px_rgba(234,179,8,0.7)]" viewBox="0 0 100 100" fill="none">
              <polygon points="50,18 82,46 64,82 36,82 18,46" stroke="rgba(234,179,8,0.4)" strokeWidth="1.5" fill="none" />
              <circle cx="50" cy="18" r="4.5" fill="#facc15" stroke="#ffffff" strokeWidth="1" className="animate-pulse" />
              <circle cx="82" cy="46" r="4" fill="#facc15" stroke="#ffffff" strokeWidth="1" />
              <circle cx="64" cy="82" r="4" fill="#facc15" stroke="#ffffff" strokeWidth="1" />
              <circle cx="36" cy="82" r="4" fill="#facc15" stroke="#ffffff" strokeWidth="1" />
              <circle cx="18" cy="46" r="4" fill="#facc15" stroke="#ffffff" strokeWidth="1" />
            </svg>
            <span className="text-[10px] font-black uppercase tracking-wider text-amber-300 font-mono mt-1 bg-black/60 dark:bg-black/80 px-2 py-0.5 rounded-full border border-amber-500/30">
              ✦ Constelación
            </span>
          </div>
        )}

        {variant === 3 && (
          <div className="flex flex-col items-center">
            <svg className="w-16 h-16 sm:w-22 sm:h-22 filter drop-shadow-[0_0_24px_rgba(168,85,247,0.75)]" viewBox="0 0 100 100" fill="none">
              <circle cx="50" cy="50" r="32" stroke="#a855f7" strokeWidth="3" strokeDasharray="12 6" fill="none" className="animate-spin" />
              <circle cx="50" cy="50" r="20" stroke="#c084fc" strokeWidth="2" strokeDasharray="6 4" fill="none" />
              <circle cx="50" cy="50" r="8" fill="#e879f9" className="animate-ping" />
            </svg>
            <span className="text-[10px] font-black uppercase tracking-wider text-fuchsia-400 font-mono mt-1 bg-black/60 dark:bg-black/80 px-2 py-0.5 rounded-full border border-fuchsia-500/30">
              🌀 Vórtice IA
            </span>
          </div>
        )}
      </div>

      {/* Decoración Derecha */}
      <div
        className="absolute -right-20 sm:-right-32 lg:-right-44 animate-[float_6.5s_ease-in-out_infinite_1.4s] opacity-95 transition-transform duration-300 hover:scale-110"
        style={{ top: `${rightY}px` }}
      >
        {variant === 0 && (
          <div className="flex flex-col items-center">
            <svg className="w-16 h-16 sm:w-22 sm:h-22 filter drop-shadow-[0_0_24px_rgba(139,92,246,0.7)]" viewBox="0 0 100 100" fill="none">
              <rect x="42" y="42" width="16" height="16" rx="3" fill="#1e1b4b" stroke="#8b5cf6" strokeWidth="2" />
              <rect x="12" y="44" width="26" height="12" rx="2" fill="#0891b2" stroke="#06b6d4" strokeWidth="1.5" />
              <rect x="62" y="44" width="26" height="12" rx="2" fill="#0891b2" stroke="#06b6d4" strokeWidth="1.5" />
              <path d="M50 42 L50 28 M44 26 Q50 32 56 26" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" />
              <circle cx="50" cy="22" r="2.5" fill="#38bdf8" className="animate-ping" />
            </svg>
            <span className="text-[10px] font-black uppercase tracking-wider text-purple-400 font-mono mt-1 bg-black/60 dark:bg-black/80 px-2 py-0.5 rounded-full border border-purple-500/30">
              📡 Satélite IA
            </span>
          </div>
        )}

        {variant === 1 && (
          <div className="flex flex-col items-center">
            <svg className="w-16 h-16 sm:w-22 sm:h-22 filter drop-shadow-[0_0_24px_rgba(244,63,94,0.7)]" viewBox="0 0 100 100" fill="none">
              <circle cx="50" cy="50" r="14" fill="#0f172a" stroke="#ec4899" strokeWidth="2" />
              <circle cx="50" cy="50" r="8" fill="#ec4899" opacity="0.4" className="animate-ping" />
              <rect x="22" y="46" width="14" height="8" rx="2" fill="#1e1b4b" stroke="#a855f7" strokeWidth="1.5" />
              <rect x="64" y="46" width="14" height="8" rx="2" fill="#1e1b4b" stroke="#a855f7" strokeWidth="1.5" />
            </svg>
            <span className="text-[10px] font-black uppercase tracking-wider text-pink-400 font-mono mt-1 bg-black/60 dark:bg-black/80 px-2 py-0.5 rounded-full border border-pink-500/30">
              🛸 Estación Alfa
            </span>
          </div>
        )}

        {variant === 2 && (
          <div className="flex flex-col items-center">
            <svg className="w-16 h-16 sm:w-22 sm:h-22 filter drop-shadow-[0_0_24px_rgba(20,184,166,0.7)]" viewBox="0 0 100 100" fill="none">
              <polygon points="42,16 68,22 84,46 76,78 48,88 24,72 18,38" fill="#0f172a" stroke="#14b8a6" strokeWidth="2.5" />
              <path d="M42 16 L52 50 L76 78" stroke="#2dd4bf" strokeWidth="2" strokeLinecap="round" />
              <circle cx="52" cy="50" r="4" fill="#5eead4" className="animate-ping" />
            </svg>
            <span className="text-[10px] font-black uppercase tracking-wider text-teal-300 font-mono mt-1 bg-black/60 dark:bg-black/80 px-2 py-0.5 rounded-full border border-teal-500/30">
              💎 Geoda
            </span>
          </div>
        )}

        {variant === 3 && (
          <div className="flex flex-col items-center">
            <svg className="w-16 h-16 sm:w-20 sm:h-20 filter drop-shadow-[0_0_24px_rgba(251,146,60,0.7)]" viewBox="0 0 100 100" fill="none">
              <polygon points="50,15 65,45 50,75 35,45" fill="#f97316" stroke="#ea580c" strokeWidth="2" />
              <circle cx="50" cy="45" r="5" fill="#ffffff" className="animate-ping" />
            </svg>
            <span className="text-[10px] font-black uppercase tracking-wider text-orange-400 font-mono mt-1 bg-black/60 dark:bg-black/80 px-2 py-0.5 rounded-full border border-orange-500/30">
              🚀 Sonda IA
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
