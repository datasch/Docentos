/**
 * Servicio de integracion con YouTube Data API v3 y OAuth 2.0
 * DocentOS LMS Engine
 *
 * Cumple con los requerimientos:
 * 1. OAuth 2.0 con tokens cifrados simetricamente (AES-256-GCM via server/crypto.ts).
 * 2. Soporta playlists publicas, no listadas y privadas autorizadas por el usuario.
 * 3. Rechaza el acceso a playlists privadas sin autorizacion oficial.
 * 4. Extraccion y validacion robusta de IDs de playlist desde URL o ID directo.
 * 5. Paginacion y extraccion de metadata completa de videos (duracion ISO 8601, thumbnails, privacidad).
 * 6. Sincronizacion de playlists y gestion de videos eliminados o inaccesibles.
 */

import { google } from 'googleapis';
import { prisma } from './prisma.js';
import { config } from './config.js';
import { cifrar, descifrar } from './crypto.js';
import { logger } from './logger.js';
import { formatDuration } from './courseImportPlan.js';

export type YouTubePrivacy = 'PUBLIC' | 'UNLISTED' | 'PRIVATE' | 'UNKNOWN';

export interface YouTubeVideoItem {
  id: string;
  youtubeId: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  channelTitle: string;
  durationSeconds: number;
  durationFormatted: string;
  privacyStatus: YouTubePrivacy;
  position: number;
  customOrder: number;
  excluded: boolean;
  publishedAt?: string | null;
}

export interface YouTubePlaylistData {
  id: string;
  youtubeId: string;
  title: string;
  description: string;
  channelTitle: string;
  thumbnailUrl: string;
  privacyStatus: YouTubePrivacy;
  itemCount: number;
  publishedAt?: string | null;
  lastSyncedAt?: string | null;
  videos: YouTubeVideoItem[];
}

export class YouTubeError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'NOT_CONNECTED'
      | 'INVALID_URL'
      | 'INVALID_REDIRECT_URI'
      | 'VIDEO_NOT_IN_PLAYLIST'
      | 'PLAYLIST_NOT_FOUND'
      | 'PLAYLIST_PRIVATE_UNAUTHORIZED'
      | 'TOKEN_EXPIRED'
      | 'INSUFFICIENT_PERMISSIONS'
      | 'API_QUOTA_EXCEEDED'
      | 'CONFIG_MISSING'
      | 'UNKNOWN' = 'UNKNOWN',
    public readonly statusCode: number = 400,
  ) {
    super(message);
    this.name = 'YouTubeError';
  }
}

/** Extrae el ID de playlist de una URL o devuelve el ID si ya es directo. */
export function extractPlaylistId(input: string): string | null {
  if (!input || typeof input !== 'string') return null;
  const clean = input.trim();

  // Caso 1: Parametro `list=...` en URL
  const listMatch = clean.match(/[?&]list=([a-zA-Z0-9_-]+)/i);
  if (listMatch && listMatch[1]) {
    return listMatch[1];
  }

  // Caso 2: ID directo de playlist (suele empezar con PL, UU, FL, RD o tener entre 10 y 64 chars)
  if (/^[a-zA-Z0-9_-]{10,64}$/.test(clean)) {
    return clean;
  }

  return null;
}

/** Convierte duracion ISO 8601 (PT1H2M30S) a segundos totales. */
export function parseIsoDuration(durationStr: string): number {
  if (!durationStr || typeof durationStr !== 'string') return 0;
  const match = durationStr.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const hours = parseInt(match[1] || '0', 10);
  const minutes = parseInt(match[2] || '0', 10);
  const seconds = parseInt(match[3] || '0', 10);
  return hours * 3600 + minutes * 60 + seconds;
}

