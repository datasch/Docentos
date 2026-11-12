/**
 * Reglas del servidor para "visto de forma limpia": qué lecciones se miden,
 * cómo se validan los tramos, cuánto puede crecer lo visto entre envíos y qué
 * duración se guarda.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HEARTBEAT_SLACK_SECONDS,
  MAX_PLAYBACK_RATE,
  MAX_RANGES,
  applyHeartbeat,
  chooseDuration,
  isTrackedVideo,
  sanitizeRanges,
  serverWatchedFraction,
} from '../server/watchService.js';

test('isTrackedVideo decide con los mismos datos que el navegador', () => {
  assert.equal(
    isTrackedVideo({
      id: 'd1',
      source: 'GOOGLE_DRIVE',
      driveFileId: '1abcXYZ',
      embedUrl: 'https://drive.google.com/file/d/1abcXYZ/preview',
    }),
    true,
  );
  // Drive guardado como EXTERNAL_URL con una URL de preview.
  assert.equal(
    isTrackedVideo({
      id: 'd2',
      source: 'EXTERNAL_URL',
      driveFileId: '',
      embedUrl: 'https://drive.google.com/file/d/ABC123/preview',
    }),
    true,
  );
  assert.equal(
    isTrackedVideo({
      id: 'y1',
      source: 'YOUTUBE',
      driveFileId: 'dQw4w9WgXcQ',
      embedUrl: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
    }),
    true,
  );
  assert.equal(
    isTrackedVideo({ id: 'v1', source: 'EXTERNAL_URL', driveFileId: '', embedUrl: 'https://vimeo.com/123456' }),
    false,
  );
  assert.equal(
    isTrackedVideo({ id: 'x1', source: 'EXTERNAL_URL', driveFileId: '', embedUrl: 'https://example.invalid/video' }),
    false,
  );
});

test('sanitizeRanges valida, recorta y fusiona', () => {
  assert.deepEqual(sanitizeRanges([[0, 10], [5, 20]], 100), [[0, 20]]);
  assert.deepEqual(sanitizeRanges([[-5, 10], [90, 500]], 100), [[0, 10], [90, 100]]);
  assert.deepEqual(sanitizeRanges([[0, 'x'], [Number.NaN, 4], [3], 'nada', [10, 5]], 100), []);
  assert.deepEqual(sanitizeRanges('no es lista', 100), []);
  assert.deepEqual(sanitizeRanges([[0, 10]], Infinity), []);
  const tooMany = Array.from({ length: MAX_RANGES + 1 }, (_, i) => [i * 3, i * 3 + 1]);
  assert.deepEqual(sanitizeRanges(tooMany, 86400), []);
});

test('applyHeartbeat limita el crecimiento al tiempo real transcurrido', async (t) => {
  const last = new Date('2026-11-12T10:00:00Z');
  const after = (seconds: number) => new Date(last.getTime() + seconds * 1000);

  await t.test('en el límite entra', () => {
    const allowed = 15 * MAX_PLAYBACK_RATE + HEARTBEAT_SLACK_SECONDS;
    const r = applyHeartbeat({ stored: [[0, 100]], incoming: [[100, 100 + allowed]], lastHeartbeatAt: last, now: after(15) });
    assert.equal(r.accepted, true);
    assert.deepEqual(r.ranges, [[0, 100 + allowed]]);
  });

  await t.test('por encima se rechaza entero', () => {
    const allowed = 15 * MAX_PLAYBACK_RATE + HEARTBEAT_SLACK_SECONDS;
    const r = applyHeartbeat({ stored: [[0, 100]], incoming: [[100, 100 + allowed + 1]], lastHeartbeatAt: last, now: after(15) });
    assert.equal(r.accepted, false);
    assert.deepEqual(r.ranges, [[0, 100]]);
    assert.equal(r.watchedSeconds, 100);
  });

  await t.test('un primer envío grande se rechaza', () => {
    const r = applyHeartbeat({ stored: [], incoming: [[0, 500]], lastHeartbeatAt: null, now: last });
    assert.equal(r.accepted, false);
    const small = applyHeartbeat({ stored: [], incoming: [[0, HEARTBEAT_SLACK_SECONDS]], lastHeartbeatAt: null, now: last });
    assert.equal(small.accepted, true);
  });

  await t.test('repetir lo ya guardado no crece y entra', () => {
    const r = applyHeartbeat({ stored: [[0, 300]], incoming: [[0, 300]], lastHeartbeatAt: last, now: after(1) });
    assert.equal(r.accepted, true);
    assert.equal(r.growth, 0);
  });
});

test('chooseDuration respeta la prioridad de origen', () => {
  // Sin duración guardada se toma la candidata válida.
  assert.deepEqual(chooseDuration(null, { seconds: 600, source: 'PLAYER' }), { seconds: 600, source: 'PLAYER' });
  assert.deepEqual(chooseDuration(null, { seconds: 600.4, source: 'DRIVE_API' }), { seconds: 600, source: 'DRIVE_API' });
  // Inválidas se ignoran.
  assert.equal(chooseDuration(null, { seconds: Infinity, source: 'PLAYER' }), null);
  assert.equal(chooseDuration(null, { seconds: 0, source: 'YOUTUBE' }), null);
  assert.equal(chooseDuration(null, { seconds: 90000, source: 'YOUTUBE' }), null);
  // El alumno nunca reemplaza una duración guardada.
  assert.deepEqual(
    chooseDuration({ seconds: 600, source: 'PLAYER' }, { seconds: 30, source: 'PLAYER' }),
    { seconds: 600, source: 'PLAYER' },
  );
  // Staff corrige al alumno.
  assert.deepEqual(
    chooseDuration({ seconds: 30, source: 'PLAYER' }, { seconds: 600, source: 'PLAYER_STAFF' }),
    { seconds: 600, source: 'PLAYER_STAFF' },
  );
  // Staff no pisa al origen.
  assert.deepEqual(
    chooseDuration({ seconds: 600, source: 'DRIVE_API' }, { seconds: 400, source: 'PLAYER_STAFF' }),
    { seconds: 600, source: 'DRIVE_API' },
  );
  // Igual prioridad con diferencia > 2 s reemplaza; <= 2 s se queda.
  assert.deepEqual(
    chooseDuration({ seconds: 600, source: 'DRIVE_API' }, { seconds: 610, source: 'YOUTUBE' }),
    { seconds: 610, source: 'YOUTUBE' },
  );
  assert.deepEqual(
    chooseDuration({ seconds: 600, source: 'PLAYER_STAFF' }, { seconds: 602, source: 'PLAYER_STAFF' }),
    { seconds: 600, source: 'PLAYER_STAFF' },
  );
  // El origen reemplaza a lo reportado por el reproductor.
  assert.deepEqual(
    chooseDuration({ seconds: 30, source: 'PLAYER' }, { seconds: 600, source: 'DRIVE_API' }),
    { seconds: 600, source: 'DRIVE_API' },
  );
});

test('serverWatchedFraction', () => {
  assert.equal(serverWatchedFraction([[0, 90]], 100), 0.9);
  assert.equal(serverWatchedFraction([[0, 90]], null), 0);
  assert.equal(serverWatchedFraction([[0, 90]], 0), 0);
  assert.equal(serverWatchedFraction([[0, 500]], 100), 1);
});
