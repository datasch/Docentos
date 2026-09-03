/**
 * Importacion de cursos desde una carpeta de Google Drive.
 *
 * Este archivo crece con cada fase del importador. La fase 0 solo fija la
 * decision de configuracion: que proveedor de IA atiende la organizacion del
 * curso y, sobre todo, que la ausencia de claves no rompe nada.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { config, resolveAiProvider } from '../server/config.js';
import {
  DriveFolderError,
  FOLDER_MIME,
  countTreeFiles,
  countTreeFolders,
  looksLikeDriveFileLink,
  mapPool,
  parseDriveFolderId,
  parsePublicFolderHtml,
  unescapeJsString,
  walkDriveFolder,
  type DriveEntry,
  type DriveFolderLister,
  type DriveTree,
} from '../server/driveFolder.js';
import {
  IMPORT_LIMITS,
  ImportPlanError,
  baseKey,
  buildImportPlan,
  cleanTitle,
  contentKindFromMime,
  formatDuration,
  guessCategory,
  naturalCompare,
  planTotals,
  sanitizeImportPlan,
  subtitleBaseKeys,
} from '../server/courseImportPlan.js';
import { AiError, extractJsonObject, listAiCandidates, requestAiJson } from '../server/aiProvider.js';
import {
  AiPlanRejected,
  allowsRegrouping,
  applyAiOrganization,
  compactPlanForAi,
  organizeImportPlan,
} from '../server/courseImportAi.js';

test('Configuracion: la eleccion de proveedor de IA respeta el orden esperado', async (t) => {
  await t.test('1. Con `auto`, OpenAI gana y DeepSeek queda de respaldo', () => {
    assert.equal(
      resolveAiProvider({ preference: 'auto', openaiApiKey: 'sk-a', deepseekApiKey: 'sk-b' }),
      'openai',
      'Teniendo ambas claves debe usarse OpenAI',
    );
    assert.equal(
      resolveAiProvider({ preference: 'auto', deepseekApiKey: 'sk-b' }),
      'deepseek',
      'Sin clave de OpenAI se pasa a DeepSeek',
    );
  });

  await t.test('2. Sin ninguna clave la IA queda desactivada, no rota', () => {
    assert.equal(resolveAiProvider({ preference: 'auto' }), 'none');
    assert.equal(
      resolveAiProvider({ preference: 'auto', openaiApiKey: '', deepseekApiKey: '' }),
      'none',
      'Una clave vacia en el `.env` equivale a no tenerla',
    );
  });

  await t.test('3. Una preferencia explicita no cambia de proveedor a escondidas', () => {
    // Fijar `openai` y terminar hablando con DeepSeek ocultaria justo lo que se
    // queria detectar: que falta la clave.
    assert.equal(
      resolveAiProvider({ preference: 'openai', deepseekApiKey: 'sk-b' }),
      'none',
      'Sin la clave pedida se desactiva en vez de sustituirla',
    );
    assert.equal(
      resolveAiProvider({ preference: 'deepseek', openaiApiKey: 'sk-a' }),
      'none',
    );
    assert.equal(resolveAiProvider({ preference: 'openai', openaiApiKey: 'sk-a' }), 'openai');
    assert.equal(resolveAiProvider({ preference: 'deepseek', deepseekApiKey: 'sk-b' }), 'deepseek');
  });

  await t.test('4. `none` desactiva la IA aunque haya claves configuradas', () => {
    assert.equal(
      resolveAiProvider({ preference: 'none', openaiApiKey: 'sk-a', deepseekApiKey: 'sk-b' }),
      'none',
    );
  });
});

test('Configuracion: los topes de importacion tienen valores seguros', async (t) => {
  await t.test('1. Los limites del recorrido estan definidos y acotados', () => {
    assert.ok(config.DRIVE_IMPORT_MAX_DEPTH >= 1 && config.DRIVE_IMPORT_MAX_DEPTH <= 8);
    assert.ok(config.DRIVE_IMPORT_MAX_NODES >= 10);
    assert.ok(config.DRIVE_IMPORT_CONCURRENCY >= 1 && config.DRIVE_IMPORT_CONCURRENCY <= 8);
    assert.ok(config.DRIVE_IMPORT_TIMEOUT_MS >= 5_000);
  });

  await t.test('2. El proveedor resuelto es uno de los tres valores validos', () => {
    assert.ok(['openai', 'deepseek', 'none'].includes(config.AI_PROVIDER));
  });
});

// ── Fase 1: lectura de la carpeta de Drive ──────────────────────────

/**
 * Reproduce el escapado con el que Google incrusta el listado en su pagina:
 * comillas y signos de menor van como secuencias \xNN dentro de una cadena
 * entre comillas simples.
 */
function encodeIvd(items: unknown[][]): string {
  return JSON.stringify([items])
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\x22')
    .replace(/</g, '\\x3c');
}

function ivdItem(id: string, name: string, mimeType: string, sizeBytes = 0): unknown[] {
  const row = new Array<unknown>(20).fill(null);
  row[0] = id;
  row[1] = ['parent-folder'];
  row[2] = name;
  row[3] = mimeType;
  row[13] = String(sizeBytes);
  return row;
}

function buildFolderHtml(title: string, items: unknown[][]): string {
  return [
    '<!DOCTYPE html><html><head>',
    `<title>${title} - Google Drive</title>`,
    '</head><body>',
    `<script>window['_DRIVE_ivd'] = '${encodeIvd(items)}';</script>`,
    '</body></html>',
  ].join('');
}

const VIDEO_MIME = 'video/mp4';

