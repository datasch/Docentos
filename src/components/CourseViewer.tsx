/**
 * Reproductor de curso.
 *
 * Reparte la vista en dos: el video y su identidad a la izquierda, y a la
 * derecha un solo panel con pestanas donde conviven temario, notas y mentoria.
 * Antes esos tres bloques se apilaban en vertical, lo que dejaba una columna
 * vacia en escritorio y enterraba el video bajo el temario en movil.
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Award,
  CheckSquare,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Home,
  ListTree,
  Lock,
  MessageSquare,
  Minimize2,
  ShieldCheck,
  Radio,
  Video,
  ExternalLink,
  Calendar,
  Play,
  PlaySquare,
} from 'lucide-react';
import { api } from '../lib/api';
import {
  countCompleted,
  findResumePosition,
  flattenLessons,
  indexOfLesson,
  isModuleOpen,
  moduleLockStates,
  stepLesson,
} from '../lib/courseNavigation';
import { Course, VideoDriveLink, MentorshipComment, User, TTSGuide, VideoNote, CertificateRecord, Meeting } from '../types';
import { MentorTTSGuideWidget } from './MentorTTSGuideWidget';
import { parseVideoSource } from '../lib/videoParser';
import { pluginManager } from '../plugins/PluginManager';
import { syncModuleQuizzes, getModuleQuestions } from '../plugins/QuizzesPlugin';
import { downloadCertificate } from '../plugins/CertificateGenerator';
import { ModuleQuizCard } from './ModuleQuizCard';
import { CertificateVerifyModal } from './CertificateVerifyModal';
import { CoursePanel, PanelTabId } from './course/CoursePanel';
import { SyllabusTree } from './course/SyllabusTree';
import { NotesPanel } from './course/NotesPanel';
import { MentorshipPanel } from './course/MentorshipPanel';
import { LessonMetaBar, MobileLessonBar } from './course/LessonMetaBar';

interface CourseViewerProps {

  course: Course;
  currentUser: User;
  hasAccess: boolean;
  onOpenPaywall: () => void;
  /** Catálogo al que puede cambiar el alumno sin salir del reproductor. */
  courses?: Course[];
  onSelectCourse?: (course: Course) => void;
  onGoHome?: () => void;
}

/**
 * De donde sale el video, dicho para el alumno.
 *
 * La lista de cursos no envia embedUrl ni driveFileId —y hace bien, porque eso
 * expondria la URL cruda del archivo—, envia `source`. Deducir el proveedor de
 * playbackUrl, que siempre apunta a nuestra propia ruta de acceso, hacia que
 * todo dijera «Reproductor embebido».
 */
const SOURCE_LABELS: Record<string, string> = {
  GOOGLE_DRIVE: 'Google Drive',
  EXTERNAL_URL: 'Video externo',
  DEMO: 'Contenido de demostración',
};

const PROVIDER_LABELS: Record<string, string> = {
  youtube: 'YouTube',
  drive: 'Google Drive',
  embed: 'Reproductor embebido',
};

/**
 * El diploma que corresponde al curso abierto, y solo ese.
 *
 * El progreso del alumno llega con todos sus certificados; quedarse con uno de
 * otro curso no era un adorno mal puesto: la tarjeta anunciaba «Curso
 * completado» bajo el título del curso que se estaba viendo y el botón de
 * descarga componía el PDF con ese título y el código de verificación ajeno, un
 * diploma que no corresponde a nada.
 */
/**
 * Los cursos entre los que se puede saltar desde el selector de la cabecera.
 *
 * Solo los que esa persona puede abrir. Ofrecer el catalogo entero hacia que
 * elegir un curso ajeno llevara a una pantalla bloqueada: el desplegable
 * prometia una navegacion que no existia.
 *
 * El curso abierto se mantiene siempre, aunque no se tenga acceso: se llega a
 * el desde la portada para verlo por fuera, y quitarlo de su propio selector
 * dejaria la cabecera sin nombre.
 */
export function switchableCourses<T extends { id: string; hasAccess?: boolean }>(
  courses: T[],
  currentCourseId: string,
): T[] {
  return courses.filter((course) => course.hasAccess === true || course.id === currentCourseId);
}

export function certificateForCourse(
  certificate: CertificateRecord | null | undefined,
  courseId: string,
): CertificateRecord | null {
  return certificate && certificate.courseId === courseId ? certificate : null;
}

