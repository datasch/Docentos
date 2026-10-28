/**
 * Utilidad de Parseo y Formateo de Fuentes de Video
 * Academia Giantucchi
 *
 * Soporta 3 proveedores principales:
 * 1. YouTube (URLs estándar, de compartición y YouTube Shorts) -> Convertidos a youtube-nocookie.com/embed/ID
 * 2. iFrame Embebido / Personalizado (Vimeo, Loom, código HTML <iframe ...>)
 * 3. Google Drive Video (URLs de archivo o IDs) -> Convertidos a drive.google.com/file/d/ID/preview
 */

export type VideoProvider = 'youtube' | 'drive' | 'embed';
import { safeExternalUrl } from './safeUrl';

export interface VideoLike {
  source?: string | null;
  provider?: string | null;
  driveFileId?: string | null;
  embedUrl?: string | null;
  playbackUrl?: string | null;
}

/**
 * Determina si un video proviene o se almacena en Google Drive.
 */
export function isDriveVideo(video?: VideoLike | null): boolean {
  if (!video) return false;
  if (video.source === 'GOOGLE_DRIVE') return true;
  if (video.provider === 'drive') return true;
  if (Boolean(video.driveFileId && video.driveFileId.trim())) return true;
  const url = `${video.embedUrl || ''} ${video.playbackUrl || ''}`;
  if (url.includes('drive.google.com') || url.includes('/file/d/')) return true;
  return false;
}

/**
 * Determina si el reproductor de video admite telemetría interactiva de reproducción
 * (como los eventos postMessage de fin de video en YouTube y Vimeo, o un elemento <video> nativo).
 * Los videos reproducidos mediante iframe de Google Drive u otros embeds de terceros
 * están protegidos por Same-Origin Policy y no ofrecen API de eventos al sitio padre,
 * por lo que no es posible ni debe exigirse detección automática de visualización completa.
 */
export function supportsPlaybackTracking(video?: VideoLike | null): boolean {
  if (!video) return false;
  if (isDriveVideo(video)) return false;
  const provider = video.provider;
  const url = `${video.embedUrl || ''} ${video.playbackUrl || ''}`.toLowerCase();
  if (provider === 'youtube' || url.includes('youtube.com') || url.includes('youtu.be') || url.includes('youtube-nocookie.com')) {
    return true;
  }
  if (url.includes('vimeo.com')) {
    return true;
  }
  return false;
}

// Las clases llegan como `/api/content/videos/<id>`: una ruta de nuestro propio
// origen. Se acepta tal cual; «//host» y la contrabarra quedan fuera porque el
// navegador los convierte en una URL de otro dominio.
const safeVideoUrl = (value: string) =>
  /^\/(?!\/)[^\s\\]*$/.test(value) ? value : safeExternalUrl(value, import.meta.env?.DEV);

export interface ParsedVideoSource {
  provider: VideoProvider;
  embedUrl: string;
  originalUrl: string;
  videoId?: string;
}

export function parseVideoSource(input: string, preferredProvider?: VideoProvider): ParsedVideoSource {
  if (!input) {
    return { provider: 'youtube', embedUrl: '', originalUrl: '' };
  }

  const str = input.trim();

  // 1. Check if raw HTML <iframe> code was pasted
  if (str.toLowerCase().includes('<iframe') && str.toLowerCase().includes('src=')) {
    const match = str.match(/src=["']([^"']+)["']/i);
    const extractedUrl = match ? match[1] : '';
    if (extractedUrl.includes('youtube.com') || extractedUrl.includes('youtube-nocookie.com') || extractedUrl.includes('youtu.be')) {
      return parseVideoSource(extractedUrl, preferredProvider);
    }
    return {
      provider: 'embed',
      embedUrl: safeVideoUrl(extractedUrl),
      originalUrl: str,
    };
  }

  // 2. YouTube Shorts: https://www.youtube.com/shorts/VIDEO_ID or youtube.com/shorts/VIDEO_ID?feature=share
  const shortsMatch = str.match(/(?:(?:www\.)?youtube(?:-nocookie)?\.com\/shorts\/)([a-zA-Z0-9_-]+)/i);
  if (shortsMatch) {
    const videoId = shortsMatch[1];
    const originParam = typeof window !== 'undefined' && window.location.origin ? `&origin=${encodeURIComponent(window.location.origin)}` : '';
    return {
      provider: 'youtube',
      embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=0&rel=0&enablejsapi=1&widgetid=1${originParam}`,
      originalUrl: str,
      videoId,
    };
  }

  // 3. YouTube Standard / Shortened / Embed / NoCookie URLs
  // Matches: youtube.com/watch?v=ID, youtu.be/ID, youtube.com/v/ID, youtube.com/embed/ID, youtube-nocookie.com/embed/ID
  const ytMatch = str.match(/(?:(?:www\.)?youtube(?:-nocookie)?\.com\/(?:watch\?.*v=|v\/|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]+)/i);
  if (ytMatch) {
    const videoId = ytMatch[1];
    const originParam = typeof window !== 'undefined' && window.location.origin ? `&origin=${encodeURIComponent(window.location.origin)}` : '';
    return {
      provider: 'youtube',
      embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=0&rel=0&enablejsapi=1&widgetid=1${originParam}`,
      originalUrl: str,
      videoId,
    };
  }

  // 4. Google Drive URLs
  // Matches: drive.google.com/file/d/FILE_ID/view, drive.google.com/open?id=FILE_ID, drive.google.com/file/d/FILE_ID/preview
  const driveMatch = str.match(/drive\.google\.com\/(?:file\/d\/|open\?id=)([a-zA-Z0-9_-]+)/i);
  if (driveMatch) {
    const fileId = driveMatch[1];
    return {
      provider: 'drive',
      embedUrl: `https://drive.google.com/file/d/${fileId}/preview`,
      originalUrl: str,
      videoId: fileId,
    };
  }

  // 5. Vimeo
  if (str.includes('vimeo.com/')) {
    const vimeoId = str.split('vimeo.com/')[1]?.split('?')[0]?.split('#')[0];
    if (vimeoId && !str.includes('player.vimeo.com')) {
      return {
        provider: 'embed',
        embedUrl: `https://player.vimeo.com/video/${vimeoId}`,
        originalUrl: str,
        videoId: vimeoId,
      };
    }
  }

  // 6. Loom
  if (str.includes('loom.com/share/')) {
    const loomId = str.split('loom.com/share/')[1]?.split('?')[0];
    if (loomId) {
      return {
        provider: 'embed',
        embedUrl: `https://www.loom.com/embed/${loomId}`,
        originalUrl: str,
        videoId: loomId,
      };
    }
  }

  // 7. Fallback based on preferredProvider or plain string
  if (preferredProvider === 'youtube') {
    return {
      provider: 'youtube',
      embedUrl: safeVideoUrl(str) || (/^[\w-]+$/.test(str) ? `https://www.youtube-nocookie.com/embed/${str}` : ''),
      originalUrl: str,
      videoId: str,
    };
  }

  if (preferredProvider === 'drive') {
    return {
      provider: 'drive',
      embedUrl: safeVideoUrl(str) || (/^[\w-]+$/.test(str) ? `https://drive.google.com/file/d/${str}/preview` : ''),
      originalUrl: str,
      videoId: str,
    };
  }

  return {
    provider: preferredProvider || 'embed',
    embedUrl: safeVideoUrl(str),
    originalUrl: str,
  };
}
