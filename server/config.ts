import 'dotenv/config';
import { z } from 'zod';

const optionalString = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.string().trim().optional(),
);

/**
 * Un valor ausente y una cadena vacia significan lo mismo en un `.env` y en un
 * `docker-compose`: "usa el valor por defecto". Zod no lo asume, asi que las
 * claves ajustables se normalizan antes de validarse.
 */
const withDefault = <T extends z.ZodTypeAny>(schema: T, defaultValue: unknown) =>
  z.preprocess(
    (value) => (value === undefined || (typeof value === 'string' && value.trim() === '') ? defaultValue : value),
    schema,
  );

const numberWithDefault = (defaultValue: number, min: number, max: number) =>
  withDefault(z.coerce.number().int().min(min).max(max), defaultValue);

const booleanString = (defaultValue: boolean) =>
  z.preprocess(
    (value) => {
      if (value === undefined || value === '') return defaultValue;
      if (typeof value === 'boolean') return value;
      if (value === 'true') return true;
      if (value === 'false') return false;
      return value;
    },
    z.boolean(),
  );

const rawSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DOCENTOS_ENV: z.enum(['development', 'staging', 'production']).optional(),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.string().trim().min(1, 'DATABASE_URL es obligatoria'),
  APP_URL: z.string().url().default('http://localhost:3000'),
  ALLOWED_ORIGIN: optionalString,
  DOCENTOS_EDITION: z.string().trim().min(1).default('community'),
  GIT_COMMIT_SHA: optionalString,
  TRUST_PROXY: z.string().trim().default('false'),
  SESSION_COOKIE_NAME: z.string().trim().min(1).max(100).default('docentos_session'),
  SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(30).default(7),
  SESSION_COOKIE_SECURE: z.enum(['', 'true', 'false']).default(''),
  PASSWORD_RESET_TTL_MINUTES: z.coerce.number().int().min(5).max(120).default(30),
  PASSWORD_RESET_WEBHOOK_URL: optionalString,
  PASSWORD_RESET_WEBHOOK_TOKEN: optionalString,
  PASSWORD_RESET_EXPOSE_TOKEN: booleanString(false),
  SEED_DEMO_DATA: booleanString(false),
  APP_NAME: optionalString,
  APP_TAGLINE: optionalString,
  APP_LOGO_INITIAL: optionalString,
  APP_LOGO_URL: optionalString,
  POWERED_BY_TEXT: optionalString,
  POWERED_BY_LINK: optionalString,
  AUTHOR_CREDIT: optionalString,
  DEFAULT_LANG: z.enum(['es', 'en', 'pt', 'fr', 'it']).default('es'),
  AI_ASSISTANT_NAME: optionalString,
  GIANTUCCHI_TELEMETRY_WEBHOOK: optionalString,
  GEMINI_API_KEY: optionalString,

  // Proveedor de IA para la organizacion de cursos importados. `auto` prefiere
  // OpenAI y cae a DeepSeek cuando solo esta configurada esa clave; sin ninguna
  // de las dos la importacion sigue funcionando de forma determinista.
  AI_PROVIDER: withDefault(z.enum(['auto', 'openai', 'deepseek', 'none']), 'auto'),
  AI_REQUEST_TIMEOUT_MS: numberWithDefault(60_000, 5_000, 300_000),
  OPENAI_API_KEY: optionalString,
  OPENAI_BASE_URL: withDefault(z.string().trim().url(), 'https://api.openai.com/v1'),
  OPENAI_MODEL: withDefault(z.string().trim().min(1), 'gpt-4o-mini'),
  DEEPSEEK_API_KEY: optionalString,
  DEEPSEEK_BASE_URL: withDefault(z.string().trim().url(), 'https://api.deepseek.com'),
  DEEPSEEK_MODEL: withDefault(z.string().trim().min(1), 'deepseek-chat'),

  // Topes del recorrido de carpetas de Drive. Existen para que una carpeta
  // enorme o con ciclos no consuma el proceso: el recorrido se detiene y
  // devuelve lo leido en vez de quedarse colgado.
  DRIVE_IMPORT_ENABLED: booleanString(true),
  DRIVE_IMPORT_MAX_DEPTH: numberWithDefault(4, 1, 8),
  DRIVE_IMPORT_MAX_NODES: numberWithDefault(3_000, 10, 20_000),
  DRIVE_IMPORT_CONCURRENCY: numberWithDefault(4, 1, 8),
  DRIVE_IMPORT_TIMEOUT_MS: numberWithDefault(120_000, 5_000, 600_000),
  GOOGLE_DRIVE_API_KEY: optionalString,
  GOOGLE_DRIVE_CLIENT_EMAIL: optionalString,
  GOOGLE_DRIVE_PRIVATE_KEY: optionalString,
  GOOGLE_DRIVE_FOLDER_ID: optionalString,
  STRIPE_SECRET_KEY: optionalString,
  STRIPE_WEBHOOK_SECRET: optionalString,
  VITE_APP_NAME: optionalString,
  VITE_APP_TAGLINE: optionalString,
  VITE_APP_LOGO_INITIAL: optionalString,
  VITE_APP_LOGO_URL: optionalString,
  VITE_POWERED_BY_TEXT: optionalString,
  VITE_POWERED_BY_LINK: optionalString,
  VITE_AUTHOR_CREDIT: optionalString,
  VITE_DEFAULT_LANG: optionalString,
  VITE_AI_ASSISTANT_NAME: optionalString,
});

