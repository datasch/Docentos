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
  if (typeof value === 'string') {
    const link = value.trim();
    if (link === '#' || /^#[a-zA-Z][\w-]*$/.test(link)) return link;
    // La doble barra y la contrabarra pueden convertir una ruta en URL externa.
    if (/^\/(?!\/)[^\s\\]*$/.test(link)) return link;
  }
  return safeExternalUrl(value, allowHttp);
}
