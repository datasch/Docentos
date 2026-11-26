import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronRight, Download, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { dateLocale } from '../i18n/format';
import { api } from '../lib/api';
import type { CourseNpsStage, CourseNpsStudentResponse, CourseNpsSummaryResponse } from '../lib/courseNps';
import { npsVerdict } from '../lib/listeningLabels';
import { timeAgo } from '../lib/timeAgo';
import { useBodyScrollLock } from '../lib/useBodyScrollLock';
import { AdminSearchField } from './AdminListKit';
import { AdminSelect } from './AdminSelect';
import { RouteSkeleton } from './loading/RouteSkeleton';

interface CourseNpsAnalyticsSectionProps {
  days?: number;
  courseId?: string;
  showControls?: boolean;
  actionsSlot?: HTMLElement | null;
}

const PERIODS = [
  { days: 30, label: '30 días' },
  { days: 90, label: '90 días' },
  { days: 365, label: '12 meses' },
  { days: 0, label: 'Todo' },
];

export const CourseNpsAnalyticsSection: React.FC<CourseNpsAnalyticsSectionProps> = ({
  days: controlledDays,
  courseId: controlledCourseId,
  showControls = false,
  actionsSlot = null,
}) => {
  const { t } = useTranslation();
  const [localDays, setLocalDays] = useState(90);
  const [localCourseId, setLocalCourseId] = useState('');
  const [localUserId, setLocalUserId] = useState('');
  const [studentQuery, setStudentQuery] = useState('');
  const [sheetUserId, setSheetUserId] = useState<string | null>(null);
  const sheetDlg = useRef<HTMLDialogElement>(null);
  const [data, setData] = useState<CourseNpsSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const activeDays = controlledDays !== undefined ? controlledDays : localDays;
  const activeCourseId = controlledCourseId !== undefined ? controlledCourseId : localCourseId;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getCourseNpsAdmin({
        days: activeDays,
        courseId: activeCourseId || undefined,
        userId: localUserId || undefined,
      });
      setData(res);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : t('courseNps.loadError', 'No se pudo cargar el NPS de calidad de cursos'),
      );
    } finally {
      setLoading(false);
    }
  }, [activeDays, activeCourseId, localUserId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const stageLabels: Record<CourseNpsStage, string> = {
    START: t('courseNps.stageStartShort', 'Inicio'),
    MID: t('courseNps.stageMidShort', 'Mitad'),
    END: t('courseNps.stageEndShort', 'Final'),
  };

  const summary = data?.summary;
  const overall = summary?.overall;
  const overallVerdict = npsVerdict(overall?.score ?? null);
  const totalOverall = overall?.responses || 0;
  const pct = (value: number, total: number) => (total ? (value / total) * 100 : 0);

  const stageCards: Array<{ stage: CourseNpsStage; label: string }> = [
    { stage: 'START', label: t('courseNps.cardStart', 'NPS al inicio') },
    { stage: 'MID', label: t('courseNps.cardMid', 'NPS a la mitad (50%)') },
    { stage: 'END', label: t('courseNps.cardEnd', 'NPS al final (100%)') },
  ];

  const exportButton = (
    <button
      type="button"
      className={actionsSlot ? 'mentor-course-control admin-primary-action' : 'admin-listening__export'}
      onClick={() =>
        api
          .downloadCourseNpsCsv({
            days: activeDays,
            courseId: activeCourseId || undefined,
            userId: localUserId || undefined,
          })
          .catch((exportError: Error) => setError(exportError.message))
      }
    >
      <Download aria-hidden="true" />
      {t('courseNps.exportCsv', 'Exportar NPS cursos')}
    </button>
  );

  const studentGroups = useMemo(() => {
    const q = studentQuery.trim().toLowerCase();
    const responses = (summary?.studentResponses ?? []).filter((entry) => {
      if (!q) return true;
      return [entry.studentName, entry.studentEmail, entry.courseTitle, entry.comment || '']
        .some((field) => field.toLowerCase().includes(q));
    });
    const map = new Map<
      string,
      { userId: string; name: string; email: string; items: CourseNpsStudentResponse[] }
    >();
    for (const item of responses) {
      const group = map.get(item.userId);
      if (group) {
        group.items.push(item);
      } else {
        map.set(item.userId, {
          userId: item.userId,
          name: item.studentName,
          email: item.studentEmail,
          items: [item],
        });
      }
    }
    return [...map.values()];
  }, [summary?.studentResponses, studentQuery]);

  const sheetStudent = sheetUserId ? studentGroups.find((s) => s.userId === sheetUserId) || null : null;
  useBodyScrollLock(Boolean(sheetStudent));

  useEffect(() => {
    const d = sheetDlg.current;
    if (!d) return;
    if (sheetStudent && !d.open) d.showModal();
    if (!sheetStudent && d.open) d.close();
  }, [sheetStudent]);

  return (
    <section
      data-mentor-ui="modern"
      className="admin-listening course-nps-section"
      aria-label={t('courseNps.sectionTitle', 'NPS de calidad de cursos')}
    >
      <div className="admin-listening__intro">
        <div>
          <h3>{t('courseNps.sectionTitle', 'NPS de calidad de cursos')}</h3>
          <p>
            {t(
              'courseNps.sectionDesc',
              'Medición directa dentro de cada curso al inicio, a la mitad (50%) y al completar el 100%.',
            )}
          </p>
        </div>
        {actionsSlot ? createPortal(exportButton, actionsSlot) : exportButton}
      </div>

      {showControls && (
        <div className="mentor-course-toolbar admin-listening__toolbar">
          <div className="mentor-publication-filters admin-view-toggle" role="group" aria-label={t('periodo', 'Periodo')}>
            {PERIODS.map((period) => (
              <button
                key={period.days}
                type="button"
                aria-pressed={activeDays === period.days}
                onClick={() => setLocalDays(period.days)}
              >
                {t(`listenPeriod_${period.days}`, period.label)}
              </button>
            ))}
          </div>
          <AdminSelect
            ariaLabel={t('curso', 'Curso')}
            value={activeCourseId || 'ALL'}
            onChange={(value) => setLocalCourseId(value === 'ALL' ? '' : value)}
            options={[
              { value: 'ALL', label: t('todosLosCursos', 'Todos los cursos') },
              ...(data?.courses ?? []).map((course) => ({ value: course.id, label: course.title })),
            ]}
          />
          <AdminSelect
            ariaLabel={t('courseNps.filterByStudent', 'Alumno')}
            value={localUserId || 'ALL'}
            onChange={(value) => setLocalUserId(value === 'ALL' ? '' : value)}
            options={[
              { value: 'ALL', label: t('courseNps.allStudents', 'Todos los alumnos') },
              ...(data?.students ?? []).map((student) => ({
                value: student.userId,
                label: `${student.name} (${student.responses})`,
              })),
            ]}
          />
          <AdminSearchField
            value={studentQuery}
            onChange={setStudentQuery}
            placeholder={t('courseNps.searchStudentPlaceholder', 'Buscar alumno, curso o comentario')}
            label={t('courseNps.searchStudentLabel', 'Buscar alumno en NPS')}
          />
        </div>
      )}

      {error && (
        <p role="alert" className="admin-listening__error">
          {error}
        </p>
      )}

      {loading && !data && <RouteSkeleton variant="metrics" label={t('courseNps.loading', 'Cargando métricas NPS de cursos…')} />}

      {summary && (
        <>
          <div className="admin-listening__stats">
            <section className="admin-listening__card">
              <h4>{t('courseNps.globalCard', 'NPS global de calidad')}</h4>
              <p className="admin-listening__figure">
                <strong className={overallVerdict.tone}>
                  {overall?.score === null || overall?.score === undefined ? '—' : overall.score}
                </strong>
                <span className={overallVerdict.tone}>{overallVerdict.label}</span>
              </p>
              {totalOverall > 0 && overall && (
                <div className="admin-listening__split" aria-hidden="true">
                  <div style={{ width: `${pct(overall.promoters, totalOverall)}%`, background: 'var(--color-success-light)' }} />
                  <div style={{ width: `${pct(overall.passives, totalOverall)}%`, background: 'var(--color-warning-light)' }} />
                  <div style={{ width: `${pct(overall.detractors, totalOverall)}%`, background: 'var(--color-danger-light)' }} />
                </div>
              )}
              <p className="admin-listening__note">
                {t('listenNpsSplit', '{{promoters}} promotores · {{passives}} pasivos · {{detractors}} detractores', {
                  promoters: overall?.promoters ?? 0,
                  passives: overall?.passives ?? 0,
                  detractors: overall?.detractors ?? 0,
                })}
              </p>
              <p className="admin-listening__note">
                {t('courseNps.totalResponsesCount', {
                  defaultValue_one: '{{count}} encuesta respondida en total',
                  defaultValue_other: '{{count}} encuestas respondidas en total',
                  count: summary.totalResponses,
                })}
              </p>
            </section>

            {stageCards.map(({ stage, label }) => {
              const stageResult = summary.byStage[stage];
              const stageVerdict = npsVerdict(stageResult.score);
              const total = stageResult.responses;
              return (
                <section key={stage} className="admin-listening__card">
                  <h4>{label}</h4>
                  <p className="admin-listening__figure">
                    <strong className={stageVerdict.tone}>
                      {stageResult.score === null ? '—' : stageResult.score}
                    </strong>
                    <span className={stageVerdict.tone}>{stageVerdict.label}</span>
                  </p>
                  {total > 0 && (
                    <div className="admin-listening__split" aria-hidden="true">
                      <div style={{ width: `${pct(stageResult.promoters, total)}%`, background: 'var(--color-success-light)' }} />
                      <div style={{ width: `${pct(stageResult.passives, total)}%`, background: 'var(--color-warning-light)' }} />
                      <div style={{ width: `${pct(stageResult.detractors, total)}%`, background: 'var(--color-danger-light)' }} />
                    </div>
                  )}
                  <p className="admin-listening__note">
                    {t('courseNps.stageResponsesCount', {
                      defaultValue_one: '{{count}} respuesta',
                      defaultValue_other: '{{count}} respuestas',
                      count: total,
                    })}
                  </p>
                </section>
              );
            })}
          </div>

          <section className="admin-listening__card">
            <h4>{t('courseNps.byCourseHeading', 'Desglose por curso (Inicio · Mitad · Final)')}</h4>
            {summary.byCourse.length === 0 ? (
              <p className="admin-listening__note">
                {t('courseNps.noCourseData', 'Todavía no hay encuestas NPS respondidas en los cursos para este periodo.')}
              </p>
            ) : (
              <div className="course-nps-table-wrap">
                <table className="course-nps-table">
                  <thead>
                    <tr>
                      <th>{t('curso', 'Curso')}</th>
                      <th>{t('courseNps.colGlobal', 'Global')}</th>
                      <th>{stageLabels.START}</th>
                      <th>{stageLabels.MID}</th>
                      <th>{stageLabels.END}</th>
                      <th>{t('courseNps.colDelta', 'Δ Inicio → Final')}</th>
                      <th>{t('courseNps.colResponses', 'Respuestas')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.byCourse.map((item) => {
                      const delta = item.deltaStartToEnd;
                      const deltaText = delta === null ? '—' : delta > 0 ? `+${delta}` : String(delta);
                      const deltaClass =
                        delta === null
                          ? 'text-ink-muted'
                          : delta > 0
                            ? 'text-success-light'
                            : delta < 0
                              ? 'text-danger-light'
                              : 'text-ink-soft';
                      return (
                        <tr key={item.courseId}>
                          <td className="course-nps-table__title">{item.title}</td>
                          <td className={npsVerdict(item.overall.score).tone}>
                            <strong>{item.overall.score ?? '—'}</strong>
                          </td>
                          <td className={npsVerdict(item.stages.START.score).tone}>
                            {item.stages.START.score ?? '—'}
                            {item.stages.START.responses > 0 && <small> ({item.stages.START.responses})</small>}
                          </td>
                          <td className={npsVerdict(item.stages.MID.score).tone}>
                            {item.stages.MID.score ?? '—'}
                            {item.stages.MID.responses > 0 && <small> ({item.stages.MID.responses})</small>}
                          </td>
                          <td className={npsVerdict(item.stages.END.score).tone}>
                            {item.stages.END.score ?? '—'}
                            {item.stages.END.responses > 0 && <small> ({item.stages.END.responses})</small>}
                          </td>
                          <td className={deltaClass}>{deltaText}</td>
                          <td className="text-ink-muted">{item.overall.responses}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="admin-listening__card">
            <h4>{t('courseNps.studentBreakdownHeading', 'Calificaciones y comentarios por alumno')}</h4>
            {studentGroups.length === 0 ? (
              <p className="admin-listening__note">
                {t('courseNps.noStudentResponses', 'No hay calificaciones de alumnos que coincidan con el filtro actual.')}
              </p>
            ) : (
              <ul className="admin-listening__student-grid">
                {studentGroups.map((student) => {
                  const latest = student.items[0];
                  const isSelected = sheetUserId === student.userId;
                  return (
                    <li key={student.userId} className="admin-listening__student-card">
                      <button
                        type="button"
                        className="admin-listening__student-card-btn"
                        aria-expanded={isSelected}
                        aria-haspopup="dialog"
                        onClick={() => setSheetUserId(student.userId)}
                      >
                        <div className="admin-listening__head">
                          <span className="admin-listening__avatar" aria-hidden="true">{student.name.charAt(0).toUpperCase()}</span>
                          <div className="admin-listening__who">
                            <strong>{student.name}</strong>
                            <span>{student.email || (latest ? timeAgo(latest.createdAt) : '')}</span>
                          </div>
                        </div>
                        <div className="admin-listening__student-card-foot">
                          <span className="admin-listening__badge">
                            {t('courseNps.studentCount', {
                              defaultValue_one: '{{count}} calificación',
                              defaultValue_other: '{{count}} calificaciones',
                              count: student.items.length,
                            })}
                          </span>
                          {latest && (
                            <span className="admin-listening__badge">
                              <span className="admin-listening__nps" data-group={latest.npsGroup}>
                                {t('npsNpsScore', 'NPS {{npsScore}}', { npsScore: latest.npsScore })}
                              </span>
                            </span>
                          )}
                          <ChevronRight className="h-4 w-4 text-ink-muted" aria-hidden="true" />
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <dialog
            ref={sheetDlg}
            className="mentee-sheet admin-cert-sheet admin-listening-sheet"
            aria-labelledby="course-nps-sheet-title"
            onCancel={(e) => { e.preventDefault(); setSheetUserId(null); }}
            onClick={(e) => { if (e.target === e.currentTarget) setSheetUserId(null); }}
          >
            {sheetStudent && (
              <div className="mentee-sheet__body admin-cert-sheet__body">
                <header className="mentee-sheet__head">
                  <span className="admin-listening__avatar" aria-hidden="true">{sheetStudent.name.charAt(0).toUpperCase()}</span>
                  <div className="mentor-mentee-id">
                    <strong id="course-nps-sheet-title">{sheetStudent.name}</strong>
                    {sheetStudent.email && <span title={sheetStudent.email}>{sheetStudent.email}</span>}
                  </div>
                  <button type="button" onClick={() => setSheetUserId(null)} className="mentee-sheet__close" aria-label={t('cerrar', 'Cerrar')}>
                    <X aria-hidden="true" />
                  </button>
                </header>
                <div className="admin-cert-sheet__summary">
                  <span className="admin-listening__badge">
                    {t('courseNps.studentCount', {
                      defaultValue_one: '{{count}} calificación',
                      defaultValue_other: '{{count}} calificaciones',
                      count: sheetStudent.items.length,
                    })}
                  </span>
                </div>
                <div className="admin-cert-sheet__scroll">
                  <ul className="course-nps-comments">
                    {sheetStudent.items.map((entry) => (
                      <li key={entry.id} className="course-nps-comment">
                        <div className="course-nps-comment__head">
                          <span className="course-nps-comment__stage">{stageLabels[entry.stage]}</span>
                          <strong>{entry.courseTitle}</strong>
                          <span className="admin-listening__nps" data-group={entry.npsGroup}>
                            {t('npsNpsScore', 'NPS {{npsScore}}', { npsScore: entry.npsScore })}
                          </span>
                        </div>
                        {entry.comment ? (
                          <p>{entry.comment}</p>
                        ) : (
                          <p className="course-nps-comment__empty">
                            {t('courseNps.noCommentLeft', 'Sin comentario adicional.')}
                          </p>
                        )}
                        <div className="course-nps-comment__meta">
                          <span>{stageLabels[entry.stage]}</span>
                          <time dateTime={entry.createdAt} title={new Date(entry.createdAt).toLocaleString(dateLocale())}>
                            {timeAgo(entry.createdAt)}
                          </time>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </dialog>
        </>
      )}
    </section>
  );
};
