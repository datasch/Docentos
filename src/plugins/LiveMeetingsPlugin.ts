/**
 * Plugin de Clases Sincrónicas y Live Meetings
 * Academia Giantucchi / DocentOS
 *
 * Soporta integración con Google Meet corporativo, Jitsi Meet abierto automatizado
 * y vinculación de grabaciones asincrónicas (YouTube/Vimeo/Drive).
 */

import { AcademiaPlugin, Meeting, MeetingType } from '../types';

export const liveMeetingsPlugin: AcademiaPlugin = {
  id: 'live-meetings',
  name: 'Plugin de Clases Sincrónicas & Live Meetings',
  description: 'Permite a los mentores programar y transmitir clases en vivo mediante Google Meet, Jitsi Meet abierto o grabaciones asincrónicas.',
  version: '1.0.0',
  enabled: true,
  category: 'meetings',
  icon: 'Video',
  config: {
    defaultProvider: 'jitsi',
    jitsiDomain: 'meet.jit.si',
    enableAutoRecordingLink: true,
    requireVipAccess: false,
    roomPrefix: 'docentos-mentor',
  },
};

/**
 * Genera un identificador único seguro para salas de Jitsi Meet
 */
export function generateJitsiRoomName(prefix = 'docentos-live'): string {
  const cleanPrefix = prefix.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');
  const timestamp = Date.now().toString(36);
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  return `${cleanPrefix}-${timestamp}-${randomSuffix}`;
}

/**
 * Genera el enlace dinámico completo a una sala de Jitsi Meet
 */
export function generateJitsiMeetingUrl(roomName?: string, domain = 'meet.jit.si'): string {
  const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const room = roomName || generateJitsiRoomName();
  return `https://${cleanDomain}/${room}`;
}

/**
 * Valida y normaliza la URL de una reunión según el proveedor
 */
export function normalizeMeetingUrl(type: MeetingType | string, rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (!trimmed) return '';

  if (type === 'jitsi') {
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      return `https://meet.jit.si/${trimmed.replace(/^\/+/, '')}`;
    }
    return trimmed;
  }

  if (type === 'meet') {
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      return `https://${trimmed}`;
    }
    return trimmed;
  }

  if (type === 'async_record') {
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      return `https://${trimmed}`;
    }
    return trimmed;
  }

  return trimmed;
}

/**
 * Formatea la fecha y hora de una reunión para mostrarla amigablemente
 */
export function formatMeetingScheduledAt(dateString: string): {
  dateFormatted: string;
  timeFormatted: string;
  isUpcoming: boolean;
  isPast: boolean;
  relativeLabel: string;
} {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const isPast = diffMs < 0;
  const isUpcoming = diffMs > 0;

  const dateFormatted = Number.isNaN(date.getTime())
    ? dateString
    : date.toLocaleDateString(undefined, {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });

  const timeFormatted = Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
      });

  let relativeLabel = '';
  if (Math.abs(diffMs) < 15 * 60 * 1000) {
    relativeLabel = 'Comienza pronto o en curso';
  } else if (isUpcoming) {
    const hours = Math.round(diffMs / (1000 * 60 * 60));
    if (hours < 24) {
      relativeLabel = `En ${hours} ${hours === 1 ? 'hora' : 'horas'}`;
    } else {
      const days = Math.round(hours / 24);
      relativeLabel = `En ${days} ${days === 1 ? 'día' : 'días'}`;
    }
  } else {
    const hours = Math.round(Math.abs(diffMs) / (1000 * 60 * 60));
    if (hours < 24) {
      relativeLabel = `Hace ${hours} ${hours === 1 ? 'hora' : 'horas'}`;
    } else {
      const days = Math.round(hours / 24);
      relativeLabel = `Hace ${days} ${days === 1 ? 'día' : 'días'}`;
    }
  }

  return {
    dateFormatted,
    timeFormatted,
    isUpcoming,
    isPast,
    relativeLabel,
  };
}

/**
 * Detecta si una reunión es de clase en vivo sincrónica
 */
export function isSynchronousLive(meeting: { meetingType: string; isLive: boolean }): boolean {
  return meeting.isLive && (meeting.meetingType === 'meet' || meeting.meetingType === 'jitsi');
}
