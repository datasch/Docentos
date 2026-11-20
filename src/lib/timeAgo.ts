import { dateLocale } from '../i18n/format';

/** "hace 3 días" para leer rápido; pasado el mes, la fecha corta. */
export function timeAgo(iso: string): string {
  const minutes = Math.round((new Date(iso).getTime() - Date.now()) / 60000);
  const rtf = new Intl.RelativeTimeFormat(dateLocale(), { numeric: 'auto' });
  if (Math.abs(minutes) < 60) return rtf.format(minutes, 'minute');
  if (Math.abs(minutes) < 1440) return rtf.format(Math.round(minutes / 60), 'hour');
  if (Math.abs(minutes) < 43200) return rtf.format(Math.round(minutes / 1440), 'day');
  return new Date(iso).toLocaleDateString(dateLocale());
}
