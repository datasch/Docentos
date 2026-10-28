import test from 'node:test';
import assert from 'node:assert/strict';
import { isDriveVideo, supportsPlaybackTracking } from '../src/lib/videoParser.js';
import type { VideoDriveLink } from '../src/types.js';

test('Google Drive Video Engine: Detección y compatibilidad de tracking de reproducción', async (t) => {
  await t.test('1. isDriveVideo identifica videos importados o configurados con Google Drive', () => {
    // Caso importado desde Google Drive (source GOOGLE_DRIVE)
    const importedFromDrive: Partial<VideoDriveLink> = {
      id: 'vid-drive-1',
      source: 'GOOGLE_DRIVE',
      driveFileId: '1abcXYZ_drive_file_id',
      embedUrl: 'https://drive.google.com/file/d/1abcXYZ_drive_file_id/preview',
      provider: 'drive',
    };
    assert.equal(isDriveVideo(importedFromDrive as VideoDriveLink), true);

    // Caso con provider 'drive'
    assert.equal(isDriveVideo({ provider: 'drive' }), true);

    // Caso con driveFileId explícito
    assert.equal(isDriveVideo({ driveFileId: '123456789' }), true);

    // Caso con URL directa de drive.google.com
    assert.equal(isDriveVideo({ embedUrl: 'https://drive.google.com/file/d/ABC/preview' }), true);
    assert.equal(isDriveVideo({ playbackUrl: 'https://drive.google.com/open?id=ABC' }), true);

    // No debe marcar como Drive a videos de YouTube o Vimeo
    assert.equal(
      isDriveVideo({
        source: 'YOUTUBE',
        provider: 'youtube',
        embedUrl: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
      }),
      false,
    );
    assert.equal(
      isDriveVideo({
        provider: 'embed',
        embedUrl: 'https://player.vimeo.com/video/123456',
      }),
      false,
    );
  });

  await t.test('2. supportsPlaybackTracking discrimina entre proveedores con y sin telemetría interactiva', () => {
    // YouTube soporta tracking estricto de eventos por IFrame API
    assert.equal(
      supportsPlaybackTracking({
        source: 'YOUTUBE',
        provider: 'youtube',
        embedUrl: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
      }),
      true,
    );

    // Vimeo soporta tracking interactivo por Vimeo Player postMessage
    assert.equal(
      supportsPlaybackTracking({
        provider: 'embed',
        embedUrl: 'https://player.vimeo.com/video/987654321',
      }),
      true,
    );

    // Google Drive NO soporta tracking interactivo (Cross-Origin Frame sin API pública)
    const driveVideo: Partial<VideoDriveLink> = {
      id: 'drive-vid-01',
      source: 'GOOGLE_DRIVE',
      provider: 'drive',
      driveFileId: 'file-12345',
      embedUrl: 'https://drive.google.com/file/d/file-12345/preview',
    };
    assert.equal(supportsPlaybackTracking(driveVideo as VideoDriveLink), false);

    // Embeds genéricos sin API conocida tampoco bloquean al alumno
    assert.equal(
      supportsPlaybackTracking({
        provider: 'embed',
        embedUrl: 'https://custom-service.internal/embed/vid123',
      }),
      false,
    );
  });

  await t.test('3. Validación de compleción de lecciones: videos de Drive permiten completar inmediatamente', () => {
    const driveLesson: Partial<VideoDriveLink> = {
      id: 'drive-l1',
      source: 'GOOGLE_DRIVE',
      provider: 'drive',
      driveFileId: 'drive-abc',
      embedUrl: 'https://drive.google.com/file/d/drive-abc/preview',
    };

    // Para YouTube sin haberlo visto: isWatched debe ser false
    const youtubeLesson: Partial<VideoDriveLink> = {
      id: 'yt-l1',
      source: 'YOUTUBE',
      provider: 'youtube',
      embedUrl: 'https://www.youtube-nocookie.com/embed/xyz',
    };

    const isTrackingYt = supportsPlaybackTracking(youtubeLesson as VideoDriveLink);
    assert.equal(isTrackingYt, true);

    const watchedVideos: Record<string, boolean> = {};
    const completedVideos: Record<string, boolean> = {};

    // Comprobación para YouTube sin reproducir
    const isYtWatched = !isTrackingYt || Boolean(watchedVideos[youtubeLesson.id!]);
    assert.equal(isYtWatched, false, 'YouTube debe exigir tracking');

    // Comprobación para Drive: no debe exigir telemetría inexistente
    const isTrackingDrive = supportsPlaybackTracking(driveLesson as VideoDriveLink);
    assert.equal(isTrackingDrive, false);

    const isDriveWatched = !isTrackingDrive || Boolean(watchedVideos[driveLesson.id!]);
    assert.equal(isDriveWatched, true, 'Drive debe considerarse visto para no bloquear el botón de completar');
  });
});
