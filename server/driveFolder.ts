/**
 * Lectura recursiva de una carpeta de Google Drive.
 *
 * El recorrido vive en el servidor por dos razones: el navegador no puede leer
 * `drive.google.com` por CORS, y las credenciales de Drive no deben salir del
 * contenedor.
 *
 * Hay dos estrategias:
 *
 *   - `apikey`: Drive API v3 con las credenciales ya configuradas en
 *     `driveService`. Aporta la duracion real de cada video y funciona con
 *     carpetas restringidas a las que la cuenta tenga acceso.
 *   - `public`: se lee la pagina publica de la carpeta y se extrae el listado
 *     que Google incrusta en `window['_DRIVE_ivd']`. No necesita ninguna
 *     credencial, a cambio de depender de un formato interno que Google puede
 *     cambiar sin aviso. Cuando eso ocurra, el error lo dice explicitamente.
 *
 * Ninguna de las dos descarga la URL que pega el administrador: se extrae el
 * identificador de carpeta y se reconstruye la direccion, de modo que el enlace
 * no puede usarse para alcanzar servicios internos.
 */

import { getDriveClient } from './driveService.js';

export const FOLDER_MIME = 'application/vnd.google-apps.folder';
export const SHORTCUT_MIME = 'application/vnd.google-apps.shortcut';

export interface DriveEntry {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  /** Duracion real en milisegundos; solo la aporta la API v3. */
  durationMs: number | null;
  isFolder: boolean;
}

export interface DriveTree {
  id: string;
  name: string;
  files: DriveEntry[];
  folders: DriveTree[];
}

export type DriveWalkStrategy = 'public' | 'apikey';

/**
 * Motivos por los que un recorrido pudo quedarse corto. Se devuelven siempre,
 * porque un arbol incompleto que se presenta como completo termina creando un
 * curso al que le faltan clases sin que nadie se entere.
 */
export interface DriveWalkLimits {
  depthReached: boolean;
  nodeLimitReached: boolean;
  timedOut: boolean;
}

export interface DriveWalkResult {
  tree: DriveTree;
  strategy: DriveWalkStrategy;
  scannedFolders: number;
  filesFound: number;
  limits: DriveWalkLimits;
}

export type DriveFolderErrorCode =
  | 'invalid_link'
  | 'not_public'
  | 'not_found'
  | 'format_changed'
  | 'upstream'
  | 'timeout';

export class DriveFolderError extends Error {
  constructor(
    readonly code: DriveFolderErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'DriveFolderError';
  }
}

/** Listador de una carpeta. Se inyecta en las pruebas para no tocar la red. */
export type DriveFolderLister = (folderId: string) => Promise<{ name: string; entries: DriveEntry[] }>;

// ── Enlace → identificador de carpeta ───────────────────────────────

const FOLDER_ID = /^[A-Za-z0-9_-]{15,60}$/;

/**
 * Acepta las formas en que Google reparte una carpeta:
 *   https://drive.google.com/drive/folders/<id>?usp=drive_link
 *   https://drive.google.com/drive/u/0/folders/<id>
 *   https://drive.google.com/open?id=<id>
 *   https://drive.google.com/folderview?id=<id>
 * o el identificador pelado. Devuelve null ante cualquier otra cosa: es la
 * unica puerta de entrada, asi que aqui no se admiten dudas.
 */
export function parseDriveFolderId(input: string): string | null {
  const raw = String(input ?? '').trim();
  if (!raw) return null;
  if (FOLDER_ID.test(raw)) return raw;

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  if (!/(^|\.)google\.com$/.test(url.hostname)) return null;

  const fromPath = url.pathname.match(/\/folders\/([A-Za-z0-9_-]+)/);
  if (fromPath && FOLDER_ID.test(fromPath[1])) return fromPath[1];

  const fromQuery = url.searchParams.get('id');
  if (fromQuery && FOLDER_ID.test(fromQuery)) return fromQuery;

  return null;
}