test('Drive: el enlace de la carpeta se convierte en identificador o se rechaza', async (t) => {
  const REAL = '1iGNmZq1P17ccE0pcSDYl1sH9vw6wCizs';

  await t.test('1. Se aceptan las formas en que Google reparte una carpeta', () => {
    assert.equal(parseDriveFolderId(`https://drive.google.com/drive/folders/${REAL}?usp=drive_link`), REAL);
    assert.equal(parseDriveFolderId(`https://drive.google.com/drive/u/0/folders/${REAL}`), REAL);
    assert.equal(parseDriveFolderId(`https://drive.google.com/open?id=${REAL}`), REAL);
    assert.equal(parseDriveFolderId(`https://drive.google.com/folderview?id=${REAL}`), REAL);
    assert.equal(parseDriveFolderId(REAL), REAL, 'También el identificador pelado');
    assert.equal(parseDriveFolderId(`  ${REAL}  `), REAL);
  });

  await t.test('2. Un dominio ajeno nunca produce identificador', () => {
    // Este es el guardarrail contra SSRF: el servidor solo llega a Drive
    // porque reconstruye la URL desde un identificador que valida aquí.
    assert.equal(parseDriveFolderId(`https://evil.example.com/drive/folders/${REAL}`), null);
    assert.equal(parseDriveFolderId(`https://drive.google.com.evil.example/drive/folders/${REAL}`), null);
    assert.equal(parseDriveFolderId(`https://notgoogle.com/drive/folders/${REAL}`), null);
    assert.equal(parseDriveFolderId(`http://169.254.169.254/drive/folders/${REAL}`), null);
    assert.equal(parseDriveFolderId(`file:///etc/passwd`), null);
    assert.equal(parseDriveFolderId(`javascript:alert(1)`), null);
  });

  await t.test('3. El enlace de un archivo suelto se distingue del de una carpeta', () => {
    const fileLink = 'https://drive.google.com/file/d/1bg8x7VY5gw1vh16sJ6B89tGlwg208s8H/view';
    assert.equal(parseDriveFolderId(fileLink), null, 'Un archivo no es una carpeta');
    assert.equal(looksLikeDriveFileLink(fileLink), true, 'Pero se reconoce para explicarlo');
    assert.equal(looksLikeDriveFileLink(`https://drive.google.com/drive/folders/${REAL}`), false);
  });

  await t.test('4. Se rechaza lo que no puede ser un identificador', () => {
    assert.equal(parseDriveFolderId(''), null);
    assert.equal(parseDriveFolderId('   '), null);
    assert.equal(parseDriveFolderId('carpeta de ingles'), null);
    assert.equal(parseDriveFolderId('12345'), null, 'Demasiado corto para ser un id de Drive');
  });
});

test('Drive: el listado público se extrae del HTML de la carpeta', async (t) => {
  await t.test('1. Se leen archivos y subcarpetas con su tamaño', () => {
    const html = buildFolderHtml('Curso de Inglés', [
      ivdItem('folder-01', '01 - Fundamentos', FOLDER_MIME),
      ivdItem('file-01', '01. Bienvenida.mp4', VIDEO_MIME, 148_000_000),
      ivdItem('file-02', 'Temario.pdf', 'application/pdf', 240_000),
    ]);

    const { name, entries } = parsePublicFolderHtml(html);
    assert.equal(name, 'Curso de Inglés', 'El título pierde el sufijo de Google Drive');
    assert.equal(entries.length, 3);

    assert.deepEqual(entries[0], {
      id: 'folder-01',
      name: '01 - Fundamentos',
      mimeType: FOLDER_MIME,
      sizeBytes: 0,
      durationMs: null,
      isFolder: true,
    });
    assert.equal(entries[1].isFolder, false);
    assert.equal(entries[1].sizeBytes, 148_000_000);
    assert.equal(entries[2].mimeType, 'application/pdf');
  });

  await t.test('2. Los nombres con acentos, comillas y marcado sobreviven al desescapado', () => {
    const tricky = `Módulo "2" — <b>Avanzado</b> & práctica`;
    const html = buildFolderHtml('Curso', [ivdItem('file-99', `${tricky}.mp4`, VIDEO_MIME, 10)]);
    assert.equal(parsePublicFolderHtml(html).entries[0].name, `${tricky}.mp4`);
  });

  await t.test('3. unescapeJsString cubre las secuencias que usa Google', () => {
    assert.equal(unescapeJsString('\\x22hola\\x22'), '"hola"');
    assert.equal(unescapeJsString('a\\/b'), 'a/b');
    assert.equal(unescapeJsString('\\u00e1'), 'á');
    assert.equal(unescapeJsString('\\u{1f600}'), '😀');
    assert.equal(unescapeJsString('l\\nn'), 'l\nn');
    assert.equal(unescapeJsString('c:\\\\ruta'), 'c:\\ruta');
  });

  await t.test('4. Una carpeta privada se distingue de un cambio de formato', () => {
    const login = '<html><head><title>Iniciar sesión</title></head><body>' +
      '<a href="https://accounts.google.com/ServiceLogin?continue=x">Sign in to continue</a></body></html>';
    assert.throws(
      () => parsePublicFolderHtml(login),
      (error: unknown) => {
        assert.ok(error instanceof DriveFolderError);
        assert.equal(error.code, 'not_public');
        assert.match(error.message, /Cualquier persona con el enlace/);
        return true;
      },
      'La carpeta privada debe decir cómo compartirla',
    );

    assert.throws(
      () => parsePublicFolderHtml('<html><body>página nueva sin el blob</body></html>'),
      (error: unknown) => {
        assert.ok(error instanceof DriveFolderError);
        assert.equal(error.code, 'format_changed');
        // El día que Google cambie el formato, la salida es configurar una clave.
        assert.match(error.message, /GOOGLE_DRIVE_API_KEY/);
        return true;
      },
    );
  });

  await t.test('5. Un blob corrupto no revienta el proceso', () => {
    const html = "<html><title>X - Google Drive</title><script>window['_DRIVE_ivd'] = 'no-es-json';</script></html>";
    assert.throws(
      () => parsePublicFolderHtml(html),
      (error: unknown) => error instanceof DriveFolderError && error.code === 'format_changed',
    );
  });

  await t.test('6. Las filas incompletas se descartan en vez de entrar vacías', () => {
    const html = buildFolderHtml('Curso', [
      ivdItem('', 'sin id.mp4', VIDEO_MIME),
      ivdItem('file-ok', '', VIDEO_MIME),
      ivdItem('file-bueno', 'clase.mp4', VIDEO_MIME, 5),
    ]);
    const { entries } = parsePublicFolderHtml(html);
    assert.equal(entries.length, 1);
    assert.equal(entries[0].id, 'file-bueno');
  });
});