const parsed = rawSchema.safeParse(process.env);
if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `${issue.path.join('.') || 'entorno'}: ${issue.message}`)
    .join('; ');
  throw new Error(`Configuracion de DocentOS invalida: ${details}`);
}

const raw = parsed.data;
const deploymentEnvironment = raw.DOCENTOS_ENV || (raw.NODE_ENV === 'production' ? 'production' : 'development');
const appUrl = new URL(raw.APP_URL);
const allowedOrigins = (raw.ALLOWED_ORIGIN || raw.APP_URL)
  .split(',')
  .map((origin) => origin.trim().replace(/\/$/, ''))
  .filter(Boolean);

for (const origin of allowedOrigins) {
  if (origin === '*' || !['http:', 'https:'].includes(new URL(origin).protocol)) {
    throw new Error(`Configuracion de DocentOS invalida: ALLOWED_ORIGIN contiene ${origin}.`);
  }
}

const isLoopback = ['localhost', '127.0.0.1', '::1'].includes(appUrl.hostname);
if (deploymentEnvironment === 'production' && appUrl.protocol !== 'https:' && !isLoopback) {
  throw new Error('Configuracion de DocentOS invalida: APP_URL debe usar HTTPS en produccion.');
}
if (raw.SESSION_COOKIE_SECURE === 'false' && appUrl.protocol === 'https:') {
  throw new Error('Configuracion de DocentOS invalida: no se puede desactivar Secure con APP_URL HTTPS.');
}
if (deploymentEnvironment === 'production' && raw.PASSWORD_RESET_EXPOSE_TOKEN) {
  throw new Error('Configuracion de DocentOS invalida: PASSWORD_RESET_EXPOSE_TOKEN debe ser false en produccion.');
}
if (deploymentEnvironment === 'production' && raw.SEED_DEMO_DATA) {
  throw new Error('Configuracion de DocentOS invalida: SEED_DEMO_DATA no puede activarse en produccion.');
}
if (deploymentEnvironment === 'production' && raw.STRIPE_SECRET_KEY && !raw.STRIPE_WEBHOOK_SECRET) {
  throw new Error(
    'Configuracion de DocentOS invalida: STRIPE_WEBHOOK_SECRET es obligatorio en produccion cuando STRIPE_SECRET_KEY esta definido; sin el, los webhooks no pueden verificarse.',
  );
}

/**
 * Confianza en X-Forwarded-For. Debe permanecer desactivada cuando DocentOS
 * atiende peticiones directamente: si se confia en la cabecera sin un proxy
 * delante, cualquier cliente puede rotar su IP aparente y esquivar los limites
 * de intentos de login. Solo se activa cuando el operador declara su proxy.
 */
export function parseTrustProxy(value: string): boolean | number | string[] {
  const normalized = value.trim();
  if (normalized === '' || normalized === 'false' || normalized === '0') return false;
  if (normalized === 'true') return true;
  if (/^\d+$/.test(normalized)) return Number(normalized);
  return normalized.split(',').map((entry) => entry.trim()).filter(Boolean);
}

