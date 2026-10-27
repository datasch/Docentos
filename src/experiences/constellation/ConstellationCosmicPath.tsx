import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Check, 
  Lock, 
  Play, 
  Sparkles, 
  Radio, 
  Zap, 
  Lightbulb, 
  Users, 
  Layers, 
  Cpu, 
  Code2, 
  Database, 
  Terminal, 
  Compass, 
  X, 
  ArrowRight,
  Award,
  ShieldCheck,
  Eye,
  Download,
} from 'lucide-react';
import { Course, Module, VideoDriveLink, User, CertificateRecord } from '../../types';
import { downloadCertificate } from '../../plugins/CertificateGenerator';
import { pluginManager } from '../../plugins/PluginManager';
import { getModuleQuestionCount, quizzesPluginEngine } from '../../plugins/QuizzesPlugin';
import { CertificateVerifyModal } from '../../components/CertificateVerifyModal';
import { CertificatePreviewModal } from './CertificatePreviewModal';
import { api } from '../../lib/api';
import { getSeasonalTheme, SeasonalTheme } from '../../lib/seasonalTheme';
import { ModuleSideDecorations } from './ConstellationPathAmbientDecorations';
import { LogoIA } from './LogoIA';
import './caminoIslas.css';

interface ConstellationCosmicPathProps {
  course: Course;
  courses: Course[];
  onSelectCourse: (c: Course) => void;
  onOpenLesson: (video: VideoDriveLink, module: Module) => void;
  completedVideoIds?: string[];
  currentUser?: User | null;
  certificate?: CertificateRecord | null;
  activeVideoId?: string;
}

// Iconos temáticos que rotan para las misiones cósmicas
const MISSION_ICONS = [
  Radio,      // Radar de Señales
  Layers,     // Enigma de Patrones
  Zap,        // Sobrecarga de Servidores
  Lightbulb,  // Reactor de Presión
  Users,      // Protocolo Alianza
  Compass,    // Faro Estelar
  Terminal,   // Consola Cuántica
  Database,   // Bóveda de Datos
  Cpu,        // Núcleo Sintético
  Code2,      // Matriz de Código
];

/**
 * Icono SVG idéntico al Bastón Festivo para el progreso y la ruta
 */
export const CandyCaneIcon: React.FC<{ className?: string; size?: number }> = ({ className = '', size = 24 }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 32 32" 
    fill="none" 
    className={`inline-block filter drop-shadow-[0_0_8px_rgba(239,68,68,0.9)] ${className}`}
    aria-hidden="true"
  >
    {/* Cuerpo blanco del bastón */}
    <path 
      d="M10 27 L10 12 C10 6.5, 22 6.5, 22 12 L22 14" 
      stroke="#ffffff" 
      strokeWidth="5" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
    />
    {/* Rayas rojas festivas del Bastón Festivo */}
    <path 
      d="M10 27 L10 12 C10 6.5, 22 6.5, 22 12 L22 14" 
      stroke="#dc2626" 
      strokeWidth="5" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      strokeDasharray="3.5 4.5" 
    />
    {/* Cascabel o lazo dorado festivo */}
    <circle cx="16" cy="18" r="3" fill="#fbbf24" stroke="#d97706" strokeWidth="1" />
  </svg>
);

/**
 * Icono SVG de caramelo mágico para Halloween
 */
