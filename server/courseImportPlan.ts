/**
 * Convierte el arbol de una carpeta de Drive en un plan de curso.
 *
 * Todo lo que hay aqui es determinista y puro: las mismas carpetas producen
 * siempre el mismo plan. La IA de la fase siguiente solo pule nombres sobre
 * este resultado, nunca decide la estructura.
 *
 * El reparto sigue lo que DocentOS ya modela:
 *
 *   - Un video o un audio es una **leccion** (`VideoDriveLink`).
 *   - Un ZIP, RAR, PDF, TXT o cualquier material de apoyo es un **recurso del
 *     modulo** (`CourseResource` con `moduleId`), descargable desde la ficha.
 *   - Un subtitulo se engancha a su leccion por nombre; si no encuentra a quien
 *     acompanar, se descarta y se cuenta.
 */

import type { DriveEntry, DriveTree, DriveWalkLimits, DriveWalkStrategy } from './driveFolder.js';
import { buildDriveEmbedUrl } from './driveService.js';

export type ContentKind =
  | 'video'
  | 'audio'
  | 'pdf'
  | 'doc'
  | 'slides'
  | 'sheet'
  | 'image'
  | 'note'
  | 'web'
  | 'subtitle'
  | 'archive'
  | 'other';

export const CONTENT_KIND_LABEL: Record<ContentKind, string> = {
  video: 'Vídeo',
  audio: 'Audio',
  pdf: 'PDF',
  doc: 'Documento',
  slides: 'Presentación',
  sheet: 'Hoja de cálculo',
  image: 'Imagen',
  note: 'Texto',
  web: 'Página web',
  subtitle: 'Subtítulos',
  archive: 'Archivo comprimido',
  other: 'Recurso',
};

export interface PlannedResource {
  key: string;
  /** `subtitle` acompaña a una lección; `attachment` cuelga del módulo. */
  kind: 'subtitle' | 'attachment';
  title: string;
  originalName: string;
  driveFileId: string;
  downloadUrl: string;
  mimeType: string;
  sizeBytes: number;
  contentKind: ContentKind;
  /** Lección a la que acompaña, cuando es un subtítulo emparejado. */
  pairedWithLessonKey: string | null;
  include: boolean;
}

export interface PlannedLesson {
  key: string;
  title: string;
  originalName: string;
  driveFileId: string;
  embedUrl: string;
  mimeType: string;
  contentKind: ContentKind;
  /** Formato `MM:SS` o `H:MM:SS`, listo para `VideoDriveLink.duration`. */
  duration: string;
  durationSeconds: number;
  /** `true` cuando la duración se dedujo del tamaño y no la dio Drive. */
  durationEstimated: boolean;
  sizeBytes: number;
  include: boolean;
}

export interface PlannedModule {
  key: string;
  title: string;
  originalName: string;
  path: string[];
  lessons: PlannedLesson[];
  resources: PlannedResource[];
  include: boolean;
}

export interface ImportPlanStats {
  foldersScanned: number;
  filesFound: number;
  lessons: number;
  resources: number;
  subtitles: number;
  skipped: number;
  minutes: number;
}

export interface ImportPlan {
  title: string;
  category: string;
  description: string;
  sourceUrl: string;
  sourceFolderId: string;
  strategy: DriveWalkStrategy;
  modules: PlannedModule[];
  aiOrganized: boolean;
  stats: ImportPlanStats;
  limits: DriveWalkLimits;
  /** El árbol no se leyó entero: quien muestre el plan debe advertirlo. */
  incomplete: boolean;
}

// ── Nombres: orden natural y limpieza ───────────────────────────────

const CHUNKS = /(\d+)|(\D+)/g;

/**
 * Ordena como espera una persona: "10" va despues de "2", no antes. Un sort
 * alfabetico desordenaria las clases numeradas de cualquier curso real.
 */
export function naturalCompare(a: string, b: string): number {
  const left = a.toLocaleLowerCase().match(CHUNKS) ?? [];
  const right = b.toLocaleLowerCase().match(CHUNKS) ?? [];
  const shared = Math.min(left.length, right.length);
  for (let i = 0; i < shared; i++) {
    const ln = Number(left[i]);
    const rn = Number(right[i]);
    if (!Number.isNaN(ln) && !Number.isNaN(rn)) {
      if (ln !== rn) return ln - rn;
    } else if (left[i] !== right[i]) {
      return left[i] < right[i] ? -1 : 1;
    }
  }
  return left.length - right.length;
}

