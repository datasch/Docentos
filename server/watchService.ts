/**
 * Seguimiento de "visto de forma limpia" en el servidor.
 *
 * El navegador va enviando los tramos que el alumno reprodujo de verdad; aquí
 * se validan, se acotan por el tiempo real transcurrido y se guardan. Completar
 * una lección medida exige que el servidor vea al menos el 90% del video.
 */
import { parseVideoSource, supportsPlaybackTracking } from '../src/lib/videoParser.js';
import {
  WATCH_THRESHOLD,
  addWatchedSegment,
  parseWatchRanges,
  watchedFraction,
  watchedSeconds,
  type WatchRanges,
} from '../src/lib/watchProgress.js';
import { getDriveClient } from './driveService.js';
import { logger } from './logger.js';
import { prisma } from './prisma.js';

export const MAX_PLAYBACK_RATE = 2;
export const HEARTBEAT_SLACK_SECONDS = 30;
export const MAX_MEDIA_DURATION_SECONDS = 86400;
export const MAX_RANGES = 2000;

export type DurationSource = 'DRIVE_API' | 'YOUTUBE' | 'PLAYER_STAFF' | 'PLAYER';

export interface DurationDecision {
  seconds: number;
  source: DurationSource;
}

const DURATION_PRIORITY: Record<DurationSource, number> = {
  DRIVE_API: 3,
  YOUTUBE: 3,
  PLAYER_STAFF: 2,
  PLAYER: 1,
};

export interface TrackableVideo {
  id: string;
  source?: string | null;
  embedUrl?: string | null;
  previewUrl?: string | null;
  driveFileId?: string | null;
  mimeType?: string | null;
  mediaDurationSeconds?: number | null;
  mediaDurationSource?: string | null;
}

export interface WatchStatus {
  tracked: boolean;
  ranges: WatchRanges;
  watchedSeconds: number;
  durationSeconds: number | null;
  fraction: number;
  unlocked: boolean;
}

interface WatchUser {
  id: string;
  role?: string | null;
}

/**
 * Decide si la lección se mide, con los mismos datos que recibe el navegador
 * (ver `serializeVideo` en `courseAccess.ts`): sin `embedUrl` ni `driveFileId`.
 * Así servidor y cliente deciden lo mismo.
 */
export function isTrackedVideo(video: TrackableVideo): boolean {
  const provider = parseVideoSource(video.embedUrl || video.previewUrl || video.driveFileId || '').provider;
  return supportsPlaybackTracking({
    source: video.source,
    provider,
    mimeType: video.mimeType,
    playbackUrl: `/api/content/videos/${encodeURIComponent(video.id)}`,
  });
}

function isValidDuration(seconds: unknown): seconds is number {
  return typeof seconds === 'number' && Number.isFinite(seconds) && seconds > 0 && seconds <= MAX_MEDIA_DURATION_SECONDS;
}

/** Valida los tramos que manda el navegador y los recorta a `[0, ceil(duration)]`. */
export function sanitizeRanges(input: unknown, duration: number): WatchRanges {
  if (!Array.isArray(input) || !isValidDuration(duration)) return [];
  if (input.length > MAX_RANGES) return [];
  const limit = Math.ceil(duration);
  let ranges: WatchRanges = [];
  for (const item of input) {
    if (!Array.isArray(item) || item.length !== 2) continue;
    const [start, end] = item;
    if (typeof start !== 'number' || typeof end !== 'number') continue;
    if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
    const from = Math.min(Math.max(start, 0), limit);
    const to = Math.min(Math.max(end, 0), limit);
    if (to <= from) continue;
    ranges = addWatchedSegment(ranges, from, to);
  }
  return ranges.length > MAX_RANGES ? [] : ranges;
}

export function mergeRanges(a: WatchRanges, b: WatchRanges): WatchRanges {
  return b.reduce((acc, [start, end]) => addWatchedSegment(acc, start, end), parseWatchRanges(a));
}

export interface HeartbeatResult {
  accepted: boolean;
  ranges: WatchRanges;
  watchedSeconds: number;
  growth: number;
  allowed: number;
}

/**
 * Fusiona lo nuevo con lo guardado y comprueba que no crezca más de lo que
 * permite el tiempo real transcurrido a la velocidad máxima (más un margen).
 * Si crece de más, se rechaza el envío entero y se conservan los tramos
 * guardados; el siguiente envío trae lo mismo con más margen y entra.
 */
