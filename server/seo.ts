/**
 * Pre-renderizado para rastreadores.
 *
 * El contenido de la landing y de los cursos lo edita un administrador, pero
 * esta pagina se devuelve a cualquier visitante que envie un User-Agent de bot.
 * Por eso todo valor almacenado se escapa antes de interpolarse: sin escapado,
 * un guion guardado en el CMS se ejecutaria en el navegador de quien la pida.
 */

export interface SeoLandingContent {
  heroTitle: string;
  heroSubtitle: string;
  heroMediaUrl: string;
  footerText: string;
}

export interface SeoCourse {
  title: string;
  description: string;
  price: number;
}

const CRAWLER_PATTERN =
  /googlebot|bingbot|yandex|baiduspider|gptbot|claude-web|perplexity|twitterbot|facebookexternalhit|linkedinbot|whatsapp|slackbot/i;

export function isCrawlerUserAgent(userAgent: string): boolean {
  return CRAWLER_PATTERN.test(userAgent);
}

export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Solo se emiten URLs http(s) en atributos; cualquier otro esquema se descarta. */
export function safeHttpUrl(value: unknown): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  try {
    const parsed = new URL(raw);
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.toString() : '';
  } catch {
    return '';
  }
}

export function renderSeoLandingHtml(params: {
  landing: SeoLandingContent;
  courses: SeoCourse[];
  baseUrl: string;
}): string {
  const { landing, courses, baseUrl } = params;

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: courses.map((course, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      item: {
        '@type': 'Course',
        name: course.title,
        description: course.description,
        provider: { '@type': 'EducationalOrganization', name: 'Giantucchi Inc. EIRL' },
      },
    })),
  };

  // Dentro de <script> el escapado HTML no aplica: se neutraliza "<" para que
  // un titulo con "</script>" no pueda cerrar el bloque e inyectar marcado.
  const jsonLd = JSON.stringify(schema).replace(/</g, '\\u003c');
  const heroImage = safeHttpUrl(landing.heroMediaUrl);

  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"><title>${escapeHtml(landing.heroTitle)} | DocentOS</title>
<meta name="description" content="${escapeHtml(landing.heroSubtitle)}"><link rel="canonical" href="${escapeHtml(baseUrl)}">
${heroImage ? `<meta property="og:image" content="${escapeHtml(heroImage)}">` : ''}<script type="application/ld+json">${jsonLd}</script>
</head><body><h1>${escapeHtml(landing.heroTitle)}</h1><p>${escapeHtml(landing.heroSubtitle)}</p>
${courses.map((course) => `<article><h2>${escapeHtml(course.title)}</h2><p>${escapeHtml(course.description)}</p><p>Precio: $${escapeHtml(course.price)} USD</p></article>`).join('')}
<footer>${escapeHtml(landing.footerText)}</footer></body></html>`;
}