export function stripExtension(name: string): string {
  return name.replace(/\.[A-Za-z0-9]{1,5}$/, '');
}

export function extensionOf(name: string): string {
  return name.match(/\.([A-Za-z0-9]{1,5})$/)?.[1].toLowerCase() ?? '';
}

/** Sufijo de idioma de un subtitulo: `.en_US`, `.es-ES`, `.en`. */
const LANGUAGE_SUFFIX = /\.[a-z]{2}([_-][A-Za-z]{2,4})?$/i;

function normalizeKey(value: string): string {
  return value.trim().toLocaleLowerCase().replace(/\s+/g, ' ');
}

/** Clave para emparejar archivos hermanos por su nombre base. */
export function baseKey(name: string): string {
  return normalizeKey(stripExtension(name));
}

/**
 * Claves candidatas de un subtitulo. Drive entrega
 * `027 You Can Avoid Risk.en_US.srt` junto a `027 You Can Avoid Risk.mp4`, asi
 * que hay que probar tambien sin el sufijo de idioma.
 */
export function subtitleBaseKeys(name: string): string[] {
  const withoutExtension = stripExtension(name);
  const keys = [normalizeKey(withoutExtension)];
  const withoutLanguage = withoutExtension.replace(LANGUAGE_SUFFIX, '');
  if (withoutLanguage !== withoutExtension) keys.push(normalizeKey(withoutLanguage));
  return keys;
}

const NOISE = [
  /\[(udemy|coursera|platzi|domestika|freetutorials?|desire\s*course)[^\]]*\]/gi,
  /\((udemy|coursera|platzi)[^)]*\)/gi,
  /\b(1080p|720p|480p|4k|x264|h264|aac|www\.[\w.-]+)\b/gi,
];

/**
 * Convierte `001__[Udemy] Learn to Learn` en `Learn to Learn` y
 * `13 - Naming Conventions` en `Naming Conventions`. Si limpiar deja la cadena
 * vacia se devuelve el nombre original: es preferible un titulo feo a uno vacio.
 */
export function cleanTitle(raw: string, options: { stripExtension?: boolean } = {}): string {
  let value = options.stripExtension === false ? raw : stripExtension(raw);
  for (const pattern of NOISE) value = value.replace(pattern, ' ');
  // Dos formas de numerar una clase: con separador explicito ("13 - Nombre",
  // "001__Nombre") o solo con un espacio ("005 Section Overview"). La segunda
  // se limita a tres digitos para no comerse el ano de un titulo como
  // "2024 Guia fiscal".
  value = value.replace(/^\s*\d{1,4}\s*[._\-)\]]+\s*/, '');
  value = value.replace(/^\s*\d{1,3}\s+/, '');
  value = value.replace(/_+/g, ' ');
  value = value.replace(/\s{2,}/g, ' ');
  value = value.replace(/^[\s.\-–—:]+|[\s.\-–—:]+$/g, '');
  const cleaned = value.trim();
  return cleaned.length > 0 ? cleaned : raw.trim();
}

// ── Clasificacion del contenido ─────────────────────────────────────

const SUBTITLE_EXTENSIONS = new Set(['vtt', 'srt', 'ass', 'ssa', 'sub', 'sbv']);
const ARCHIVE_EXTENSIONS = new Set(['zip', 'rar', '7z', 'tar', 'gz', 'tgz', 'bz2', 'xz']);

/**
 * Deduce el tipo de contenido. La extension manda sobre el mime porque Drive
 * entrega `application/octet-stream` para los subtitulos y para buena parte de
 * los comprimidos: fiarse solo del mime dejaria los `.srt` y los `.rar` como
 * "otro".
 */