/** Distingue el enlace de un archivo suelto para dar un mensaje util. */
export function looksLikeDriveFileLink(input: string): boolean {
  return /\/file\/d\/[A-Za-z0-9_-]+/.test(String(input ?? ''));
}

// ── Estrategia publica: pagina HTML de la carpeta ───────────────────

const BROWSER_UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

const IVD = /window\['_DRIVE_ivd'\]\s*=\s*'((?:[^'\\]|\\.)*)'/;
const TITLE = /<title>([^<]*)<\/title>/i;

/** Deshace el escapado JS (\xNN, \uNNNN, \/) del blob que Drive incrusta. */
export function unescapeJsString(value: string): string {
  return value.replace(
    /\\(?:x([0-9a-fA-F]{2})|u\{([0-9a-fA-F]+)\}|u([0-9a-fA-F]{4})|(.))/g,
    (_all, hex2: string, codePoint: string, hex4: string, char: string) => {
      if (hex2) return String.fromCharCode(parseInt(hex2, 16));
      if (codePoint) return String.fromCodePoint(parseInt(codePoint, 16));
      if (hex4) return String.fromCharCode(parseInt(hex4, 16));
      switch (char) {
        case 'n':
          return '\n';
        case 't':
          return '\t';
        case 'r':
          return '\r';
        case 'b':
          return '\b';
        case 'f':
          return '\f';
        case 'v':
          return '\v';
        case '0':
          return '\0';
        default:
          return char;
      }
    },
  );
}

function toSizeBytes(raw: unknown): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) return Math.max(0, raw);
  if (typeof raw === 'string') {
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
  }
  return 0;
}

/**
 * Extrae el listado de una carpeta publica del HTML de su pagina. Drive
 * incrusta ahi un array con identificador, nombre, mime y tamano de cada hijo.
 */
export function parsePublicFolderHtml(html: string): { name: string; entries: DriveEntry[] } {
  const name = (html.match(TITLE)?.[1] ?? '').replace(/\s*-\s*Google Drive\s*$/i, '').trim();

  const blob = html.match(IVD);
  if (!blob) {
    if (/accounts\.google\.com\/(ServiceLogin|v3\/signin)|Se requiere iniciar sesi|Sign in to continue/i.test(html)) {
      throw new DriveFolderError(
        'not_public',
        'La carpeta no es pública. Compártela como «Cualquier persona con el enlace» o configura una clave de Google Drive.',
      );
    }
    throw new DriveFolderError(
      'format_changed',
      'No se pudo leer el contenido de la carpeta: Google cambió el formato de su página. Configura GOOGLE_DRIVE_API_KEY o una cuenta de servicio para seguir importando.',
    );
  }

  let payload: unknown;
  try {
    payload = JSON.parse(unescapeJsString(blob[1]));
  } catch {
    throw new DriveFolderError(
      'format_changed',
      'El listado de la carpeta llegó corrupto y no se pudo interpretar.',
    );
  }

  const items =
    Array.isArray(payload) && Array.isArray((payload as unknown[])[0])
      ? ((payload as unknown[])[0] as unknown[][])
      : [];

  const entries: DriveEntry[] = [];
  for (const item of items) {
    if (!Array.isArray(item)) continue;
    const id = typeof item[0] === 'string' ? item[0] : '';
    const entryName = typeof item[2] === 'string' ? item[2] : '';
    const mimeType = typeof item[3] === 'string' ? item[3] : '';
    if (!id || !entryName) continue;
    entries.push({
      id,
      name: entryName,
      mimeType,
      sizeBytes: toSizeBytes(item[13]),
      // La pagina publica no publica la duracion; se estima mas tarde.
      durationMs: null,
      isFolder: mimeType === FOLDER_MIME,
    });
  }
  return { name, entries };
}

