/**
 * Panel de importacion desde Drive.
 *
 * No hay navegador en las pruebas, asi que esto no simula clics: renderiza los
 * componentes y comprueba lo que mas se rompe en la practica —un icono que no
 * existe, un campo del plan que cambia de nombre en el servidor, un total mal
 * sumado— y que la pantalla inicial dice lo que tiene que decir.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DriveCourseImport, PlanTree, selectedTotals } from '../src/components/DriveCourseImport.js';
import type { ImportPlan } from '../src/types.js';

/** El mismo objeto que devuelve `/api/admin/drive/import/preview`. */
function samplePlan(): ImportPlan {
  return {
    title: 'Curso de prueba',
    category: 'Ingeniería',
    description: 'Importado desde Google Drive.',
    sourceUrl: 'https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOpQrStUvWxYz01234',
    sourceFolderId: '1AbCdEfGhIjKlMnOpQrStUvWxYz01234',
    strategy: 'public',
    aiOrganized: false,
    incomplete: false,
    limits: { depthReached: false, nodeLimitReached: false, timedOut: false },
    stats: {
      foldersScanned: 2,
      filesFound: 4,
      lessons: 2,
      resources: 2,
      subtitles: 1,
      skipped: 0,
      minutes: 15,
    },
    modules: [
      {
        key: 'm1',
        title: 'Introducción',
        originalName: '01 Intro',
        path: ['01 Intro'],
        include: true,
        lessons: [
          {
            key: 'l1',
            title: 'Bienvenida',
            originalName: '001 Bienvenida.mp4',
            driveFileId: '1AbCdEfGhIjKlMnOpQrStUvWxYz01234',
            embedUrl: 'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz01234/preview',
            mimeType: 'video/mp4',
            contentKind: 'video',
            duration: '10:00',
            durationSeconds: 600,
            durationEstimated: true,
            sizeBytes: 70 * 1024 * 1024,
            include: true,
          },
          {
            key: 'l2',
            title: 'Clase descartada',
            originalName: '002 Extra.mp4',
            driveFileId: '1ZzYyXxWwVvUuTtSsRrQqPpOoNnMm5678',
            embedUrl: 'https://drive.google.com/file/d/1ZzYyXxWwVvUuTtSsRrQqPpOoNnMm5678/preview',
            mimeType: 'video/mp4',
            contentKind: 'video',
            duration: '5:00',
            durationSeconds: 300,
            durationEstimated: true,
            sizeBytes: 35 * 1024 * 1024,
            include: false,
          },
        ],
        resources: [
          {
            key: 'r1',
            kind: 'attachment',
            title: 'Material.zip',
            originalName: 'Material.zip',
            driveFileId: '1Rrr0000000000000000000000000000',
            downloadUrl: 'https://drive.google.com/uc?export=download&id=1Rrr0000000000000000000000000000',
            mimeType: 'application/zip',
            sizeBytes: 5 * 1024 * 1024,
            contentKind: 'archive',
            pairedWithLessonKey: null,
            include: true,
          },
          {
            key: 'r2',
            kind: 'subtitle',
            title: 'Bienvenida.es.srt',
            originalName: 'Bienvenida.es.srt',
            driveFileId: '1Sss0000000000000000000000000000',
            downloadUrl: 'https://drive.google.com/uc?export=download&id=1Sss0000000000000000000000000000',
            mimeType: 'application/octet-stream',
            sizeBytes: 2_048,
            contentKind: 'subtitle',
            pairedWithLessonKey: 'l1',
            include: true,
          },
        ],
      },
      {
        key: 'm2',
        title: 'Módulo descartado',
        originalName: '02 Extra',
        path: ['02 Extra'],
        include: false,
        lessons: [
          {
            key: 'l3',
            title: 'Sobra',
            originalName: '003 Sobra.mp4',
            driveFileId: '1Ttt0000000000000000000000000000',
            embedUrl: 'https://drive.google.com/file/d/1Ttt0000000000000000000000000000/preview',
            mimeType: 'video/mp4',
            contentKind: 'video',
            duration: '9:00',
            durationSeconds: 540,
            durationEstimated: true,
            sizeBytes: 60 * 1024 * 1024,
            include: true,
          },
        ],
        resources: [],
      },
    ],
  };
}

