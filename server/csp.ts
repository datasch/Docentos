import { createHash } from 'node:crypto';

/** Los marcos e imágenes configurables aceptan cualquier origen HTTPS. */
export const cspDirectives = {
  defaultSrc: ["'self'"],
  baseUri: ["'self'"],
  objectSrc: ["'none'"],
  frameAncestors: ["'self'"],
  formAction: ["'self'"],
  scriptSrc: ["'self'"],
  styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
  fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
  imgSrc: ["'self'", 'https://images.unsplash.com', 'https:', 'data:', 'blob:'],
  mediaSrc: ["'self'", 'https:', 'blob:'],
  frameSrc: [
    "'self'",
    'https://www.youtube.com',
    'https://www.youtube-nocookie.com',
    'https://drive.google.com',
    'https://player.vimeo.com',
    'https://www.loom.com',
    'https://meet.jit.si',
    'https://meet.google.com',
    'https:',
  ],
  connectSrc: ["'self'", 'https:', 'wss:'],
  upgradeInsecureRequests: null,
};

export function allowSeoJsonLd(header: string, html: string): string {
  const content = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1];
  if (!content) return header;
  const hash = createHash('sha256').update(content).digest('base64');
  return header.replace(/script-src ([^;]+)/, (_match, sources: string) => `script-src ${sources} 'sha256-${hash}'`);
}
