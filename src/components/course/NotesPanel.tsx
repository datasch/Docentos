import React from 'react';
import { Clock, Plus } from 'lucide-react';
import { VideoNote } from '../../types';

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
  if (!hasAccess) {
    return (
      <p className="px-4 py-6 text-meta leading-relaxed text-ink-muted">
        Las notas se guardan con tu acceso al curso.
      </p>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {notes.length === 0 ? (
          <p className="px-1 py-4 text-meta leading-relaxed text-ink-muted">
            Aún no hay apuntes de esta clase. Anota el minuto y lo que quieras recordar.
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {notes.map((note) => (
              <li key={note.id} className="rounded-xl bg-raised p-3">
                <div className="flex items-baseline gap-2.5">
                  <span className="shrink-0 text-micro font-semibold text-brand-violet-light tabular-nums">
                    {formatTimestamp(note.timestampSeconds)}
                  </span>
                  <p className="min-w-0 flex-1 text-row leading-relaxed text-ink-soft">{note.content}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <form onSubmit={onSubmit} className="shrink-0 border-t border-line p-3">
        <div className="flex items-center gap-2">
          <label className="flex shrink-0 items-center gap-1.5 rounded-lg border border-line bg-canvas px-2.5 py-2 focus-within:border-brand-cyan">
            <Clock aria-hidden className="h-3.5 w-3.5 text-ink-muted" />
            <span className="sr-only">Minuto de la nota</span>
            <input
              type="text"
              value={timestamp}
              onChange={(event) => onTimestampChange(event.target.value)}
              placeholder="01:30"
              className="w-11 bg-transparent text-meta text-ink tabular-nums focus:outline-none"
            />
          </label>

          <input
            type="text"
            placeholder="Qué quieres recordar de este minuto"
            aria-label="Contenido de la nota"
            value={content}
            onChange={(event) => onContentChange(event.target.value)}
            className="min-w-0 flex-1 rounded-lg border border-line bg-canvas px-3 py-2 text-meta text-ink placeholder-ink-faint focus:border-brand-cyan focus:outline-none"
          />

          <button
            type="submit"
            disabled={!content.trim()}
            className="shrink-0 rounded-lg bg-raised p-2 text-ink transition-colors hover:bg-line disabled:cursor-not-allowed disabled:text-ink-faint disabled:hover:bg-raised"
          >
            <Plus aria-hidden className="h-4 w-4" />
            <span className="sr-only">Guardar nota</span>
          </button>
        </div>
      </form>
    </div>
  );
};
