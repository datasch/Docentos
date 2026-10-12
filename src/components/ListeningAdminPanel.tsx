/**
 * Panel del Buzón de Escucha para administración.
 *
 * Pensado para quien analiza: arriba las cifras (NPS, ánimo medio, volumen,
 * tiempo de respuesta), en medio dónde duele y dónde gusta (por tema, tipo y
 * curso, con la tendencia semanal) y abajo los mensajes para leerlos y
 * responderlos. Todo sale de números —la carita es un 1-5, el NPS un 0-10— y se
 * exporta a CSV con los mismos filtros.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Download, HeartHandshake, Inbox, Send, UserX } from 'lucide-react';
import { api } from '../lib/api';
import {
  LISTENING_STATUSES,
  LISTENING_STATUS_LABELS,
  LISTENING_TOPICS,
  LISTENING_TOPIC_LABELS,
  LISTENING_TYPES,
  LISTENING_TYPE_LABELS,
  MOODS,
  type ListeningStatus,
} from '../lib/listening';
import type {
  ListeningAdminFilter,
  ListeningAdminResponse,
  StaffListeningEntry,
} from '../lib/listeningTypes';

const PERIODS = [
  { days: 30, label: '30 días' },
  { days: 90, label: '90 días' },
  { days: 365, label: '12 meses' },
  { days: 0, label: 'Todo' },
];

const selectClass =
  'rounded-lg border border-line bg-canvas/50 px-3 py-2 text-xs text-ink outline-none focus:border-brand-cyan';

function moodFace(avg: number | null) {
  if (avg === null) return null;
  return MOODS[Math.min(5, Math.max(1, Math.round(avg))) - 1];
}

function npsVerdict(score: number | null): { label: string; tone: string } {
  if (score === null) return { label: 'Sin respuestas todavía', tone: 'text-ink-muted' };
  if (score >= 50) return { label: 'Excelente', tone: 'text-success-light' };
  if (score >= 30) return { label: 'Bueno', tone: 'text-success-light' };
  if (score >= 0) return { label: 'Por mejorar', tone: 'text-warning-light' };
  return { label: 'Crítico', tone: 'text-danger-light' };
}

function moodTone(avg: number | null): string {
  if (avg === null) return 'text-ink-muted';
  if (avg >= 4) return 'text-success-light';
  if (avg >= 3) return 'text-warning-light';
  return 'text-danger-light';
}

const STATUS_TONE: Record<ListeningStatus, string> = {
  NEW: 'border-brand-cyan/40 bg-brand-cyan/10 text-brand-cyan',
  IN_REVIEW: 'border-warning-light/40 bg-warning-light/10 text-warning-light',
  ANSWERED: 'border-success-light/40 bg-success-light/10 text-success-light',
  CLOSED: 'border-line-strong/40 bg-elevated/10 text-ink-muted',
};

function formatHours(hours: number | null): string {
  if (hours === null) return '—';
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  if (hours < 48) return `${hours.toFixed(1)} h`;
  return `${(hours / 24).toFixed(1)} días`;
}

const Card: React.FC<{ title: string; children: React.ReactNode; className?: string }> = ({
  title,
  children,
  className = '',
}) => (
  <section className={`rounded-2xl border border-line bg-card p-4 ${className}`}>
    <h3 className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">{title}</h3>
    <div className="mt-3">{children}</div>
  </section>
);

/** Fila con barra proporcional: dónde se concentra algo y cómo se siente. */
const BarRow: React.FC<{ label: string; count: number; max: number; avgMood: number | null; extra?: string }> = ({
  label,
  count,
  max,
  avgMood,
  extra,
}) => (
  <li className="text-xs">
    <div className="flex items-baseline justify-between gap-2">
      <span className="truncate text-ink-soft">{label}</span>
      <span className="shrink-0 tabular-nums text-ink-muted">
        {count}
        {avgMood !== null && (
          <span className={`ml-2 font-bold ${moodTone(avgMood)}`}>
            {moodFace(avgMood)?.emoji} {avgMood.toFixed(1)}
          </span>
        )}
        {extra}
      </span>
    </div>
    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink/10">
      <div className="h-full rounded-full bg-brand-cyan" style={{ width: `${max ? (count / max) * 100 : 0}%` }} />
    </div>
  </li>
);