async function listFolderPublic(folderId: string, timeoutMs: number): Promise<{ name: string; entries: DriveEntry[] }> {
  // La URL se reconstruye desde el identificador validado, nunca desde la
  // entrada del administrador.
  const url = `https://drive.google.com/drive/folders/${encodeURIComponent(folderId)}?hl=en`;

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { 'User-Agent': BROWSER_UA, 'Accept-Language': 'en-US,en;q=0.9' },
      redirect: 'follow',
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
      throw new DriveFolderError('timeout', 'Google Drive tardó demasiado en responder.');
    }
    throw new DriveFolderError('upstream', 'No se pudo contactar con Google Drive.');
  }

  if (response.status === 404) {
    throw new DriveFolderError('not_found', 'Google Drive responde que esa carpeta no existe.');
  }
  if (response.status === 401 || response.status === 403) {
    throw new DriveFolderError(
      'not_public',
      'La carpeta no es accesible públicamente. Compártela como «Cualquier persona con el enlace».',
    );
  }
  if (!response.ok) {
    throw new DriveFolderError('upstream', `Google Drive respondió ${response.status}.`);
  }

  return parsePublicFolderHtml(await response.text());
}

// ── Estrategia con credenciales: Drive API v3 ───────────────────────

const API_FIELDS =
  'nextPageToken,files(id,name,mimeType,size,videoMediaMetadata(durationMillis),shortcutDetails(targetId,targetMimeType))';

type DriveClient = NonNullable<ReturnType<typeof getDriveClient>>;

async function listFolderApi(
  folderId: string,
  drive: DriveClient,
): Promise<{ name: string; entries: DriveEntry[] }> {
  let name = '';
  try {
    const meta = await drive.files.get({
      fileId: folderId,
      fields: 'id,name,mimeType',
      supportsAllDrives: true,
    });
    name = meta.data.name ?? '';
  } catch (error) {
    const status = (error as { status?: number; code?: number }).status ?? (error as { code?: number }).code;
    if (status === 404) {
      throw new DriveFolderError('not_found', 'Google Drive responde que esa carpeta no existe.');
    }
    if (status === 401 || status === 403) {
      throw new DriveFolderError(
        'not_public',
        'Las credenciales configuradas no tienen acceso a esa carpeta. Compártela con la cuenta de servicio o hazla pública.',
      );
    }
    throw new DriveFolderError('upstream', 'Google Drive rechazó la consulta de la carpeta.');
  }

  const entries: DriveEntry[] = [];
  let pageToken: string | undefined;
  do {
    const page = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: API_FIELDS,
      pageSize: 1000,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      orderBy: 'folder,name',
      pageToken,
    });

    for (const file of page.data.files ?? []) {
      // Los accesos directos apuntan al archivo real; se resuelven aqui para
      // que el resto del importador no tenga que saber que existen.
      const id = file.shortcutDetails?.targetId ?? file.id ?? '';
      const mimeType = file.shortcutDetails?.targetMimeType ?? file.mimeType ?? '';
      if (!id || !file.name) continue;
      const durationRaw = file.videoMediaMetadata?.durationMillis;
      entries.push({
        id,
        name: file.name,
        mimeType,
        sizeBytes: toSizeBytes(file.size),
        durationMs: durationRaw ? Number(durationRaw) || null : null,
        isFolder: mimeType === FOLDER_MIME,
      });
    }
    pageToken = page.data.nextPageToken ?? undefined;
  } while (pageToken);

  return { name, entries };
}

// ── Recorrido ───────────────────────────────────────────────────────

/**
 * `map` con concurrencia acotada que preserva el orden de entrada. En cuanto
 * una tarea falla se deja de programar trabajo nuevo: sin esto, un fallo al
 * inicio seguiria disparando peticiones a Drive durante todo el recorrido.
 */
export async function mapPool<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  let failed = false;

  const runners = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    for (;;) {
      if (failed) return;
      const index = cursor++;
      if (index >= items.length) return;
      try {
        results[index] = await worker(items[index], index);
      } catch (error) {
        failed = true;
        throw error;
      }
    }
  });

  await Promise.all(runners);
  return results;
}

