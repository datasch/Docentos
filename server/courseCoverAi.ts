/**
 * Generador Automático de Portadas de Cursos con IA y Marca Institucional
 * DocentOS LMS Engine
 *
 * Genera imágenes de portada temáticas (1200x675, 16:9) adaptadas al contenido
 * de cada curso (React, Grafana, Cloud, Full-Stack, IA, Ciberseguridad, etc.)
 * e incrusta en una esquina el logo configurado en el Plugin de Personalización
 * (`docentos-customizer`), usando por defecto el emblema oficial de DocentOS.
 */

import { prisma } from './prisma.js';
import { config } from './config.js';
import { descifrarSiHaceFalta } from './crypto.js';
import { requestAiJson, isAiEnabled } from './aiProvider.js';
import { logger } from './logger.js';

export const GENERIC_COVER_URLS = new Set([
  '',
  'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800',
  'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=1200&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=800&auto=format&fit=crop&q=80',
]);

export function isGenericCoverImage(url: string | null | undefined): boolean {
  const clean = String(url ?? '').trim();
  if (!clean) return true;
  if (GENERIC_COVER_URLS.has(clean)) return true;
  if (clean.includes('photo-1516321318423-f06f85e504b3')) return true;
  return false;
}

export function isAiGeneratedCover(url: string | null | undefined): boolean {
  const clean = String(url ?? '').trim();
  return clean.startsWith('data:image/svg+xml') && clean.includes('docentos-ai-cover');
}

export interface CustomizerBrandInfo {
  logoUrl: string;
  brandName: string;
  logoInitial: string;
}

/**
 * Obtiene el logo y nombre configurados en el plugin `docentos-customizer`.
 * Por defecto devuelve el emblema de DocentOS.
 */
export async function getActiveCustomizerBrand(): Promise<CustomizerBrandInfo> {
  try {
    const plugin = await prisma.plugin.findUnique({ where: { id: 'docentos-customizer' } });
    if (plugin && plugin.enabled && plugin.configJson) {
      const parsed = JSON.parse(descifrarSiHaceFalta(plugin.configJson));
      const customLogoUrl = typeof parsed.customLogoUrl === 'string' ? parsed.customLogoUrl.trim() : '';
      const brandName =
        typeof parsed.customBrandName === 'string' && parsed.customBrandName.trim()
          ? parsed.customBrandName.trim()
          : 'DocentOS';
      return {
        logoUrl: customLogoUrl,
        brandName,
        logoInitial: brandName.charAt(0).toUpperCase() || 'D',
      };
    }
  } catch (err) {
    logger.warn('courseCoverAi.read_brand_failed', { reason: String(err) });
  }
  return {
    logoUrl: config.APP_LOGO_URL || '',
    brandName: config.APP_NAME || 'DocentOS',
    logoInitial: (config.APP_LOGO_INITIAL || 'D').charAt(0).toUpperCase(),
  };
}

export type CourseVisualArchetype =
  | 'grafana-observability'
  | 'react-frontend'
  | 'cloud-fullstack'
  | 'ai-datascience'
  | 'cybersecurity'
  | 'backend-database'
  | 'mobile-ux'
  | 'devops-containers'
  | 'software-engineering';

interface CoverThemeSpec {
  archetype: CourseVisualArchetype;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  bgStart: string;
  bgEnd: string;
  topicTag: string;
  headline: string;
  subline: string;
  aiBase64Image?: string;
}

