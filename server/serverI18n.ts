/**
 * Soporte de internacionalización para respuestas del servidor - DocentOS
 *
 * Localiza mensajes de error y respuestas de la API según:
 * 1. Parámetro de consulta `?lang=` (ej. /api/courses?lang=en)
 * 2. Cabecera HTTP `Accept-Language` (ej. 'en-US,en;q=0.9,es;q=0.8')
 * 3. Idioma predeterminado: 'es' (Español canónico)
 */

import type { Request, Response } from 'express';
import { RESPONSE_PATTERNS, RESPONSE_TRANSLATIONS } from './responseTranslations.js';

export const SERVER_LANGUAGES = ['es', 'en', 'pt', 'fr', 'it'] as const;
export type ServerLanguage = (typeof SERVER_LANGUAGES)[number];
export const DEFAULT_SERVER_LANGUAGE: ServerLanguage = 'es';

/**
 * Resuelve el idioma de la petición HTTP a partir de ?lang= o Accept-Language.
 */
export function resolveRequestLanguage(req?: Request | { query?: any; headers?: any }): ServerLanguage {
  if (!req) return DEFAULT_SERVER_LANGUAGE;

  // 1. Prioridad: query param ?lang=
  const queryLang = req.query?.lang;
  if (typeof queryLang === 'string' && queryLang.trim()) {
    const code = queryLang.trim().toLowerCase().slice(0, 2);
    if ((SERVER_LANGUAGES as readonly string[]).includes(code)) {
      return code as ServerLanguage;
    }
  }

  // 2. Cabecera Accept-Language
  const accept = req.headers?.['accept-language'];
  if (typeof accept === 'string' && accept.trim()) {
    // Parser sencillo de Accept-Language: busca el primer código coincidente
    const candidates = accept
      .split(',')
      .map((part) => part.split(';')[0].trim().toLowerCase().slice(0, 2));
    for (const cand of candidates) {
      if ((SERVER_LANGUAGES as readonly string[]).includes(cand)) {
        return cand as ServerLanguage;
      }
    }
  }

  return DEFAULT_SERVER_LANGUAGE;
}

export type ServerTranslationMap = Record<ServerLanguage, string>;