export function contentKindFromMime(mimeType: string, filename = ''): ContentKind {
  const mime = String(mimeType ?? '').toLowerCase();
  const extension = extensionOf(filename);

  if (SUBTITLE_EXTENSIONS.has(extension) || mime === 'text/vtt') return 'subtitle';
  if (ARCHIVE_EXTENSIONS.has(extension)) return 'archive';

  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime.startsWith('image/')) return 'image';
  if (mime === 'application/pdf') return 'pdf';
  if (mime === 'application/vnd.google-apps.document') return 'doc';
  if (mime === 'application/vnd.google-apps.presentation') return 'slides';
  if (mime === 'application/vnd.google-apps.spreadsheet') return 'sheet';
  if (mime === 'text/html' || extension === 'html' || extension === 'htm') return 'web';
  if (/zip|rar|7z-compressed|x-tar|gzip|compressed/.test(mime)) return 'archive';
  if (/word|opendocument\.text/.test(mime)) return 'doc';
  if (/powerpoint|presentation/.test(mime)) return 'slides';
  if (/excel|spreadsheet/.test(mime)) return 'sheet';
  if (mime.startsWith('text/') || mime === 'application/json') return 'note';
  return 'other';
}

/** Contenido que se convierte en leccion por si mismo. */
const LESSON_KINDS: ReadonlySet<ContentKind> = new Set<ContentKind>(['video', 'audio']);

/**
 * Contenido que puede ascender a leccion cuando un modulo no tiene ningun
 * video ni audio: un modulo solo de PDF debe seguir teniendo clases.
 */
const FALLBACK_LESSON_KINDS: ReadonlySet<ContentKind> = new Set<ContentKind>([
  'pdf',
  'doc',
  'slides',
  'sheet',
]);

// ── Duracion ────────────────────────────────────────────────────────

/** Bytes por minuto asumidos cuando Drive no publica la duracion real. */
const BYTES_PER_MINUTE = 7 * 1024 * 1024;

export function formatDuration(totalSeconds: number): string {
  const safe = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  const pad = (value: number) => String(value).padStart(2, '0');
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
}

export function resolveDuration(
  entry: DriveEntry,
  kind: ContentKind,
): { seconds: number; estimated: boolean } {
  if (entry.durationMs && entry.durationMs > 0) {
    return { seconds: Math.round(entry.durationMs / 1000), estimated: false };
  }
  if (kind === 'video' || kind === 'audio') {
    if (entry.sizeBytes > 0) {
      return { seconds: Math.max(60, Math.round((entry.sizeBytes / BYTES_PER_MINUTE) * 60)), estimated: true };
    }
    return { seconds: 600, estimated: true };
  }
  if (kind === 'slides') return { seconds: 600, estimated: true };
  return { seconds: 300, estimated: true };
}

// ── Enlaces ─────────────────────────────────────────────────────────

/** URL reproducible segun el tipo de archivo de Drive. */
export function buildEmbedUrlForFile(fileId: string, mimeType: string): string {
  const id = encodeURIComponent(fileId);
  if (mimeType === 'application/vnd.google-apps.presentation') {
    return `https://docs.google.com/presentation/d/${id}/embed`;
  }
  if (mimeType === 'application/vnd.google-apps.document') {
    return `https://docs.google.com/document/d/${id}/preview`;
  }
  if (mimeType === 'application/vnd.google-apps.spreadsheet') {
    return `https://docs.google.com/spreadsheets/d/${id}/preview`;
  }
  return buildDriveEmbedUrl(fileId);
}

/** URL de descarga directa, la que se guarda en `CourseResource.privateUrl`. */
export function buildDownloadUrl(fileId: string): string {
  return `https://drive.google.com/uc?export=download&id=${encodeURIComponent(fileId)}`;
}

// ── Categoria sugerida ──────────────────────────────────────────────

const CATEGORY_HINTS: [string, RegExp][] = [
  [
    'Inglés',
    /\b(ingl[eé]s|english|ielts|toefl|grammar|speaking|listening|pronunciation|vocabulary|phrasal)\b/i,
  ],
  [
    'Derecho',
    /\b(derecho|penal|civil|constitucional|procesal|jur[ií]dic|legal|ley(es)?|c[oó]digo|tributari|notarial|laboral|mercantil)\b/i,
  ],
  [
    'Ingeniería',
    /\b(java|python|javascript|typescript|react|node|programaci[oó]n|programming|software|ingenier|algoritm|estructura de datos|base de datos|database|sql|redes|devops|docker|kubernetes|linux|data science|machine learning|android|flutter)\b/i,
  ],
  [
    'Desarrollo Personal',
    /\b(learning to learn|learn(ing)?|study|estudio|memoria|memory|productiv|h[aá]bitos?|habits?|mindset|focus|concentraci[oó]n|liderazgo|leadership|coaching)\b/i,
  ],
  [
    'Negocios',
    /\b(marketing|ventas|sales|negocio|business|finanzas|finance|emprend|startup|ecommerce|contabilidad)\b/i,
  ],
  ['Diseño', /\b(dise[nñ]o|design|figma|photoshop|illustrator|ux|ui|branding)\b/i],
];

