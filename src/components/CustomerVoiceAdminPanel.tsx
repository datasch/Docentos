/**
 * Panel de Gestión de Escucha Activa & Voz del Alumno (`CustomerVoiceAdminPanel.tsx`)
 * DocentOS / Academia Giantucchi
 *
 * Módulo para Mentores y Administradores para:
 * 1. Monitorear el bienestar y satisfacción estudiantil en tiempo real
 * 2. Identificar alumnos bloqueados o frustrados para prevenir abandono
 * 3. Responder de forma directa y empática a cada estudiante
 * 4. Gestionar el ciclo de vida del aporte (Recibido -> En análisis -> Resuelto)
 */

import React, { useState, useEffect } from 'react';
import {
  HeartHandshake,
  AlertTriangle,
  Smile,
  HelpCircle,
  Lightbulb,
  CheckCircle2,
  Clock,
  Search,
  Filter,
  Send,
  UserCheck,
  RefreshCw,
  Sparkles,
  BookOpen,
  ChevronDown,
  X,
  MessageSquare,
} from 'lucide-react';
import {
  StudentVoiceEntry,
  StudentVoiceStats,
  VoiceSentiment,
  VoiceCategory,
  VoiceStatus,
} from '../types';
import {
  SENTIMENT_OPTIONS,
  CATEGORY_LABELS,
  STATUS_LABELS,
} from '../plugins/CustomerVoicePlugin';

