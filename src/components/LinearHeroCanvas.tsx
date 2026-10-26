import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Play, 
  Tv, 
  Bot, 
  Command, 
  ShieldCheck, 
  Sparkles, 
  CheckCircle2, 
  Subtitles, 
  ChevronRight, 
  Search, 
  Layers, 
  Volume2, 
  Maximize2,
  Clock,
  Terminal,
  Zap
} from 'lucide-react';

export const LinearHeroCanvas: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'player' | 'ian' | 'palette' | 'cert'>('player');
  const [isPlaying, setIsPlaying] = useState(true);
  const [activeTranscriptIdx, setActiveTranscriptIdx] = useState(1);
  const openCommandPalette = () => {
    window.dispatchEvent(new CustomEvent('docentos-open-palette'));
  };

  // Auto-ciclo de transcripción para dar vida a la animación
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveTranscriptIdx((prev) => (prev + 1) % 4);
    }, 3200);
    return () => clearInterval(interval);
  }, []);

  const tabs = [
    { id: 'player', label: 'Theater Player', icon: Tv, badge: 'Inmersivo' },
    { id: 'ian', label: 'Copiloto Ian 2.0', icon: Bot, badge: 'IA Nativa' },
    { id: 'palette', label: 'Command Palette', icon: Command, badge: '⌘K' },
    { id: 'cert', label: 'Certificación & RBAC', icon: ShieldCheck, badge: 'Verificable' },
  ] as const;

  const sampleTranscripts = [
    { time: '01:14', text: 'Optimizamos la reactividad del estado global eliminando re-renders innecesarios.' },
    { time: '01:48', text: 'El pipeline de IA analiza la tasa de comprensión y ajusta la velocidad de explicación.' },
    { time: '02:22', text: 'Cada progreso se valida criptográficamente con tokens seguros de sesión.' },
    { time: '03:05', text: 'Con Command Palette puedes saltar a cualquier módulo o nota en milisegundos.' },
  ];

  return (
    <div className="relative mx-auto w-full max-w-5xl mt-12 select-none font-sans">
      
      {/* Resplandor ambiental trasero Linear (Backdrop glow) */}
      <div className="absolute -inset-4 bg-gradient-to-r from-cyan-500/15 via-purple-600/20 to-blue-600/15 blur-3xl opacity-75 -z-10 rounded-[32px] pointer-events-none" />

      {/* Ventana Principal Estilo Linear (Titanium Window Chrome) */}
      <div className="relative rounded-2xl bg-[#090a10]/95 border border-white/[0.12] shadow-[0_20px_80px_rgba(0,0,0,0.85)] overflow-hidden backdrop-blur-2xl ring-1 ring-white/10">
        
        {/* Barra Superior de la Ventana (Window Bar) */}
        <div className="h-11 px-4 border-b border-white/[0.08] bg-white/[0.02] flex items-center justify-between">
          {/* Traffic light dots */}
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-rose-500/80 inline-block border border-rose-600/40" />
            <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block border border-amber-600/40" />
            <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block border border-emerald-600/40" />
            
            <span className="ml-3 text-[11px] font-mono text-slate-500 hidden sm:inline">
              docentos / engine / v2026.1-live
            </span>
          </div>

          {/* Trigger de Command Palette central */}
          <button
            onClick={openCommandPalette}
            className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] hover:border-cyan-500/40 text-[11px] text-slate-400 hover:text-white transition-all group"
          >
            <Search className="w-3 h-3 text-slate-500 group-hover:text-cyan-400" />
            <span className="hidden md:inline">Buscar lecciones, comandos o IA...</span>
            <kbd className="px-1.5 py-0.2 rounded bg-white/10 font-mono text-[9px] text-slate-300">
              ⌘K
            </kbd>
          </button>

          {/* Estado de conectividad en vivo */}
          <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-mono">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span className="hidden sm:inline">60 FPS · READY</span>
          </div>
        </div>

        {/* Pestañas Interactivas Estilo Linear con Subrayado Fluido */}
        <div className="flex items-center gap-1 px-4 pt-3 border-b border-white/[0.06] bg-[#0c0d14]/70 overflow-x-auto no-scrollbar">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`relative flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                  isActive ? 'text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.02]'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-cyan-400' : 'text-slate-500'}`} />
                <span>{tab.label}</span>
                <span className={`text-[9px] px-1.5 py-0.2 rounded font-mono ${
                  isActive ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'bg-white/5 text-slate-500'
                }`}>
                  {tab.badge}
                </span>

                {/* Subrayado animado continuo con layoutId */}
                {isActive && (
                  <motion.div
                    layoutId="linearHeroActiveTab"
                    className="absolute -bottom-px left-0 right-0 h-[2px] bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-500 shadow-[0_0_12px_rgba(6,182,212,0.8)]"
                    transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Contenedor del Escenario Interactivo */}
        <div className="p-4 sm:p-6 bg-gradient-to-b from-[#08090f] to-[#040508] min-h-[360px] flex flex-col justify-center">
          <AnimatePresence mode="wait">
            
            {/* ESCENARIO 1: THEATER PLAYER & TRANSCRIPCIÓN SINCRONIZADA */}
            {activeTab === 'player' && (
              <motion.div
                key="player"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.25 }}
                className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center"
              >
                {/* Pantalla de Video Simulada con HUD flotante */}
                <div className="lg:col-span-7 relative rounded-xl bg-black border border-white/10 overflow-hidden shadow-2xl aspect-video flex flex-col justify-between group">
                  {/* Resplandor Ambilight simulado */}
                  <div className="absolute inset-0 bg-gradient-to-tr from-cyan-600/20 via-transparent to-purple-600/20 opacity-40 group-hover:opacity-60 transition-opacity" />

                  {/* Header flotante */}
                  <div className="relative p-3 flex items-center justify-between text-xs">
                    <span className="px-2 py-0.5 rounded bg-black/60 border border-white/10 text-[10px] font-mono text-cyan-300">
                      MODO CINE ACTIVO
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">1080p · 60fps</span>
                  </div>

                  {/* Centro con botón de Play / Pause */}
                  <div className="relative flex flex-col items-center justify-center">
                    <button
                      onClick={() => setIsPlaying(!isPlaying)}
                      className="w-14 h-14 rounded-full bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/40 text-cyan-300 flex items-center justify-center shadow-lg shadow-cyan-500/20 group-hover:scale-110 transition-transform"
                    >
                      <Play className="w-6 h-6 fill-current ml-0.5" />
                    </button>
                    <span className="text-[11px] text-slate-300 font-medium mt-3">
                      Arquitectura Distribuida y Algoritmos de Aprendizaje
                    </span>
                  </div>

                  {/* Barra de progreso inferior y controles */}
                  <div className="relative p-3 bg-gradient-to-t from-black/80 to-transparent flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-cyan-400">02:22 / 18:40</span>
                      <div className="w-28 h-1 bg-white/20 rounded-full overflow-hidden">
                        <div className="w-2/5 h-full bg-cyan-400 rounded-full" />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-1.5 py-0.2 rounded bg-white/10 text-[9px] font-mono text-slate-300">1.25x</span>
                      <Maximize2 className="w-3.5 h-3.5 text-slate-400" />
                    </div>
                  </div>
                </div>

                {/* Transcripción lateral en tiempo real */}
                <div className="lg:col-span-5 flex flex-col h-full space-y-2 text-xs">
                  <div className="flex items-center justify-between pb-1 border-b border-white/[0.08]">
                    <div className="flex items-center gap-1.5 text-slate-300 font-medium text-[11px]">
                      <Subtitles className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Transcripción Sincronizada</span>
                    </div>
                    <span className="text-[9px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded">
                      LIVE
                    </span>
                  </div>

                  <div className="space-y-2">
                    {sampleTranscripts.map((t, idx) => {
                      const isCurrent = idx === activeTranscriptIdx;
                      return (
                        <div
                          key={idx}
                          onClick={() => setActiveTranscriptIdx(idx)}
                          className={`p-2.5 rounded-lg border transition-all cursor-pointer ${
                            isCurrent
                              ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-100 shadow-sm'
                              : 'bg-white/[0.02] border-white/5 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="font-mono text-[9px] font-bold text-cyan-400 bg-cyan-500/15 px-1 rounded">
                              {t.time}
                            </span>
                            {isCurrent && (
                              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                            )}
                          </div>
                          <p className="text-[11px] leading-relaxed line-clamp-2">
                            {t.text}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            )}

            {/* ESCENARIO 2: COPILOTO IAN 2.0 (IA PEDAGÓGICA) */}
            {activeTab === 'ian' && (
              <motion.div
                key="ian"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.25 }}
                className="max-w-2xl mx-auto w-full space-y-3"
              >
                <div className="p-3.5 rounded-xl bg-purple-950/20 border border-purple-500/30 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-purple-500/20 text-purple-300">
                      <Bot className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white">Ian 2.0 · Copiloto de Estudio</h4>
                      <p className="text-[11px] text-slate-400">Contextualizado a la lección actual y tu historial de notas.</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-purple-300 bg-purple-500/15 px-2 py-0.5 rounded-full border border-purple-500/30">
                    GEMINI FLASH 2.5
                  </span>
                </div>

                <div className="space-y-2">
                  <div className="p-3 rounded-xl bg-white/[0.04] text-slate-200 text-xs ml-12 border border-white/5">
                    <span className="text-[10px] text-slate-500 font-mono block mb-1">Tú · hace 1 min</span>
                    ¿Cómo garantizo que el pipeline de videos no bloquee la base de datos al importar 50 lecciones?
                  </div>

                  <div className="p-3.5 rounded-xl bg-gradient-to-r from-purple-950/30 via-slate-900/40 to-slate-900/30 border border-purple-500/30 text-xs text-slate-200 mr-8 space-y-2">
                    <div className="flex items-center gap-2 text-[10px] text-purple-300 font-mono">
                      <Sparkles className="w-3 h-3 text-purple-400" />
                      <span>Ian 2.0 Tutor</span>
                    </div>
                    <p className="text-[11px] leading-relaxed text-slate-300">
                      Implementa un patrón de <strong>Worker Queue asíncrono con batching</strong>. En DocentOS utilizamos transacciones atómicas con Prisma y actualizamos el progreso del alumno de forma optimista en memoria antes de persistir:
                    </p>
                    <div className="p-2 rounded bg-black/60 font-mono text-[10px] text-cyan-300 border border-white/10">
                      <code>await prisma.$transaction(lessons.map(l =&gt; createLesson(l)));</code>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ESCENARIO 3: COMMAND PALETTE ⌘K */}
            {activeTab === 'palette' && (
              <motion.div
                key="palette"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.25 }}
                className="max-w-xl mx-auto w-full rounded-xl bg-[#0e0f18] border border-white/15 p-2 shadow-2xl shadow-cyan-950/40"
              >
                <div className="flex items-center gap-2.5 px-3 py-2 border-b border-white/10">
                  <Search className="w-4 h-4 text-cyan-400" />
                  <span className="text-xs text-slate-200 font-medium">Buscar acción, lección o cambio de interfaz...</span>
                  <kbd className="ml-auto px-1.5 py-0.5 rounded bg-white/10 text-[9px] font-mono text-slate-400">ESC</kbd>
                </div>

                <div className="p-1 space-y-1">
                  {[
                    { title: 'Activar DocentOS Vanguard (2026 AI-Native)', cat: 'UI Lab', icon: Sparkles, active: true },
                    { title: 'Alternar Modo Cine Inmersivo', cat: 'Estudio', icon: Tv },
                    { title: 'Consultar al Asistente Ian', cat: 'Copiloto IA', icon: Bot },
                    { title: 'Ir al Panel de Administración', cat: 'Navegación', icon: Terminal },
                  ].map((item, idx) => (
                    <div
                      key={idx}
                      className={`flex items-center justify-between p-2 rounded-lg text-xs transition-colors cursor-pointer ${
                        item.active ? 'bg-cyan-500/15 text-cyan-200 border border-cyan-500/30' : 'text-slate-300 hover:bg-white/5'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <item.icon className={`w-3.5 h-3.5 ${item.active ? 'text-cyan-400' : 'text-slate-400'}`} />
                        <span>{item.title}</span>
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono">{item.cat}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* ESCENARIO 4: CERTIFICADOS & SEGURIDAD RBAC */}
            {activeTab === 'cert' && (
              <motion.div
                key="cert"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.25 }}
                className="max-w-2xl mx-auto w-full grid grid-cols-1 md:grid-cols-2 gap-4"
              >
                <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-950/20 to-slate-900/40 border border-emerald-500/30 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-emerald-400">
                      <ShieldCheck className="w-5 h-5" />
                      <span className="font-bold text-xs">Certificación Criptográfica</span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Cada certificado emitido incluye un hash SHA-256 inmutable verificable por empleadores mediante código QR o enlace público.
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-[11px] font-mono text-emerald-300">
                    <span>ID: DOC-2026-X892</span>
                    <span className="flex items-center gap-1 text-emerald-400 font-bold">
                      <CheckCircle2 className="w-3.5 h-3.5" /> VERIFICADO
                    </span>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-gradient-to-br from-blue-950/20 to-slate-900/40 border border-blue-500/30 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-blue-400">
                      <Zap className="w-5 h-5" />
                      <span className="font-bold text-xs">Control de Acceso RBAC Estricto</span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Garantía de Administrador Único, Pases VIP con Stripe, y permisos diferenciados para estudiantes, mentores y auditores.
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-white/10 flex items-center gap-2 text-[10px] font-mono">
                    <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">ADMIN</span>
                    <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">MENTOR</span>
                    <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">VIP PASS</span>
                  </div>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>

        {/* Footer de la Ventana: Indicador y métricas */}
        <div className="px-4 py-2.5 bg-black/50 border-t border-white/[0.06] flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            <span className="text-[11px] font-medium text-slate-300">Interactúa con las pestañas superiores para previsualizar el motor</span>
          </div>
          <div className="flex items-center gap-2 font-mono text-[10px] text-slate-500">
            <span>DOCENTOS ODYSSEY 2026</span>
          </div>
        </div>

      </div>

    </div>
  );
};