test('Panel de importación: la pantalla inicial explica qué se va a hacer', async (t) => {
  const html = renderToStaticMarkup(
    React.createElement(DriveCourseImport, { onImported: () => {} }),
  );

  await t.test('1. Se pide el enlace de la carpeta y nada más', () => {
    assert.match(html, /Importar desde Google Drive/);
    assert.match(html, /drive\.google\.com\/drive\/folders/, 'El campo muestra un ejemplo del enlace');
    assert.match(html, /Analizar/);
  });

  await t.test('2. Se advierte de que analizar no guarda nada', () => {
    assert.match(html, /Nada se guarda hasta/);
  });

  await t.test('3. Sin plan todavía no se ofrece crear el curso', () => {
    assert.equal(html.includes('Crear curso'), false);
    assert.equal(html.includes('Mejorar con IA'), false);
  });
});

test('Panel de importación: los totales cuentan solo lo seleccionado', async (t) => {
  await t.test('1. Un módulo o una lección desmarcados no suman', () => {
    assert.deepEqual(selectedTotals(samplePlan()), {
      modules: 1,
      lessons: 1,
      resources: 2,
      minutes: 10,
    });
  });

  await t.test('2. Sin nada marcado, el botón de crear no tendría qué enviar', () => {
    const plan = samplePlan();
    for (const moduleEntry of plan.modules) moduleEntry.include = false;
    assert.deepEqual(selectedTotals(plan), { modules: 0, lessons: 0, resources: 0, minutes: 0 });
  });

  await t.test('3. Un módulo que solo aporta recursos sigue contando', () => {
    const plan = samplePlan();
    plan.modules[0].lessons.forEach((lesson) => (lesson.include = false));
    assert.deepEqual(selectedTotals(plan), { modules: 1, lessons: 0, resources: 2, minutes: 0 });
  });
});

test('Panel de importación: el árbol del plan se dibuja entero', async (t) => {
  const plan = samplePlan();
  const html = renderToStaticMarkup(
    React.createElement(PlanTree, { modules: plan.modules, expanded: new Set(['m1']) }),
  );

  await t.test('1. Se ven el módulo, sus lecciones y sus recursos', () => {
    assert.match(html, /value="Introducción"/);
    assert.match(html, /value="Bienvenida"/);
    assert.match(html, /Recursos del módulo/);
    assert.match(html, /Material\.zip/);
    assert.match(html, /Comprimido/);
    assert.match(html, /Subtítulos/);
    assert.match(html, /5\.0 MB/, 'El tamaño ayuda a decidir qué desmarcar');
  });

  await t.test('2. Lo desmarcado se muestra tachado, no oculto', () => {
    assert.match(html, /line-through/);
    assert.match(html, /value="Clase descartada"/, 'Sigue estando, para poder volver a marcarla');
  });

  await t.test('3. La duración estimada se distingue de la real', () => {
    assert.match(html, /10:00~/);
  });

  await t.test('4. Un módulo plegado no dibuja su contenido', () => {
    assert.equal(html.includes('value="Sobra"'), false);
    assert.match(html, /value="Módulo descartado"/, 'La cabecera del módulo sí se ve');
  });

  await t.test('5. Cada casilla se puede nombrar en voz alta', () => {
    assert.match(html, /aria-label="Incluir el módulo Introducción"/);
    assert.match(html, /aria-label="Incluir la lección Bienvenida"/);
    assert.match(html, /aria-label="Incluir el recurso Material.zip"/);
  });

  await t.test('6. El recuento por módulo refleja lo marcado', () => {
    assert.match(html, /1 lección · 2 recursos/, 'Singular y plural, no "1 lecciones"');
    assert.match(html, /1 lección · 0 recursos/);
  });
});
