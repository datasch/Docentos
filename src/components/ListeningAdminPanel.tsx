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
import { Download, Inbox, Loader2, Send, UserX } from 'lucide-react';
import { ActiveFilters, FilterMenu, Pager } from './AdminListKit';
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

const PAGE_SIZE = 10;

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

function formatHours(hours: number | null): string {
  if (hours === null) return '—';
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  if (hours < 48) return `${hours.toFixed(1)} h`;
  return `${(hours / 24).toFixed(1)} días`;
}

const Card: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="admin-listening__card">
    <h4>{title}</h4>
    {children}
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
  <li className="admin-listening__bar-row">
    <div>
      <span title={label}>{label}</span>
      <span>
        {count}
        {avgMood !== null && (
          <span className={`ml-2 font-bold ${moodTone(avgMood)}`}>
            {moodFace(avgMood)?.emoji} {avgMood.toFixed(1)}
          </span>
        )}
        {extra}
      </span>
    </div>
    <div className="admin-listening__track">
      <div style={{ width: `${max ? (count / max) * 100 : 0}%` }} />
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
  const [page, setPage] = useState(1);

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

  const change = (patch: Partial<ListeningAdminFilter>) => {
    setFilter((current) => ({ ...current, ...patch }));
    setPage(1);
  };
  const orAll = (value: string | number | undefined) => (value === undefined || value === '' ? 'ALL' : String(value));
  const fromAll = (value: string) => (value === 'ALL' ? '' : value);

  const summary = data?.summary;
  const verdict = npsVerdict(summary?.nps.score ?? null);
  const avgFace = moodFace(summary?.avgMood ?? null);
  const npsTotal = summary?.nps.responses || 0;
  const maxMood = summary ? Math.max(1, ...Object.values(summary.moodDistribution)) : 1;
  const maxWeek = summary ? Math.max(1, ...summary.weekly.map((week) => week.count)) : 1;
  const pct = (value: number, total: number) => (total ? (value / total) * 100 : 0);

  const entries = data?.entries ?? [];
  const safePage = Math.min(page, Math.max(1, Math.ceil(entries.length / PAGE_SIZE)));
  const visible = entries.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const chips = [
    filter.courseId ? { key: 'course', text: data?.courses.find((course) => course.id === filter.courseId)?.title || 'Curso', onRemove: () => change({ courseId: '' }) } : null,
    filter.type ? { key: 'type', text: LISTENING_TYPE_LABELS[filter.type], onRemove: () => change({ type: '' }) } : null,
    filter.topic ? { key: 'topic', text: LISTENING_TOPIC_LABELS[filter.topic], onRemove: () => change({ topic: '' }) } : null,
    filter.status ? { key: 'status', text: LISTENING_STATUS_LABELS[filter.status], onRemove: () => change({ status: '' }) } : null,
    filter.mood ? { key: 'mood', text: `${MOODS.find((mood) => mood.value === filter.mood)?.emoji ?? ''} ${filter.mood}/5`, onRemove: () => change({ mood: '' }) } : null,
  ].filter((chip): chip is { key: string; text: string; onRemove: () => void } => chip !== null);
  const noBreakdown = summary && summary.byTopic.length === 0 && summary.byType.length === 0 && summary.byCourse.length === 0;

  return (
    <section data-mentor-ui="modern" className="admin-courses-root admin-listening" aria-label="Buzón de escucha">
      <div className="admin-listening__intro">
        <div>
          <h3>Buzón de escucha</h3>
          <p>Lo que sienten y piden tus estudiantes, en cifras. El NPS cuenta a cada persona una vez: su nota más reciente del periodo.</p>
        </div>
        <button
          type="button"
          className="mentor-course-control admin-listening__export"
          onClick={() => api.downloadListeningCsv(filter).catch((exportError: Error) => setError(exportError.message))}
        >
          <Download aria-hidden="true" />
          Exportar CSV
        </button>
      </div>

      <div className="mentor-course-toolbar admin-listening__toolbar">
        <div className="mentor-publication-filters admin-view-toggle" role="group" aria-label="Periodo">
          {PERIODS.map((period) => (
            <button key={period.days} type="button" aria-pressed={filter.days === period.days} onClick={() => change({ days: period.days })}>
              {period.label}
            </button>
          ))}
        </div>
        <FilterMenu
          groups={[
            { value: orAll(filter.status), onChange: (value) => change({ status: fromAll(value) as ListeningAdminFilter['status'] }), options: LISTENING_STATUSES.map((value) => ({ value, label: LISTENING_STATUS_LABELS[value] })) },
            { value: orAll(filter.type), onChange: (value) => change({ type: fromAll(value) as ListeningAdminFilter['type'] }), options: LISTENING_TYPES.map((value) => ({ value, label: LISTENING_TYPE_LABELS[value] })) },
            { value: orAll(filter.topic), onChange: (value) => change({ topic: fromAll(value) as ListeningAdminFilter['topic'] }), options: LISTENING_TOPICS.map((value) => ({ value, label: LISTENING_TOPIC_LABELS[value] })) },
            { value: orAll(filter.mood), onChange: (value) => change({ mood: value === 'ALL' ? '' : Number(value) }), options: MOODS.map((mood) => ({ value: String(mood.value), label: `${mood.emoji} ${mood.value} · ${mood.label}` })) },
            { value: orAll(filter.courseId), onChange: (value) => change({ courseId: fromAll(value) }), options: (data?.courses ?? []).map((course) => ({ value: course.id, label: course.title })) },
          ]}
        />
      </div>
      <ActiveFilters noun="mensajes" onClear={() => change({ courseId: '', type: '', topic: '', status: '', mood: '' })} chips={chips} />

      {error && <p role="alert" className="admin-listening__error">{error}</p>}
      {loading && !data && <p className="admin-listening__empty" role="status"><Loader2 className="animate-spin" aria-hidden="true" />Cargando el buzón…</p>}

      {summary && (
        <>
          <div className="admin-listening__stats">
            <Card title="NPS">
              <p className="admin-listening__figure">
                <strong className={verdict.tone}>{summary.nps.score === null ? '—' : summary.nps.score}</strong>
                <span className={verdict.tone}>{verdict.label}</span>
              </p>
              {npsTotal > 0 && (
                <div className="admin-listening__split" aria-hidden="true">
                  <div style={{ width: `${pct(summary.nps.promoters, npsTotal)}%`, background: 'var(--color-success-light)' }} />
                  <div style={{ width: `${pct(summary.nps.passives, npsTotal)}%`, background: 'var(--color-warning-light)' }} />
                  <div style={{ width: `${pct(summary.nps.detractors, npsTotal)}%`, background: 'var(--color-danger-light)' }} />
                </div>
              )}
              <p className="admin-listening__note">
                {summary.nps.promoters} promotores · {summary.nps.passives} pasivos · {summary.nps.detractors} detractores
                <br />
                {npsTotal} {npsTotal === 1 ? 'persona respondió' : 'personas respondieron'} (escala de −100 a 100)
              </p>
            </Card>

            <Card title="Ánimo medio (1 a 5)">
              <p className="admin-listening__figure">
                {avgFace && <span aria-hidden="true" className="admin-listening__face">{avgFace.emoji}</span>}
                <strong className={moodTone(summary.avgMood)}>{summary.avgMood === null ? '—' : summary.avgMood.toFixed(1)}</strong>
              </p>
              {summary.total > 0 && (
                <div className="admin-listening__split" aria-hidden="true">
                  <div style={{ width: `${pct(summary.sentiment.positive, summary.total)}%`, background: 'var(--color-success-light)' }} />
                  <div style={{ width: `${pct(summary.sentiment.neutral, summary.total)}%`, background: 'var(--color-warning-light)' }} />
                  <div style={{ width: `${pct(summary.sentiment.negative, summary.total)}%`, background: 'var(--color-danger-light)' }} />
                </div>
              )}
              <p className="admin-listening__note">
                {summary.sentiment.positive} positivos · {summary.sentiment.neutral} neutros · {summary.sentiment.negative} negativos
              </p>
            </Card>

            <Card title="Mensajes">
              <p className="admin-listening__figure"><strong>{summary.total}</strong></p>
              <p className="admin-listening__note">
                <Inbox aria-hidden="true" />
                <span className={summary.pending > 0 ? 'text-warning-light' : ''}>{summary.pending} por responder</span> · {summary.answered} atendidos
              </p>
            </Card>

            <Card title="Tiempo medio de respuesta">
              <p className="admin-listening__figure"><strong>{formatHours(summary.avgResponseHours)}</strong></p>
              <p className="admin-listening__note">Desde que llega el mensaje hasta la primera respuesta del equipo.</p>
            </Card>
          </div>

          <div className="admin-listening__panels">
            <Card title="Cómo se sienten">
              <ul className="admin-listening__moods">
                {[...MOODS].reverse().map((mood) => {
                  const count = summary.moodDistribution[String(mood.value) as '1'];
                  return (
                    <li key={mood.value}>
                      <span aria-hidden="true">{mood.emoji}</span>
                      <span>{mood.value} · {mood.label}</span>
                      <div className="admin-listening__track">
                        <div style={{ width: `${(count / maxMood) * 100}%`, background: mood.value >= 4 ? 'var(--color-success-light)' : mood.value === 3 ? 'var(--color-warning-light)' : 'var(--color-danger-light)' }} />
                      </div>
                      <span>{count}</span>
                    </li>
                  );
                })}
              </ul>
            </Card>

            {noBreakdown ? (
              <Card title="Desglose">
                <p className="admin-listening__note">Todavía no hay mensajes con tema, tipo o curso para desglosar.</p>
              </Card>
            ) : (
              <>
                <Card title="Por tema">
                  {summary.byTopic.length === 0 ? <p className="admin-listening__note">Sin datos.</p> : (
                    <ul className="admin-listening__bars">
                      {summary.byTopic.map((item) => <BarRow key={item.key} label={item.label} count={item.count} max={summary.byTopic[0].count} avgMood={item.avgMood} />)}
                    </ul>
                  )}
                </Card>
                <Card title="Por tipo de mensaje">
                  {summary.byType.length === 0 ? <p className="admin-listening__note">Sin datos.</p> : (
                    <ul className="admin-listening__bars">
                      {summary.byType.map((item) => <BarRow key={item.key} label={item.label} count={item.count} max={summary.byType[0].count} avgMood={item.avgMood} />)}
                    </ul>
                  )}
                </Card>
                <Card title="Por curso">
                  {summary.byCourse.length === 0 ? <p className="admin-listening__note">Todavía nadie ha relacionado un mensaje con un curso.</p> : (
                    <ul className="admin-listening__bars">
                      {summary.byCourse.slice(0, 8).map((item) => (
                        <BarRow key={item.courseId} label={item.title} count={item.count} max={summary.byCourse[0].count} avgMood={item.avgMood} extra={item.nps === null ? '' : ` · NPS ${item.nps}`} />
                      ))}
                    </ul>
                  )}
                </Card>
              </>
            )}

            <Card title="Tendencia semanal">
              {summary.weekly.length === 0 ? <p className="admin-listening__note">Sin datos.</p> : (
                <>
                  <div className="admin-listening__weekly" role="img" aria-label="Mensajes por semana, coloreados por ánimo medio">
                    {summary.weekly.slice(-16).map((week) => (
                      <div key={week.weekStart} title={`Semana del ${week.weekStart}: ${week.count} mensajes · ánimo ${week.avgMood ?? '—'} · NPS ${week.nps ?? '—'}`}>
                        <div style={{ height: `${Math.max(6, (week.count / maxWeek) * 100)}%`, background: (week.avgMood ?? 0) >= 4 ? 'var(--color-success-light)' : (week.avgMood ?? 0) >= 3 ? 'var(--color-warning-light)' : 'var(--color-danger-light)' }} />
                      </div>
                    ))}
                  </div>
                  <p className="admin-listening__note">Altura: mensajes. Color: ánimo medio de la semana.</p>
                </>
              )}
            </Card>
          </div>
        </>
      )}

      <div className="admin-listening__messages" role="region" aria-label="Mensajes recibidos">
        <h3>Mensajes <span>{entries.length}</span></h3>

        {data && entries.length === 0 && (
          <div className="admin-listening__empty"><Inbox aria-hidden="true" /><p>{chips.length > 0 ? 'Ningún mensaje coincide con los filtros.' : 'Todavía no hay mensajes en este periodo.'}</p></div>
        )}

        {visible.map((entry) => {
          const face = MOODS.find((item) => item.value === entry.mood);
          return (
            <article key={entry.id} className="admin-listening__entry">
              <div className="admin-listening__entry-meta">
                <span title={face?.label} aria-hidden="true" className="admin-listening__face">{face?.emoji}</span>
                <span className="admin-listening__mood-num">{entry.mood}/5</span>
                <span className="admin-listening__tag">{LISTENING_TYPE_LABELS[entry.type]}</span>
                <span>{LISTENING_TOPIC_LABELS[entry.topic]}</span>
                {entry.courseTitle && <span>· {entry.courseTitle}</span>}
                {entry.npsScore !== null && (
                  <span className="admin-listening__tag" data-group={entry.npsGroup}>NPS {entry.npsScore}</span>
                )}
                <span className="admin-listening__status" data-status={entry.status}>{LISTENING_STATUS_LABELS[entry.status]}</span>
              </div>

              <h4>{entry.subject}</h4>
              <p className="admin-listening__message">{entry.message}</p>
              <p className="admin-listening__author">
                {entry.anonymous ? (<><UserX aria-hidden="true" /> Anónimo</>) : (entry.author && `${entry.author.name} · ${entry.author.email}`)}
                {' '}· {new Date(entry.createdAt).toLocaleString('es')}
              </p>

              {entry.reply && (
                <div className="admin-listening__reply">
                  <p>
                    Respondido{entry.repliedBy ? ` por ${entry.repliedBy}` : ''}
                    {entry.repliedAt && ` · ${new Date(entry.repliedAt).toLocaleString('es')}`}
                  </p>
                  <p>{entry.reply}</p>
                </div>
              )}

              <div className="admin-listening__compose">
                <textarea
                  aria-label={`Respuesta a: ${entry.subject}`}
                  rows={2}
                  maxLength={2000}
                  value={drafts[entry.id] || ''}
                  onChange={(event) => setDrafts((current) => ({ ...current, [entry.id]: event.target.value }))}
                  placeholder={entry.reply ? 'Escribe una nueva respuesta…' : 'Responde a esta persona…'}
                />
                <div>
                  <button
                    type="button"
                    className="mentor-course-control mentor-course-import"
                    disabled={busyId === entry.id || !(drafts[entry.id] || '').trim()}
                    onClick={() => handleReply(entry)}
                  >
                    <Send aria-hidden="true" />
                    Responder
                  </button>
                  <select
                    aria-label="Cambiar estado"
                    value={entry.status}
                    disabled={busyId === entry.id}
                    onChange={(event) => handleStatus(entry, event.target.value as ListeningStatus)}
                  >
                    {LISTENING_STATUSES.map((value) => (
                      <option key={value} value={value}>{LISTENING_STATUS_LABELS[value]}</option>
                    ))}
                  </select>
                </div>
              </div>
            </article>
          );
        })}
        <Pager total={entries.length} size={PAGE_SIZE} page={safePage} onPage={setPage} noun="mensajes" />
      </div>
    </section>
  );
};