/** Categoria sugerida; ante la duda, la predeterminada de DocentOS. */
export function guessCategory(text: string): string {
  for (const [category, pattern] of CATEGORY_HINTS) {
    if (pattern.test(text)) return category;
  }
  return 'Mentoría Elite';
}

// ── Construccion del plan ───────────────────────────────────────────

interface FolderWithFiles {
  path: string[];
  files: DriveEntry[];
}

/**
 * Aplana el arbol quedandose con las carpetas que tienen archivos. Cada una
 * sera un modulo. El orden natural se aplica aqui y no en el recorrido: la API
 * de Drive ordena alfabeticamente, asi que sin esto la clase 10 iria antes que
 * la 2 en las carpetas leidas con credenciales.
 */
function collectFolders(tree: DriveTree, path: string[] = []): FolderWithFiles[] {
  const out: FolderWithFiles[] = [];
  if (tree.files.length > 0) {
    out.push({ path, files: [...tree.files].sort((a, b) => naturalCompare(a.name, b.name)) });
  }
  const subfolders = [...tree.folders].sort((a, b) => naturalCompare(a.name, b.name));
  for (const sub of subfolders) {
    out.push(...collectFolders(sub, [...path, sub.name]));
  }
  return out;
}

function moduleLabel(path: string[]): string {
  if (path.length === 0) return 'Material del curso';
  const parts = path.map((segment) => cleanTitle(segment, { stripExtension: false })).filter(Boolean);
  // Con mas de dos niveles solo interesan el primero y el ultimo.
  const shown = parts.length > 2 ? [parts[0], parts[parts.length - 1]] : parts;
  return shown.join(' · ') || 'Material del curso';
}

function toLesson(entry: DriveEntry, kind: ContentKind): PlannedLesson {
  const { seconds, estimated } = resolveDuration(entry, kind);
  return {
    key: entry.id,
    title: cleanTitle(entry.name),
    originalName: entry.name,
    driveFileId: entry.id,
    embedUrl: buildEmbedUrlForFile(entry.id, entry.mimeType),
    mimeType: entry.mimeType,
    contentKind: kind,
    duration: formatDuration(seconds),
    durationSeconds: seconds,
    durationEstimated: estimated,
    sizeBytes: entry.sizeBytes,
    include: true,
  };
}

function toResource(
  entry: DriveEntry,
  kind: ContentKind,
  pairedWithLessonKey: string | null,
): PlannedResource {
  return {
    key: entry.id,
    kind: pairedWithLessonKey ? 'subtitle' : 'attachment',
    title: cleanTitle(entry.name, { stripExtension: false }),
    originalName: entry.name,
    driveFileId: entry.id,
    downloadUrl: buildDownloadUrl(entry.id),
    mimeType: entry.mimeType,
    sizeBytes: entry.sizeBytes,
    contentKind: kind,
    pairedWithLessonKey,
    include: true,
  };
}

function buildModuleContent(files: DriveEntry[]): {
  lessons: PlannedLesson[];
  resources: PlannedResource[];
  skipped: number;
} {
  const classified = files.map((entry) => ({
    entry,
    kind: contentKindFromMime(entry.mimeType, entry.name),
  }));

  const hasPrimary = classified.some((item) => LESSON_KINDS.has(item.kind));
  const isLesson = (kind: ContentKind) =>
    LESSON_KINDS.has(kind) || (!hasPrimary && FALLBACK_LESSON_KINDS.has(kind));

  const lessons: PlannedLesson[] = [];
  const lessonByKey = new Map<string, PlannedLesson>();
  for (const { entry, kind } of classified) {
    if (!isLesson(kind)) continue;
    const lesson = toLesson(entry, kind);
    lessons.push(lesson);
    lessonByKey.set(baseKey(entry.name), lesson);
  }

  const resources: PlannedResource[] = [];
  let skipped = 0;

  for (const { entry, kind } of classified) {
    if (isLesson(kind)) continue;

    if (kind === 'subtitle') {
      const paired = subtitleBaseKeys(entry.name)
        .map((key) => lessonByKey.get(key))
        .find(Boolean);
      if (paired) {
        resources.push(toResource(entry, kind, paired.key));
      } else {
        // Un subtitulo sin su video no aporta nada por si solo.
        skipped++;
      }
      continue;
    }

    // Todo lo demas —ZIP, RAR, PDF, TXT, HTML— se conserva como recurso
    // descargable del modulo en vez de perderse.
    resources.push(toResource(entry, kind, null));
  }

  lessons.sort((a, b) => naturalCompare(a.originalName, b.originalName));
  resources.sort((a, b) => naturalCompare(a.originalName, b.originalName));
  return { lessons, resources, skipped };
}