test('Drive: el recorrido respeta topes, orden y ciclos', async (t) => {
  const folder = (id: string, name: string): DriveEntry => ({
    id,
    name,
    mimeType: FOLDER_MIME,
    sizeBytes: 0,
    durationMs: null,
    isFolder: true,
  });
  const file = (id: string, name: string): DriveEntry => ({
    id,
    name,
    mimeType: VIDEO_MIME,
    sizeBytes: 1024,
    durationMs: null,
    isFolder: false,
  });

  const listerFor = (
    folders: Record<string, { name: string; entries: DriveEntry[] }>,
    log?: string[],
  ): DriveFolderLister => async (id: string) => {
    log?.push(id);
    const found = folders[id];
    if (!found) throw new DriveFolderError('not_found', `Carpeta desconocida: ${id}`);
    return found;
  };

  const baseOptions = { maxDepth: 4, maxNodes: 1000, concurrency: 4, timeoutMs: 30_000 };

  await t.test('1. Un árbol de dos niveles se lee completo y en orden', async () => {
    const result = await walkDriveFolder('root', {
      ...baseOptions,
      listFolder: listerFor({
        root: { name: 'Curso Inglés', entries: [folder('m1', 'Módulo 1'), folder('m2', 'Módulo 2'), file('f0', 'Léeme.mp4')] },
        m1: { name: 'Módulo 1', entries: [file('f1', 'a.mp4'), file('f2', 'b.mp4')] },
        m2: { name: 'Módulo 2', entries: [file('f3', 'c.mp4')] },
      }),
    });

    assert.equal(result.tree.name, 'Curso Inglés');
    assert.equal(result.tree.files.length, 1, 'Los sueltos de la raíz se conservan');
    assert.deepEqual(result.tree.folders.map((f) => f.name), ['Módulo 1', 'Módulo 2']);
    assert.equal(result.scannedFolders, 3);
    assert.equal(result.filesFound, 4);
    assert.equal(countTreeFiles(result.tree), 4);
    assert.equal(countTreeFolders(result.tree), 3);
    assert.deepEqual(result.limits, { depthReached: false, nodeLimitReached: false, timedOut: false });
  });

  await t.test('2. El tope de profundidad se marca en vez de callarse', async () => {
    const result = await walkDriveFolder('root', {
      ...baseOptions,
      maxDepth: 1,
      listFolder: listerFor({
        root: { name: 'Raíz', entries: [folder('m1', 'Módulo 1')] },
        m1: { name: 'Módulo 1', entries: [folder('s1', 'Sub'), file('f1', 'a.mp4')] },
        s1: { name: 'Sub', entries: [file('f2', 'b.mp4')] },
      }),
    });

    assert.equal(result.limits.depthReached, true, 'El árbol quedó incompleto y debe constar');
    assert.equal(result.tree.folders[0].folders.length, 0);
    assert.equal(result.filesFound, 1, 'Solo se leyó lo que cabía dentro del tope');
  });

  await t.test('3. El tope de elementos detiene el recorrido y lo marca', async () => {
    const result = await walkDriveFolder('root', {
      ...baseOptions,
      maxNodes: 2,
      listFolder: listerFor({
        root: { name: 'Raíz', entries: [folder('m1', 'M1'), folder('m2', 'M2'), file('f0', 'x.mp4')] },
        m1: { name: 'M1', entries: [file('f1', 'a.mp4')] },
        m2: { name: 'M2', entries: [file('f2', 'b.mp4')] },
      }),
    });

    assert.equal(result.limits.nodeLimitReached, true);
    assert.equal(result.scannedFolders, 1, 'No se bajó a las subcarpetas');
  });

  await t.test('4. Un ciclo por accesos directos termina en vez de colgarse', async () => {
    const result = await walkDriveFolder('a', {
      ...baseOptions,
      listFolder: listerFor({
        a: { name: 'A', entries: [folder('b', 'B')] },
        b: { name: 'B', entries: [folder('a', 'A otra vez'), file('f1', 'clase.mp4')] },
      }),
    });

    assert.equal(result.scannedFolders, 2, 'Cada carpeta se lee una sola vez');
    assert.equal(result.filesFound, 1);
    assert.equal(result.tree.folders[0].folders[0].files.length, 0, 'La repetición queda vacía');
  });

  await t.test('5. Un fallo al leer una subcarpeta no se traga', async () => {
    await assert.rejects(
      walkDriveFolder('root', {
        ...baseOptions,
        listFolder: listerFor({
          root: { name: 'Raíz', entries: [folder('rota', 'Rota')] },
        }),
      }),
      (error: unknown) => error instanceof DriveFolderError && error.code === 'not_found',
    );
  });

  await t.test('6. mapPool conserva el orden de entrada pese a la concurrencia', async () => {
    const delays = [30, 5, 20, 1, 15];
    const out = await mapPool(delays, 3, async (ms, index) => {
      await new Promise((resolve) => setTimeout(resolve, ms));
      return index;
    });
    assert.deepEqual(out, [0, 1, 2, 3, 4], 'El resultado va por posición, no por quién acabó antes');
  });
});

// ── Fase 2: plan determinista ───────────────────────────────────────

const NO_LIMITS = { depthReached: false, nodeLimitReached: false, timedOut: false };

function driveFile(name: string, mimeType: string, sizeBytes = 1024, durationMs: number | null = null): DriveEntry {
  return { id: `id-${name}`, name, mimeType, sizeBytes, durationMs, isFolder: false };
}

function planFromTree(tree: DriveTree) {
  return buildImportPlan({
    tree,
    sourceUrl: 'https://drive.google.com/drive/folders/1iGNmZq1P17ccE0pcSDYl1sH9vw6wCizs',
    sourceFolderId: '1iGNmZq1P17ccE0pcSDYl1sH9vw6wCizs',
    strategy: 'public',
    foldersScanned: 1,
    filesFound: tree.files.length,
    limits: NO_LIMITS,
  });
}

test('Plan: los nombres se ordenan y se limpian como espera una persona', async (t) => {
  await t.test('1. El orden es natural, no alfabético', () => {
    const names = ['10 Arrays.mp4', '2 Setup.mp4', '1 Intro.mp4', '21 Final.mp4'];
    assert.deepEqual(
      [...names].sort(naturalCompare),
      ['1 Intro.mp4', '2 Setup.mp4', '10 Arrays.mp4', '21 Final.mp4'],
      'Un sort alfabético pondría "10" antes que "2" y desordenaría el curso',
    );
  });

  await t.test('2. Se retiran prefijos numéricos y marcas de origen', () => {
    assert.equal(cleanTitle('001__[Udemy] Learn to Learn English.mp4'), 'Learn to Learn English');
    assert.equal(cleanTitle('13 - Naming Conventions and Packages.mp4'), 'Naming Conventions and Packages');
    assert.equal(cleanTitle('005 Section Overview.mp4'), 'Section Overview');
    assert.equal(
      cleanTitle('070 Resource_ Pomodoro Technique.html', { stripExtension: false }),
      'Resource Pomodoro Technique.html',
      'Los recursos conservan su extensión: "Guía.pdf" se lee mejor que "Guía"',
    );
    assert.equal(cleanTitle('2024 Guía fiscal.pdf'), '2024 Guía fiscal', 'Un año no es un número de clase');
  });

  await t.test('3. Limpiar nunca deja un título vacío', () => {
    assert.equal(cleanTitle('001 - .mp4'), '001 - .mp4', 'Se conserva el original antes que quedarse en blanco');
    assert.equal(cleanTitle('---'), '---');
  });

  await t.test('4. Las claves de emparejado toleran el sufijo de idioma', () => {
    assert.deepEqual(
      subtitleBaseKeys('027 You Can Avoid Risk.en_US.srt'),
      ['027 you can avoid risk.en_us', '027 you can avoid risk'],
    );
    assert.equal(baseKey('027 You Can Avoid Risk.mp4'), '027 you can avoid risk');
  });
});