export const ListeningAdminPanel: React.FC = () => {
  const [filter, setFilter] = useState<ListeningAdminFilter>({ days: 90, status: '', type: '', topic: '', courseId: '', mood: '' });
  const [data, setData] = useState<ListeningAdminResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await api.getListeningAdmin(filter));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'No se pudo cargar el buzón');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  const replaceEntry = (updated: StaffListeningEntry) =>
    setData((current) =>
      current ? { ...current, entries: current.entries.map((item) => (item.id === updated.id ? updated : item)) } : current,
    );

  const handleReply = async (entry: StaffListeningEntry) => {
    const reply = (drafts[entry.id] || '').trim();
    if (!reply) return;
    setBusyId(entry.id);
    setError(null);
    try {
      const response = await api.updateListening(entry.id, { reply });
      replaceEntry(response.entry);
      setDrafts((current) => ({ ...current, [entry.id]: '' }));
      // El estado cambió, y con él los pendientes del resumen.
      void load();
    } catch (replyError) {
      setError(replyError instanceof Error ? replyError.message : 'No se pudo responder');
    } finally {
      setBusyId(null);
    }
  };

  const handleStatus = async (entry: StaffListeningEntry, status: ListeningStatus) => {
    setBusyId(entry.id);
    setError(null);
    try {
      replaceEntry((await api.updateListening(entry.id, { status })).entry);
      void load();
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : 'No se pudo cambiar el estado');
    } finally {
      setBusyId(null);
    }
  };

  const summary = data?.summary;
  const verdict = npsVerdict(summary?.nps.score ?? null);
  const avgFace = moodFace(summary?.avgMood ?? null);
  const npsTotal = summary?.nps.responses || 0;
  const maxMood = summary ? Math.max(1, ...Object.values(summary.moodDistribution)) : 1;
  const maxWeek = summary ? Math.max(1, ...summary.weekly.map((week) => week.count)) : 1;
  const pct = (value: number, total: number) => (total ? (value / total) * 100 : 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold text-ink">
            <HeartHandshake aria-hidden className="h-5 w-5 text-brand-cyan" />
            Buzón de Escucha
          </h2>
          <p className="mt-0.5 text-xs text-ink-muted">
            Lo que sienten y piden tus estudiantes, en cifras. El NPS cuenta a cada persona una vez: su nota más reciente
            del periodo.
          </p>
        </div>
        <button
          type="button"
          onClick={() => api.downloadListeningCsv(filter).catch((exportError: Error) => setError(exportError.message))}
          className="flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-xs font-bold text-ink-soft hover:border-brand-cyan hover:text-brand-cyan"
        >
          <Download aria-hidden className="h-4 w-4" />
          Exportar CSV
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-line p-0.5" role="group" aria-label="Periodo">
          {PERIODS.map((period) => (
            <button
              key={period.days}
              type="button"
              aria-pressed={filter.days === period.days}
              onClick={() => setFilter((current) => ({ ...current, days: period.days }))}
              className={`rounded-md px-3 py-1.5 text-xs font-bold ${
                filter.days === period.days ? 'bg-brand-cyan text-canvas' : 'text-ink-muted hover:text-ink'
              }`}
            >
              {period.label}
            </button>
          ))}
        </div>

        <select
          aria-label="Filtrar por curso"
          className={selectClass}
          value={filter.courseId || ''}
          onChange={(event) => setFilter((current) => ({ ...current, courseId: event.target.value }))}
        >
          <option value="">Todos los cursos</option>
          {data?.courses.map((course) => (
            <option key={course.id} value={course.id}>
              {course.title}
            </option>
          ))}
        </select>
        <select
          aria-label="Filtrar por tipo"
          className={selectClass}
          value={filter.type || ''}
          onChange={(event) => setFilter((current) => ({ ...current, type: event.target.value as ListeningAdminFilter['type'] }))}
        >
          <option value="">Todos los tipos</option>
          {LISTENING_TYPES.map((value) => (
            <option key={value} value={value}>
              {LISTENING_TYPE_LABELS[value]}
            </option>
          ))}
        </select>
        <select
          aria-label="Filtrar por tema"
          className={selectClass}
          value={filter.topic || ''}
          onChange={(event) => setFilter((current) => ({ ...current, topic: event.target.value as ListeningAdminFilter['topic'] }))}
        >
          <option value="">Todos los temas</option>
          {LISTENING_TOPICS.map((value) => (
            <option key={value} value={value}>
              {LISTENING_TOPIC_LABELS[value]}
            </option>
          ))}
        </select>
        <select
          aria-label="Filtrar por estado"
          className={selectClass}
          value={filter.status || ''}
          onChange={(event) => setFilter((current) => ({ ...current, status: event.target.value as ListeningAdminFilter['status'] }))}
        >
          <option value="">Todos los estados</option>
          {LISTENING_STATUSES.map((value) => (
            <option key={value} value={value}>
              {LISTENING_STATUS_LABELS[value]}
            </option>
          ))}
        </select>
        <select
          aria-label="Filtrar por carita"
          className={selectClass}
          value={filter.mood || ''}
          onChange={(event) =>
            setFilter((current) => ({ ...current, mood: event.target.value ? Number(event.target.value) : '' }))
          }
        >
          <option value="">Cualquier carita</option>
          {MOODS.map((mood) => (
            <option key={mood.value} value={mood.value}>
              {mood.emoji} {mood.value} · {mood.label}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div role="alert" className="rounded-xl border border-danger/30 bg-danger/10 p-3 text-xs text-danger-light">
          {error}
        </div>
      )}

      {loading && !data && <p className="text-sm text-ink-muted">Cargando el buzón...</p>}

      {summary && (
        <>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Card title="NPS">
              <p className="flex items-baseline gap-2">
                <span className={`text-4xl font-bold tabular-nums ${verdict.tone}`}>
                  {summary.nps.score === null ? '—' : summary.nps.score}
                </span>
                <span className={`text-xs font-bold ${verdict.tone}`}>{verdict.label}</span>
              </p>
              <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-ink/10" aria-hidden>
                <div className="bg-success-light" style={{ width: `${pct(summary.nps.promoters, npsTotal)}%` }} />
                <div className="bg-warning-light" style={{ width: `${pct(summary.nps.passives, npsTotal)}%` }} />
                <div className="bg-danger" style={{ width: `${pct(summary.nps.detractors, npsTotal)}%` }} />
              </div>
              <p className="mt-2 text-[11px] text-ink-muted">
                <span className="text-success-light">{summary.nps.promoters} promotores</span> ·{' '}
                <span className="text-warning-light">{summary.nps.passives} pasivos</span> ·{' '}
                <span className="text-danger-light">{summary.nps.detractors} detractores</span>
                <br />
                {npsTotal} {npsTotal === 1 ? 'persona respondió' : 'personas respondieron'} (escala de −100 a 100)
              </p>
            </Card>

            <Card title="Ánimo medio (1-5)">
              <p className="flex items-center gap-3">
                <span aria-hidden className="text-4xl leading-none">
                  {avgFace?.emoji ?? '—'}
                </span>
                <span className={`text-4xl font-bold tabular-nums ${moodTone(summary.avgMood)}`}>
                  {summary.avgMood === null ? '—' : summary.avgMood.toFixed(1)}
                </span>
              </p>
              <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-ink/10" aria-hidden>
                <div className="bg-success-light" style={{ width: `${pct(summary.sentiment.positive, summary.total)}%` }} />
                <div className="bg-warning-light" style={{ width: `${pct(summary.sentiment.neutral, summary.total)}%` }} />
                <div className="bg-danger" style={{ width: `${pct(summary.sentiment.negative, summary.total)}%` }} />
              </div>
              <p className="mt-2 text-[11px] text-ink-muted">
                {summary.sentiment.positive} positivos · {summary.sentiment.neutral} neutros · {summary.sentiment.negative} negativos
              </p>
            </Card>

            <Card title="Mensajes">
              <p className="text-4xl font-bold tabular-nums text-ink">{summary.total}</p>
              <p className="mt-3 flex items-center gap-1.5 text-[11px] text-ink-muted">
                <Inbox aria-hidden className="h-3.5 w-3.5" />
                <span className={summary.pending > 0 ? 'font-bold text-warning-light' : ''}>{summary.pending} por responder</span>
                · {summary.answered} atendidos
              </p>
            </Card>

            <Card title="Tiempo medio de respuesta">
              <p className="text-4xl font-bold tabular-nums text-ink">{formatHours(summary.avgResponseHours)}</p>
              <p className="mt-3 text-[11px] text-ink-muted">Desde que llega el mensaje hasta la primera respuesta del equipo.</p>
            </Card>
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            <Card title="Cómo se sienten">
              <ul className="space-y-2">
                {[...MOODS].reverse().map((mood) => {
                  const count = summary.moodDistribution[String(mood.value) as '1'];
                  return (
                    <li key={mood.value} className="flex items-center gap-2 text-xs">
                      <span aria-hidden className="w-6 text-lg">
                        {mood.emoji}
                      </span>
                      <span className="w-20 shrink-0 text-ink-soft">
                        {mood.value} · {mood.label}
                      </span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-ink/10">
                        <div
                          className={`h-full rounded-full ${mood.value >= 4 ? 'bg-success-light' : mood.value === 3 ? 'bg-warning-light' : 'bg-danger'}`}
                          style={{ width: `${(count / maxMood) * 100}%` }}
                        />
                      </div>
                      <span className="w-7 text-right tabular-nums text-ink-muted">{count}</span>
                    </li>
                  );
                })}
              </ul>
            </Card>

            <Card title="Por tema">
              {summary.byTopic.length === 0 ? (
                <p className="text-xs text-ink-muted">Sin datos.</p>
              ) : (
                <ul className="space-y-2.5">
                  {summary.byTopic.map((item) => (
                    <BarRow key={item.key} label={item.label} count={item.count} max={summary.byTopic[0].count} avgMood={item.avgMood} />
                  ))}
                </ul>
              )}
            </Card>

            <Card title="Por tipo de mensaje">
              {summary.byType.length === 0 ? (
                <p className="text-xs text-ink-muted">Sin datos.</p>
              ) : (
                <ul className="space-y-2.5">
                  {summary.byType.map((item) => (
                    <BarRow key={item.key} label={item.label} count={item.count} max={summary.byType[0].count} avgMood={item.avgMood} />
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <Card title="Por curso">
              {summary.byCourse.length === 0 ? (
                <p className="text-xs text-ink-muted">Todavía nadie ha relacionado un mensaje con un curso.</p>
              ) : (
                <ul className="space-y-2.5">
                  {summary.byCourse.slice(0, 8).map((item) => (
                    <BarRow
                      key={item.courseId}
                      label={item.title}
                      count={item.count}
                      max={summary.byCourse[0].count}
                      avgMood={item.avgMood}
                      extra={item.nps === null ? '' : ` · NPS ${item.nps}`}
                    />
                  ))}
                </ul>
              )}
            </Card>

            <Card title="Tendencia semanal">
              {summary.weekly.length === 0 ? (
                <p className="text-xs text-ink-muted">Sin datos.</p>
              ) : (
                <div className="flex h-32 items-end gap-1.5" role="img" aria-label="Mensajes por semana, coloreados por ánimo medio">
                  {summary.weekly.slice(-16).map((week) => (
                    <div
                      key={week.weekStart}
                      className="group relative flex flex-1 flex-col justify-end"
                      title={`Semana del ${week.weekStart}: ${week.count} mensajes · ánimo ${week.avgMood ?? '—'} · NPS ${week.nps ?? '—'}`}
                    >
                      <div
                        className={`w-full rounded-t ${
                          (week.avgMood ?? 0) >= 4 ? 'bg-success-light' : (week.avgMood ?? 0) >= 3 ? 'bg-warning-light' : 'bg-danger'
                        }`}
                        style={{ height: `${Math.max(6, (week.count / maxWeek) * 100)}%` }}
                      />
                    </div>
                  ))}
                </div>
              )}
              <p className="mt-2 text-micro text-ink-faint">Altura: mensajes. Color: ánimo medio de la semana.</p>
            </Card>
          </div>
        </>
      )}

      <section aria-label="Mensajes recibidos" className="space-y-3">
        <h3 className="text-sm font-bold text-ink">Mensajes ({data?.entries.length ?? 0})</h3>

        {data && data.entries.length === 0 && (
          <p className="rounded-2xl border border-dashed border-line p-6 text-center text-xs text-ink-muted">
            No hay mensajes con estos filtros.
          </p>
        )}

        {data?.entries.map((entry) => {
          const face = MOODS.find((item) => item.value === entry.mood);
          return (
            <article key={entry.id} className="rounded-2xl border border-line bg-card p-4">
              <div className="flex flex-wrap items-center gap-2 text-[11px]">
                <span title={face?.label} className="text-xl leading-none">
                  {face?.emoji}
                </span>
                <span className="font-bold tabular-nums text-ink-soft">{entry.mood}/5</span>
                <span className="rounded-full bg-ink/10 px-2 py-0.5 font-bold text-ink-soft">{LISTENING_TYPE_LABELS[entry.type]}</span>
                <span className="text-ink-muted">{LISTENING_TOPIC_LABELS[entry.topic]}</span>
                {entry.courseTitle && <span className="text-ink-faint">· {entry.courseTitle}</span>}
                {entry.npsScore !== null && (
                  <span
                    className={`rounded-full border px-2 py-0.5 font-bold ${
                      entry.npsGroup === 'PROMOTER'
                        ? 'border-success-light/40 text-success-light'
                        : entry.npsGroup === 'PASSIVE'
                          ? 'border-warning-light/40 text-warning-light'
                          : 'border-danger/40 text-danger-light'
                    }`}
                  >
                    NPS {entry.npsScore}
                  </span>
                )}
                <span className={`ml-auto rounded-full border px-2 py-0.5 font-bold ${STATUS_TONE[entry.status]}`}>
                  {LISTENING_STATUS_LABELS[entry.status]}
                </span>
              </div>

              <h4 className="mt-2 text-sm font-bold text-ink">{entry.subject}</h4>
              <p className="mt-1 whitespace-pre-wrap text-xs text-ink-soft">{entry.message}</p>
              <p className="mt-2 flex items-center gap-1.5 text-micro text-ink-faint">
                {entry.anonymous ? (
                  <>
                    <UserX aria-hidden className="h-3 w-3" /> Anónimo
                  </>
                ) : (
                  entry.author && `${entry.author.name} · ${entry.author.email}`
                )}{' '}
                · {new Date(entry.createdAt).toLocaleString('es')}
              </p>

              {entry.reply && (
                <div className="mt-3 rounded-xl border border-brand-cyan/30 bg-brand-cyan/10 p-3">
                  <p className="text-[11px] font-bold text-brand-cyan">
                    Respondido{entry.repliedBy ? ` por ${entry.repliedBy}` : ''}
                    {entry.repliedAt && ` · ${new Date(entry.repliedAt).toLocaleString('es')}`}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-xs text-ink">{entry.reply}</p>
                </div>
              )}

              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-start">
                <textarea
                  aria-label={`Respuesta a: ${entry.subject}`}
                  rows={2}
                  maxLength={2000}
                  value={drafts[entry.id] || ''}
                  onChange={(event) => setDrafts((current) => ({ ...current, [entry.id]: event.target.value }))}
                  placeholder={entry.reply ? 'Escribe una nueva respuesta...' : 'Responde a esta persona...'}
                  className="w-full flex-1 rounded-xl border border-line bg-canvas/50 px-3 py-2 text-xs text-ink outline-none placeholder:text-ink-faint focus:border-brand-cyan"
                />
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    disabled={busyId === entry.id || !(drafts[entry.id] || '').trim()}
                    onClick={() => handleReply(entry)}
                    className="btn-brand-primary flex items-center gap-1.5 px-3 py-2 text-xs font-bold disabled:opacity-50"
                  >
                    <Send aria-hidden className="h-3.5 w-3.5" />
                    Responder
                  </button>
                  <select
                    aria-label="Cambiar estado"
                    className={selectClass}
                    value={entry.status}
                    disabled={busyId === entry.id}
                    onChange={(event) => handleStatus(entry, event.target.value as ListeningStatus)}
                  >
                    {LISTENING_STATUSES.map((value) => (
                      <option key={value} value={value}>
                        {LISTENING_STATUS_LABELS[value]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
};
