import React, { useEffect, useRef, useState } from 'react';
import { Bell, CheckCheck, MessageCircleQuestion, MessageSquareReply } from 'lucide-react';
import type { AppNotification } from '../../lib/api';

interface NotificationBellProps {
  notifications: AppNotification[];
  unreadCount: number;
  onOpenNotification: (notification: AppNotification) => void;
  onMarkAllRead: () => void;
  /** Para cerrar otros menús de la barra al abrir este. */
  onOpenChange?: (open: boolean) => void;
}

export function notificationIcon(type: AppNotification['type']) {
  return type === 'qna.answered' ? MessageSquareReply : MessageCircleQuestion;
}

export function relativeTime(iso: string, now = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return 'ahora';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'ayer' : `hace ${days} días`;
}

/**
 * Campana de avisos de la barra superior: contador de no leídos y lista de
 * los últimos avisos (preguntas de mentoría nuevas y respuestas).
 */
export const NotificationBell: React.FC<NotificationBellProps> = ({
  notifications,
  unreadCount,
  onOpenNotification,
  onMarkAllRead,
  onOpenChange,
}) => {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement | null>(null);

  const setOpenState = (next: boolean) => {
    setOpen(next);
    onOpenChange?.(next);
  };

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (anchorRef.current && !anchorRef.current.contains(event.target as Node)) setOpenState(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenState(false);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const badge = unreadCount > 99 ? '99+' : String(unreadCount);

  return (
    <div className="lp-menu-anchor" ref={anchorRef}>
      <button
        type="button"
        onClick={() => setOpenState(!open)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={unreadCount > 0 ? `Notificaciones: ${unreadCount} sin leer` : 'Notificaciones'}
        title="Notificaciones"
        className="relative inline-flex min-h-11 min-w-11 items-center justify-center p-2 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] text-slate-600 dark:text-white/60 hover:text-slate-900 dark:hover:text-white transition-all border border-slate-200 dark:border-white/[0.06] cursor-pointer"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span
            aria-hidden
            className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#06b6d4] text-[10px] font-bold leading-[18px] text-[#050505] text-center tabular-nums"
          >
            {badge}
          </span>
        )}
      </button>

      {open && (
        <div className="lp-menu w-[min(360px,calc(100vw-24px))]" role="menu" aria-label="Notificaciones">
          <div className="flex items-center justify-between gap-2 px-2.5 pt-1.5 pb-2 border-b border-slate-200 dark:border-white/[0.06] mb-1">
            <span className="text-sm font-semibold text-slate-900 dark:text-white">Notificaciones</span>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={onMarkAllRead}
                className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-slate-500 hover:text-slate-900 dark:text-white/50 dark:hover:text-white cursor-pointer"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Marcar todas como leídas
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-slate-500 dark:text-white/50">No tienes notificaciones.</p>
          ) : (
            <ul className="flex flex-col gap-0.5">
              {notifications.map((n) => {
                const Icon = notificationIcon(n.type);
                const unread = !n.readAt;
                return (
                  <li key={n.id}>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setOpenState(false);
                        onOpenNotification(n);
                      }}
                      className={`w-full text-left flex items-start gap-2.5 rounded-lg px-2.5 py-2 transition-colors cursor-pointer hover:bg-slate-100 dark:hover:bg-white/[0.06] ${unread ? 'bg-cyan-50/70 dark:bg-cyan-400/[0.06]' : ''}`}
                    >
                      <Icon className={`mt-0.5 w-4 h-4 shrink-0 ${n.type === 'qna.answered' ? 'text-[#a855f7]' : 'text-[#06b6d4]'}`} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-2">
                          <span className={`truncate text-sm ${unread ? 'font-semibold text-slate-900 dark:text-white' : 'text-slate-700 dark:text-white/75'}`}>
                            {n.title}
                          </span>
                          <span className="shrink-0 text-[11px] text-slate-400 dark:text-white/40">{relativeTime(n.createdAt)}</span>
                        </span>
                        {n.body && (
                          <span className="mt-0.5 block text-xs leading-snug text-slate-600 dark:text-white/60 line-clamp-2 break-words">{n.body}</span>
                        )}
                        {(n.data.videoTitle || n.data.courseTitle) && (
                          <span className="mt-0.5 block truncate text-[11px] text-slate-400 dark:text-white/40">
                            {[n.data.courseTitle, n.data.videoTitle].filter(Boolean).join(' · ')}
                          </span>
                        )}
                      </span>
                      {unread && <span aria-label="Sin leer" className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#06b6d4]" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};