/** Obtiene la instancia base de OAuth2Client de Google. */
export function getOAuth2Client(customRedirectUri?: string) {
  const clientId = config.YOUTUBE_CLIENT_ID || process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = config.YOUTUBE_CLIENT_SECRET || process.env.YOUTUBE_CLIENT_SECRET;
  const allowedRedirects = [
    `${config.APP_URL.replace(/\/$/, '')}/api/youtube/callback`,
    config.YOUTUBE_REDIRECT_URI,
  ].filter((uri): uri is string => Boolean(uri));
  if (customRedirectUri && !allowedRedirects.includes(customRedirectUri)) {
    throw new YouTubeError('URI de retorno de YouTube no autorizada.', 'INVALID_REDIRECT_URI', 400);
  }
  const redirectUri = customRedirectUri || config.YOUTUBE_REDIRECT_URI || allowedRedirects[0];

  if (!clientId || !clientSecret) {
    throw new YouTubeError(
      'Faltan credenciales de Google OAuth (YOUTUBE_CLIENT_ID / YOUTUBE_CLIENT_SECRET) en la configuración.',
      'CONFIG_MISSING',
      503,
    );
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

/** Genera la URL de consentimiento OAuth 2.0 para el usuario. */
export function generateAuthUrl(state: string, redirectUri?: string): string {
  const oauth2Client = getOAuth2Client(redirectUri);
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/youtube.readonly',
      'https://www.googleapis.com/auth/userinfo.email',
    ],
    prompt: 'consent', // Fuerza a Google a entregar un refresh_token
    state,
  });
}

/** Intercambia el código de autorización por tokens y obtiene el correo de Google. */
export async function handleOAuthCallback(
  code: string,
  userId: string,
  customRedirectUri?: string,
): Promise<{ googleEmail: string }> {
  const oauth2Client = getOAuth2Client(customRedirectUri);
  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);

  if (!tokens.access_token) {
    throw new YouTubeError('Google no devolvió un access_token válido.', 'UNKNOWN', 400);
  }

  // Obtener correo del usuario en Google
  const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
  const userInfo = await oauth2.userinfo.get();
  const googleEmail = userInfo.data.email || 'desconocido@youtube.com';

  const accessTokenEnc = cifrar(tokens.access_token);
  const refreshTokenEnc = tokens.refresh_token ? cifrar(tokens.refresh_token) : null;
  const tokenExpiresAt = tokens.expiry_date ? new Date(tokens.expiry_date) : null;
  const scopesGranted = tokens.scope || 'https://www.googleapis.com/auth/youtube.readonly';

  await prisma.youTubeConnection.upsert({
    where: { userId },
    create: {
      userId,
      googleEmail,
      accessTokenEnc,
      refreshTokenEnc,
      tokenExpiresAt,
      scopesGranted,
    },
    update: {
      googleEmail,
      accessTokenEnc,
      ...(refreshTokenEnc ? { refreshTokenEnc } : {}),
      tokenExpiresAt,
      scopesGranted,
    },
  });

  logger.info('youtube.oauth.connected', { userId, googleEmail });
  return { googleEmail };
}

/** Devuelve el estado de conexión con YouTube para un usuario. */
export async function getConnectionStatus(userId: string): Promise<{
  connected: boolean;
  googleEmail?: string;
  tokenExpiresAt?: string | null;
  isExpired?: boolean;
  scopesGranted?: string;
}> {
  const conn = await prisma.youTubeConnection.findUnique({
    where: { userId },
  });

  if (!conn || conn.scopesGranted === 'public' || conn.googleEmail?.includes('public-access')) {
    return { connected: false };
  }

  const isExpired = conn.tokenExpiresAt ? conn.tokenExpiresAt.getTime() < Date.now() : false;

  return {
    connected: true,
    googleEmail: conn.googleEmail,
    tokenExpiresAt: conn.tokenExpiresAt?.toISOString() || null,
    isExpired,
    scopesGranted: conn.scopesGranted,
  };
}

/** Desconecta la cuenta de YouTube y elimina las credenciales. */
export async function disconnectConnection(userId: string): Promise<boolean> {
  const conn = await prisma.youTubeConnection.findUnique({ where: { userId } });
  if (!conn) return false;

  try {
    const oauth2Client = getOAuth2Client();
    const token = descifrar(conn.accessTokenEnc);
    await oauth2Client.revokeToken(token).catch(() => {});
  } catch (err) {
    logger.warn('youtube.revoke.failed', { userId, reason: String(err) });
  }

  await prisma.youTubeConnection.delete({ where: { userId } });
  logger.info('youtube.connection.deleted', { userId });
  return true;
}

/**
 * Obtiene un cliente autenticado para el usuario, renovando el token si expiró.
 */