test('Plan: cada archivo acaba donde le corresponde', async (t) => {
  await t.test('1. La extensión manda sobre el mime que entrega Drive', () => {
    // Drive devuelve application/octet-stream para .srt y para muchos .rar:
    // fiarse solo del mime dejaría subtítulos y comprimidos como "otro".
    assert.equal(contentKindFromMime('application/octet-stream', '027 Clase.en_US.srt'), 'subtitle');
    assert.equal(contentKindFromMime('application/octet-stream', 'Material.rar'), 'archive');
    assert.equal(contentKindFromMime('application/octet-stream', 'Proyecto.zip'), 'archive');
    assert.equal(contentKindFromMime('application/zip', 'Proyecto.zip'), 'archive');
    assert.equal(contentKindFromMime('video/mp4', '001 Clase.mp4'), 'video');
    assert.equal(contentKindFromMime('application/pdf', 'Guia.pdf'), 'pdf');
    assert.equal(contentKindFromMime('text/plain', 'Notas.txt'), 'note');
    assert.equal(contentKindFromMime('text/html', 'Recurso.html'), 'web');
    assert.equal(contentKindFromMime('application/vnd.google-apps.presentation', 'Slides'), 'slides');
  });

  await t.test('2. Los vídeos son lecciones y los ZIP/RAR/PDF, recursos del módulo', () => {
    const plan = planFromTree({
      id: 'root',
      name: 'Curso',
      files: [],
      folders: [
        {
          id: 'm1',
          name: '01 Introduction',
          folders: [],
          files: [
            driveFile('001 Course Outline.mp4', 'video/mp4', 130_000_000),
            driveFile('001 Course-Roadmap.txt', 'text/plain', 2_000),
            driveFile('Material del módulo.zip', 'application/zip', 5_000_000),
            driveFile('Ejercicios.rar', 'application/octet-stream', 3_000_000),
            driveFile('Guía.pdf', 'application/pdf', 400_000),
          ],
        },
      ],
    });

    const [moduleEntry] = plan.modules;
    assert.deepEqual(moduleEntry.lessons.map((lesson) => lesson.title), ['Course Outline']);
    assert.deepEqual(
      moduleEntry.resources.map((resource) => resource.contentKind).sort(),
      ['archive', 'archive', 'note', 'pdf'],
      'El comprimido, el RAR, el TXT y el PDF quedan como recursos descargables',
    );
    assert.ok(
      moduleEntry.resources.every((resource) => resource.kind === 'attachment'),
      'Ninguno es subtítulo, así que todos cuelgan del módulo',
    );
    assert.match(
      moduleEntry.resources[0].downloadUrl,
      /^https:\/\/drive\.google\.com\/uc\?export=download&id=/,
      'El recurso guarda una URL de descarga directa',
    );
  });

  await t.test('3. Un subtítulo se engancha a su vídeo pese al sufijo de idioma', () => {
    const plan = planFromTree({
      id: 'root',
      name: 'Curso',
      files: [],
      folders: [
        {
          id: 'm1',
          name: '02 The Principles',
          folders: [],
          files: [
            driveFile('027 You Can Avoid Risk.mp4', 'video/mp4', 24_000_000),
            driveFile('027 You Can Avoid Risk.en_US.srt', 'application/octet-stream', 4_000),
          ],
        },
      ],
    });

    const [moduleEntry] = plan.modules;
    assert.equal(moduleEntry.lessons.length, 1);
    assert.equal(moduleEntry.resources.length, 1);
    assert.equal(moduleEntry.resources[0].kind, 'subtitle');
    assert.equal(
      moduleEntry.resources[0].pairedWithLessonKey,
      moduleEntry.lessons[0].key,
      'El subtítulo apunta a su lección',
    );
    assert.equal(plan.stats.subtitles, 1);
  });

  await t.test('4. Un subtítulo huérfano se descarta y se cuenta', () => {
    const plan = planFromTree({
      id: 'root',
      name: 'Curso',
      files: [],
      folders: [
        {
          id: 'm1',
          name: 'M1',
          folders: [],
          files: [
            driveFile('Clase.mp4', 'video/mp4', 10_000_000),
            driveFile('Otra cosa.en_US.srt', 'application/octet-stream', 4_000),
          ],
        },
      ],
    });

    assert.equal(plan.stats.skipped, 1, 'Un .srt sin su vídeo no aporta nada por sí solo');
    assert.equal(plan.modules[0].resources.length, 0);
  });

  await t.test('5. Un módulo sin vídeos asciende sus documentos a lecciones', () => {
    // Sin esta regla, un módulo solo de PDF quedaría como un módulo vacío.
    const plan = planFromTree({
      id: 'root',
      name: 'Curso',
      files: [],
      folders: [
        {
          id: 'm1',
          name: 'Lecturas',
          folders: [],
          files: [
            driveFile('01 Capítulo uno.pdf', 'application/pdf', 500_000),
            driveFile('02 Capítulo dos.pdf', 'application/pdf', 600_000),
            driveFile('Anexos.zip', 'application/zip', 900_000),
          ],
        },
      ],
    });

    const [moduleEntry] = plan.modules;
    assert.deepEqual(moduleEntry.lessons.map((lesson) => lesson.title), ['Capítulo uno', 'Capítulo dos']);
    assert.deepEqual(moduleEntry.resources.map((resource) => resource.contentKind), ['archive']);
  });

  await t.test('6. Una carpeta sin nada aprovechable no genera módulo', () => {
    const plan = planFromTree({
      id: 'root',
      name: 'Curso',
      files: [],
      folders: [
        { id: 'vacia', name: 'Vacía', folders: [], files: [] },
        {
          id: 'm1',
          name: 'M1',
          folders: [],
          files: [driveFile('Clase.mp4', 'video/mp4', 10_000_000)],
        },
      ],
    });
    assert.deepEqual(plan.modules.map((entry) => entry.title), ['M1']);
  });
});

