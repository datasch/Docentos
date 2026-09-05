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
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Home,
  ListTree,
  Lock,
  MessageSquare,
  Minimize2,
  ShieldCheck,
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
import { Course, VideoDriveLink, MentorshipComment, User, TTSGuide, VideoNote, CertificateRecord } from '../types';
import { MentorTTSGuideWidget } from './MentorTTSGuideWidget';
import { parseVideoSource } from '../lib/videoParser';
import { pluginManager } from '../plugins/PluginManager';
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

  const currentModule = course.modules[activeModuleIndex] || course.modules[0];
  const currentVideo: VideoDriveLink | undefined = currentModule?.videos[activeVideoIndex];

  // Load saved user progress on mount
  useEffect(() => {
    setPickedByUser(false);
    setActiveModuleIndex(0);
    setActiveVideoIndex(0);
    // El diploma es de un curso concreto. Arrastrar el del curso anterior
    // mientras carga el progreso anuncia «Curso completado» nada más entrar.
    setCertificate(null);
    loadUserProgress();
  }, [course.id]);

  const loadUserProgress = async () => {
    try {
      const res = await api.getProgress();
      if (res.completedVideos) {
        setCompletedVideos(res.completedVideos);
      }
      // Siempre se asigna, también cuando no hay: `if (found)` dejaba en pie
      // el diploma del curso anterior, y la tarjeta lo anunciaba bajo el
      // título del curso abierto y con el código del otro.
      const found = res.certificates?.find((c) => c.courseId === course.id);
      setCertificate(found || null);
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

  const openLesson = (moduleIndex: number, videoIndex: number) => {
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

  // La fuente que se reproduce y la que da nombre al proveedor no son la misma:
  // playbackUrl apunta a /api/content/videos/<id>, que es nuestro control de
  // acceso y redirige al archivo. Deducir el proveedor de ahi hacia que todo
  // dijera «Reproductor embebido», incluidos los videos de Drive.
  const videoSource = currentVideo
    ? parseVideoSource(currentVideo.playbackUrl || currentVideo.embedUrl || currentVideo.driveFileId)
    : null;
  const providerLabel = currentVideo
    ? SOURCE_LABELS[currentVideo.source || ''] ||
      PROVIDER_LABELS[parseVideoSource(currentVideo.embedUrl || currentVideo.driveFileId || '').provider] ||
      'Video'
    : 'Video';
  // Última barrera: aunque alguna respuesta traiga un certificado de otro
  // curso, de aquí no pasa a la pantalla.
  const courseCertificate = certificateForCourse(certificate, course.id);

  const isCurrentCompleted = Boolean(currentVideo && completedVideos[currentVideo.id]);
  const showsPlayer = hasAccess && currentVideo;
  const showsQuiz = hasAccess && pluginManager.isEnabled('interactive-quizzes') && Boolean(currentModule);
  const showsCertificate =
    hasAccess && pluginManager.isEnabled('pdf-certificates') && (courseProgressPct === 100 || Boolean(courseCertificate));
  const showsExtras = showsQuiz || showsCertificate;

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

          {courses.length > 1 && onSelectCourse ? (
            <select
              value={course.id}
              onChange={(event) => {
                const selected = courses.find((item) => item.id === event.target.value);
                if (selected) onSelectCourse(selected);
              }}
              aria-label="Cambiar de curso"
              className="min-w-0 max-w-[24rem] truncate rounded-lg bg-transparent px-1.5 py-1.5 text-meta font-medium text-ink hover:bg-raised focus:outline-none"
            >
              {courses.map((item) => (
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

            {/* El ancho se limita a lo que cabe de alto: un 16:9 a ancho completo
                en una pantalla apaisada empuja el título de la clase fuera de la
                vista y obliga a hacer scroll para saber qué se está viendo.

                En móvil el reproductor NO se queda pegado arriba. Lo estuvo, y
                se comportaba mal: su contenedor solo llega hasta la barra de la
                lección, así que se despegaba a los pocos píxeles de scroll y en
                ese salto el iframe se quedaba en negro. Un video que se corta a
                media clase es peor que uno que sube con la página. */}
            <div className="group relative mx-auto aspect-video w-full overflow-hidden bg-canvas lg:w-[min(100%,calc((100dvh-9.5rem)*16/9))] lg:rounded-2xl">
              {showsPlayer && videoSource ? (
                <iframe
                  /* La clave fuerza un iframe nuevo por lección. Sin ella React
                     reutiliza el elemento y solo le cambia `src`, que el
                     navegador trata como navegación dentro del marco: el
                     reproductor se quedaba en blanco al saltar de clase. */
                  key={videoSource.embedUrl}
                  src={videoSource.embedUrl}
                  title={currentVideo.title}
                  className="h-full w-full border-0"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
                  allowFullScreen
                />
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

              {/* Salida del modo cine sobre el propio video: el interruptor del
                  panel no sirve para volver, porque el modo cine oculta el panel
                  que lo contiene. */}
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

              {/* Avanzar sin salir del video: los controles aparecen al apuntar
                  al reproductor y al tabular hasta ellos. */}
              {showsPlayer && (
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
              />
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
          <div className={`flex flex-col gap-4 px-4 py-4 lg:px-0 ${theaterMode ? '' : 'lg:col-span-8'}`}>
            {hasAccess && pluginManager.isEnabled('interactive-quizzes') && currentModule && (
              <ModuleQuizCard
                key={`${currentModule.id}_${quizPassKey}`}
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
                    onClick={() =>
                      downloadCertificate({
                        studentName: currentUser.name,
                        courseTitle: course.title,
                        certificateId: courseCertificate?.verificationCode,
                      })
                    }
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