export const SERVER_MESSAGES: Record<string, ServerTranslationMap> = {
  AUTH_REQUIRED: {
    es: 'Debes iniciar sesión para continuar.',
    en: 'You must log in to continue.',
    pt: 'Você deve iniciar sessão para continuar.',
    fr: 'Vous devez vous connecter pour continuer.',
    it: 'Devi effettuare l\'accesso per continuare.',
  },
  ACCESS_DENIED: {
    es: 'Acceso denegado. Permisos insuficientes.',
    en: 'Access denied. Insufficient permissions.',
    pt: 'Acesso negado. Permissões insuficientes.',
    fr: 'Accès refusé. Permissions insuffisantes.',
    it: 'Accesso negato. Permessi insufficienti.',
  },
  CONTENT_ACCESS_DENIED: {
    es: 'No tienes acceso a este contenido.',
    en: 'You do not have access to this content.',
    pt: 'Você não tem acesso a este conteúdo.',
    fr: 'Vous n\'avez pas accès à ce contenu.',
    it: 'Non hai accesso a questo contenuto.',
  },
  RESOURCE_ACCESS_DENIED: {
    es: 'No tienes autorización para acceder a este recurso.',
    en: 'You are not authorized to access this resource.',
    pt: 'Você não tem autorização para acessar este recurso.',
    fr: 'Vous n\'êtes pas autorisé à accéder à cette ressource.',
    it: 'Non sei autorizzato ad accedere a questa risorsa.',
  },
  UNAUTHORIZED: {
    es: 'No autorizado.',
    en: 'Unauthorized.',
    pt: 'Não autorizado.',
    fr: 'Non autorisé.',
    it: 'Non autorizzato.',
  },
  COURSE_NOT_FOUND: {
    es: 'Curso no encontrado',
    en: 'Course not found',
    pt: 'Curso não encontrado',
    fr: 'Cours introuvable',
    it: 'Corso non trovato',
  },
  VIDEO_NOT_FOUND: {
    es: 'URL del video no disponible.',
    en: 'Video URL not available.',
    pt: 'URL do vídeo indisponível.',
    fr: 'URL de la vidéo non disponible.',
    it: 'URL del video non disponibile.',
  },
  RESOURCE_NOT_FOUND: {
    es: 'Recurso no encontrado.',
    en: 'Resource not found.',
    pt: 'Recurso não encontrado.',
    fr: 'Ressource introuvable.',
    it: 'Risorsa non trovata.',
  },
  RESOURCE_UNAVAILABLE: {
    es: 'Recurso no disponible.',
    en: 'Resource unavailable.',
    pt: 'Recurso indisponível.',
    fr: 'Ressource non disponible.',
    it: 'Risorsa non disponibile.',
  },
  CERTIFICATE_NOT_FOUND: {
    es: 'Certificado no encontrado.',
    en: 'Certificate not found.',
    pt: 'Certificado não encontrado.',
    fr: 'Certificat introuvable.',
    it: 'Certificato non trovato.',
  },
  CERTIFICATE_NOT_ISSUED: {
    es: 'Aún no se ha emitido un certificado para este curso.',
    en: 'A certificate has not yet been issued for this course.',
    pt: 'Ainda não foi emitido um certificado para este curso.',
    fr: 'Aucun certificat n\'a encore été émis pour ce cours.',
    it: 'Non è stato ancora emesso un certificato per questo corso.',
  },
  COMMENT_NOT_FOUND: {
    es: 'Comentario no encontrado',
    en: 'Comment not found',
    pt: 'Comentário não encontrado',
    fr: 'Commentaire introuvable',
    it: 'Commento non trovato',
  },
  PARENT_COMMENT_NOT_FOUND: {
    es: 'Comentario original no encontrado',
    en: 'Original comment not found',
    pt: 'Comentário original não encontrado',
    fr: 'Commentaire d\'origine introuvable',
    it: 'Commento originale non trovato',
  },
  INVALID_JSON: {
    es: 'Body JSON invalido',
    en: 'Invalid JSON body',
    pt: 'Corpo JSON inválido',
    fr: 'Corps JSON non valide',
    it: 'Corpo JSON non valido',
  },
  METHOD_NOT_ALLOWED: {
    es: 'Método no permitido.',
    en: 'Method not allowed.',
    pt: 'Método não permitido.',
    fr: 'Méthode non autorisée.',
    it: 'Metodo non consentito.',
  },
  UNSAFE_VIDEO_URL: {
    es: 'URL del video no segura.',
    en: 'Unsafe video URL.',
    pt: 'URL do vídeo não segura.',
    fr: 'URL de vidéo non sécurisée.',
    it: 'URL del video non sicuro.',
  },
  UNSAFE_RESOURCE_URL: {
    es: 'URL privada del recurso no segura.',
    en: 'Unsafe private resource URL.',
    pt: 'URL privada do recurso não segura.',
    fr: 'URL de ressource privée non sécurisée.',
    it: 'URL della risorsa privata non sicuro.',
  },
  VIDEO_ORIGIN_ERROR: {
    es: 'No se pudo conectar con el origen de video.',
    en: 'Could not connect to video source.',
    pt: 'Não foi possível conectar à origem do vídeo.',
    fr: 'Impossible de se connecter à la source vidéo.',
    it: 'Impossibile connettersi all\'origine del video.',
  },
  VIDEO_STREAM_ERROR: {
    es: 'Error al transmitir el flujo de video.',
    en: 'Error streaming video.',
    pt: 'Erro ao transmitir fluxo de vídeo.',
    fr: 'Erreur lors de la diffusion du flux vidéo.',
    it: 'Errore durante la trasmissione dello streaming video.',
  },
  RATE_LIMITED: {
    es: 'Has realizado varias solicitudes seguidas. Espera un momento antes de reintentar.',
    en: 'Too many requests. Please wait a moment before retrying.',
    pt: 'Muitas solicitações consecutivas. Aguarde um momento antes de tentar novamente.',
    fr: 'Trop de requêtes successives. Veuillez patienter avant de réessayer.',
    it: 'Troppe richieste successive. Attendi un momento prima di riprovare.',
  },
  RATE_LIMIT_UNAVAILABLE: {
    es: 'No se pudo verificar la protección de esta operación. Reintenta en unos momentos.',
    en: 'Could not verify rate limit protection. Please try again shortly.',
    pt: 'Não foi possível verificar a proteção desta operação. Tente novamente em instantes.',
    fr: 'Impossible de vérifier la protection de cette opération. Réessayez dans quelques instants.',
    it: 'Impossibile verificare la protezione di questa operazione. Riprova tra poco.',
  },
  LIVE_ALERTS_RATE_LIMITED: {
    es: 'Tienes demasiadas pestañas abiertas con avisos en vivo.',
    en: 'You have too many open tabs with live alerts.',
    pt: 'Você tem muitas abas abertas com avisos ao vivo.',
    fr: 'Vous avez trop d\'onglets ouverts avec alertes en direct.',
    it: 'Hai troppe schede aperte con avvisi in tempo reale.',
  },
  COURSE_ID_REQUIRED: {
    es: 'courseId es requerido',
    en: 'courseId is required',
    pt: 'courseId é obrigatório',
    fr: 'courseId est requis',
    it: 'courseId è richiesto',
  },
  VIDEO_ID_REQUIRED: {
    es: 'videoId es requerido',
    en: 'videoId is required',
    pt: 'videoId é obrigatório',
    fr: 'videoId est requis',
    it: 'videoId è richiesto',
  },
  PAYMENT_NOT_FOUND: {
    es: 'Registro de pago no encontrado.',
    en: 'Payment record not found.',
    pt: 'Registro de pagamento não encontrado.',
    fr: 'Enregistrement de paiement introuvable.',
    it: 'Record di pagamento non trovato.',
  },
  SERVICE_UNAVAILABLE: {
    es: 'Servicio temporalmente no disponible',
    en: 'Service temporarily unavailable',
    pt: 'Serviço temporariamente indisponível',
    fr: 'Service temporairement indisponible',
    it: 'Servizio temporaneamente non disponibile',
  },
  SETUP_REQUIRED: {
    es: 'Instalación inicial requerida (First Run Setup)',
    en: 'Initial installation required (First Run Setup)',
    pt: 'Instalação inicial necessária (First Run Setup)',
    fr: 'Installation initiale requise (First Run Setup)',
    it: 'Installazione iniziale richiesta (First Run Setup)',
  },
  CROSS_SITE_REJECTED: {
    es: 'Solicitud entre sitios rechazada.',
    en: 'Cross-site request rejected.',
    pt: 'Solicitação entre sites rejeitada.',
    fr: 'Requête intersites rejetée.',
    it: 'Richiesta cross-site rifiutata.',
  },
  ORIGIN_NOT_ALLOWED: {
    es: 'Origen de solicitud no autorizado.',
    en: 'Unauthorized request origin.',
    pt: 'Origem da solicitação não autorizada.',
    fr: 'Origine de la requête non autorisée.',
    it: 'Origine della richiesta non autorizzata.',
  },
  DRIVE_LINK_REQUIRED: {
    es: 'Pega el enlace de la carpeta de Google Drive.',
    en: 'Paste the Google Drive folder link.',
    pt: 'Cole o link da pasta do Google Drive.',
    fr: 'Collez le lien du dossier Google Drive.',
    it: 'Incolla il link della cartella Google Drive.',
  },
};

