/**
 * La duración que ve el alumno es la real del video en cuanto se conoce, no la
 * estimación con la que se importó (Drive la calcula por el tamaño del archivo).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { formatClockDuration, serializeCourseForViewer } from '../server/courseAccess.js';

test('formatClockDuration', () => {
  assert.equal(formatClockDuration(0), '0:00');
  assert.equal(formatClockDuration(24.4), '0:24');
  assert.equal(formatClockDuration(75), '1:15');
  assert.equal(formatClockDuration(635), '10:35');
  assert.equal(formatClockDuration(3725), '1:02:05');
});

const course = (videos: any[]) => ({
  id: 'c1',
  title: 'Curso',
  description: '',
  price: 0,
  currency: 'USD',
  modules: [{ id: 'm1', title: 'M1', order: 1, videos, resources: [] }],
  resources: [],
});

test('con duración real conocida se muestra esa en vez de la estimada', () => {
  const out: any = serializeCourseForViewer(
    course([
      { id: 'v1', title: 'cod', duration: '8:29', mediaDurationSeconds: 24, source: 'GOOGLE_DRIVE', embedUrl: 'https://drive.google.com/file/d/abc/preview', order: 1 },
      { id: 'v2', title: 'manual', duration: '20:00', mediaDurationSeconds: null, source: 'EXTERNAL_URL', embedUrl: 'https://example.invalid/v', order: 2 },
    ]),
    true,
  );
  const [v1, v2] = out.modules[0].videos;
  assert.equal(v1.duration, '0:24');
  assert.equal(v2.duration, '20:00', 'sin dato real se conserva el texto guardado');
});