export const CustomerVoiceAdminPanel: React.FC = () => {
  const [voices, setVoices] = useState<StudentVoiceEntry[]>([]);
  const [stats, setStats] = useState<StudentVoiceStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedVoice, setSelectedVoice] = useState<StudentVoiceEntry | null>(null);

  // Filtros
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [sentimentFilter, setSentimentFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Formulario de respuesta
  const [replyText, setReplyText] = useState<string>('');
  const [newStatus, setNewStatus] = useState<VoiceStatus>('RESOLVED');
  const [adminNotes, setAdminNotes] = useState<string>('');
  const [savingReply, setSavingReply] = useState<boolean>(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [statusFilter, sentimentFilter]);

  const loadData = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter !== 'ALL') params.append('status', statusFilter);
      if (sentimentFilter !== 'ALL') params.append('sentiment', sentimentFilter);
      if (searchQuery.trim()) params.append('search', searchQuery.trim());

      const [voicesRes, statsRes] = await Promise.all([
        fetch(`/api/customer-voice/all?${params.toString()}`),
        fetch('/api/customer-voice/stats'),
      ]);

      if (voicesRes.ok) {
        const data = await voicesRes.json();
        setVoices(data.voices || []);
      }
      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data.stats);
      }
    } catch (err) {
      console.error('Error al cargar datos de voz del alumno:', err);
    } finally {
      setLoading(false);
    }
  };

  const openReplyModal = (voice: StudentVoiceEntry) => {
    setSelectedVoice(voice);
    setReplyText(voice.mentorReply || '');
    setNewStatus(voice.status === 'RECEIVED' ? 'RESOLVED' : voice.status);
    setAdminNotes(voice.adminNotes || '');
    setActionNotice(null);
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVoice) return;
    if (replyText.trim().length < 2) {
      setActionNotice('Por favor escribe una respuesta clara para el alumno.');
      return;
    }

    try {
      setSavingReply(true);
      setActionNotice(null);

      const res = await fetch(`/api/customer-voice/${selectedVoice.id}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mentorReply: replyText.trim(),
          status: newStatus,
          adminNotes: adminNotes.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'No se pudo guardar la respuesta.');
      }

      // Actualizar en el estado local
      setVoices((prev) =>
        prev.map((v) => (v.id === selectedVoice.id ? { ...v, ...data.voice } : v)),
      );
      setSelectedVoice(null);
      loadData();
    } catch (err: any) {
      setActionNotice(err.message || 'Error al guardar la respuesta.');
    } finally {
      setSavingReply(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Banner Superior */}
      <div className="bg-canvas border border-line rounded-2xl p-6 sm:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-bold">
            <HeartHandshake className="w-3.5 h-3.5" />
            <span>Escucha Activa & Bienestar del Alumno</span>
          </div>
          <h2 className="text-2xl font-bold text-ink tracking-tight">
            Voz del Alumno & Atención Continua
          </h2>
          <p className="text-xs text-ink-muted max-w-2xl leading-relaxed">
            Canal de escucha directa para conocer las emociones, bloqueos y propuestas de tus alumnos.
            Responder oportunamente previene el abandono y refuerza la cercanía docente.
          </p>
        </div>

        <button
          onClick={loadData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-raised border border-line text-xs font-bold text-ink hover:text-cyan-400 hover:border-cyan-500/40 transition-colors shadow-sm cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Actualizar</span>
        </button>
      </div>

      {/* Tarjetas de Métricas & Alerta Temprana */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-2xl bg-raised border border-line space-y-1">
            <div className="text-xs font-bold uppercase tracking-wider text-ink-muted">
              Total de Mensajes
            </div>
            <div className="text-2xl font-black text-ink">{stats.total}</div>
            <div className="text-[11px] text-ink-muted flex items-center gap-1.5 pt-1">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>{stats.pending} pendientes de respuesta</span>
            </div>
          </div>

          <div className={`p-5 rounded-2xl border space-y-1 ${
            stats.urgentFrustrations > 0
              ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
              : 'bg-raised border border-line'
          }`}>
            <div className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
              <span>Alumnos Frustrados</span>
            </div>
            <div className="text-2xl font-black text-rose-400">{stats.urgentFrustrations}</div>
            <div className="text-[11px] text-ink-muted">
              {stats.urgentFrustrations > 0
                ? '¡Atención prioritaria recomendada!'
                : 'Sin bloqueos críticos reportados'}
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-raised border border-line space-y-1">
            <div className="text-xs font-bold uppercase tracking-wider text-ink-muted flex items-center gap-1.5">
              <Smile className="w-3.5 h-3.5 text-emerald-400" />
              <span>Motivados & Felices</span>
            </div>
            <div className="text-2xl font-black text-emerald-400">
              {stats.sentiments.MOTIVATED}
            </div>
            <div className="text-[11px] text-ink-muted">
              Energía positiva en la plataforma
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-raised border border-line space-y-1">
            <div className="text-xs font-bold uppercase tracking-wider text-ink-muted flex items-center gap-1.5">
              <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
              <span>Sugerencias / Ideas</span>
            </div>
            <div className="text-2xl font-black text-amber-400">
              {stats.sentiments.INSPIRED}
            </div>
            <div className="text-[11px] text-ink-muted">
              Propuestas de la comunidad
            </div>
          </div>
        </div>
      )}

      {/* Barra de Filtros */}
      <div className="bg-raised border border-line rounded-2xl p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          {/* Filtro por estado */}
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-ink-muted" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-canvas border border-line rounded-xl px-3 py-1.5 text-xs text-ink focus:outline-none focus:border-cyan-500"
            >
              <option value="ALL">Todos los Estados</option>
              <option value="RECEIVED">Recibidos (Sin responder)</option>
              <option value="IN_REVIEW">En análisis</option>
              <option value="ACTION_TAKEN">Acción en progreso</option>
              <option value="RESOLVED">Atendidos / Respondidos</option>
            </select>
          </div>

          {/* Filtro por Sentimiento */}
          <select
            value={sentimentFilter}
            onChange={(e) => setSentimentFilter(e.target.value)}
            className="bg-canvas border border-line rounded-xl px-3 py-1.5 text-xs text-ink focus:outline-none focus:border-cyan-500"
          >
            <option value="ALL">Cualquier Estado de Ánimo</option>
            <option value="FRUSTRATED">😤 Frustrado / Bloqueado</option>
            <option value="CONFUSED">🤔 Con dudas / Confundido</option>
            <option value="INSPIRED">💡 Inspirado / Sugerencia</option>
            <option value="MOTIVATED">😄 Motivado</option>
            <option value="NEUTRAL">💬 General</option>
          </select>
        </div>

        {/* Buscador */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            loadData();
          }}
          className="flex items-center gap-2"
        >
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por alumno o texto..."
              className="pl-8 pr-3 py-1.5 rounded-xl bg-canvas border border-line text-xs text-ink focus:outline-none focus:border-cyan-500 w-48 sm:w-60"
            />
          </div>
          <button
            type="submit"
            className="px-3 py-1.5 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 text-xs font-bold hover:bg-cyan-500/20 transition-colors"
          >
            Buscar
          </button>
        </form>
      </div>

      {/* Lista de Voces */}
      {loading ? (
        <div className="p-12 text-center text-xs text-ink-muted space-y-2">
          <RefreshCw className="w-6 h-6 mx-auto animate-spin text-cyan-400" />
          <p>Cargando aportes de estudiantes...</p>
        </div>
      ) : voices.length === 0 ? (
        <div className="p-12 rounded-2xl bg-raised border border-line text-center space-y-2">
          <HeartHandshake className="w-8 h-8 mx-auto text-ink-muted opacity-50" />
          <p className="text-sm font-bold text-ink">No hay aportes con los filtros seleccionados</p>
          <p className="text-xs text-ink-muted">
            Prueba ajustando los filtros de estado o sentimiento.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {voices.map((voice) => {
            const statusMeta = STATUS_LABELS[voice.status] || STATUS_LABELS.RECEIVED;
            const sentimentObj = SENTIMENT_OPTIONS.find((s) => s.key === voice.sentiment);
            const categoryMeta = CATEGORY_LABELS[voice.category];

            return (
              <div
                key={voice.id}
                className={`p-5 rounded-2xl bg-raised border transition-all space-y-3 ${
                  voice.sentiment === 'FRUSTRATED' && voice.status === 'RECEIVED'
                    ? 'border-rose-500/40 shadow-sm shadow-rose-500/10'
                    : 'border-line hover:border-line-hover'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="text-2xl">{sentimentObj?.emoji || '💬'}</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-ink">
                          {voice.userName}
                        </span>
                        {voice.isAnonymous && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                            Anónimo
                          </span>
                        )}
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusMeta.bgClass} ${statusMeta.textClass} ${statusMeta.borderClass}`}
                        >
                          {statusMeta.label}
                        </span>
                      </div>
                      <div className="text-[11px] text-ink-muted flex items-center gap-2 mt-0.5">
                        <span>{categoryMeta?.label || voice.category}</span>
                        <span>&bull;</span>
                        <span>
                          {new Date(voice.createdAt).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        {voice.courseTitle && (
                          <>
                            <span>&bull;</span>
                            <span className="flex items-center gap-1 text-cyan-400">
                              <BookOpen className="w-3 h-3" />
                              {voice.courseTitle}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => openReplyModal(voice)}
                    className="self-start sm:self-center px-4 py-2 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Send className="w-3 h-3" />
                    <span>{voice.mentorReply ? 'Editar Respuesta' : 'Responder al Alumno'}</span>
                  </button>
                </div>

                {/* Asunto y Mensaje */}
                <div className="p-3.5 rounded-xl bg-canvas border border-line space-y-1.5">
                  <h4 className="text-xs font-bold text-ink">{voice.subject}</h4>
                  <p className="text-xs text-ink-muted leading-relaxed whitespace-pre-wrap">
                    {voice.message}
                  </p>
                </div>

                {/* Nota de escucha activa inmediata si la hubo */}
                {voice.aiEmpathyReply && (
                  <div className="p-3 rounded-xl bg-cyan-950/20 border border-cyan-500/20 flex items-start gap-2 text-xs">
                    <Sparkles className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                    <p className="text-cyan-200/90 italic leading-relaxed">
                      Escucha activa automática: "{voice.aiEmpathyReply}"
                    </p>
                  </div>
                )}

                {/* Respuesta oficial ya registrada */}
                {voice.mentorReply && (
                  <div className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-500/30 flex items-start gap-2.5 text-xs">
                    <UserCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      <div className="font-bold text-emerald-400 text-[11px]">
                        Respondido por {voice.mentorRepliedBy || 'Equipo Docente'}:
                      </div>
                      <p className="text-slate-200 leading-relaxed font-medium">
                        {voice.mentorReply}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal para Responder al Alumno */}
      {selectedVoice && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto">
          <div className="relative w-full max-w-xl max-h-[90vh] my-auto bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-5 sm:p-6 text-slate-100 space-y-5 overflow-y-auto">
            <div className="flex items-start justify-between border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <HeartHandshake className="w-5 h-5 text-cyan-400" />
                  <span>Responder a {selectedVoice.userName}</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Asunto: "{selectedVoice.subject}"
                </p>
              </div>
              <button
                onClick={() => setSelectedVoice(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mensaje original del estudiante como contexto */}
            <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-1">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Mensaje del estudiante ({selectedVoice.sentiment}):
              </div>
              <p className="text-xs text-slate-300 italic leading-relaxed">
                "{selectedVoice.message}"
              </p>
            </div>

            {actionNotice && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                {actionNotice}
              </div>
            )}

            <form onSubmit={handleSendReply} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                  Tu respuesta directa al estudiante (Será visible en su panel)
                </label>
                <textarea
                  required
                  rows={4}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Escribe un mensaje empático, resolutivo y cercano. Explícale los pasos tomados o cómo resolver su inquietud..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                    Nuevo Estado
                  </label>
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value as VoiceStatus)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                  >
                    <option value="IN_REVIEW">En Análisis</option>
                    <option value="ACTION_TAKEN">Acción en Progreso</option>
                    <option value="RESOLVED">Atendido & Resuelto</option>
                    <option value="ARCHIVED">Archivado</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                    Notas Internas (Solo equipo docente)
                  </label>
                  <input
                    type="text"
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    placeholder="Ej: Revisado con soporte técnico"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedVoice(null)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingReply}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-cyan-500/25 transition-all disabled:opacity-50"
                >
                  {savingReply ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Guardando...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Enviar y Actualizar Estado</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