/**
 * Obtiene el mensaje localizado para un código, aplicando fallback al español y reemplazo de parámetros.
 */
export function getLocalizedMessage(
  code: string,
  lang: ServerLanguage,
  fallbackEs: string,
  params?: Record<string, string | number>,
): string {
  const translations = SERVER_MESSAGES[code];
  let text = (translations && translations[lang]) || fallbackEs;
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      text = text.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
    }
  }
  return text;
}

/**
 * Envia una respuesta JSON estandarizada con código y mensaje traducido.
 */
export function sendApiError(
  res: Response,
  req: Request | undefined,
  statusCode: number,
  code: string,
  defaultEs: string,
  extra: Record<string, any> = {},
): Response {
  const lang = resolveRequestLanguage(req);
  const localizedError = getLocalizedMessage(code, lang, defaultEs, extra);
  return res.status(statusCode).json({
    error: localizedError,
    code,
    ...extra,
  });
}

const RESPONSE_LANG_INDEX: Record<Exclude<ServerLanguage, 'es'>, number> = { en: 0, pt: 1, fr: 2, it: 3 };

/** Traduce un texto canónico en español al idioma pedido; si no está en el diccionario, lo deja igual. */
export function translateResponseText(text: string, lang: ServerLanguage): string {
  if (lang === 'es') return text;
  const entry = RESPONSE_TRANSLATIONS[text] ?? RESPONSE_TRANSLATIONS[text.trim()];
  if (entry) return entry[RESPONSE_LANG_INDEX[lang]];
  for (const { pattern, translate } of RESPONSE_PATTERNS) {
    const match = text.match(pattern);
    if (match) return translate(match)[RESPONSE_LANG_INDEX[lang]];
  }
  return text;
}

/**
 * Middleware: traduce `error` y `message` de toda respuesta JSON según el idioma
 * de la petición (`?lang=` o `Accept-Language`). Los handlers siguen escribiendo
 * el mensaje en español; los correos no pasan por aquí.
 */
export function localizeJsonResponses(req: Request, res: Response, next: () => void): void {
  const lang = resolveRequestLanguage(req);
  if (lang === 'es') return next();
  const originalJson = res.json.bind(res);
  res.json = ((body: unknown) => {
    if (body && typeof body === 'object' && !Array.isArray(body)) {
      const record = body as Record<string, unknown>;
      let changed: Record<string, unknown> | null = null;
      for (const field of ['error', 'message'] as const) {
        const value = record[field];
        if (typeof value === 'string') {
          const translated = translateResponseText(value, lang);
          if (translated !== value) {
            changed = changed ?? { ...record };
            changed[field] = translated;
          }
        }
      }
      if (changed) return originalJson(changed);
    }
    return originalJson(body);
  }) as Response['json'];
  next();
}
