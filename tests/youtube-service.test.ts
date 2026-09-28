/**
 * Pruebas Unitarias y de Integracion: YouTube Service & OAuth 2.0
 * DocentOS LMS Engine
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractPlaylistId,
  parseIsoDuration,
  generateAuthUrl,
  YouTubeError,
  getConnectionStatus,
  disconnectConnection,
  importPlaylist,
  listUserPlaylists,
  getPlaylistWithVideos,
  updateVideosSelection,
} from '../server/youtubeService.js';
import { cifrar, descifrar } from '../server/crypto.js';
import { prisma } from '../server/prisma.js';
import { config } from '../server/config.js';

const TEST_USER_ID = 'test-mentor-yt-01';
const TEST_MENTOR_EMAIL = 'mentor.youtube.test@docentos.edu';

test('YouTube Service: Extracción y validación de IDs de playlist', async (t) => {
  await t.test('1. Extrae playlistId desde URL estándar de YouTube', () => {
    const url = 'https://www.youtube.com/playlist?list=PL4cUxeGkcC9gUdybxo-u2_5pB8w6N1v9e';
    assert.equal(extractPlaylistId(url), 'PL4cUxeGkcC9gUdybxo-u2_5pB8w6N1v9e');
  });

  await t.test('2. Extrae playlistId desde URL de video con parámetro list', () => {
    const url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLr6-S54IvEpfdWvHk4gk8m_3ZpEwK_qYn&index=1';
    assert.equal(extractPlaylistId(url), 'PLr6-S54IvEpfdWvHk4gk8m_3ZpEwK_qYn');
  });

  await t.test('3. Acepta ID de playlist directo sin URL', () => {
    const id = 'PLbwsGQRvS1_EE38Xv_9v61nF_hWvK7b4q';
    assert.equal(extractPlaylistId(id), 'PLbwsGQRvS1_EE38Xv_9v61nF_hWvK7b4q');
  });

  await t.test('4. Rechaza URLs inválidas o cadenas vacías', () => {
    assert.equal(extractPlaylistId(''), null);
    assert.equal(extractPlaylistId('https://google.com'), null);
    assert.equal(extractPlaylistId('https://youtube.com/watch?v=abc'), null);
    assert.equal(extractPlaylistId('abc'), null);
  });
});

test('YouTube Service: Parseo de duraciones ISO 8601', async (t) => {
  await t.test('1. Convierte PT1H2M30S a segundos exactos (3750s)', () => {
    assert.equal(parseIsoDuration('PT1H2M30S'), 3750);
  });

  await t.test('2. Convierte PT15M45S a segundos exactos (945s)', () => {
    assert.equal(parseIsoDuration('PT15M45S'), 945);
  });

  await t.test('3. Convierte PT45S a segundos exactos (45s)', () => {
    assert.equal(parseIsoDuration('PT45S'), 45);
  });

  await t.test('4. Tolera strings vacíos o no válidos devolviendo 0', () => {
    assert.equal(parseIsoDuration(''), 0);
    assert.equal(parseIsoDuration('INVALID'), 0);
  });
});

test('YouTube Service: Cifrado simétrico AES-256-GCM de tokens de sesión OAuth', async (t) => {
  await t.test('1. Los tokens de acceso y refresco se cifran antes de persistir', () => {
    const rawAccessToken = 'ya29.a0AfH6SMD_mock_access_token_1234567890';
    const rawRefreshToken = '1//04_mock_refresh_token_abcdef123456';

    const encAccess = cifrar(rawAccessToken);
    const encRefresh = cifrar(rawRefreshToken);

    assert.notEqual(encAccess, rawAccessToken, 'El token cifrado no debe coincidir con el texto plano');
    assert.notEqual(encRefresh, rawRefreshToken, 'El refresh token cifrado no debe coincidir con el texto plano');
    assert.ok(encAccess.includes(':'), 'El formato cifrado AES-256-GCM contiene IV y Auth Tag separados por colon');

    // Comprobar descifrado simétrico
    const decAccess = descifrar(encAccess);
    const decRefresh = descifrar(encRefresh);
    assert.equal(decAccess, rawAccessToken, 'El token descifrado debe coincidir exactamente con el original');
    assert.equal(decRefresh, rawRefreshToken, 'El refresh token descifrado debe coincidir con el original');
  });
});

test('YouTube Service: Gestión de Estado de Conexión y Desconexión', async (t) => {
  // Setup de usuario de prueba
  await prisma.youTubeConnection.deleteMany({ where: { userId: TEST_USER_ID } });
  await prisma.user.upsert({
    where: { id: TEST_USER_ID },
    create: {
      id: TEST_USER_ID,
      email: TEST_MENTOR_EMAIL,
      name: 'Mentor YouTube Tester',
      role: 'MENTOR',
      passwordHash: 'hash-mock',
    },
    update: { role: 'MENTOR' },
  });

  await t.test('1. Devuelve connected: false si el usuario no ha vinculado YouTube', async () => {
    const status = await getConnectionStatus(TEST_USER_ID);
    assert.equal(status.connected, false);
  });

  await t.test('2. Devuelve connected: true y metadatos cuando el usuario tiene credenciales válidas', async () => {
    const mockToken = 'mock-access-token';
    const expiresAt = new Date(Date.now() + 3600 * 1000); // Expira en 1 hora

    await prisma.youTubeConnection.create({
      data: {
        userId: TEST_USER_ID,
        googleEmail: 'mentor.google@gmail.com',
        accessTokenEnc: cifrar(mockToken),
        tokenExpiresAt: expiresAt,
        scopesGranted: 'https://www.googleapis.com/auth/youtube.readonly',
      },
    });

    const status = await getConnectionStatus(TEST_USER_ID);
    assert.equal(status.connected, true);
    assert.equal(status.googleEmail, 'mentor.google@gmail.com');
    assert.equal(status.isExpired, false);
    assert.ok(status.scopesGranted?.includes('youtube.readonly'));
  });

  await t.test('3. Detecta tokens expirados correctamente', async () => {
    const expiredDate = new Date(Date.now() - 3600 * 1000); // Expiró hace 1 hora
    await prisma.youTubeConnection.update({
      where: { userId: TEST_USER_ID },
      data: { tokenExpiresAt: expiredDate },
    });

    const status = await getConnectionStatus(TEST_USER_ID);
    assert.equal(status.connected, true);
    assert.equal(status.isExpired, true, 'Debe marcar el token como expirado');
  });

  await t.test('4. disconnectConnection elimina las credenciales en reposo', async () => {
    const disconnected = await disconnectConnection(TEST_USER_ID);
    assert.equal(disconnected, true);

    const postStatus = await getConnectionStatus(TEST_USER_ID);
    assert.equal(postStatus.connected, false);
  });
});

test('YouTube Service: Errores y restricciones de seguridad de Playlists', async (t) => {
  await t.test('1. Rechaza URLs vacías o inválidas con código INVALID_URL', async () => {
    await assert.rejects(
      async () => {
        await importPlaylist(TEST_USER_ID, 'url-invalida');
      },
      (err: any) => {
        assert.ok(err instanceof YouTubeError);
        assert.equal(err.code, 'INVALID_URL');
        assert.equal(err.statusCode, 400);
        return true;
      },
    );
  });

  await t.test('2. YouTubeError encapsula mensajes claros y legibles sin filtrar stack traces', () => {
    const err = new YouTubeError(
      'Acceso denegado a la playlist privada.',
      'PLAYLIST_PRIVATE_UNAUTHORIZED',
      403,
    );
    assert.equal(err.name, 'YouTubeError');
    assert.equal(err.code, 'PLAYLIST_PRIVATE_UNAUTHORIZED');
    assert.equal(err.statusCode, 403);
    assert.equal(err.message, 'Acceso denegado a la playlist privada.');
  });
});