test('Plan: estructura, duración y metadatos del curso', async (t) => {
  await t.test('1. Las carpetas son módulos en orden natural y la raíz va al final', () => {
    const plan = planFromTree({
      id: 'root',
      name: 'Learning to Learn [Efficient Learning] Zero to Mastery',
      files: [driveFile('Léeme.pdf', 'application/pdf', 1_000)],
      folders: [
        { id: 'b', name: '10 Cierre', folders: [], files: [driveFile('c.mp4', 'video/mp4')] },
        { id: 'a', name: '02 Principios', folders: [], files: [driveFile('a.mp4', 'video/mp4')] },
      ],
    });

    assert.deepEqual(
      plan.modules.map((entry) => entry.title),
      ['Principios', 'Cierre', 'Material del curso'],
      'Los sueltos de la raíz son material de apoyo, no la primera lección',
    );
  });

  await t.test('2. La duración real de la API gana a la estimación por tamaño', () => {
    const plan = planFromTree({
      id: 'root',
      name: 'Curso',
      files: [],
      folders: [
        {
          id: 'm1',
          name: 'M1',
          folders: [],
          files: [
            driveFile('Con duración.mp4', 'video/mp4', 999_000_000, 754_000),
            driveFile('Sin duración.mp4', 'video/mp4', 7 * 1024 * 1024),
          ],
        },
      ],
    });

    const [real, estimated] = plan.modules[0].lessons;
    assert.equal(real.duration, '12:34', 'Se usa la duración que publica Drive');
    assert.equal(real.durationEstimated, false);
    assert.equal(estimated.duration, '1:00', '7 MB ≈ un minuto cuando no hay dato real');
    assert.equal(estimated.durationEstimated, true, 'La estimación debe poder señalarse en la interfaz');
  });

  await t.test('3. El formato de duración cambia al pasar de la hora', () => {
    assert.equal(formatDuration(0), '0:00');
    assert.equal(formatDuration(59), '0:59');
    assert.equal(formatDuration(600), '10:00');
    assert.equal(formatDuration(3600), '1:00:00');
    assert.equal(formatDuration(3661), '1:01:01');
  });

  await t.test('4. El título del curso se limpia y la categoría se deduce', () => {
    const plan = planFromTree({
      id: 'root',
      name: 'Learning to Learn [Efficient Learning] Zero to Mastery',
      files: [],
      folders: [{ id: 'm', name: 'M1', folders: [], files: [driveFile('a.mp4', 'video/mp4')] }],
    });
    assert.equal(plan.title, 'Learning to Learn [Efficient Learning] Zero to Mastery');
    assert.equal(plan.category, 'Desarrollo Personal');
    assert.equal(guessCategory('Curso completo de Inglés B2'), 'Inglés');
    assert.equal(guessCategory('Derecho Penal aplicado'), 'Derecho');
    assert.equal(guessCategory('Algo sin pistas'), 'Mentoría Elite', 'Ante la duda, la categoría por defecto');
  });

  await t.test('5. Los módulos repetidos no colisionan de nombre', () => {
    const plan = planFromTree({
      id: 'root',
      name: 'Curso',
      files: [],
      folders: [
        {
          id: 'a',
          name: 'Bloque',
          folders: [{ id: 'a1', name: 'Anexos', folders: [], files: [driveFile('x.mp4', 'video/mp4')] }],
          files: [],
        },
        {
          id: 'b',
          name: 'Bloque',
          folders: [{ id: 'b1', name: 'Anexos', folders: [], files: [driveFile('y.mp4', 'video/mp4')] }],
          files: [],
        },
      ],
    });
    const titles = plan.modules.map((entry) => entry.title);
    assert.equal(new Set(titles).size, titles.length, 'Dos módulos no pueden llamarse igual');
  });

  await t.test('6. Un árbol recortado marca el plan como incompleto', () => {
    const plan = buildImportPlan({
      tree: { id: 'root', name: 'Curso', files: [driveFile('a.mp4', 'video/mp4')], folders: [] },
      sourceUrl: 'https://drive.google.com/drive/folders/1iGNmZq1P17ccE0pcSDYl1sH9vw6wCizs',
      sourceFolderId: '1iGNmZq1P17ccE0pcSDYl1sH9vw6wCizs',
      strategy: 'public',
      foldersScanned: 1,
      filesFound: 1,
      limits: { depthReached: false, nodeLimitReached: true, timedOut: false },
    });
    assert.equal(plan.incomplete, true, 'El recorte debe llegar hasta quien confirma la importación');
  });

  await t.test('7. planTotals solo cuenta lo que sigue seleccionado', () => {
    const plan = planFromTree({
      id: 'root',
      name: 'Curso',
      files: [],
      folders: [
        {
          id: 'm1',
          name: 'M1',
          folders: [],
          files: [
            driveFile('a.mp4', 'video/mp4', 7 * 1024 * 1024),
            driveFile('b.mp4', 'video/mp4', 7 * 1024 * 1024),
            driveFile('c.zip', 'application/zip', 1_000),
          ],
        },
        { id: 'm2', name: 'M2', folders: [], files: [driveFile('d.mp4', 'video/mp4', 7 * 1024 * 1024)] },
      ],
    });

    assert.deepEqual(planTotals(plan), { modules: 2, lessons: 3, resources: 1, minutes: 3 });

    plan.modules[1].include = false;
    plan.modules[0].lessons[1].include = false;
    assert.deepEqual(planTotals(plan), { modules: 1, lessons: 1, resources: 1, minutes: 1 });
  });
});