export async function getAuthenticatedYouTubeClient(userId: string) {
  const conn = await prisma.youTubeConnection.findUnique({ where: { userId } });
  if (!conn || conn.scopesGranted === 'public' || conn.googleEmail?.includes('public-access')) {
    return null;
  }

  const oauth2Client = getOAuth2Client();
  const accessToken = descifrar(conn.accessTokenEnc);
  const refreshToken = conn.refreshTokenEnc ? descifrar(conn.refreshTokenEnc) : undefined;

  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
    expiry_date: conn.tokenExpiresAt?.getTime(),
  });

  // Guardar token renovado si Google lo refresca
  oauth2Client.on('tokens', async (newTokens) => {
    try {
      const updateData: { accessTokenEnc?: string; tokenExpiresAt?: Date; refreshTokenEnc?: string } = {};
      if (newTokens.access_token) {
        updateData.accessTokenEnc = cifrar(newTokens.access_token);
      }
      if (newTokens.expiry_date) {
        updateData.tokenExpiresAt = new Date(newTokens.expiry_date);
      }
      if (newTokens.refresh_token) {
        updateData.refreshTokenEnc = cifrar(newTokens.refresh_token);
      }
      await prisma.youTubeConnection.update({
        where: { id: conn.id },
        data: updateData,
      });
      logger.info('youtube.token.refreshed', { userId });
    } catch (err) {
      logger.error('youtube.token.refresh_save_failed', { userId, reason: String(err) });
    }
  });

  return google.youtube({ version: 'v3', auth: oauth2Client });
}

/**
 * Normaliza el string de privacidad de YouTube a enum.
 */
function normalizePrivacy(val?: string | null): YouTubePrivacy {
  const lower = String(val || '').toLowerCase();
  if (lower === 'public') return 'PUBLIC';
  if (lower === 'unlisted') return 'UNLISTED';
  if (lower === 'private') return 'PRIVATE';
  return 'UNKNOWN';
}

/**
 * Consulta la API de YouTube para obtener la información de una playlist y todos sus videos.
 * Si el usuario está conectado por OAuth, consulta con sus credenciales autorizadas.
 * Si no está conectado, intenta con la API Key configurada para playlists públicas.
 */