export interface DriveWalkOptions {
  maxDepth: number;
  maxNodes: number;
  concurrency: number;
  timeoutMs: number;
  /** Inyectable para las pruebas; por defecto se elige segun las credenciales. */
  listFolder?: DriveFolderLister;
  strategy?: DriveWalkStrategy;
}

export function resolveWalkStrategy(): DriveWalkStrategy {
  return getDriveClient() ? 'apikey' : 'public';
}

/**
 * Recorre la carpeta y devuelve el arbol de subcarpetas y archivos.
 *
 * Al alcanzar cualquiera de los topes el recorrido se detiene y devuelve lo ya
 * leido, marcandolo en `limits`: perder dos minutos de lectura por un tope es
 * peor que entregar un arbol parcial claramente etiquetado. Quien consuma este
 * resultado tiene la obligacion de mostrar esa marca.
 */
export async function walkDriveFolder(
  folderId: string,
  options: DriveWalkOptions,
): Promise<DriveWalkResult> {
  const strategy = options.strategy ?? resolveWalkStrategy();
  const deadline = Date.now() + options.timeoutMs;

  const listFolder: DriveFolderLister =
    options.listFolder ??
    (() => {
      const drive = getDriveClient();
      if (drive) return (id: string) => listFolderApi(id, drive);
      // El presupuesto por peticion se acota para que una carpeta lenta no
      // consuma ella sola todo el tiempo del recorrido.
      const perRequest = Math.max(5_000, Math.min(30_000, options.timeoutMs));
      return (id: string) => listFolderPublic(id, perRequest);
    })();

  const limits: DriveWalkLimits = { depthReached: false, nodeLimitReached: false, timedOut: false };
  const seen = new Set<string>();
  let scannedFolders = 0;
  let filesFound = 0;
  let nodeCount = 0;

  const outOfTime = () => {
    if (Date.now() >= deadline) {
      limits.timedOut = true;
      return true;
    }
    return false;
  };

  async function visit(id: string, fallbackName: string, depth: number): Promise<DriveTree> {
    // Una carpeta puede aparecer dos veces via accesos directos; sin esto el
    // recorrido se repetiria o entraria en ciclo.
    if (seen.has(id)) return { id, name: fallbackName, files: [], folders: [] };
    seen.add(id);

    const { name, entries } = await listFolder(id);
    scannedFolders++;
    const resolvedName = name || fallbackName;

    const files = entries.filter((entry) => !entry.isFolder);
    const subfolders = entries.filter((entry) => entry.isFolder);
    filesFound += files.length;
    nodeCount += entries.length;

    let folders: DriveTree[] = [];
    if (subfolders.length > 0) {
      if (depth + 1 > options.maxDepth) {
        limits.depthReached = true;
      } else if (nodeCount >= options.maxNodes) {
        limits.nodeLimitReached = true;
      } else if (outOfTime()) {
        // `outOfTime` ya dejo marcado el motivo.
      } else {
        folders = await mapPool(subfolders, options.concurrency, (sub) =>
          visit(sub.id, sub.name, depth + 1),
        );
      }
    }

    return { id, name: resolvedName, files, folders };
  }

  const tree = await visit(folderId, 'Curso importado', 0);
  return { tree, strategy, scannedFolders, filesFound, limits };
}

/** Cuenta recursiva de archivos, para resumir el resultado. */
export function countTreeFiles(tree: DriveTree): number {
  return tree.files.length + tree.folders.reduce((total, sub) => total + countTreeFiles(sub), 0);
}

/** Cuenta recursiva de carpetas incluidas en el arbol, contando la raiz. */
export function countTreeFolders(tree: DriveTree): number {
  return 1 + tree.folders.reduce((total, sub) => total + countTreeFolders(sub), 0);
}