export function buildImportPlan(input: {
  tree: DriveTree;
  sourceUrl: string;
  sourceFolderId: string;
  strategy: DriveWalkStrategy;
  foldersScanned: number;
  filesFound: number;
  limits: DriveWalkLimits;
}): ImportPlan {
  const folders = collectFolders(input.tree);
  const modules: PlannedModule[] = [];
  const usedTitles = new Set<string>();
  let skipped = 0;

  for (const folder of folders) {
    const built = buildModuleContent(folder.files);
    skipped += built.skipped;
    if (built.lessons.length === 0 && built.resources.length === 0) continue;

    let title = moduleLabel(folder.path);
    if (usedTitles.has(title)) {
      let suffix = 2;
      while (usedTitles.has(`${title} (${suffix})`)) suffix++;
      title = `${title} (${suffix})`;
    }
    usedTitles.add(title);

    modules.push({
      key: folder.path.join('/') || '__root__',
      title,
      originalName: folder.path[folder.path.length - 1] ?? input.tree.name,
      path: folder.path,
      lessons: built.lessons,
      resources: built.resources,
      include: true,
    });
  }

  // Los archivos sueltos de la raiz van al final: son material de apoyo del
  // curso, no su primera leccion.
  const rootIndex = modules.findIndex((entry) => entry.key === '__root__');
  if (rootIndex >= 0 && modules.length > 1) {
    const [root] = modules.splice(rootIndex, 1);
    modules.push(root);
  }

  const title = cleanTitle(input.tree.name, { stripExtension: false }) || 'Curso importado';
  const lessons = modules.reduce((total, entry) => total + entry.lessons.length, 0);
  const resources = modules.reduce((total, entry) => total + entry.resources.length, 0);
  const subtitles = modules.reduce(
    (total, entry) => total + entry.resources.filter((item) => item.kind === 'subtitle').length,
    0,
  );
  const seconds = modules.reduce(
    (total, entry) => total + entry.lessons.reduce((sum, lesson) => sum + lesson.durationSeconds, 0),
    0,
  );

  const incomplete = input.limits.depthReached || input.limits.nodeLimitReached || input.limits.timedOut;

  return {
    title,
    category: guessCategory(`${title} ${modules.map((entry) => entry.title).join(' ')}`),
    description: `Importado desde Google Drive · ${modules.length} módulos · ${lessons} lecciones.`,
    sourceUrl: input.sourceUrl,
    sourceFolderId: input.sourceFolderId,
    strategy: input.strategy,
    modules,
    aiOrganized: false,
    stats: {
      foldersScanned: input.foldersScanned,
      filesFound: input.filesFound,
      lessons,
      resources,
      subtitles,
      skipped,
      minutes: Math.round(seconds / 60),
    },
    limits: input.limits,
    incomplete,
  };
}

/** Totales de lo que quedaria seleccionado, para la vista previa. */
export function planTotals(plan: ImportPlan): {
  modules: number;
  lessons: number;
  resources: number;
  minutes: number;
} {
  let modules = 0;
  let lessons = 0;
  let resources = 0;
  let seconds = 0;

  for (const moduleEntry of plan.modules) {
    if (!moduleEntry.include) continue;
    const includedLessons = moduleEntry.lessons.filter((lesson) => lesson.include);
    const includedResources = moduleEntry.resources.filter((resource) => resource.include);
    if (includedLessons.length === 0 && includedResources.length === 0) continue;

    modules++;
    lessons += includedLessons.length;
    resources += includedResources.length;
    for (const lesson of includedLessons) seconds += lesson.durationSeconds;
  }

  return { modules, lessons, resources, minutes: Math.round(seconds / 60) };
}

