/**
 * Centro de Escucha Activa & Voz del Estudiante (`CustomerVoiceModal.tsx`)
 * DocentOS / Academia Giantucchi
 *
 * Espacio seguro, cálido y empático para que los estudiantes compartan
 * su estado de ánimo, inquietudes, bloqueos o ideas de mejora,
 * reciban escucha activa inmediata y puedan dar seguimiento al estado
 * de sus aportes.
 */

import React, { useState, useEffect } from 'react';
import {
  HeartHandshake,
  X,
  Send,
  Sparkles,
  CheckCircle2,
  Clock,
  MessageSquare,
  Shield,
  HelpCircle,
  AlertCircle,
  UserCheck,
  ChevronRight,
  BookOpen,
  Layout,
  Users,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import {
  User,
  Course,
  VoiceSentiment,
  VoiceCategory,
  VoiceStatus,
  StudentVoiceEntry,
} from '../types';
import {
  SENTIMENT_OPTIONS,
  CATEGORY_LABELS,
  STATUS_LABELS,
} from '../plugins/CustomerVoicePlugin';

interface CustomerVoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  courses?: Course[];
  activeCourse?: Course | null;
}

export const CustomerVoiceModal: React.FC<CustomerVoiceModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  courses = [],
  activeCourse = null,
}) => {
  const [activeTab, setActiveTab] = useState<'create' | 'history'>('create');
  const [sentiment, setSentiment] = useState<VoiceSentiment>('NEUTRAL');
  const [category, setCategory] = useState<VoiceCategory>('COURSE_CONTENT');
  const [selectedCourseId, setSelectedCourseId] = useState<string>(activeCourse?.id || '');
  const [subject, setSubject] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const [isAnonymous, setIsAnonymous] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submitSuccess, setSubmitSuccess] = useState<StudentVoiceEntry | null>(null);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  // Historial de mensajes del usuario
  const [myVoices, setMyVoices] = useState<StudentVoiceEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);
  const [expandedVoiceId, setExpandedVoiceId] = useState<string | null>(null);

  useEffect(() => {
    if (activeCourse?.id) {
      setSelectedCourseId(activeCourse.id);
    }
  }, [activeCourse]);

  useEffect(() => {
    if (isOpen && currentUser) {
      loadMyVoices();
    }
  }, [isOpen, currentUser]);

  const loadMyVoices = async () => {
    if (!currentUser) return;
    try {
      setLoadingHistory(true);
      const res = await fetch('/api/customer-voice/my');
      if (res.ok) {
        const data = await res.json();
        setMyVoices(data.voices || []);
      }
    } catch (err) {
      console.warn('Error al cargar historial de escucha:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      setErrorNotice('Debes iniciar sesión para compartir tu experiencia con nosotros.');
      return;
    }
    if (subject.trim().length < 3) {
      setErrorNotice('Por favor escribe un asunto breve de al menos 3 caracteres.');
      return;
    }
    if (message.trim().length < 5) {
      setErrorNotice('Por favor detalla tu mensaje con al menos 5 caracteres.');
      return;
    }

    try {
      setSubmitting(true);
      setErrorNotice(null);

      const res = await fetch('/api/customer-voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sentiment,
          category,
          subject: subject.trim(),
          message: message.trim(),
          courseId: selectedCourseId || null,
          isAnonymous,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'No se pudo enviar tu mensaje.');
      }

      setSubmitSuccess(data.voice);
      // Resetear campos
      setSubject('');
      setMessage('');
      // Refrescar historial en segundo plano
      loadMyVoices();
    } catch (err: any) {
      setErrorNotice(err.message || 'Error inesperado al enviar el mensaje.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto">
      <div className="relative w-full max-w-2xl max-h-[90vh] my-auto flex flex-col bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl shadow-cyan-950/40 overflow-hidden text-slate-100">
        {/* Glow de fondo */}
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 rounded-full bg-blue-600/10 blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="relative z-10 flex items-center justify-between p-4 sm:p-5 border-b border-slate-800 bg-slate-900/95 backdrop-blur-sm shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 sm:w-11 sm:h-11 shrink-0 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 text-slate-950 font-bold">
              <HeartHandshake className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  Buzón de Escucha Activa
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  Tu Voz Cuenta
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5 truncate sm:text-clip">
                Queremos saber cómo te sientes y qué podemos mejorar. Aquí no hay malas preguntas ni silencios.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800/80 transition-colors shrink-0 ml-2"
            title="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="relative z-10 flex border-b border-slate-800 bg-slate-950/40 px-5 pt-2 gap-2 shrink-0">
          <button
            onClick={() => {
              setActiveTab('create');
              setSubmitSuccess(null);
            }}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-t-xl transition-all border-b-2 ${
              activeTab === 'create'
                ? 'border-cyan-400 text-cyan-400 bg-slate-900/80'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Expresar cómo me siento</span>
          </button>
          <button
            onClick={() => {
              setActiveTab('history');
              loadMyVoices();
            }}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-t-xl transition-all border-b-2 ${
              activeTab === 'history'
                ? 'border-cyan-400 text-cyan-400 bg-slate-900/80'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Mis aportes y respuestas</span>
            {myVoices.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-cyan-500/20 text-cyan-300 font-bold">
                {myVoices.length}
              </span>
            )}
          </button>
        </div>

        {/* Modal Body */}
        <div className="relative z-10 flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {errorNotice && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorNotice}</span>
            </div>
          )}

          {activeTab === 'create' && (
            <>
              {submitSuccess ? (
                /* Pantalla de confirmación y escucha empática inmediata */
                <div className="space-y-5 py-2 animate-in fade-in zoom-in-95 duration-200">
                  <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-b from-slate-800/80 to-slate-900/90 border border-cyan-500/30 text-center space-y-3.5">
                    <div className="w-12 h-12 mx-auto rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-base sm:text-lg font-bold text-white">¡Te hemos escuchado!</h4>
                      <p className="text-xs text-slate-400 mt-0.5 max-w-md mx-auto">
                        Tu aporte ha sido registrado en nuestro sistema de atención prioritaria.
                      </p>
                    </div>

                    {submitSuccess.aiEmpathyReply && (
                      <div className="p-3.5 rounded-2xl bg-cyan-950/30 border border-cyan-500/30 text-left space-y-1.5">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-cyan-400">
                          <Sparkles className="w-4 h-4" />
                          <span>Mensaje de Escucha Activa:</span>
                        </div>
                        <p className="text-xs text-slate-200 leading-relaxed italic">
                          "{submitSuccess.aiEmpathyReply}"
                        </p>
                      </div>
                    )}

                    <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2.5">
                      <button
                        onClick={() => {
                          setSubmitSuccess(null);
                        }}
                        className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white transition-colors cursor-pointer"
                      >
                        Enviar otro mensaje
                      </button>
                      <button
                        onClick={() => {
                          setActiveTab('history');
                          loadMyVoices();
                        }}
                        className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold transition-colors shadow-lg shadow-cyan-500/20 cursor-pointer"
                      >
                        Ver estado de mis aportes
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                /* Formulario de envío */
                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Selector de Estado de Ánimo / Sentimiento */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                      ¿Cómo te sientes en este momento?
                    </label>
                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 sm:gap-2">
                      {SENTIMENT_OPTIONS.map((opt) => {
                        const isSelected = sentiment === opt.key;
                        return (
                          <button
                            type="button"
                            key={opt.key}
                            onClick={() => setSentiment(opt.key)}
                            className={`p-2 sm:p-2.5 rounded-2xl border text-left transition-all flex flex-col items-center justify-center text-center cursor-pointer ${
                              isSelected
                                ? `bg-cyan-500/15 border-cyan-400 shadow-md shadow-cyan-500/10`
                                : `bg-slate-950/40 border-slate-800 hover:border-slate-700 hover:bg-slate-800/40`
                            }`}
                          >
                            <span className="text-xl sm:text-2xl mb-0.5">{opt.emoji}</span>
                            <span className={`text-[10px] sm:text-[11px] font-bold leading-tight ${isSelected ? 'text-cyan-300' : 'text-slate-300'}`}>
                              {opt.label.split('/')[0]}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Selector de Categoría */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                      ¿De qué trata tu comentario o inquietud?
                    </label>
                    <div className="flex flex-wrap gap-1.5 sm:gap-2">
                      {(Object.keys(CATEGORY_LABELS) as VoiceCategory[]).map((catKey) => {
                        const isSelected = category === catKey;
                        const meta = CATEGORY_LABELS[catKey];
                        return (
                          <button
                            type="button"
                            key={catKey}
                            onClick={() => setCategory(catKey)}
                            className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-medium border transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-cyan-500 text-slate-950 border-cyan-400 font-bold shadow-sm shadow-cyan-500/20'
                                : 'bg-slate-950/50 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-200'
                            }`}
                          >
                            {meta.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Curso relacionado (opcional si hay catálogo) */}
                  {courses.length > 0 && (
                    <div className="space-y-1">
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                        Curso relacionado (Opcional)
                      </label>
                      <select
                        value={selectedCourseId}
                        onChange={(e) => setSelectedCourseId(e.target.value)}
                        className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 transition-colors"
                      >
                        <option value="">(Comentario general / No aplica a un curso específico)</option>
                        {courses.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.title}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Asunto y Mensaje */}
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                        Título o Asunto breve
                      </label>
                      <input
                        type="text"
                        required
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        placeholder="Ej: Tengo una duda con el ejercicio 3 / Me encanta el formato del curso"
                        maxLength={150}
                        className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 transition-colors placeholder:text-slate-600"
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                          Tu mensaje detallado
                        </label>
                        <span className="text-[10px] text-slate-500">{message.length}/3000</span>
                      </div>
                      <textarea
                        required
                        rows={3}
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="Exprésate con total libertad y confianza. Explícanos qué te ocurre, qué necesitas o qué idea tienes. Tu bienestar académico es nuestra prioridad..."
                        maxLength={3000}
                        className="w-full bg-slate-950/70 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 transition-colors placeholder:text-slate-600 leading-relaxed resize-y"
                      />
                    </div>
                  </div>

                  {/* Toggle Anónimo */}
                  <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-950/50 border border-slate-800/80">
                    <div className="flex items-center gap-2.5">
                      <Shield className="w-4 h-4 text-cyan-400 shrink-0" />
                      <div>
                        <div className="text-xs font-bold text-slate-200">
                          Enviar de forma anónima
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Tu nombre y correo no se mostrarán al equipo docente
                        </div>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isAnonymous}
                        onChange={(e) => setIsAnonymous(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-500" />
                    </label>
                  </div>

                  {/* Botón de envío */}
                  <div className="pt-1 flex justify-end">
                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/25 transition-all disabled:opacity-50 cursor-pointer"
                    >
                      {submitting ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Enviando y generando escucha activa...</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-3.5 h-3.5 text-slate-950" />
                          <span>Enviar mi mensaje</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </>
          )}

          {activeTab === 'history' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400">
                  Historial de tus mensajes y respuestas del equipo
                </span>
                <button
                  onClick={loadMyVoices}
                  disabled={loadingHistory}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                  title="Refrescar"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingHistory ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {loadingHistory ? (
                <div className="p-8 text-center text-xs text-slate-500 space-y-2">
                  <RefreshCw className="w-5 h-5 mx-auto animate-spin text-cyan-400" />
                  <p>Cargando tus aportes...</p>
                </div>
              ) : myVoices.length === 0 ? (
                <div className="p-8 text-center rounded-2xl bg-slate-950/40 border border-slate-800 space-y-3">
                  <div className="w-10 h-10 mx-auto rounded-full bg-slate-800 flex items-center justify-center text-slate-400">
                    <MessageSquare className="w-5 h-5" />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-slate-300">Aún no has enviado mensajes</h5>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Cada vez que compartas una inquietud o sugerencia, verás aquí su estado y las respuestas de los mentores.
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveTab('create')}
                    className="px-4 py-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-xs font-bold hover:bg-cyan-500/20 transition-colors"
                  >
                    Expresar cómo me siento ahora
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {myVoices.map((voice) => {
                    const isExpanded = expandedVoiceId === voice.id;
                    const statusMeta = STATUS_LABELS[voice.status] || STATUS_LABELS.RECEIVED;
                    const sentimentObj = SENTIMENT_OPTIONS.find((s) => s.key === voice.sentiment);
                    const categoryMeta = CATEGORY_LABELS[voice.category];

                    return (
                      <div
                        key={voice.id}
                        className="rounded-2xl border border-slate-800 bg-slate-950/60 overflow-hidden transition-all hover:border-slate-700"
                      >
                        {/* Cabecera del item */}
                        <div
                          onClick={() => setExpandedVoiceId(isExpanded ? null : voice.id)}
                          className="p-4 cursor-pointer flex items-start justify-between gap-3 hover:bg-slate-900/40 transition-colors"
                        >
                          <div className="space-y-1.5 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-base">{sentimentObj?.emoji || '💬'}</span>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusMeta.bgClass} ${statusMeta.textClass} ${statusMeta.borderClass}`}
                              >
                                {statusMeta.label}
                              </span>
                              <span className="text-[10px] text-slate-500">
                                {new Date(voice.createdAt).toLocaleDateString(undefined, {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                })}
                              </span>
                              {voice.courseTitle && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 flex items-center gap-1">
                                  <BookOpen className="w-2.5 h-2.5" />
                                  {voice.courseTitle}
                                </span>
                              )}
                            </div>
                            <h5 className="text-xs font-bold text-white tracking-tight">
                              {voice.subject}
                            </h5>
                          </div>
                          <ChevronRight
                            className={`w-4 h-4 text-slate-500 transition-transform ${
                              isExpanded ? 'rotate-90' : ''
                            }`}
                          />
                        </div>

                        {/* Detalle expandido */}
                        {isExpanded && (
                          <div className="p-4 pt-0 border-t border-slate-800/80 space-y-3 text-xs">
                            {/* Mensaje original */}
                            <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800/80 space-y-1">
                              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                Tu mensaje:
                              </div>
                              <p className="text-slate-300 leading-relaxed whitespace-pre-wrap">
                                {voice.message}
                              </p>
                            </div>

                            {/* Escucha activa con IA */}
                            {voice.aiEmpathyReply && (
                              <div className="p-3 rounded-xl bg-cyan-950/20 border border-cyan-500/20 space-y-1">
                                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-cyan-400">
                                  <Sparkles className="w-3 h-3" />
                                  <span>Respuesta inmediata de Escucha Activa:</span>
                                </div>
                                <p className="text-slate-300 italic leading-relaxed">
                                  "{voice.aiEmpathyReply}"
                                </p>
                              </div>
                            )}

                            {/* Respuesta del Mentor / Equipo */}
                            {voice.mentorReply ? (
                              <div className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-500/30 space-y-1.5">
                                <div className="flex items-center justify-between text-[10px] font-bold text-emerald-400">
                                  <div className="flex items-center gap-1.5">
                                    <UserCheck className="w-3.5 h-3.5" />
                                    <span>
                                      Respuesta de {voice.mentorRepliedBy || 'Equipo Docente'}:
                                    </span>
                                  </div>
                                  {voice.mentorRepliedAt && (
                                    <span className="text-slate-500 font-normal">
                                      {new Date(voice.mentorRepliedAt).toLocaleDateString()}
                                    </span>
                                  )}
                                </div>
                                <p className="text-slate-200 leading-relaxed whitespace-pre-wrap font-medium">
                                  {voice.mentorReply}
                                </p>
                              </div>
                            ) : (
                              <div className="p-3 rounded-xl bg-slate-900/40 border border-slate-800 text-[11px] text-slate-400 flex items-center gap-2">
                                <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                <span>
                                  Tu aporte está en cola de revisión docente. Recibirás respuesta directa aquí mismo.
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="p-4 px-6 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-[10px] text-slate-500">
          <span>Academia Giantucchi & DocentOS &bull; Escucha Activa Empática</span>
          <span>Privacidad protegida &bull; Acompañamiento continuo</span>
        </div>
      </div>
    </div>
  );
};
