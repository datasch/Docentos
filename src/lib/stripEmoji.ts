const EMOJI = /[\p{Extended_Pictographic}\p{Regional_Indicator}‍️⃣]/gu;

/** Quita emojis de un texto de interfaz y deja el resto limpio ("🔴 Masterclass ✨" → "Masterclass"). */
export function stripEmoji(value: string | null | undefined): string {
  if (!value) return '';
  return value
    .replace(EMOJI, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s\-–—|:·]+/, '')
    .trim();
}
