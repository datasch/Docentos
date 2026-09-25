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

import React, { useState, useEffect } from 'react';
import {
  Youtube,
  Sparkles,
  Link,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Eye,
  Lock,
  Globe,
  Sliders,
  Play,
  Layers,
  BookOpen,
  HelpCircle,
  Clock,
  Trash2,
  MoveUp,
  MoveDown,
  ShieldCheck,
  CheckSquare,
  Square,
  ExternalLink,
  Edit3,
  Save,
} from 'lucide-react';
import { api } from '../lib/api';
import {
  User,
  YouTubeConnectionStatus,
  YouTubePlaylistData,
  YouTubeVideoItem,
  GeneratedCourseDraft,
  GeneratedModuleDraft,
  GeneratedLessonDraft,
  YouTubeAiJob,
} from '../types';

interface YouTubeCourseBuilderProps {
  currentUser: User;
  onCourseCreated?: (courseId: string) => void;
  onCancel?: () => void;
}

export const YouTubeCourseBuilder: React.FC<YouTubeCourseBuilderProps> = ({
  currentUser,
  onCourseCreated,
  onCancel,
}) => {
  // Pasos: 1 = Input (Peticion + URL), 2 = Seleccionar videos, 3 = Generando con IA, 4 = Revision y Edicion, 5 = Finalizado
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4 | 5>(1);

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

  // Playlist importada
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
  const [savingCourse, setSavingCourse] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<{ courseId: string; courseTitle: string } | null>(null);
  const [publishing, setPublishing] = useState(false);

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

  // Paso 1: Importar Playlist
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

  // Manejo de Selección y Orden de Videos (Paso 2)
  const toggleSelectAll = (select: boolean) => {
    setVideos((prev) => prev.map((v) => ({ ...v, excluded: !select })));
  };

  const toggleVideoExcluded = (id: string) => {
    setVideos((prev) =>
      prev.map((v) => (v.id === id ? { ...v, excluded: !v.excluded } : v)),
    );
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

      const response = await api.youtube.generateCourse({
        playlistId: playlist?.id,
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

  // Polling del estado del AIJob
  const pollJobStatus = (jobId: string) => {
    const interval = setInterval(async () => {
      try {
        const job = await api.youtube.getJobStatus(jobId);
        setJobProgress(job.progress || 50);

        if (job.status === 'PROCESSING') {
          setJobStatusText(`Analizando y estructurando módulos... (${job.progress}%)`);
        } else if (job.status === 'COMPLETED') {
          clearInterval(interval);
          setJobProgress(100);
          setJobStatusText('¡Curso generado con éxito!');
          if (job.result) {
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
        clearInterval(interval);
        setGenerationError(err.message || 'Error al consultar el progreso del trabajo.');
      }
    }, 2000);
  };

  // Paso 4: Guardar como Borrador en DocentOS
  const handleSaveDraftCourse = async () => {
    if (!activeJobId || !draftCourse) return;

    try {
      setSavingCourse(true);
      const res = await api.youtube.applyJob(activeJobId, draftCourse);
      setSaveSuccess({ courseId: res.courseId, courseTitle: res.courseTitle });
      setCurrentStep(5);
      if (onCourseCreated) {
        onCourseCreated(res.courseId);
      }
    } catch (err: any) {
      alert(`Error al guardar curso borrador: ${err.message}`);
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

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Encabezado */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 relative overflow-hidden shadow-xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-red-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold mb-3">
              <Youtube className="w-3.5 h-3.5" />
              <span>AI YouTube Course Builder</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Crear Cursos Inteligentes desde YouTube
            </h1>
            <p className="text-slate-400 text-sm mt-1 max-w-2xl">
              Importa playlists públicas, no listadas o privadas y deja que la IA organice los videos en un temario pedagógico estructurado con módulos y lecciones.
            </p>
          </div>

          {/* Estado de conexión con YouTube */}
          <div className="flex items-center gap-3 bg-slate-950/60 p-3 rounded-xl border border-slate-800 self-start md:self-auto">
            {loadingStatus ? (
              <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
            ) : ytStatus.connected ? (
              <div className="flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <div className="text-xs">
                  <p className="font-semibold text-white">YouTube Conectado</p>
                  <p className="text-slate-400 truncate max-w-[160px]">{ytStatus.googleEmail}</p>
                </div>
                <button
                  type="button"
                  onClick={handleDisconnectYouTube}
                  className="text-xs text-red-400 hover:text-red-300 ml-1 underline"
                >
                  Desconectar
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleConnectYouTube}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-medium transition"
              >
                <Youtube className="w-4 h-4" />
                <span>Conectar con Google OAuth</span>
              </button>
            )}
          </div>
        </div>

        {/* Wizard Progress Steps */}
        <div className="grid grid-cols-4 gap-2 mt-8 pt-6 border-t border-slate-800/80 text-xs font-medium">
          <div className={`flex items-center gap-2 ${currentStep >= 1 ? 'text-red-400' : 'text-slate-500'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${currentStep >= 1 ? 'bg-red-500 text-white' : 'bg-slate-800 text-slate-400'}`}>1</span>
            <span>Importar Playlist</span>
          </div>
          <div className={`flex items-center gap-2 ${currentStep >= 2 ? 'text-red-400' : 'text-slate-500'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${currentStep >= 2 ? 'bg-red-500 text-white' : 'bg-slate-800 text-slate-400'}`}>2</span>
            <span>Curar Videos</span>
          </div>
          <div className={`flex items-center gap-2 ${currentStep >= 3 ? 'text-red-400' : 'text-slate-500'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${currentStep >= 3 ? 'bg-red-500 text-white' : 'bg-slate-800 text-slate-400'}`}>3</span>
            <span>Generación IA</span>
          </div>
          <div className={`flex items-center gap-2 ${currentStep >= 4 ? 'text-red-400' : 'text-slate-500'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${currentStep >= 4 ? 'bg-red-500 text-white' : 'bg-slate-800 text-slate-400'}`}>4</span>
            <span>Revisar y Guardar</span>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────────────────
          PASO 1: Formulario de Petición e Importación
      ───────────────────────────────────────────────────────────────────────────── */}
      {currentStep === 1 && (
        <form onSubmit={handleImportPlaylist} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6 shadow-lg">
          <div>
            <label className="block text-sm font-semibold text-white mb-2">
              1. ¿Qué curso quieres que la IA diseñe a partir de esta playlist?
            </label>
            <textarea
              rows={3}
              value={coursePrompt}
              onChange={(e) => setCoursePrompt(e.target.value)}
              placeholder="Ej: Quiero un curso intensivo de Node.js y Microservicios para desarrolladores con experiencia previa en JavaScript..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-red-500 transition"
              required
            />
            <p className="text-xs text-slate-400 mt-1.5">
              La IA utilizará esta indicación pedagógica junto con los títulos y descripciones de los videos para estructurar los módulos.
            </p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-white mb-2">
              2. URL o ID de la Playlist de YouTube
            </label>
            <div className="relative">
              <input
                type="text"
                value={playlistUrl}
                onChange={(e) => setPlaylistUrl(e.target.value)}
                placeholder="https://www.youtube.com/playlist?list=PL4cUxeGndae..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-red-500 transition font-mono text-xs sm:text-sm"
                required
              />
              <Link className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-slate-400">
              <span className="flex items-center gap-1 text-emerald-400 font-medium">
                <Globe className="w-3.5 h-3.5" /> Públicas
              </span>
              <span>•</span>
              <span className="flex items-center gap-1 text-sky-400 font-medium">
                <Eye className="w-3.5 h-3.5" /> No listadas
              </span>
              <span>•</span>
              <span className="flex items-center gap-1 text-amber-400 font-medium">
                <Lock className="w-3.5 h-3.5" /> Privadas (requiere OAuth de la cuenta)
              </span>
            </div>
          </div>

          {importError && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm flex items-start gap-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-400 mt-0.5" />
              <div>
                <p className="font-medium">{importError}</p>
                {!ytStatus.connected && (
                  <button
                    type="button"
                    onClick={handleConnectYouTube}
                    className="mt-2 text-xs underline font-semibold text-red-400 hover:text-white"
                  >
                    Conectar cuenta de YouTube ahora
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-4 border-t border-slate-800">
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 rounded-xl text-slate-400 hover:text-white text-sm transition"
              >
                Cancelar
              </button>
            )}
            <button
              type="submit"
              disabled={importing}
              className="ml-auto flex items-center gap-2 px-6 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-semibold text-sm transition shadow-lg shadow-red-600/20"
            >
              {importing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Consultando YouTube API...</span>
                </>
              ) : (
                <>
                  <span>Importar Playlist</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────────
          PASO 2: Revisión y Selección de Videos
      ───────────────────────────────────────────────────────────────────────────── */}
      {currentStep === 2 && playlist && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6 shadow-lg">
          {/* Tarjeta de la Playlist */}
          <div className="flex flex-col sm:flex-row gap-4 p-4 rounded-xl bg-slate-950 border border-slate-800/80">
            {playlist.thumbnailUrl && (
              <img
                src={playlist.thumbnailUrl}
                alt={playlist.title}
                className="w-full sm:w-48 h-28 object-cover rounded-lg border border-slate-800 flex-shrink-0"
              />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2 py-0.5 text-[11px] font-semibold rounded-md bg-slate-800 text-slate-300 uppercase">
                  {playlist.privacyStatus}
                </span>
                <span className="text-xs text-slate-400">• {playlist.channelTitle}</span>
              </div>
              <h2 className="text-lg font-bold text-white truncate">{playlist.title}</h2>
              <p className="text-xs text-slate-400 mt-1 line-clamp-2">{playlist.description || 'Sin descripción'}</p>
              <div className="flex items-center gap-4 mt-3 text-xs text-slate-400">
                <span>{videos.length} videos detectados</span>
                <span>{videos.filter((v) => !v.excluded).length} seleccionados para el curso</span>
              </div>
            </div>
          </div>

          {/* Barra de Controles de Videos */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => toggleSelectAll(true)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition"
              >
                Seleccionar todos
              </button>
              <button
                type="button"
                onClick={() => toggleSelectAll(false)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition"
              >
                Deseleccionar todos
              </button>
            </div>
            <p className="text-xs text-slate-400">
              Puedes cambiar el orden usando las flechas o excluir clases que no pertenezcan al curso.
            </p>
          </div>

          {/* Lista de Videos */}
          <div className="space-y-2 max-h-[460px] overflow-y-auto pr-2 divide-y divide-slate-800/60">
            {videos.map((vid, idx) => (
              <div
                key={vid.id}
                className={`flex items-center gap-3 p-3 rounded-xl transition ${
                  vid.excluded
                    ? 'opacity-40 bg-slate-950/40'
                    : 'bg-slate-950/80 hover:bg-slate-950 border border-slate-800/60'
                }`}
              >
                {/* Checkbox */}
                <button
                  type="button"
                  onClick={() => toggleVideoExcluded(vid.id)}
                  className="text-red-500 hover:text-red-400 transition flex-shrink-0"
                >
                  {vid.excluded ? (
                    <Square className="w-5 h-5 text-slate-600" />
                  ) : (
                    <CheckSquare className="w-5 h-5 text-red-500" />
                  )}
                </button>

                {/* Número / Orden */}
                <span className="w-6 text-center text-xs font-mono font-semibold text-slate-500">
                  {idx + 1}
                </span>

                {/* Thumbnail */}
                {vid.thumbnailUrl && (
                  <img
                    src={vid.thumbnailUrl}
                    alt={vid.title}
                    className="w-16 h-10 object-cover rounded border border-slate-800 flex-shrink-0"
                  />
                )}

                {/* Datos del Video */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{vid.title}</p>
                  <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
                    <span className="flex items-center gap-1 font-mono text-[11px]">
                      <Clock className="w-3 h-3 text-slate-500" />
                      {vid.durationFormatted || '0:00'}
                    </span>
                    {vid.privacyStatus === 'PRIVATE' && (
                      <span className="text-[11px] text-amber-400 font-semibold flex items-center gap-1">
                        <Lock className="w-3 h-3" /> Privado
                      </span>
                    )}
                  </div>
                </div>

                {/* Controles de Orden */}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() => moveVideo(idx, 'up')}
                    className="p-1 rounded text-slate-400 hover:text-white disabled:opacity-20 hover:bg-slate-800 transition"
                    title="Mover arriba"
                  >
                    <MoveUp className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    disabled={idx === videos.length - 1}
                    onClick={() => moveVideo(idx, 'down')}
                    className="p-1 rounded text-slate-400 hover:text-white disabled:opacity-20 hover:bg-slate-800 transition"
                    title="Mover abajo"
                  >
                    <MoveDown className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Botones de acción */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setCurrentStep(1)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-slate-400 hover:text-white text-sm transition"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Atrás</span>
            </button>
            <button
              type="button"
              onClick={handleStartAiGeneration}
              disabled={videos.filter((v) => !v.excluded).length === 0}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-semibold text-sm transition shadow-lg shadow-red-600/20 disabled:opacity-40"
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>Generar Estructura con IA ({videos.filter((v) => !v.excluded).length} videos)</span>
            </button>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────────
          PASO 3: Progreso de Generación IA
      ───────────────────────────────────────────────────────────────────────────── */}
      {currentStep === 3 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center space-y-6 shadow-xl max-w-xl mx-auto">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 flex items-center justify-center mx-auto relative">
            <Sparkles className="w-8 h-8 animate-pulse text-red-400" />
          </div>

          <div>
            <h2 className="text-xl font-bold text-white mb-1">
              Diseñando el Curso con Inteligencia Artificial
            </h2>
            <p className="text-sm text-slate-400">{jobStatusText}</p>
          </div>

          {/* Barra de Progreso */}
          <div className="w-full bg-slate-950 rounded-full h-3 overflow-hidden border border-slate-800 p-0.5">
            <div
              className="bg-gradient-to-r from-red-600 to-amber-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${jobProgress}%` }}
            />
          </div>

          <div className="text-xs text-slate-500 space-y-1">
            <p>• Categorizando temas y nivel pedagógico</p>
            <p>• Asignando videos a lecciones con objetivos de aprendizaje</p>
            <p>• Formulando preguntas de comprensión para autoevaluación</p>
          </div>

          {generationError && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm mt-4">
              <p className="font-semibold">Ocurrió un error en la generación:</p>
              <p className="text-xs mt-1">{generationError}</p>
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                className="mt-3 px-4 py-1.5 rounded-lg bg-red-600 text-white text-xs font-semibold"
              >
                Volver a la selección de videos
              </button>
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────────
          PASO 4: Revisión y Edición Granular del Curso Generado
      ───────────────────────────────────────────────────────────────────────────── */}
      {currentStep === 4 && draftCourse && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6 shadow-lg">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold mb-1">
                <Edit3 className="w-3.5 h-3.5" />
                <span>Borrador generado por IA — Puedes editar todo</span>
              </div>
              <h2 className="text-xl font-bold text-white">Estructura del Curso Propuesta</h2>
            </div>
            <button
              type="button"
              onClick={handleSaveDraftCourse}
              disabled={savingCourse}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm transition shadow-lg shadow-emerald-600/20"
            >
              {savingCourse ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Guardando en DocentOS...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Guardar como Curso Borrador</span>
                </>
              )}
            </button>
          </div>

          {/* Metadatos Generales del Curso */}
          <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Datos Principales</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Título del Curso</label>
                <input
                  type="text"
                  value={draftCourse.course.title}
                  onChange={(e) =>
                    setDraftCourse({
                      ...draftCourse,
                      course: { ...draftCourse.course, title: e.target.value },
                    })
                  }
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-sm text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Nivel y Categoría</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={draftCourse.course.level}
                    onChange={(e) =>
                      setDraftCourse({
                        ...draftCourse,
                        course: { ...draftCourse.course, level: e.target.value },
                      })
                    }
                    className="w-1/2 bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-sm text-white"
                    placeholder="Nivel"
                  />
                  <input
                    type="text"
                    value={draftCourse.course.category || 'YouTube Masterclass'}
                    onChange={(e) =>
                      setDraftCourse({
                        ...draftCourse,
                        course: { ...draftCourse.course, category: e.target.value },
                      })
                    }
                    className="w-1/2 bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-sm text-white"
                    placeholder="Categoría"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Descripción del Curso</label>
              <textarea
                rows={2}
                value={draftCourse.course.description}
                onChange={(e) =>
                  setDraftCourse({
                    ...draftCourse,
                    course: { ...draftCourse.course, description: e.target.value },
                  })
                }
                className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-sm text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Objetivos Generales (uno por línea)</label>
              <textarea
                rows={2}
                value={(draftCourse.course.generalObjectives || []).join('\n')}
                onChange={(e) =>
                  setDraftCourse({
                    ...draftCourse,
                    course: {
                      ...draftCourse.course,
                      generalObjectives: e.target.value.split('\n').filter(Boolean),
                    },
                  })
                }
                className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-sm text-white font-mono text-xs"
              />
            </div>
          </div>

          {/* Módulos y Lecciones */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-red-500" />
              <span>Módulos y Lecciones ({draftCourse.modules.length} módulos)</span>
            </h3>

            {draftCourse.modules.map((mod, mIdx) => (
              <div key={mIdx} className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-lg bg-red-600/20 text-red-400 font-bold text-xs flex items-center justify-center">
                    {mIdx + 1}
                  </span>
                  <input
                    type="text"
                    value={mod.title}
                    onChange={(e) => {
                      const newMods = [...draftCourse.modules];
                      newMods[mIdx].title = e.target.value;
                      setDraftCourse({ ...draftCourse, modules: newMods });
                    }}
                    className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-sm font-semibold text-white"
                  />
                  <span className="text-xs text-slate-500">{mod.lessons.length} lecciones</span>
                </div>

                {/* Lecciones del módulo */}
                <div className="pl-9 space-y-2 pt-1">
                  {mod.lessons.map((les, lIdx) => (
                    <div
                      key={lIdx}
                      className="p-3 rounded-lg bg-slate-900/60 border border-slate-800/60 space-y-2 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <Play className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                        <input
                          type="text"
                          value={les.title}
                          onChange={(e) => {
                            const newMods = [...draftCourse.modules];
                            newMods[mIdx].lessons[lIdx].title = e.target.value;
                            setDraftCourse({ ...draftCourse, modules: newMods });
                          }}
                          className="flex-1 bg-transparent border-b border-transparent hover:border-slate-700 focus:border-red-500 font-medium text-white px-1 py-0.5"
                        />
                        <span className="font-mono text-slate-400">{les.durationFormatted || '0:00'}</span>
                        <a
                          href={`https://www.youtube.com/watch?v=${les.youtubeVideoId}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-slate-500 hover:text-red-400 ml-1"
                          title="Ver en YouTube"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>

                      {les.learningObjectives && les.learningObjectives.length > 0 && (
                        <div className="text-[11px] text-slate-400 pl-5">
                          <span className="font-semibold text-slate-300">Objetivo: </span>
                          {les.learningObjectives[0]}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Pie con botón de guardado */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setCurrentStep(2)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-slate-400 hover:text-white text-sm transition"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Atrás</span>
            </button>
            <button
              type="button"
              onClick={handleSaveDraftCourse}
              disabled={savingCourse}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm transition shadow-lg shadow-emerald-600/20"
            >
              {savingCourse ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Guardando...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Guardar como Borrador en DocentOS</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────────
          PASO 5: Confirmación de Creación Exitosa
      ───────────────────────────────────────────────────────────────────────────── */}
      {currentStep === 5 && saveSuccess && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-10 text-center space-y-6 shadow-xl max-w-lg mx-auto">
          <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <div>
            <h2 className="text-2xl font-bold text-white mb-2">
              ¡Curso Creado Exitosamente!
            </h2>
            <p className="text-sm text-slate-400">
              El curso <span className="text-white font-semibold font-mono">"{saveSuccess.courseTitle}"</span> ha sido guardado como un <strong className="text-amber-400">BORRADOR</strong> en DocentOS.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-400 text-left space-y-2">
            <p>✅ Videos vinculados con reproducción nativa sin cookies de YouTube</p>
            <p>✅ Módulos y lecciones sincronizados en PostgreSQL</p>
            <p>✅ Solo los mentores y administradores pueden verlo mientras esté en borrador</p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={handlePublishNow}
              disabled={publishing}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-semibold transition flex items-center justify-center gap-2"
            >
              {publishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
              <span>Publicar Ahora en el Catálogo</span>
            </button>
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-sm font-semibold transition"
              >
                Volver al Panel de Mentor
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