export async function fetchPlaylistFromApi(
  playlistId: string,
  userId?: string,
): Promise<{
  playlist: {
    youtubeId: string;
    title: string;
    description: string;
    channelTitle: string;
    thumbnailUrl: string;
    privacyStatus: YouTubePrivacy;
    itemCount: number;
    publishedAt?: string | null;
  };
  videos: Array<{
    youtubeId: string;
    title: string;
    description: string;
    thumbnailUrl: string;
    channelTitle: string;
    durationSeconds: number;
    privacyStatus: YouTubePrivacy;
    position: number;
    publishedAt?: string | null;
  }>;
  /** false si se cortó en el tope de videos: entonces no se sabe qué falta en la playlist. */
  complete: boolean;
}> {
  let youtube = userId ? await getAuthenticatedYouTubeClient(userId) : null;
  const apiKey = config.YOUTUBE_API_KEY || process.env.YOUTUBE_API_KEY || null;

  if (!youtube && apiKey) {
    youtube = google.youtube({ version: 'v3', auth: apiKey });
  }

  if (!youtube) {
    throw new YouTubeError(
      'Para importar playlists debes conectar tu cuenta de YouTube o configurar YOUTUBE_API_KEY en el servidor.',
      'NOT_CONNECTED',
      401,
    );
  }

  // 1. Obtener datos de la playlist
  let playlistRes;
  try {
    playlistRes = await youtube.playlists.list({
      part: ['snippet', 'status', 'contentDetails'],
      id: [playlistId],
    });
  } catch (err: any) {
    const msg = err.message || '';
    if (err.code === 404 || msg.includes('playlistNotFound')) {
      throw new YouTubeError(`La playlist con ID "${playlistId}" no existe en YouTube.`, 'PLAYLIST_NOT_FOUND', 404);
    }
    if (err.code === 403) {
      if (msg.includes('quota')) {
        throw new YouTubeError('Se ha superado la cuota de la API de YouTube. Intenta más tarde.', 'API_QUOTA_EXCEEDED', 429);
      }
      throw new YouTubeError(
        'Acceso denegado a la playlist. Si es privada o no listada, conecta la cuenta propietaria con OAuth.',
        'PLAYLIST_PRIVATE_UNAUTHORIZED',
        403,
      );
    }
    throw new YouTubeError(`Error al consultar YouTube: ${msg}`, 'UNKNOWN', 500);
  }

  const playlistItem = playlistRes.data.items?.[0];
  if (!playlistItem) {
    throw new YouTubeError(
      `No se encontró la playlist "${playlistId}". Puede que sea privada y tu cuenta de YouTube no tenga acceso a ella.`,
      'PLAYLIST_PRIVATE_UNAUTHORIZED',
      404,
    );
  }

  const pSnippet = playlistItem.snippet;
  const pStatus = playlistItem.status;
  const pPrivacy = normalizePrivacy(pStatus?.privacyStatus);

  // 2. Obtener videos de la playlist (paginados hasta 200)
  const rawVideos: any[] = [];
  let nextPageToken: string | undefined = undefined;
  const maxVideos = 200;

  do {
    try {
      const itemsRes = await youtube.playlistItems.list({
        part: ['snippet', 'status', 'contentDetails'],
        playlistId,
        maxResults: 50,
        pageToken: nextPageToken,
      });

      const items = itemsRes.data.items || [];
      rawVideos.push(...items);
      nextPageToken = itemsRes.data.nextPageToken || undefined;
    } catch (err: any) {
      // Antes: break, y la importación se guardaba como completa con las páginas
      // leídas hasta el fallo. Mejor fallar y que el mentor reintente.
      logger.warn('youtube.playlistItems.page_error', { playlistId, error: err.message });
      throw new YouTubeError(
        'YouTube falló a mitad de la lista (cuota o error temporal). No se guardó nada: vuelve a intentarlo.',
        'UNKNOWN',
        502,
      );
    }
  } while (nextPageToken && rawVideos.length < maxVideos);
  const complete = !nextPageToken;

  // 3. Extraer IDs de video para consultar duraciones en bloques de 50
  const videoIds = rawVideos
    .map((item) => item.contentDetails?.videoId || item.snippet?.resourceId?.videoId)
    .filter(Boolean) as string[];

  const durationMap = new Map<string, { durationSeconds: number; privacy: YouTubePrivacy }>();

  for (let i = 0; i < videoIds.length; i += 50) {
    const chunk = videoIds.slice(i, i + 50);
    try {
      const vDetailsRes = await youtube.videos.list({
        part: ['contentDetails', 'status'],
        id: chunk,
      });
      for (const vItem of vDetailsRes.data.items || []) {
        if (!vItem.id) continue;
        const durSec = parseIsoDuration(vItem.contentDetails?.duration || '');
        const priv = normalizePrivacy(vItem.status?.privacyStatus);
        durationMap.set(vItem.id, { durationSeconds: durSec, privacy: priv });
      }
    } catch (err) {
      logger.warn('youtube.videos.details_error', { chunk, error: String(err) });
    }
  }

  // 4. Mapear videos procesados
  const videos = rawVideos.map((item, index) => {
    const vidId = item.contentDetails?.videoId || item.snippet?.resourceId?.videoId || `unknown-${index}`;
    const title = item.snippet?.title || '';
    const details = durationMap.get(vidId);
    // Un video privado que la cuenta conectada sí puede ver trae sus metadatos:
    // solo se oculta el que YouTube devuelve sin datos.
    const isDeletedOrPrivate =
      title === 'Private video' ||
      title === 'Deleted video' ||
      !item.snippet ||
      (item.status?.privacyStatus === 'private' && !details);

    const durationSeconds = details?.durationSeconds || 0;
    const privacyStatus = isDeletedOrPrivate
      ? 'PRIVATE'
      : details?.privacy || normalizePrivacy(item.status?.privacyStatus);

    return {
      youtubeId: vidId,
      title: isDeletedOrPrivate ? '[Video privado o no accesible]' : title,
      description: isDeletedOrPrivate ? '' : item.snippet?.description || '',
      thumbnailUrl:
        item.snippet?.thumbnails?.medium?.url ||
        item.snippet?.thumbnails?.high?.url ||
        item.snippet?.thumbnails?.default?.url ||
        '',
      channelTitle: item.snippet?.videoOwnerChannelTitle || item.snippet?.channelTitle || '',
      durationSeconds,
      privacyStatus,
      position: index,
      publishedAt: item.contentDetails?.videoPublishedAt || item.snippet?.publishedAt || null,
    };
  });

  return {
    playlist: {
      youtubeId: playlistId,
      title: pSnippet?.title || 'Playlist sin título',
      description: pSnippet?.description || '',
      channelTitle: pSnippet?.channelTitle || '',
      thumbnailUrl:
        pSnippet?.thumbnails?.high?.url ||
        pSnippet?.thumbnails?.medium?.url ||
        pSnippet?.thumbnails?.default?.url ||
        '',
      privacyStatus: pPrivacy,
      itemCount: playlistItem.contentDetails?.itemCount ?? videos.length,
      publishedAt: pSnippet?.publishedAt || null,
    },
    videos,
    complete,
  };
}

