import 'dotenv/config';
import { z } from 'zod';

const optionalString = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.string().trim().optional(),
);

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
  GOOGLE_DRIVE_API_KEY: optionalString,
  GOOGLE_DRIVE_CLIENT_EMAIL: optionalString,
  GOOGLE_DRIVE_PRIVATE_KEY: optionalString,
  GOOGLE_DRIVE_FOLDER_ID: optionalString,
  STRIPE_SECRET_KEY: optionalString,
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

const databaseUrl = new URL(raw.DATABASE_URL);
if (!['postgres:', 'postgresql:'].includes(databaseUrl.protocol)) {
  throw new Error('Configuracion de DocentOS invalida: DATABASE_URL debe apuntar a PostgreSQL.');
}

export const config = {
  ...raw,
  DOCENTOS_ENV: deploymentEnvironment,
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
