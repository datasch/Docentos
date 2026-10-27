/**
 * Buzón de Escucha Activa.
 *
 * Un lugar para decir qué sentimos y qué se puede mejorar, y para comprobar que
 * alguien lo leyó: la segunda pestaña devuelve la respuesta del equipo. Lo que
 * la persona elige con caritas y con la escala 0-10 viaja como número (ver
 * `src/lib/listening.ts`), así quien analiza los datos no interpreta emojis.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  HeartHandshake,
  MessageSquareText,
  Send,
  ShieldCheck,
  X,
} from 'lucide-react';
import { api } from '../lib/api';
import { useBodyScrollLock } from '../lib/useBodyScrollLock';
import {
  classifyNps,
  LISTENING_LIMITS,
  LISTENING_STATUS_LABELS,
  LISTENING_TOPICS,
  LISTENING_TOPIC_LABELS,
  LISTENING_TYPES,
  LISTENING_TYPE_LABELS,
  MOODS,
  type ListeningTopic,
  type ListeningType,
} from '../lib/listening';
import type { OwnListeningEntry } from '../lib/listeningTypes';
import type { Course } from '../types';

interface ListeningBoxModalProps {
  isOpen: boolean;
  onClose: () => void;
  courses?: Course[];
  /** El modal avisa cuando la persona lee sus respuestas, para apagar el aviso de la barra. */
  onUnreadChange?: (unread: number) => void;
}

const TYPE_ICON: Record<ListeningType, string> = {
  SUGGESTION: '💡',
  COMPLAINT: '😤',
  PRAISE: '👏',
  QUESTION: '🤔',
};

const NPS_TONE = {
  DETRACTOR: 'border-danger/40 text-danger-light hover:bg-danger/15',
  PASSIVE: 'border-warning-light/40 text-warning-light hover:bg-warning-light/15',
  PROMOTER: 'border-success-light/40 text-success-light hover:bg-success-light/15',
} as const;

const NPS_SELECTED = {
  DETRACTOR: 'border-danger-light bg-danger text-ink',
  PASSIVE: 'border-warning-light bg-warning-light text-canvas',
  PROMOTER: 'border-success-light bg-success-light text-canvas',
} as const;

const STATUS_TONE: Record<string, string> = {
  NEW: 'border-line-strong/40 bg-elevated/10 text-ink-soft',
  IN_REVIEW: 'border-warning-light/40 bg-warning-light/10 text-warning-light',
  ANSWERED: 'border-success-light/40 bg-success-light/10 text-success-light',
  CLOSED: 'border-line-strong/40 bg-elevated/10 text-ink-muted',
};

const fieldClass =
  'w-full rounded-xl border border-line bg-canvas/50 px-4 py-2.5 text-sm text-ink outline-none placeholder:text-ink-faint focus:border-brand-cyan';
const labelClass = 'mb-2 block text-[11px] font-bold uppercase tracking-wider text-ink-muted';

