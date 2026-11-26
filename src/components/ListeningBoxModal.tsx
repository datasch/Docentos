/**
 * Buzón de Escucha Activa.
 *
 * Un lugar para decir qué sentimos y qué se puede mejorar, y para comprobar que
 * alguien lo leyó: la segunda pestaña devuelve la respuesta del equipo. Lo que
 * la persona elige con caritas y con la escala 0-10 viaja como número (ver
 * `src/lib/listening.ts`), así quien analiza los datos no interpreta emojis.
 *
 * Diseño del formulario: cuatro pasos numerados que se desplazan, y una barra
 * de envío fija abajo que siempre está a la vista. La barra dice qué falta
 * (Ánimo, Título, Mensaje) y cada pieza lleva al campo pendiente, así quien
 * llega por primera vez entiende que debe recorrer los pasos antes de enviar.
 */

import { dateLocale } from '../i18n/format';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronsDown,
  Circle,
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
  LISTENING_TOPICS,
  LISTENING_TYPES,
  type ListeningTopic,
  type ListeningType,
} from '../lib/listening';
import { NPS_SELECTED, NPS_TONE } from '../lib/courseNps';
import { LISTENING_STATUS_LABELS, LISTENING_TOPIC_LABELS, LISTENING_TYPE_LABELS, MOODS } from '../lib/listeningLabels';
import type { OwnListeningEntry } from '../lib/listeningTypes';
import type { Course } from '../types';
import { useTranslation, Trans } from 'react-i18next'

interface ListeningBoxModalProps {
  isOpen: boolean;
  onClose: () => void;
  courses?: Course[];
  /** El modal avisa cuando la persona lee sus respuestas, para apagar el aviso de la barra. */
  onUnreadChange?: (unread: number) => void;
}

type RequiredField = 'mood' | 'subject' | 'message';

const TYPE_ICON: Record<ListeningType, string> = {
  SUGGESTION: '💡',
  COMPLAINT: '😤',
  PRAISE: '👏',
  QUESTION: '🤔',
};

/** Cada carita se ilumina con su propio color: de rojo (muy mal) a verde (me encanta). */
const MOOD_SELECTED: Record<number, string> = {
  1: 'border-danger-light bg-danger/15',
  2: 'border-warning-light bg-warning-light/15',
  3: 'border-ink-soft bg-ink/10',
  4: 'border-brand-cyan bg-brand-cyan/15',
  5: 'border-success-light bg-success-light/15',
};

const STATUS_TONE: Record<string, string> = {
  NEW: 'border-line-strong/40 bg-elevated/10 text-ink-soft',
  IN_REVIEW: 'border-warning-light/40 bg-warning-light/10 text-warning-light',
  ANSWERED: 'border-success-light/40 bg-success-light/10 text-success-light',
  CLOSED: 'border-line-strong/40 bg-elevated/10 text-ink-muted',
};

const DISPLAY_FONT = { fontFamily: 'var(--academy-font-display, inherit)' } as const;

// 16px en móvil evita que iOS haga zoom al tocar el campo.
const fieldClass =
  'w-full rounded-xl border-2 border-line bg-canvas/50 px-4 py-3 text-base text-ink outline-none placeholder:text-ink-faint focus:border-brand-cyan sm:text-sm';
const fieldErrorClass = 'border-danger-light/70';
const labelClass = 'mb-1.5 block text-sm font-semibold text-ink';

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

