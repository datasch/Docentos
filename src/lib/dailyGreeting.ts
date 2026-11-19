/**
 * Saludo de la portada segun la visita del dia.
 *
 * La primera visita del dia saluda con "Bienvenido/a" y las siguientes con
 * "Hola de nuevo". El dia cambia a medianoche en Peru (America/Lima, UTC-5 todo
 * el ano, sin horario de verano), no en la zona del navegador ni en UTC.
 *
 * La ultima fecha en que se dio la bienvenida se guarda por usuario en el
 * navegador: no necesita migrar la base de datos. Limite conocido: otro
 * dispositivo o navegador cuenta como primera visita.
 */

export type GreetingKind = 'welcome' | 'back';

export const GREETING_TIME_ZONE = 'America/Lima';
const STORAGE_PREFIX = 'docentos:greeting:';

/** Fecha "YYYY-MM-DD" del instante dado en la zona horaria de Peru. */
export function limaDateKey(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: GREETING_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const pick = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return `${pick('year')}-${pick('month')}-${pick('day')}`;
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

function defaultStorage(): StorageLike | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

/**
 * Decide el saludo y deja anotado que hoy ya se dio la bienvenida.
 * Sin almacenamiento disponible siempre da la bienvenida.
 */
export function decideGreeting(
  userId: string,
  now: Date = new Date(),
  storage: StorageLike | null = defaultStorage(),
): GreetingKind {
  if (!storage) return 'welcome';
  const today = limaDateKey(now);
  const key = `${STORAGE_PREFIX}${userId}`;
  try {
    if (storage.getItem(key) === today) return 'back';
    storage.setItem(key, today);
  } catch {
    return 'welcome';
  }
  return 'welcome';
}

// El resultado se fija una vez por carga de pagina: cambiar de pestana dentro de
// la app (o el doble render de desarrollo) no debe convertir "Bienvenido/a" en
// "Hola de nuevo". Recargar la pagina si cuenta como volver a entrar.
const resolvedThisPageLoad = new Map<string, GreetingKind>();

export function greetingForThisVisit(userId: string): GreetingKind {
  const cached = resolvedThisPageLoad.get(userId);
  if (cached) return cached;
  const kind = decideGreeting(userId);
  resolvedThisPageLoad.set(userId, kind);
  return kind;
}

/** Solo para pruebas. */
export function resetGreetingCache(): void {
  resolvedThisPageLoad.clear();
}