export function applyHeartbeat({
  stored,
  incoming,
  lastHeartbeatAt,
  now,
}: {
  stored: WatchRanges;
  incoming: WatchRanges;
  lastHeartbeatAt: Date | null;
  now: Date;
}): HeartbeatResult {
  const merged = mergeRanges(stored, incoming);
  const before = watchedSeconds(stored);
  const after = watchedSeconds(merged);
  const growth = after - before;
  const elapsed = lastHeartbeatAt ? Math.max(0, (now.getTime() - lastHeartbeatAt.getTime()) / 1000) : 0;
  const allowed = elapsed * MAX_PLAYBACK_RATE + HEARTBEAT_SLACK_SECONDS;
  if (growth > allowed) {
    return { accepted: false, ranges: parseWatchRanges(stored), watchedSeconds: before, growth, allowed };
  }
  return { accepted: true, ranges: merged, watchedSeconds: after, growth, allowed };
}

/**
 * Elige la duración que se guarda. Prioridad: DRIVE_API = YOUTUBE > PLAYER_STAFF > PLAYER.
 * Un candidato PLAYER (alumno) nunca reemplaza una duración guardada.
 */
export function chooseDuration(
  current: DurationDecision | null,
  candidate: DurationDecision | null,
): DurationDecision | null {
  const validCurrent = current && isValidDuration(current.seconds) && current.source in DURATION_PRIORITY ? current : null;
  if (!candidate || !isValidDuration(candidate.seconds) || !(candidate.source in DURATION_PRIORITY)) return validCurrent;
  const next = { seconds: Math.round(candidate.seconds), source: candidate.source };
  if (!validCurrent) return next;
  if (candidate.source === 'PLAYER') return validCurrent;
  if (DURATION_PRIORITY[candidate.source] < DURATION_PRIORITY[validCurrent.source]) return validCurrent;
  if (Math.abs(next.seconds - validCurrent.seconds) <= 2) return validCurrent;
  return next;
}

export function serverWatchedFraction(ranges: WatchRanges, durationSeconds: number | null | undefined): number {
  if (!isValidDuration(durationSeconds)) return 0;
  return watchedFraction(ranges, durationSeconds);
}

function storedDuration(video: TrackableVideo): DurationDecision | null {
  const source = video.mediaDurationSource as DurationSource | null | undefined;
  if (!isValidDuration(video.mediaDurationSeconds) || !source || !(source in DURATION_PRIORITY)) return null;
  return { seconds: video.mediaDurationSeconds, source };
}

/** Pregunta la duración al origen (YouTube importado o metadatos de Drive). */
export async function fetchAuthoritativeDuration(video: TrackableVideo): Promise<DurationDecision | null> {
  const parsed = parseVideoSource(video.embedUrl || video.previewUrl || video.driveFileId || '');
  if (parsed.provider === 'youtube' || video.source === 'YOUTUBE') {
    const youtubeId = parsed.videoId || video.driveFileId;
    if (!youtubeId) return null;
    try {
      const yt = await prisma.youTubeVideo.findFirst({
        where: { youtubeId, durationSeconds: { gt: 0 } },
        select: { durationSeconds: true },
      });
      return yt ? { seconds: yt.durationSeconds, source: 'YOUTUBE' } : null;
    } catch (error: any) {
      logger.error('watch.duration.youtube_lookup_failed', { videoId: video.id, error: error?.message });
      return null;
    }
  }

  const fileId = video.driveFileId || parsed.videoId;
  if (!fileId) return null;
  try {
    const drive = getDriveClient();
    if (!drive) return null;
    const { data } = await drive.files.get({
      fileId,
      fields: 'videoMediaMetadata(durationMillis)',
      supportsAllDrives: true,
    });
    const millis = Number(data.videoMediaMetadata?.durationMillis);
    return Number.isFinite(millis) && millis > 0 ? { seconds: Math.round(millis / 1000), source: 'DRIVE_API' } : null;
  } catch (error: any) {
    logger.error('watch.duration.drive_lookup_failed', { videoId: video.id, error: error?.message });
    return null;
  }
}

