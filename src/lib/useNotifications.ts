/**
 * Avisos en tiempo real del usuario conectado.
 *
 * Abre una sola conexión SSE (`/api/notifications/stream`) por pestaña. Cada
 * aviso nuevo se agrega a la lista, sube el contador, muestra un toast y se
 * reemite como evento de ventana (`docentos:notification`) para que otras
 * pantallas reaccionen sin acoplarse: el dashboard del mentor recarga sus
 * consultas y el visor del curso recarga el hilo de la lección abierta.
 *
 * Si el stream no está disponible (red, proxy o límite de pestañas), consulta
 * la lista cada minuto y reintenta la conexión más tarde.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, type AppNotification } from './api';

export const NOTIFICATION_EVENT = 'docentos:notification';
/** Pide al dashboard del mentor que muestre la bandeja de consultas. */
export const MENTOR_QNA_EVENT = 'docentos:open-mentor-qna';
/** Pestaña a abrir cuando el dashboard del mentor todavía no estaba montado. */
export const MENTOR_TAB_STORAGE_KEY = 'docentos_mentor_open_tab';
/**
 * Lección a abrir al pulsar un aviso de respuesta: `{ courseId, videoId }`. Se
 * guarda por si el curso todavía no está montado (se lee al abrirlo) y además
 * se emite el evento para cuando ya está abierto.
 */
export const LESSON_FOCUS_STORAGE_KEY = 'docentos_focus_lesson';
export const LESSON_FOCUS_EVENT = 'docentos:focus-lesson';
/** Pestaña del panel de la lección con la que abrir (la de Mentoría, para ver la respuesta). */
export const LESSON_PANEL_STORAGE_KEY = 'docentos_focus_panel';

export interface LessonFocus {
  courseId: string;
  videoId?: string | null;
}

/** Lee (y opcionalmente consume) la lección pendiente de abrir para un curso. */
export function readLessonFocus(courseId: string, consume = true): LessonFocus | null {
  try {
    const raw = sessionStorage.getItem(LESSON_FOCUS_STORAGE_KEY);
    if (!raw) return null;
    const focus = JSON.parse(raw) as LessonFocus;
    if (!focus || focus.courseId !== courseId) return null;
    if (consume) sessionStorage.removeItem(LESSON_FOCUS_STORAGE_KEY);
    return focus;
  } catch {
    return null;
  }
}
export const LIST_LIMIT = 30;
const FALLBACK_POLL_MS = 60_000;
const TOAST_MS = 6_000;
const MAX_TOASTS = 3;

/** Agrega o reemplaza un aviso al principio de la lista, sin duplicados. */
export function upsertNotification(list: AppNotification[], item: AppNotification, limit = LIST_LIMIT): AppNotification[] {
  return [item, ...list.filter((n) => n.id !== item.id)].slice(0, limit);
}

/** Avisos de `incoming` que todavía no se habían visto. */
export function unseenNotifications(seen: Set<string>, incoming: AppNotification[]): AppNotification[] {
  return incoming.filter((n) => !seen.has(n.id));
}

export function useNotifications(userId: string | null | undefined) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [toasts, setToasts] = useState<AppNotification[]>([]);
  const seenRef = useRef<Set<string>>(new Set());
  const initializedRef = useRef(false);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const announce = useCallback(
    (item: AppNotification) => {
      seenRef.current.add(item.id);
      setNotifications((prev) => upsertNotification(prev, item));
      setToasts((prev) => [item, ...prev.filter((t) => t.id !== item.id)].slice(0, MAX_TOASTS));
      window.setTimeout(() => dismissToast(item.id), TOAST_MS);
      window.dispatchEvent(new CustomEvent<AppNotification>(NOTIFICATION_EVENT, { detail: item }));
    },
    [dismissToast],
  );

  /** Relee la lista. Lo que llegó mientras no había conexión se anuncia igual. */
  const refresh = useCallback(async () => {
    try {
      const res = await api.getNotifications();
      const list = res.notifications || [];
      if (initializedRef.current) {
        unseenNotifications(seenRef.current, list)
          .filter((n) => !n.readAt)
          .reverse()
          .forEach(announce);
      }
      list.forEach((n) => seenRef.current.add(n.id));
      initializedRef.current = true;
      setNotifications(list);
      setUnreadCount(res.unreadCount || 0);
    } catch {
      // Se reintenta en la próxima consulta o reconexión.
    }
  }, [announce]);

  useEffect(() => {
    seenRef.current = new Set();
    initializedRef.current = false;
    setNotifications([]);
    setUnreadCount(0);
    setToasts([]);
    if (!userId) return;

    let source: EventSource | null = null;
    let pollTimer: number | null = null;
    let retryTimer: number | null = null;
    let retryDelay = 30_000;
    let disposed = false;

    const startPolling = () => {
      if (pollTimer !== null) return;
      pollTimer = window.setInterval(() => void refresh(), FALLBACK_POLL_MS);
    };
    const stopPolling = () => {
      if (pollTimer !== null) window.clearInterval(pollTimer);
      pollTimer = null;
    };

    const connect = () => {
      if (disposed) return;
      if (typeof EventSource === 'undefined') {
        void refresh();
        startPolling();
        return;
      }
      source = new EventSource('/api/notifications/stream', { withCredentials: true });

      source.addEventListener('ready', () => {
        retryDelay = 30_000;
        stopPolling();
        void refresh();
      });

      source.addEventListener('notification', (event) => {
        try {
          const item = JSON.parse((event as MessageEvent).data) as AppNotification;
          if (seenRef.current.has(item.id)) return;
          announce(item);
          if (!item.readAt) setUnreadCount((c) => c + 1);
        } catch {
          // Evento mal formado: se ignora.
        }
      });

      source.onerror = () => {
        // CONNECTING: el navegador reintenta solo. CLOSED: el servidor rechazó
        // (sesión, límite de pestañas): se consulta por intervalo y se reintenta luego.
        if (source && source.readyState === EventSource.CLOSED) {
          source.close();
          source = null;
          startPolling();
          void refresh();
          retryTimer = window.setTimeout(connect, retryDelay);
          retryDelay = Math.min(retryDelay * 2, 300_000);
        }
      };
    };

    void refresh();
    connect();

    return () => {
      disposed = true;
      source?.close();
      stopPolling();
      if (retryTimer !== null) window.clearTimeout(retryTimer);
    };
  }, [userId, refresh, announce]);

  const markRead = useCallback(async (ids?: string[]) => {
    const now = new Date().toISOString();
    setNotifications((prev) => prev.map((n) => (!ids || ids.includes(n.id)) && !n.readAt ? { ...n, readAt: now } : n));
    try {
      const res = await api.markNotificationsRead(ids);
      setUnreadCount(res.unreadCount || 0);
    } catch {
      void refresh();
    }
  }, [refresh]);

  return { notifications, unreadCount, toasts, dismissToast, markRead, refresh };
}