/**
 * Importa una playlist para un mentor, guardando la metadata y los videos en la base de datos.
 */
export async function importPlaylist(
  userId: string,
  playlistUrlOrId: string,
): Promise<YouTubePlaylistData> {
  const playlistId = extractPlaylistId(playlistUrlOrId);
  if (!playlistId) {
    throw new YouTubeError(
      'URL o ID de playlist inválido. Pega una URL válida de YouTube (ej: https://www.youtube.com/playlist?list=PL...) o un ID de playlist.',
      'INVALID_URL',
      400,
    );
  }

  // Verificar conexión de YouTube
  let conn = await prisma.youTubeConnection.findUnique({ where: { userId } });

  // Consultar API oficial de YouTube PRIMERO
  const { playlist: pData, videos: vData, complete } = await fetchPlaylistFromApi(playlistId, userId);

  // Si no está conectado con OAuth, crear conexión local/asociada para persistir en DB
  if (!conn) {
    conn = await prisma.youTubeConnection.create({
      data: {
        userId,
        googleEmail: 'public-access@docentos.internal',
        accessTokenEnc: cifrar('public-token'),
        scopesGranted: 'public',
      },
    });
  }

  // Persistir en base de datos transaccionalmente
  const savedPlaylist = await prisma.$transaction(async (tx) => {
    const pl = await tx.youTubePlaylist.upsert({
      where: {
        connectionId_youtubeId: {
          connectionId: conn.id,
          youtubeId: playlistId,
        },
      },
      create: {
        connectionId: conn.id,
        youtubeId: playlistId,
        title: pData.title,
        description: pData.description,
        channelTitle: pData.channelTitle,
        thumbnailUrl: pData.thumbnailUrl,
        privacyStatus: pData.privacyStatus,
        itemCount: pData.itemCount,
        publishedAt: pData.publishedAt ? new Date(pData.publishedAt) : null,
        lastSyncedAt: new Date(),
      },
      update: {
        title: pData.title,
        description: pData.description,
        channelTitle: pData.channelTitle,
        thumbnailUrl: pData.thumbnailUrl,
        privacyStatus: pData.privacyStatus,
        itemCount: pData.itemCount,
        publishedAt: pData.publishedAt ? new Date(pData.publishedAt) : null,
        lastSyncedAt: new Date(),
      },
    });

    // Sincronizar videos
    for (const v of vData) {
      const isPrivateOrDeleted = v.privacyStatus === 'PRIVATE' || v.title.startsWith('[Video');
      await tx.youTubeVideo.upsert({
        where: {
          playlistId_youtubeId: {
            playlistId: pl.id,
            youtubeId: v.youtubeId,
          },
        },
        create: {
          playlistId: pl.id,
          youtubeId: v.youtubeId,
          title: v.title,
          description: v.description,
          thumbnailUrl: v.thumbnailUrl,
          channelTitle: v.channelTitle,
          durationSeconds: v.durationSeconds,
          privacyStatus: v.privacyStatus,
          position: v.position,
          customOrder: v.position,
          excluded: isPrivateOrDeleted,
          publishedAt: v.publishedAt ? new Date(v.publishedAt) : null,
        },
        update: {
          title: v.title,
          description: v.description,
          thumbnailUrl: v.thumbnailUrl,
          channelTitle: v.channelTitle,
          durationSeconds: v.durationSeconds,
          privacyStatus: v.privacyStatus,
          position: v.position,
          publishedAt: v.publishedAt ? new Date(v.publishedAt) : null,
        },
      });
    }

    // Lo que ya no está en la playlist deja de ofrecerse para nuevos cursos. Se
    // excluye en vez de borrarlo: puede estar enlazado a lecciones existentes.
    // Solo tras una lectura completa: cortada en el tope, faltan videos que sí están.
    if (complete) {
      await tx.youTubeVideo.updateMany({
        where: { playlistId: pl.id, youtubeId: { notIn: vData.map((v) => v.youtubeId) } },
        data: { excluded: true },
      });
    }

    return pl;
  });

  return getPlaylistWithVideos(savedPlaylist.id, userId);
}