/** Resuelve (y guarda si cambia) la duración del video. Devuelve los segundos o null. */
export async function resolveDuration(
  video: TrackableVideo,
  reported: number | null | undefined,
  user: WatchUser | null,
): Promise<number | null> {
  const current = storedDuration(video);
  let decision = current;
  if (!decision) {
    decision = chooseDuration(null, await fetchAuthoritativeDuration(video));
  }
  if (typeof reported === 'number' && isValidDuration(reported)) {
    const staff = user?.role === 'ADMIN' || user?.role === 'MENTOR';
    decision = chooseDuration(decision, { seconds: reported, source: staff ? 'PLAYER_STAFF' : 'PLAYER' });
  }
  if (decision && (decision.seconds !== current?.seconds || decision.source !== current?.source)) {
    await prisma.videoDriveLink.update({
      where: { id: video.id },
      data: { mediaDurationSeconds: decision.seconds, mediaDurationSource: decision.source },
    });
    video.mediaDurationSeconds = decision.seconds;
    video.mediaDurationSource = decision.source;
  }
  return decision?.seconds ?? null;
}

const videoSelect = {
  id: true,
  source: true,
  embedUrl: true,
  previewUrl: true,
  driveFileId: true,
  mimeType: true,
  mediaDurationSeconds: true,
  mediaDurationSource: true,
} as const;

function untrackedStatus(): WatchStatus {
  return { tracked: false, ranges: [], watchedSeconds: 0, durationSeconds: null, fraction: 1, unlocked: true };
}

function buildStatus(ranges: WatchRanges, durationSeconds: number | null): WatchStatus {
  const fraction = serverWatchedFraction(ranges, durationSeconds);
  return {
    tracked: true,
    ranges,
    watchedSeconds: watchedSeconds(ranges),
    durationSeconds,
    fraction,
    unlocked: fraction >= WATCH_THRESHOLD,
  };
}

export async function getWatchStatus(userId: string, videoId: string): Promise<WatchStatus> {
  const video = await prisma.videoDriveLink.findUnique({ where: { id: videoId }, select: videoSelect });
  if (!video || !isTrackedVideo(video)) return untrackedStatus();
  const durationSeconds = storedDuration(video)?.seconds ?? (await resolveDuration(video, null, null));
  const watch = await prisma.videoWatch.findUnique({ where: { userId_videoId: { userId, videoId } } });
  return buildStatus(parseWatchRanges(watch?.rangesJson), durationSeconds);
}

export async function recordWatchHeartbeat(
  user: WatchUser,
  videoId: string,
  { ranges, duration }: { ranges: unknown; duration: unknown },
): Promise<WatchStatus & { accepted: boolean }> {
  const video = await prisma.videoDriveLink.findUnique({ where: { id: videoId }, select: videoSelect });
  if (!video || !isTrackedVideo(video)) return { ...untrackedStatus(), accepted: false };

  const reported = typeof duration === 'number' ? duration : null;
  const durationSeconds = await resolveDuration(video, reported, user);
  const existing = await prisma.videoWatch.findUnique({ where: { userId_videoId: { userId: user.id, videoId } } });
  const stored = parseWatchRanges(existing?.rangesJson);
  if (!durationSeconds) {
    return { ...buildStatus(stored, null), accepted: false };
  }

  const now = new Date();
  const result = applyHeartbeat({
    stored,
    incoming: sanitizeRanges(ranges, durationSeconds),
    lastHeartbeatAt: existing?.lastHeartbeatAt ?? null,
    now,
  });

  if (result.accepted) {
    await prisma.videoWatch.upsert({
      where: { userId_videoId: { userId: user.id, videoId } },
      update: { rangesJson: JSON.stringify(result.ranges), watchedSeconds: result.watchedSeconds, lastHeartbeatAt: now },
      create: {
        userId: user.id,
        videoId,
        rangesJson: JSON.stringify(result.ranges),
        watchedSeconds: result.watchedSeconds,
        lastHeartbeatAt: now,
      },
    });
  } else {
    logger.warn('watch.heartbeat_rejected', {
      userId: user.id,
      videoId,
      growth: result.growth,
      allowed: result.allowed,
    });
    // Sin envío previo no hay referencia de tiempo y el margen sería siempre el
    // mínimo: se arranca el reloj (sin guardar tramos) para que el siguiente entre.
    if (!existing?.lastHeartbeatAt) {
      await prisma.videoWatch.upsert({
        where: { userId_videoId: { userId: user.id, videoId } },
        update: { lastHeartbeatAt: now },
        create: { userId: user.id, videoId, rangesJson: '[]', watchedSeconds: 0, lastHeartbeatAt: now },
      });
    }
  }

  return { ...buildStatus(result.ranges, durationSeconds), accepted: result.accepted };
}
