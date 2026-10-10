/**
 * Botón flotante accesible de Buzón de Escucha.
 *
 * Sustituye al antiguo botón verde de soporte en la esquina inferior derecha.
 * Permite a cualquier usuario enviar sugerencias, quejas, felicitaciones y evaluar
 * el NPS en cualquier momento. Si el equipo ha respondido a un comentario previo,
 * muestra un distintivo numérico llamativo (ej. "1") junto al texto.
 */

import React from 'react';
import { HeartHandshake } from 'lucide-react';

interface ListeningFloatingButtonProps {
  unreadCount?: number;
  onClick: () => void;
}

export const ListeningFloatingButton: React.FC<ListeningFloatingButtonProps> = ({
  unreadCount = 0,
  onClick,
}) => {
  const hasUnread = unreadCount > 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`lp-listening-floating-btn ${hasUnread ? 'lp-listening-floating-btn--has-unread' : ''}`}
      aria-label={
        hasUnread
          ? `Abrir Buzón de escucha, tienes ${unreadCount} respuesta${unreadCount > 1 ? 's' : ''} pendiente${unreadCount > 1 ? 's' : ''}`
          : 'Abrir Buzón de escucha'
      }
    >
      <HeartHandshake aria-hidden className="lp-listening-icon" />
      <span className="lp-listening-text">Buzón de escucha</span>
      {hasUnread && (
        <span
          className="lp-listening-floating-badge"
          aria-label={`${unreadCount} respuesta${unreadCount > 1 ? 's' : ''} no leída${unreadCount > 1 ? 's' : ''}`}
        >
          {unreadCount}
        </span>
      )}
      <span className="lp-listening-floating-tooltip" role="tooltip">
        {hasUnread
          ? `💬 Tienes ${unreadCount} respuesta${unreadCount > 1 ? 's' : ''} nueva${unreadCount > 1 ? 's' : ''}`
          : '💬 Tu opinión nos importa · Déjanos tu aporte'}
      </span>
    </button>
  );
};
