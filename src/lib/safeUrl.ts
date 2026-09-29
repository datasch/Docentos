/** Acepta destinos externos absolutos; HTTP queda limitado al desarrollo local. */
export function safeExternalUrl(value: unknown, allowHttp = false): string {
  if (typeof value !== 'string' || !value.trim()) return '';
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'https:' && !(allowHttp && url.protocol === 'http:')) return '';
    if (!url.hostname || url.username || url.password) return '';
    return url.toString();
  } catch {
    return '';
  }
}

export function safeLandingLink(value: unknown, allowHttp = false): string {
  if (typeof value === 'string' && /^#[a-zA-Z][\w-]*$/.test(value.trim())) return value.trim();
  return safeExternalUrl(value, allowHttp);
}