test('Aplicar: el plan que vuelve del navegador se revalida entero', async (t) => {
  const FOLDER = '1iGNmZq1P17ccE0pcSDYl1sH9vw6wCizs';
  const VIDEO_ID = '1AbCdEfGhIjKlMnOpQrStUvWxYz01234';
  const ZIP_ID = '1ZzYyXxWwVvUuTtSsRrQqPpOoNnMm5678';

  const validPlan = () => ({
    title: 'Curso importado',
    category: 'Inglés',
    description: 'Descripción',
    sourceFolderId: FOLDER,
    modules: [
      {
        title: 'Módulo 1',
        include: true,
        lessons: [
          {
            title: 'Lección 1',
            driveFileId: VIDEO_ID,
            embedUrl: `https://drive.google.com/file/d/${VIDEO_ID}/preview`,
            mimeType: 'video/mp4',
            duration: '12:30',
            contentKind: 'video',
            include: true,
          },
        ],
        resources: [
          {
            title: 'material.zip',
            kind: 'attachment',
            driveFileId: ZIP_ID,
            downloadUrl: `https://drive.google.com/uc?export=download&id=${ZIP_ID}`,
            mimeType: 'application/zip',
            sizeBytes: 4096,
            contentKind: 'archive',
            include: true,
          },
        ],
      },
    ],
  });

  await t.test('1. Un plan correcto sobrevive con sus totales', () => {
    const plan = sanitizeImportPlan(validPlan());
    assert.equal(plan.title, 'Curso importado');
    assert.equal(plan.category, 'Inglés');
    assert.equal(plan.sourceFolderId, FOLDER);
    assert.deepEqual(plan.totals, { modules: 1, lessons: 1, resources: 1 });
    assert.equal(plan.modules[0].lessons[0].duration, '12:30');
    assert.equal(plan.modules[0].resources[0].sizeBytes, 4096);
    assert.equal(plan.modules[0].resources[0].isSubtitle, false);
  });

  await t.test('2. Las URLs se reconstruyen: no se guarda ninguna del cuerpo', () => {
    const hostile = validPlan();
    hostile.modules[0].lessons[0].embedUrl = 'https://evil.example/pwn';
    hostile.modules[0].resources[0].downloadUrl = 'javascript:alert(1)';

    const plan = sanitizeImportPlan(hostile);
    assert.equal(
      plan.modules[0].lessons[0].embedUrl,
      `https://drive.google.com/file/d/${VIDEO_ID}/preview`,
      'El reproductor solo debe recibir un embed de Drive construido aquí',
    );
    assert.equal(
      plan.modules[0].resources[0].downloadUrl,
      `https://drive.google.com/uc?export=download&id=${ZIP_ID}`,
    );
  });

  await t.test('3. Un identificador que no es de Drive se descarta', () => {
    const hostile = validPlan();
    hostile.modules[0].lessons[0].driveFileId = '../../etc/passwd';

    const plan = sanitizeImportPlan(hostile);
    assert.equal(plan.totals.lessons, 0, 'La lección con identificador inválido no entra');
    assert.equal(plan.totals.resources, 1, 'El recurso sano del módulo sí se conserva');

    const empty = validPlan();
    empty.modules[0].lessons[0].driveFileId = 'no';
    empty.modules[0].resources = [];
    assert.throws(() => sanitizeImportPlan(empty), ImportPlanError);
  });

  await t.test('4. Una carpeta de origen inválida detiene la importación', () => {
    const plan = validPlan();
    plan.sourceFolderId = 'https://drive.google.com/drive/folders/' + FOLDER;
    assert.throws(
      () => sanitizeImportPlan(plan),
      (error: unknown) => error instanceof ImportPlanError && error.code === 'invalid',
    );
  });

  await t.test('5. Lo desmarcado no llega a la base de datos', () => {
    const partial = validPlan();
    partial.modules[0].lessons[0].include = false;
    assert.deepEqual(sanitizeImportPlan(partial).totals, { modules: 1, lessons: 0, resources: 1 });

    const nothing = validPlan();
    nothing.modules[0].include = false;
    assert.throws(
      () => sanitizeImportPlan(nothing),
      (error: unknown) => error instanceof ImportPlanError && error.code === 'empty',
    );
  });

  await t.test('6. El mismo archivo dos veces entra una sola vez', () => {
    const duplicated = validPlan();
    duplicated.modules.push({
      ...duplicated.modules[0],
      title: 'Módulo 2',
      lessons: [{ ...duplicated.modules[0].lessons[0] }],
      resources: [],
    });

    const plan = sanitizeImportPlan(duplicated);
    assert.equal(plan.totals.lessons, 1, 'El progreso del curso contaría dos veces la misma clase');
    assert.equal(plan.totals.modules, 1, 'Un módulo que se queda sin contenido no se crea');
  });

  await t.test('7. Los campos hostiles se sanean en vez de propagarse', () => {
    const messy = validPlan();
    messy.modules[0].lessons[0].title = `  Lección  con basura  `;
    messy.modules[0].lessons[0].mimeType = 'video/mp4; evil';
    messy.modules[0].lessons[0].duration = '99:99:99';
    messy.modules[0].lessons[0].contentKind = 'inventado';
    messy.modules[0].resources[0].sizeBytes = -5;

    const lesson = sanitizeImportPlan(messy).modules[0].lessons[0];
    assert.equal(lesson.title, 'Lección con basura');
    assert.equal(lesson.mimeType, 'video/mp4', 'Un mime con basura cae al valor por defecto');
    assert.equal(lesson.duration, '0:00', 'Una duración imposible no se guarda tal cual');
    assert.equal(lesson.contentKind, 'other');
    assert.equal(sanitizeImportPlan(messy).modules[0].resources[0].sizeBytes, null);
  });

  await t.test('8. Un título demasiado largo se recorta al límite', () => {
    const long = validPlan();
    long.modules[0].lessons[0].title = 'a'.repeat(IMPORT_LIMITS.maxTitleLength + 50);
    assert.equal(
      sanitizeImportPlan(long).modules[0].lessons[0].title.length,
      IMPORT_LIMITS.maxTitleLength,
    );
  });

  await t.test('9. Un plan desmedido se rechaza antes de escribir nada', () => {
    const huge = validPlan();
    huge.modules[0].lessons = Array.from(
      { length: IMPORT_LIMITS.maxLessonsPerModule + 1 },
      (_unused, index) => ({
        ...validPlan().modules[0].lessons[0],
        driveFileId: `1AbCdEfGhIjKlMnOpQrStUvWxYz${String(index).padStart(5, '0')}`,
      }),
    );
    assert.throws(
      () => sanitizeImportPlan(huge),
      (error: unknown) => error instanceof ImportPlanError && error.code === 'too_large',
    );
  });

  await t.test('10. Una entrada que no es un plan no revienta el servidor', () => {
    for (const value of [null, undefined, 'texto', 42, [], { modules: 'no' }]) {
      assert.throws(() => sanitizeImportPlan(value), ImportPlanError);
    }
  });

  await t.test('11. El plan real de la fase 2 pasa la revalidación sin perder nada', () => {
    // `driveFile` genera identificadores legibles (`id-<nombre>`) que el
    // revalidador rechazaría con razón: aquí hacen falta identificadores con la
    // forma real de Drive.
    const realFile = (id: string, name: string, mimeType: string, sizeBytes: number): DriveEntry => ({
      id,
      name,
      mimeType,
      sizeBytes,
      durationMs: null,
      isFolder: false,
    });

    const source = planFromTree({
      id: FOLDER,
      name: 'Curso de Drive',
      files: [],
      folders: [
        {
          id: '1module00000000000000000000000000',
          name: '01 Introducción',
          folders: [],
          files: [
            realFile(VIDEO_ID, '001 Bienvenida.mp4', 'video/mp4', 70 * 1024 * 1024),
            realFile('1SubTitle000000000000000000000000', '001 Bienvenida.es.srt', 'application/octet-stream', 2_000),
            realFile(ZIP_ID, 'Recursos.zip', 'application/zip', 500_000),
          ],
        },
      ],
    });

    const sanitized = sanitizeImportPlan(JSON.parse(JSON.stringify(source)));
    assert.deepEqual(sanitized.totals, { modules: 1, lessons: 1, resources: 2 });
    assert.equal(sanitized.modules[0].lessons[0].title, 'Bienvenida');
    assert.equal(sanitized.modules[0].resources.filter((item) => item.isSubtitle).length, 1);
  });
});

test('IA: la eleccion de proveedor en caliente respeta la preferencia', async (t) => {
  const settings = {
    provider: 'openai' as const,
    preference: 'auto' as const,
    openaiApiKey: 'sk-openai',
    openaiBaseUrl: 'https://api.openai.com/v1',
    openaiModel: 'gpt-4o-mini',
    deepseekApiKey: 'sk-deepseek',
    deepseekBaseUrl: 'https://api.deepseek.com',
    deepseekModel: 'deepseek-chat',
  };

  await t.test('1. Con `auto` y las dos claves, DeepSeek queda de respaldo', () => {
    assert.deepEqual(
      listAiCandidates(settings).map((candidate) => candidate.provider),
      ['openai', 'deepseek'],
    );
  });

  await t.test('2. Una preferencia explícita no cae al otro proveedor', () => {
    assert.deepEqual(
      listAiCandidates({ ...settings, preference: 'openai' }).map((c) => c.provider),
      ['openai'],
      'Quien fija OPENAI_API_KEY como preferencia no espera que sus datos acaben en DeepSeek',
    );
  });

  await t.test('3. Sin OpenAI, DeepSeek atiende y no hay respaldo que ofrecer', () => {
    const onlyDeepSeek = { ...settings, provider: 'deepseek' as const, openaiApiKey: undefined };
    assert.deepEqual(listAiCandidates(onlyDeepSeek).map((c) => c.provider), ['deepseek']);
  });

  await t.test('4. Sin proveedor resuelto no hay a quién preguntar', () => {
    assert.deepEqual(listAiCandidates({ ...settings, provider: 'none' }), []);
  });
});

