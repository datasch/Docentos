/**
 * Panel del Buzón de Escucha para administración.
 *
 * Pensado para quien analiza: arriba las cifras (NPS, ánimo medio, volumen,
 * tiempo de respuesta), en medio dónde duele y dónde gusta (por tema, tipo y
 * curso, con la tendencia semanal) y abajo los mensajes para leerlos y
 * responderlos. Todo sale de números —la carita es un 1-5, el NPS un 0-10— y se
 * exporta a CSV con los mismos filtros.
 */

import { useToastMessage } from '../lib/useToastMessage';
import { AdminSelect } from './AdminSelect';
import React, { useCallback, useEffect, useState } from 'react';
import { PageLoader } from './loading/PageLoader';
import { createPortal } from 'react-dom';
import { Download, Inbox, Loader2, Send, UserX } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import i18next from 'i18next';
import { ActiveFilters, FilterMenu, Pager } from './AdminListKit';
import { dateLocale } from '../i18n/format';
import { api } from '../lib/api';
import { timeAgo } from '../lib/timeAgo';
import { LISTENING_STATUSES, LISTENING_TOPICS, LISTENING_TYPES, type ListeningStatus } from '../lib/listening';
import { LISTENING_STATUS_LABELS, LISTENING_TOPIC_LABELS, LISTENING_TYPE_LABELS, MOODS } from '../lib/listeningLabels';
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
const periodLabel = (days: number, fallback: string) => i18next.t(`listenPeriod_${days}`, fallback);

const PAGE_SIZE = 10;

function moodFace(avg: number | null) {
  if (avg === null) return null;
  return MOODS[Math.min(5, Math.max(1, Math.round(avg))) - 1];
}

function npsVerdict(score: number | null): { label: string; tone: string } {
  if (score === null) return { label: i18next.t('sinRespuestasTodavia', 'Sin respuestas todavía'), tone: 'text-ink-muted' };
  if (score >= 50) return { label: i18next.t('excelente', 'Excelente'), tone: 'text-success-light' };
  if (score >= 30) return { label: i18next.t('bueno', 'Bueno'), tone: 'text-success-light' };
  if (score >= 0) return { label: i18next.t('porMejorar', 'Por mejorar'), tone: 'text-warning-light' };
  return { label: i18next.t('critico', 'Crítico'), tone: 'text-danger-light' };
}

function npsGroupLabel(group: string | null | undefined): string {
  if (group === 'PROMOTER') return i18next.t('promotor', 'Promotor');
  if (group === 'PASSIVE') return i18next.t('pasivo', 'Pasivo');
  return i18next.t('detractor', 'Detractor');
}

function moodTone(avg: number | null): string {
  if (avg === null) return 'text-ink-muted';
  if (avg >= 4) return 'text-success-light';
  if (avg >= 3) return 'text-warning-light';
  return 'text-danger-light';
}

function formatHours(hours: number | null): string {
  if (hours === null) return '—';
  if (hours < 1) return i18next.t('valMin', '{{val}} min', { val: Math.round(hours * 60) });
  if (hours < 48) return `${hours.toFixed(1)} h`;
  return i18next.t('valDias', '{{val}} días', { val: (hours / 24).toFixed(1) });
}