/** Tarjeta numerada de un paso del formulario. */
const Step: React.FC<{
  number: number;
  title: string;
  hint?: string;
  done?: boolean;
  optional?: boolean;
  children: React.ReactNode;
}> = ({ number, title, hint, done = false, optional = false, children }) => {
  const { t } = useTranslation()
  return (
  <section className="rounded-2xl border border-line bg-canvas/30 p-4 sm:p-5">
    <div className="mb-4 flex items-start gap-3">
      <span
        aria-hidden
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold transition-colors ${
          done ? 'bg-success-light text-canvas' : 'bg-brand-cyan/15 text-brand-cyan'
        }`}
      >
        {done ? <Check className="h-4 w-4" strokeWidth={3} /> : number}
      </span>
      <div className="min-w-0">
        <h3 className="flex flex-wrap items-center gap-x-2 gap-y-1 text-base font-semibold text-ink" style={DISPLAY_FONT}>
          <span className="sr-only">{t('pasoNumber', 'Paso {{number}}:', { number })} </span>
          {title}
          {optional && (
            <span className="rounded-full border border-line px-2 py-0.5 text-xs font-medium text-ink-muted">{t('opcional', 'Opcional')}</span>
          )}
        </h3>
        {hint && <p className="mt-0.5 text-sm text-ink-muted">{hint}</p>}
      </div>
    </div>
    {children}
  </section>
)
};

export const ListeningBoxModal: React.FC<ListeningBoxModalProps> = ({
  isOpen,
  onClose,
  courses = [],
  onUnreadChange,
}) => {
  const { t } = useTranslation()
  const [tab, setTab] = useState<'new' | 'mine'>('new');
  const [mood, setMood] = useState<number | null>(null);
  const [type, setType] = useState<ListeningType>('SUGGESTION');
  const [topic, setTopic] = useState<ListeningTopic>('CONTENT');
  const [courseId, setCourseId] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [nps, setNps] = useState<number | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentNotice, setSentNotice] = useState<string | null>(null);
  // Tras un primer intento de envío incompleto se marcan los campos que faltan.
  const [attempted, setAttempted] = useState(false);
  const [canScrollMore, setCanScrollMore] = useState(false);

  const [entries, setEntries] = useState<OwnListeningEntry[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [unread, setUnread] = useState(0);

  const scrollRef = useRef<HTMLDivElement>(null);
  const moodRef = useRef<HTMLDivElement>(null);
  const subjectRef = useRef<HTMLInputElement>(null);
  const messageRef = useRef<HTMLTextAreaElement>(null);

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
    setAttempted(false);
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

  // Abrir «Mis mensajes» es leer las respuestas: se marcan, pero la lista de esta
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

  // «Desliza para completar»: se muestra mientras quede formulario por ver.
  const updateScrollHint = useCallback(() => {
    const element = scrollRef.current;
    if (!element) return;
    setCanScrollMore(element.scrollHeight - element.scrollTop - element.clientHeight > 12);
  }, []);

  useEffect(() => {
    if (!isOpen || tab !== 'new') return;
    const element = scrollRef.current;
    if (!element) return;
    updateScrollHint();
    if (typeof ResizeObserver === 'undefined') return;
    // Cambia el alto visible (giro del móvil, teclado) o el del contenido (mensaje de error, textarea).
    const observer = new ResizeObserver(updateScrollHint);
    observer.observe(element);
    if (element.firstElementChild) observer.observe(element.firstElementChild);
    return () => observer.disconnect();
  }, [isOpen, tab, updateScrollHint, sentNotice, courses.length]);

  if (!isOpen) return null;

  const resetForm = () => {
    setMood(null);
    setType('SUGGESTION');
    setTopic('CONTENT');
    setCourseId('');
    setSubject('');
    setMessage('');
    setNps(null);
    setError(null);
    setAttempted(false);
  };

  const subjectOk = subject.trim().length >= LISTENING_LIMITS.subjectMin;
  const messageOk = message.trim().length >= LISTENING_LIMITS.messageMin;
  const missing: RequiredField[] = [];
  if (mood === null) missing.push('mood');
  if (!subjectOk) missing.push('subject');
  if (!messageOk) missing.push('message');
  const canSend = missing.length === 0;

  const GUIDANCE: Record<RequiredField, string> = {
    mood: t('faltaElegirComoTeSientesPaso1', 'Falta elegir cómo te sientes (paso 1).'),
    subject: t('faltaUnTituloDeAlMenosSubjectMinLetras', 'Falta un título de al menos {{subjectMin}} letras (paso 3).', { subjectMin: LISTENING_LIMITS.subjectMin }),
    message: t('faltaTuMensajeDeAlMenosMessageMin', 'Falta tu mensaje, de al menos {{messageMin}} caracteres (paso 3).', { messageMin: LISTENING_LIMITS.messageMin }),
  };
  // Mientras falte algo tras un intento de envío, el aviso se actualiza solo al corregirlo.
  const guidance = attempted && missing.length > 0 ? GUIDANCE[missing[0]] : null;

  const focusField = (field: RequiredField) => {
    const target =
      field === 'mood'
        ? moodRef.current?.querySelector<HTMLElement>('button')
        : field === 'subject'
          ? subjectRef.current
          : messageRef.current;
    if (!target) return;
    target.scrollIntoView({ block: 'center', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    target.focus({ preventScroll: true });
  };

  const scrollDown = () => {
    const element = scrollRef.current;
    element?.scrollBy({ top: element.clientHeight * 0.8, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (sending) return;
    setError(null);
    if (!canSend) {
      setAttempted(true);
      focusField(missing[0]);
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
        anonymous: false,
      });
      setSentNotice(response.message);
      resetForm();
      scrollRef.current?.scrollTo({ top: 0 });
      await loadMine();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : t('noSePudoEnviarTuMensaje', 'No se pudo enviar tu mensaje.'));
    } finally {
      setSending(false);
    }
  };

  const newReplies = entries.filter((entry) => entry.unreadReply).length;

  const checklist: { field: RequiredField; label: string; done: boolean }[] = [
    { field: 'mood', label: t('animo', 'Ánimo'), done: mood !== null },
    { field: 'subject', label: t('titulo', 'Título'), done: subjectOk },
    { field: 'message', label: t('mensaje', 'Mensaje'), done: messageOk },
  ];

  return createPortal(
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-canvas/85 p-3 backdrop-blur-md sm:p-4 overscroll-contain"
      onMouseDown={onClose}
      onWheel={(e) => e.stopPropagation()}
    >
      <div
        className="app-dialog relative flex max-h-[calc(100dvh-1.5rem)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-line bg-card shadow-2xl overscroll-contain"
        onMouseDown={(event) => event.stopPropagation()}
        onWheel={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="listening-title"
      >
        <header className="flex items-start gap-3 border-b border-line px-5 py-4 sm:gap-4 sm:px-7 sm:py-5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-cyan text-on-brand">
            <HeartHandshake aria-hidden className="h-6 w-6" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="listening-title" className="text-xl font-bold text-ink" style={DISPLAY_FONT}>
              {t('buzonDeEscucha', 'Buzón de escucha')}
            </h2>
            <p className="mt-1 text-sm text-ink-muted">
              {t('cuentanosComoTeSientesOQueMejorarUna', 'Cuéntanos cómo te sientes o qué mejorar. Una persona del equipo te responde.')}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="-mr-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink-muted hover:bg-ink/10 hover:text-ink"
            aria-label={t('cerrar', 'Cerrar')}
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div role="tablist" className="flex gap-1 border-b border-line px-4 pt-2 sm:px-6">
          {[
            { id: 'new' as const, label: t('escribirMensaje', 'Escribir mensaje'), icon: <MessageSquareText aria-hidden className="h-4 w-4" /> },
            { id: 'mine' as const, label: t('misMensajes', 'Mis mensajes'), icon: <Clock aria-hidden className="h-4 w-4" /> },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              onClick={() => setTab(item.id)}
              className={`-mb-px flex min-h-11 min-w-0 flex-1 items-center justify-center gap-2 border-b-2 px-2 text-sm font-semibold transition-colors sm:px-3 ${
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

        {tab === 'new' && (
          <form onSubmit={handleSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
            <div className="relative flex min-h-0 flex-1 flex-col">
              <div ref={scrollRef} onScroll={updateScrollHint} className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7">
                <div className="space-y-4">
                  {sentNotice && (
                    <div className="flex items-start gap-3 rounded-2xl border border-success-light/30 bg-success-light/10 p-4 text-sm text-success-light">
                      <CheckCircle2 aria-hidden className="mt-0.5 h-5 w-5 shrink-0" />
                      <div>
                        <p className="font-bold">{t('graciasPorEscribirnos', '¡Gracias por escribirnos!')}</p>
                        <p className="mt-0.5 text-sm text-success-light/80">{sentNotice}</p>
                        <button
                          type="button"
                          onClick={() => setTab('mine')}
                          className="mt-2 text-sm font-bold underline underline-offset-2"
                        >
                          {t('verMisMensajes', 'Ver mis mensajes')}
                        </button>
                      </div>
                    </div>
                  )}

                  <Step number={1} title={t('comoTeSientesHoy', '¿Cómo te sientes hoy?')} hint="Toca la carita que mejor te represente." done={mood !== null}>
                    <div
                      ref={moodRef}
                      className={`grid grid-cols-5 gap-1.5 rounded-2xl sm:gap-2 ${
                        attempted && mood === null ? 'outline-2 outline-offset-4 outline-danger-light/70' : ''
                      }`}
                      role="radiogroup"
                      aria-label={t('comoTeSientes', 'Cómo te sientes')}
                      aria-required="true"
                    >
                      {MOODS.map((item) => (
                        <button
                          key={item.value}
                          type="button"
                          role="radio"
                          aria-checked={mood === item.value}
                          onClick={() => setMood(item.value)}
                          className={`flex min-h-[4.5rem] flex-col items-center justify-center gap-1.5 rounded-2xl border-2 px-0.5 py-2.5 transition-colors ${
                            mood === item.value ? `scale-[1.04] ${MOOD_SELECTED[item.value]}` : 'border-line bg-canvas/30 hover:border-line-strong'
                          }`}
                        >
                          <span aria-hidden className="text-3xl leading-none">
                            {item.emoji}
                          </span>
                          <span className="text-center text-xs font-semibold leading-tight text-ink-soft">{item.label}</span>
                        </button>
                      ))}
                    </div>
                  </Step>

                  <Step number={2} title={t('queQuieresContarnos', '¿Qué quieres contarnos?')} hint="Ya dejamos una opción marcada en cada grupo; cámbiala si quieres.">
                    <div className="space-y-4">
                      <fieldset>
                        <legend className={labelClass}>{t('tipoDeMensaje', 'Tipo de mensaje')}</legend>
                        <div className="flex flex-wrap gap-2">
                          {LISTENING_TYPES.map((value) => (
                            <button
                              key={value}
                              type="button"
                              aria-pressed={type === value}
                              onClick={() => setType(value)}
                              className={`flex min-h-10 items-center gap-1.5 rounded-full border-2 px-4 text-sm font-semibold transition-colors ${
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
                        <legend className={labelClass}>{t('tema', 'Tema')}</legend>
                        <div className="flex flex-wrap gap-2">
                          {LISTENING_TOPICS.map((value) => (
                            <button
                              key={value}
                              type="button"
                              aria-pressed={topic === value}
                              onClick={() => setTopic(value)}
                              className={`min-h-10 rounded-full border-2 px-4 text-sm font-semibold transition-colors ${
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
                          <span className={labelClass}>
                            <Trans i18nKey="cursoRelacionadoOpcional">Curso relacionado <span className="font-normal text-ink-muted">(opcional)</span></Trans>
                          </span>
                          <select value={courseId} onChange={(event) => setCourseId(event.target.value)} className={fieldClass}>
                            <option value="">{t('ningunoEnParticular', 'Ninguno en particular')}</option>
                            {courses.map((course) => (
                              <option key={course.id} value={course.id}>
                                {course.title}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}
                    </div>
                  </Step>

                  <Step
                    number={3}
                    title={t('cuentanosMas', 'Cuéntanos más')}
                    hint="Un título corto y tu mensaje. Escribe con confianza."
                    done={subjectOk && messageOk}
                  >
                    <div className="space-y-4">
                      <label className="block">
                        <span className={labelClass}>{t('titulo', 'Título')}</span>
                        <input
                          ref={subjectRef}
                          value={subject}
                          onChange={(event) => setSubject(event.target.value)}
                          maxLength={LISTENING_LIMITS.subjectMax}
                          aria-required="true"
                          aria-invalid={attempted && !subjectOk}
                          placeholder={t('ejTengoUnaDudaConElEjercicio3', 'Ej: Tengo una duda con el ejercicio 3')}
                          className={`${fieldClass} ${attempted && !subjectOk ? fieldErrorClass : ''}`}
                        />
                      </label>

                      <label className="block">
                        <span className={`${labelClass} flex justify-between gap-2`}>
                          <span>{t('tuMensaje', 'Tu mensaje')}</span>
                          <span className="text-xs font-normal text-ink-muted">
                            {message.length}/{LISTENING_LIMITS.messageMax}
                          </span>
                        </span>
                        <textarea
                          ref={messageRef}
                          value={message}
                          onChange={(event) => setMessage(event.target.value)}
                          maxLength={LISTENING_LIMITS.messageMax}
                          aria-required="true"
                          aria-invalid={attempted && !messageOk}
                          rows={5}
                          placeholder={t('cuentanosQueTeOcurreQueNecesitasOQueIdea', 'Cuéntanos qué te ocurre, qué necesitas o qué idea tienes.')}
                          className={`${fieldClass} resize-y ${attempted && !messageOk ? fieldErrorClass : ''}`}
                        />
                      </label>
                    </div>
                  </Step>

                  <Step
                    number={4}
                    title={t('antesDeEnviar', 'Antes de enviar')}
                    hint={t('preguntaNpsOpcional', 'Esta pregunta es opcional.')}
                    optional
                  >
                    <div className="space-y-4">
                      <fieldset>
                        <legend className="mb-3 text-sm font-semibold text-ink">
                          {t('del0Al10QueTanProbableEsQueRecomiendes', 'Del 0 al 10, ¿qué tan probable es que recomiendes esta plataforma a un colega?')}
                        </legend>
                        <div
                          className="grid grid-cols-6 gap-1.5 sm:grid-cols-11"
                          role="radiogroup"
                          aria-label={t('probabilidadDeRecomendarnosDe0A10', 'Probabilidad de recomendarnos, de 0 a 10')}
                        >
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
                                className={`min-h-11 rounded-lg border-2 text-sm font-bold tabular-nums transition-colors ${
                                  selected ? NPS_SELECTED[group] : `bg-canvas/30 ${NPS_TONE[group]}`
                                }`}
                              >
                                {score}
                              </button>
                            );
                          })}
                        </div>
                        <div className="mt-1.5 flex justify-between text-xs text-ink-muted">
                          <span>{t('0NadaProbable', '0 · Nada probable')}</span>
                          <span>{t('muyProbable10', 'Muy probable · 10')}</span>
                        </div>
                      </fieldset>

                      <div className="flex items-start gap-3 rounded-xl border border-line bg-canvas/30 p-4">
                        <ShieldCheck aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-brand-cyan" />
                        <div>
                          <span className="block text-sm font-semibold text-ink">
                            {t('aporteIdentificadoNps', 'Aporte identificado (NPS)')}
                          </span>
                          <span className="block text-sm text-ink-muted">
                            {t(
                              'aporteIdentificadoNpsDesc',
                              'Tu comentario y puntuación Net Promoter Score (NPS) se envían con tu nombre y correo para que el equipo pueda identificar tu caso y darte seguimiento personalizado.',
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                  </Step>
                </div>
              </div>

              {canScrollMore && (
                <div className="pointer-events-none absolute inset-x-0 bottom-0 flex h-20 items-end justify-center bg-gradient-to-t from-card via-card/85 to-transparent pb-3">
                  <button
                    type="button"
                    onClick={scrollDown}
                    className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full border border-brand-cyan/50 bg-card px-3.5 py-1.5 text-sm font-semibold text-brand-cyan shadow-lg hover:bg-brand-cyan/10"
                  >
                    <ChevronsDown aria-hidden className="h-4 w-4 motion-safe:animate-bounce" />
                    {t('deslizaParaCompletar', 'Desliza para completar')}
                  </button>
                </div>
              )}
            </div>

            <div className="sticky bottom-0 z-10 shrink-0 border-t border-line bg-card px-5 py-3 sm:px-7">
              {(guidance || error) && (
                <div
                  role="alert"
                  className="mb-3 flex items-center gap-2 rounded-xl border border-danger/30 bg-danger/10 p-3 text-sm text-danger-light"
                >
                  <AlertCircle aria-hidden className="h-4 w-4 shrink-0" /> {guidance ?? error}
                </div>
              )}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 [@media(max-height:520px)]:hidden">
                  <p id="listening-status" className="mb-1.5 text-xs font-semibold text-ink-muted" aria-live="polite">
                    {canSend ? t('todoListoParaEnviar', 'Todo listo para enviar') : t('completaLoObligatorio', 'Completa lo obligatorio:')}
                  </p>
                  <ul className="flex flex-wrap gap-1.5">
                    {checklist.map((item) => (
                      <li key={item.field}>
                        <button
                          type="button"
                          onClick={() => focusField(item.field)}
                          disabled={item.done}
                          className={`inline-flex min-h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-colors ${
                            item.done
                              ? 'border-success-light/40 bg-success-light/10 text-success-light'
                              : 'border-line bg-canvas/30 text-ink-soft hover:border-brand-cyan hover:text-brand-cyan'
                          }`}
                        >
                          {item.done ? <Check aria-hidden className="h-3.5 w-3.5" strokeWidth={3} /> : <Circle aria-hidden className="h-3.5 w-3.5" />}
                          {item.label}
                          <span className="sr-only"> ({item.done ? t('completado', 'completado') : t('pendiente', 'pendiente')})</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
                <button
                  type="submit"
                  disabled={sending}
                  aria-describedby="listening-status"
                  className={`flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-6 text-base font-bold transition-colors sm:w-auto sm:min-w-[12rem] ${
                    canSend
                      ? 'btn-brand-primary'
                      : 'border-2 border-line bg-ink/10 text-ink-soft hover:border-brand-cyan/60'
                  } disabled:opacity-60`}
                >
                  <Send aria-hidden className="h-4 w-4" />
                  {sending ? t('enviando', 'Enviando…') : t('enviarMensaje', 'Enviar mensaje')}
                </button>
              </div>
            </div>
          </form>
        )}

        {tab === 'mine' && (
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7">
            <div className="space-y-3">
              {loadingEntries && entries.length === 0 && <p className="text-sm text-ink-muted">{t('cargandoTusMensajes', 'Cargando tus mensajes...')}</p>}

              {!loadingEntries && entries.length === 0 && (
                <div className="rounded-2xl border border-dashed border-line p-8 text-center">
                  <p className="text-sm font-bold text-ink">{t('todaviaNoNosHasEscrito', 'Todavía no nos has escrito')}</p>
                  <p className="mt-1 text-xs text-ink-muted">
                    {t('cuandoLoHagasAquiVerasEnQuePuntoEstaTu', 'Cuando lo hagas, aquí verás en qué punto está tu mensaje y la respuesta del equipo.')}
                  </p>
                  <button type="button" onClick={() => setTab('new')} className="btn-brand-primary mt-4 px-4 py-2 text-xs font-bold">
                    {t('escribirAhora', 'Escribir ahora')}
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
                      {new Date(entry.createdAt).toLocaleString(dateLocale())}
                    </p>

                    {entry.reply && (
                      <div className="mt-3 rounded-xl border border-brand-cyan/30 bg-brand-cyan/10 p-3">
                        <p className="flex items-center gap-1.5 text-[11px] font-bold text-brand-cyan">
                          <HeartHandshake aria-hidden className="h-3.5 w-3.5" />
                          {t('respuestaDelEquipo', 'Respuesta del equipo')}{entry.repliedBy ? ` · ${entry.repliedBy}` : ''}
                          {entry.unreadReply && (
                            <span className="rounded-full bg-brand-cyan px-1.5 py-0.5 text-micro text-canvas">{t('nueva', 'Nueva')}</span>
                          )}
                        </p>
                        <p className="mt-1 whitespace-pre-wrap text-xs text-ink">{entry.reply}</p>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
};
