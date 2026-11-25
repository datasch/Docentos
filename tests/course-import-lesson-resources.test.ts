import test from 'node:test';
import assert from 'node:assert/strict';
import { buildImportPlan, sanitizeImportPlan } from '../server/courseImportPlan.js';
import type { DriveEntry, DriveTree } from '../server/driveFolder.js';

const NO_LIMITS = { depthReached: false, nodeLimitReached: false, timedOut: false };

const SOURCE_FOLDER = '1iGNmZq1P17ccE0pcSDYl1sH9vw6wCizs';
let counter = 0;
// Ids con forma de id de Drive: la depuración del plan descarta los que no lo parecen.
const file = (name: string, mimeType: string, sizeBytes = 2048): DriveEntry =>
  ({ id: `Drv${String(++counter).padStart(3, '0')}abcdefghijklmnopqrstuvwxyz`, name, mimeType, sizeBytes, durationMs: null, isFolder: false });

function plan(files: DriveEntry[]) {
  const tree: DriveTree = { id: 'root', name: 'Curso', folders: [{ id: 'm1', name: '01 Fundamentos', folders: [], files }], files: [] };
  return buildImportPlan({
    tree,
    sourceUrl: 'https://drive.google.com/drive/folders/1iGNmZq1P17ccE0pcSDYl1sH9vw6wCizs',
    sourceFolderId: '1iGNmZq1P17ccE0pcSDYl1sH9vw6wCizs',
    strategy: 'public',
    foldersScanned: 1,
    filesFound: files.length,
    limits: NO_LIMITS,
  });
}

test('Importación: un recurso con el nombre de una lección se asigna a ella', async (t) => {
  const built = plan([
    file('01 Introducción.mp4', 'video/mp4', 24_000_000),
    file('02 Variables.mp4', 'video/mp4', 24_000_000),
    file('02 Variables.pdf', 'application/pdf'),
    file('Plantillas generales.zip', 'application/zip'),
  ]);
  const [moduleEntry] = built.modules;
  const variables = moduleEntry.lessons.find((lesson) => lesson.originalName === '02 Variables.mp4')!;
  const pdf = moduleEntry.resources.find((resource) => resource.originalName === '02 Variables.pdf')!;
  const zip = moduleEntry.resources.find((resource) => resource.originalName === 'Plantillas generales.zip')!;

  await t.test('el PDF con el mismo nombre base cuelga de su lección y sigue siendo un adjunto', () => {
    assert.equal(pdf.pairedWithLessonKey, variables.key);
    assert.equal(pdf.kind, 'attachment');
  });

  await t.test('el archivo sin lección homónima queda en el módulo', () => {
    assert.equal(zip.pairedWithLessonKey, null);
  });

  await t.test('el plan depurado conserva la lección solo si sigue en el módulo', () => {
    const clean = sanitizeImportPlan({ sourceFolderId: SOURCE_FOLDER, courseTitle: 'Curso', title: 'Curso', modules: built.modules });
    const resources = clean.modules[0].resources;
    assert.equal(resources.find((r) => r.title.includes('Variables'))?.lessonDriveFileId, variables.driveFileId);
    assert.equal(resources.find((r) => r.title.includes('Plantillas'))?.lessonDriveFileId, null);

    const forged = sanitizeImportPlan({
      sourceFolderId: SOURCE_FOLDER,
      courseTitle: 'Curso',
      title: 'Curso',
      modules: built.modules.map((m) => ({ ...m, resources: m.resources.map((r) => ({ ...r, pairedWithLessonKey: 'otra-leccion-inexistente' })) })),
    });
    assert.ok(forged.modules[0].resources.every((r) => r.lessonDriveFileId === null));
  });
});
