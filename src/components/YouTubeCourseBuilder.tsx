/**
 * AI YouTube Course Builder
 * Componente interactivo para DocentOS LMS
 *
 * Flujo guiado:
 * 1. Mentor introduce requerimiento y URL de playlist de YouTube.
 * 2. Autenticación con OAuth 2.0 (Google/YouTube) si es requerida o para playlists privadas/no listadas.
 * 3. Importación y verificación de metadata oficial desde YouTube.
 * 4. Selección, exclusión y ordenamiento de videos.
 * 5. Generación asíncrona de estructura pedagógica con IA (Gemini / Multi-LLM).
 * 6. Edición granular del curso, módulos y lecciones (objetivos, preguntas de comprensión, etc.).
 * 7. Guardado en la base de datos como Curso BORRADOR (published: false) y opción de publicación directa.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Youtube,
  Sparkles,
  Link,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowLeft,
  Globe,
  Trash2,
  MoveUp,
  MoveDown,
  ExternalLink,
  Save,
  Search,
  Film,
  X,
} from 'lucide-react';
import { api } from '../lib/api';
import { stripEmoji } from '../lib/stripEmoji';
import { ApiRequestError } from '../lib/apiRequest';
import {
  User,
  YouTubeConnectionStatus,
  YouTubePlaylistData,
  YouTubeVideoItem,
  YouTubeSearchPlaylistResult,
  GeneratedCourseDraft,
  GeneratedModuleDraft,
  GeneratedLessonDraft,
  YouTubeAiJob,
} from '../types';

interface YouTubeCourseBuilderProps {
  currentUser?: User;
  onCourseCreated?: (courseId: string) => void;
  onCancel?: () => void;
}

import {
  MENTORSHIP_CATEGORIES,
  TECHNICAL_CATEGORIES,
  STANDARD_COURSE_CATEGORIES,
} from '../lib/courseCategories';

const COURSE_CATEGORIES = STANDARD_COURSE_CATEGORIES;

export const YouTubeCourseBuilder: React.FC<YouTubeCourseBuilderProps> = ({
  currentUser,
  onCourseCreated,
  onCancel,
}) => {
  // Pasos: 1 = Input (Búsqueda o URL), 2 = Seleccionar/Curar videos, 3 = Generando con IA, 4 = Revision y Edicion, 5 = Finalizado
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4 | 5>(1);

  // Modo de Entrada en Paso 1: 'search' (Búsqueda por Título y Keywords) o 'url' (URL de Playlist)
  const [inputMode, setInputMode] = useState<'search' | 'url'>('search');
  const [courseTitle, setCourseTitle] = useState('');
  const [keywords, setKeywords] = useState('');
  const [searchType, setSearchType] = useState<'videos' | 'playlists'>('videos');
  const [isSearching, setIsSearching] = useState(false);
  const [foundPlaylists, setFoundPlaylists] = useState<YouTubeSearchPlaylistResult[]>([]);

  // Estado OAuth YouTube
  const [ytStatus, setYtStatus] = useState<YouTubeConnectionStatus>({ connected: false });
  const [loadingStatus, setLoadingStatus] = useState(true);

  // Formulario Paso 1
  const [coursePrompt, setCoursePrompt] = useState(
    'Quiero crear un curso práctico y estructurado. Organiza el contenido desde fundamentos hasta proyectos aplicados y formula objetivos de aprendizaje claros para cada módulo.',
  );
  const [playlistUrl, setPlaylistUrl] = useState('');
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  // Playlist o Colección importada/buscada
  const [playlist, setPlaylist] = useState<YouTubePlaylistData | null>(null);

  // Videos editables (Paso 2)
  const [videos, setVideos] = useState<YouTubeVideoItem[]>([]);

  // Estado Generación IA (Paso 3)
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [jobProgress, setJobProgress] = useState(0);
  const [jobStatusText, setJobStatusText] = useState('Iniciando análisis pedagógico...');
  const [generationError, setGenerationError] = useState<string | null>(null);

  // Estructura generada para edición (Paso 4)
  const [draftCourse, setDraftCourse] = useState<GeneratedCourseDraft | null>(null);
  const [generatingCover, setGeneratingCover] = useState(false);
  const [savingCourse, setSavingCourse] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<{ courseId: string; courseTitle: string; published?: boolean } | null>(null);
  const [publishImmediately, setPublishImmediately] = useState<boolean>(true);
  const [publishing, setPublishing] = useState(false);

  const handleGenerateCover = async () => {
    if (!draftCourse?.course?.title?.trim()) {
      alert('Escribe primero el título del curso para generar una portada temática con IA.');
      return;
    }
    setGeneratingCover(true);
    try {
      const res = await api.generateCourseCover({
        title: draftCourse.course.title.trim(),
        category: draftCourse.course.category?.trim() || 'Mentoría Especializada',
        description: draftCourse.course.description?.trim() || '',
      });
      if (res.success && res.coverImage) {
        setDraftCourse((prev) =>
          prev
            ? {
                ...prev,
                course: { ...prev.course, coverImage: res.coverImage },
              }
            : null,
        );
      }
    } catch (err: any) {
      alert(err.message || 'No se pudo generar la portada con IA');
    } finally {
      setGeneratingCover(false);
    }
  };

  // Cargar estado de conexión con YouTube al montar
  useEffect(() => {
    checkConnectionStatus();

    // Comprobar parámetros de callback en la URL
    const params = new URLSearchParams(window.location.search);
    if (params.get('youtube') === 'connected') {
      checkConnectionStatus();
    }
    if (params.get('youtube_error')) {
      setImportError(`Error en autenticación de YouTube: ${params.get('youtube_error')}`);
    }
  }, []);

  const checkConnectionStatus = async () => {
    try {
      setLoadingStatus(true);
      const status = await api.youtube.getStatus();
      setYtStatus(status);
    } catch {
      setYtStatus({ connected: false });
    } finally {
      setLoadingStatus(false);
    }
  };

  const handleConnectYouTube = async () => {
    try {
      const authUrl = await api.youtube.getAuthUrl();
      window.location.href = authUrl;
    } catch (err: any) {
      setImportError(err.message || 'No se pudo iniciar la autenticación con YouTube.');
    }
  };

  const handleDisconnectYouTube = async () => {
    if (!window.confirm('¿Desconectar tu cuenta de YouTube de DocentOS?')) return;
    try {
      await api.youtube.disconnect();
      setYtStatus({ connected: false });
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Paso 1: Búsqueda Inteligente por Título y Palabras Clave
  const handleSearchContent = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle = courseTitle.trim();
    const cleanKeywords = keywords.trim();

    if (!cleanTitle && !cleanKeywords) {
      setImportError('Ingresa un título o palabras clave para buscar contenido en YouTube.');
      return;
    }

    try {
      setIsSearching(true);
      setImportError(null);
      const combinedQuery = [cleanTitle, cleanKeywords].filter(Boolean).join(' ');

      if (searchType === 'playlists') {
        const results = await api.youtube.searchPlaylists(combinedQuery, 10);
        if (results.length === 0) {
          setImportError('No se encontraron playlists para esa búsqueda. Intenta con otras palabras clave.');
        } else {
          setFoundPlaylists(results);
        }
      } else {
        // Búsqueda de videos directos
        const foundVideos = await api.youtube.searchVideos({
          title: cleanTitle,
          keywords: cleanKeywords,
          query: combinedQuery,
          maxResults: 15,
        });

        if (foundVideos.length === 0) {
          setImportError('No se encontraron videos para esa búsqueda. Prueba con términos más generales.');
          return;
        }

        // Crear contenedor representativo para la curación
        const displayTitle = cleanTitle || `Curso sobre ${cleanKeywords}`;
        setPlaylist({
          id: `search-${Date.now()}`,
          youtubeId: 'custom-search',
          title: displayTitle,
          description: `Videos encontrados para: "${combinedQuery}"`,
          channelTitle: 'Colección de Videos de YouTube',
          thumbnailUrl: foundVideos[0]?.thumbnailUrl || '',
          privacyStatus: 'PUBLIC',
          itemCount: foundVideos.length,
          videos: foundVideos,
        });
        setVideos(foundVideos);
        setCurrentStep(2);
      }
    } catch (err: any) {
      if (err.code === 'NOT_CONNECTED') {
        setImportError(
          'Debes conectar tu cuenta de YouTube mediante Google OAuth o configurar YOUTUBE_API_KEY en el servidor para realizar búsquedas.',
        );
      } else if (err.code === 'API_QUOTA_EXCEEDED') {
        setImportError('Se ha superado la cuota de la API de YouTube. Conecta tu cuenta o intenta más tarde.');
      } else {
        setImportError(err.message || 'Error al buscar en YouTube. Verifica tu conexión o términos de búsqueda.');
      }
    } finally {
      setIsSearching(false);
    }
  };

  // Seleccionar una playlist encontrada para curar
  const handleSelectFoundPlaylist = async (pl: YouTubeSearchPlaylistResult) => {
    try {
      setImporting(true);
      setImportError(null);
      const plData = await api.youtube.importPlaylist(pl.youtubeId);
      setPlaylist(plData);
      setVideos(plData.videos);
      setCurrentStep(2);
    } catch (err: any) {
      setImportError(err.message || 'Error al importar los videos de la playlist.');
    } finally {
      setImporting(false);
    }
  };

  // Paso 1: Importar Playlist Manual
  const handleImportPlaylist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!playlistUrl.trim()) {
      setImportError('Ingresa una URL o ID de playlist de YouTube.');
      return;
    }

    try {
      setImporting(true);
      setImportError(null);
      const plData = await api.youtube.importPlaylist(playlistUrl.trim());
      setPlaylist(plData);
      setVideos(plData.videos);
      setCurrentStep(2);
    } catch (err: any) {
      if (err.code === 'PLAYLIST_PRIVATE_UNAUTHORIZED') {
        setImportError(
          'Esta playlist es privada o requiere autorización. Conecta tu cuenta de Google/YouTube con OAuth para que el sistema pueda acceder a ella legalmente.',
        );
      } else if (err.code === 'NOT_CONNECTED') {
        setImportError(
          'Debes conectar tu cuenta de YouTube mediante OAuth o configurar YOUTUBE_API_KEY para importar playlists públicas.',
        );
      } else {
        setImportError(err.message || 'Error al importar la playlist. Verifica que el enlace sea correcto.');
      }
    } finally {
      setImporting(false);
    }
  };

  // Manejo de Selección, Orden y Eliminación de Videos (Paso 2)
  const toggleSelectAll = (select: boolean) => {
    setVideos((prev) => prev.map((v) => ({ ...v, excluded: !select })));
  };

  const toggleVideoExcluded = (id: string) => {
    setVideos((prev) =>
      prev.map((v) => (v.id === id ? { ...v, excluded: !v.excluded } : v)),
    );
  };

  // Eliminar video de la lista (descartar definitivamente)
  const handleRemoveVideo = (id: string) => {
    setVideos((prev) => prev.filter((v) => v.id !== id));
  };

  const moveVideo = (index: number, direction: 'up' | 'down') => {
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === videos.length - 1)
    ) {
      return;
    }
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    const newVideos = [...videos];
    const temp = newVideos[index];
    newVideos[index] = newVideos[targetIdx];
    newVideos[targetIdx] = temp;

    // Actualizar customOrder
    const updated = newVideos.map((v, i) => ({ ...v, customOrder: i }));
    setVideos(updated);
  };

  // Paso 3: Lanzar Generación con IA
  const handleStartAiGeneration = async () => {
    const includedVideos = videos.filter((v) => !v.excluded);
    if (includedVideos.length === 0) {
      alert('Debes incluir al menos un video para generar el curso.');
      return;
    }

    try {
      setCurrentStep(3);
      setGenerationError(null);
      setJobProgress(15);
      setJobStatusText('Enviando videos al motor de IA pedagógico...');

      const resolvedTitle = courseTitle.trim() || playlist?.title || '';
      const response = await api.youtube.generateCourse({
        playlistId: playlist?.youtubeId === 'custom-search' ? undefined : playlist?.id,
        courseTitle: resolvedTitle || undefined,
        courseRequest: coursePrompt,
        videos: includedVideos.map((v, idx) => ({
          id: v.id,
          youtubeId: v.youtubeId,
          title: v.title,
          description: v.description,
          durationSeconds: v.durationSeconds,
          position: idx,
        })),
      });

      setActiveJobId(response.jobId);
      pollJobStatus(response.jobId);
    } catch (err: any) {
      setGenerationError(err.message || 'Error al iniciar la generación de IA.');
      setCurrentStep(2);
    }
  };

  // Polling del estado del AIJob. El intervalo vive en una ref para poder
  // pararlo al desmontar (salir o cancelar a mitad de la generación): antes
  // seguía consultando y actualizaba un componente que ya no existía.
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => () => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = null;
  }, []);

  const pollJobStatus = (jobId: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    let consecutiveErrors = 0;
    const MAX_CONSECUTIVE_ERRORS = 4;
    let inFlight = false;
    let nextAttemptAt = 0;

    const interval = setInterval(async () => {
      if (inFlight || Date.now() < nextAttemptAt || document.visibilityState === 'hidden') return;
      inFlight = true;
      try {
        const job = await api.youtube.getJobStatus(jobId);
        if (pollRef.current !== interval) return;
        consecutiveErrors = 0;
        setJobProgress(job.progress || 50);

        if (job.status === 'PROCESSING') {
          setJobStatusText(`Analizando y estructurando módulos... (${job.progress}%)`);
        } else if (job.status === 'COMPLETED') {
          clearInterval(interval);
          setJobProgress(100);
          setJobStatusText('¡Curso generado con éxito!');
          if (job.result) {
            const finalTitle = courseTitle.trim() || playlist?.title || '';
            if (
              finalTitle &&
              (!job.result.course.title ||
                job.result.course.title === coursePrompt ||
                job.result.course.title.startsWith('Quiero crear'))
            ) {
              job.result.course.title = finalTitle;
            }
            setDraftCourse(job.result);
            setTimeout(() => setCurrentStep(4), 600);
          } else {
            setGenerationError('El trabajo concluyó pero no se recibió la estructura esperada.');
          }
        } else if (job.status === 'FAILED') {
          clearInterval(interval);
          setGenerationError(job.errorMessage || 'Falló la generación del curso por IA.');
        }
      } catch (err: any) {
        if (pollRef.current !== interval) return;
        if (err instanceof ApiRequestError && err.retryAfterSeconds) {
          nextAttemptAt = Date.now() + err.retryAfterSeconds * 1000;
          return;
        }
        consecutiveErrors += 1;
        if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
          clearInterval(interval);
          setGenerationError(err.message || 'Error al consultar el progreso del trabajo.');
        }
      } finally { inFlight = false; }
    }, 2000);
    pollRef.current = interval;
  };

  // Paso 4: Guardar y Publicar / Borrador en DocentOS
  const handleSaveDraftCourse = async () => {
    if (!activeJobId || !draftCourse) return;

    try {
      setSavingCourse(true);
      const res = await api.youtube.applyJob(activeJobId, draftCourse, publishImmediately);
      setSaveSuccess({
        courseId: res.courseId,
        courseTitle: res.courseTitle,
        published: Boolean(res.published ?? publishImmediately),
      });
      setCurrentStep(5);
      if (onCourseCreated) {
        onCourseCreated(res.courseId);
      }
    } catch (err: any) {
      alert(`Error al guardar curso: ${err.message}`);
    } finally {
      setSavingCourse(false);
    }
  };

  // Publicar directamente desde el paso final
  const handlePublishNow = async () => {
    if (!saveSuccess?.courseId) return;
    try {
      setPublishing(true);
      await api.youtube.publishCourse(saveSuccess.courseId);
      alert('¡Curso publicado exitosamente en el catálogo de DocentOS!');
      if (onCancel) onCancel();
    } catch (err: any) {
      alert(`Error al publicar curso: ${err.message}`);
    } finally {
      setPublishing(false);
    }
  };

  const privacyLabel = (value?: string) => {
    const v = String(value || '').toUpperCase();
    return v === 'PRIVATE' ? 'Privado' : v === 'UNLISTED' ? 'No listado' : v === 'PUBLIC' ? 'Público' : '';
  };
  const selectedVideos = videos.filter((v) => !v.excluded);
  const totalSeconds = selectedVideos.reduce((sum, v) => sum + (v.durationSeconds || 0), 0);
  const totalLabel = totalSeconds >= 3600
    ? `${Math.floor(totalSeconds / 3600)} h ${Math.round((totalSeconds % 3600) / 60)} min`
    : `${Math.max(1, Math.round(totalSeconds / 60))} min`;
  const steps = ['Buscar o importar', 'Elegir videos', 'Generar con IA', 'Revisar y guardar'];
  const activeStep = Math.min(currentStep, 4);

  const field = (label: string, hint?: string) => (
    <span className="yt-field__label">
      {label}
      {hint && <em> {hint}</em>}
    </span>
  );

  return (
    <section className="mentor-youtube-panel" aria-labelledby="yt-title">
      <div className="mentor-section-heading">
        <div>
          <h2 id="yt-title">Crear curso desde YouTube</h2>
          <p>Importa una playlist o busca videos, ordénalos y la IA arma el temario con módulos y lecciones</p>
        </div>
        <div className="yt-connection">
          {loadingStatus ? (
            <Loader2 aria-hidden="true" className="animate-spin" />
          ) : ytStatus.connected ? (
            <>
              <span className="yt-connection__text">
                <strong>YouTube conectado</strong>
                <small title={ytStatus.googleEmail}>{ytStatus.googleEmail}</small>
              </span>
              <button type="button" className="mentor-course-control" onClick={handleDisconnectYouTube}>
                Desconectar
              </button>
            </>
          ) : (
            <button type="button" className="mentor-course-control mentor-course-import" onClick={handleConnectYouTube}>
              <Youtube aria-hidden="true" />
              Conectar YouTube
            </button>
          )}
        </div>
      </div>

      <ol className="yt-steps" aria-label="Progreso">
        {steps.map((label, i) => {
          const n = i + 1;
          const state = currentStep > n || currentStep === 5 ? 'done' : activeStep === n ? 'current' : 'todo';
          return (
            <li key={label} data-state={state} aria-current={state === 'current' ? 'step' : undefined}>
              <span className="yt-steps__dot">{state === 'done' ? <CheckCircle2 aria-hidden="true" /> : n}</span>
              <span className="yt-steps__label">{label}</span>
            </li>
          );
        })}
      </ol>

      {currentStep === 1 && (
        <div className="yt-card">
          <div className="mentor-publication-filters yt-mode" data-options="2" role="group" aria-label="Cómo quieres empezar">
            <button type="button" aria-pressed={inputMode === 'search'} onClick={() => { setInputMode('search'); setImportError(null); }}>
              <Search aria-hidden="true" />
              <span>Buscar por tema</span>
            </button>
            <button type="button" aria-pressed={inputMode === 'url'} onClick={() => { setInputMode('url'); setImportError(null); }}>
              <Link aria-hidden="true" />
              <span>Pegar URL de playlist</span>
            </button>
          </div>

          {inputMode === 'search' && (
            <form onSubmit={handleSearchContent} className="yt-form">
              <div className="yt-grid">
                <label className="yt-field">
                  {field('Tema del curso')}
                  <input
                    type="text"
                    value={courseTitle}
                    onChange={(e) => setCourseTitle(e.target.value)}
                    placeholder="Ej: Curso de Python desde cero"
                    required
                  />
                  <small>El tema central para encontrar los mejores contenidos.</small>
                </label>
                <label className="yt-field">
                  {field('Palabras clave', '(opcional)')}
                  <input
                    type="text"
                    value={keywords}
                    onChange={(e) => setKeywords(e.target.value)}
                    placeholder="Ej: variables, bucles, funciones, proyectos"
                  />
                  <small>Términos separados por comas que guían la selección.</small>
                </label>
              </div>

              <fieldset className="yt-field">
                <legend>Qué buscar en YouTube</legend>
                <div className="yt-options" role="radiogroup" aria-label="Qué buscar en YouTube">
                  {([
                    { id: 'videos', label: 'Videos sueltos', hint: 'Reúne los mejores videos para que elijas cuáles usar' },
                    { id: 'playlists', label: 'Playlists completas', hint: 'Busca listas existentes y elige una con un clic' },
                  ] as const).map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      role="radio"
                      aria-checked={searchType === o.id}
                      onClick={() => { setSearchType(o.id); if (o.id === 'videos') setFoundPlaylists([]); }}
                    >
                      <strong>{o.label}</strong>
                      <small>{o.hint}</small>
                    </button>
                  ))}
                </div>
              </fieldset>

              <label className="yt-field">
                {field('Instrucción para la IA')}
                <textarea
                  rows={3}
                  value={coursePrompt}
                  onChange={(e) => setCoursePrompt(e.target.value)}
                  placeholder="Ej: Un curso práctico que vaya de fundamentos a proyectos"
                />
                <small>La IA organiza las lecciones según este criterio pedagógico.</small>
              </label>

              <div className="yt-actions">
                {onCancel && (
                  <button type="button" className="mentor-course-control" onClick={onCancel}>
                    Cancelar
                  </button>
                )}
                <button type="submit" className="mentor-course-control mentor-course-import" disabled={isSearching}>
                  {isSearching ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Search aria-hidden="true" />}
                  {isSearching ? 'Buscando en YouTube' : searchType === 'videos' ? 'Buscar videos' : 'Buscar playlists'}
                </button>
              </div>
            </form>
          )}

          {inputMode === 'search' && searchType === 'playlists' && foundPlaylists.length > 0 && (
            <div className="yt-results">
              <h3>{foundPlaylists.length} {foundPlaylists.length === 1 ? 'playlist encontrada' : 'playlists encontradas'}</h3>
              <ul className="yt-playlists">
                {foundPlaylists.map((pl) => (
                  <li key={pl.youtubeId} className="yt-playlist">
                    <div className="yt-playlist__body">
                      {pl.thumbnailUrl && <img src={pl.thumbnailUrl} alt="" />}
                      <div>
                        <strong title={stripEmoji(pl.title)}>{stripEmoji(pl.title)}</strong>
                        <span>{pl.channelTitle}</span>
                        <p>{stripEmoji(pl.description) || 'Sin descripción'}</p>
                      </div>
                    </div>
                    <button type="button" className="mentor-course-control" disabled={importing} onClick={() => handleSelectFoundPlaylist(pl)}>
                      {importing && <Loader2 aria-hidden="true" className="animate-spin" />}
                      {importing ? 'Importando videos' : 'Usar esta playlist'}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {inputMode === 'url' && (
            <form onSubmit={handleImportPlaylist} className="yt-form">
              <label className="yt-field">
                {field('Qué curso debe diseñar la IA')}
                <textarea
                  rows={3}
                  value={coursePrompt}
                  onChange={(e) => setCoursePrompt(e.target.value)}
                  placeholder="Ej: Un curso intensivo de Node.js para quienes ya conocen JavaScript"
                  required
                />
                <small>Junto con los títulos y descripciones de los videos, guía cómo se arman los módulos.</small>
              </label>
              <label className="yt-field">
                {field('URL o ID de la playlist')}
                <input
                  type="text"
                  value={playlistUrl}
                  onChange={(e) => setPlaylistUrl(e.target.value)}
                  placeholder="https://www.youtube.com/playlist?list=..."
                  required
                />
                <small>Sirven playlists públicas y no listadas. Las privadas requieren conectar la cuenta.</small>
              </label>
              <div className="yt-actions">
                {onCancel && (
                  <button type="button" className="mentor-course-control" onClick={onCancel}>
                    Cancelar
                  </button>
                )}
                <button type="submit" className="mentor-course-control mentor-course-import" disabled={importing}>
                  {importing && <Loader2 aria-hidden="true" className="animate-spin" />}
                  {importing ? 'Consultando YouTube' : 'Importar playlist'}
                </button>
              </div>
            </form>
          )}

          {importError && (
            <div className="yt-error" role="alert">
              <AlertCircle aria-hidden="true" />
              <div>
                <p>{importError}</p>
                {!ytStatus.connected && (
                  <button type="button" className="mentor-course-control" onClick={handleConnectYouTube}>
                    Conectar cuenta de YouTube
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {currentStep === 2 && playlist && (
        <div className="yt-card">
          <div className="yt-summary">
            {playlist.thumbnailUrl ? <img src={playlist.thumbnailUrl} alt="" /> : <span className="yt-summary__empty" aria-hidden="true"><Film /></span>}
            <div>
              <span className="yt-summary__kicker">
                {playlist.youtubeId === 'custom-search' ? 'Búsqueda por tema' : privacyLabel(playlist.privacyStatus) || 'Playlist'} · {playlist.channelTitle}
              </span>
              <h3 title={stripEmoji(playlist.title)}>{stripEmoji(playlist.title)}</h3>
              <p>{stripEmoji(playlist.description) || 'Sin descripción'}</p>
              <dl>
                <div><dt>Disponibles</dt><dd>{videos.length}</dd></div>
                <div><dt>Seleccionados</dt><dd>{selectedVideos.length}</dd></div>
                <div><dt>Duración</dt><dd>{selectedVideos.length > 0 ? totalLabel : '—'}</dd></div>
              </dl>
            </div>
          </div>

          <div className="yt-bar">
            <div>
              <button type="button" className="mentor-course-control" onClick={() => toggleSelectAll(true)}>Seleccionar todos</button>
              <button type="button" className="mentor-course-control" onClick={() => toggleSelectAll(false)}>Quitar selección</button>
            </div>
            <span>Ordena con las flechas, desmarca lo que no sirva o elimínalo de la lista.</span>
          </div>

          {videos.length === 0 ? (
            <div className="yt-empty" role="status">
              <strong>No quedan videos en la lista</strong>
              <p>Eliminaste todos los videos. Vuelve atrás para hacer una nueva búsqueda.</p>
            </div>
          ) : (
            <ul className="yt-videos">
              {videos.map((vid, idx) => (
                <li key={vid.id} className="yt-video" data-excluded={vid.excluded || undefined}>
                  <label className="yt-video__pick">
                    <input
                      type="checkbox"
                      checked={!vid.excluded}
                      onChange={() => toggleVideoExcluded(vid.id)}
                      aria-label={`${vid.excluded ? 'Incluir' : 'Excluir'} ${stripEmoji(vid.title)}`}
                    />
                  </label>
                  <span className="yt-video__n" aria-hidden="true">{idx + 1}</span>
                  {vid.thumbnailUrl && <img className="yt-video__thumb" src={vid.thumbnailUrl} alt="" />}
                  <div className="yt-video__text">
                    <strong title={stripEmoji(vid.title)}>{stripEmoji(vid.title)}</strong>
                    <span>
                      {vid.durationFormatted || '0:00'}
                      {vid.channelTitle && ` · ${vid.channelTitle}`}
                      {privacyLabel(vid.privacyStatus) && String(vid.privacyStatus).toUpperCase() !== 'PUBLIC' && ` · ${privacyLabel(vid.privacyStatus)}`}
                    </span>
                  </div>
                  <div className="yt-video__actions">
                    <button type="button" disabled={idx === 0} onClick={() => moveVideo(idx, 'up')} aria-label="Subir video" title="Subir">
                      <MoveUp aria-hidden="true" />
                    </button>
                    <button type="button" disabled={idx === videos.length - 1} onClick={() => moveVideo(idx, 'down')} aria-label="Bajar video" title="Bajar">
                      <MoveDown aria-hidden="true" />
                    </button>
                    <button type="button" data-danger="true" onClick={() => handleRemoveVideo(vid.id)} aria-label="Quitar de la lista" title="Quitar de la lista">
                      <Trash2 aria-hidden="true" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="yt-actions yt-actions--split">
            <button type="button" className="mentor-course-control" onClick={() => setCurrentStep(1)}>
              <ArrowLeft aria-hidden="true" />
              Atrás
            </button>
            <button type="button" className="mentor-course-control mentor-course-import" onClick={handleStartAiGeneration} disabled={selectedVideos.length === 0}>
              <Sparkles aria-hidden="true" />
              Generar con IA ({selectedVideos.length} {selectedVideos.length === 1 ? 'video' : 'videos'})
            </button>
          </div>
        </div>
      )}

      {currentStep === 3 && (
        <div className="yt-card yt-progress" role="status" aria-live="polite">
          <h3>Diseñando el curso</h3>
          <p>{jobStatusText}</p>
          <div className="yt-bar-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(jobProgress)} aria-label="Progreso de la generación">
            <span style={{ width: `${jobProgress}%` }} />
          </div>
          <span className="yt-progress__pct">{Math.round(jobProgress)}%</span>
          <ul>
            <li>Agrupa los videos por tema y nivel</li>
            <li>Asigna cada video a una lección con sus objetivos</li>
            <li>Redacta preguntas de comprensión</li>
          </ul>
          {generationError && (
            <div className="yt-error" role="alert">
              <AlertCircle aria-hidden="true" />
              <div>
                <p>No se pudo generar el curso: {generationError}</p>
                <button type="button" className="mentor-course-control" onClick={() => setCurrentStep(2)}>
                  Volver a la selección
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {currentStep === 4 && draftCourse && (
        <div className="yt-card">
          <div className="yt-review-head">
            <h3>Estructura propuesta</h3>
            <p>Todo es editable: título, módulos y lecciones.</p>
          </div>

          <section className="yt-block" aria-labelledby="yt-main">
            <h4 id="yt-main">Datos principales</h4>
            <div className="yt-grid">
              <label className="yt-field">
                {field('Título')}
                <input
                  type="text"
                  value={draftCourse.course.title}
                  onChange={(e) => setDraftCourse({ ...draftCourse, course: { ...draftCourse.course, title: e.target.value } })}
                />
              </label>
              <div className="yt-grid yt-grid--tight">
                <label className="yt-field">
                  {field('Nivel')}
                  <input
                    type="text"
                    value={draftCourse.course.level}
                    onChange={(e) => setDraftCourse({ ...draftCourse, course: { ...draftCourse.course, level: e.target.value } })}
                    placeholder="Ej: Principiante"
                  />
                </label>
                <label className="yt-field">
                  {field('Categoría')}
                  <select
                    value={draftCourse.course.category || 'Mentoría Especializada'}
                    onChange={(e) => setDraftCourse({ ...draftCourse, course: { ...draftCourse.course, category: e.target.value } })}
                  >
                    {draftCourse.course.category && !COURSE_CATEGORIES.includes(draftCourse.course.category as any) && (
                      <option value={draftCourse.course.category}>{draftCourse.course.category}</option>
                    )}
                    <optgroup label="Modalidades de mentoría">
                      {MENTORSHIP_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </optgroup>
                    <optgroup label="Áreas temáticas">
                      {TECHNICAL_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </optgroup>
                  </select>
                </label>
              </div>
            </div>

            <label className="yt-field">
              {field('Descripción')}
              <textarea
                rows={3}
                value={draftCourse.course.description}
                onChange={(e) => setDraftCourse({ ...draftCourse, course: { ...draftCourse.course, description: e.target.value } })}
              />
            </label>

            <label className="yt-field">
              {field('Objetivos generales', '(uno por línea)')}
              <textarea
                rows={3}
                value={(draftCourse.course.generalObjectives || []).join('\n')}
                onChange={(e) =>
                  setDraftCourse({
                    ...draftCourse,
                    course: { ...draftCourse.course, generalObjectives: e.target.value.split('\n').filter(Boolean) },
                  })
                }
              />
            </label>

            <div className="yt-field">
              <div className="yt-field__row">
                <span className="yt-field__label">Imagen de portada {<em>(si la dejas vacía se genera sola)</em>}</span>
                <button type="button" className="mentor-course-control" onClick={handleGenerateCover} disabled={generatingCover}>
                  {generatingCover ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Sparkles aria-hidden="true" />}
                  {generatingCover ? 'Generando portada' : 'Generar con IA'}
                </button>
              </div>
              <div className="yt-cover-input">
                <input
                  type="text"
                  placeholder="URL de la imagen"
                  aria-label="URL de la imagen de portada"
                  value={draftCourse.course.coverImage || ''}
                  onChange={(e) => setDraftCourse({ ...draftCourse, course: { ...draftCourse.course, coverImage: e.target.value } })}
                />
                {draftCourse.course.coverImage && (
                  <button
                    type="button"
                    className="mentor-course-control mentor-icon-control"
                    onClick={() => setDraftCourse({ ...draftCourse, course: { ...draftCourse.course, coverImage: '' } })}
                    aria-label="Quitar portada"
                    title="Quitar portada"
                  >
                    <X aria-hidden="true" />
                  </button>
                )}
              </div>
              {draftCourse.course.coverImage && (
                <img className="yt-cover" src={draftCourse.course.coverImage} alt="Vista previa de la portada" />
              )}
            </div>
          </section>

          <section className="yt-block" aria-labelledby="yt-modules">
            <h4 id="yt-modules">Módulos y lecciones <span>{draftCourse.modules.length} {draftCourse.modules.length === 1 ? 'módulo' : 'módulos'}</span></h4>
            <ul className="yt-modules">
              {draftCourse.modules.map((mod, mIdx) => (
                <li key={mIdx} className="yt-module">
                  <div className="yt-module__head">
                    <span className="yt-module__n" aria-hidden="true">{mIdx + 1}</span>
                    <textarea
                      rows={1}
                      value={mod.title}
                      aria-label={`Título del módulo ${mIdx + 1}`}
                      onChange={(e) => {
                        const newMods = [...draftCourse.modules];
                        newMods[mIdx].title = e.target.value;
                        setDraftCourse({ ...draftCourse, modules: newMods });
                      }}
                    />
                    <span className="yt-module__count">{mod.lessons.length} {mod.lessons.length === 1 ? 'lección' : 'lecciones'}</span>
                  </div>
                  <ul className="yt-lessons">
                    {mod.lessons.map((les, lIdx) => (
                      <li key={lIdx}>
                        <div className="yt-lesson__row">
                          <textarea
                            rows={1}
                            value={les.title}
                            aria-label={`Título de la lección ${lIdx + 1} del módulo ${mIdx + 1}`}
                            onChange={(e) => {
                              const newMods = [...draftCourse.modules];
                              newMods[mIdx].lessons[lIdx].title = e.target.value;
                              setDraftCourse({ ...draftCourse, modules: newMods });
                            }}
                          />
                          <span>{les.durationFormatted || '0:00'}</span>
                          <a href={`https://www.youtube.com/watch?v=${les.youtubeVideoId}`} target="_blank" rel="noreferrer" aria-label="Ver en YouTube" title="Ver en YouTube">
                            <ExternalLink aria-hidden="true" />
                          </a>
                        </div>
                        {les.learningObjectives && les.learningObjectives.length > 0 && (
                          <p><strong>Objetivo:</strong> {les.learningObjectives[0]}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </section>

          <div className="yt-actions yt-actions--split">
            <button type="button" className="mentor-course-control" onClick={() => setCurrentStep(2)}>
              <ArrowLeft aria-hidden="true" />
              Atrás
            </button>
            <div className="yt-save">
              <label className="yt-check">
                <input type="checkbox" checked={publishImmediately} onChange={(e) => setPublishImmediately(e.target.checked)} />
                <span>Publicar al guardar</span>
              </label>
              <button type="button" className="mentor-course-control mentor-course-import" onClick={handleSaveDraftCourse} disabled={savingCourse}>
                {savingCourse ? <Loader2 aria-hidden="true" className="animate-spin" /> : publishImmediately ? <Globe aria-hidden="true" /> : <Save aria-hidden="true" />}
                {savingCourse ? (publishImmediately ? 'Publicando' : 'Guardando') : publishImmediately ? 'Guardar y publicar' : 'Guardar como borrador'}
              </button>
            </div>
          </div>
        </div>
      )}

      {currentStep === 5 && saveSuccess && (
        <div className="yt-card yt-done">
          <span className="yt-done__icon" aria-hidden="true"><CheckCircle2 /></span>
          <h3>{saveSuccess.published ? 'Curso creado y publicado' : 'Curso creado como borrador'}</h3>
          <p>
            <strong>{saveSuccess.courseTitle}</strong> {saveSuccess.published ? 'ya está en el catálogo.' : 'quedó guardado y solo lo ven mentores y administradores.'}
          </p>
          <ul>
            <li><CheckCircle2 aria-hidden="true" />Videos vinculados con reproducción sin cookies de YouTube</li>
            <li><CheckCircle2 aria-hidden="true" />Módulos y lecciones guardados</li>
            <li><CheckCircle2 aria-hidden="true" />{saveSuccess.published ? 'Visible para todos los alumnos en el catálogo' : 'Podrás publicarlo cuando quieras'}</li>
          </ul>
          <div className="yt-actions yt-actions--center">
            {!saveSuccess.published && (
              <button type="button" className="mentor-course-control mentor-course-import" onClick={handlePublishNow} disabled={publishing}>
                {publishing ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Globe aria-hidden="true" />}
                Publicar ahora
              </button>
            )}
            {onCancel && (
              <button type="button" className="mentor-course-control" onClick={onCancel}>
                Cerrar y volver
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
};
