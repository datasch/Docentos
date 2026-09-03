/**
 * Cliente unico para los proveedores de IA.
 *
 * OpenAI y DeepSeek hablan el mismo protocolo (`/chat/completions` con el
 * formato de OpenAI), asi que un solo adaptador cubre los dos y cambiar de
 * proveedor es cambiar una URL y una clave. Gemini no encaja aqui: tiene otro
 * protocolo y entraria como un adaptador aparte.
 *
 * Reglas de la casa:
 *
 *   - Sin claves, `AI_PROVIDER` vale `none` y nada de esto se invoca: la
 *     importacion determinista sigue funcionando igual.
 *   - Con `AI_PROVIDER=auto` y las dos claves configuradas, OpenAI atiende y
 *     DeepSeek queda de respaldo **tambien en caliente**: si OpenAI responde
 *     con un error o no responde, se reintenta con DeepSeek antes de rendirse.
 *   - Una preferencia explicita (`openai` o `deepseek`) no cambia de proveedor
 *     a escondidas: quien la fija sabe a donde quiere que vayan sus datos.
 */

import { config, type AiProviderName } from './config.js';
import { logger } from './logger.js';

export interface AiCandidate {
  provider: Exclude<AiProviderName, 'none'>;
  apiKey: string;
  baseUrl: string;
  model: string;
}

export type AiErrorCode = 'disabled' | 'unavailable' | 'invalid_response';

export class AiError extends Error {
  constructor(
    message: string,
    readonly code: AiErrorCode = 'unavailable',
  ) {
    super(message);
    this.name = 'AiError';
  }
}

interface AiSettings {
  provider: AiProviderName;
  preference: AiProviderName | 'auto';
  openaiApiKey?: string;
  openaiBaseUrl: string;
  openaiModel: string;
  deepseekApiKey?: string;
  deepseekBaseUrl: string;
  deepseekModel: string;
}

function currentSettings(): AiSettings {
  return {
    provider: config.AI_PROVIDER,
    preference: config.AI_PROVIDER_PREFERENCE,
    openaiApiKey: config.OPENAI_API_KEY,
    openaiBaseUrl: config.OPENAI_BASE_URL,
    openaiModel: config.OPENAI_MODEL,
    deepseekApiKey: config.DEEPSEEK_API_KEY,
    deepseekBaseUrl: config.DEEPSEEK_BASE_URL,
    deepseekModel: config.DEEPSEEK_MODEL,
  };
}

/**
 * Proveedores a los que se puede preguntar, en orden. El primero es el que
 * resolvio la configuracion; el segundo solo aparece con `auto`, como respaldo
 * para cuando el primero falla.
 */
export function listAiCandidates(settings: AiSettings = currentSettings()): AiCandidate[] {
  const openai: AiCandidate | null = settings.openaiApiKey
    ? {
        provider: 'openai',
        apiKey: settings.openaiApiKey,
        baseUrl: settings.openaiBaseUrl,
        model: settings.openaiModel,
      }
    : null;
  const deepseek: AiCandidate | null = settings.deepseekApiKey
    ? {
        provider: 'deepseek',
        apiKey: settings.deepseekApiKey,
        baseUrl: settings.deepseekBaseUrl,
        model: settings.deepseekModel,
      }
    : null;

  switch (settings.provider) {
    case 'none':
      return [];
    case 'openai':
      // Con preferencia explicita no hay respaldo: el administrador eligio.
      return openai ? (settings.preference === 'auto' ? [openai, deepseek] : [openai]).filter(isCandidate) : [];
    case 'deepseek':
      return deepseek ? (settings.preference === 'auto' ? [deepseek, openai] : [deepseek]).filter(isCandidate) : [];
    default:
      return [];
  }
}

function isCandidate(value: AiCandidate | null): value is AiCandidate {
  return value !== null;
}

export function isAiEnabled(): boolean {
  return listAiCandidates().length > 0;
}

/**
 * Extrae el objeto JSON de una respuesta del modelo. Aun pidiendo `json_object`
 * hay modelos que envuelven la respuesta en un bloque de codigo o le anteponen
 * una frase; recortar hasta las llaves es mas barato que reintentar.
 */
export function extractJsonObject(raw: string): unknown {
  const text = String(raw ?? '').trim();
  if (!text) throw new AiError('El proveedor de IA devolvió una respuesta vacía.', 'invalid_response');

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced ? fenced[1] : text).trim();
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end <= start) {
    throw new AiError('El proveedor de IA no devolvió un objeto JSON.', 'invalid_response');
  }

  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    throw new AiError('El JSON devuelto por la IA no se puede leer.', 'invalid_response');
  }
}

export interface AiJsonRequest {
  system: string;
  user: string;
  maxOutputTokens?: number;
  /** Inyectable para las pruebas; por defecto el `fetch` del proceso. */
  fetchImpl?: typeof fetch;
  candidates?: AiCandidate[];
  timeoutMs?: number;
}

export interface AiJsonResult {
  data: unknown;
  provider: AiCandidate['provider'];
  model: string;
  elapsedMs: number;
}

/**
 * Pregunta al modelo y devuelve la respuesta ya interpretada como JSON.
 *
 * Cada candidato tiene su propio plazo: un proveedor lento no puede consumir el
 * tiempo del respaldo. Los errores se registran sin la clave ni el contenido
 * enviado.
 */
export async function requestAiJson(request: AiJsonRequest): Promise<AiJsonResult> {
  const candidates = request.candidates ?? listAiCandidates();
  if (candidates.length === 0) {
    throw new AiError('No hay ningún proveedor de IA configurado.', 'disabled');
  }

  const fetchImpl = request.fetchImpl ?? fetch;
  const timeoutMs = request.timeoutMs ?? config.AI_REQUEST_TIMEOUT_MS;
  let lastError: unknown = null;

  for (const candidate of candidates) {
    const startedAt = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(`${candidate.baseUrl.replace(/\/+$/, '')}/chat/completions`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${candidate.apiKey}`,
        },
        body: JSON.stringify({
          model: candidate.model,
          temperature: 0.2,
          max_tokens: request.maxOutputTokens ?? 4_000,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: request.system },
            { role: 'user', content: request.user },
          ],
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const detail = (await response.text().catch(() => '')).slice(0, 200);
        throw new AiError(`${candidate.provider} respondió ${response.status}. ${detail}`);
      }

      const payload = (await response.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const content = payload?.choices?.[0]?.message?.content ?? '';
      return {
        data: extractJsonObject(content),
        provider: candidate.provider,
        model: candidate.model,
        elapsedMs: Date.now() - startedAt,
      };
    } catch (error) {
      lastError = error;
      logger.warn('ai.request.failed', {
        provider: candidate.provider,
        model: candidate.model,
        elapsedMs: Date.now() - startedAt,
        reason: error instanceof Error ? error.message : String(error),
      });
    } finally {
      clearTimeout(timer);
    }
  }

  if (lastError instanceof AiError) throw lastError;
  throw new AiError(
    `Ningún proveedor de IA pudo atender la petición: ${lastError instanceof Error ? lastError.message : 'error desconocido'}`,
  );
}