function escapeXml(unsafe: string): string {
  return String(unsafe ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Detecta la familia visual y paleta óptima según el título, categoría y descripción del curso.
 */
export function detectArchetype(title: string, category = '', description = ''): CoverThemeSpec {
  const combined = `${title} ${category} ${description}`.toLowerCase();

  // Limpiar títulos que son prompts largos para mostrar un titular conciso en la ilustración
  const cleanDisplayTitle =
    title.length > 58 && /quiero crear un curso|organiza el contenido/i.test(title)
      ? 'Arquitectura & Desarrollo Práctico'
      : title.length > 52
        ? `${title.slice(0, 50).trim()}…`
        : title.trim() || 'Curso Especializado';

  if (/\b(grafana|prometheus|observabilidad|monitoreo|monitoring|metrics|métricas|telemetr|kibana|datadog|elastic)\b/i.test(combined)) {
    return {
      archetype: 'grafana-observability',
      primaryColor: '#f97316',
      secondaryColor: '#06b6d4',
      accentColor: '#eab308',
      bgStart: '#090d16',
      bgEnd: '#1a120b',
      topicTag: 'OBSERVABILITY & METRICS',
      headline: cleanDisplayTitle,
      subline: 'Dashboards en Tiempo Real · Telemetría · Alertas',
    };
  }

  if (/\b(react|next\.?js|redux|jsx|tsx|hooks|frontend|front-end|vite|tailwind|vue|angular)\b/i.test(combined)) {
    return {
      archetype: 'react-frontend',
      primaryColor: '#06b6d4',
      secondaryColor: '#3b82f6',
      accentColor: '#a855f7',
      bgStart: '#06101e',
      bgEnd: '#0f172a',
      topicTag: 'MODERN FRONTEND & UI',
      headline: cleanDisplayTitle,
      subline: 'Componentes Reactivos · Estado · Arquitectura UI',
    };
  }

  if (/\b(full-?stack|cloud|aws|azure|gcp|arquitectura|architecture|microservicios|serverless|escalab)\b/i.test(combined)) {
    return {
      archetype: 'cloud-fullstack',
      primaryColor: '#38bdf8',
      secondaryColor: '#a855f7',
      accentColor: '#ec4899',
      bgStart: '#080b1a',
      bgEnd: '#161030',
      topicTag: 'FULL-STACK & CLOUD ARCHITECTURE',
      headline: cleanDisplayTitle,
      subline: 'Sistemas Distribuidos · Cloud Native · Escala Global',
    };
  }

  if (/\b(inteligencia artificial|ia\b|ai\b|machine learning|deep learning|llm|gemini|openai|python|data science|datos|neural)\b/i.test(combined)) {
    return {
      archetype: 'ai-datascience',
      primaryColor: '#a855f7',
      secondaryColor: '#06b6d4',
      accentColor: '#ec4899',
      bgStart: '#0c071d',
      bgEnd: '#071927',
      topicTag: 'ARTIFICIAL INTELLIGENCE & DATA',
      headline: cleanDisplayTitle,
      subline: 'Modelos Generativos · Automatización · Redes Neuronales',
    };
  }

  if (/\b(seguridad|ciberseguridad|cyber|hacking|pentest|kali|owasp|cripto|auth|zero trust)\b/i.test(combined)) {
    return {
      archetype: 'cybersecurity',
      primaryColor: '#10b981',
      secondaryColor: '#06b6d4',
      accentColor: '#34d399',
      bgStart: '#04130e',
      bgEnd: '#091926',
      topicTag: 'CYBERSECURITY & DEFENSE',
      headline: cleanDisplayTitle,
      subline: 'Protección de Infraestructura · Auditoría · Cifrado',
    };
  }

  if (/\b(docker|kubernetes|k8s|devops|ci\/cd|linux|git|github|terraform|ansible|containers)\b/i.test(combined)) {
    return {
      archetype: 'devops-containers',
      primaryColor: '#3b82f6',
      secondaryColor: '#06b6d4',
      accentColor: '#60a5fa',
      bgStart: '#060f22',
      bgEnd: '#0a192f',
      topicTag: 'DEVOPS & CLOUD AUTOMATION',
      headline: cleanDisplayTitle,
      subline: 'Contenedores · Orquestación · Pipelines CI/CD',
    };
  }

  if (/\b(sql|postgres|mysql|mongo|database|base de datos|backend|node|express|nestjs|api|graphql|prisma)\b/i.test(combined)) {
    return {
      archetype: 'backend-database',
      primaryColor: '#6366f1',
      secondaryColor: '#06b6d4',
      accentColor: '#22d3ee',
      bgStart: '#08091c',
      bgEnd: '#0d1b2a',
      topicTag: 'BACKEND & DATA ENGINEERING',
      headline: cleanDisplayTitle,
      subline: 'APIs de Alto Rendimiento · Persistencia · Escalabilidad',
    };
  }

  if (/\b(mobile|flutter|android|ios|swift|kotlin|ui\/ux|diseño|figma)\b/i.test(combined)) {
    return {
      archetype: 'mobile-ux',
      primaryColor: '#ec4899',
      secondaryColor: '#8b5cf6',
      accentColor: '#06b6d4',
      bgStart: '#16071c',
      bgEnd: '#0d102b',
      topicTag: 'MOBILE & PRODUCT DESIGN',
      headline: cleanDisplayTitle,
      subline: 'Experiencias Nativas · Sistemas de Diseño · Fluidez',
    };
  }

  return {
    archetype: 'software-engineering',
    primaryColor: '#06b6d4',
    secondaryColor: '#a855f7',
    accentColor: '#f59e0b',
    bgStart: '#070b16',
    bgEnd: '#130d26',
    topicTag: (category || 'INGENIERÍA & MENTORÍA').toUpperCase().slice(0, 32),
    headline: cleanDisplayTitle,
    subline: 'Formación Estructurada · Proyectos Aplicados · DocentOS',
  };
}

/**
 * Renderiza la ilustración vectorial temática central según el arquetipo del curso.
 */
function renderArchetypeArtwork(spec: CoverThemeSpec): string {
  const { archetype, primaryColor, secondaryColor, accentColor } = spec;

  switch (archetype) {
    case 'grafana-observability':
      return `
        <!-- Panel de Observabilidad & Grafana Dashboards -->
        <g transform="translate(560, 75)">
          <rect x="0" y="0" width="560" height="360" rx="20" fill="#0d111a" fill-opacity="0.88" stroke="${primaryColor}" stroke-width="2" stroke-opacity="0.55"/>
          <!-- Barra superior del dashboard -->
          <rect x="0" y="0" width="560" height="38" rx="20" fill="#161b26"/>
          <circle cx="24" cy="19" r="5" fill="#ef4444"/>
          <circle cx="42" cy="19" r="5" fill="#f59e0b"/>
          <circle cx="60" cy="19" r="5" fill="#10b981"/>
          <text x="84" y="23" fill="#94a3b8" font-family="monospace" font-size="12" font-weight="bold">grafana://cluster-metrics-live · 99.98% SLA</text>

          <!-- Tarjetas de Gauges Superiores -->
          <rect x="22" y="54" width="160" height="110" rx="12" fill="#111827" stroke="#1e293b" stroke-width="1.5"/>
          <path d="M 55 135 A 45 45 0 0 1 145 135" fill="none" stroke="#1e293b" stroke-width="10" stroke-linecap="round"/>
          <path d="M 55 135 A 45 45 0 0 1 132 102" fill="none" stroke="${primaryColor}" stroke-width="10" stroke-linecap="round"/>
          <text x="100" y="136" text-anchor="middle" fill="#ffffff" font-family="sans-serif" font-size="20" font-weight="800">84%</text>
          <text x="100" y="75" text-anchor="middle" fill="#94a3b8" font-family="sans-serif" font-size="10" font-weight="700">CPU LOAD</text>

          <rect x="200" y="54" width="160" height="110" rx="12" fill="#111827" stroke="#1e293b" stroke-width="1.5"/>
          <path d="M 235 135 A 45 45 0 0 1 325 135" fill="none" stroke="#1e293b" stroke-width="10" stroke-linecap="round"/>
          <path d="M 235 135 A 45 45 0 0 1 318 112" fill="none" stroke="${secondaryColor}" stroke-width="10" stroke-linecap="round"/>
          <text x="280" y="136" text-anchor="middle" fill="#ffffff" font-family="sans-serif" font-size="20" font-weight="800">1.8ms</text>
          <text x="280" y="75" text-anchor="middle" fill="#94a3b8" font-family="sans-serif" font-size="10" font-weight="700">LATENCY P95</text>

          <rect x="378" y="54" width="160" height="110" rx="12" fill="#111827" stroke="#1e293b" stroke-width="1.5"/>
          <text x="458" y="75" text-anchor="middle" fill="#94a3b8" font-family="sans-serif" font-size="10" font-weight="700">THROUGHPUT</text>
          <text x="458" y="114" text-anchor="middle" fill="#10b981" font-family="monospace" font-size="24" font-weight="900">42.5K</text>
          <text x="458" y="138" text-anchor="middle" fill="#64748b" font-family="sans-serif" font-size="11">req/sec · healthy</text>

          <!-- Gráfico de Series de Tiempo (Time Series) -->
          <rect x="22" y="180" width="516" height="156" rx="12" fill="#111827" stroke="#1e293b" stroke-width="1.5"/>
          <line x1="40" y1="215" x2="518" y2="215" stroke="#1e293b" stroke-dasharray="4 4"/>
          <line x1="40" y1="255" x2="518" y2="255" stroke="#1e293b" stroke-dasharray="4 4"/>
          <line x1="40" y1="295" x2="518" y2="295" stroke="#1e293b" stroke-dasharray="4 4"/>
          <path d="M 40 305 Q 95 270, 140 280 T 240 225 T 340 245 T 435 198 T 518 210 L 518 320 L 40 320 Z" fill="${primaryColor}" fill-opacity="0.22"/>
          <path d="M 40 305 Q 95 270, 140 280 T 240 225 T 340 245 T 435 198 T 518 210" fill="none" stroke="${primaryColor}" stroke-width="3.5"/>
          <path d="M 40 315 Q 100 295, 160 260 T 270 270 T 370 215 T 460 235 T 518 190" fill="none" stroke="${secondaryColor}" stroke-width="3"/>
          <circle cx="435" cy="198" r="5" fill="${accentColor}"/>
          <circle cx="518" cy="190" r="5" fill="${secondaryColor}"/>
        </g>
      `;

    case 'react-frontend':
      return `
        <!-- Átomo React & Árbol de Componentes -->
        <g transform="translate(830, 255)">
          <circle cx="0" cy="0" r="175" fill="${primaryColor}" fill-opacity="0.06"/>
          <ellipse cx="0" cy="0" rx="165" ry="62" fill="none" stroke="${primaryColor}" stroke-width="4" stroke-opacity="0.85" transform="rotate(0)"/>
          <ellipse cx="0" cy="0" rx="165" ry="62" fill="none" stroke="${primaryColor}" stroke-width="4" stroke-opacity="0.85" transform="rotate(60)"/>
          <ellipse cx="0" cy="0" rx="165" ry="62" fill="none" stroke="${secondaryColor}" stroke-width="4" stroke-opacity="0.85" transform="rotate(120)"/>
          <circle cx="0" cy="0" r="26" fill="${primaryColor}"/>
          <circle cx="0" cy="0" r="12" fill="#ffffff"/>
          <!-- Nodos orbitales -->
          <circle cx="143" cy="-30" r="8" fill="${accentColor}"/>
          <circle cx="-120" cy="68" r="8" fill="${primaryColor}"/>
          <circle cx="65" cy="135" r="8" fill="${secondaryColor}"/>
        </g>
        <!-- Tarjeta de Código JSX -->
        <g transform="translate(520, 75)">
          <rect x="0" y="0" width="240" height="145" rx="14" fill="#0d1526" fill-opacity="0.9" stroke="${primaryColor}" stroke-width="1.5" stroke-opacity="0.5"/>
          <circle cx="18" cy="18" r="4" fill="#ef4444"/>
          <circle cx="32" cy="18" r="4" fill="#f59e0b"/>
          <circle cx="46" cy="18" r="4" fill="#10b981"/>
          <text x="18" y="48" fill="#38bdf8" font-family="monospace" font-size="12" font-weight="bold">&lt;AppProvider&gt;</text>
          <text x="34" y="70" fill="#c084fc" font-family="monospace" font-size="12">const [state] = useHook()</text>
          <text x="34" y="92" fill="#22d3ee" font-family="monospace" font-size="12">&lt;CourseView /&gt;</text>
          <text x="18" y="114" fill="#38bdf8" font-family="monospace" font-size="12" font-weight="bold">&lt;/AppProvider&gt;</text>
        </g>
      `;

    case 'cloud-fullstack':
      return `
        <!-- Arquitectura Cloud & Full-Stack Layers -->
        <g transform="translate(565, 70)">
          <rect x="0" y="0" width="555" height="365" rx="22" fill="#0d1124" fill-opacity="0.85" stroke="${primaryColor}" stroke-width="2" stroke-opacity="0.45"/>
          <!-- Nodos de Arquitectura -->
          <!-- Frontend Node -->
          <rect x="35" y="45" width="145" height="95" rx="14" fill="#151c38" stroke="${primaryColor}" stroke-width="2"/>
          <text x="107" y="82" text-anchor="middle" fill="${primaryColor}" font-family="sans-serif" font-size="12" font-weight="800">FRONTEND SPA</text>
          <text x="107" y="104" text-anchor="middle" fill="#cbd5e1" font-family="monospace" font-size="11">React · TypeScript</text>

          <!-- API Gateway / Cloud -->
          <rect x="215" y="45" width="145" height="95" rx="14" fill="#1e153a" stroke="${secondaryColor}" stroke-width="2"/>
          <text x="287" y="82" text-anchor="middle" fill="#c084fc" font-family="sans-serif" font-size="12" font-weight="800">CLOUD GATEWAY</text>
          <text x="287" y="104" text-anchor="middle" fill="#cbd5e1" font-family="monospace" font-size="11">REST · GraphQL · Edge</text>

          <!-- Database Cluster -->
          <rect x="390" y="45" width="135" height="95" rx="14" fill="#151c38" stroke="${accentColor}" stroke-width="2"/>
          <text x="457" y="82" text-anchor="middle" fill="#f472b6" font-family="sans-serif" font-size="12" font-weight="800">DATA CLUSTER</text>
          <text x="457" y="104" text-anchor="middle" fill="#cbd5e1" font-family="monospace" font-size="11">PostgreSQL · Redis</text>

          <!-- Conexiones -->
          <line x1="180" y1="92" x2="215" y2="92" stroke="${primaryColor}" stroke-width="3" stroke-dasharray="5 3"/>
          <line x1="360" y1="92" x2="390" y2="92" stroke="${secondaryColor}" stroke-width="3" stroke-dasharray="5 3"/>

          <!-- Infraestructura Cloud Inferior -->
          <rect x="35" y="185" width="490" height="140" rx="16" fill="#0a0e1d" stroke="#334155" stroke-width="1.5"/>
          <text x="60" y="218" fill="#38bdf8" font-family="monospace" font-size="13" font-weight="bold">$ kubectl get pods --namespace=production</text>
          <text x="60" y="246" fill="#34d399" font-family="monospace" font-size="12">✓ api-gateway-7f98d   Running   0   100% Healthy</text>
          <text x="60" y="272" fill="#34d399" font-family="monospace" font-size="12">✓ worker-cloud-4b21a  Running   0   Auto-Scaling</text>
          <text x="60" y="298" fill="#a855f7" font-family="monospace" font-size="12">⚡ Distributed Edge CDN Active · Multi-Region</text>
        </g>
      `;

    case 'ai-datascience':
      return `
        <!-- Red Neuronal & Nodos de IA -->
        <g transform="translate(580, 75)">
          <rect x="0" y="0" width="540" height="350" rx="22" fill="#100b24" fill-opacity="0.82" stroke="${primaryColor}" stroke-width="2" stroke-opacity="0.5"/>
          <!-- Conexiones sinápticas -->
          <line x1="110" y1="80" x2="270" y2="120" stroke="${primaryColor}" stroke-width="2" stroke-opacity="0.6"/>
          <line x1="110" y1="175" x2="270" y2="120" stroke="${secondaryColor}" stroke-width="2" stroke-opacity="0.6"/>
          <line x1="110" y1="175" x2="270" y2="230" stroke="${primaryColor}" stroke-width="2" stroke-opacity="0.6"/>
          <line x1="110" y1="270" x2="270" y2="230" stroke="${accentColor}" stroke-width="2" stroke-opacity="0.6"/>
          <line x1="270" y1="120" x2="430" y2="175" stroke="${secondaryColor}" stroke-width="3" stroke-opacity="0.85"/>
          <line x1="270" y1="230" x2="430" y2="175" stroke="${primaryColor}" stroke-width="3" stroke-opacity="0.85"/>
          <!-- Nodos -->
          <circle cx="110" cy="80" r="22" fill="#1e1b4b" stroke="${primaryColor}" stroke-width="3"/>
          <circle cx="110" cy="175" r="22" fill="#1e1b4b" stroke="${secondaryColor}" stroke-width="3"/>
          <circle cx="110" cy="270" r="22" fill="#1e1b4b" stroke="${accentColor}" stroke-width="3"/>
          <circle cx="270" cy="120" r="28" fill="#2e1065" stroke="${primaryColor}" stroke-width="3.5"/>
          <circle cx="270" cy="230" r="28" fill="#164e63" stroke="${secondaryColor}" stroke-width="3.5"/>
          <circle cx="430" cy="175" r="42" fill="${primaryColor}" fill-opacity="0.25" stroke="${secondaryColor}" stroke-width="4"/>
          <text x="430" y="182" text-anchor="middle" fill="#ffffff" font-family="sans-serif" font-size="20" font-weight="900">AI</text>
        </g>
      `;

    case 'cybersecurity':
      return `
        <!-- Escudo de Ciberseguridad & Red Protegida -->
        <g transform="translate(580, 75)">
          <rect x="0" y="0" width="540" height="350" rx="22" fill="#061812" fill-opacity="0.88" stroke="${primaryColor}" stroke-width="2" stroke-opacity="0.5"/>
          <path d="M 270 50 L 380 95 L 380 185 C 380 255 328 298 270 320 C 212 298 160 255 160 185 L 160 95 Z" fill="${primaryColor}" fill-opacity="0.15" stroke="${primaryColor}" stroke-width="3.5"/>
          <rect x="242" y="160" width="56" height="46" rx="8" fill="#064e3b" stroke="${accentColor}" stroke-width="2.5"/>
          <path d="M 254 160 L 254 142 A 16 16 0 0 1 286 142 L 286 160" fill="none" stroke="${accentColor}" stroke-width="3"/>
          <circle cx="270" cy="183" r="6" fill="#ffffff"/>
          <text x="45" y="95" fill="${accentColor}" font-family="monospace" font-size="12">TLS 1.3 · AES-256-GCM</text>
          <text x="45" y="295" fill="#94a3b8" font-family="monospace" font-size="12">ZERO-TRUST VERIFIED</text>
        </g>
      `;

    case 'devops-containers':
      return `
        <!-- Orquestación de Contenedores & Pipelines CI/CD -->
        <g transform="translate(570, 75)">
          <rect x="0" y="0" width="545" height="350" rx="22" fill="#081326" fill-opacity="0.88" stroke="${primaryColor}" stroke-width="2" stroke-opacity="0.5"/>
          <g transform="translate(50, 55)">
            <rect x="0" y="0" width="130" height="80" rx="12" fill="#0f2447" stroke="${primaryColor}" stroke-width="2"/>
            <text x="65" y="45" text-anchor="middle" fill="#ffffff" font-family="monospace" font-size="13" font-weight="bold">CONTAINER 01</text>
            <rect x="155" y="0" width="130" height="80" rx="12" fill="#0f2447" stroke="${secondaryColor}" stroke-width="2"/>
            <text x="220" y="45" text-anchor="middle" fill="#ffffff" font-family="monospace" font-size="13" font-weight="bold">CONTAINER 02</text>
            <rect x="310" y="0" width="130" height="80" rx="12" fill="#0f2447" stroke="${accentColor}" stroke-width="2"/>
            <text x="375" y="45" text-anchor="middle" fill="#ffffff" font-family="monospace" font-size="13" font-weight="bold">CONTAINER 03</text>
            <rect x="0" y="110" width="440" height="120" rx="14" fill="#0b1933" stroke="${secondaryColor}" stroke-width="2"/>
            <text x="220" y="158" text-anchor="middle" fill="${secondaryColor}" font-family="sans-serif" font-size="15" font-weight="800">KUBERNETES ORCHESTRATION ENGINE</text>
            <text x="220" y="188" text-anchor="middle" fill="#94a3b8" font-family="monospace" font-size="12">Build → Test → Security Scan → Production Rollout</text>
          </g>
        </g>
      `;

    case 'backend-database':
      return `
        <!-- Motores de Base de Datos & APIs Backend -->
        <g transform="translate(570, 75)">
          <rect x="0" y="0" width="545" height="350" rx="22" fill="#090d24" fill-opacity="0.88" stroke="${primaryColor}" stroke-width="2" stroke-opacity="0.5"/>
          <ellipse cx="170" cy="105" rx="85" ry="26" fill="#1e1b4b" stroke="${primaryColor}" stroke-width="2.5"/>
          <path d="M 85 105 L 85 170 A 85 26 0 0 0 255 170 L 255 105" fill="#1e1b4b" fill-opacity="0.6" stroke="${primaryColor}" stroke-width="2.5"/>
          <path d="M 85 170 L 85 235 A 85 26 0 0 0 255 235 L 255 170" fill="#1e1b4b" fill-opacity="0.8" stroke="${secondaryColor}" stroke-width="2.5"/>
          <rect x="305" y="85" width="195" height="175" rx="14" fill="#0f172a" stroke="${secondaryColor}" stroke-width="2"/>
          <text x="325" y="122" fill="${accentColor}" font-family="monospace" font-size="12" font-weight="bold">SELECT * FROM courses</text>
          <text x="325" y="148" fill="#cbd5e1" font-family="monospace" font-size="12">WHERE indexed = true</text>
          <text x="325" y="174" fill="#34d399" font-family="monospace" font-size="12">ORDER BY rank DESC;</text>
          <text x="325" y="218" fill="#94a3b8" font-family="monospace" font-size="11">0.4ms · ACID Compliant</text>
        </g>
      `;

    case 'mobile-ux':
      return `
        <!-- Dispositivos Móviles & Diseño de Interfaces -->
        <g transform="translate(610, 65)">
          <rect x="130" y="10" width="210" height="365" rx="28" fill="#130d26" stroke="${primaryColor}" stroke-width="3"/>
          <rect x="148" y="42" width="174" height="110" rx="14" fill="${primaryColor}" fill-opacity="0.2" stroke="${primaryColor}" stroke-width="1.5"/>
          <rect x="148" y="168" width="82" height="82" rx="12" fill="${secondaryColor}" fill-opacity="0.25" stroke="${secondaryColor}" stroke-width="1.5"/>
          <rect x="240" y="168" width="82" height="82" rx="12" fill="${accentColor}" fill-opacity="0.25" stroke="${accentColor}" stroke-width="1.5"/>
          <rect x="148" y="266" width="174" height="72" rx="12" fill="#1e1b4b" stroke="#475569" stroke-width="1.5"/>
        </g>
      `;

    default:
      return `
        <!-- Ilustración de Ingeniería de Software & Código -->
        <g transform="translate(565, 75)">
          <rect x="0" y="0" width="550" height="350" rx="20" fill="#0d1322" fill-opacity="0.88" stroke="${primaryColor}" stroke-width="2" stroke-opacity="0.5"/>
          <rect x="0" y="0" width="550" height="40" rx="20" fill="#161f33"/>
          <circle cx="24" cy="20" r="5" fill="#ef4444"/>
          <circle cx="42" cy="20" r="5" fill="#f59e0b"/>
          <circle cx="60" cy="20" r="5" fill="#10b981"/>
          <text x="86" y="24" fill="#94a3b8" font-family="monospace" font-size="12" font-weight="bold">docentos://studio/curriculum-engine.ts</text>
          <text x="36" y="88" fill="${primaryColor}" font-family="monospace" font-size="14" font-weight="bold">export async function masterProgram() {</text>
          <text x="60" y="122" fill="#cbd5e1" font-family="monospace" font-size="13">const modules = await loadCurriculum();</text>
          <text x="60" y="154" fill="#34d399" font-family="monospace" font-size="13">const skills = modules.applyPractice();</text>
          <text x="60" y="186" fill="#c084fc" font-family="monospace" font-size="13">return certifyExcellence(skills);</text>
          <text x="36" y="218" fill="${primaryColor}" font-family="monospace" font-size="14" font-weight="bold">}</text>
          <rect x="36" y="250" width="478" height="68" rx="12" fill="#11192c" stroke="${secondaryColor}" stroke-width="1.5" stroke-opacity="0.6"/>
          <text x="60" y="280" fill="#ffffff" font-family="sans-serif" font-size="13" font-weight="bold">⚡ Ruta de Aprendizaje Estructurada con IA</text>
          <text x="60" y="302" fill="#94a3b8" font-family="sans-serif" font-size="11">Módulos progresivos · Práctica real · Certificación verificable</text>
        </g>
      `;
  }
}

/**
 * Renderiza el emblema/logo del plugin en la esquina inferior izquierda de la portada (1200x675).
 * Se coloca en la esquina inferior izquierda con margen seguro para que destaque claramente
 * sin chocar con las insignias superiores ni con el botón central de reproducción.
 */
function renderCornerPluginLogo(brand: CustomizerBrandInfo): string {
  const safeBrandName = escapeXml(brand.brandName || 'DocentOS');
  const safeInitial = escapeXml(brand.logoInitial || 'D');
  const safeLogoUrl = brand.logoUrl ? escapeXml(brand.logoUrl) : '';

  const logoGraphic = safeLogoUrl
    ? `<image href="${safeLogoUrl}" x="60" y="568" width="48" height="48" preserveAspectRatio="xMidYMid slice" clip-path="url(#cornerLogoClip)"/>`
    : `
      <rect x="60" y="568" width="48" height="48" rx="12" fill="url(#docentosBrandGrad)"/>
      <rect x="63" y="571" width="42" height="42" rx="10" fill="#090912"/>
      <text x="84" y="600" text-anchor="middle" fill="url(#docentosTextGrad)" font-family="sans-serif" font-size="24" font-weight="900">${safeInitial}</text>
    `;

  return `
    <!-- Esquina Inferior Izquierda: Logo del Plugin (Por defecto DocentOS) -->
    <g id="docentos-corner-logo">
      <rect x="44" y="554" width="290" height="76" rx="20" fill="#07070c" fill-opacity="0.92" stroke="url(#docentosBrandGrad)" stroke-width="2.5"/>
      ${logoGraphic}
      <text x="122" y="592" fill="#ffffff" font-family="sans-serif" font-size="24" font-weight="900" letter-spacing="-0.5">${safeBrandName}<tspan fill="#06b6d4">.</tspan></text>
      <text x="122" y="613" fill="#22d3ee" font-family="sans-serif" font-size="11" font-weight="800" letter-spacing="1.4">OFFICIAL COURSE</text>
    </g>
  `;
}

/**
 * Divide un título en hasta 3 líneas para el bloque tipográfico izquierdo de la portada.
 */
function wrapHeadline(text: string, maxCharsPerLine = 22): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxCharsPerLine || !current) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
      if (lines.length === 2) break;
    }
  }
  if (current && lines.length < 3) {
    lines.push(current.length > maxCharsPerLine + 4 ? `${current.slice(0, maxCharsPerLine + 2)}…` : current);
  }
  return lines.slice(0, 3);
}