export const HalloweenCandyIcon: React.FC<{ className?: string; size?: number }> = ({ className = '', size = 24 }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 32 32" 
    fill="none" 
    className={`inline-block filter drop-shadow-[0_0_8px_rgba(249,115,22,0.9)] ${className}`}
    aria-hidden="true"
  >
    <polygon points="4,11 10,16 4,21" fill="#a855f7" />
    <polygon points="28,11 22,16 28,21" fill="#a855f7" />
    <rect x="8" y="10" width="16" height="12" rx="6" fill="#f97316" stroke="#fbbf24" strokeWidth="1.5" />
    <line x1="13" y1="10" x2="11" y2="22" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />
    <line x1="19" y1="10" x2="17" y2="22" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

/**
 * Genera el trazado en zigzag serpentino fluido y continuo con derivadas verticales suaves
 */
function getCaminoData(
  n: number,
  startGlobalIndex: number = 0,
  hasPrevModule: boolean = false,
  hasNextModule: boolean = true
) {
  const stepY = 165;
  const topOffset = 105;
  const bottomOffset = 95;

  const height = n <= 1 ? 280 : topOffset + (n - 1) * stepY + bottomOffset;
  const vh = height;
  const pos: [number, number][] = [];

  for (let i = 0; i < n; i++) {
    const yPx = n === 1 ? height / 2 : topOffset + i * stepY;
    const yPct = (yPx / height) * 100;
    
    // Alternancia suave izquierda (34%) / derecha (66%) continua a través de todos los módulos
    const isRight = (startGlobalIndex + i) % 2 === 1;
    const xPct = isRight ? 66 : 34;
    pos.push([xPct, Math.round(yPct * 10) / 10]);
  }

  // Generar curva cubic Bézier con tangentes verticales suaves en cada punto
  const pts = pos.map(([px, py]) => ({ x: px * 3.4, y: (py * vh) / 100 }));
  let ruta = '';

  if (pts.length > 0) {
    const p0 = pts[0];
    // Entrada vertical continua desde el centro superior (170, 0)
    ruta = `M 170 0 C 170 ${(p0.y * 0.45).toFixed(0)}, ${p0.x.toFixed(0)} ${(p0.y * 0.55).toFixed(0)}, ${p0.x.toFixed(0)} ${p0.y.toFixed(0)}`;

    // Curvas entre islas con derivadas verticales suaves
    for (let i = 1; i < pts.length; i++) {
      const prev = pts[i - 1];
      const curr = pts[i];
      const dy = curr.y - prev.y;
      const cp1y = prev.y + dy * 0.5;
      const cp2y = curr.y - dy * 0.5;
      ruta += ` C ${prev.x.toFixed(0)} ${cp1y.toFixed(0)}, ${curr.x.toFixed(0)} ${cp2y.toFixed(0)}, ${curr.x.toFixed(0)} ${curr.y.toFixed(0)}`;
    }

    if (hasNextModule) {
      // Salida continua hacia el centro inferior (170, vh) con tangente vertical perfecta
      const pLast = pts[pts.length - 1];
      const dist = vh - pLast.y;
      ruta += ` C ${pLast.x.toFixed(0)} ${(pLast.y + dist * 0.45).toFixed(0)}, 170 ${(pLast.y + dist * 0.55).toFixed(0)}, 170 ${vh}`;
    }
  } else if (hasPrevModule || hasNextModule) {
    ruta = `M 170 0 L 170 ${vh}`;
  }

  return {
    pos,
    ruta,
    viewBox: `0 0 340 ${vh}`,
    vh,
    height,
  };
}

/**
 * Pista de Camino de Islas para un módulo individual
 */
interface ModuloCaminoTrackProps {
  module: Module;
  modIdx: number;
  seasonalTheme: SeasonalTheme;
  totalModules: number;
  missions: {
    video: VideoDriveLink;
    module: Module;
    missionNumber: number;
    globalIndex: number;
  }[];
  allMissions: {
    video: VideoDriveLink;
    module: Module;
    missionNumber: number;
    globalIndex: number;
  }[];
  activeVideoId?: string;
  completedVideoIds: string[];
  totalMissions: number;
  onOpenLesson: (video: VideoDriveLink, module: Module) => void;
  selectedNode: {
    video: VideoDriveLink;
    module: Module;
    index: number;
  } | null;
  setSelectedNode: React.Dispatch<
    React.SetStateAction<{
      video: VideoDriveLink;
      module: Module;
      index: number;
    } | null>
  >;
  isCourseCompleted: boolean;
  isPrevModuleCompleted: boolean;
  allMissionsCompleted: boolean;
  canAccessMission: (globalIndex: number) => boolean;
}

const ModuloCaminoTrack: React.FC<ModuloCaminoTrackProps> = ({
  module,
  modIdx,
  seasonalTheme,
  totalModules,
  missions,
  allMissions,
  activeVideoId,
  completedVideoIds,
  totalMissions,
  onOpenLesson,
  selectedNode,
  setSelectedNode,
  isCourseCompleted,
  isPrevModuleCompleted,
  allMissionsCompleted,
  canAccessMission,
}) => {
  const baseRef = useRef<SVGPathElement>(null);
  const estelaRef = useRef<SVGPathElement>(null);
  const tramosRef = useRef<number[] | null>(null);

  const n = missions.length;
  const startGlobalIndex = missions[0]?.globalIndex ?? 0;
  const hasPrevModule = modIdx > 0;
  const hasNextModule = true; // Siempre continúa hacia el siguiente módulo o hacia el certificado
  const caminoConfig = useMemo(
    () => getCaminoData(n, startGlobalIndex, hasPrevModule, hasNextModule),
    [n, startGlobalIndex, hasPrevModule, hasNextModule]
  );
  const { pos, ruta, viewBox, vh, height } = caminoConfig;

  const isCompleted = (id: string) => completedVideoIds.includes(id);

  // Determinar la misión activa dentro de este módulo
  const moduleActiveIndex = missions.findIndex((m) => m.video.id === activeVideoId);
  const hasActiveMission = moduleActiveIndex !== -1;

  // Cuántas completadas en este módulo
  const moduleCompletedCount = missions.filter((m) => isCompleted(m.video.id)).length;
  const isModuleAllCompleted = n > 0 && moduleCompletedCount === n;

  // Animación de la estela brillante a lo largo de la curva
  useEffect(() => {
    const base = baseRef.current;
    const estela = estelaRef.current;
    if (!base || !estela || !base.getTotalLength) return;
    const total = base.getTotalLength();

    if (!tramosRef.current || tramosRef.current.length !== pos.length) {
      const muestras = Array.from({ length: 241 }, (_, k) => {
        const l = (total * k) / 240;
        const q = base.getPointAtLength(l);
        return { l, x: q.x, y: q.y };
      });
      tramosRef.current = pos.map(([px, py]) => {
        const x = px * 3.4;
        const y = (py * vh) / 100;
        return muestras.reduce((a, b) => (Math.hypot(b.x - x, b.y - y) < Math.hypot(a.x - x, a.y - y) ? b : a)).l;
      });
    }

    let targetDistance = 0;
    if (isModuleAllCompleted) {
      targetDistance = total;
    } else if (hasActiveMission && tramosRef.current[moduleActiveIndex] !== undefined) {
      targetDistance = tramosRef.current[moduleActiveIndex];
    } else if (moduleCompletedCount > 0) {
      const lastCompletedIdx = Math.min(moduleCompletedCount - 1, tramosRef.current.length - 1);
      targetDistance = tramosRef.current[lastCompletedIdx] || 0;
    }

    estela.style.strokeDashoffset = String(4000 - targetDistance);
  }, [moduleActiveIndex, isModuleAllCompleted, moduleCompletedCount, pos, vh, hasActiveMission]);

  // Posición del orbe flotante de LogoIA
  const orbIdx = hasActiveMission 
    ? moduleActiveIndex 
    : isModuleAllCompleted 
      ? Math.max(0, n - 1) 
      : 0;
  const donde = pos[Math.min(orbIdx, pos.length - 1)] || [50, 50];

  const isSelectedInThisModule = selectedNode && missions.some((m) => m.video.id === selectedNode.video.id);

  return (
    <section className="relative my-10">
      {/* 1. Encabezado de Módulo en píldora con luz de cristal y conector continuo entre módulos */}
      <div className="relative mt-12 mb-6 w-full max-w-xl mx-auto flex flex-col items-center">
        {/* Conector SVG continuo que pasa por detrás del encabezado */}
        {hasPrevModule && (
          <div className="absolute -top-12 -bottom-10 inset-x-0 flex justify-center pointer-events-none z-0 overflow-visible">
            <svg className="w-[340px] h-full overflow-visible" viewBox="0 0 340 100" preserveAspectRatio="none">
              <defs>
                <linearGradient id={`th-connector-grad-${module.id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#ffffff" />
                  <stop offset="0.5" stopColor="#fbbf24" />
                  <stop offset="1" stopColor="#dc2626" />
                </linearGradient>
              </defs>
              
              {/* Conector temático continuo: Bastón de caramelo en Navidad */}
              {seasonalTheme === 'christmas' ? (
                <>
                  <path
                    d="M 170 0 L 170 100"
                    fill="none"
                    stroke="#dc2626"
                    strokeWidth="12"
                    strokeLinecap="round"
                  />
                  <path
                    d="M 170 0 L 170 100"
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth="12"
                    strokeDasharray="14 14"
                    strokeLinecap="round"
                  />
                </>
              ) : seasonalTheme === 'halloween' ? (
                <>
                  {/* Conector temático: Dulces y golosinas en Halloween */}
                  <path
                    d="M 170 0 L 170 100"
                    fill="none"
                    stroke="#f97316"
                    strokeWidth="10"
                    strokeLinecap="round"
                  />
                  <path
                    d="M 170 0 L 170 100"
                    fill="none"
                    stroke="#a855f7"
                    strokeWidth="10"
                    strokeDasharray="12 16"
                    strokeLinecap="round"
                  />
                </>
              ) : (
                <path
                  d="M 170 0 L 170 100"
                  fill="none"
                  stroke="var(--th-ruta)"
                  strokeWidth="6"
                  strokeDasharray="3 14"
                  strokeLinecap="round"
                  opacity="0.85"
                />
              )}

              {isPrevModuleCompleted && (
                <path
                  d="M 170 0 L 170 100"
                  fill="none"
                  stroke={seasonalTheme === 'christmas' ? '#fbbf24' : `url(#th-connector-grad-${module.id})`}
                  strokeWidth={seasonalTheme === 'christmas' ? '12' : '8'}
                  strokeDasharray={seasonalTheme === 'christmas' ? '14 14' : '3 14'}
                  strokeLinecap="round"
                  className="ruta-viva"
                />
              )}
            </svg>
          </div>
        )}

        {/* Tarjeta del encabezado en píldora con z-10 para flotar sobre la línea continua */}
        <div className="relative z-10 w-full flex items-center justify-between gap-3 px-5 py-3.5 rounded-2xl bg-white/95 dark:bg-[#141224]/90 border border-slate-200/90 dark:border-purple-500/25 shadow-lg dark:shadow-[0_0_30px_rgba(139,92,246,0.14)] backdrop-blur-md transition-colors">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 dark:bg-purple-500/20 border border-purple-400/30 dark:border-purple-400/40 flex items-center justify-center text-purple-600 dark:text-purple-300 font-black text-xs shrink-0 shadow-sm">
              {String(modIdx + 1).padStart(2, '0')}
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-black uppercase tracking-wider text-purple-600 dark:text-purple-400 block">
                Módulo {modIdx + 1}
              </span>
              <h2 className="text-sm font-extrabold text-slate-900 dark:text-white truncate">
                {module.title}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isModuleAllCompleted ? (
              <span className="flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-full font-bold bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30">
                <Check className="w-3 h-3 text-cyan-600 dark:text-cyan-400" />
                Completado
              </span>
            ) : (
              <span className="text-[11px] px-2.5 py-0.5 rounded-full font-bold bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20">
                {missions.length} {missions.length === 1 ? 'Misión' : 'Misiones'}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 2. El Camino Serpentino de Islas */}
      <div className="camino" style={{ height: `${height}px` }}>
        {/* Decoraciones Temáticas Flotantes en Ambos Laterales del Módulo */}
        <ModuleSideDecorations seasonalTheme={seasonalTheme} modIdx={modIdx} height={height} />

        {ruta && (
          <svg className="ruta" viewBox={viewBox} preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <linearGradient id={`th-estela-color-${module.id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor={seasonalTheme === 'christmas' ? '#ffffff' : seasonalTheme === 'halloween' ? '#f97316' : undefined} className={seasonalTheme === 'christmas' || seasonalTheme === 'halloween' ? undefined : 'estela-c1'} />
                <stop offset=".5" stopColor={seasonalTheme === 'christmas' ? '#fbbf24' : seasonalTheme === 'halloween' ? '#fbbf24' : undefined} className={seasonalTheme === 'christmas' || seasonalTheme === 'halloween' ? undefined : 'estela-c2'} />
                <stop offset="1" stopColor={seasonalTheme === 'christmas' ? '#dc2626' : seasonalTheme === 'halloween' ? '#a855f7' : undefined} className={seasonalTheme === 'christmas' || seasonalTheme === 'halloween' ? undefined : 'estela-c3'} />
              </linearGradient>
              <mask id={`th-estela-mascara-${module.id}`} maskUnits="userSpaceOnUse" x="0" y="0" width="340" height={vh}>
                <path ref={estelaRef} className="estela" d={ruta} fill="none" strokeWidth="16" strokeLinecap="round" />
              </mask>
            </defs>
            
            {/* Trazado temático: Bastón de caramelo en Navidad */}
            {seasonalTheme === 'christmas' ? (
              <>
                <path
                  ref={baseRef}
                  className="ruta-base"
                  d={ruta}
                  fill="none"
                  stroke="#dc2626"
                  strokeWidth="12"
                  strokeLinecap="round"
                />
                <path
                  className="ruta-cane-white"
                  d={ruta}
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth="12"
                  strokeLinecap="round"
                  strokeDasharray="14 14"
                />
              </>
            ) : seasonalTheme === 'halloween' ? (
              <>
                {/* Trazado temático: Dulces y golosinas en Halloween */}
                <path
                  ref={baseRef}
                  className="ruta-base"
                  d={ruta}
                  fill="none"
                  stroke="#f97316"
                  strokeWidth="10"
                  strokeLinecap="round"
                />
                <path
                  className="ruta-candy-dash"
                  d={ruta}
                  fill="none"
                  stroke="#a855f7"
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray="12 16"
                />
              </>
            ) : (
              <path
                ref={baseRef}
                className="ruta-base"
                d={ruta}
                fill="none"
                strokeWidth="6"
                strokeDasharray="3 14"
                strokeLinecap="round"
              />
            )}

            <path
              className="ruta-viva"
              d={ruta}
              fill="none"
              stroke={seasonalTheme === 'christmas' ? '#fbbf24' : `url(#th-estela-color-${module.id})`}
              strokeWidth={seasonalTheme === 'christmas' ? '12' : seasonalTheme === 'halloween' ? '10' : '8'}
              strokeDasharray={seasonalTheme === 'christmas' ? '14 14' : seasonalTheme === 'halloween' ? '12 16' : '3 14'}
              strokeLinecap="round"
              mask={`url(#th-estela-mascara-${module.id})`}
            />
          </svg>
        )}

        {/* Las Islas de Roca en Zigzag */}
        {missions.map((mission, i) => {
          const completed = isCompleted(mission.video.id);
          const isUnlocked = canAccessMission(mission.globalIndex);
          const isCurrent = mission.video.id === activeVideoId;
          const estado = completed ? 'lista' : isUnlocked ? (isCurrent ? 'actual' : 'cerrada') : 'cerrada';
          const coordinates = pos[i] || [50, 50];
          const isSelected = selectedNode?.video.id === mission.video.id;

          const IconComponent = MISSION_ICONS[mission.globalIndex % MISSION_ICONS.length];

          // Si la isla está muy abajo en el contenedor (> 72%), posicionamos el popover arriba para no cortarlo
          const isNearBottom = coordinates[1] > 72;

          return (
            <React.Fragment key={mission.video.id}>
              <button
                type="button"
                id={isCurrent ? 'celestial-orb-island' : undefined}
                className={`isla ${estado} focus:outline-none focus:ring-2 focus:ring-(--th-foco) focus:ring-offset-2 focus:ring-offset-[#0a0a0f] rounded-2xl`}
                style={{ 
                  left: `${coordinates[0]}%`, 
                  top: `${coordinates[1]}%`,
                  zIndex: isSelected ? 20 : 15,
                }}
                aria-label={`Misión ${mission.missionNumber} de ${totalMissions}: ${mission.video.title}, estado: ${estado}`}
                onClick={() => {
                  setSelectedNode((prev) =>
                    prev?.video.id === mission.video.id
                      ? null
                      : {
                          video: mission.video,
                          module: mission.module,
                          index: mission.missionNumber,
                        }
                  );
                }}
              >
                <span className="isla-roca" aria-hidden="true">
                  {completed ? (
                    <svg viewBox="0 0 34 34" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M8 17l6 6 12-13" />
                    </svg>
                  ) : !isUnlocked ? (
                    <Lock className="w-6 h-6 text-slate-500/70" />
                  ) : isCurrent ? (
                    seasonalTheme === 'halloween' ? (
                      <HalloweenCandyIcon size={28} className="animate-pulse" />
                    ) : seasonalTheme === 'christmas' ? (
                      <CandyCaneIcon size={28} className="animate-pulse" />
                    ) : (
                      <Sparkles className="w-8 h-8 text-cyan-300 drop-shadow-[0_0_8px_rgba(6,182,212,0.8)] animate-pulse" />
                    )
                  ) : (
                    <IconComponent className="w-8 h-8 text-purple-300/70" />
                  )}
                </span>
                
                <span className="rotulo" aria-hidden="true">
                  {mission.video.title}
                </span>
              </button>

              {/* Popover / Ficha de Misión desplegada al hacer clic, con separación limpia sin solapar */}
              {isSelected && (
                <div 
                  className="mision-popover"
                  style={{
                    left: `${coordinates[0]}%`,
                    ...(isNearBottom 
                      ? { bottom: `calc(${100 - coordinates[1]}% + 52px)` } 
                      : { top: `calc(${coordinates[1]}% + 82px)` }),
                  }}
                >
                  {isNearBottom ? (
                    <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-3.5 h-3.5 bg-white dark:bg-[#171328] border-b-2 border-r-2 border-slate-300 dark:border-purple-500/40 rotate-45 pointer-events-none" />
                  ) : (
                    <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-3.5 h-3.5 bg-white dark:bg-[#171328] border-t-2 border-l-2 border-slate-300 dark:border-purple-500/40 rotate-45 pointer-events-none" />
                  )}

                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-cyan-600 dark:text-cyan-400">
                      Misión {mission.missionNumber} de {totalMissions}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedNode(null);
                      }}
                      className="text-slate-400 dark:text-purple-300/60 hover:text-slate-800 dark:hover:text-white p-0.5 rounded-lg transition-colors cursor-pointer"
                      title="Cerrar"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <h3 className="font-extrabold text-sm text-slate-900 dark:text-white leading-snug">
                    {mission.video.title}
                  </h3>
                  
                  <p className="text-xs text-slate-600 dark:text-purple-200/70 mt-1 line-clamp-2">
                    {mission.module.title}
                  </p>

                  {!isUnlocked && !completed && (
                    <div className="mt-3 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-600 dark:text-amber-300 font-medium leading-relaxed">
                      🔒 Misión Bloqueada. Para desbloquearla debes completar la misión anterior: <strong className="text-slate-900 dark:text-white block mt-0.5">{allMissions[mission.globalIndex - 1]?.video.title}</strong>
                    </div>
                  )}

                  <div className="mt-4 pt-3 border-t border-purple-500/20 flex items-center justify-end">
                    <button
                      type="button"
                      disabled={!isUnlocked && !completed}
                      onClick={() => {
                        if (!isUnlocked && !completed) return;
                        setSelectedNode(null);
                        onOpenLesson(mission.video, mission.module);
                      }}
                      className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-extrabold text-xs uppercase tracking-wider transition-all ${
                        !isUnlocked && !completed
                          ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-300 dark:border-slate-700/50 cursor-not-allowed opacity-60'
                          : 'bg-gradient-to-r from-cyan-500 to-purple-600 text-white hover:brightness-110 active:scale-95 shadow-lg shadow-cyan-500/25 cursor-pointer'
                      }`}
                    >
                      <span>
                        {!isUnlocked && !completed
                          ? 'Misión Bloqueada'
                          : completed
                            ? 'Repasar Misión'
                            : 'Iniciar Misión'}
                      </span>
                      {isUnlocked || completed ? (
                        <ArrowRight className="w-3.5 h-3.5" />
                      ) : (
                        <Lock className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              )}
            </React.Fragment>
          );
        })}

        {/* El ser de IA vivo «Prisma» dentro de su orbe viajando sobre la isla activa de este módulo */}
        {hasActiveMission && (
          <div
            id="celestial-orb-target"
            className="ser-en-camino"
            style={{ 
              left: `${donde[0]}%`, 
              top: `${donde[1]}%` 
            }}
          >
            {allMissionsCompleted ? (
              /* Cuando todas las misiones están completadas: el orbe celestial cambia al círculo morado con el check blanco radiante de la imagen */
              <div 
                className="w-full h-full rounded-full flex items-center justify-center border-2 border-white/80 shadow-[0_0_35px_rgba(167,139,250,0.95)] animate-pulse"
                style={{
                  background: 'linear-gradient(180deg, #c4b5fd 0%, #8b5cf6 45%, #6d28d9 100%)',
                }}
              >
                <svg viewBox="0 0 34 34" fill="none" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className="w-9 h-9 filter drop-shadow-[0_0_8px_rgba(255,255,255,0.95)]">
                  <path d="M8 17l6 6 12-13" />
                </svg>
              </div>
            ) : (
              <LogoIA
                quien="celeste"
                chico
                orbe
                className="w-full h-full"
                estado={isSelectedInThisModule ? 'escucha' : isCourseCompleted ? 'celebra' : 'reposo'}
              />
            )}
            {/* Si es Halloween: caramelo mágico flotante coronando el orbe centrado */}
            {seasonalTheme === 'halloween' && (
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 filter drop-shadow-[0_0_10px_rgba(249,115,22,0.95)] animate-bounce select-none pointer-events-none">
                <HalloweenCandyIcon size={26} />
              </div>
            )}
            {/* Si es Navidad: bastón festivo coronando el orbe centrado */}
            {seasonalTheme === 'christmas' && (
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 filter drop-shadow-[0_0_10px_rgba(239,68,68,0.95)] animate-bounce select-none pointer-events-none">
                <CandyCaneIcon size={26} />
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
};

export const ConstellationCosmicPath: React.FC<ConstellationCosmicPathProps> = ({
  course,
  onOpenLesson,
  completedVideoIds = [],
  currentUser,
  certificate,
  activeVideoId: preferredActiveVideoId,
}) => {
  const [selectedNode, setSelectedNode] = useState<{
    video: VideoDriveLink;
    module: Module;
    index: number;
  } | null>(null);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showLockedCertInfo, setShowLockedCertInfo] = useState(false);
  const [seasonalTheme, setSeasonalThemeState] = useState<SeasonalTheme>(getSeasonalTheme());

  useEffect(() => {
    const handleSeasonalChange = (e: any) => {
      if (e.detail?.theme) setSeasonalThemeState(e.detail.theme);
      else setSeasonalThemeState(getSeasonalTheme());
    };
    window.addEventListener('docentos-seasonal-change', handleSeasonalChange);
    return () => window.removeEventListener('docentos-seasonal-change', handleSeasonalChange);
  }, []);

  // Agrupar misiones por módulos manteniendo un contador secuencial global
  const safeModules = course?.modules || [];
  let missionCounter = 1;
  const modulesWithMissions = safeModules.map((mod, modIdx) => {
    const isModuleComplete = mod.videos && mod.videos.length > 0 && mod.videos.every((v) => completedVideoIds.includes(v.id));
    const missions = (mod.videos || []).map((vid) => {
      const num = missionCounter++;
      return {
        video: vid,
        module: mod,
        missionNumber: num,
        globalIndex: num - 1,
      };
    });
    return {
      module: mod,
      modIdx,
      isModuleComplete,
      missions,
    };
  });

  const allMissions = modulesWithMissions.flatMap((m) => m.missions);
  const totalMissions = allMissions.length;

  const isCompleted = (id: string) => completedVideoIds.includes(id);

  // La misión activa en la ruta cósmica:
  // Si preferredActiveVideoId existe, NO está completado y existe en las misiones, se respeta.
  // En caso contrario, se ubica en la primera misión PENDIENTE (la frontera actual del alumno).
  // Si todas están completadas, se ubica en la última misión.
  let activeVideoId: string | undefined;
  if (preferredActiveVideoId && !isCompleted(preferredActiveVideoId) && allMissions.some((m) => m.video.id === preferredActiveVideoId)) {
    activeVideoId = preferredActiveVideoId;
  } else {
    activeVideoId = allMissions.find((m) => !isCompleted(m.video.id))?.video.id;
    if (!activeVideoId && allMissions.length > 0) {
      activeVideoId = allMissions[allMissions.length - 1].video.id;
    }
  }

  // Referencias para detectar transiciones de avance o finalización de misiones
  const prevCompletedSetRef = useRef<Set<string>>(new Set(completedVideoIds));
  const prevActiveVideoIdRef = useRef<string | undefined>(activeVideoId);

  // 1. Si la misión que estaba abierta se acaba de marcar como completada, cerrar su popover de inmediato
  useEffect(() => {
    const prevSet = prevCompletedSetRef.current;
    const currentSet = new Set(completedVideoIds);

    if (selectedNode && !prevSet.has(selectedNode.video.id) && currentSet.has(selectedNode.video.id)) {
      setSelectedNode(null);
    }

    prevCompletedSetRef.current = currentSet;
  }, [completedVideoIds, selectedNode]);

  // 2. Si la misión activa avanza a una nueva posición en la ruta, cerrar cualquier ficha previa rezagada
  useEffect(() => {
    if (prevActiveVideoIdRef.current && activeVideoId && prevActiveVideoIdRef.current !== activeVideoId) {
      setSelectedNode(null);
    }
    prevActiveVideoIdRef.current = activeVideoId;
  }, [activeVideoId]);

  // 3. Cerrar el popover al hacer clic fuera de él o al presionar la tecla Escape
  useEffect(() => {
    if (!selectedNode) return;

    const handleDocumentClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (target.closest('.mision-popover') || target.closest('.isla')) {
        return;
      }
      setSelectedNode(null);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedNode(null);
      }
    };

    document.addEventListener('mousedown', handleDocumentClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleDocumentClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedNode]);

  const completedCount = allMissions.filter((m) => isCompleted(m.video.id)).length;
  const progressPct = totalMissions > 0 ? Math.round((completedCount / totalMissions) * 100) : 0;

  // Verificación estricta: el orbe celestial corona la meta final SOLAMENTE si
  // todas las misiones han sido completadas Y la última misión está completada.
  const allMissionsCompleted = totalMissions > 0 && completedCount === totalMissions;
  const lastMission = allMissions.length > 0 ? allMissions[allMissions.length - 1] : null;
  const isLastMissionCompleted = Boolean(lastMission && isCompleted(lastMission.video.id));
  const isOrbAtFinalDestination = allMissionsCompleted && isLastMissionCompleted;

  const effectiveUserId = currentUser?.id || 'guest';
  const modulesWithQuiz = safeModules.filter((m) => getModuleQuestionCount(m.id) > 0);
  const pendingQuizzes = modulesWithQuiz.filter((m) => {
    const attempt = quizzesPluginEngine.getUserAttempt(effectiveUserId, m.id);
    return !attempt?.passed;
  });
  const allQuizzesPassed = pendingQuizzes.length === 0;

  // Función estricta de acceso: para desbloquear la misión N, la misión N-1 DEBE estar completada
  // y si la misión anterior pertenece a un módulo que requería examen (quiz), el examen debe estar aprobado.
  const canAccessMission = (globalIdx: number) => {
    if (globalIdx === 0) return true;
    const prevMission = allMissions[globalIdx - 1];
    if (!prevMission) return true;
    if (!completedVideoIds.includes(prevMission.video.id)) return false;

    // Si cruza de módulo, verificar si el módulo anterior exige quiz
    const currentMission = allMissions[globalIdx];
    if (currentMission && currentMission.module.id !== prevMission.module.id) {
      const prevModQuizCount = getModuleQuestionCount(prevMission.module.id);
      if (prevModQuizCount > 0) {
        const attempt = quizzesPluginEngine.getUserAttempt(effectiveUserId, prevMission.module.id);
        if (!attempt?.passed) return false;
      }
    }

    return true;
  };

  // El certificado SOLO se habilita cuando el orbe celestial está en la meta final y todos los exámenes aprobados
  const isCourseCompleted = isOrbAtFinalDestination && allQuizzesPassed;

  return (
    <div className="camino-cosmico-fondo relative w-full min-h-screen bg-[#f8fafc] dark:bg-[#07070b] text-slate-900 dark:text-white font-sans select-none overflow-x-hidden pb-44 pt-6">
      
      {/* 1. Astro Celestial / Sol Luminoso Radiante (de TalentHuman) */}
      <div 
        aria-hidden="true"
        className="astro" 
      />

      {/* 3. Fondo de Estrellas y Nebulosas de Fondo */}
      <div 
        aria-hidden="true"
        className="fixed inset-0 pointer-events-none opacity-40 z-0 bg-[radial-gradient(1.5px_1.5px_at_12%_18%,#ffffff_50%,transparent_51%),radial-gradient(1px_1px_at_28%_42%,#ffffff_50%,transparent_51%),radial-gradient(2px_2px_at_71%_12%,#ffffff_50%,transparent_51%),radial-gradient(1px_1px_at_86%_36%,#ffffff_50%,transparent_51%),radial-gradient(1.5px_1.5px_at_54%_26%,#ffffff_50%,transparent_51%),radial-gradient(1px_1px_at_6%_66%,#ffffff_50%,transparent_51%),radial-gradient(1.5px_1.5px_at_93%_70%,#ffffff_50%,transparent_51%)]"
      />
      <div 
        aria-hidden="true"
        className="fixed top-1/4 left-1/4 w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-3xl pointer-events-none z-0" 
      />
      <div 
        aria-hidden="true"
        className="fixed top-2/3 right-1/4 w-[450px] h-[450px] bg-cyan-600/10 rounded-full blur-3xl pointer-events-none z-0" 
      />

      <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6">

        {/* 3. Banner Superior del Curso (Ruta Oficial de Aprendizaje) */}
        <div className="mb-10 bg-white/95 dark:bg-[#121020]/90 border border-slate-200/90 dark:border-purple-500/25 rounded-3xl p-5 sm:p-6 shadow-xl dark:shadow-2xl backdrop-blur-xl flex flex-col sm:flex-row sm:items-center justify-between gap-5 transition-colors">
          <div className="flex items-start sm:items-center gap-4 min-w-0 flex-1">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl text-white shadow-lg shrink-0 ${
              seasonalTheme === 'halloween'
                ? 'bg-orange-500 border-b-4 border-orange-600 shadow-orange-500/30'
                : seasonalTheme === 'christmas'
                  ? 'bg-emerald-600 border-b-4 border-emerald-700 shadow-emerald-500/30'
                  : 'bg-[#06b6d4] border-b-4 border-[#0891b2] shadow-cyan-500/25'
            }`}>
              {seasonalTheme === 'halloween' ? '🎃' : seasonalTheme === 'christmas' ? '🎄' : '💻'}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-cyan-600 dark:text-[#06b6d4]">
                  Ruta Oficial de Aprendizaje
                </span>
                <span className="text-[11px] px-2.5 py-0.5 rounded-full font-bold bg-amber-500/10 text-amber-700 dark:text-amber-500 border border-amber-500/20 shrink-0">
                  {safeModules.length} Unidades
                </span>
                {seasonalTheme === 'halloween' && (
                  <span className="text-[11px] px-2.5 py-0.5 rounded-full font-bold bg-orange-500/15 text-orange-700 dark:text-orange-400 border border-orange-500/30 shrink-0 animate-pulse">
                    🎃 Especial Noche de Brujas
                  </span>
                )}
                {seasonalTheme === 'christmas' && (
                  <span className="text-[11px] px-2.5 py-0.5 rounded-full font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 shrink-0 animate-pulse">
                    🎄 Especial Navideño
                  </span>
                )}
              </div>
              <h1 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white leading-snug mt-1">
                {course.title}
              </h1>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 line-clamp-1">
                {course.description || 'Aprende a construir aplicaciones web completas a nivel profesional...'}
              </p>
            </div>
          </div>

          {/* Progreso General con adaptación festiva a Dulces o Bastón de Caramelo */}
          <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200 dark:border-white/5">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-1">
              {seasonalTheme === 'halloween' ? (
                <>Progreso Dulce 🍬</>
              ) : seasonalTheme === 'christmas' ? (
                <>Progreso Navideño 🎄</>
              ) : (
                <>Progreso General</>
              )}
            </span>
            <div className="flex items-center gap-2.5">
              {seasonalTheme === 'halloween' ? (
                /* Barra temática de Dulces en Halloween */
                <div className="w-36 h-4 rounded-full bg-slate-200 dark:bg-purple-950/80 border-2 border-orange-500/60 p-0.5 relative shadow-[0_0_15px_rgba(249,115,22,0.25)]">
                  <div 
                    className="h-full bg-gradient-to-r from-amber-500 via-orange-500 to-purple-600 rounded-full transition-all duration-500 shadow-[0_0_12px_rgba(249,115,22,0.6)]"
                    style={{ width: `${progressPct}%` }}
                  />
                  {progressPct > 0 && (
                    <div 
                      className="absolute -top-2 transition-all duration-500 select-none -translate-x-1/2 pointer-events-none"
                      style={{ left: `${Math.min(94, Math.max(6, progressPct))}%` }}
                    >
                      <HalloweenCandyIcon size={24} />
                    </div>
                  )}
                </div>
              ) : seasonalTheme === 'christmas' ? (
                /* Barra temática de Bastón Festivo en Navidad */
                <div className="w-36 h-4 rounded-full bg-slate-200 dark:bg-slate-900/80 border-2 border-red-500/60 p-0.5 relative shadow-[0_0_15px_rgba(220,38,38,0.25)]">
                  <div 
                    className="h-full rounded-full transition-all duration-500 shadow-[0_0_12px_rgba(239,68,68,0.6)] border border-red-200/50"
                    style={{ 
                      width: `${progressPct}%`,
                      backgroundImage: 'repeating-linear-gradient(45deg, #dc2626, #dc2626 9px, #ffffff 9px, #ffffff 18px)'
                    }}
                  />
                  {progressPct > 0 && (
                    <div 
                      className="absolute -top-2 transition-all duration-500 select-none -translate-x-1/2 pointer-events-none"
                      style={{ left: `${Math.min(94, Math.max(6, progressPct))}%` }}
                    >
                      <CandyCaneIcon size={24} />
                    </div>
                  )}
                </div>
              ) : (
                /* Barra Cósmica Estándar */
                <div className="w-28 h-2.5 rounded-full bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-700/80 overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-[#06b6d4] to-[#8b5cf6] rounded-full transition-all duration-500"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              )}

              <span className={`text-xs font-black ${
                seasonalTheme === 'halloween'
                  ? 'text-orange-600 dark:text-orange-400'
                  : seasonalTheme === 'christmas'
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-cyan-700 dark:text-cyan-400'
              }`}>
                {progressPct}%
              </span>
            </div>
          </div>
        </div>

        {/* 4. El Sendero de Islas de Aprendizaje - MÓDULO POR MÓDULO CON LÍNEAS CONTINUAS */}
        <div className="space-y-4">
          {modulesWithMissions.length === 0 ? (
            <div className="py-16 px-6 text-center bg-white/80 dark:bg-[#121020]/70 border border-slate-200/80 dark:border-purple-500/20 rounded-3xl backdrop-blur-md shadow-sm">
              <div className="text-4xl mb-3">🌌</div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white mb-1">
                Constelación en estructuración
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 max-w-sm mx-auto">
                Este curso está organizando sus módulos y lecciones prácticas. Vuelve pronto para explorar la ruta cósmica.
              </p>
            </div>
          ) : (
            modulesWithMissions.map((modGroup, index) => {
              const isPrevModuleCompleted = index === 0 ? true : modulesWithMissions[index - 1].isModuleComplete;

              return (
                <ModuloCaminoTrack
                  key={modGroup.module.id}
                  module={modGroup.module}
                  modIdx={modGroup.modIdx}
                  seasonalTheme={seasonalTheme}
                  totalModules={modulesWithMissions.length}
                  missions={modGroup.missions}
                  allMissions={allMissions}
                  activeVideoId={activeVideoId}
                  completedVideoIds={completedVideoIds}
                  totalMissions={totalMissions}
                  onOpenLesson={onOpenLesson}
                  selectedNode={selectedNode}
                  setSelectedNode={setSelectedNode}
                  isCourseCompleted={isCourseCompleted}
                  isPrevModuleCompleted={isPrevModuleCompleted}
                  allMissionsCompleted={allMissionsCompleted}
                  canAccessMission={canAccessMission}
                />
              );
            })
          )}
        </div>

        {/* 5. ÚLTIMA RUTA: ESTACIÓN FINAL DEL CERTIFICADO OFICIAL */}
        <div className="relative flex flex-col items-center mt-6">
          
          {/* Conector punteado continuo hacia la estación final */}
          <div className="relative w-[340px] h-20 pointer-events-none flex justify-center -my-2 overflow-visible">
            <svg className="w-[340px] h-full overflow-visible" viewBox="0 0 340 80" preserveAspectRatio="none">
              <defs>
                <linearGradient id="cert-connector-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" className="estela-c1" />
                  <stop offset="0.5" className="estela-c2" />
                  <stop offset="1" stopColor="#fbbf24" />
                </linearGradient>
              </defs>
              {seasonalTheme === 'christmas' ? (
                <>
                  <path
                    d="M 170 0 L 170 80"
                    fill="none"
                    stroke="#dc2626"
                    strokeWidth="12"
                    strokeLinecap="round"
                  />
                  <path
                    d="M 170 0 L 170 80"
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth="12"
                    strokeDasharray="14 14"
                    strokeLinecap="round"
                  />
                </>
              ) : seasonalTheme === 'halloween' ? (
                <>
                  <path
                    d="M 170 0 L 170 80"
                    fill="none"
                    stroke="#f97316"
                    strokeWidth="10"
                    strokeLinecap="round"
                  />
                  <path
                    d="M 170 0 L 170 80"
                    fill="none"
                    stroke="#a855f7"
                    strokeWidth="10"
                    strokeDasharray="12 16"
                    strokeLinecap="round"
                  />
                </>
              ) : (
                <path
                  d="M 170 0 L 170 80"
                  fill="none"
                  stroke="var(--th-ruta)"
                  strokeWidth="6"
                  strokeDasharray="3 14"
                  strokeLinecap="round"
                  opacity="0.85"
                />
              )}
              {isCourseCompleted && (
                <path
                  d="M 170 0 L 170 80"
                  fill="none"
                  stroke="#fbbf24"
                  strokeWidth={seasonalTheme === 'christmas' ? '12' : '8'}
                  strokeDasharray={seasonalTheme === 'christmas' ? '14 14' : '3 14'}
                  strokeLinecap="round"
                  className="ruta-viva"
                />
              )}
            </svg>
          </div>

          {/* NODO Y TARJETA FINAL DE CERTIFICADO */}
          {isCourseCompleted ? (
            <div className="relative flex flex-col items-center w-full animate-fade-in">
              {/* Estación Dorada Luminosa con Vista Previa al dar clic */}
              <button
                type="button"
                onClick={() => setShowPreviewModal(true)}
                className="relative p-3.5 rounded-3xl border-2 border-amber-400 bg-gradient-to-b from-amber-500/20 via-amber-950/40 to-black/60 shadow-[0_0_55px_rgba(245,158,11,0.6)] hover:scale-105 active:scale-95 transition-all cursor-pointer group"
                title="Ver vista previa del certificado"
              >
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-500 via-yellow-400 to-amber-200 flex items-center justify-center shadow-lg shadow-amber-500/50 group-hover:brightness-110 transition-all">
                  <Award className="w-9 h-9 text-slate-950 stroke-[2.5]" />
                </div>
              </button>

              {/* Banner Oficial de Curso Completado (Diseño Glassmorphism Ultra-Premium) */}
              <div className="mt-5 w-full max-w-xl mx-auto rounded-3xl border-2 border-amber-400/50 dark:border-amber-400/40 bg-white/95 dark:bg-[#120e24]/95 p-6 sm:p-7 shadow-2xl dark:shadow-[0_0_50px_rgba(245,158,11,0.22)] backdrop-blur-2xl flex flex-col gap-5 text-left transition-all">
                <div className="flex items-start sm:items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-400 text-slate-950 flex items-center justify-center shrink-0 shadow-lg shadow-amber-500/30">
                    <Award className="w-8 h-8 stroke-[2.2]" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                        ✨ ¡Meta Alcanzada!
                      </span>
                    </div>
                    <h2 className="text-xl font-black text-slate-900 dark:text-white leading-tight mt-1">
                      Curso completado con éxito
                    </h2>
                    <p className="mt-1 text-xs text-slate-600 dark:text-amber-100/80 leading-relaxed">
                      Tu diploma oficial de <span className="font-bold text-slate-900 dark:text-white">{course.title}</span> está listo para ser emitido con validez institucional.
                    </p>
                    {certificate?.verificationCode && (
                      <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-500/10 dark:bg-amber-400/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 font-mono text-[11px]">
                        <span className="opacity-75">DOC:</span>
                        <span className="font-bold">{certificate.verificationCode}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-200 dark:border-amber-400/20 flex flex-wrap sm:flex-nowrap items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setShowPreviewModal(true)}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-xs font-bold text-amber-800 dark:text-amber-300 border border-amber-500/30 hover:border-amber-500/50 transition-all cursor-pointer"
                  >
                    <Eye className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    <span>Ver Diploma</span>
                  </button>

                  {certificate?.verificationCode && (
                    <button
                      type="button"
                      onClick={() => setShowVerifyModal(true)}
                      className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-xs font-bold text-slate-800 dark:text-white border border-slate-200 dark:border-white/10 transition-colors cursor-pointer"
                    >
                      <ShieldCheck className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                      <span>Verificar</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setShowPreviewModal(true)}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 via-amber-300 to-yellow-500 text-slate-950 text-xs font-black shadow-lg shadow-amber-500/30 hover:brightness-110 active:scale-95 transition-all cursor-pointer"
                  >
                    <Download className="w-4 h-4 stroke-[2.5]" />
                    <span>Descargar Diploma</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="relative flex flex-col items-center w-full animate-fade-in">
              {/* Estación Bloqueada */}
              <div
                className="relative p-3 rounded-3xl border border-slate-300 dark:border-purple-500/30 bg-white/90 dark:bg-[#151126]/90 text-slate-400 dark:text-purple-300/40 flex items-center justify-center shadow-lg"
              >
                <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-purple-950/60 border border-slate-200 dark:border-purple-500/20 flex items-center justify-center relative">
                  <Award className="w-8 h-8 text-slate-400 dark:text-purple-400/40" />
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-slate-200 dark:bg-[#0c0916] border border-slate-300 dark:border-purple-400/50 flex items-center justify-center shadow-sm">
                    <Lock className="w-3.5 h-3.5 text-slate-600 dark:text-purple-300" />
                  </div>
                </div>
              </div>

              {/* Tarjeta de Certificado Bloqueado Ultra-Elegante */}
              <div className="mt-5 w-full max-w-xl mx-auto rounded-3xl border border-slate-200 dark:border-purple-500/25 bg-white/95 dark:bg-[#120f22]/95 p-6 shadow-xl backdrop-blur-2xl flex flex-col gap-4 text-left">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-purple-500/15 border border-slate-200 dark:border-purple-500/25 flex items-center justify-center text-slate-500 dark:text-purple-300 shrink-0">
                    <Lock className="w-6 h-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 dark:bg-purple-500/20 text-slate-600 dark:text-purple-300 border border-slate-200 dark:border-purple-500/30">
                        🔒 Certificado Bloqueado
                      </span>
                    </div>
                    <h3 className="text-base font-extrabold text-slate-900 dark:text-white mt-1">
                      Acreditación Oficial de Finalización
                    </h3>
                    <p className="mt-1 text-xs text-slate-600 dark:text-purple-200/70 leading-relaxed">
                      Hasta que el <span className="font-bold text-cyan-600 dark:text-cyan-400">Orbe Celestial</span> no complete la misión final ({lastMission?.video.title || 'Misión Final'}), este diploma permanece protegido.
                    </p>
                  </div>
                </div>

                {/* Barra de progreso de requisitos */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-600 dark:text-purple-200/80">
                      Misiones completadas: <span className="font-bold text-slate-900 dark:text-white">{completedCount} de {totalMissions}</span>
                    </span>
                    <span className="font-bold text-cyan-600 dark:text-cyan-400">
                      {progressPct}%
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-white/10 overflow-hidden">
                    <div 
                      className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-purple-500 transition-all duration-500"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                </div>

                {/* Acciones */}
                <div className="pt-2 border-t border-slate-200 dark:border-purple-500/20 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      const nextMission = allMissions.find((m) => !isCompleted(m.video.id)) ?? (allMissions.length > 0 ? allMissions[allMissions.length - 1] : null);
                      if (nextMission) {
                        onOpenLesson(nextMission.video, nextMission.module);
                      }
                    }}
                    className="w-full sm:w-auto flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-600 hover:brightness-110 active:scale-95 text-white font-black text-xs uppercase tracking-wider shadow-md shadow-cyan-500/20 transition-all cursor-pointer"
                  >
                    <span>Continuar Misión Siguiente</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>

                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <button
                      type="button"
                      disabled
                      className="flex-1 sm:flex-none px-3 py-2 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-400 dark:text-white/30 text-xs font-bold flex items-center justify-center gap-1.5 cursor-not-allowed opacity-60"
                      title="Debes completar la última misión con el orbe para habilitar este botón"
                    >
                      <Lock className="w-3 h-3" />
                      <span>Ver Diploma</span>
                    </button>
                    <button
                      type="button"
                      disabled
                      className="flex-1 sm:flex-none px-3 py-2 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-400 dark:text-white/30 text-xs font-bold flex items-center justify-center gap-1.5 cursor-not-allowed opacity-60"
                      title="Debes completar la última misión con el orbe para habilitar este botón"
                    >
                      <Lock className="w-3 h-3" />
                      <span>Descargar</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* Modal de Vista Previa del Certificado (con alta resolución y descarga) */}
      <CertificatePreviewModal
        isOpen={showPreviewModal}
        onClose={() => setShowPreviewModal(false)}
        courseTitle={course.title}
        studentName={currentUser?.name || 'Estudiante'}
        verificationCode={certificate?.verificationCode}
        onOpenVerifyModal={() => setShowVerifyModal(true)}
      />

      {/* Modal de Verificación Pública de Certificado */}
      <CertificateVerifyModal
        isOpen={showVerifyModal}
        onClose={() => setShowVerifyModal(false)}
        initialCode={certificate?.verificationCode}
      />

    </div>
  );
};
