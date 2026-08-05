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
    return {
      provider: 'embed',
      embedUrl: extractedUrl || str,
      originalUrl: str,
    };
  }

  // 2. YouTube Shorts: https://www.youtube.com/shorts/VIDEO_ID or youtube.com/shorts/VIDEO_ID?feature=share
  const shortsMatch = str.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]+)/i);
  if (shortsMatch) {
    const videoId = shortsMatch[1];
    return {
      provider: 'youtube',
      embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=0&rel=0`,
      originalUrl: str,
      videoId,
    };
  }

  // 3. YouTube Standard / Shortened URLs
  // Matches: youtube.com/watch?v=ID, youtu.be/ID, youtube.com/v/ID, youtube.com/embed/ID
  const ytMatch = str.match(/(?:youtube\.com\/(?:watch\?.*v=|v\/|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]+)/i);
  if (ytMatch) {
    const videoId = ytMatch[1];
    return {
      provider: 'youtube',
      embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=0&rel=0`,
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
      embedUrl: str.startsWith('http') ? str : `https://www.youtube-nocookie.com/embed/${str}`,
      originalUrl: str,
      videoId: str,
    };
  }

  if (preferredProvider === 'drive') {
    return {
      provider: 'drive',
      embedUrl: str.startsWith('http') ? str : `https://drive.google.com/file/d/${str}/preview`,
      originalUrl: str,
      videoId: str,
    };
  }

  return {
    provider: preferredProvider || 'embed',
    embedUrl: str,
    originalUrl: str,
  };
}