/**
 * Construye el SVG final de alta resolución (1200x675) como Data URL.
 */
export function buildCourseCoverSvgDataUrl(spec: CoverThemeSpec, brand: CustomizerBrandInfo): string {
  const lines = wrapHeadline(spec.headline);
  const safeTag = escapeXml(spec.topicTag);
  const safeSubline = escapeXml(spec.subline);

  const bgImageLayer = spec.aiBase64Image
    ? `<image href="${spec.aiBase64Image}" x="0" y="0" width="1200" height="675" preserveAspectRatio="xMidYMid slice" opacity="0.55"/>
       <rect width="1200" height="675" fill="url(#bgGrad)" fill-opacity="0.65"/>`
    : `<rect width="1200" height="675" fill="url(#bgGrad)"/>`;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 675" width="1200" height="675" data-generator="docentos-ai-cover">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${spec.bgStart}"/>
      <stop offset="55%" stop-color="#0b1020"/>
      <stop offset="100%" stop-color="${spec.bgEnd}"/>
    </linearGradient>
    <linearGradient id="docentosBrandGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#06b6d4"/>
      <stop offset="25%" stop-color="#3b82f6"/>
      <stop offset="50%" stop-color="#a855f7"/>
      <stop offset="75%" stop-color="#ec4899"/>
      <stop offset="100%" stop-color="#f59e0b"/>
    </linearGradient>
    <linearGradient id="docentosTextGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#06b6d4"/>
      <stop offset="100%" stop-color="#a855f7"/>
    </linearGradient>
    <radialGradient id="glowPrimary" cx="75%" cy="40%" r="45%">
      <stop offset="0%" stop-color="${spec.primaryColor}" stop-opacity="0.32"/>
      <stop offset="100%" stop-color="${spec.primaryColor}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glowSecondary" cx="20%" cy="75%" r="40%">
      <stop offset="0%" stop-color="${spec.secondaryColor}" stop-opacity="0.24"/>
      <stop offset="100%" stop-color="${spec.secondaryColor}" stop-opacity="0"/>
    </radialGradient>
    <clipPath id="cornerLogoClip">
      <rect x="60" y="568" width="48" height="48" rx="12"/>
    </clipPath>
    <pattern id="techGrid" width="48" height="48" patternUnits="userSpaceOnUse">
      <path d="M 48 0 L 0 0 0 48" fill="none" stroke="#ffffff" stroke-width="1" stroke-opacity="0.04"/>
    </pattern>
  </defs>

  <!-- Fondo Base y Malla Técnica -->
  ${bgImageLayer}
  <rect width="1200" height="675" fill="url(#techGrid)"/>
  <rect width="1200" height="675" fill="url(#glowPrimary)"/>
  <rect width="1200" height="675" fill="url(#glowSecondary)"/>

  <!-- Ilustración Temática del Curso -->
  ${renderArchetypeArtwork(spec)}

  <!-- Columna Tipográfica del Curso (Izquierda) -->
  <g transform="translate(56, 130)">
    <rect x="0" y="0" width="${Math.min(440, Math.max(210, safeTag.length * 11 + 36))}" height="36" rx="18" fill="${spec.primaryColor}" fill-opacity="0.16" stroke="${spec.primaryColor}" stroke-width="1.5"/>
    <text x="20" y="23" fill="${spec.primaryColor}" font-family="sans-serif" font-size="13" font-weight="800" letter-spacing="1.4">${safeTag}</text>

    ${lines
      .map(
        (line, idx) =>
          `<text x="0" y="${92 + idx * 52}" fill="#ffffff" font-family="sans-serif" font-size="42" font-weight="900" letter-spacing="-1">${escapeXml(line)}</text>`,
      )
      .join('\n    ')}

    <text x="0" y="${108 + lines.length * 52}" fill="#94a3b8" font-family="sans-serif" font-size="16" font-weight="600">${safeSubline}</text>
  </g>

  <!-- Insignia Inferior Derecha: Generado con IA -->
  <g transform="translate(930, 574)">
    <rect x="0" y="0" width="215" height="46" rx="14" fill="#0b0f19" fill-opacity="0.88" stroke="${spec.primaryColor}" stroke-width="1.5" stroke-opacity="0.6"/>
    <circle cx="24" cy="23" r="6" fill="${spec.primaryColor}"/>
    <text x="40" y="28" fill="#e2e8f0" font-family="sans-serif" font-size="13" font-weight="700">✨ AI Course Artwork</text>
  </g>

  <!-- Esquina Inferior Izquierda: Logo del Plugin (DocentOS por defecto o personalizado) -->
  ${renderCornerPluginLogo(brand)}
</svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/**
 * Genera automáticamente con IA la portada de un curso referente a su temática
 * e incrusta en la esquina el logo activo del plugin de personalización.
 */
export async function generateCourseCoverWithAi(params: {
  title: string;
  category?: string;
  description?: string;
  customBrand?: CustomizerBrandInfo;
}): Promise<string> {
  const brand = params.customBrand || (await getActiveCustomizerBrand());
  const baseSpec = detectArchetype(params.title, params.category, params.description);

  // Intentar enriquecer el subtítulo y etiqueta temática con el proveedor de IA si está activo
  const geminiKey = config.GEMINI_API_KEY || config.AI_API_KEY || process.env.GEMINI_API_KEY;
  const isTestEnv = process.env.NODE_ENV === 'test' || Boolean(process.env.DOCENTOS_SKIP_LISTEN);

  if (geminiKey && !isTestEnv) {
    try {
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Timeout de generación de portada con IA')), 3500)
      );

      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey: geminiKey });
      const apiCall = ai.interactions.create({
        model: 'gemini-3.8-flash',
        input: `Genera metadatos visuales concisos en español para la portada de un curso llamado "${params.title}" (Categoría: "${params.category || ''}", Descripción: "${(params.description || '').slice(0, 200)}").
Devuelve SOLO un JSON con esta forma exacta:
{"headline": "Título corto impactante (máx 42 caracteres)", "topicTag": "ETIQUETA TEMÁTICA EN MAYÚSCULAS (máx 26 caracteres)", "subline": "3 conceptos clave separados por · (máx 55 caracteres)"}`,
      });

      const response = await Promise.race([apiCall, timeoutPromise]);
      const text = response.output_text || '';
      const start = text.indexOf('{');
      const end = text.lastIndexOf('}');
      if (start !== -1 && end > start) {
        const parsed = JSON.parse(text.slice(start, end + 1));
        if (parsed.headline && typeof parsed.headline === 'string') {
          baseSpec.headline = parsed.headline.trim().slice(0, 48);
        }
        if (parsed.topicTag && typeof parsed.topicTag === 'string') {
          baseSpec.topicTag = parsed.topicTag.trim().toUpperCase().slice(0, 28);
        }
        if (parsed.subline && typeof parsed.subline === 'string') {
          baseSpec.subline = parsed.subline.trim().slice(0, 60);
        }
      }
    } catch {
      // Continúa con el diseño determinista de baseSpec sin bloquear la creación del curso
    }
  } else if (isAiEnabled() && !isTestEnv) {
    try {
      const res = await requestAiJson({
        system: 'Eres un director de arte de portadas educativas. Responde solo en JSON válido.',
        user: `Curso: "${params.title}" (${params.category || ''}). Devuelve {"headline": "máx 42 chars", "topicTag": "MÁX 26 CHARS", "subline": "3 conceptos clave separados por ·"}`,
        maxOutputTokens: 200,
        timeoutMs: 6000,
      });
      const data = res.data as Record<string, unknown>;
      if (typeof data?.headline === 'string' && data.headline.trim()) {
        baseSpec.headline = data.headline.trim().slice(0, 48);
      }
      if (typeof data?.topicTag === 'string' && data.topicTag.trim()) {
        baseSpec.topicTag = data.topicTag.trim().toUpperCase().slice(0, 28);
      }
      if (typeof data?.subline === 'string' && data.subline.trim()) {
        baseSpec.subline = data.subline.trim().slice(0, 60);
      }
    } catch {
      // Respaldo determinista inmediato
    }
  }

  return buildCourseCoverSvgDataUrl(baseSpec, brand);
}

/**
 * Actualiza todas las portadas de cursos que aún tengan la foto genérica por defecto
 * o que hayan sido generadas por IA (por ejemplo, cuando cambia el logo del plugin).
 */
export async function syncCoursesCoversWithBrand(options: { forceAllAiCovers?: boolean } = {}): Promise<number> {
  try {
    const brand = await getActiveCustomizerBrand();
    const courses = await prisma.course.findMany({
      select: { id: true, title: true, category: true, description: true, coverImage: true },
    });

    let updatedCount = 0;
    for (const course of courses) {
      const shouldUpdate =
        isGenericCoverImage(course.coverImage) ||
        (options.forceAllAiCovers && isAiGeneratedCover(course.coverImage));

      if (!shouldUpdate) continue;

      const spec = detectArchetype(course.title, course.category, course.description);
      const newCover = buildCourseCoverSvgDataUrl(spec, brand);
      await prisma.course.update({
        where: { id: course.id },
        data: { coverImage: newCover },
      });
      updatedCount++;
    }
    return updatedCount;
  } catch (err) {
    logger.warn('courseCoverAi.sync_failed', { reason: String(err) });
    return 0;
  }
}
