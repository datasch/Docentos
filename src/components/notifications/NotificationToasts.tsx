import React from 'react';
import { X } from 'lucide-react';
import type { AppNotification } from '../../lib/api';
import { notificationIcon } from './NotificationBell';

interface NotificationToastsProps {
  toasts: AppNotification[];
  onOpen: (notification: AppNotification) => void;
  onDismiss: (id: string) => void;
}

/**
 * Avisos emergentes en la esquina superior derecha. Quedan por encima del
 * visor de lecciones para que el aviso se vea aunque el alumno esté en un video.
 */
export const NotificationToasts: React.FC<NotificationToastsProps> = ({ toasts, onOpen, onDismiss }) => {
  if (toasts.length === 0) return null;
  return (
    <div
      role="region"
      aria-label="Avisos nuevos"
      aria-live="polite"
      className="pointer-events-none fixed right-3 top-20 z-[1000] flex w-[min(360px,calc(100vw-24px))] flex-col gap-2"
    >
      {toasts.map((n) => {
        const Icon = notificationIcon(n.type);
        return (
          <div
            key={n.id}
            className="pointer-events-auto flex items-start gap-2.5 rounded-xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur dark:border-white/[0.08] dark:bg-[#121214]/95"
          >
            <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${n.type === 'qna.answered' ? 'text-[#a855f7]' : 'text-[#06b6d4]'}`} />
            <button
              type="button"
              onClick={() => {
                onDismiss(n.id);
                onOpen(n);
              }}
              className="min-w-0 flex-1 text-left cursor-pointer"
            >
              <span className="block text-sm font-semibold text-slate-900 dark:text-white">{n.title}</span>
              {n.body && <span className="mt-0.5 block text-xs leading-snug text-slate-600 dark:text-white/65 line-clamp-2 break-words">{n.body}</span>}
            </button>
            <button
              type="button"
              onClick={() => onDismiss(n.id)}
              aria-label="Cerrar aviso"
              className="-m-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:text-white/40 dark:hover:bg-white/[0.08] dark:hover:text-white cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