test('IA: la respuesta del modelo se interpreta o se rechaza', async (t) => {
  await t.test('1. Un JSON limpio se lee tal cual', () => {
    assert.deepEqual(extractJsonObject('{"titulo":"Curso"}'), { titulo: 'Curso' });
  });

  await t.test('2. Se sobrevive al bloque de código y a la frase de cortesía', () => {
    assert.deepEqual(extractJsonObject('```json\n{"a":1}\n```'), { a: 1 });
    assert.deepEqual(extractJsonObject('Claro, aquí tienes:\n{"a":2}\nEspero que sirva.'), { a: 2 });
  });

  await t.test('3. Lo que no trae objeto JSON se rechaza con motivo', () => {
    for (const value of ['', 'no puedo ayudarte con eso', '{roto']) {
      assert.throws(
        () => extractJsonObject(value),
        (error: unknown) => error instanceof AiError && error.code === 'invalid_response',
      );
    }
  });
});

test('IA: el respaldo entre proveedores funciona en caliente', async (t) => {
  const candidates = [
    { provider: 'openai' as const, apiKey: 'sk-a', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
    { provider: 'deepseek' as const, apiKey: 'sk-b', baseUrl: 'https://api.deepseek.com', model: 'deepseek-chat' },
  ];
  const okBody = (content: string) =>
    new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 });

  await t.test('1. La petición va al endpoint y con las cabeceras del proveedor', async () => {
    const calls: { url: string; auth: string; body: any }[] = [];
    const result = await requestAiJson({
      system: 's',
      user: 'u',
      candidates: [candidates[0]],
      fetchImpl: (async (url: any, init: any) => {
        calls.push({
          url: String(url),
          auth: String(init.headers.authorization),
          body: JSON.parse(String(init.body)),
        });
        return okBody('{"titulo":"ok"}');
      }) as unknown as typeof fetch,
    });

    assert.equal(calls[0].url, 'https://api.openai.com/v1/chat/completions');
    assert.equal(calls[0].auth, 'Bearer sk-a');
    assert.equal(calls[0].body.model, 'gpt-4o-mini');
    assert.equal(calls[0].body.messages.length, 2);
    assert.deepEqual(result.data, { titulo: 'ok' });
    assert.equal(result.provider, 'openai');
  });

  await t.test('2. Si OpenAI falla, DeepSeek responde sin que nadie lo note', async () => {
    const used: string[] = [];
    const result = await requestAiJson({
      system: 's',
      user: 'u',
      candidates,
      fetchImpl: (async (url: any) => {
        used.push(String(url));
        if (String(url).includes('openai')) return new Response('cuota agotada', { status: 429 });
        return okBody('{"titulo":"desde deepseek"}');
      }) as unknown as typeof fetch,
    });

    assert.equal(used.length, 2, 'Debe intentarse el respaldo, no rendirse al primer fallo');
    assert.equal(result.provider, 'deepseek');
    assert.deepEqual(result.data, { titulo: 'desde deepseek' });
  });

  await t.test('3. Sin candidatos la llamada se corta antes de salir a la red', async () => {
    await assert.rejects(
      () => requestAiJson({ system: 's', user: 'u', candidates: [] }),
      (error: unknown) => error instanceof AiError && error.code === 'disabled',
    );
  });

  await t.test('4. Si fallan todos, el error lo dice y no cuelga', async () => {
    await assert.rejects(
      () =>
        requestAiJson({
          system: 's',
          user: 'u',
          candidates,
          fetchImpl: (async () => {
            throw new Error('sin red');
          }) as unknown as typeof fetch,
        }),
      (error: unknown) => error instanceof AiError && error.code === 'unavailable',
    );
  });
});