export const ListeningBoxModal: React.FC<ListeningBoxModalProps> = ({
  isOpen,
  onClose,
  courses = [],
  onUnreadChange,
}) => {
  const [tab, setTab] = useState<'new' | 'mine'>('new');
  const [mood, setMood] = useState<number | null>(null);
  const [type, setType] = useState<ListeningType>('SUGGESTION');
  const [topic, setTopic] = useState<ListeningTopic>('CONTENT');
  const [courseId, setCourseId] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [nps, setNps] = useState<number | null>(null);
  const [anonymous, setAnonymous] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentNotice, setSentNotice] = useState<string | null>(null);

  const [entries, setEntries] = useState<OwnListeningEntry[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [unread, setUnread] = useState(0);

  const loadMine = useCallback(async () => {
    setLoadingEntries(true);
    try {
      const data = await api.getMyListening();
      setEntries(data.entries);
      setUnread(data.unreadReplies);
      onUnreadChange?.(data.unreadReplies);
      return data.unreadReplies;
    } catch {
      return 0;
    } finally {
      setLoadingEntries(false);
    }
  }, [onUnreadChange]);

  useBodyScrollLock(isOpen);

  useEffect(() => {
    if (!isOpen) return;
    setTab('new');
    setError(null);
    setSentNotice(null);
    void loadMine().then((pendingReplies) => {
      // Una respuesta sin leer es lo más importante que puede haber aquí.
      if (pendingReplies > 0) setTab('mine');
    });
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
    // loadMine cambia con onUnreadChange; reabrir es lo único que debe recargar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Abrir «Mis aportes» es leer las respuestas: se marcan, pero la lista de esta
  // sesión conserva el resaltado para que la persona vea cuáles eran nuevas.
  useEffect(() => {
    if (!isOpen || tab !== 'mine' || unread === 0) return;
    void api
      .markListeningRepliesSeen()
      .then(() => {
        setUnread(0);
        onUnreadChange?.(0);
      })
      .catch(() => undefined);

  }, [isOpen, tab, unread, onUnreadChange]);

  if (!isOpen) return null;

  const resetForm = () => {
    setMood(null);
    setType('SUGGESTION');
    setTopic('CONTENT');
    setCourseId('');
    setSubject('');
    setMessage('');
    setNps(null);
    setAnonymous(false);
    setError(null);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (mood === null) {
      setError('Elige la carita que mejor dice cómo te sientes.');
      return;
    }
    setSending(true);
    try {
      const response = await api.submitListening({
        type,
        topic,
        mood,
        npsScore: nps,
        courseId: courseId || null,
        subject,
        message,
        anonymous,
      });
      setSentNotice(response.message);
      resetForm();
      await loadMine();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se pudo enviar tu mensaje.');
    } finally {
      setSending(false);
    }
  };

  const newReplies = entries.filter((entry) => entry.unreadReply).length;

  return createPortal(
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-canvas/85 p-3 backdrop-blur-md sm:p-4 overscroll-contain"
      onMouseDown={onClose}
      onWheel={(e) => e.stopPropagation()}
    >
      <div
        className="relative flex max-h-[94vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-line bg-card shadow-2xl overscroll-contain"
        onMouseDown={(event) => event.stopPropagation()}
        onWheel={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="listening-title"
      >
        <header className="flex items-start gap-4 border-b border-line px-5 py-5 sm:px-7">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-cyan to-brand-blue text-ink">
            <HeartHandshake aria-hidden className="h-6 w-6" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="listening-title" className="flex flex-wrap items-center gap-2 text-lg font-bold text-ink">
              Buzón de Escucha Activa
              <span className="rounded-full border border-brand-cyan/40 bg-brand-cyan/10 px-2 py-0.5 text-micro font-bold text-brand-cyan">
                Tu voz cuenta
              </span>
            </h2>
            <p className="mt-1 text-xs text-ink-muted">
              Queremos saber cómo te sientes y qué podemos mejorar. Aquí no hay malas preguntas ni silencios: una persona
              del equipo lee cada mensaje y te responde.
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-2 text-ink-muted hover:text-ink" aria-label="Cerrar">
            <X className="h-5 w-5" />
          </button>
        </header>

        <div role="tablist" className="flex gap-1 border-b border-line px-4 pt-2 sm:px-6">
          {[
            { id: 'new' as const, label: 'Expresar cómo me siento', icon: <MessageSquareText aria-hidden className="h-4 w-4" /> },
            { id: 'mine' as const, label: 'Mis aportes y respuestas', icon: <Clock aria-hidden className="h-4 w-4" /> },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              onClick={() => setTab(item.id)}
              className={`-mb-px flex items-center gap-2 border-b-2 px-3 py-3 text-xs font-bold transition-colors ${
                tab === item.id ? 'border-brand-cyan text-brand-cyan' : 'border-transparent text-ink-muted hover:text-ink'
              }`}
            >
              {item.icon}
              {item.label}
              {item.id === 'mine' && entries.length > 0 && (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-micro ${
                    newReplies > 0 ? 'bg-brand-cyan text-canvas' : 'bg-ink/10 text-ink-soft'
                  }`}
                >
                  {entries.length}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-7">
          {tab === 'new' && sentNotice && (
            <div className="mb-5 flex items-start gap-3 rounded-2xl border border-success-light/30 bg-success-light/10 p-4 text-sm text-success-light">
              <CheckCircle2 aria-hidden className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="font-bold">¡Gracias por escribirnos!</p>
                <p className="mt-0.5 text-xs text-success-light/80">{sentNotice}</p>
                <button
                  type="button"
                  onClick={() => setTab('mine')}
                  className="mt-2 text-xs font-bold underline underline-offset-2"
                >
                  Ver mis aportes
                </button>
              </div>
            </div>
          )}

          {tab === 'new' && (
            <form onSubmit={handleSubmit} className="space-y-6">
              <fieldset>
                <legend className={labelClass}>¿Cómo te sientes en este momento?</legend>
                <div className="grid grid-cols-5 gap-2" role="radiogroup" aria-label="Cómo te sientes">
                  {MOODS.map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      role="radio"
                      aria-checked={mood === item.value}
                      onClick={() => setMood(item.value)}
                      className={`flex flex-col items-center gap-1.5 rounded-2xl border px-1 py-3 transition-all ${
                        mood === item.value
                          ? 'scale-[1.03] border-brand-cyan bg-brand-cyan/15 shadow-[0_0_0_1px_rgba(6,182,212,0.4)]'
                          : 'border-line bg-canvas/30 hover:border-line-strong'
                      }`}
                    >
                      <span aria-hidden className="text-3xl leading-none">
                        {item.emoji}
                      </span>
                      <span className="text-micro font-bold text-ink-soft sm:text-[11px]">{item.label}</span>
                    </button>
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className={labelClass}>¿Qué quieres contarnos?</legend>
                <div className="flex flex-wrap gap-2">
                  {LISTENING_TYPES.map((value) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={type === value}
                      onClick={() => setType(value)}
                      className={`flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                        type === value
                          ? 'border-brand-cyan bg-brand-cyan text-canvas'
                          : 'border-line bg-canvas/30 text-ink-soft hover:border-line-strong'
                      }`}
                    >
                      <span aria-hidden>{TYPE_ICON[value]}</span>
                      {LISTENING_TYPE_LABELS[value]}
                    </button>
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className={labelClass}>¿De qué trata?</legend>
                <div className="flex flex-wrap gap-2">
                  {LISTENING_TOPICS.map((value) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={topic === value}
                      onClick={() => setTopic(value)}
                      className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                        topic === value
                          ? 'border-brand-cyan bg-brand-cyan/15 text-brand-cyan'
                          : 'border-line bg-canvas/30 text-ink-soft hover:border-line-strong'
                      }`}
                    >
                      {LISTENING_TOPIC_LABELS[value]}
                    </button>
                  ))}
                </div>
              </fieldset>

              {courses.length > 0 && (
                <label className="block">
                  <span className={labelClass}>Curso relacionado (opcional)</span>
                  <select value={courseId} onChange={(event) => setCourseId(event.target.value)} className={fieldClass}>
                    <option value="">Ninguno en particular</option>
                    {courses.map((course) => (
                      <option key={course.id} value={course.id}>
                        {course.title}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <label className="block">
                <span className={labelClass}>Título o asunto breve</span>
                <input
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                  minLength={LISTENING_LIMITS.subjectMin}
                  maxLength={LISTENING_LIMITS.subjectMax}
                  required
                  placeholder="Ej: Tengo una duda con el ejercicio 3 / Me encanta el formato del curso"
                  className={fieldClass}
                />
              </label>

              <label className="block">
                <span className={`${labelClass} flex justify-between`}>
                  <span>Tu mensaje detallado</span>
                  <span className="font-medium normal-case tracking-normal">
                    {message.length}/{LISTENING_LIMITS.messageMax}
                  </span>
                </span>
                <textarea
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  minLength={LISTENING_LIMITS.messageMin}
                  maxLength={LISTENING_LIMITS.messageMax}
                  required
                  rows={5}
                  placeholder="Exprésate con total libertad y confianza. Cuéntanos qué te ocurre, qué necesitas o qué idea tienes."
                  className={`${fieldClass} resize-y`}
                />
              </label>

              <fieldset className="rounded-2xl border border-line bg-canvas/30 p-4">
                <legend className="px-1 text-[11px] font-bold uppercase tracking-wider text-ink-muted">
                  Una última pregunta (opcional)
                </legend>
                <p className="mb-3 text-sm font-semibold text-ink">
                  Del 0 al 10, ¿qué tan probable es que recomiendes esta plataforma a un colega?
                </p>
                <div className="grid grid-cols-11 gap-1" role="radiogroup" aria-label="Probabilidad de recomendarnos, de 0 a 10">
                  {Array.from({ length: 11 }, (_, score) => {
                    const group = classifyNps(score);
                    const selected = nps === score;
                    return (
                      <button
                        key={score}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => setNps(selected ? null : score)}
                        className={`rounded-lg border py-2 text-xs font-bold tabular-nums transition-colors ${
                          selected ? NPS_SELECTED[group] : `bg-canvas/30 ${NPS_TONE[group]}`
                        }`}
                      >
                        {score}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-1.5 flex justify-between text-micro text-ink-faint">
                  <span>Nada probable</span>
                  <span>Muy probable</span>
                </div>
              </fieldset>

              <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-line bg-canvas/30 p-4">
                <span className="flex items-start gap-3">
                  <ShieldCheck aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-brand-cyan" />
                  <span>
                    <span className="block text-sm font-bold text-ink">Enviar de forma anónima</span>
                    <span className="block text-[11px] text-ink-muted">
                      Tu nombre y correo no se mostrarán al equipo. Tú sí verás tu mensaje y la respuesta.
                    </span>
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={anonymous}
                  onChange={(event) => setAnonymous(event.target.checked)}
                  className="h-5 w-5 shrink-0 accent-brand-cyan"
                />
              </label>

              {error && (
                <div
                  role="alert"
                  className="flex items-center gap-2 rounded-xl border border-danger/30 bg-danger/10 p-3 text-xs text-danger-light"
                >
                  <AlertCircle aria-hidden className="h-4 w-4 shrink-0" /> {error}
                </div>
              )}

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={sending}
                  className="btn-brand-primary flex items-center gap-2 px-6 py-3 text-sm font-bold disabled:opacity-60"
                >
                  <Send aria-hidden className="h-4 w-4" />
                  {sending ? 'Enviando...' : 'Enviar mi mensaje'}
                </button>
              </div>
            </form>
          )}

          {tab === 'mine' && (
            <div className="space-y-3">
              {loadingEntries && entries.length === 0 && <p className="text-sm text-ink-muted">Cargando tus mensajes...</p>}

              {!loadingEntries && entries.length === 0 && (
                <div className="rounded-2xl border border-dashed border-line p-8 text-center">
                  <p className="text-sm font-bold text-ink">Todavía no nos has escrito</p>
                  <p className="mt-1 text-xs text-ink-muted">
                    Cuando lo hagas, aquí verás en qué punto está tu mensaje y la respuesta del equipo.
                  </p>
                  <button type="button" onClick={() => setTab('new')} className="btn-brand-primary mt-4 px-4 py-2 text-xs font-bold">
                    Escribir ahora
                  </button>
                </div>
              )}

              {entries.map((entry) => {
                const face = MOODS.find((item) => item.value === entry.mood);
                return (
                  <article
                    key={entry.id}
                    className={`rounded-2xl border p-4 ${
                      entry.unreadReply ? 'border-brand-cyan/60 bg-brand-cyan/5' : 'border-line bg-canvas/30'
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-2 text-[11px]">
                      <span aria-label={face?.label} title={face?.label} className="text-xl leading-none">
                        {face?.emoji}
                      </span>
                      <span className="rounded-full bg-ink/10 px-2 py-0.5 font-bold text-ink-soft">
                        {LISTENING_TYPE_LABELS[entry.type]}
                      </span>
                      <span className="text-ink-muted">{LISTENING_TOPIC_LABELS[entry.topic]}</span>
                      <span
                        className={`ml-auto rounded-full border px-2 py-0.5 font-bold ${STATUS_TONE[entry.status]}`}
                      >
                        {LISTENING_STATUS_LABELS[entry.status]}
                      </span>
                    </div>
                    <h3 className="mt-2 text-sm font-bold text-ink">{entry.subject}</h3>
                    <p className="mt-1 whitespace-pre-wrap text-xs text-ink-soft">{entry.message}</p>
                    <p className="mt-2 text-micro text-ink-faint">
                      {new Date(entry.createdAt).toLocaleString('es')}
                      {entry.anonymous && ' · Anónimo para el equipo'}
                    </p>

                    {entry.reply && (
                      <div className="mt-3 rounded-xl border border-brand-cyan/30 bg-brand-cyan/10 p-3">
                        <p className="flex items-center gap-1.5 text-[11px] font-bold text-brand-cyan">
                          <HeartHandshake aria-hidden className="h-3.5 w-3.5" />
                          Respuesta del equipo{entry.repliedBy ? ` · ${entry.repliedBy}` : ''}
                          {entry.unreadReply && (
                            <span className="rounded-full bg-brand-cyan px-1.5 py-0.5 text-micro text-canvas">Nueva</span>
                          )}
                        </p>
                        <p className="mt-1 whitespace-pre-wrap text-xs text-ink">{entry.reply}</p>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </div>

        <footer className="flex flex-wrap justify-between gap-2 border-t border-line px-5 py-3 text-[11px] text-ink-faint sm:px-7">
          <span>Escucha activa y empática</span>
          <span>Privacidad protegida · Acompañamiento continuo</span>
        </footer>
      </div>
    </div>,
    document.body,
  );
};