/**
 * Obtiene la playlist y sus videos asociados ordenados por customOrder.
 */
export async function getPlaylistWithVideos(
  playlistId: string,
  userId: string,
): Promise<YouTubePlaylistData> {
  const pl = await prisma.youTubePlaylist.findFirst({
    where: {
      id: playlistId,
      connection: { userId },
    },
    include: {
      videos: {
        orderBy: [{ customOrder: 'asc' }, { position: 'asc' }],
      },
    },
  });

  if (!pl) {
    throw new YouTubeError('Playlist no encontrada o no pertenece a tu cuenta.', 'PLAYLIST_NOT_FOUND', 404);
  }

  return {
    id: pl.id,
    youtubeId: pl.youtubeId,
    title: pl.title,
    description: pl.description,
    channelTitle: pl.channelTitle,
    thumbnailUrl: pl.thumbnailUrl,
    privacyStatus: pl.privacyStatus as YouTubePrivacy,
    itemCount: pl.itemCount,
    publishedAt: pl.publishedAt?.toISOString() || null,
    lastSyncedAt: pl.lastSyncedAt?.toISOString() || null,
    videos: pl.videos.map((v) => ({
      id: v.id,
      youtubeId: v.youtubeId,
      title: v.title,
      description: v.description,
      thumbnailUrl: v.thumbnailUrl,
      channelTitle: v.channelTitle,
      durationSeconds: v.durationSeconds,
      durationFormatted: formatDuration(v.durationSeconds),
      privacyStatus: v.privacyStatus as YouTubePrivacy,
      position: v.position,
      customOrder: v.customOrder,
      excluded: v.excluded,
      publishedAt: v.publishedAt?.toISOString() || null,
    })),
  };
}

/**
 * Lista todas las playlists importadas por un usuario.
 */
export async function listUserPlaylists(userId: string): Promise<
  Array<{
    id: string;
    youtubeId: string;
    title: string;
    description: string;
    channelTitle: string;
    thumbnailUrl: string;
    privacyStatus: YouTubePrivacy;
    itemCount: number;
    lastSyncedAt: string | null;
  }>
> {
  const playlists = await prisma.youTubePlaylist.findMany({
    where: { connection: { userId } },
    orderBy: { updatedAt: 'desc' },
  });

  return playlists.map((p) => ({
    id: p.id,
    youtubeId: p.youtubeId,
    title: p.title,
    description: p.description,
    channelTitle: p.channelTitle,
    thumbnailUrl: p.thumbnailUrl,
    privacyStatus: p.privacyStatus as YouTubePrivacy,
    itemCount: p.itemCount,
    lastSyncedAt: p.lastSyncedAt?.toISOString() || null,
  }));
}

/**
 * Actualiza la selección y el orden de los videos de una playlist.
 */
export async function updateVideosSelection(
  playlistId: string,
  userId: string,
  updates: Array<{ id: string; customOrder?: number; excluded?: boolean }>,
): Promise<YouTubePlaylistData> {
  const pl = await prisma.youTubePlaylist.findFirst({
    where: { id: playlistId, connection: { userId } },
  });

  if (!pl) {
    throw new YouTubeError('Playlist no encontrada.', 'PLAYLIST_NOT_FOUND', 404);
  }

  const ids = [...new Set(updates.map((u) => u.id))];
  if (ids.some((id) => typeof id !== 'string') ||
      await prisma.youTubeVideo.count({ where: { id: { in: ids }, playlistId } }) !== ids.length) {
    throw new YouTubeError('Algún video no pertenece a esta playlist.', 'VIDEO_NOT_IN_PLAYLIST', 400);
  }

  await prisma.$transaction(
    updates.map((u) =>
      prisma.youTubeVideo.update({
        where: { id: u.id, playlistId },
        data: {
          ...(typeof u.customOrder === 'number' ? { customOrder: u.customOrder } : {}),
          ...(typeof u.excluded === 'boolean' ? { excluded: u.excluded } : {}),
        },
      }),
    ),
  );

  return getPlaylistWithVideos(playlistId, userId);
}
