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
  Search,
  Tag,
  Film,
  ListFilter,
  X,
} from 'lucide-react';
import { api } from '../lib/api';
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

const COURSE_CATEGORIES = [
  'Mentoría Especializada',
  'Mentoría Premium',
  'Mentoría Elite',
  'Desarrollo Web',
  'Inteligencia Artificial',
  'Tecnología e Ingeniería',
  'Negocios y Emprendimiento',
  'Diseño y Creatividad',
  'YouTube Masterclass',
  'General',
];

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
  }, []);

  const pollJobStatus = (jobId: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    let consecutiveErrors = 0;
    const MAX_CONSECUTIVE_ERRORS = 4;

    const interval = setInterval(async () => {
      try {
        const job = await api.youtube.getJobStatus(jobId);
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
        consecutiveErrors += 1;
        if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
          clearInterval(interval);
          setGenerationError(err.message || 'Error al consultar el progreso del trabajo.');
        }
      }
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
            <span>Buscar / Importar</span>
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
          PASO 1: Modalidad de Entrada (Búsqueda Inteligente o URL)
      ───────────────────────────────────────────────────────────────────────────── */}
      {currentStep === 1 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6 shadow-lg">
          {/* Tabs para seleccionar el método de obtención */}
          <div className="flex items-center gap-2 p-1 bg-slate-950/80 rounded-xl border border-slate-800/80 max-w-lg">
            <button
              type="button"
              onClick={() => {
                setInputMode('search');
                setImportError(null);
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-semibold transition ${
                inputMode === 'search'
                  ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-md shadow-red-600/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Búsqueda Inteligente (Título / Keywords)</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setInputMode('url');
                setImportError(null);
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-semibold transition ${
                inputMode === 'url'
                  ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-md shadow-red-600/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <Link className="w-3.5 h-3.5" />
              <span>Pegar URL de Playlist</span>
            </button>
          </div>

          {/* Formulario 1: Búsqueda Inteligente por Título y Palabras Clave */}
          {inputMode === 'search' && (
            <form onSubmit={handleSearchContent} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-white mb-2">
                    1. Título o Tema del Curso
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={courseTitle}
                      onChange={(e) => setCourseTitle(e.target.value)}
                      placeholder="Ej: Curso de Python desde Cero a Avanzado"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-red-500 transition"
                      required
                    />
                    <Film className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  </div>
                  <p className="text-xs text-slate-400 mt-1.5">
                    Define el tema central para localizar los mejores contenidos.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-white mb-2">
                    2. Palabras Clave (Keywords / Temario)
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={keywords}
                      onChange={(e) => setKeywords(e.target.value)}
                      placeholder="Ej: variables, bucles, funciones, POO, fastapi, proyectos"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-red-500 transition"
                    />
                    <Tag className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  </div>
                  <p className="text-xs text-slate-400 mt-1.5">
                    Términos separados por comas que guiarán la selección de lecciones.
                  </p>
                </div>
              </div>

              {/* Selector de tipo de búsqueda */}
              <div>
                <label className="block text-sm font-semibold text-white mb-2">
                  3. ¿Qué deseas buscar en YouTube?
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg">
                  <button
                    type="button"
                    onClick={() => {
                      setSearchType('videos');
                      setFoundPlaylists([]);
                    }}
                    className={`flex items-start gap-3 p-3 rounded-xl border text-left transition ${
                      searchType === 'videos'
                        ? 'border-red-500 bg-red-500/10 text-white'
                        : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <Film className={`w-5 h-5 mt-0.5 ${searchType === 'videos' ? 'text-red-400' : 'text-slate-500'}`} />
                    <div>
                      <p className="text-xs font-semibold text-white">Videos Temáticos</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Busca los mejores videos individuales y los reúne listos para curar.
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSearchType('playlists');
                    }}
                    className={`flex items-start gap-3 p-3 rounded-xl border text-left transition ${
                      searchType === 'playlists'
                        ? 'border-red-500 bg-red-500/10 text-white'
                        : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <ListFilter className={`w-5 h-5 mt-0.5 ${searchType === 'playlists' ? 'text-red-400' : 'text-slate-500'}`} />
                    <div>
                      <p className="text-xs font-semibold text-white">Playlists Completas</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Busca listas de reproducción existentes para seleccionar una con 1 clic.
                      </p>
                    </div>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-white mb-2">
                  4. Instrucción Pedagógica para la IA
                </label>
                <textarea
                  rows={2}
                  value={coursePrompt}
                  onChange={(e) => setCoursePrompt(e.target.value)}
                  placeholder="Ej: Quiero un curso práctico y estructurado de fundamentos a proyectos..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-red-500 transition"
                />
                <p className="text-xs text-slate-400 mt-1">
                  La IA estructurará las lecciones según este criterio pedagógico.
                </p>
              </div>

              {/* Botón de Acción */}
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
                  disabled={isSearching}
                  className="ml-auto flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 disabled:opacity-50 text-white font-semibold text-sm transition shadow-lg shadow-red-600/20"
                >
                  {isSearching ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Buscando en YouTube...</span>
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4" />
                      <span>
                        {searchType === 'videos'
                          ? 'Buscar Videos y Curar'
                          : 'Buscar Playlists en YouTube'}
                      </span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* Resultados de Playlists encontradas (si eligió buscar playlists) */}
          {inputMode === 'search' && searchType === 'playlists' && foundPlaylists.length > 0 && (
            <div className="pt-4 border-t border-slate-800 space-y-3">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <ListFilter className="w-4 h-4 text-red-400" />
                <span>Playlists encontradas en YouTube ({foundPlaylists.length})</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[360px] overflow-y-auto pr-1">
                {foundPlaylists.map((pl) => (
                  <div
                    key={pl.youtubeId}
                    className="flex flex-col justify-between p-3 rounded-xl bg-slate-950 border border-slate-800/80 hover:border-slate-700 transition"
                  >
                    <div className="flex gap-3">
                      {pl.thumbnailUrl && (
                        <img
                          src={pl.thumbnailUrl}
                          alt={pl.title}
                          className="w-24 h-16 object-cover rounded-lg border border-slate-800 flex-shrink-0"
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-white line-clamp-1">{pl.title}</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">{pl.channelTitle}</p>
                        <p className="text-[10px] text-slate-500 mt-1 line-clamp-2">{pl.description || 'Sin descripción'}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={importing}
                      onClick={() => handleSelectFoundPlaylist(pl)}
                      className="mt-3 w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-red-600/20 hover:bg-red-600 text-red-300 hover:text-white text-xs font-medium transition"
                    >
                      {importing ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Importando videos...</span>
                        </>
                      ) : (
                        <>
                          <span>Curar videos de esta playlist</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </>
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Formulario 2: URL Manual de Playlist */}
          {inputMode === 'url' && (
            <form onSubmit={handleImportPlaylist} className="space-y-6">
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

          {/* Mensaje de Error en Paso 1 */}
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
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────────
          PASO 2: Revisión y Curación de Videos (Selección, Orden y Eliminación)
      ───────────────────────────────────────────────────────────────────────────── */}
      {currentStep === 2 && playlist && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6 shadow-lg">
          {/* Tarjeta de la Playlist o Búsqueda */}
          <div className="flex flex-col sm:flex-row gap-4 p-4 rounded-xl bg-slate-950 border border-slate-800/80">
            {playlist.thumbnailUrl ? (
              <img
                src={playlist.thumbnailUrl}
                alt={playlist.title}
                className="w-full sm:w-48 h-28 object-cover rounded-lg border border-slate-800 flex-shrink-0"
              />
            ) : (
              <div className="w-full sm:w-48 h-28 rounded-lg border border-slate-800 bg-slate-900 flex items-center justify-center flex-shrink-0">
                <Film className="w-8 h-8 text-red-500" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2 py-0.5 text-[11px] font-semibold rounded-md bg-red-600/20 text-red-300 uppercase flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-300" />
                  {playlist.youtubeId === 'custom-search' ? 'Búsqueda Inteligente' : playlist.privacyStatus}
                </span>
                <span className="text-xs text-slate-400">• {playlist.channelTitle}</span>
              </div>
              <h2 className="text-lg font-bold text-white truncate">{playlist.title}</h2>
              <p className="text-xs text-slate-400 mt-1 line-clamp-2">{playlist.description || 'Sin descripción'}</p>
              <div className="flex items-center gap-4 mt-3 text-xs text-slate-400">
                <span>{videos.length} videos disponibles</span>
                <span className="text-emerald-400 font-medium">
                  {videos.filter((v) => !v.excluded).length} seleccionados para el temario
                </span>
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
              Usa las flechas para ordenar, desmarca los no prioritarios o el ícono de papelera para eliminar videos que no desees mostrar.
            </p>
          </div>

          {/* Lista de Videos */}
          {videos.length === 0 ? (
            <div className="p-8 text-center bg-slate-950/60 rounded-xl border border-slate-800 text-slate-400 space-y-2">
              <AlertCircle className="w-8 h-8 text-amber-400 mx-auto" />
              <p className="font-semibold text-white">No quedan videos en la lista.</p>
              <p className="text-xs text-slate-400">
                Has eliminado todos los videos. Haz clic en "Atrás" para realizar una nueva búsqueda.
              </p>
            </div>
          ) : (
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
                    title={vid.excluded ? 'Incluir en el temario' : 'Excluir del temario'}
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
                      {vid.channelTitle && (
                        <span className="text-[11px] text-slate-500 truncate max-w-[150px]">
                          {vid.channelTitle}
                        </span>
                      )}
                      {vid.privacyStatus === 'PRIVATE' && (
                        <span className="text-[11px] text-amber-400 font-semibold flex items-center gap-1">
                          <Lock className="w-3 h-3" /> Privado
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Controles de Orden y Eliminación */}
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
                    {/* Botón de Eliminación (Descartar Video) */}
                    <button
                      type="button"
                      onClick={() => handleRemoveVideo(vid.id)}
                      className="p-1 rounded text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition ml-1"
                      title="Eliminar este video de la lista"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

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
          <div className="flex items-center justify-between pb-4 border-b border-slate-800 flex-wrap gap-3">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-semibold mb-1">
                <Edit3 className="w-3.5 h-3.5" />
                <span>Estructura generada por IA — Puedes personalizar todo</span>
              </div>
              <h2 className="text-xl font-bold text-white">Estructura del Curso Propuesta</h2>
            </div>
            <div className="flex items-center gap-4 flex-wrap">
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={publishImmediately}
                  onChange={(e) => setPublishImmediately(e.target.checked)}
                  className="accent-[#06b6d4] w-4 h-4 rounded cursor-pointer"
                />
                <span>Publicar inmediatamente</span>
              </label>

              <button
                type="button"
                onClick={handleSaveDraftCourse}
                disabled={savingCourse}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm transition shadow-lg shadow-emerald-600/20 disabled:opacity-50"
              >
                {savingCourse ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{publishImmediately ? 'Publicando en DocentOS...' : 'Guardando en DocentOS...'}</span>
                  </>
                ) : (
                  <>
                    {publishImmediately ? <Globe className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                    <span>{publishImmediately ? 'Guardar y Publicar Curso' : 'Guardar como Curso Borrador'}</span>
                  </>
                )}
              </button>
            </div>
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
                    className="w-1/2 bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-red-500"
                    placeholder="Nivel (Ej: Principiante)"
                  />
                  <select
                    value={draftCourse.course.category || 'Mentoría Especializada'}
                    onChange={(e) =>
                      setDraftCourse({
                        ...draftCourse,
                        course: { ...draftCourse.course, category: e.target.value },
                      })
                    }
                    className="w-1/2 bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-red-500 cursor-pointer"
                  >
                    {draftCourse.course.category && !COURSE_CATEGORIES.includes(draftCourse.course.category) && (
                      <option value={draftCourse.course.category}>{draftCourse.course.category}</option>
                    )}
                    {COURSE_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
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
                className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-red-500"
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
                className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-sm text-white font-mono text-xs focus:outline-none focus:border-red-500"
              />
            </div>

            {/* Imagen de Portada (Generación Temática con IA + Logo) */}
            <div className="space-y-2 pt-3 border-t border-slate-800/80">
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-medium text-slate-300 block">
                  Imagen de Portada (Automática con IA + Logo si se deja vacía)
                </label>
                <button
                  type="button"
                  onClick={handleGenerateCover}
                  disabled={generatingCover}
                  className="px-3 py-1.5 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-300 text-xs font-bold flex items-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {generatingCover ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5" />
                  )}
                  <span>{generatingCover ? 'Generando con IA...' : 'Generar con IA + Logo'}</span>
                </button>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Dejar vacío para autogenerar portada IA temática con logo del plugin..."
                  value={draftCourse.course.coverImage || ''}
                  onChange={(e) =>
                    setDraftCourse({
                      ...draftCourse,
                      course: { ...draftCourse.course, coverImage: e.target.value },
                    })
                  }
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-cyan-500"
                />
                {draftCourse.course.coverImage && (
                  <button
                    type="button"
                    onClick={() =>
                      setDraftCourse({
                        ...draftCourse,
                        course: { ...draftCourse.course, coverImage: '' },
                      })
                    }
                    title="Limpiar portada"
                    className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-rose-400 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              {draftCourse.course.coverImage && (
                <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-950 border border-slate-800 mt-2">
                  <img
                    src={draftCourse.course.coverImage}
                    alt="Vista previa de portada"
                    className="w-32 h-20 rounded-lg object-cover border border-cyan-500/30 shrink-0"
                  />
                  <div className="text-xs text-slate-400 leading-relaxed">
                    <span className="text-cyan-400 font-bold block mb-0.5">Vista previa de portada activa</span>
                    Diseño temático adaptado al curso con el emblema y colores configurados en el plugin de personalización.
                  </div>
                </div>
              )}
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
          <div className="flex items-center justify-between pt-4 border-t border-slate-800 flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setCurrentStep(2)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-slate-400 hover:text-white text-sm transition"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Atrás</span>
            </button>
            <div className="flex items-center gap-4 flex-wrap">
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={publishImmediately}
                  onChange={(e) => setPublishImmediately(e.target.checked)}
                  className="accent-[#06b6d4] w-4 h-4 rounded cursor-pointer"
                />
                <span>Publicar inmediatamente</span>
              </label>

              <button
                type="button"
                onClick={handleSaveDraftCourse}
                disabled={savingCourse}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm transition shadow-lg shadow-emerald-600/20 disabled:opacity-50"
              >
                {savingCourse ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{publishImmediately ? 'Publicando...' : 'Guardando...'}</span>
                  </>
                ) : (
                  <>
                    {publishImmediately ? <Globe className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                    <span>{publishImmediately ? 'Guardar y Publicar Curso' : 'Guardar como Borrador en DocentOS'}</span>
                  </>
                )}
              </button>
            </div>
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
              {saveSuccess.published ? '¡Curso Creado y Publicado con Éxito!' : '¡Curso Creado Exitosamente!'}
            </h2>
            <p className="text-sm text-slate-400">
              El curso <span className="text-white font-semibold font-mono">"{saveSuccess.courseTitle}"</span> ha sido{' '}
              {saveSuccess.published ? (
                <strong className="text-emerald-400">PUBLICADO</strong>
              ) : (
                <strong className="text-amber-400">guardado como BORRADOR</strong>
              )}{' '}
              en DocentOS.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-400 text-left space-y-2">
            <p>✅ Videos vinculados con reproducción nativa sin cookies de YouTube</p>
            <p>✅ Módulos y lecciones sincronizados en PostgreSQL</p>
            <p>
              {saveSuccess.published
                ? '✅ Visible inmediatamente para todos los estudiantes en el Catálogo'
                : '✅ Solo los mentores y administradores pueden verlo mientras esté en borrador'}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            {!saveSuccess.published ? (
              <button
                type="button"
                onClick={handlePublishNow}
                disabled={publishing}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition flex items-center justify-center gap-2"
              >
                {publishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
                <span>Publicar Ahora en el Catálogo</span>
              </button>
            ) : null}
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-sm font-semibold transition"
              >
                Cerrar y Volver
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
