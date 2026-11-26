import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
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
  CandyCane,
  Snowflake,
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
  isLessonModalOpen?: boolean;
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

export const CandyCaneIcon: React.FC<{ className?: string; size?: number }> = ({ className = '', size = 24 }) => (
  <CandyCane size={size} className={className} color="#a72832" strokeWidth={2.2} aria-hidden="true" />
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
    className={`inline-block filter  ${className}`}
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
 * Rótulo de una isla. Todos miden lo mismo; un título que no cabe en dos líneas se
 * recorta y avisa con `onOverflowChange` para que la isla muestre «Ver más».
 */
const IslaRotulo: React.FC<{
  id: string;
  title: string;
  onOverflowChange: (id: string, overflowing: boolean) => void;
}> = ({ id, title, onOverflowChange }) => {
  const textRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const element = textRef.current;
    if (!element) return;
    const measure = () => onOverflowChange(id, element.scrollHeight - element.clientHeight > 1);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    // El ancho del rótulo es fijo, pero la fuente puede cargar tarde o cambiar con el tema.
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [id, title, onOverflowChange]);
  return (
    <span className="rotulo" aria-hidden="true">
      <span ref={textRef} className="rotulo-texto">
        {title}
      </span>
    </span>
  );
};

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
  celebratingMissionId: string | null;
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
  celebratingMissionId,
}) => {
  const { t } = useTranslation();
  const baseRef = useRef<SVGPathElement>(null);
  const estelaRef = useRef<SVGPathElement>(null);
  const tramosRef = useRef<number[] | null>(null);
  // Islas cuyo título no cabe en el rótulo de tamaño fijo y necesitan «Ver más».
  const [longTitles, setLongTitles] = useState<Record<string, boolean>>({});
  const reportOverflow = useCallback(
    (id: string, overflowing: boolean) =>
      setLongTitles((prev) => (prev[id] === overflowing ? prev : { ...prev, [id]: overflowing })),
    [],
  );

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
  const celebratingMissionIndex = missions.findIndex((mission) => mission.video.id === celebratingMissionId);
  const celebratingSide = celebratingMissionIndex < 0 ? undefined : (pos[celebratingMissionIndex]?.[0] ?? 50) < 50 ? 'left' : 'right';

  return (
    <section className={`relative my-10${celebratingMissionIndex >= 0 ? ' christmas-module-celebrating' : ''}`}>
      {/* 1. Encabezado de Módulo en píldora con luz de cristal y conector continuo entre módulos */}
      <div className="relative mt-12 mb-6 w-full max-w-xl mx-auto flex flex-col items-center">
        {/* Conector SVG continuo que pasa por detrás del encabezado */}
        {hasPrevModule && (
          <div className="absolute -top-12 -bottom-10 inset-x-0 flex justify-center pointer-events-none z-0 overflow-visible">
            <svg className="w-full max-w-[340px] h-full overflow-visible" viewBox="0 0 340 100" preserveAspectRatio="none">
              <defs>
                <linearGradient id={`xmas-beam-${module.id}`} gradientUnits="userSpaceOnUse" x1="170" y1="0" x2="170" y2="100">
                  <stop offset="0" stopColor="#fbbf24" stopOpacity="0" />
                  <stop offset="0.5" stopColor="#fbbf24" />
                  <stop offset="1" stopColor="#fbbf24" stopOpacity="0" />
                </linearGradient>
                <linearGradient id={`th-connector-grad-${module.id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#ffffff" />
                  <stop offset="0.5" stopColor="#fbbf24" />
                  <stop offset="1" stopColor="#dc2626" />
                </linearGradient>
              </defs>
              
              {/* Conector navideño discreto entre módulos. */}
              {seasonalTheme === 'christmas' ? (
                <path d="M 170 0 L 170 100" fill="none" stroke="var(--color-line-strong)" strokeWidth="5" strokeLinecap="round" className="christmas-connector" />
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
                  stroke={seasonalTheme === 'christmas' ? `url(#xmas-beam-${module.id})` : `url(#th-connector-grad-${module.id})`}
                  strokeWidth={seasonalTheme === 'christmas' ? '3' : '8'}
                  strokeDasharray={seasonalTheme === 'christmas' ? undefined : '3 14'}
                  strokeLinecap="round"
                  className={`ruta-viva${seasonalTheme === 'christmas' ? ' christmas-connector-done' : ''}`}
                />
              )}
            </svg>
          </div>
        )}

        {/* Tarjeta del encabezado en píldora con z-10 para flotar sobre la línea continua */}
        <div className="academy-module-heading relative z-10 w-full flex flex-wrap items-center justify-between gap-3 px-1 py-4 border-b border-line   transition-colors">
          <div className="flex flex-1 items-center gap-3.5 min-w-0">
            <div className="min-w-0">
              <span className="text-sm font-medium text-ink-muted block">
                {t('path.moduleNumber', { number: modIdx + 1, defaultValue: `Módulo ${modIdx + 1}` })}
              </span>
              <h2 className="text-base font-semibold text-ink leading-snug">
                {module.title}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isModuleAllCompleted ? (
              <span className="flex items-center gap-1 text-sm px-2.5 py-0.5 rounded-full font-bold bg-brand-cyan/10 text-brand-cyan dark:text-brand-cyan border border-brand-cyan/30">
                <Check className="w-3 h-3 text-brand-cyan dark:text-brand-cyan" />
                {t('path.completed', 'Completado')}
              </span>
            ) : (
              <span className="text-sm px-2.5 py-0.5 rounded-full font-semibold border border-line text-ink-soft">
                {t('path.lessonsCount', { count: missions.length, defaultValue_one: '{{count}} lección', defaultValue_other: '{{count}} lecciones' })}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 2. El Camino Serpentino de Islas */}
      <div className="camino" style={{ height: `${height}px` }}>
        {/* Decoraciones Temáticas Flotantes en Ambos Laterales del Módulo */}
        <ModuleSideDecorations seasonalTheme={seasonalTheme} modIdx={modIdx} height={height} celebratingSide={celebratingSide} />

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
            
            {/* Trazado navideño discreto. */}
            {seasonalTheme === 'christmas' ? (
              <path ref={baseRef} className="ruta-base" d={ruta} fill="none" stroke="var(--color-line-strong)" strokeWidth="5" strokeLinecap="round" />
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
              stroke={seasonalTheme === 'christmas' ? '#bd8232' : `url(#th-estela-color-${module.id})`}
              strokeWidth={seasonalTheme === 'christmas' ? '5' : seasonalTheme === 'halloween' ? '10' : '8'}
              strokeDasharray={seasonalTheme === 'christmas' ? undefined : seasonalTheme === 'halloween' ? '12 16' : '3 14'}
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

          const toggleMission = () =>
            setSelectedNode((prev) =>
              prev?.video.id === mission.video.id
                ? null
                : {
                    video: mission.video,
                    module: mission.module,
                    index: mission.missionNumber,
                  }
            );

          return (
            <React.Fragment key={mission.video.id}>
              <button
                type="button"
                id={isCurrent ? 'celestial-orb-island' : undefined}
                className={`isla ${estado}${celebratingMissionId === mission.video.id ? ' isla--celebrating' : ''} focus:outline-none focus:ring-2 focus:ring-(--th-foco) focus:ring-offset-2 focus:ring-offset-[#0a0a0f] rounded-2xl`}
                style={{ 
                  left: `${coordinates[0]}%`, 
                  top: `${coordinates[1]}%`,
                  zIndex: isSelected ? 20 : 15,
                }}
                aria-label={t('misionMissionNumberDeTotalMissionsTitle', 'Misión {{missionNumber}} de {{totalMissions}}: {{title}}, estado: {{estado}}', { missionNumber: mission.missionNumber, totalMissions, title: mission.video.title, estado })}
                aria-expanded={isSelected}
                aria-controls={isSelected ? `mission-detail-${mission.video.id}` : undefined}
                onClick={toggleMission}
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
                      <CandyCaneIcon size={28} />
                    ) : (
                      <Sparkles className="w-8 h-8 text-brand-cyan" />
                    )
                  ) : (
                    <IconComponent className="w-8 h-8 text-purple-300/70" />
                  )}
                </span>
                {celebratingMissionId === mission.video.id && <Sparkles className="mission-complete-sparkle" size={22} aria-hidden="true" />}
                
                <IslaRotulo id={mission.video.id} title={mission.video.title} onOverflowChange={reportOverflow} />
              </button>

              {/* El título no cabe en el rótulo: «Ver más» abre la ficha de la misión, que lo muestra completo. */}
              {longTitles[mission.video.id] && (
                <button
                  type="button"
                  className="isla-vermas"
                  style={{ left: `${coordinates[0]}%`, top: `${coordinates[1]}%`, zIndex: isSelected ? 21 : 16 }}
                  aria-expanded={isSelected}
                  aria-controls={isSelected ? `mission-detail-${mission.video.id}` : undefined}
                  aria-label={`${t('catalog.seeMore', 'Ver más')}: ${mission.video.title}`}
                  onClick={toggleMission}
                >
                  {t('catalog.seeMore', 'Ver más')}
                </button>
              )}

              {/* Popover / Ficha de Misión desplegada al hacer clic, con separación limpia sin solapar */}
              {isSelected && (
                <div
                  id={`mission-detail-${mission.video.id}`}
                  role="region"
                  aria-labelledby={`mission-title-${mission.video.id}`}
                  className="mision-popover"
                  style={{
                    left: '50%',
                    ...(isNearBottom
                      ? { bottom: `calc(${100 - coordinates[1]}% + 52px)` }
                      : { top: `calc(${coordinates[1]}% + ${longTitles[mission.video.id] ? 150 : 103}px)` }),
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="pt-1 text-sm font-medium text-ink-muted">
                      {t('path.missionNumber', { current: mission.missionNumber, total: totalMissions, defaultValue: `Misión ${mission.missionNumber} de ${totalMissions}` })}
                    </span>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setSelectedNode(null);
                      }}
                      className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-ink-muted transition-colors hover:bg-raised hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-cyan"
                      aria-label={t('common.close', 'Cerrar')}
                    >
                      <X size={18} aria-hidden="true" />
                    </button>
                  </div>

                  <h3 id={`mission-title-${mission.video.id}`} className="mt-1 text-lg font-semibold leading-snug text-ink">
                    {mission.video.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                    {mission.module.title}
                  </p>

                  {!isUnlocked && !completed && (
                    <div className="mt-5 rounded-lg bg-raised p-3 text-sm text-ink-soft">
                      <div className="flex items-start gap-2">
                        <Lock size={16} className="mt-0.5 shrink-0 text-ink-muted" aria-hidden="true" />
                        <div>
                          <p>{t('path.unlockPrerequisite', 'Completa la misión anterior para desbloquear esta lección:')}</p>
                          <p className="mt-1 font-medium text-ink">{allMissions[mission.globalIndex - 1]?.video.title}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {(isUnlocked || completed) && (
                    <div className="mt-5 border-t border-line pt-4">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedNode(null);
                          onOpenLesson(mission.video, mission.module);
                        }}
                        className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand-cyan px-4 py-2.5 text-sm font-semibold text-on-brand transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-cyan"
                      >
                        {completed ? t('path.reviewMission', 'Repasar misión') : t('path.startMission', 'Iniciar misión')}
                        <ArrowRight size={16} aria-hidden="true" />
                      </button>
                    </div>
                  )}
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
                className="w-full h-full rounded-full flex items-center justify-center border-2 border-white/80"
                style={{
                  background: 'linear-gradient(180deg, #c4b5fd 0%, #8b5cf6 45%, #6d28d9 100%)',
                }}
              >
                <svg viewBox="0 0 34 34" fill="none" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className="w-9 h-9 filter ">
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
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 filter  animate-bounce select-none pointer-events-none">
                <HalloweenCandyIcon size={26} />
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
};

/** Adornos de la tarjeta de meta alcanzada: acebo en las esquinas y estrellas que titilan. */
const ChristmasGoalDecor: React.FC = () => (
  <>
    <svg aria-hidden className="christmas-goal__holly christmas-goal__holly--left" width="64" height="34" viewBox="0 0 44 22">
      <path d="M22 11c-4-7-12-9-20-6 3 6 11 9 20 6z" fill="#2f9e6b" /><path d="M22 11c4 7 12 9 20 6-3-6-11-9-20-6z" fill="#237a53" />
      <circle cx="22" cy="9" r="3.2" fill="#dc2626" /><circle cx="18.5" cy="12.5" r="3" fill="#ef4444" /><circle cx="25.5" cy="12.5" r="3" fill="#b91c1c" />
    </svg>
    <svg aria-hidden className="christmas-goal__holly christmas-goal__holly--right" width="64" height="34" viewBox="0 0 44 22">
      <path d="M22 11c-4-7-12-9-20-6 3 6 11 9 20 6z" fill="#2f9e6b" /><path d="M22 11c4 7 12 9 20 6-3-6-11-9-20-6z" fill="#237a53" />
      <circle cx="22" cy="9" r="3.2" fill="#dc2626" /><circle cx="18.5" cy="12.5" r="3" fill="#ef4444" /><circle cx="25.5" cy="12.5" r="3" fill="#b91c1c" />
    </svg>
    {[0, 1, 2, 3].map((i) => (
      <svg key={i} aria-hidden className={`christmas-goal__star christmas-goal__star--${i}`} width="14" height="14" viewBox="0 0 24 24">
        <path d="M12 1l2.6 7.4L22 11l-7.4 2.6L12 21l-2.6-7.4L2 11l7.4-2.6z" fill="#fbbf24" />
      </svg>
    ))}
  </>
);

export const ConstellationCosmicPath: React.FC<ConstellationCosmicPathProps> = ({
  course,
  onOpenLesson,
  completedVideoIds = [],
  currentUser,
  certificate,
  activeVideoId: preferredActiveVideoId,
  isLessonModalOpen = false,
}) => {
  const { t } = useTranslation();
  const [selectedNode, setSelectedNode] = useState<{
    video: VideoDriveLink;
    module: Module;
    index: number;
  } | null>(null);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showLockedCertInfo, setShowLockedCertInfo] = useState(false);
  const [seasonalTheme, setSeasonalThemeState] = useState<SeasonalTheme>(getSeasonalTheme());
  const [celebratingMissionId, setCelebratingMissionId] = useState<string | null>(null);
  const pendingCelebrationRef = useRef<string | null>(null);
  const celebrationTimerRef = useRef<number | null>(null);
  const wasLessonModalOpenRef = useRef(isLessonModalOpen);

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

    const justCompleted = completedVideoIds.find((id) => !prevSet.has(id));
    if (seasonalTheme === 'christmas' && (isLessonModalOpen || wasLessonModalOpenRef.current) && justCompleted) {
      pendingCelebrationRef.current = justCompleted;
    }

    prevCompletedSetRef.current = currentSet;
    wasLessonModalOpenRef.current = isLessonModalOpen;
  }, [completedVideoIds, selectedNode, seasonalTheme, isLessonModalOpen]);

  useEffect(() => {
    if (isLessonModalOpen || seasonalTheme !== 'christmas' || !pendingCelebrationRef.current) return;
    setCelebratingMissionId(pendingCelebrationRef.current);
    pendingCelebrationRef.current = null;
    if (celebrationTimerRef.current !== null) window.clearTimeout(celebrationTimerRef.current);
    celebrationTimerRef.current = window.setTimeout(() => setCelebratingMissionId(null), 1300);
  }, [isLessonModalOpen, completedVideoIds, seasonalTheme]);

  useEffect(() => () => {
    if (celebrationTimerRef.current !== null) window.clearTimeout(celebrationTimerRef.current);
  }, []);

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
      if (target.closest('.mision-popover') || target.closest('.isla') || target.closest('.isla-vermas')) {
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
    <div className="academy-study-path camino-cosmico-fondo relative w-full min-h-screen bg-canvas dark:bg-[#07070b] text-ink dark:text-white font-sans select-none overflow-x-clip pb-44 pt-6">
      
      {/* 1. Astro Celestial / Sol Luminoso Radiante (de TalentHuman) */}
      <div 
        aria-hidden="true"
        className="astro" 
      />

      {/* 3. Fondo de Estrellas y Nebulosas de Fondo */}
      <div 
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none opacity-20 z-0 bg-[radial-gradient(1.5px_1.5px_at_12%_18%,var(--color-ink-muted)_50%,transparent_51%),radial-gradient(1px_1px_at_28%_42%,var(--color-ink-muted)_50%,transparent_51%),radial-gradient(2px_2px_at_71%_12%,var(--color-ink-muted)_50%,transparent_51%),radial-gradient(1px_1px_at_86%_36%,var(--color-ink-muted)_50%,transparent_51%),radial-gradient(1.5px_1.5px_at_54%_26%,var(--color-ink-muted)_50%,transparent_51%),radial-gradient(1px_1px_at_6%_66%,var(--color-ink-muted)_50%,transparent_51%),radial-gradient(1.5px_1.5px_at_93%_70%,var(--color-ink-muted)_50%,transparent_51%)]"
      />
      <div 
        aria-hidden="true"
        className="hidden dark:block absolute top-1/4 left-1/4 w-[min(500px,75vw)] h-[min(500px,75vw)] bg-purple-600/10 rounded-full blur-3xl pointer-events-none z-0"
      />
      <div 
        aria-hidden="true"
        className="hidden dark:block absolute top-2/3 right-1/4 w-[min(450px,75vw)] h-[min(450px,75vw)] bg-brand-cyan/10 rounded-full blur-3xl pointer-events-none z-0"
      />

      <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6">

        {/* 3. Banner Superior del Curso (Ruta Oficial de Aprendizaje) */}
        <div className={`academy-course-progress mb-8 flex flex-col gap-5 ${seasonalTheme === 'christmas' ? 'rounded-2xl border border-line bg-surface p-5 sm:p-7' : 'justify-between border-b border-line pb-6 sm:flex-row sm:items-center'}`}>
          <div className="flex items-start sm:items-center gap-4 min-w-0 flex-1">
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl sm:text-3xl font-semibold text-ink leading-tight">
                {course.title}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="text-sm font-normal text-ink-soft">
                  {t('path.modulesCount', { count: safeModules.length, defaultValue_one: '{{count}} módulo', defaultValue_other: '{{count}} módulos' })}
                </span>
                {seasonalTheme === 'halloween' && (
                  <span className="text-sm px-2.5 py-0.5 rounded-full font-bold bg-orange-500/15 text-orange-700 dark:text-orange-400 border border-orange-500/30 shrink-0 animate-pulse">
                    {t('path.halloweenSpecial', '🎃 Especial Noche de Brujas')}
                  </span>
                )}
                {seasonalTheme === 'christmas' && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-raised px-2.5 py-0.5 text-sm font-medium text-ink-soft">
                    <Snowflake size={14} className="text-brand-cyan" aria-hidden="true" />
                    {t('path.christmasSpecial', 'Especial Navideño')}
                  </span>
                )}
              </div>


            </div>
          </div>

          {/* El avance navideño ocupa todo el ancho del encabezado. */}
          {seasonalTheme === 'christmas' ? (
            <div className="border-t border-line pt-4">
              <div className="mb-2 flex items-center justify-between gap-4 text-sm">
                <span className="font-medium text-ink-soft">{t('path.progressChristmas', 'Progreso Navideño')}</span>
                <span className="tabular-nums font-semibold text-ink">{progressPct}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-raised" role="progressbar" aria-label={t('path.progressChristmas', 'Progreso Navideño')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progressPct}>
                <span className="christmas-candy-bar block h-full rounded-full transition-[width] duration-500" style={{ width: `${progressPct}%` }} />
              </div>
              <p className="mt-2 text-sm text-ink-muted">{t('path.missionsCompletedCount', { completed: completedCount, total: totalMissions, defaultValue: `Misiones completadas: ${completedCount} de ${totalMissions}` })}</p>
            </div>
          ) : (
          <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200 dark:border-white/5">
            <span className="text-sm font-medium text-ink-soft flex items-center gap-1">
              {seasonalTheme === 'halloween' ? (
                <>{t('path.progressSweet', 'Progreso Dulce 🍬')}</>
              ) : (
                <>{t('path.progress', 'Progreso')}</>
              )}
            </span>
            <div className="flex items-center gap-2.5">
              {seasonalTheme === 'halloween' ? (
                /* Barra temática de Dulces en Halloween */
                <div className="w-36 h-4 rounded-full bg-slate-200 dark:bg-purple-950/80 border-2 border-orange-500/60 p-0.5 relative ">
                  <div 
                    className="h-full bg-gradient-to-r from-amber-500 via-orange-500 to-purple-600 rounded-full transition-[width] duration-500 "
                    style={{ width: `${progressPct}%` }}
                  />
                  {progressPct > 0 && (
                    <div 
                      className="absolute -top-2 transition-[color,background-color,border-color,opacity,transform] duration-500 select-none -translate-x-1/2 pointer-events-none"
                      style={{ left: `${Math.min(94, Math.max(6, progressPct))}%` }}
                    >
                      <HalloweenCandyIcon size={24} />
                    </div>
                  )}
                </div>
              ) : (
                /* Barra Cósmica Estándar */
                <div className="w-28 h-2.5 rounded-full bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-700/80 overflow-hidden">
                  <div 
                    className="h-full bg-brand-cyan rounded-full transition-[width] duration-500"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              )}

              <span className={`text-xs font-semibold ${
                seasonalTheme === 'halloween'
                  ? 'text-orange-600 dark:text-orange-400'
                  : 'text-brand-cyan dark:text-brand-cyan'
              }`}>
                {progressPct}%
              </span>
            </div>
          </div>
          )}
        </div>

        {/* 4. El Sendero de Islas de Aprendizaje - MÓDULO POR MÓDULO CON LÍNEAS CONTINUAS */}
        <div className="space-y-4">
          {modulesWithMissions.length === 0 ? (
            <div className="py-16 px-6 text-center bg-surface/70 border border-slate-200/80 dark:border-purple-500/20 rounded-3xl  shadow-sm">
              <div className="text-4xl mb-3">{'🌌'}</div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-1">
                {t('path.emptyTitle', 'Constelación en estructuración')}
              </h3>
              <p className="text-xs text-ink-soft max-w-sm mx-auto">
                {t('path.emptyDesc', 'Este curso está organizando sus módulos y lecciones prácticas. Vuelve pronto para explorar la ruta cósmica.')}
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
                  celebratingMissionId={celebratingMissionId}
                />
              );
            })
          )}
        </div>

        {/* 5. ÚLTIMA RUTA: ESTACIÓN FINAL DEL CERTIFICADO OFICIAL */}
        <div className="relative flex flex-col items-center mt-6">
          
          {/* Conector punteado continuo hacia la estación final */}
          <div className="relative w-full max-w-[340px] h-20 pointer-events-none flex justify-center -my-2 overflow-visible">
            <svg className="w-full max-w-[340px] h-full overflow-visible" viewBox="0 0 340 80" preserveAspectRatio="none">
              <defs>
                <linearGradient id="cert-connector-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" className="estela-c1" />
                  <stop offset="0.5" className="estela-c2" />
                  <stop offset="1" stopColor="#fbbf24" />
                </linearGradient>
              </defs>
              {seasonalTheme === 'christmas' ? (
                <path d="M 170 0 L 170 80" fill="none" stroke="var(--color-line-strong)" strokeWidth="5" strokeLinecap="round" />
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
                  stroke={seasonalTheme === 'christmas' ? '#bd8232' : '#fbbf24'}
                  strokeWidth={seasonalTheme === 'christmas' ? '5' : '8'}
                  strokeDasharray={seasonalTheme === 'christmas' ? undefined : '3 14'}
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
              <div className={`${seasonalTheme === 'christmas' ? 'christmas-goal ' : ''}goal-card mx-auto w-full max-w-xl rounded-2xl border border-brand-cyan/40 bg-surface p-6 text-center sm:p-8`}>
                {seasonalTheme === 'christmas' && <ChristmasGoalDecor />}
                <span className="goal-medal" aria-hidden="true"><Award className="h-8 w-8" /></span>
                <p className="mt-4 text-sm font-semibold text-brand-cyan">{t('path.goalReachedPlain', 'Meta alcanzada')}</p>
                <h2 className="mt-1 text-2xl font-semibold leading-tight text-ink">{t('path.courseCompletedPlain', 'Curso completado')}</h2>
                <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-soft">
                  {t('path.courseCompletedDescPlain', { title: course.title, defaultValue: `Completaste ${course.title}. Tu diploma oficial ya está listo.` })}
                </p>
                {certificate?.verificationCode && (
                  <p className="mt-4 inline-flex items-center gap-2 rounded-lg border border-line px-3 py-1.5 text-sm">
                    <span className="text-ink-muted">{t('path.docCode', 'Código')}</span>
                    <span className="font-mono font-semibold text-ink">{certificate.verificationCode}</span>
                  </p>
                )}
                <div className={`mt-6 grid grid-cols-1 gap-3 ${certificate?.verificationCode ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
                  <button type="button" onClick={() => setShowPreviewModal(true)} className="flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-line text-sm font-medium text-ink transition-colors hover:bg-ink/5">
                    <Eye className="h-4 w-4" aria-hidden="true" />{t('path.viewDiploma', 'Ver diploma')}
                  </button>
                  {certificate?.verificationCode && (
                    <button type="button" onClick={() => setShowVerifyModal(true)} className="flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-line text-sm font-medium text-ink transition-colors hover:bg-ink/5">
                      <ShieldCheck className="h-4 w-4" aria-hidden="true" />{t('path.verifyDiploma', 'Verificar')}
                    </button>
                  )}
                  <button type="button" onClick={() => setShowPreviewModal(true)} className="flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-brand-cyan text-sm font-semibold text-on-brand transition-opacity hover:opacity-90">
                    <Download className="h-4 w-4" aria-hidden="true" />{t('path.downloadDiploma', 'Descargar diploma')}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <section
              className={`academy-locked-certificate relative w-full max-w-xl overflow-hidden rounded-2xl border border-line bg-surface p-5 sm:p-7${seasonalTheme === 'christmas' ? ' academy-locked-certificate--christmas' : ''}`}
              aria-labelledby="locked-certificate-title"
              style={seasonalTheme === 'christmas' ? { '--certificate-progress': progressPct / 100 } as React.CSSProperties : undefined}
            >
              <div className="flex items-start gap-4">
                <span className="relative grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-raised text-ink-muted" aria-hidden="true">
                  <Lock size={22} strokeWidth={1.8} />
                  {seasonalTheme === 'christmas' && (
                    <Lock
                      size={22}
                      strokeWidth={1.8}
                      className="absolute text-brand-cyan motion-safe:transition-opacity motion-safe:duration-500"
                      style={{ opacity: progressPct / 100 }}
                    />
                  )}
                </span>
                <div className="min-w-0">
                  <h2 id="locked-certificate-title" className="text-lg font-semibold leading-snug text-ink">
                    {t('path.lockedCertTitle', 'Certificado bloqueado')}
                  </h2>
                  <p className="mt-1 text-sm text-ink-muted">
                    {t('path.officialAccreditation', 'Acreditación oficial de finalización')}
                  </p>
                </div>
              </div>

              <p className="mt-5 text-sm leading-relaxed text-ink-soft">
                {t('path.lockedCertDesc', { mission: lastMission?.video.title || t('path.finalMission', 'Misión final'), defaultValue: `Completa la misión final (${lastMission?.video.title || 'Misión final'}) y aprueba los exámenes para obtener tu certificado.` })}
              </p>

              <div className="mt-6 border-t border-line pt-5">
                <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2 text-sm">
                  <span className="text-ink-soft">
                    {t('path.missionsCompletedCount', { completed: completedCount, total: totalMissions, defaultValue: `Misiones completadas: ${completedCount} de ${totalMissions}` })}
                  </span>
                  <span className="tabular-nums font-semibold text-ink">{progressPct}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-raised" role="progressbar" aria-label={t('path.lockedCertTitle', 'Certificado bloqueado')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progressPct}>
                  <span className={`block h-full rounded-full motion-safe:transition-[width] motion-safe:duration-500 ${seasonalTheme === 'christmas' ? 'christmas-candy-bar' : 'bg-brand-cyan'}`} style={{ width: `${progressPct}%` }} />
                </div>
              </div>

              {allMissions.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const nextMission = allMissions.find((m) => !isCompleted(m.video.id)) ?? allMissions[allMissions.length - 1];
                    onOpenLesson(nextMission.video, nextMission.module);
                  }}
                  className="mt-6 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand-cyan px-4 py-2.5 text-sm font-semibold text-on-brand transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-cyan sm:w-auto"
                >
                  {t('path.continueNextMission', 'Continuar siguiente misión')}
                  <ArrowRight size={16} aria-hidden="true" />
                </button>
              )}
            </section>
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
