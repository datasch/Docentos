export type StrikeAction = 'add_strike' | 'remove_strike' | 'reset';

/**
 * Máximo de strikes por usuario; lo comparten el panel y el servidor.
 * Al llegar a este total la cuenta se suspende automáticamente.
 */
export const MAX_USER_STRIKES = 5;

/** Verdadero si el total de strikes obliga a suspender la cuenta. */
export function strikesSuspendAccount(strikes: number): boolean {
  return Number.isFinite(strikes) && strikes >= MAX_USER_STRIKES;
}

/**
 * Nuevo total de strikes tras una acción de moderación. Quitar un strike sirve para
 * corregir uno puesto por error: nunca baja de 0 ni pasa del máximo.
 */
export function nextStrikes(current: number, action: StrikeAction): number {
  const base = Number.isFinite(current) ? Math.trunc(current) : 0;
  if (action === 'add_strike') return Math.min(MAX_USER_STRIKES, Math.max(0, base) + 1);
  if (action === 'remove_strike') return Math.max(0, base - 1);
  return 0;
}
