import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Volume2,
  Volume1,
  VolumeX,
  Maximize,
  Minimize,
  Tv,
  PictureInPicture,
  RefreshCw,
  AlertCircle,
  Check,
  ExternalLink,
  Video,
} from 'lucide-react';
import type { VideoDriveLink } from '../../types';
import { isDriveVideo, parseVideoSource } from '../../lib/videoParser';

declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}


// El reproductor de YouTube solo responde a los mensajes que llevan `id` y
// `channel: 'widget'`, igual que los que envía su IFrame API oficial. Sin ellos
// ignora el saludo y los comandos: el video no arranca y el tiempo queda en 00:00.
const YT_CHANNEL = { id: 1, channel: 'widget' } as const;
const YT_LISTENING_MESSAGE = JSON.stringify({ event: 'listening', ...YT_CHANNEL });

export interface DocentOSPlayerProps {
  video: VideoDriveLink | null;
  resolvedUrl?: string;
  title?: string;
  initialTime?: number;
  theaterMode?: boolean;
  onToggleTheater?: () => void;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onEnded?: () => void;
  onNextLesson?: () => void;
  hasNextLesson?: boolean;
  /** Por defecto false: espera interacción del usuario */
  autoPlay?: boolean;
}

const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;

  if (hrs > 0) {
    return `${hrs}:${remMins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export const DocentOSPlayer: React.FC<DocentOSPlayerProps> = ({
  video,
  resolvedUrl,
  title,
  initialTime = 0,
  theaterMode = false,
  onToggleTheater,
  onTimeUpdate,
  onEnded,
  onNextLesson,
  hasNextLesson = false,
  autoPlay = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const ytIframeRef = useRef<HTMLIFrameElement>(null);
  const ytPlayerRef = useRef<any>(null);
  const hideControlsTimeout = useRef<NodeJS.Timeout | null>(null);
  const initialPlayHoldUntilRef = useRef<number>(0);
  const lastTapRef = useRef<{ time: number; x: number }>({ time: 0, x: 0 });
  const isSeekingRef = useRef(false);
  const onEndedRef = useRef(onEnded);
  const onTimeUpdateRef = useRef(onTimeUpdate);
  const bufferingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    onEndedRef.current = onEnded;
  }, [onEnded]);

  useEffect(() => {
    onTimeUpdateRef.current = onTimeUpdate;
  }, [onTimeUpdate]);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [bufferedPercent, setBufferedPercent] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState<string | null>(null);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverPosition, setHoverPosition] = useState<number | null>(null);
  const [rippleAction, setRippleAction] = useState<'play' | 'pause' | null>(null);
  const [doubleTapFeedback, setDoubleTapFeedback] = useState<'forward' | 'backward' | null>(null);

  // Determinar el proveedor y la URL de reproducción
  const videoDetails = useMemo(() => {
    if (!video) return { mode: 'none' as const };

    const isDrive = isDriveVideo(video);
    if (isDrive) {
      const streamSrc = video.streamUrl || `${video.playbackUrl || `/api/content/videos/${video.id}`}/stream`;
      return {
        mode: 'native' as const,
        src: streamSrc,
        provider: 'drive',
      };
    }

    const preferred = (video.provider || (video.source === 'YOUTUBE' ? 'youtube' : undefined)) as any;
    const directUrl = resolvedUrl || video.embedUrl || video.playbackUrl || '';
    const parsed = parseVideoSource(directUrl, preferred);

    // Identificar el ID de YouTube con prioridad
    const ytVideoId =
      parsed.videoId && !parsed.videoId.startsWith('/')
        ? parsed.videoId
        : (video as any).youtubeVideoId ||
          (video.source === 'YOUTUBE' && video.driveFileId && !video.driveFileId.startsWith('/') ? video.driveFileId : undefined);

    if (parsed.provider === 'youtube' && ytVideoId) {
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const originParam = origin ? `&origin=${encodeURIComponent(origin)}` : '';
      const startParam = initialTime > 3 ? `&start=${Math.floor(initialTime)}` : '';
      return {
        mode: 'youtube' as const,
        videoId: ytVideoId,
        embedUrl: `https://www.youtube-nocookie.com/embed/${ytVideoId}?enablejsapi=1&controls=0&modestbranding=1&rel=0&playsinline=1&iv_load_policy=3&disablekb=1&fs=0${startParam}${originParam}`,
        provider: 'youtube',
      };
    }

    if (parsed.embedUrl && !parsed.embedUrl.startsWith('/api/')) {
      return {
        mode: 'embed' as const,
        embedUrl: parsed.embedUrl,
        provider: parsed.provider,
      };
    }

    // Fallback nativo
    return {
      mode: 'native' as const,
      src: video.streamUrl || `${video.playbackUrl || `/api/content/videos/${video.id}`}/stream`,
      provider: 'generic',
    };
  }, [video, resolvedUrl]);

  const posterUrl = useMemo(() => {
    if (videoDetails.mode === 'youtube' && videoDetails.videoId) {
      return `https://i.ytimg.com/vi/${videoDetails.videoId}/hqdefault.jpg`;
    }
    return video?.previewUrl || undefined;
  }, [videoDetails, video]);

  // Temporizador de seguridad: si tras 3.5s no se ha recibido evento de carga,
  // retirar el spinner para que el usuario pueda ver el reproductor e interactuar.
  useEffect(() => {
    setIsLoading(true);
    setHasError(null);
    const safetyTimer = setTimeout(() => {
      setIsLoading(false);
    }, 3500);

    return () => clearTimeout(safetyTimer);
  }, [videoDetails.mode, (videoDetails as any).src, (videoDetails as any).videoId]);

  // Manejo de visibilidad de controles con temporizador de inactividad
  const resetHideTimer = useCallback(() => {
    setShowControls(true);
    if (hideControlsTimeout.current) clearTimeout(hideControlsTimeout.current);
    if (isPlaying) {
      const remainingHold = Math.max(0, initialPlayHoldUntilRef.current - Date.now());
      const delay = Math.max(3200, remainingHold);
      hideControlsTimeout.current = setTimeout(() => {
        setShowControls(false);
        setShowSpeedMenu(false);
      }, delay);
    }
  }, [isPlaying]);

  useEffect(() => {
    if (!isPlaying) {
      setShowControls(true);
      if (hideControlsTimeout.current) clearTimeout(hideControlsTimeout.current);
    } else {
      initialPlayHoldUntilRef.current = Date.now() + 3500;
      resetHideTimer();
    }
    return () => {
      if (hideControlsTimeout.current) clearTimeout(hideControlsTimeout.current);
    };
  }, [isPlaying, resetHideTimer]);

  // Actualizar el estado de pantalla completa nativo
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // --- MODO YOUTUBE (IFrame API + postMessage) ---
  const sendYtCommand = useCallback((func: string, args: any[] = []) => {
    const win = ytIframeRef.current?.contentWindow;
    if (win) {
      try {
        win.postMessage(JSON.stringify({ event: 'command', func, args, ...YT_CHANNEL }), '*');
      } catch {}
    }
  }, []);

  useEffect(() => {
    if (videoDetails.mode !== 'youtube' || !videoDetails.videoId) return;

    let destroyed = false;
    let pingTimer: NodeJS.Timeout | null = null;

    const sendListening = () => {
      if (destroyed) return;
      const win = ytIframeRef.current?.contentWindow;
      if (win) {
        try {
          win.postMessage(YT_LISTENING_MESSAGE, '*');
        } catch {}
      }
    };

    // Escuchar mensajes postMessage directos de YouTube
    const handleMessage = (e: MessageEvent) => {
      if (destroyed) return;
      let data: any = null;
      if (typeof e.data === 'string') {
        try {
          data = JSON.parse(e.data);
        } catch {
          return;
        }
      } else if (typeof e.data === 'object' && e.data !== null) {
        data = e.data;
      } else {
        return;
      }

      if (data.event === 'initialDelivery') {
        setIsLoading(false);
        if (pingTimer) {
          clearInterval(pingTimer);
          pingTimer = null;
        }
        if (data.info?.duration) setDuration(data.info.duration);
        if (data.info?.currentTime !== undefined) setCurrentTime(data.info.currentTime);
        if (initialTime > 3) {
          sendYtCommand('seekTo', [initialTime, true]);
        }
        if (autoPlay) {
          sendYtCommand('playVideo');
        }
      } else if (data.event === 'onReady') {
        setIsLoading(false);
        if (pingTimer) {
          clearInterval(pingTimer);
          pingTimer = null;
        }
        if (initialTime > 3) {
          sendYtCommand('seekTo', [initialTime, true]);
        }
        if (autoPlay) {
          sendYtCommand('playVideo');
        }
      } else if (data.event === 'infoDelivery') {
        setIsLoading(false);
        if (data.info?.duration) setDuration(data.info.duration);
        if (data.info?.currentTime !== undefined) {
          setCurrentTime(data.info.currentTime);
          onTimeUpdateRef.current?.(data.info.currentTime, data.info.duration || 0);
        }
        if (data.info?.playerState !== undefined) {
          if (data.info.playerState === 1) {
            if (bufferingTimeoutRef.current) {
              clearTimeout(bufferingTimeoutRef.current);
              bufferingTimeoutRef.current = null;
            }
            setIsPlaying(true);
            setIsLoading(false);
          } else if (data.info.playerState === 2) {
            if (bufferingTimeoutRef.current) {
              clearTimeout(bufferingTimeoutRef.current);
              bufferingTimeoutRef.current = null;
            }
            setIsPlaying(false);
          } else if (data.info.playerState === 0) {
            if (bufferingTimeoutRef.current) {
              clearTimeout(bufferingTimeoutRef.current);
              bufferingTimeoutRef.current = null;
            }
            setIsPlaying(false);
            onEndedRef.current?.();
          } else if (data.info.playerState === 3) {
            if (!bufferingTimeoutRef.current) {
              bufferingTimeoutRef.current = setTimeout(() => {
                setIsLoading(true);
              }, 1200);
            }
          }
        }
        if (data.info?.videoLoadedFraction !== undefined) {
          setBufferedPercent(data.info.videoLoadedFraction * 100);
        }
      } else if (data.event === 'onStateChange') {
        if (bufferingTimeoutRef.current) {
          clearTimeout(bufferingTimeoutRef.current);
          bufferingTimeoutRef.current = null;
        }
        if (data.info === 1) {
          setIsPlaying(true);
          setIsLoading(false);
        } else if (data.info === 2) {
          setIsPlaying(false);
        } else if (data.info === 0) {
          setIsPlaying(false);
          onEndedRef.current?.();
        }
      }
    };

    window.addEventListener('message', handleMessage);

    // Handshake inmediato con el iframe de YouTube
    sendListening();
    let pings = 0;
    pingTimer = setInterval(() => {
      pings++;
      if (pings > 15) {
        if (pingTimer) {
          clearInterval(pingTimer);
          pingTimer = null;
        }
        return;
      }
      sendListening();
    }, 350);

    return () => {
      destroyed = true;
      if (bufferingTimeoutRef.current) {
        clearTimeout(bufferingTimeoutRef.current);
        bufferingTimeoutRef.current = null;
      }
      if (pingTimer) {
        clearInterval(pingTimer);
        pingTimer = null;
      }
      window.removeEventListener('message', handleMessage);
    };
  }, [videoDetails.mode, videoDetails.videoId, videoDetails.embedUrl, autoPlay, initialTime, sendYtCommand]);

  // --- MODO NATIVO (<video>) ---
  const handleNativeLoadedMetadata = () => {
    if (!videoRef.current) return;
    setIsLoading(false);
    const dur = videoRef.current.duration;
    if (dur && !isNaN(dur)) setDuration(dur);
    if (initialTime > 3 && videoRef.current.currentTime === 0) {
      videoRef.current.currentTime = initialTime;
    }
  };

  const handleNativeTimeUpdate = () => {
    if (!videoRef.current || isSeekingRef.current) return;
    const time = videoRef.current.currentTime;
    const dur = videoRef.current.duration || duration;
    setCurrentTime(time);
    onTimeUpdate?.(time, dur);

    // Buffer visual
    if (videoRef.current.buffered.length > 0 && dur > 0) {
      try {
        const end = videoRef.current.buffered.end(videoRef.current.buffered.length - 1);
        setBufferedPercent(Math.min(100, (end / dur) * 100));
      } catch {}
    }
  };

  const handleNativeEnded = () => {
    setIsPlaying(false);
    onEnded?.();
  };

  const handleNativeWaiting = () => setIsLoading(true);
  const handleNativePlaying = () => {
    setIsLoading(false);
    setIsPlaying(true);
  };
  const handleNativePause = () => setIsPlaying(false);

  const handleNativeError = () => {
    setIsLoading(false);
    setHasError('No se pudo reproducir este video directamente.');
  };

  // --- CONTROLES DE REPRODUCCIÓN ---
  const togglePlay = useCallback(() => {
    resetHideTimer();
    if (bufferingTimeoutRef.current) {
      clearTimeout(bufferingTimeoutRef.current);
      bufferingTimeoutRef.current = null;
    }

    if (videoDetails.mode === 'native' && videoRef.current) {
      if (videoRef.current.paused) {
        setIsLoading(false);
        videoRef.current
          .play()
          .then(() => {
            setIsPlaying(true);
            setRippleAction(null);
          })
          .catch(() => {});
      } else {
        videoRef.current.pause();
        setIsPlaying(false);
        setRippleAction(null);
      }
    } else if (videoDetails.mode === 'youtube') {
      if (isPlaying) {
        sendYtCommand('pauseVideo');
        setIsPlaying(false);
        setRippleAction(null);
      } else {
        const win = ytIframeRef.current?.contentWindow;
        if (win) {
          try {
            win.postMessage(YT_LISTENING_MESSAGE, '*');
          } catch {}
        }
        setIsLoading(false);
        sendYtCommand('playVideo');
        setIsPlaying(true);
        setRippleAction(null);
      }
    }
  }, [videoDetails.mode, isPlaying, sendYtCommand, resetHideTimer]);

  const seekRelative = useCallback(
    (seconds: number) => {
      resetHideTimer();
      const newTime = Math.max(0, Math.min(duration, currentTime + seconds));
      setCurrentTime(newTime);

      if (seconds > 0) {
        setDoubleTapFeedback('forward');
        setTimeout(() => setDoubleTapFeedback(null), 600);
      } else {
        setDoubleTapFeedback('backward');
        setTimeout(() => setDoubleTapFeedback(null), 600);
      }

      if (videoDetails.mode === 'native' && videoRef.current) {
        videoRef.current.currentTime = newTime;
      } else if (videoDetails.mode === 'youtube') {
        sendYtCommand('seekTo', [newTime, true]);
      }
    },
    [currentTime, duration, videoDetails.mode, sendYtCommand, resetHideTimer],
  );

  const seekAbsolute = useCallback(
    (seconds: number) => {
      resetHideTimer();
      const clamped = Math.max(0, Math.min(duration, seconds));
      setCurrentTime(clamped);

      if (videoDetails.mode === 'native' && videoRef.current) {
        videoRef.current.currentTime = clamped;
      } else if (videoDetails.mode === 'youtube') {
        sendYtCommand('seekTo', [clamped, true]);
      }
    },
    [duration, videoDetails.mode, sendYtCommand, resetHideTimer],
  );

  const handleVolumeChange = useCallback(
    (newVol: number) => {
      resetHideTimer();
      const clamped = Math.max(0, Math.min(1, newVol));
      setVolume(clamped);
      setIsMuted(clamped === 0);

      if (videoDetails.mode === 'native' && videoRef.current) {
        videoRef.current.volume = clamped;
        videoRef.current.muted = clamped === 0;
      } else if (videoDetails.mode === 'youtube') {
        sendYtCommand('setVolume', [clamped * 100]);
        if (clamped === 0) sendYtCommand('mute');
        else sendYtCommand('unMute');
      }
    },
    [videoDetails.mode, sendYtCommand, resetHideTimer],
  );

  const toggleMute = useCallback(() => {
    resetHideTimer();
    if (isMuted) {
      const restoreVol = volume === 0 ? 0.8 : volume;
      setVolume(restoreVol);
      setIsMuted(false);
      if (videoDetails.mode === 'native' && videoRef.current) {
        videoRef.current.muted = false;
        videoRef.current.volume = restoreVol;
      } else if (videoDetails.mode === 'youtube') {
        sendYtCommand('unMute');
        sendYtCommand('setVolume', [restoreVol * 100]);
      }
    } else {
      setIsMuted(true);
      if (videoDetails.mode === 'native' && videoRef.current) {
        videoRef.current.muted = true;
      } else if (videoDetails.mode === 'youtube') {
        sendYtCommand('mute');
      }
    }
  }, [isMuted, volume, videoDetails.mode, sendYtCommand, resetHideTimer]);

  const handleSpeedChange = useCallback(
    (rate: number) => {
      setPlaybackRate(rate);
      setShowSpeedMenu(false);
      resetHideTimer();

      if (videoDetails.mode === 'native' && videoRef.current) {
        videoRef.current.playbackRate = rate;
      } else if (videoDetails.mode === 'youtube') {
        sendYtCommand('setPlaybackRate', [rate]);
      }
    },
    [videoDetails.mode, sendYtCommand, resetHideTimer],
  );

  const toggleFullscreen = useCallback(() => {
    resetHideTimer();
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  }, [resetHideTimer]);

  const togglePiP = useCallback(async () => {
    resetHideTimer();
    if (videoDetails.mode === 'native' && videoRef.current) {
      try {
        if (document.pictureInPictureElement) {
          await document.exitPictureInPicture();
        } else if (document.pictureInPictureEnabled && videoRef.current.readyState >= 2) {
          await videoRef.current.requestPictureInPicture();
        }
      } catch {}
    }
  }, [videoDetails.mode, resetHideTimer]);

  // Atajos de teclado
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable) {
        return;
      }

      if (e.key === ' ' || e.key === 'k' || e.key === 'K') {
        e.preventDefault();
        togglePlay();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        seekRelative(-5);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        seekRelative(5);
      } else if (e.key === 'j' || e.key === 'J') {
        e.preventDefault();
        seekRelative(-10);
      } else if (e.key === 'l' || e.key === 'L') {
        e.preventDefault();
        seekRelative(10);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        handleVolumeChange(volume + 0.1);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        handleVolumeChange(volume - 0.1);
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        toggleMute();
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.key === 't' || e.key === 'T') {
        e.preventDefault();
        onToggleTheater?.();
      } else if (e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        togglePiP();
      } else if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        const percent = parseInt(e.key, 10) / 10;
        seekAbsolute(duration * percent);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlay, seekRelative, seekAbsolute, handleVolumeChange, volume, toggleMute, toggleFullscreen, onToggleTheater, togglePiP, duration]);

  // Toques en pantalla táctil (Doble toque para saltar ±10s)
  const handleTouch = (e: React.TouchEvent<HTMLDivElement>) => {
    resetHideTimer();
    const touch = e.changedTouches[0];
    const now = Date.now();
    const delta = now - lastTapRef.current.time;
    const rect = containerRef.current?.getBoundingClientRect();

    if (delta < 300 && rect) {
      const touchX = touch.clientX - rect.left;
      const isRightSide = touchX > rect.width / 2;
      if (isRightSide) {
        seekRelative(10);
      } else {
        seekRelative(-10);
      }
      lastTapRef.current = { time: 0, x: 0 };
    } else {
      lastTapRef.current = { time: now, x: touch.clientX };
    }
  };

  // Línea de tiempo (Scrubbing / Drag)
  const handleTimelineScrub = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    seekAbsolute(duration * ratio);
  };

  const handleTimelineMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const hoverX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, hoverX / rect.width));
    setHoverTime(duration * ratio);
    setHoverPosition(hoverX);
  };

  const handleTimelineMouseLeave = () => {
    setHoverTime(null);
    setHoverPosition(null);
  };

  const currentPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      onMouseMove={resetHideTimer}
      onMouseLeave={() => {
        if (isPlaying) {
          if (Date.now() < initialPlayHoldUntilRef.current) {
            return;
          }
          setShowControls(false);
        }
      }}
      onTouchStart={handleTouch}
      className={`group relative mx-auto aspect-video w-full select-none overflow-hidden bg-black shadow-2xl transition-all duration-300 ${
        isFullscreen ? 'h-screen w-screen rounded-none' : 'lg:w-[min(100%,calc((100dvh-9.5rem)*16/9))] lg:rounded-2xl border border-line'
      }`}
    >
      {/* 1. Capa de Video (Nativa o YouTube) */}
      {videoDetails.mode === 'native' && (
        <video
          ref={videoRef}
          src={videoDetails.src}
          preload="metadata"
          playsInline
          onClick={togglePlay}
          onLoadedMetadata={handleNativeLoadedMetadata}
          onLoadedData={() => setIsLoading(false)}
          onCanPlay={() => setIsLoading(false)}
          onTimeUpdate={handleNativeTimeUpdate}
          onEnded={handleNativeEnded}
          onWaiting={handleNativeWaiting}
          onPlaying={handleNativePlaying}
          onPause={handleNativePause}
          onError={handleNativeError}
          className="h-full w-full object-contain cursor-pointer"
        />
      )}

      {videoDetails.mode === 'youtube' && (
        <div className="absolute inset-0 flex items-center justify-center overflow-hidden pointer-events-none">
          <div className="relative aspect-video w-full max-h-full max-w-full overflow-hidden pointer-events-none">
            <iframe
              ref={ytIframeRef}
              id="docentos-yt-iframe"
              key={`yt-${videoDetails.videoId}`}
              src={videoDetails.embedUrl}
              title={title || 'YouTube Video'}
              onLoad={() => {
                setIsLoading(false);
                if (ytIframeRef.current?.contentWindow) {
                  ytIframeRef.current.contentWindow.postMessage(YT_LISTENING_MESSAGE, '*');
                }
              }}
              className="absolute left-0 top-[-30%] h-[160%] w-full border-0 pointer-events-none"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            />
          </div>
        </div>
      )}

      {videoDetails.mode === 'embed' && (
        <iframe
          src={videoDetails.embedUrl}
          title={title || 'DocentOS Video'}
          onLoad={() => setIsLoading(false)}
          className="h-full w-full border-0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
        />
      )}

      {/* Capa de clic transparente para pausar/reanudar en YouTube */}
      {videoDetails.mode === 'youtube' && (
        <div
          onClick={togglePlay}
          className="absolute inset-0 z-10 cursor-pointer"
          aria-label="Alternar reproducción"
        />
      )}

      {/* Portada / Poster de inicio para que nunca se quede en negro antes de reproducir */}
      {posterUrl && !isPlaying && currentTime === 0 && (
        <div className="absolute inset-0 z-12 overflow-hidden pointer-events-none">
          <img
            src={posterUrl}
            alt={title || 'Portada de lección'}
            className="h-full w-full object-cover"
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
          <div className="absolute inset-0 bg-black/35" />
        </div>
      )}

      {/* 2. Barra Superior DocentOS (Cubre el título nativo de YouTube con la marca limpia del curso) */}
      <div
        className={`absolute inset-x-0 top-0 z-25 flex items-center justify-between h-18 bg-gradient-to-b from-black from-70% via-black/95 to-transparent px-4 sm:px-5 pt-3 pb-6 transition-opacity duration-300 ${
          showControls ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0 pr-4">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-surface/90 border border-line text-brand-cyan shadow-sm">
            <Video className="h-4 w-4 text-brand-cyan" />
          </div>
          <span className="text-xs sm:text-sm font-semibold text-white truncate drop-shadow-sm">
            {title || 'Clase en reproducción'}
          </span>
        </div>
      </div>

      {/* 2. Botón Play central y velo de pausa con estética Bezel YouTube */}
      {!hasError && (
        <div
          onClick={togglePlay}
          className={`absolute inset-0 z-15 cursor-pointer bg-black/45 backdrop-blur-[2px] ${
            !isPlaying ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none transition-opacity duration-100'
          }`}
        >
          {/* Escudo opaco en la esquina inferior derecha para tapar 'More videos' y watermark de YouTube */}
          {videoDetails.mode === 'youtube' && (
            <div className="pointer-events-none absolute bottom-0 right-0 h-28 w-80 bg-gradient-to-tl from-black via-black/95 to-transparent" />
          )}

          {/* Botón Play central estilo Bezel YouTube en (50%, 50%) */}
          <div className="absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2">
            <div className="flex h-18 w-18 sm:h-20 sm:w-20 items-center justify-center rounded-full bg-black/65 hover:bg-black/75 border border-white/15 text-white shadow-xl backdrop-blur-sm hover:scale-105 active:scale-95 transition-all duration-200">
              <Play className="h-8 w-8 sm:h-9 sm:w-9 fill-white text-white ml-0.5" />
            </div>
          </div>
        </div>
      )}

      {/* 3. Indicador de doble toque táctil (±10s) */}
      {doubleTapFeedback && (
        <div
          className={`pointer-events-none absolute inset-y-0 z-20 flex items-center justify-center px-12 animate-fade-out ${
            doubleTapFeedback === 'forward' ? 'right-0' : 'left-0'
          }`}
        >
          <div className="flex items-center gap-2 rounded-2xl bg-black/70 backdrop-blur-md border border-white/10 px-4 py-2.5 text-xs font-semibold text-brand-cyan shadow-lg">
            {doubleTapFeedback === 'forward' ? (
              <>
                <span>+10s</span>
                <RotateCw className="h-4 w-4 animate-spin-once" />
              </>
            ) : (
              <>
                <RotateCcw className="h-4 w-4 animate-spin-once" />
                <span>-10s</span>
              </>
            )}
          </div>
        </div>
      )}

      {/* 5. Spinner de Carga y Buffering */}
      {isLoading && isPlaying && !hasError && (
        <div className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/40 backdrop-blur-xs transition-opacity duration-300">
          <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-surface/80 border border-line shadow-2xl">
            <RefreshCw className="h-7 w-7 text-brand-cyan animate-spin" />
          </div>
          <span className="mt-3 text-micro font-medium text-ink-muted">Cargando flujo de video...</span>
        </div>
      )}

      {/* 6. Estado de Error y Recuperación con Fallback */}
      {hasError && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/90 px-6 text-center backdrop-blur-sm animate-fade-in">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
            <AlertCircle className="h-6 w-6" />
          </div>
          <h3 className="text-section font-semibold text-white">No se pudo reproducir directamente</h3>
          <p className="mt-1 text-meta max-w-sm text-zinc-400">{hasError}</p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5">
            <button
              type="button"
              onClick={() => {
                setHasError(null);
                setIsLoading(true);
                if (videoRef.current) {
                  videoRef.current.load();
                  videoRef.current.play().catch(() => {});
                } else if (videoDetails.mode === 'youtube') {
                  const win = ytIframeRef.current?.contentWindow;
                  if (win) {
                    try {
                      win.postMessage(YT_LISTENING_MESSAGE, '*');
                    } catch {}
                  }
                  sendYtCommand('playVideo');
                }
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-surface border border-line px-3.5 py-2 text-micro font-bold text-ink hover:border-line-strong hover:bg-raised transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5 text-brand-cyan" />
              <span>Reintentar reproducción</span>
            </button>
          </div>
        </div>
      )}

      {/* 7. Barra de Controles Superpuesta (Glassmorphism DocentOS) */}
      <div
        className={`absolute inset-x-0 bottom-0 z-30 flex flex-col justify-end bg-gradient-to-t from-black from-55% via-black/95 to-transparent pt-8 pb-3 px-3 sm:px-4 transition-opacity duration-300 ${
          showControls ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Barra de progreso (Scrubber) */}
        <div
          role="slider"
          aria-label="Línea de tiempo del video"
          aria-valuemin={0}
          aria-valuemax={duration}
          aria-valuenow={currentTime}
          onClick={handleTimelineScrub}
          onMouseMove={handleTimelineMouseMove}
          onMouseLeave={handleTimelineMouseLeave}
          className="group/timeline relative mb-3 h-2 w-full cursor-pointer rounded-full bg-white/15 transition-all hover:h-2.5"
        >
          {/* Buffer precargado */}
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-white/25 transition-all duration-300"
            style={{ width: `${bufferedPercent}%` }}
          />

          {/* Progreso reproducido */}
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-brand-cyan shadow-sm transition-all duration-75"
            style={{ width: `${currentPercent}%` }}
          />

          {/* Cabezal de arrastre (Scrubber handle) */}
          <div
            className="absolute top-1/2 -translate-y-1/2 h-3.5 w-3.5 -ml-1.5 rounded-full bg-white border border-brand-cyan/60 shadow-lg scale-0 group-hover/timeline:scale-100 transition-transform duration-150"
            style={{ left: `${currentPercent}%` }}
          />

          {/* Tooltip de tiempo en hover */}
          {hoverTime !== null && hoverPosition !== null && (
            <div
              className="pointer-events-none absolute -top-8 -translate-x-1/2 rounded-md bg-canvas/90 border border-line px-1.5 py-0.5 text-[10px] font-mono font-medium text-white shadow-xl backdrop-blur-md"
              style={{ left: `${hoverPosition}px` }}
            >
              {formatTime(hoverTime)}
            </div>
          )}
        </div>

        {/* Fila de Botones y Acciones */}
        <div className="flex items-center justify-between gap-2 sm:gap-4 text-white">
          {/* Grupo Izquierdo: Play, -10s, +10s, Volumen, Tiempo */}
          <div className="flex items-center gap-1.5 sm:gap-3">
            <button
              type="button"
              onClick={togglePlay}
              aria-label={isPlaying ? 'Pausar (Espacio)' : 'Reproducir (Espacio)'}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 text-white transition-colors"
            >
              {isPlaying ? (
                <Pause className="h-4 w-4 fill-white" />
              ) : (
                <Play className="h-4 w-4 fill-white ml-0.5" />
              )}
            </button>

            <button
              type="button"
              onClick={() => seekRelative(-10)}
              title="Retroceder 10s (J)"
              aria-label="Retroceder 10 segundos"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-300 hover:text-white hover:bg-white/10 transition-colors"
            >
              <RotateCcw className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={() => seekRelative(10)}
              title="Adelantar 10s (L)"
              aria-label="Adelantar 10 segundos"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-300 hover:text-white hover:bg-white/10 transition-colors"
            >
              <RotateCw className="h-4 w-4" />
            </button>

            {/* Control de Volumen */}
            <div className="group/vol relative flex items-center">
              <button
                type="button"
                onClick={toggleMute}
                aria-label={isMuted ? 'Activar sonido (M)' : 'Silenciar (M)'}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-300 hover:text-white hover:bg-white/10 transition-colors"
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="h-4 w-4 text-zinc-400" />
                ) : volume < 0.5 ? (
                  <Volume1 className="h-4 w-4" />
                ) : (
                  <Volume2 className="h-4 w-4" />
                )}
              </button>

              <div className="hidden sm:flex items-center w-0 overflow-hidden group-hover/vol:w-20 transition-all duration-200">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={isMuted ? 0 : volume}
                  onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                  aria-label="Control deslizante de volumen"
                  className="h-1.5 w-16 cursor-pointer appearance-none rounded-full bg-white/20 accent-brand-cyan"
                />
              </div>
            </div>

            {/* Contador de Tiempo */}
            <div className="ml-1 text-meta font-mono text-zinc-300 tabular-nums">
              <span>{formatTime(currentTime)}</span>
              <span className="mx-1 text-zinc-500">/</span>
              <span className="text-zinc-400">{formatTime(duration)}</span>
            </div>
          </div>

          {/* Grupo Derecho: Velocidad, PiP, Modo Cine, Pantalla Completa */}
          <div className="flex items-center gap-1 sm:gap-2">
            {/* Menú de Velocidad */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                title="Velocidad de reproducción"
                aria-expanded={showSpeedMenu}
                className="flex items-center gap-1 rounded-lg px-2 py-1 text-micro font-mono font-bold text-zinc-300 hover:text-white hover:bg-white/10 transition-colors"
              >
                <span>{playbackRate}x</span>
              </button>

              {showSpeedMenu && (
                <div className="absolute bottom-full right-0 mb-2 w-24 overflow-hidden rounded-xl bg-canvas/95 border border-line p-1 shadow-2xl backdrop-blur-xl animate-scale-up">
                  <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-ink-muted">
                    Velocidad
                  </div>
                  {PLAYBACK_RATES.map((rate) => (
                    <button
                      key={rate}
                      type="button"
                      onClick={() => handleSpeedChange(rate)}
                      className={`flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-micro transition-colors ${
                        playbackRate === rate
                          ? 'bg-brand-cyan/20 text-brand-cyan font-bold'
                          : 'text-zinc-300 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      <span>{rate}x</span>
                      {playbackRate === rate && <Check className="h-3 w-3" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Picture-in-Picture (para modo nativo) */}
            {videoDetails.mode === 'native' && (
              <button
                type="button"
                onClick={togglePiP}
                title="Ventana flotante (P)"
                aria-label="Picture in Picture"
                className="hidden sm:flex h-8 w-8 items-center justify-center rounded-lg text-zinc-300 hover:text-white hover:bg-white/10 transition-colors"
              >
                <PictureInPicture className="h-4 w-4" />
              </button>
            )}

            {/* Modo Cine */}
            {onToggleTheater && (
              <button
                type="button"
                onClick={onToggleTheater}
                title="Modo Teatro (T)"
                aria-label="Modo teatro"
                className="hidden sm:flex h-8 w-8 items-center justify-center rounded-lg text-zinc-300 hover:text-white hover:bg-white/10 transition-colors"
              >
                <Tv className={`h-4 w-4 ${theaterMode ? 'text-brand-cyan' : ''}`} />
              </button>
            )}

            {/* Pantalla Completa */}
            <button
              type="button"
              onClick={toggleFullscreen}
              title="Pantalla Completa (F)"
              aria-label="Alternar pantalla completa"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-300 hover:text-white hover:bg-white/10 transition-colors"
            >
              {isFullscreen ? (
                <Minimize className="h-4 w-4" />
              ) : (
                <Maximize className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