test('IA: la propuesta solo se aplica si conserva todas las lecciones', async (t) => {
  const twoModulePlan = () =>
    planFromTree({
      id: 'root',
      name: 'curso_de_prueba',
      files: [],
      folders: [
        {
          id: 'f1',
          name: '01 Intro',
          folders: [],
          files: [
            driveFile('001 Bienvenida.mp4', 'video/mp4', 7 * 1024 * 1024),
            driveFile('001 Bienvenida.es.srt', 'application/octet-stream', 1_000),
            driveFile('002 Setup.mp4', 'video/mp4', 7 * 1024 * 1024),
            driveFile('Guia.pdf', 'application/pdf', 5_000),
          ],
        },
        {
          id: 'f2',
          name: '02 Practica',
          folders: [],
          files: [driveFile('010 Ejercicio.mp4', 'video/mp4', 7 * 1024 * 1024)],
        },
      ],
    });

  const goodProposal = {
    titulo: 'Curso de prueba en condiciones',
    descripcion: 'Dos módulos con lo esencial.',
    categoria: 'Ingeniería',
    modulos: [
      {
        id: 'm0',
        titulo: 'Introducción',
        lecciones: [
          { id: 'l0_0', titulo: 'Bienvenida al curso' },
          { id: 'l0_1', titulo: 'Preparar el entorno' },
        ],
      },
      { id: 'm1', titulo: 'Práctica guiada', lecciones: [{ id: 'l1_0', titulo: 'Primer ejercicio' }] },
    ],
  };

  await t.test('1. El plan compacto que ve la IA no lleva identificadores ni URLs de Drive', () => {
    const { payload } = compactPlanForAi(twoModulePlan());
    const serialized = JSON.stringify(payload);
    assert.equal(serialized.includes('drive.google.com'), false);
    assert.equal(serialized.includes('id-001 Bienvenida.mp4'), false, 'Ni siquiera el identificador del archivo');
    assert.deepEqual(payload.modulos.map((m) => m.id), ['m0', 'm1']);
    assert.deepEqual(payload.modulos[0].lecciones.map((l) => l.id), ['l0_0', 'l0_1']);
  });

  await t.test('2. Una propuesta correcta renombra sin tocar el contenido', () => {
    const original = twoModulePlan();
    const organized = applyAiOrganization(original, goodProposal);

    assert.equal(organized.title, 'Curso de prueba en condiciones');
    assert.equal(organized.category, 'Ingeniería');
    assert.equal(organized.aiOrganized, true);
    assert.equal(organized.modules[0].title, 'Introducción');
    assert.equal(organized.modules[0].lessons[0].title, 'Bienvenida al curso');
    assert.equal(
      organized.modules[0].lessons[0].embedUrl,
      original.modules[0].lessons[0].embedUrl,
      'La IA renombra; el enlace de reproducción es intocable',
    );
    assert.equal(organized.modules[0].lessons[0].driveFileId, original.modules[0].lessons[0].driveFileId);
    assert.equal(organized.modules[0].lessons[0].duration, original.modules[0].lessons[0].duration);
    assert.equal(original.modules[0].title, 'Intro', 'El plan original no se modifica');
  });

  await t.test('3. Los recursos siguen intactos y sin perderse', () => {
    const organized = applyAiOrganization(twoModulePlan(), goodProposal);
    const total = organized.modules.reduce((n, m) => n + m.resources.length, 0);
    assert.equal(total, 2, 'El subtítulo y el PDF siguen ahí');
    assert.equal(organized.modules[0].resources.some((r) => r.kind === 'subtitle'), true);
  });

  await t.test('4. Dejarse una lección invalida la propuesta entera', () => {
    const incomplete = structuredClone(goodProposal);
    incomplete.modulos[0].lecciones.pop();
    assert.throws(() => applyAiOrganization(twoModulePlan(), incomplete), AiPlanRejected);
  });

  await t.test('5. Inventarse una lección invalida la propuesta entera', () => {
    const invented = structuredClone(goodProposal);
    invented.modulos[1].lecciones.push({ id: 'l9_9', titulo: 'Clase que no existe' });
    assert.throws(() => applyAiOrganization(twoModulePlan(), invented), AiPlanRejected);
  });

  await t.test('6. Repetir una lección invalida la propuesta entera', () => {
    const repeated = structuredClone(goodProposal);
    repeated.modulos[1].lecciones.push({ id: 'l0_0', titulo: 'Bienvenida otra vez' });
    assert.throws(() => applyAiOrganization(twoModulePlan(), repeated), AiPlanRejected);
  });

  await t.test('7. Con carpetas ya organizadas, la IA no puede rehacer los módulos', () => {
    const merged = {
      ...goodProposal,
      modulos: [
        {
          id: 'm0',
          titulo: 'Todo junto',
          lecciones: [
            { id: 'l0_0', titulo: 'a' },
            { id: 'l0_1', titulo: 'b' },
            { id: 'l1_0', titulo: 'c' },
          ],
        },
      ],
    };
    assert.throws(() => applyAiOrganization(twoModulePlan(), merged), AiPlanRejected);
  });

  await t.test('8. Una respuesta vacía o absurda se rechaza', () => {
    for (const value of [null, {}, { modulos: [] }, { modulos: 'no' }]) {
      assert.throws(() => applyAiOrganization(twoModulePlan(), value), AiPlanRejected);
    }
  });

  await t.test('9. Una carpeta plana sí se puede reagrupar, y el subtítulo sigue a su vídeo', () => {
    const flat = planFromTree({
      id: 'root',
      name: 'Curso plano',
      folders: [],
      files: [
        driveFile('001 Uno.mp4', 'video/mp4', 7 * 1024 * 1024),
        driveFile('001 Uno.es.srt', 'application/octet-stream', 900),
        driveFile('002 Dos.mp4', 'video/mp4', 7 * 1024 * 1024),
        driveFile('003 Tres.mp4', 'video/mp4', 7 * 1024 * 1024),
        driveFile('Extras.zip', 'application/zip', 4_000),
      ],
    });
    assert.equal(flat.modules.length, 1, 'Sin subcarpetas el planificador deja un único módulo');
    assert.equal(allowsRegrouping(flat), true);

    const organized = applyAiOrganization(flat, {
      titulo: 'Curso plano organizado',
      modulos: [
        { id: 'm0', titulo: 'Fundamentos', lecciones: [{ id: 'l0_0', titulo: 'Uno' }] },
        {
          titulo: 'Avanzado',
          lecciones: [
            { id: 'l0_1', titulo: 'Dos' },
            { id: 'l0_2', titulo: 'Tres' },
          ],
        },
      ],
    });

    assert.equal(organized.modules.length, 2);
    assert.deepEqual(organized.modules.map((m) => m.lessons.length), [1, 2]);
    assert.equal(
      organized.modules[0].resources.some((r) => r.kind === 'subtitle'),
      true,
      'El subtítulo debe viajar al módulo donde acabó su vídeo',
    );
    const resources = organized.modules.reduce((n, m) => n + m.resources.length, 0);
    assert.equal(resources, 2, 'El ZIP tampoco se pierde al reagrupar');
  });
});

test('IA: organizeImportPlan nunca rompe una importación', async (t) => {
  const plan = () =>
    planFromTree({
      id: 'root',
      name: 'Curso',
      files: [],
      folders: [
        { id: 'f1', name: '01 Intro', folders: [], files: [driveFile('001 Uno.mp4', 'video/mp4', 7 * 1024 * 1024)] },
      ],
    });

  await t.test('1. Con una propuesta válida, devuelve el plan pulido', async () => {
    const outcome = await organizeImportPlan(plan(), {
      requestJson: async () => ({
        data: {
          titulo: 'Curso pulido',
          modulos: [{ id: 'm0', titulo: 'Introducción', lecciones: [{ id: 'l0_0', titulo: 'Primera clase' }] }],
        },
        provider: 'openai',
        model: 'gpt-4o-mini',
        elapsedMs: 12,
      }),
    });

    assert.equal(outcome.organized, true);
    assert.equal(outcome.plan.title, 'Curso pulido');
    assert.equal(outcome.plan.modules[0].lessons[0].title, 'Primera clase');
    assert.equal(outcome.provider, 'openai');
  });

  await t.test('2. Si la IA no está disponible, se devuelve el plan determinista', async () => {
    const original = plan();
    const outcome = await organizeImportPlan(original, {
      requestJson: async () => {
        throw new AiError('No hay ningún proveedor de IA configurado.', 'disabled');
      },
    });

    assert.equal(outcome.organized, false);
    assert.equal(outcome.plan.modules[0].lessons[0].title, original.modules[0].lessons[0].title);
    assert.match(String(outcome.reason), /proveedor/i);
  });

  await t.test('3. Si la propuesta no supera la verificación, se descarta con motivo', async () => {
    const outcome = await organizeImportPlan(plan(), {
      requestJson: async () => ({
        data: { modulos: [{ id: 'm0', titulo: 'Vacío', lecciones: [] }] },
        provider: 'deepseek',
        model: 'deepseek-chat',
        elapsedMs: 8,
      }),
    });

    assert.equal(outcome.organized, false);
    assert.equal(outcome.plan.aiOrganized, false);
    assert.match(String(outcome.reason), /lecci[oó]n/i);
  });
});