export const CourseViewer: React.FC<CourseViewerProps> = ({
  course,
  currentUser,
  hasAccess,
  onOpenPaywall,
  courses = [],
  onSelectCourse,
  onGoHome,
}) => {
  const [activeModuleIndex, setActiveModuleIndex] = useState(0);
  const [activeVideoIndex, setActiveVideoIndex] = useState(0);
  // Mientras nadie elija lección a mano, el curso se abre por donde se dejó.
  const [pickedByUser, setPickedByUser] = useState(false);
  const [activePanel, setActivePanel] = useState<PanelTabId>('syllabus');
  const [theaterMode, setTheaterMode] = useState(false);

  // Mentorship Q&A State
  const [comments, setComments] = useState<MentorshipComment[]>([]);
  const [newQuestion, setNewQuestion] = useState('');
  const [replyTextMap, setReplyTextMap] = useState<Record<string, string>>({});
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [filterMentorOnly, setFilterMentorOnly] = useState(false);
  const [loadingComments, setLoadingComments] = useState(false);

  // Gamified TTS Guide State
  const [currentTtsGuide, setCurrentTtsGuide] = useState<TTSGuide | null>(null);

  // Progress state
  const [completedVideos, setCompletedVideos] = useState<Record<string, boolean>>({});
  const [quizPassKey, setQuizPassKey] = useState<number>(0);
  const [certificate, setCertificate] = useState<CertificateRecord | null>(null);
  const [showVerifyModal, setShowVerifyModal] = useState(false);

  // Video Notes State
  const [videoNotes, setVideoNotes] = useState<VideoNote[]>([]);
  const [newNoteContent, setNewNoteContent] = useState('');
  const [noteTimestampStr, setNoteTimestampStr] = useState('01:30');

  // Live Meetings State (Plugin LiveMeetings)
  const [courseMeetings, setCourseMeetings] = useState<Meeting[]>([]);
  const [selectedMeetingPlayback, setSelectedMeetingPlayback] = useState<Meeting | null>(null);

  const currentModule = course.modules[activeModuleIndex] || course.modules[0];
  const currentVideo: VideoDriveLink | undefined = currentModule?.videos[activeVideoIndex];

  // Load saved user progress on mount
  useEffect(() => {
    setPickedByUser(false);
    setActiveModuleIndex(0);
    setActiveVideoIndex(0);
    setSelectedMeetingPlayback(null);
    // El diploma es de un curso concreto. Arrastrar el del curso anterior
    // mientras carga el progreso anuncia «Curso completado» nada más entrar.
    setCertificate(null);
    loadUserProgress();
  }, [course.id]);

  const loadUserProgress = async () => {
    try {
      const [res, pluginsRes] = await Promise.all([
        api.getProgress(),
        api.getPlugins().catch(() => null),
      ]);
      if (res.completedVideos) {
        setCompletedVideos(res.completedVideos);
      }
      // Siempre se asigna, también cuando no hay: `if (found)` dejaba en pie
      // el diploma del curso anterior, y la tarjeta lo anunciaba bajo el
      // título del curso abierto y con el código del otro.
      const found = res.certificates?.find((c) => c.courseId === course.id);
      setCertificate(found || null);

      if (pluginsRes?.plugins) {
        pluginManager.setPlugins(pluginsRes.plugins);
      }

      // Cargar reuniones sincrónicas y asincrónicas asociadas al curso
      try {
        const meetingsRes = await api.getMeetings({ courseId: course.id });
        if (meetingsRes.meetings) {
          setCourseMeetings(meetingsRes.meetings);
        }
      } catch {
        // En caso de que no haya reuniones o falle la red
      }
    } catch (error) {
      console.error('Error loading saved progress:', error);
    }
  };

  // Retomar donde se quedó: abrir siempre por la primera clase obliga a buscar
  // a mano por dónde iba uno, y en un curso de cincuenta lecciones eso es una
  // tarea. Solo actúa hasta que el alumno elige otra lección.
  useEffect(() => {
    if (pickedByUser) return;
    const resume = findResumePosition(course, completedVideos);
    if (!resume) return;
    setActiveModuleIndex(resume.moduleIndex);
    setActiveVideoIndex(resume.videoIndex);
  }, [course.id, completedVideos, pickedByUser]);

  /** El filtro del plugin de exámenes, que es independiente del curso. */
  const isQuizGateOpen = (moduleIndex: number) =>
    pluginManager.isModuleUnlocked(course.modules, moduleIndex, currentUser.id);

  // Estado del temario: qué módulos están abiertos y por qué no lo están los
  // demás. Se calcula aquí una sola vez para que el temario, las flechas del
  // reproductor y el salto automático al marcar una clase digan lo mismo.
  // `quizPassKey` entra en las dependencias porque aprobar un examen abre el
  // módulo siguiente sin que cambie ninguna otra pieza del estado.
  const moduleLocks = useMemo(
    () => moduleLockStates(course, completedVideos, isQuizGateOpen),
    [course, completedVideos, currentUser.id, quizPassKey],
  );

  /** Los cursos entre los que ofrece saltar la cabecera: solo los suyos. */
  const switchable = useMemo(() => switchableCourses(courses, course.id), [courses, course.id]);

  const openLesson = (moduleIndex: number, videoIndex: number) => {
    setSelectedMeetingPlayback(null);
    setPickedByUser(true);
    setActiveModuleIndex(moduleIndex);
    setActiveVideoIndex(videoIndex);
  };

  const goToLesson = (moduleIndex: number, videoIndex: number) => {
    // El temario no ofrece las lecciones de un módulo cerrado, pero las flechas
    // y el avance automático sí pueden apuntar a una: aquí se para el salto.
    if (!isModuleOpen(moduleLocks, moduleIndex)) return;
    openLesson(moduleIndex, videoIndex);
  };

  const lessons = flattenLessons(course);
  const currentLessonIndex = indexOfLesson(lessons, {
    moduleIndex: activeModuleIndex,
    videoIndex: activeVideoIndex,
  });
  const previousLesson = stepLesson(course, { moduleIndex: activeModuleIndex, videoIndex: activeVideoIndex }, -1);
  const rawNextLesson = stepLesson(course, { moduleIndex: activeModuleIndex, videoIndex: activeVideoIndex }, 1);
  // Hacia atrás siempre hay paso: lo ya abierto no se vuelve a cerrar. Hacia
  // delante, la siguiente lección puede caer en un módulo aún cerrado, y
  // entonces no hay a dónde ir: el botón se apaga como en el final del curso.
  const nextLesson = rawNextLesson && isModuleOpen(moduleLocks, rawNextLesson.moduleIndex) ? rawNextLesson : null;

  // Calculate overall course progress metrics
  const totalCourseVideos = course.modules.reduce((acc, m) => acc + m.videos.length, 0);
  const completedCourseVideos = countCompleted(course, completedVideos);
  const courseProgressPct = totalCourseVideos > 0 ? Math.round((completedCourseVideos / totalCourseVideos) * 100) : 0;

  // Fetch comments, TTS guides & Video Notes when video changes
  useEffect(() => {
    if (currentVideo?.id) {
      loadComments(currentVideo.id);
      loadTtsGuide(currentVideo.id);
      loadVideoNotes(currentVideo.id);
    }
  }, [currentVideo?.id]);

  const loadVideoNotes = async (videoId: string) => {
    try {
      const res = await api.getVideoNotes(videoId);
      if (res.notes) setVideoNotes(res.notes);
    } catch (err) {
      console.error('Error loading video notes:', err);
    }
  };

  const parseTimestampToSeconds = (timeStr: string): number => {
    const parts = timeStr.split(':').map((p) => parseInt(p, 10));
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      return parts[0] * 60 + parts[1];
    }
    return 0;
  };

  const handleAddVideoNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteContent.trim() || !currentVideo?.id) return;

    const seconds = parseTimestampToSeconds(noteTimestampStr);
    try {
      const res = await api.addVideoNote(currentVideo.id, seconds, newNoteContent);
      if (res.note) {
        setVideoNotes([res.note, ...videoNotes]);
        setNewNoteContent('');
      }
    } catch (err) {
      console.error('Error saving video note:', err);
    }
  };

  const loadTtsGuide = async (videoId: string) => {
    try {
      const res = await api.getTTSGuides({ videoId });
      if (res.guides && res.guides.length > 0) {
        setCurrentTtsGuide(res.guides[0]);
      } else {
        setCurrentTtsGuide(null);
      }
    } catch (error) {
      console.error('Error loading video TTS guide:', error);
      setCurrentTtsGuide(null);
    }
  };


  const loadComments = async (videoId: string) => {
    setLoadingComments(true);
    try {
      const res = await api.getVideoComments(videoId);
      setComments(res.comments || []);
    } catch (error) {
      console.error('Error loading mentorship comments:', error);
    } finally {
      setLoadingComments(false);
    }
  };

  const handlePostQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuestion.trim() || !currentVideo?.id) return;

    try {
      const res = await api.addComment(currentVideo.id, newQuestion);
      if (res.comment) {
        setComments([res.comment, ...comments]);

        // Execute Plugin Hook
        pluginManager.onCommentSubmit(currentUser, {
          videoTitle: currentVideo.title,
          content: newQuestion,
        });

        setNewQuestion('');
      }
    } catch (error) {
      console.error('Error posting mentorship question:', error);
    }
  };

  const handlePostReply = async (commentId: string) => {
    const text = replyTextMap[commentId];
    if (!text || !text.trim()) return;

    try {
      const res = await api.replyToComment(commentId, text);
      if (res.reply) {
        setComments((prev) =>
          prev.map((c) => {
            if (c.id === commentId) {
              return {
                ...c,
                isResolved: true,
                replies: [...(c.replies || []), res.reply],
              };
            }
            return c;
          })
        );
        setReplyTextMap((prev) => ({ ...prev, [commentId]: '' }));
        setReplyingToId(null);
      }
    } catch (error) {
      console.error('Error submitting reply:', error);
    }
  };

  const handleLikeComment = async (commentId: string) => {
    try {
      const res = await api.likeComment(commentId);
      if (res.success) {
        setComments((prev) =>
          prev.map((c) => (c.id === commentId ? { ...c, likes: res.likes } : c))
        );
      }
    } catch (error) {
      console.error('Error liking comment:', error);
    }
  };

  const toggleVideoCompletion = async (videoId: string) => {
    const isCompleted = !completedVideos[videoId];
    const newCompletedMap = { ...completedVideos, [videoId]: isCompleted };
    setCompletedVideos(newCompletedMap);

    try {
      const res = await api.toggleProgress(videoId, isCompleted);
      if (res.certificate) {
        setCertificate(res.certificate);
      }

      if (isCompleted && currentVideo) {
        // Trigger Plugin Hook for Lesson Complete
        pluginManager.onLessonComplete(currentUser, currentVideo);

        // Check if course reached 100% completion
        const completedCount = Object.keys(newCompletedMap).filter((id) => newCompletedMap[id]).length;
        if (totalCourseVideos > 0 && completedCount === totalCourseVideos) {
          pluginManager.onCourseComplete(currentUser, course);
        }

        // Dar una clase por terminada es decir «sigo»: quedarse en el video ya
        // visto obliga a buscar el siguiente a mano en cada lección. Solo
        // avanza al marcar la clase que se está viendo, no al marcar otra
        // cualquiera desde el temario, y nunca al desmarcar.
        //
        // El destino se recalcula con el progreso recién guardado: marcar la
        // última clase de un módulo es justo lo que abre el siguiente, y
        // `nextLesson` todavía lo ve cerrado.
        const target = stepLesson(course, { moduleIndex: activeModuleIndex, videoIndex: activeVideoIndex }, 1);
        const locksAfterMarking = moduleLockStates(course, newCompletedMap, isQuizGateOpen);
        if (videoId === currentVideo.id && target && isModuleOpen(locksAfterMarking, target.moduleIndex)) {
          openLesson(target.moduleIndex, target.videoIndex);
        }
      }
    } catch (error) {
      console.error('Error toggling video progress:', error);
    }
  };

  const filteredComments = filterMentorOnly
    ? comments.filter((c) => c.isMentorResponse || (c.replies && c.replies.some((r) => r.isMentorResponse)))
    : comments;

  // La fuente que se reproduce: si el alumno seleccionó una grabación asincrónica,
  // la reproducimos directamente; de lo contrario cargamos la clase del temario.
  const videoSource = selectedMeetingPlayback
    ? parseVideoSource(selectedMeetingPlayback.recordingUrl || selectedMeetingPlayback.meetingUrl)
    : currentVideo
      ? parseVideoSource(currentVideo.playbackUrl || currentVideo.embedUrl || currentVideo.driveFileId)
      : null;

  const providerLabel = selectedMeetingPlayback
    ? 'Grabación Asincrónica'
    : currentVideo
      ? SOURCE_LABELS[currentVideo.source || ''] ||
      PROVIDER_LABELS[currentVideo.provider || parseVideoSource(currentVideo.embedUrl || currentVideo.driveFileId || '').provider] ||
      'Video'
      : 'Video';

  // Última barrera: aunque alguna respuesta traiga un certificado de otro
  // curso, de aquí no pasa a la pantalla.
  const courseCertificate = certificateForCourse(certificate, course.id);

  const isCurrentCompleted = Boolean(currentVideo && completedVideos[currentVideo.id]);
  const showsPlayer = hasAccess && (Boolean(currentVideo) || Boolean(selectedMeetingPlayback));
  const showsQuiz = hasAccess && pluginManager.isEnabled('interactive-quizzes') && Boolean(currentModule);
  const showsCertificate =
    hasAccess && pluginManager.isEnabled('pdf-certificates') && (courseProgressPct === 100 || Boolean(courseCertificate));
  const showsExtras = showsQuiz || showsCertificate;

  // Live and synchronous meetings calculation
  const activeLiveMeeting = useMemo(() => {
    // Si el video actual está configurado directamente como clase en vivo sincrónica
    if (currentVideo?.isLive && (currentVideo.meetingType === 'meet' || currentVideo.meetingType === 'jitsi')) {
      return {
        id: currentVideo.id,
        title: currentVideo.title,
        description: currentVideo.description,
        meetingType: currentVideo.meetingType,
        meetingUrl: currentVideo.meetingUrl || currentVideo.embedUrl || '',
        isLive: true,
        scheduledAt: currentVideo.scheduledAt || new Date().toISOString(),
      };
    }
    // Buscar si hay alguna reunión en vivo asociada a este curso
    const liveMeeting = courseMeetings.find((m) => m.isLive && (m.meetingType === 'meet' || m.meetingType === 'jitsi'));
    return liveMeeting || null;
  }, [courseMeetings, currentVideo]);

  const upcomingMeeting = useMemo(() => {
    if (activeLiveMeeting) return null;
    return courseMeetings.find((m) => !m.isLive && m.meetingType !== 'async_record');
  }, [courseMeetings, activeLiveMeeting]);

  return (
    <div className="animate-fade-in min-h-screen bg-canvas text-ink">
      <div className="mx-auto w-full max-w-[1800px] lg:px-6 lg:pt-6">

        {/* Ruta y cambio de curso. Sin esta fila, entrar en un curso encerraba
            al alumno dentro de él. */}
        <div className="flex items-center gap-2 px-4 py-3 lg:px-0 lg:pt-0">
          {onGoHome && (
            <button
              type="button"
              onClick={onGoHome}
              className="flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1.5 text-meta text-ink-muted transition-colors hover:text-ink"
            >
              <Home aria-hidden className="h-3.5 w-3.5" />
              Inicio
            </button>
          )}
          <span aria-hidden className="text-ink-faint">/</span>

          {switchable.length > 1 && onSelectCourse ? (
            <select
              value={course.id}
              onChange={(event) => {
                const selected = switchable.find((item) => item.id === event.target.value);
                if (selected) onSelectCourse(selected);
              }}
              aria-label="Cambiar de curso"
              className="min-w-0 max-w-[24rem] truncate rounded-lg bg-transparent px-1.5 py-1.5 text-meta font-medium text-ink hover:bg-raised focus:outline-none"
            >
              {switchable.map((item) => (
                <option key={item.id} value={item.id} className="bg-surface text-ink">
                  {item.title}
                </option>
              ))}
            </select>
          ) : (
            <span className="min-w-0 truncate px-1.5 text-meta font-medium text-ink">{course.title}</span>
          )}
        </div>

        <div className={`lg:grid lg:gap-6 ${theaterMode ? 'lg:grid-cols-1' : 'lg:grid-cols-12'}`}>

          {/* Columna del reproductor */}
          <div className={theaterMode ? '' : 'lg:col-span-8'}>
            {/* Banner Destacado de Clase Sincrónica En Vivo */}
            {hasAccess && activeLiveMeeting && (
              <div className="mb-4 mx-4 lg:mx-0 rounded-2xl border border-[var(--color-brand-cyan)] bg-surface p-4 shadow-xl shadow-[var(--color-brand-cyan)]/10 ring-1 ring-[var(--color-brand-cyan)]/30 animate-fade-in">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-brand-cyan)]/15 border border-[var(--color-brand-cyan)]/40 text-[var(--color-brand-cyan)]">
                      <Radio className="h-5 w-5 animate-pulse text-[var(--color-brand-cyan)]" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-brand-cyan)]/20 px-2.5 py-0.5 text-micro font-bold uppercase tracking-wider text-[var(--color-brand-cyan)] border border-[var(--color-brand-cyan)]/50 animate-pulse-slow">
                          <span className="h-2 w-2 rounded-full bg-[var(--color-brand-cyan)] animate-ping" />
                          ¡CLASE EN VIVO!
                        </span>
                        <span className="text-micro font-bold uppercase tracking-wider text-ink-muted bg-raised px-2 py-0.5 rounded border border-line">
                          {activeLiveMeeting.meetingType === 'jitsi' ? 'Jitsi Meet' : 'Google Meet'}
                        </span>
                      </div>
                      <h2 className="mt-1 text-section font-bold text-ink leading-tight truncate">
                        {activeLiveMeeting.title}
                      </h2>
                      {activeLiveMeeting.description && (
                        <p className="mt-0.5 text-meta text-ink-muted line-clamp-1">
                          {activeLiveMeeting.description}
                        </p>
                      )}
                    </div>
                  </div>

                  <a
                    href={activeLiveMeeting.meetingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-brand-primary flex shrink-0 items-center gap-2 px-5 py-2.5 text-xs font-bold shadow-lg shadow-[var(--color-brand-cyan)]/25 hover:scale-[1.02] transition-transform"
                  >
                    <Video className="h-4 w-4" />
                    <span>Unirse a la clase en vivo</span>
                    <ExternalLink className="h-3.5 w-3.5 opacity-80" />
                  </a>
                </div>
              </div>
            )}

            {/* Aviso de Próxima Clase Sincrónica Programada */}
            {hasAccess && !activeLiveMeeting && upcomingMeeting && (
              <div className="mb-3 mx-4 lg:mx-0 rounded-xl border border-line bg-card p-3 flex items-center justify-between gap-3 text-meta animate-fade-in">
                <div className="flex items-center gap-2.5 min-w-0">
                  <Calendar className="h-4 w-4 shrink-0 text-brand-purple" />
                  <div className="min-w-0">
                    <span className="font-semibold text-ink truncate block">
                      Próxima clase sincrónica: {upcomingMeeting.title}
                    </span>
                    <span className="text-micro text-ink-muted">
                      Programada para {new Date(upcomingMeeting.scheduledAt).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}
                    </span>
                  </div>
                </div>
                <a
                  href={upcomingMeeting.meetingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 px-3 py-1.5 rounded-lg bg-raised border border-line hover:border-brand-cyan text-micro font-bold text-ink-soft hover:text-ink transition-colors flex items-center gap-1"
                >
                  <span>Ver enlace</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}

            {hasAccess && currentTtsGuide && (
              <div className="px-4 pb-3 lg:px-0">
                <MentorTTSGuideWidget
                  guide={currentTtsGuide}
                  onRewardEarned={(xp) => {
                    console.log(`Earned ${xp} XP for completing TTS guide!`);
                  }}
                />
              </div>
            )}

            <div className="group relative mx-auto aspect-video w-full overflow-hidden bg-canvas lg:w-[min(100%,calc((100dvh-9.5rem)*16/9))] lg:rounded-2xl">
              {showsPlayer && videoSource ? (
                <iframe
                  /* La clave fuerza un iframe nuevo por lección o reunión grabada. */
                  key={selectedMeetingPlayback ? selectedMeetingPlayback.id : videoSource.embedUrl}
                  src={videoSource.embedUrl}
                  title={selectedMeetingPlayback ? selectedMeetingPlayback.title : (currentVideo?.title || 'Video')}
                  className="h-full w-full border-0"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
                  allowFullScreen
                />
              ) : hasAccess ? (
                /* Con acceso concedido y sin clase que reproducir, el curso
                   esta vacio o la leccion no tiene video utilizable. Antes
                   estos casos caian en el panel del candado y el alumno leia
                   «requiere acceso» teniendo el acceso: el mensaje mandaba a
                   pagar algo que ya tenia. */
                <div className="flex h-full flex-col items-center justify-center gap-4 bg-surface px-6 text-center">
                  <ListTree aria-hidden className="h-7 w-7 text-ink-muted" />
                  <div>
                    <h2 className="text-section font-semibold text-ink">
                      {currentVideo ? 'Esta clase todavía no tiene video' : 'Este curso todavía no tiene clases'}
                    </h2>
                    <p className="mx-auto mt-1.5 max-w-sm text-meta leading-relaxed text-ink-muted">
                      {currentVideo
                        ? 'Tu acceso está activo. Falta enlazar el video de esta clase.'
                        : 'Tu acceso está activo. Aún no se ha publicado ningún módulo en este curso.'}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-4 bg-surface px-6 text-center">
                  <Lock aria-hidden className="h-7 w-7 text-ink-muted" />
                  <div>
                    <h2 className="text-section font-semibold text-ink">Esta clase requiere acceso</h2>
                    <p className="mx-auto mt-1.5 max-w-sm text-meta leading-relaxed text-ink-muted">
                      Con el curso activo se abren los videos, las notas y la mentoría.
                    </p>
                  </div>
                  <button type="button" onClick={onOpenPaywall} className="btn-brand-primary px-5 py-2.5 text-meta">
                    Ver opciones de acceso
                  </button>
                </div>
              )}

              {/* Salida del modo cine sobre el propio video */}
              {showsPlayer && theaterMode && (
                <button
                  type="button"
                  onClick={() => setTheaterMode(false)}
                  className="pointer-events-auto absolute top-3 right-3 hidden items-center gap-1.5 rounded-lg bg-canvas/70 px-3 py-2 text-meta text-ink opacity-0 backdrop-blur-sm transition-opacity duration-150 group-focus-within:opacity-100 group-hover:opacity-100 lg:flex"
                >
                  <Minimize2 aria-hidden className="h-4 w-4" />
                  Salir del modo cine
                </button>
              )}

              {/* Avanzar sin salir del video (solo en modo lecciones estándar) */}
              {showsPlayer && !selectedMeetingPlayback && (
                <div className="pointer-events-none absolute inset-x-0 top-1/2 hidden -translate-y-1/2 justify-between px-3 opacity-0 transition-opacity duration-150 group-focus-within:opacity-100 group-hover:opacity-100 lg:flex">
                  {previousLesson ? (
                    <button
                      type="button"
                      onClick={() => goToLesson(previousLesson.moduleIndex, previousLesson.videoIndex)}
                      aria-label="Lección anterior"
                      className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full bg-canvas/70 text-ink backdrop-blur-sm transition-colors hover:bg-canvas"
                    >
                      <ChevronLeft aria-hidden className="h-5 w-5" />
                    </button>
                  ) : (
                    <span />
                  )}
                  {nextLesson && (
                    <button
                      type="button"
                      onClick={() => goToLesson(nextLesson.moduleIndex, nextLesson.videoIndex)}
                      aria-label="Lección siguiente"
                      className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full bg-canvas/70 text-ink backdrop-blur-sm transition-colors hover:bg-canvas"
                    >
                      <ChevronRight aria-hidden className="h-5 w-5" />
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Barra de información de la lección o de la sesión asincrónica */}
            {selectedMeetingPlayback ? (
              <div className="mt-3 mx-4 lg:mx-0 rounded-2xl border border-success/40 bg-[#0a1210] p-4 text-meta shadow-xl shadow-emerald-500/10 animate-fade-in">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3.5">
                  <div className="flex items-start sm:items-center gap-3 min-w-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-success/20 text-success-light border border-success/30">
                      <PlaySquare className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1 rounded-full bg-success/20 px-2.5 py-0.5 text-micro font-bold uppercase tracking-wider text-success-light border border-success/30">
                          <PlaySquare className="h-3 w-3" />
                          Grabación Asincrónica
                        </span>
                        <span className="text-micro text-ink-muted font-medium">
                          {new Date(selectedMeetingPlayback.scheduledAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                        </span>
                      </div>
                      <h3 className="mt-1 font-bold text-sm text-ink truncate">
                        {selectedMeetingPlayback.title}
                      </h3>
                      {selectedMeetingPlayback.description && (
                        <p className="mt-0.5 text-xs text-ink-soft line-clamp-1">
                          {selectedMeetingPlayback.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
                    <a
                      href={selectedMeetingPlayback.recordingUrl || selectedMeetingPlayback.meetingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 rounded-lg bg-raised hover:bg-elevated border border-line text-xs font-semibold text-ink-soft hover:text-ink flex items-center gap-1.5 transition-colors"
                    >
                      <span>Abrir enlace externo</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                    <button
                      type="button"
                      onClick={() => setSelectedMeetingPlayback(null)}
                      className="btn-brand-primary px-3.5 py-1.5 rounded-lg text-xs font-bold"
                    >
                      Volver al Temario
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {currentVideo && (
                  <MobileLessonBar
                    lessonNumber={currentLessonIndex + 1}
                    totalLessons={lessons.length}
                    hasPrevious={Boolean(previousLesson)}
                    hasNext={Boolean(nextLesson)}
                    isCompleted={isCurrentCompleted}
                    onPrevious={() => previousLesson && goToLesson(previousLesson.moduleIndex, previousLesson.videoIndex)}
                    onNext={() => nextLesson && goToLesson(nextLesson.moduleIndex, nextLesson.videoIndex)}
                    onToggleComplete={() => toggleVideoCompletion(currentVideo.id)}
                  />
                )}

                {currentVideo && (
                  <LessonMetaBar
                    lessonTitle={currentVideo.title}
                    moduleTitle={currentModule?.title || ''}
                    moduleIndex={activeModuleIndex}
                    providerLabel={providerLabel}
                    lessonNumber={currentLessonIndex + 1}
                    totalLessons={lessons.length}
                    isCompleted={isCurrentCompleted}
                    onToggleComplete={() => toggleVideoCompletion(currentVideo.id)}
                    playbackUrl={showsPlayer ? currentVideo.playbackUrl : undefined}
                    isLive={Boolean(currentVideo.isLive || (activeLiveMeeting && activeLiveMeeting.id === currentVideo.id))}
                    meetingType={currentVideo.meetingType || activeLiveMeeting?.meetingType}
                    meetingUrl={currentVideo.meetingUrl || (activeLiveMeeting?.id === currentVideo.id ? activeLiveMeeting.meetingUrl : undefined)}
                  />
                )}

                {/* Notificación destacada cuando está en la última lección de un módulo con examen */}
                {(() => {
                  if (!currentModule || !currentModule.videos || currentModule.videos.length === 0) return null;
                  const isLastLesson = activeVideoIndex >= currentModule.videos.length - 1;
                  const modQuestions = getModuleQuestions(currentModule.id);
                  const hasQuiz = pluginManager.isEnabled('interactive-quizzes') && modQuestions && modQuestions.length > 0;

                  if (isLastLesson && hasQuiz) {
                    return (
                      <div className="mt-3 mx-4 lg:mx-0 p-4 rounded-2xl bg-gradient-to-r from-purple-950/90 via-indigo-950/90 to-[#141420] border border-purple-500/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xl shadow-purple-950/50">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="p-2.5 bg-purple-500/20 rounded-xl text-amber-300 shrink-0 border border-purple-500/30">
                            <Award className="w-5 h-5" />
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-xs font-extrabold text-white flex flex-wrap items-center gap-2">
                              <span>🎯 ¡Última lección del módulo!</span>
                              <span className="text-[10px] bg-purple-500/30 text-purple-300 border border-purple-500/40 px-2 py-0.5 rounded-full font-black uppercase tracking-wider">
                                Examen Requerido
                              </span>
                            </h4>
                            <p className="text-[11px] text-slate-300 mt-0.5">
                              Has llegado a la última clase de <strong className="text-white">"{currentModule.title}"</strong>. Realiza la evaluación para validar tu progreso.
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const el = document.getElementById('module-quiz-section');
                            if (el) el.scrollIntoView({ behavior: 'smooth' });
                          }}
                          className="btn-brand-primary px-4 py-2 text-xs font-black flex items-center gap-1.5 shrink-0 shadow-lg shadow-cyan-500/20 cursor-pointer"
                        >
                          <CheckSquare className="w-4 h-4 text-amber-300" />
                          <span>Ir al Examen ↓</span>
                        </button>
                      </div>
                    );
                  }
                  return null;
                })()}
              </>
            )}
          </div>

          {/* Panel lateral. En escritorio se posiciona en absoluto dentro de su
              celda para que la fila la marque el video y no el largo del
              temario; en móvil es un bloque de altura acotada. */}
          <div className={theaterMode ? 'lg:hidden' : 'lg:relative lg:col-span-4'}>
            <div className="h-[70dvh] px-4 lg:absolute lg:inset-0 lg:h-auto lg:px-0">
              <CoursePanel
                active={activePanel}
                onChange={setActivePanel}
                theaterMode={theaterMode}
                onToggleTheater={() => setTheaterMode(!theaterMode)}
                tabs={[
                  {
                    id: 'syllabus',
                    label: 'Temario',
                    icon: ListTree,
                    content: (
                      <div className="min-h-0 flex-1 overflow-y-auto">
                        <SyllabusTree
                          course={course}
                          hasAccess={hasAccess}
                          completedVideos={completedVideos}
                          activeModuleIndex={activeModuleIndex}
                          activeVideoIndex={activeVideoIndex}
                          moduleLocks={moduleLocks}
                          courseProgressPct={courseProgressPct}
                          completedCourseVideos={completedCourseVideos}
                          totalCourseVideos={totalCourseVideos}
                          onSelectLesson={goToLesson}
                          onToggleComplete={toggleVideoCompletion}
                          onOpenPaywall={onOpenPaywall}
                        />
                      </div>
                    ),
                  },
                  {
                    id: 'sessions',
                    label: 'Sesiones',
                    icon: Radio,
                    count: courseMeetings.length,
                    content: (
                      <div className="min-h-0 flex-1 overflow-y-auto p-4 space-y-4">
                        <div className="flex items-center justify-between pb-2 border-b border-line">
                          <div>
                            <h3 className="text-xs font-bold text-ink uppercase tracking-wider flex items-center gap-1.5">
                              <Radio className="h-3.5 w-3.5 text-brand-cyan" />
                              Clases Sincrónicas & Grabaciones
                            </h3>
                            <p className="text-micro text-ink-muted mt-0.5">
                              Sesiones en vivo y clases grabadas bajo demanda del curso.
                            </p>
                          </div>
                        </div>

                        {courseMeetings.length === 0 ? (
                          <div className="py-12 text-center space-y-2 bg-card rounded-xl border border-line p-4">
                            <Video className="h-8 w-8 mx-auto text-ink-faint" />
                            <p className="text-xs font-semibold text-ink">No hay sesiones programadas aún</p>
                            <p className="text-micro text-ink-muted">
                              Tu mentor programará clases sincrónicas y grabaciones en este espacio.
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-5">
                            {(() => {
                              const moduleGroups: { moduleId: string | null; moduleTitle: string; meetings: typeof courseMeetings }[] = [];
                              
                              (course.modules || []).forEach((mod, idx) => {
                                const modMeetings = courseMeetings.filter((m) => m.moduleId === mod.id);
                                if (modMeetings.length > 0) {
                                  moduleGroups.push({
                                    moduleId: mod.id,
                                    moduleTitle: `Módulo ${idx + 1}: ${mod.title}`,
                                    meetings: modMeetings,
                                  });
                                }
                              });

                              const unassignedMeetings = courseMeetings.filter(
                                (m) => !m.moduleId || !course.modules?.some((mod) => mod.id === m.moduleId)
                              );
                              if (unassignedMeetings.length > 0) {
                                moduleGroups.push({
                                  moduleId: null,
                                  moduleTitle: 'Sesiones Generales del Curso',
                                  meetings: unassignedMeetings,
                                });
                              }

                              return moduleGroups.map((group) => (
                                <div key={group.moduleId || 'general'} className="space-y-2.5">
                                  <div className="flex items-center gap-2 px-1">
                                    <span className="h-2 w-2 rounded-full bg-brand-cyan" />
                                    <h4 className="text-micro font-bold uppercase tracking-wider text-ink-soft">
                                      {group.moduleTitle}
                                    </h4>
                                    <span className="text-micro font-bold text-ink-faint bg-card border border-line px-1.5 py-0.2 rounded-full">
                                      {group.meetings.length}
                                    </span>
                                  </div>

                                  <div className="space-y-3">
                                    {group.meetings.map((m) => {
                                      const isLive = m.isLive;
                                      const isAsync = m.meetingType === 'async_record';
                                      const isPlayingThis = selectedMeetingPlayback?.id === m.id;

                                      return (
                                        <div
                                          key={m.id}
                                          className={`p-3.5 rounded-xl border transition-all space-y-2.5 ${isPlayingThis
                                              ? 'bg-success/10 border-success/50 shadow-md ring-1 ring-emerald-500/30'
                                              : isLive
                                                ? 'bg-surface border-brand-cyan shadow-md shadow-brand-cyan/10 ring-1 ring-brand-cyan/30'
                                                : 'bg-raised border-line hover:border-line-strong'
                                            }`}
                                        >
                                          <div className="flex items-start justify-between gap-2">
                                            <div className="flex flex-wrap items-center gap-1.5">
                                              {isLive ? (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-micro font-bold bg-danger/20 text-danger-light border border-danger/40 animate-pulse-slow">
                                                  <span className="h-1.5 w-1.5 rounded-full bg-danger animate-ping" />
                                                  EN VIVO
                                                </span>
                                              ) : isAsync ? (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-micro font-bold bg-success/10 text-success-light border border-success/30">
                                                  <PlaySquare className="h-3 w-3" />
                                                  Grabación Asincrónica
                                                </span>
                                              ) : (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-micro font-bold bg-brand-purple/10 text-brand-purple border border-brand-purple/30">
                                                  <Calendar className="h-3 w-3" />
                                                  Sincrónica
                                                </span>
                                              )}

                                              <span className="text-micro font-bold text-ink-muted uppercase bg-canvas px-1.5 py-0.5 rounded border border-line">
                                                {m.meetingType === 'jitsi'
                                                  ? 'Jitsi'
                                                  : m.meetingType === 'meet'
                                                    ? 'Meet'
                                                    : 'Video'}
                                              </span>
                                            </div>

                                            <span className="text-micro text-ink-muted">
                                              {new Date(m.scheduledAt).toLocaleDateString(undefined, {
                                                month: 'short',
                                                day: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit',
                                              })}
                                            </span>
                                          </div>

                                          <div>
                                            <h4 className="font-bold text-xs text-ink leading-snug">
                                              {m.title}
                                            </h4>
                                            {m.description && (
                                              <p className="text-micro text-ink-muted line-clamp-2 mt-0.5">
                                                {m.description}
                                              </p>
                                            )}
                                          </div>

                                          {/* Actions */}
                                          <div className="flex items-center gap-2 pt-1 border-t border-line/50">
                                            {isAsync ? (
                                              <>
                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    setSelectedMeetingPlayback(m);
                                                  }}
                                                  className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${isPlayingThis
                                                      ? 'bg-success text-black shadow-md'
                                                      : 'bg-success/15 hover:bg-success/25 border border-success/40 text-success-light'
                                                    }`}
                                                >
                                                  <Play className="h-3 w-3" />
                                                  <span>{isPlayingThis ? 'Reproduciendo Ahora' : 'Ver Grabación'}</span>
                                                </button>
                                                <a
                                                  href={m.recordingUrl || m.meetingUrl}
                                                  target="_blank"
                                                  rel="noopener noreferrer"
                                                  className="p-1.5 rounded-lg bg-canvas hover:bg-elevated border border-line text-ink-muted hover:text-ink"
                                                  title="Abrir enlace externo"
                                                >
                                                  <ExternalLink className="h-3.5 w-3.5" />
                                                </a>
                                              </>
                                            ) : (
                                              <a
                                                href={m.meetingUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className={`w-full px-3 py-1.5 rounded-lg text-xs font-bold text-center flex items-center justify-center gap-1.5 transition-all ${isLive
                                                    ? 'btn-brand-primary text-ink shadow-md'
                                                    : 'bg-raised hover:bg-line border border-line text-ink-soft hover:text-ink'
                                                  }`}
                                              >
                                                <Video className="h-3.5 w-3.5" />
                                                <span>{isLive ? 'Unirse a la Clase en Vivo' : 'Abrir Sala Sincrónica'}</span>
                                                <ExternalLink className="h-3 w-3 opacity-70" />
                                              </a>
                                            )}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              ));
                            })()}
                          </div>
                        )}
                      </div>
                    ),
                  },
                  {
                    id: 'notes',
                    label: 'Notas',
                    icon: Bookmark,
                    count: videoNotes.length,
                    content: (
                      <NotesPanel
                        notes={videoNotes}
                        hasAccess={hasAccess}
                        content={newNoteContent}
                        timestamp={noteTimestampStr}
                        onContentChange={setNewNoteContent}
                        onTimestampChange={setNoteTimestampStr}
                        onSubmit={handleAddVideoNote}
                      />
                    ),
                  },
                  {
                    id: 'mentorship',
                    label: 'Mentoría',
                    icon: MessageSquare,
                    count: comments.length,
                    content: (
                      <MentorshipPanel
                        comments={filteredComments}
                        currentUser={currentUser}
                        hasAccess={hasAccess}
                        filterMentorOnly={filterMentorOnly}
                        onToggleFilter={() => setFilterMentorOnly(!filterMentorOnly)}
                        question={newQuestion}
                        onQuestionChange={setNewQuestion}
                        onPostQuestion={handlePostQuestion}
                        replyTextMap={replyTextMap}
                        onReplyTextChange={(commentId, value) =>
                          setReplyTextMap({ ...replyTextMap, [commentId]: value })
                        }
                        replyingToId={replyingToId}
                        onStartReply={setReplyingToId}
                        onPostReply={handlePostReply}
                        onLike={handleLikeComment}
                      />
                    ),
                  },
                ]}
              />
            </div>
          </div>

          {/* Segunda fila: lo que se gana al terminar. Queda bajo el video y
              nunca compite con él. Sin quiz ni diploma no se monta, para no
              dejar una banda de relleno vacía al pie de la página. */}
          {showsExtras && (
            <div id="module-quiz-section" className={`flex flex-col gap-4 px-4 py-4 lg:px-0 ${theaterMode ? '' : 'lg:col-span-8'}`}>
              {hasAccess && pluginManager.isEnabled('interactive-quizzes') && currentModule && (
                <ModuleQuizCard
                  key={currentModule.id}
                  module={currentModule}
                  user={currentUser}
                  onPassed={(score) => {
                    console.log(`Quiz passed with ${score}% score!`);
                    setQuizPassKey((prev) => prev + 1);
                  }}
                />
              )}

              {/* El diploma pertenece al final del curso: mostrarlo bajo cada lección
                anunciaba «Disponible» desde la primera clase. */}
              {hasAccess &&
                pluginManager.isEnabled('pdf-certificates') &&
                (courseProgressPct === 100 || courseCertificate) && (
                  <div className="flex flex-col gap-4 rounded-2xl border border-brand-yellow/40 bg-surface p-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3.5">
                      <Award aria-hidden className="h-7 w-7 shrink-0 text-brand-yellow" />
                      <div>
                        <h2 className="text-section font-semibold text-ink">Curso completado</h2>
                        <p className="mt-1 text-meta text-ink-muted">
                          Tu diploma de {course.title} está listo.
                          {courseCertificate?.verificationCode && (
                            <>
                              {' '}
                              Código{' '}
                              <span className="text-ink-soft tabular-nums">{courseCertificate.verificationCode}</span>.
                            </>
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      {courseCertificate?.verificationCode && (
                        <button
                          type="button"
                          onClick={() => setShowVerifyModal(true)}
                          className="flex items-center gap-1.5 rounded-lg bg-raised px-3.5 py-2.5 text-meta font-medium text-ink-soft transition-colors hover:bg-line hover:text-ink"
                        >
                          <ShieldCheck aria-hidden className="h-4 w-4" />
                          Verificar
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={async () => {
                          let cfg = pluginManager.getPlugin('pdf-certificates')?.config;
                          if (!cfg?.signatureImage && !cfg?.signatoryTitle) {
                            try {
                              const pRes = await api.getPlugins();
                              if (pRes?.plugins) {
                                pluginManager.setPlugins(pRes.plugins);
                                cfg = pluginManager.getPlugin('pdf-certificates')?.config;
                              }
                            } catch {
                              // Se mantiene la configuración en memoria si falla la llamada
                            }
                          }
                          const finalCfg = cfg || {};
                          await downloadCertificate({
                            studentName: currentUser.name,
                            courseTitle: course.title,
                            certificateId: courseCertificate?.verificationCode,
                            institutionName: finalCfg.institutionName || 'Academia Giantucchi',
                            signatoryTitle: finalCfg.signatoryTitle || 'Prof. Giancarlo Giantucchi - Mentor Director & Evaluador',
                            primaryColor: finalCfg.primaryColor || '#06b6d4',
                            badgeText: finalCfg.badgeText || 'Certificado de Excelencia Técnica',
                            backgroundColor: finalCfg.backgroundColor || 'dark',
                            institutionLogo: finalCfg.institutionLogo || '/logo.avif',
                            signatureImage: finalCfg.signatureImage || finalCfg.signature,
                            enableUniversitySignature: finalCfg.enableUniversitySignature ?? false,
                            universitySignatoryTitle: finalCfg.universitySignatoryTitle || 'Dirección Académica - Universidad / Instituto',
                            universitySignatureImage: finalCfg.universitySignatureImage,
                          });
                        }}
                        className="rounded-lg bg-brand-yellow px-4 py-2.5 text-meta font-semibold text-canvas transition-opacity hover:opacity-90"
                      >
                        Descargar diploma
                      </button>
                    </div>
                  </div>
                )}
            </div>
          )}

        </div>
      </div>

      {/* Certificate Public Verification Modal */}
      <CertificateVerifyModal
        isOpen={showVerifyModal}
        onClose={() => setShowVerifyModal(false)}
        initialCode={courseCertificate?.verificationCode}
      />
    </div>
  );
};
