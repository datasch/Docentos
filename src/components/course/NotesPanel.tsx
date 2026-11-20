import React from 'react';
import { Plus } from 'lucide-react';
import { VideoNote } from '../../types';
import { useTranslation } from 'react-i18next'

interface NotesPanelProps {
  notes: VideoNote[];
  hasAccess: boolean;
  content: string;
  timestamp: string;
  onContentChange: (value: string) => void;
  onTimestampChange: (value: string) => void;
  onSubmit: (event: React.FormEvent) => void;
}

function formatTimestamp(seconds: number): string {
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
}

/**
 * Apuntes del alumno anclados a un minuto del video.
 *
 * En la columna estrecha caben en una sola lista: la rejilla de dos columnas
 * anterior partia frases de cinco palabras por la mitad.
 */
export const NotesPanel: React.FC<NotesPanelProps> = ({
  notes,
  hasAccess,
  content,
  timestamp,
  onContentChange,
  onTimestampChange,
  onSubmit,
}) => {
  const { t } = useTranslation()
  if (!hasAccess) {
    return (
      <p className="px-4 py-6 text-meta leading-relaxed text-ink-muted">
        {t('lasNotasSeGuardanConTuAccesoAlCurso', 'Las notas se guardan con tu acceso al curso.')}
      </p>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {notes.length === 0 ? (
          <p className="px-1 py-4 text-meta leading-relaxed text-ink-muted">
            {t('aunNoHayApuntesDeEstaClaseAnotaElMinutoY', 'Aún no hay apuntes de esta clase. Anota el minuto y lo que quieras recordar.')}
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {notes.map((note) => (
              <li key={note.id} className="rounded-xl bg-raised p-3">
                <div className="flex items-baseline gap-2.5">
                  <span className="shrink-0 text-micro font-semibold text-ink-muted tabular-nums">
                    {formatTimestamp(note.timestampSeconds)}
                  </span>
                  <p className="min-w-0 flex-1 text-row leading-relaxed text-ink-soft">{note.content}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <form onSubmit={onSubmit} className="shrink-0 space-y-3 border-t border-line p-4">
        <div>
          <label htmlFor="lesson-note" className="text-sm font-medium text-ink">
            {t('tuNota', 'Tu nota')}
          </label>
          <textarea
            id="lesson-note"
            rows={3}
            placeholder={t('viewer.notePlaceholder', 'Escribe lo que quieras recordar de este momento de la clase')}
            value={content}
            onChange={(event) => onContentChange(event.target.value)}
            className="mt-1.5 w-full resize-none rounded-lg border border-line bg-canvas px-3 py-2 text-sm leading-relaxed text-ink placeholder-ink-faint focus:border-line-strong focus:outline-none"
          />
        </div>
        <label className="flex items-center justify-between gap-3 text-sm text-ink-soft">
          {t('viewer.noteMinute', 'Minuto del video')}
          <input
            type="text"
            inputMode="numeric"
            value={timestamp}
            onChange={(event) => onTimestampChange(event.target.value)}
            placeholder="01:30"
            className="w-24 rounded-lg border border-line bg-canvas px-2.5 py-2 text-center text-sm tabular-nums text-ink focus:border-line-strong focus:outline-none"
          />
        </label>
        <button
          type="submit"
          disabled={!content.trim()}
          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-line text-sm font-medium text-ink transition-colors hover:bg-ink/5 disabled:cursor-not-allowed disabled:text-ink-faint disabled:hover:bg-transparent"
        >
          <Plus aria-hidden className="h-4 w-4 shrink-0" />
          {t('viewer.noteSave', 'Guardar nota')}
        </button>
      </form>
    </div>
  );
};