const Card: React.FC<{ title: string; children: React.ReactNode; wide?: boolean }> = ({ title, children, wide }) => (
  <section className={wide ? 'admin-listening__card admin-listening__card--wide' : 'admin-listening__card'}>
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

export const ListeningAdminPanel: React.FC<{ actionsSlot?: HTMLElement | null }> = ({ actionsSlot = null }) => {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<ListeningAdminFilter>({ days: 90, status: '', type: '', topic: '', courseId: '', mood: '' });
  const [data, setData] = useState<ListeningAdminResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useToastMessage(error, 'error');
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await api.getListeningAdmin(filter));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : t('noSePudoCargarElBuzon', 'No se pudo cargar el buzón'));
    } finally {
      setLoading(false);
    }
  }, [filter, t]);

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
      setError(replyError instanceof Error ? replyError.message : t('noSePudoResponder', 'No se pudo responder'));
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
      setError(statusError instanceof Error ? statusError.message : t('noSePudoCambiarElEstado', 'No se pudo cambiar el estado'));
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

  const exportButton = (
    <button
      type="button"
      className="mentor-course-control admin-primary-action"
      onClick={() => api.downloadListeningCsv(filter).catch((exportError: Error) => setError(exportError.message))}
    >
      <Download aria-hidden="true" />
      {t('exportarCsv', 'Exportar CSV')}
    </button>
  );

  return (
    <section data-mentor-ui="modern" className="admin-courses-root admin-listening" aria-label={t('buzonDeEscuchaTitulo', 'Buzón de escucha')}>
      <div className="admin-listening__intro">
        <div>
          <h3>{t('buzonDeEscuchaTitulo', 'Buzón de escucha')}</h3>
          <p>{t('loQueSientenYPidenTusEstudiantesEnCifras', 'Lo que sienten y piden tus estudiantes, en cifras. El NPS cuenta a cada persona una vez: su nota más reciente del periodo.')}</p>
        </div>
        {actionsSlot ? createPortal(exportButton, actionsSlot) : exportButton}
      </div>

      <div className="mentor-course-toolbar admin-listening__toolbar">
        <div className="mentor-publication-filters admin-view-toggle" role="group" aria-label={t('periodo', 'Periodo')}>
          {PERIODS.map((period) => (
            <button key={period.days} type="button" aria-pressed={filter.days === period.days} onClick={() => change({ days: period.days })}>
              {periodLabel(period.days, period.label)}
            </button>
          ))}
        </div>
        <FilterMenu
          groups={[
            { label: t('estado', 'Estado'), value: orAll(filter.status), onChange: (value) => change({ status: fromAll(value) as ListeningAdminFilter['status'] }), options: LISTENING_STATUSES.map((value) => ({ value, label: LISTENING_STATUS_LABELS[value] })) },
            { label: t('tipo', 'Tipo'), value: orAll(filter.type), onChange: (value) => change({ type: fromAll(value) as ListeningAdminFilter['type'] }), options: LISTENING_TYPES.map((value) => ({ value, label: LISTENING_TYPE_LABELS[value] })) },
            { label: t('tema', 'Tema'), value: orAll(filter.topic), onChange: (value) => change({ topic: fromAll(value) as ListeningAdminFilter['topic'] }), options: LISTENING_TOPICS.map((value) => ({ value, label: LISTENING_TOPIC_LABELS[value] })) },
            { label: t('animo', 'Ánimo'), value: orAll(filter.mood), onChange: (value) => change({ mood: value === 'ALL' ? '' : Number(value) }), options: MOODS.map((mood) => ({ value: String(mood.value), label: `${mood.emoji} ${mood.value} · ${mood.label}` })) },
          ]}
        />
        <AdminSelect
          ariaLabel={t('curso', 'Curso')}
          value={orAll(filter.courseId)}
          onChange={(value) => change({ courseId: fromAll(value) })}
          options={[{ value: 'ALL', label: t('todosLosCursos', 'Todos los cursos') }, ...(data?.courses ?? []).map((course) => ({ value: course.id, label: course.title }))]}
        />
      </div>
      <ActiveFilters noun="mensajes" onClear={() => change({ courseId: '', type: '', topic: '', status: '', mood: '' })} chips={chips} />

      {loading && !data && <PageLoader label={t('cargandoElBuzon', 'Cargando el buzón…')} />}

      {summary && (
        <>
          <div className="admin-listening__stats">
            <Card title={t('nps', 'NPS')}>
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
                {t('listenNpsSplit', '{{promoters}} promotores · {{passives}} pasivos · {{detractors}} detractores', { promoters: summary.nps.promoters, passives: summary.nps.passives, detractors: summary.nps.detractors })}
                <br />
                {t('countPersonasRespondieronEscalaDe100A100', { defaultValue_one: '{{count}} persona respondió (escala de −100 a 100)', defaultValue_other: '{{count}} personas respondieron (escala de −100 a 100)', count: npsTotal })}
              </p>
            </Card>

            <Card title={t('listenAvgMood15', 'Ánimo medio (1 a 5)')}>
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
                {t('positivePositivosNeutralNeutrosNegative', '{{positive}} positivos · {{neutral}} neutros · {{negative}} negativos', { positive: summary.sentiment.positive, neutral: summary.sentiment.neutral, negative: summary.sentiment.negative })}
              </p>
            </Card>

            <Card title={t('mensajes', 'Mensajes')}>
              <p className="admin-listening__figure"><strong>{summary.total}</strong></p>
              <p className="admin-listening__note">
                <Inbox aria-hidden="true" />
                <span className={summary.pending > 0 ? 'text-warning-light' : ''}>{t('pendingPorResponder', '{{pending}} por responder', { pending: summary.pending })}</span> {t('answeredAtendidos', '· {{answered}} atendidos', { answered: summary.answered })}
              </p>
            </Card>

            <Card title={t('tiempoMedioDeRespuesta', 'Tiempo medio de respuesta')}>
              <p className="admin-listening__figure"><strong>{formatHours(summary.avgResponseHours)}</strong></p>
              <p className="admin-listening__note">{t('desdeQueLlegaElMensajeHastaLaPrimera', 'Desde que llega el mensaje hasta la primera respuesta del equipo.')}</p>
            </Card>
          </div>

          <div className="admin-listening__panels">
            <Card title={t('comoSeSienten', 'Cómo se sienten')}>
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
              <Card title={t('listenBreakdown', 'Desglose')}>
                <p className="admin-listening__note">{t('listenNoBreakdown', 'Todavía no hay mensajes con tema, tipo o curso para desglosar.')}</p>
              </Card>
            ) : (
              <>
                <Card title={t('porTema', 'Por tema')}>
                  {summary.byTopic.length === 0 ? <p className="admin-listening__note">{t('sinDatos', 'Sin datos.')}</p> : (
                    <ul className="admin-listening__bars">
                      {summary.byTopic.map((item) => <BarRow key={item.key} label={item.label} count={item.count} max={summary.byTopic[0].count} avgMood={item.avgMood} />)}
                    </ul>
                  )}
                </Card>
                <Card title={t('porTipoDeMensaje', 'Por tipo de mensaje')}>
                  {summary.byType.length === 0 ? <p className="admin-listening__note">{t('sinDatos', 'Sin datos.')}</p> : (
                    <ul className="admin-listening__bars">
                      {summary.byType.map((item) => <BarRow key={item.key} label={item.label} count={item.count} max={summary.byType[0].count} avgMood={item.avgMood} />)}
                    </ul>
                  )}
                </Card>
                <Card wide title={t('porCurso', 'Por curso')}>
                  {summary.byCourse.length === 0 ? <p className="admin-listening__note">{t('todaviaNadieHaRelacionadoUnMensajeConUn', 'Todavía nadie ha relacionado un mensaje con un curso.')}</p> : (
                    <ul className="admin-listening__bars">
                      {summary.byCourse.slice(0, 8).map((item) => (
                        <BarRow key={item.courseId} label={item.title} count={item.count} max={summary.byCourse[0].count} avgMood={item.avgMood} extra={item.nps === null ? '' : t('npsNps', '· NPS {{nps}}', { nps: item.nps })} />
                      ))}
                    </ul>
                  )}
                </Card>
              </>
            )}

            <Card title={t('tendenciaSemanal', 'Tendencia semanal')}>
              {summary.weekly.length === 0 ? <p className="admin-listening__note">{t('sinDatos', 'Sin datos.')}</p> : (
                <>
                  <div className="admin-listening__weekly" role="img" aria-label={t('mensajesPorSemanaColoreadosPorAnimoMedio', 'Mensajes por semana, coloreados por ánimo medio')}>
                    {summary.weekly.slice(-16).map((week) => (
                      <div key={week.weekStart} title={t('semanaDelWeekStartCountMensajesAnimoAvg', 'Semana del {{weekStart}}: {{count}} mensajes · ánimo {{avgMood}} · NPS {{nps}}', { weekStart: week.weekStart, count: week.count, avgMood: week.avgMood ?? '—', nps: week.nps ?? '—' })}>
                        <div style={{ height: `${Math.max(6, (week.count / maxWeek) * 100)}%`, background: (week.avgMood ?? 0) >= 4 ? 'var(--color-success-light)' : (week.avgMood ?? 0) >= 3 ? 'var(--color-warning-light)' : 'var(--color-danger-light)' }} />
                      </div>
                    ))}
                  </div>
                  <p className="admin-listening__note">{t('alturaMensajesColorAnimoMedioDeLaSemana', 'Altura: mensajes. Color: ánimo medio de la semana.')}</p>
                </>
              )}
            </Card>
          </div>
        </>
      )}

      <div className="admin-listening__messages" role="region" aria-label={t('mensajesRecibidos', 'Mensajes recibidos')}>
        <h3>{t('mensajes', 'Mensajes')} <span>{entries.length}</span></h3>

        {data && entries.length === 0 && (
          <div className="admin-listening__empty"><Inbox aria-hidden="true" /><p>{chips.length > 0 ? t('listenNoMatch', 'Ningún mensaje coincide con los filtros.') : t('listenNoneInPeriod', 'Todavía no hay mensajes en este periodo.')}</p></div>
        )}

        {visible.map((entry) => {
          const face = MOODS.find((item) => item.value === entry.mood);
          const name = entry.anonymous ? t('anonimo', 'Anónimo') : entry.author?.name || t('usuarioSinDatos', 'Usuario sin datos');
          const draft = drafts[entry.id] || '';
          return (
            <article key={entry.id} className="admin-listening__entry" data-status={entry.status}>
              <header className="admin-listening__head">
                <span className="admin-listening__avatar" aria-hidden="true">{entry.anonymous ? <UserX /> : name.charAt(0).toUpperCase()}</span>
                <div className="admin-listening__who">
                  <strong>{name}</strong>
                  <span>
                    {!entry.anonymous && entry.author?.email ? `${entry.author.email} · ` : ''}
                    <time dateTime={entry.createdAt} title={new Date(entry.createdAt).toLocaleString(dateLocale())}>{timeAgo(entry.createdAt)}</time>
                  </span>
                </div>
                <span className="admin-listening__status" data-status={entry.status}>{LISTENING_STATUS_LABELS[entry.status]}</span>
                <div className="admin-listening__nps-badge" data-group={entry.npsGroup ?? 'NONE'} title={t('npsDeEstaPersona', 'NPS de esta persona (0 a 10)')}>
                  <strong>{entry.npsScore ?? '—'}</strong>
                  <span>{entry.npsScore === null ? t('sinNps', 'Sin NPS') : `NPS · ${npsGroupLabel(entry.npsGroup)}`}</span>
                </div>
              </header>

              <h4>{entry.subject}</h4>
              <p className="admin-listening__message">{entry.message}</p>

              <p className="admin-listening__meta">
                <span title={face?.label}><span aria-hidden="true">{face?.emoji}</span> {entry.mood}/5</span>
                <span>{LISTENING_TYPE_LABELS[entry.type]}</span>
                <span>{LISTENING_TOPIC_LABELS[entry.topic]}</span>
                {entry.courseTitle && <span>{entry.courseTitle}</span>}
              </p>

              {entry.reply && (
                <blockquote className="admin-listening__reply">
                  <cite>
                    {entry.repliedBy || t('equipo', 'Equipo')}
                    {entry.repliedAt && <> · <time dateTime={entry.repliedAt} title={new Date(entry.repliedAt).toLocaleString(dateLocale())}>{timeAgo(entry.repliedAt)}</time></>}
                  </cite>
                  <p>{entry.reply}</p>
                </blockquote>
              )}

              <form className="admin-listening__compose" onSubmit={(event) => { event.preventDefault(); void handleReply(entry); }}>
                <textarea
                  aria-label={t('respuestaASubject', 'Respuesta a: {{subject}}', { subject: entry.subject })}
                  rows={1}
                  maxLength={2000}
                  value={draft}
                  onChange={(event) => {
                    // Empezar a escribir es lo que pasa el mensaje a «En revisión».
                    if (entry.status === 'NEW' && !draft && event.target.value) void handleStatus(entry, 'IN_REVIEW');
                    setDrafts((current) => ({ ...current, [entry.id]: event.target.value }));
                  }}
                  onKeyDown={(event) => { if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) { event.preventDefault(); void handleReply(entry); } }}
                  placeholder={entry.reply ? t('escribeUnaNuevaRespuesta', 'Escribe una nueva respuesta...') : t('respondeAEstaPersona', 'Responde a esta persona...')}
                />
                <button type="submit" disabled={busyId === entry.id || !draft.trim()}>
                  {busyId === entry.id ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Send aria-hidden="true" />}
                  {t('enviar', 'Enviar')}
                </button>
              </form>
            </article>
          );
        })}
        <Pager total={entries.length} size={PAGE_SIZE} page={safePage} onPage={setPage} noun="mensajes" />
      </div>
    </section>
  );
};
