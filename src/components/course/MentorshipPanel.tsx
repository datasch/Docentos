import React from 'react';
import { Send, ShieldCheck, ThumbsUp } from 'lucide-react';
import { DEFAULT_AVATAR } from '../../lib/avatar.js';
import { MentorshipComment, User } from '../../types';
import { useTranslation } from 'react-i18next'

interface MentorshipPanelProps {
  comments: MentorshipComment[];
  currentUser: User;
  hasAccess: boolean;
  filterMentorOnly: boolean;
  onToggleFilter: () => void;
  question: string;
  onQuestionChange: (value: string) => void;
  onPostQuestion: (event: React.FormEvent) => void;
  replyTextMap: Record<string, string>;
  onReplyTextChange: (commentId: string, value: string) => void;
  replyingToId: string | null;
  onStartReply: (commentId: string | null) => void;
  onPostReply: (commentId: string) => void;
  onLike: (commentId: string) => void;
}

const AVATAR_FALLBACK = DEFAULT_AVATAR;

/** Consultas de la clase y respuestas del mentor, en la columna lateral. */
export const MentorshipPanel: React.FC<MentorshipPanelProps> = ({
  comments,
  currentUser,
  hasAccess,
  filterMentorOnly,
  onToggleFilter,
  question,
  onQuestionChange,
  onPostQuestion,
  replyTextMap,
  onReplyTextChange,
  replyingToId,
  onStartReply,
  onPostReply,
  onLike,
}) => {
  const { t } = useTranslation()
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center justify-between border-b border-line px-4 py-2.5">
        <span className="text-meta text-ink-muted tabular-nums">
          {t('countConsultas', { defaultValue_one: '1 consulta', defaultValue_other: '{{count}} consultas', count: comments.length })}
        </span>
        <button
          type="button"
          onClick={onToggleFilter}
          aria-pressed={filterMentorOnly}
          className={`rounded-lg px-2.5 py-1 text-micro font-medium transition-colors ${
            filterMentorOnly ? 'bg-raised text-ink' : 'text-ink-muted hover:text-ink'
          }`}
        >
          {t('soloRespondidas', 'Solo respondidas')}
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {comments.length === 0 ? (
          <p className="px-1 py-4 text-meta leading-relaxed text-ink-muted">
            {filterMentorOnly
              ? t('ningunaConsultaDeEstaClaseTieneRespuesta', 'Ninguna consulta de esta clase tiene respuesta del mentor todavía.')
              : t('nadieHaPreguntadoSobreEstaClaseAbreLa', 'Nadie ha preguntado sobre esta clase. Abre la primera consulta.')}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {comments.map((comment) => (
              <li key={comment.id} className="rounded-xl bg-raised p-3">
                <div className="flex items-center gap-2">
                  <img
                    src={comment.userAvatar || AVATAR_FALLBACK}
                    alt=""
                    className="h-6 w-6 shrink-0 rounded-full object-cover"
                  />
                  <span className="min-w-0 flex-1 truncate text-meta font-medium text-ink">
                    {comment.userName}
                  </span>
                  {comment.userRole === 'ADMIN' && (
                    <ShieldCheck aria-label={t('mentorEtiqueta', 'Mentor')} className="h-3.5 w-3.5 shrink-0 text-ink-soft" />
                  )}
                  <button
                    type="button"
                    onClick={() => onLike(comment.id)}
                    className="flex shrink-0 items-center gap-1 text-micro text-ink-muted transition-colors hover:text-ink"
                  >
                    <ThumbsUp aria-hidden className="h-3 w-3" />
                    <span className="tabular-nums">{comment.likes}</span>
                    <span className="sr-only">{t('votosAFavor', 'votos a favor')}</span>
                  </button>
                </div>

                <p className="mt-2 text-row leading-relaxed text-ink-soft">{comment.content}</p>

                {comment.replies && comment.replies.length > 0 && (
                  <ul className="mt-2.5 flex flex-col gap-2 border-l-2 border-line-strong pl-2.5">
                    {comment.replies.map((reply) => (
                      <li key={reply.id}>
                        <span className="text-micro font-semibold text-ink">{reply.userName}</span>
                        <p className="mt-0.5 text-row leading-relaxed text-ink-soft">{reply.content}</p>
                      </li>
                    ))}
                  </ul>
                )}

                {currentUser.role === 'ADMIN' && (
                  <div className="mt-2.5">
                    {replyingToId === comment.id ? (
                      <div className="flex flex-col gap-2">
                        <textarea
                          rows={2}
                          autoFocus
                          placeholder={t('responderComoMentor', 'Responder como mentor')}
                          aria-label={t('responderAUserName', 'Responder a {{userName}}', { userName: comment.userName })}
                          value={replyTextMap[comment.id] || ''}
                          onChange={(event) => onReplyTextChange(comment.id, event.target.value)}
                          className="w-full resize-none rounded-lg border border-line bg-canvas p-2.5 text-meta text-ink placeholder-ink-faint focus:border-line-strong focus:outline-none"
                        />
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => onStartReply(null)}
                            className="rounded-lg px-2.5 py-1 text-micro text-ink-muted transition-colors hover:text-ink"
                          >
                            {t('cancelar', 'Cancelar')}
                          </button>
                          <button
                            type="button"
                            onClick={() => onPostReply(comment.id)}
                            className="rounded-lg bg-ink px-2.5 py-1 text-micro font-semibold text-canvas transition-opacity hover:opacity-90"
                          >
                            {t('responder', 'Responder')}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onStartReply(comment.id)}
                        className="text-micro font-medium text-ink-soft underline underline-offset-2 transition-colors hover:text-ink"
                      >
                        {t('responderComoMentor', 'Responder como mentor')}
                      </button>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {hasAccess ? (
        <form onSubmit={onPostQuestion} className="shrink-0 space-y-3 border-t border-line p-4">
          <div>
            <label htmlFor="lesson-question" className="text-sm font-medium text-ink">
              {t('tuPreguntaSobreEstaClase', 'Tu pregunta sobre esta clase')}
            </label>
            <textarea
              id="lesson-question"
              rows={3}
              placeholder={t('viewer.askPlaceholder', 'Escribe tu duda y tu mentor te responderá')}
              value={question}
              onChange={(event) => onQuestionChange(event.target.value)}
              className="mt-1.5 w-full resize-none rounded-lg border border-line bg-canvas px-3 py-2 text-sm leading-relaxed text-ink placeholder-ink-faint focus:border-line-strong focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={!question.trim()}
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-line text-sm font-medium text-ink transition-colors hover:bg-ink/5 disabled:cursor-not-allowed disabled:text-ink-faint disabled:hover:bg-transparent"
          >
            <Send aria-hidden className="h-4 w-4 shrink-0" />
            {t('viewer.askSend', 'Enviar pregunta')}
          </button>
        </form>
      ) : (
        <p className="shrink-0 border-t border-line px-4 py-3 text-meta leading-relaxed text-ink-muted">
          {t('preguntarALosMentoresRequiereAccesoAl', 'Preguntar a los mentores requiere acceso al curso.')}
        </p>
      )}
    </div>
  );
};
