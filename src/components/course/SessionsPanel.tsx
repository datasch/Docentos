import React from 'react';
import { ExternalLink, Play, Video } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { dateLocale } from '../../i18n/format';
import type { Course, Meeting } from '../../types';

interface SessionsPanelProps {
  course: Course;
  meetings: Meeting[];
  playingId?: string | null;
  onPlayRecording: (meeting: Meeting) => void;
}

/** Los títulos escritos a mano a veces empiezan con un emoji o con «Módulo 1:»; en la lista sobran. */
const cleanTitle = (title: string) => title.replace(/^[^\p{L}\p{N}¿¡]+/u, '').trim();
const cleanModule = (title: string) => title.replace(/^m[oó]dulo\s*\d+\s*[:.\-–]\s*/i, '').trim();

/**
 * Clases en vivo y grabaciones, agrupadas por módulo: una fila por sesión con su estado y una sola acción.
 */
export const SessionsPanel: React.FC<SessionsPanelProps> = ({ course, meetings, playingId, onPlayRecording }) => {
  const { t } = useTranslation();

  if (meetings.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
        <Video aria-hidden className="h-8 w-8 text-ink-faint" />
        <p className="max-w-[16rem] text-sm leading-relaxed text-ink-muted">
          {t('viewer.noSessionsScheduled', 'Todavía no hay clases programadas. Cuando tu mentor las agende, aparecerán aquí.')}
        </p>
      </div>
    );
  }

  const modules = course.modules || [];
  const groups = [
    ...modules
      .map((module, index) => ({
        key: module.id,
        title: t('viewer.sessionsModule', 'Módulo {{number}} · {{title}}', { number: index + 1, title: cleanModule(module.title) }),
        items: meetings.filter((meeting) => meeting.moduleId === module.id),
      }))
      .filter((group) => group.items.length > 0),
    {
      key: 'general',
      title: t('viewer.sessionsGeneral', 'Todo el curso'),
      items: meetings.filter((meeting) => !meeting.moduleId || !modules.some((module) => module.id === meeting.moduleId)),
    },
  ].filter((group) => group.items.length > 0);

  const kindLabel = (meeting: Meeting) =>
    meeting.meetingType === 'async_record'
      ? t('viewer.sessionRecording', 'Grabación')
      : meeting.meetingType === 'jitsi'
        ? 'Jitsi'
        : meeting.meetingType === 'meet'
          ? 'Google Meet'
          : t('viewer.sessionVideo', 'Video');

  return (
    <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-4">
      {groups.map((group) => (
        <section key={group.key} aria-label={group.title}>
          <h3 className="mb-1 px-1 text-xs text-ink-muted">{group.title}</h3>
          <ul className="divide-y divide-line border-y border-line">
            {group.items.map((meeting) => {
              const isAsync = meeting.meetingType === 'async_record';
              const isPlaying = playingId === meeting.id;
              const when = new Date(meeting.scheduledAt).toLocaleDateString(dateLocale(), {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              });
              const actionClass = 'flex min-h-11 w-full items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium transition-colors';
              return (
                <li key={meeting.id} className={`space-y-3 px-1 py-4 ${isPlaying ? 'bg-ink/5' : ''}`}>
                  <div>
                    <p className="text-sm font-medium leading-snug text-ink [overflow-wrap:anywhere]">{cleanTitle(meeting.title)}</p>
                    <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-xs text-ink-muted">
                      {meeting.isLive ? (
                        <span className="inline-flex items-center gap-1.5 font-medium text-danger-light">
                          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-danger-light" />
                          {t('viewer.liveNow', 'En vivo ahora')}
                        </span>
                      ) : (
                        <span className="tabular-nums">{when}</span>
                      )}
                      <span aria-hidden>·</span>
                      <span>{kindLabel(meeting)}</span>
                    </p>
                  </div>

                  {isAsync ? (
                    <button
                      type="button"
                      onClick={() => onPlayRecording(meeting)}
                      disabled={isPlaying}
                      className={`${actionClass} cursor-pointer border border-line text-ink hover:bg-ink/5 disabled:cursor-default disabled:opacity-60`}
                    >
                      <Play aria-hidden className="h-4 w-4 shrink-0 fill-current" />
                      {isPlaying ? t('viewer.playing', 'Reproduciendo') : t('viewer.watch', 'Ver grabación')}
                    </button>
                  ) : (
                    <a
                      href={meeting.meetingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`${actionClass} ${meeting.isLive ? 'bg-brand-cyan text-on-brand hover:opacity-90' : 'border border-line text-ink hover:bg-ink/5'}`}
                    >
                      <ExternalLink aria-hidden className="h-4 w-4 shrink-0" />
                      {meeting.isLive ? t('viewer.join', 'Unirme ahora') : t('viewer.openRoom', 'Abrir sala')}
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
};
