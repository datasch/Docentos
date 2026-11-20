/**
 * Elige la voz TTS según el idioma real del texto.
 *
 * Una guía guarda una voz (por defecto en español); si su texto está en otro
 * idioma, leerlo con esa voz suena a acento extranjero. Aquí se detecta el
 * idioma con tinyld (variante ligera, limitada a los idiomas de la app) y se
 * cambia de voz solo cuando la detección es clara y no coincide con la elegida.
 */
import { detectAll } from 'tinyld/light';

export const TTS_DETECTABLE_LANGUAGES = ['es', 'en', 'pt', 'fr', 'it'] as const;

/** Voz por defecto de cada idioma cuando hay que sustituir la elegida. */
const DEFAULT_VOICE_BY_LANGUAGE: Record<string, string> = {
  es: 'es-ES-Carlos',
  en: 'en-US-Elena',
  pt: 'pt-BR-Lucas',
  fr: 'fr-FR-Claire',
  it: 'it-IT-Marco',
};

/** Textos más cortos que esto no dan una detección fiable. */
const MIN_DETECTION_LENGTH = 24;

/** Código base de idioma de un id de voz: 'en-US-Elena' → 'en'. */
export function voiceLanguage(voiceId?: string): string {
  return (voiceId || '').split('-')[0].toLowerCase();
}

/**
 * Idioma del texto o `null` si no se puede afirmar. Los puntajes de tinyld son
 * relativos, así que se exige que el primero supere con claridad al segundo.
 */
export function detectTextLanguage(text: string): string | null {
  const sample = text.replace(/https?:\/\/\S+/g, ' ').replace(/\s+/g, ' ').trim();
  if (sample.length < MIN_DETECTION_LENGTH) return null;
  const ranking = detectAll(sample, { only: [...TTS_DETECTABLE_LANGUAGES] });
  const [first, second] = ranking;
  if (!first || first.accuracy < 0.05) return null;
  if (second && first.accuracy < second.accuracy * 1.4) return null;
  return first.lang;
}

/**
 * Voz a usar: la elegida si coincide con el idioma del texto (o no se puede
 * saber), y si no, la voz por defecto del idioma detectado.
 */
export function resolveVoiceForText(text: string, voiceId?: string): string | undefined {
  const detected = detectTextLanguage(text);
  if (!detected || detected === voiceLanguage(voiceId)) return voiceId;
  return DEFAULT_VOICE_BY_LANGUAGE[detected] || voiceId;
}