const trustProxy = parseTrustProxy(raw.TRUST_PROXY);
if (trustProxy === true) {
  console.warn(
    'DocentOS: TRUST_PROXY=true confia en cualquier X-Forwarded-For. Usa el numero de saltos (por ejemplo 1) o la lista de IPs de tu proxy.',
  );
}

export type AiProviderName = 'openai' | 'deepseek' | 'none';

/**
 * Decide que proveedor de IA atiende la organizacion de cursos.
 *
 * Con `auto` gana OpenAI y DeepSeek queda como respaldo, que es el orden que
 * espera el operador. Un valor explicito no cae al otro proveedor: elegir
 * `openai` y terminar hablando con DeepSeek seria una sorpresa desagradable
 * cuando lo que se queria era detectar que falta la clave.
 */
export function resolveAiProvider(input: {
  preference: 'auto' | 'openai' | 'deepseek' | 'none';
  openaiApiKey?: string;
  deepseekApiKey?: string;
}): AiProviderName {
  const hasOpenAi = Boolean(input.openaiApiKey);
  const hasDeepSeek = Boolean(input.deepseekApiKey);

  switch (input.preference) {
    case 'none':
      return 'none';
    case 'openai':
      return hasOpenAi ? 'openai' : 'none';
    case 'deepseek':
      return hasDeepSeek ? 'deepseek' : 'none';
    default:
      if (hasOpenAi) return 'openai';
      if (hasDeepSeek) return 'deepseek';
      return 'none';
  }
}

const aiProvider = resolveAiProvider({
  preference: raw.AI_PROVIDER,
  openaiApiKey: raw.OPENAI_API_KEY,
  deepseekApiKey: raw.DEEPSEEK_API_KEY,
});

if (raw.AI_PROVIDER !== 'auto' && raw.AI_PROVIDER !== 'none' && aiProvider === 'none') {
  console.warn(
    `DocentOS: AI_PROVIDER=${raw.AI_PROVIDER} pero falta su clave de API. La organizacion con IA queda desactivada; la importacion desde Drive sigue disponible sin ella.`,
  );
}

const databaseUrl = new URL(raw.DATABASE_URL);
if (!['postgres:', 'postgresql:'].includes(databaseUrl.protocol)) {
  throw new Error('Configuracion de DocentOS invalida: DATABASE_URL debe apuntar a PostgreSQL.');
}

export const config = {
  ...raw,
  DOCENTOS_ENV: deploymentEnvironment,
  TRUST_PROXY: trustProxy,
  AI_PROVIDER: aiProvider,
  AI_PROVIDER_PREFERENCE: raw.AI_PROVIDER,
  ALLOWED_ORIGINS: [...new Set(allowedOrigins)],
  APP_NAME: raw.APP_NAME || raw.VITE_APP_NAME || 'DocentOS',
  APP_TAGLINE: raw.APP_TAGLINE || raw.VITE_APP_TAGLINE || 'Plataforma e-Learning Open Source',
  APP_LOGO_INITIAL: raw.APP_LOGO_INITIAL || raw.VITE_APP_LOGO_INITIAL || 'D',
  APP_LOGO_URL: raw.APP_LOGO_URL || raw.VITE_APP_LOGO_URL || '',
  POWERED_BY_TEXT: raw.POWERED_BY_TEXT || raw.VITE_POWERED_BY_TEXT || 'Powered by DocentOS LMS Engine',
  POWERED_BY_LINK:
    raw.POWERED_BY_LINK || raw.VITE_POWERED_BY_LINK || 'https://github.com/giantucchi-org/docentos',
  AUTHOR_CREDIT: raw.AUTHOR_CREDIT || raw.VITE_AUTHOR_CREDIT || 'DocentOS Community Edition',
  DEFAULT_LANG:
    (raw.DEFAULT_LANG || raw.VITE_DEFAULT_LANG || 'es') as 'es' | 'en' | 'pt' | 'fr' | 'it',
  AI_ASSISTANT_NAME: raw.AI_ASSISTANT_NAME || raw.VITE_AI_ASSISTANT_NAME || 'Ian',
} as const;

export type DocentOSConfig = typeof config;