// ── Revalidacion del plan que vuelve del navegador ──────────────────

/**
 * Lo que llega a `apply` es un plan que el administrador ha editado en el
 * navegador, asi que no se puede confiar en el. En particular **nunca** se
 * guardan las URLs que vengan en el cuerpo: se reconstruyen aqui a partir del
 * identificador de Drive. Aceptar una `embedUrl` ajena convertiria este
 * endpoint en un inyector de iframes arbitrarios dentro del reproductor.
 */

/** Identificadores de Drive: base64url, nunca con barras ni dos puntos. */
const DRIVE_ID = /^[A-Za-z0-9_-]{8,200}$/;
const MIME = /^[a-z0-9][a-z0-9!#$&^_.+-]{0,126}\/[a-z0-9][a-z0-9!#$&^_.+-]{0,126}$/i;
const DURATION = /^\d{1,3}:[0-5]\d(:[0-5]\d)?$/;

export const IMPORT_LIMITS = {
  maxModules: 200,
  maxLessonsPerModule: 500,
  maxLessons: 2_000,
  maxResources: 5_000,
  maxTitleLength: 200,
  maxDescriptionLength: 2_000,
} as const;

export type ImportPlanErrorCode = 'invalid' | 'empty' | 'too_large';

export class ImportPlanError extends Error {
  constructor(
    message: string,
    readonly code: ImportPlanErrorCode = 'invalid',
  ) {
    super(message);
    this.name = 'ImportPlanError';
  }
}

export interface SanitizedLesson {
  title: string;
  driveFileId: string;
  embedUrl: string;
  mimeType: string;
  duration: string;
  contentKind: ContentKind;
}

export interface SanitizedResource {
  title: string;
  driveFileId: string;
  downloadUrl: string;
  mimeType: string;
  sizeBytes: number | null;
  contentKind: ContentKind;
  isSubtitle: boolean;
}

export interface SanitizedModule {
  title: string;
  lessons: SanitizedLesson[];
  resources: SanitizedResource[];
}

export interface SanitizedPlan {
  title: string;
  category: string;
  description: string;
  sourceFolderId: string;
  modules: SanitizedModule[];
  totals: { modules: number; lessons: number; resources: number };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

/** `include` solo excluye cuando es explicitamente falso. */
function isIncluded(value: unknown): boolean {
  return value !== false;
}

function cleanTextField(value: unknown, maxLength: number): string {
  return String(value ?? '')
    // Los controles invisibles descuadran los titulos en la ficha del curso.
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function sanitizeMime(value: unknown, fallback: string): string {
  const mime = String(value ?? '').trim().toLowerCase();
  return MIME.test(mime) ? mime : fallback;
}

function sanitizeContentKind(value: unknown): ContentKind {
  const kind = String(value ?? '');
  return kind in CONTENT_KIND_LABEL ? (kind as ContentKind) : 'other';
}

function sanitizeDuration(value: unknown): string {
  const duration = String(value ?? '').trim();
  return DURATION.test(duration) ? duration : '0:00';
}

/**
 * Devuelve el plan listo para escribir en base de datos, o lanza
 * `ImportPlanError` describiendo por que no se puede aplicar.
 */
export function sanitizeImportPlan(raw: unknown): SanitizedPlan {
  const plan = asRecord(raw);

  const sourceFolderId = String(plan.sourceFolderId ?? '').trim();
  if (!DRIVE_ID.test(sourceFolderId)) {
    throw new ImportPlanError('El plan no identifica una carpeta de Google Drive válida.');
  }

  const rawModules = Array.isArray(plan.modules) ? plan.modules : [];
  if (rawModules.length > IMPORT_LIMITS.maxModules) {
    throw new ImportPlanError(
      `El plan trae ${rawModules.length} módulos y el máximo por importación es ${IMPORT_LIMITS.maxModules}.`,
      'too_large',
    );
  }

  // Un mismo archivo no puede entrar dos veces: el progreso y los certificados
  // cuentan lecciones, y un duplicado inflaria el total del curso.
  const seenFiles = new Set<string>();
  const modules: SanitizedModule[] = [];
  let totalLessons = 0;
  let totalResources = 0;

  for (const rawModule of rawModules) {
    const moduleEntry = asRecord(rawModule);
    if (!isIncluded(moduleEntry.include)) continue;

    const rawLessons = Array.isArray(moduleEntry.lessons) ? moduleEntry.lessons : [];
    if (rawLessons.length > IMPORT_LIMITS.maxLessonsPerModule) {
      throw new ImportPlanError(
        `El módulo "${cleanTextField(moduleEntry.title, 60)}" trae ${rawLessons.length} lecciones y el máximo por módulo es ${IMPORT_LIMITS.maxLessonsPerModule}.`,
        'too_large',
      );
    }

    const lessons: SanitizedLesson[] = [];
    for (const rawLesson of rawLessons) {
      const lesson = asRecord(rawLesson);
      if (!isIncluded(lesson.include)) continue;

      const driveFileId = String(lesson.driveFileId ?? '').trim();
      // Una fila sin identificador utilizable se descarta en silencio: es
      // preferible un curso con una leccion menos que uno con un reproductor
      // en negro.
      if (!DRIVE_ID.test(driveFileId) || seenFiles.has(driveFileId)) continue;

      const title = cleanTextField(lesson.title, IMPORT_LIMITS.maxTitleLength);
      if (!title) continue;

      const mimeType = sanitizeMime(lesson.mimeType, 'video/mp4');
      seenFiles.add(driveFileId);
      lessons.push({
        title,
        driveFileId,
        embedUrl: buildEmbedUrlForFile(driveFileId, mimeType),
        mimeType,
        duration: sanitizeDuration(lesson.duration),
        contentKind: sanitizeContentKind(lesson.contentKind),
      });
    }

    const resources: SanitizedResource[] = [];
    for (const rawResource of Array.isArray(moduleEntry.resources) ? moduleEntry.resources : []) {
      const resource = asRecord(rawResource);
      if (!isIncluded(resource.include)) continue;

      const driveFileId = String(resource.driveFileId ?? '').trim();
      if (!DRIVE_ID.test(driveFileId) || seenFiles.has(driveFileId)) continue;

      const title = cleanTextField(resource.title, IMPORT_LIMITS.maxTitleLength);
      if (!title) continue;

      const size = Number(resource.sizeBytes);
      seenFiles.add(driveFileId);
      resources.push({
        title,
        driveFileId,
        downloadUrl: buildDownloadUrl(driveFileId),
        mimeType: sanitizeMime(resource.mimeType, 'application/octet-stream'),
        sizeBytes: Number.isFinite(size) && size > 0 ? Math.round(size) : null,
        contentKind: sanitizeContentKind(resource.contentKind),
        isSubtitle: resource.kind === 'subtitle',
      });
    }

    if (lessons.length === 0 && resources.length === 0) continue;

    totalLessons += lessons.length;
    totalResources += resources.length;
    if (totalLessons > IMPORT_LIMITS.maxLessons) {
      throw new ImportPlanError(
        `El plan supera las ${IMPORT_LIMITS.maxLessons} lecciones por importación. Importa el curso por partes.`,
        'too_large',
      );
    }
    if (totalResources > IMPORT_LIMITS.maxResources) {
      throw new ImportPlanError(
        `El plan supera los ${IMPORT_LIMITS.maxResources} recursos por importación. Importa el curso por partes.`,
        'too_large',
      );
    }

    modules.push({
      title: cleanTextField(moduleEntry.title, IMPORT_LIMITS.maxTitleLength) || 'Módulo',
      lessons,
      resources,
    });
  }

  if (modules.length === 0) {
    throw new ImportPlanError(
      'No queda nada seleccionado que importar: revisa las casillas del plan.',
      'empty',
    );
  }

  const title = cleanTextField(plan.title, IMPORT_LIMITS.maxTitleLength);
  if (!title) throw new ImportPlanError('El curso necesita un título.');

  return {
    title,
    category: cleanTextField(plan.category, 80) || 'Mentoría Elite',
    description:
      cleanTextField(plan.description, IMPORT_LIMITS.maxDescriptionLength) ||
      `Importado desde Google Drive · ${modules.length} módulos · ${totalLessons} lecciones.`,
    sourceFolderId,
    modules,
    totals: { modules: modules.length, lessons: totalLessons, resources: totalResources },
  };
}
