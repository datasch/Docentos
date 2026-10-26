/**
 * Reproductor de curso.
 *
 * Reparte la vista en dos: el video y su identidad a la izquierda, y a la
 * derecha un solo panel con pestanas donde conviven temario, notas y mentoria.
 * Antes esos tres bloques se apilaban en vertical, lo que dejaba una columna
 * vacia en escritorio y enterraba el video bajo el temario en movil.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
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
  AlertCircle,
  Compass,
  X,
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
  LessonPosition,
} from '../lib/courseNavigation';
import { Course, VideoDriveLink, MentorshipComment, User, TTSGuide, VideoNote, CertificateRecord, Meeting } from '../types';
import { MentorTTSGuideWidget } from './MentorTTSGuideWidget';
import { parseVideoSource } from '../lib/videoParser';
import { pluginManager } from '../plugins/PluginManager';
import { syncModuleQuizCounts, getModuleQuestionCount, quizzesPluginEngine } from '../plugins/QuizzesPlugin';
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
  initialModuleIndex?: number;
  initialVideoIndex?: number;
  onBackToPath?: () => void;
  isModal?: boolean;
  onCloseModal?: () => void;
  /** Ocultar pestaña de Temario cuando ya existe la ruta de aprendizaje */
  hideSyllabus?: boolean;
  /** Ocultar bloque de certificado inferior para mostrarlo al final de la ruta */
  hideCertificate?: boolean;
  /** Callback cuando cambia la lección activa en reproducción */
  onActiveLessonChange?: (moduleIndex: number, videoIndex: number) => void;
  /** Callback para sincronizar cambios de progreso en tiempo real con vistas contenedoras (como la ruta de Constellation) */
  onProgressChange?: (completedMap: Record<string, boolean>) => void;
  /** Callback cuando se completa una lección y se avanza hacia la siguiente (para animar en ruta cósmica) */
  onLessonCompletedAndAdvance?: (nextTarget: LessonPosition | null) => void;
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
  initialModuleIndex,
  initialVideoIndex,
  onBackToPath,
  isModal = false,
  onCloseModal,
  hideSyllabus = false,
  hideCertificate = false,
  onActiveLessonChange,
  onProgressChange,
  onLessonCompletedAndAdvance,
}) => {
  const [activeModuleIndex, setActiveModuleIndex] = useState(initialModuleIndex ?? 0);
  const [activeVideoIndex, setActiveVideoIndex] = useState(initialVideoIndex ?? 0);
  // Mientras nadie elija lección a mano, el curso se abre por donde se dejó.
  const [pickedByUser, setPickedByUser] = useState(
    initialModuleIndex !== undefined || initialVideoIndex !== undefined,
  );
  const [activePanel, setActivePanel] = useState<PanelTabId>(hideSyllabus ? 'sessions' : 'syllabus');
  const [theaterMode, setTheaterMode] = useState(false);

  useEffect(() => {
    if (hideSyllabus && activePanel === 'syllabus') {
      setActivePanel('sessions');
    }
  }, [hideSyllabus, activePanel]);

  useEffect(() => {
    if (!isModal) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onCloseModal) {
        onCloseModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isModal, onCloseModal]);

  useEffect(() => {
    if (initialModuleIndex !== undefined && initialVideoIndex !== undefined) {
      setActiveModuleIndex(initialModuleIndex);
      setActiveVideoIndex(initialVideoIndex);
      setPickedByUser(true);
    }
  }, [initialModuleIndex, initialVideoIndex]);

  // Mentorship Q&A State
  const [comments, setComments] = useState<MentorshipComment[]>([]);
  const [newQuestion, setNewQuestion] = useState('');
  const [replyTextMap, setReplyTextMap] = useState<Record<string, string>>({});
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [filterMentorOnly, setFilterMentorOnly] = useState(false);
  const [loadingComments, setLoadingComments] = useState(false);
  /** Aviso cuando el servidor rechaza guardar el progreso de una clase. */
  const [progressError, setProgressError] = useState<string | null>(null);

  // Gamified TTS Guide State
  const [currentTtsGuide, setCurrentTtsGuide] = useState<TTSGuide | null>(null);

  // Progress state
  const [completedVideos, setCompletedVideos] = useState<Record<string, boolean>>({});
  const [watchedVideos, setWatchedVideos] = useState<Record<string, boolean>>({});
  const [quizPassKey, setQuizPassKey] = useState<number>(0);
  /**
   * Módulo cuyo examen ocupa ahora el escenario, o null mientras se ve clase.
   *
   * El examen dejó de ser una tarjeta permanente bajo el reproductor: se abre
   * desde el temario, como una lección más, y sustituye al video. Montado
   * siempre, su cronómetro corría durante la clase y el examen se entregaba
   * solo, en blanco, antes de que el alumno llegara a él.
   */
  const [examenModuleIndex, setExamenModuleIndex] = useState<number | null>(null);
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
    if (initialModuleIndex !== undefined || initialVideoIndex !== undefined) {
      setPickedByUser(true);
      setActiveModuleIndex(initialModuleIndex ?? 0);
      setActiveVideoIndex(initialVideoIndex ?? 0);
    } else {
      setPickedByUser(false);
      setActiveModuleIndex(0);
      setActiveVideoIndex(0);
    }
    setSelectedMeetingPlayback(null);
    setExamenModuleIndex(null);
    // El diploma es de un curso concreto. Arrastrar el del curso anterior
    // mientras carga el progreso anuncia «Curso completado» nada más entrar.
    setCertificate(null);
    loadUserProgress();
  }, [course.id, initialModuleIndex, initialVideoIndex]);

  /**
   * Cuántas preguntas tiene el examen de cada módulo del curso.
   *
   * Solo el recuento: el temario necesita saber qué módulos evalúan y el
   * candado necesita lo mismo. Antes esa respuesta salía de haber descargado el
   * examen entero del módulo abierto, así que las respuestas correctas estaban
   * en el navegador del alumno desde que entraba a la clase.
   */
  useEffect(() => {
    let vigente = true;
    Promise.all([api.getCourseQuizSummary(course.id), api.getCourseQuizAttempts(course.id)])
      .then(([res, attemptsRes]) => {
        if (!vigente) return;
        syncModuleQuizCounts(res.counts || {});
        quizzesPluginEngine.restoreAttempts(currentUser.id, attemptsRes.attempts, course.modules.map((module) => module.id));
        // Los candados dependen de qué módulos evalúan: recalcularlos.
        setQuizPassKey((prev) => prev + 1);
      })
      .catch(() => {
        if (vigente) syncModuleQuizCounts({});
      });
    return () => {
      vigente = false;
    };
  }, [course.id, currentUser.id]);

  const loadUserProgress = async () => {
    try {
      const [res, pluginsRes] = await Promise.all([
        api.getProgress(),
        api.getPlugins().catch(() => null),
      ]);
      if (res.completedVideos) {
        // Consistencia secuencial estricta: si existen lecciones avanzadas completadas,
        // todas las lecciones previas deben permanecer completadas (evita huecos huérfanos).
        const flatList = flattenLessons(course);
        let highestCompletedIdx = -1;
        flatList.forEach((l, idx) => {
          if (res.completedVideos[l.videoId]) {
            highestCompletedIdx = Math.max(highestCompletedIdx, idx);
          }
        });

        const healedCompleted: Record<string, boolean> = { ...res.completedVideos };
        const watchedMap: Record<string, boolean> = {};

        if (highestCompletedIdx >= 0) {
          for (let i = 0; i <= highestCompletedIdx; i++) {
            const vid = flatList[i].videoId;
            healedCompleted[vid] = true;
            watchedMap[vid] = true;
            if (currentUser?.id) {
              localStorage.setItem(getVideoWatchedKey(currentUser.id, vid), 'true');
            }
          }
        }
        Object.entries(res.completedVideos).forEach(([vid, done]) => {
          if (done) {
            healedCompleted[vid] = true;
            watchedMap[vid] = true;
            if (currentUser?.id) {
              localStorage.setItem(getVideoWatchedKey(currentUser.id, vid), 'true');
            }
          }
        });

        setCompletedVideos(healedCompleted);
        setWatchedVideos((prev) => ({ ...watchedMap, ...prev }));
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
    if (pickedByUser || initialModuleIndex !== undefined || initialVideoIndex !== undefined) return;
    const resume = findResumePosition(course, completedVideos);
    if (!resume) return;
    setActiveModuleIndex(resume.moduleIndex);
    setActiveVideoIndex(resume.videoIndex);
  }, [course.id, completedVideos, pickedByUser, initialModuleIndex, initialVideoIndex]);

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
    setExamenModuleIndex(null);
    setPickedByUser(true);
    setActiveModuleIndex(moduleIndex);
    setActiveVideoIndex(videoIndex);
    onActiveLessonChange?.(moduleIndex, videoIndex);
  };

  const goToLesson = (moduleIndex: number, videoIndex: number) => {
    // El temario no ofrece las lecciones de un módulo cerrado, pero las flechas
    // y el avance automático sí pueden apuntar a una: aquí se para el salto.
    if (!isModuleOpen(moduleLocks, moduleIndex)) return;
    openLesson(moduleIndex, videoIndex);
  };

  /** Abre el examen de un módulo en el escenario principal. */
  const abrirExamen = (moduleIndex: number) => {
    if (!isModuleOpen(moduleLocks, moduleIndex)) return;
    setSelectedMeetingPlayback(null);
    setPickedByUser(true);
    setActiveModuleIndex(moduleIndex);
    setExamenModuleIndex(moduleIndex);
  };

  const cerrarExamen = () => setExamenModuleIndex(null);

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

  // Persistencia de progreso de video por usuario y lección
  const getVideoTimeKey = (userId: string, videoId: string) => `docentos_video_time_${userId}_${videoId}`;
  const getVideoWatchedKey = (userId: string, videoId: string) => `docentos_video_watched_${userId}_${videoId}`;

  // Restaurar estado de video visto desde persistencia
  useEffect(() => {
    if (!currentVideo?.id || !currentUser?.id) return;
    const isSavedWatched = localStorage.getItem(getVideoWatchedKey(currentUser.id, currentVideo.id)) === 'true';
    if (isSavedWatched && !watchedVideos[currentVideo.id]) {
      setWatchedVideos((prev) => ({ ...prev, [currentVideo.id]: true }));
    }
  }, [currentVideo?.id, currentUser?.id]);

  // Segundo exacto donde el alumno dejó el video para no perder su progreso
  const savedVideoTime = useMemo(() => {
    if (!currentVideo?.id || !currentUser?.id) return 0;
    const val = Number(localStorage.getItem(getVideoTimeKey(currentUser.id, currentVideo.id)));
    return val > 3 ? Math.floor(val) : 0;
  }, [currentVideo?.id, currentUser?.id]);

  const toggleVideoCompletion = async (videoId: string, forceWatchBypass = false) => {
    // Al interactuar con el progreso, asegurar que la selección del usuario
    // quede fija y no sea sobrescrita por el useEffect de auto-resumen.
    setPickedByUser(true);
    const isCompleted = !completedVideos[videoId];

    // Validación estricta: para marcar una misión como completada el usuario DEBE
    // haber visto el video hasta el final y completado el examen si lo exige
    if (isCompleted && !forceWatchBypass) {
      const targetLessonIndex = lessons.findIndex((l) => l.videoId === videoId);
      const hasCompletedAfter =
        targetLessonIndex !== -1 &&
        lessons.slice(targetLessonIndex + 1).some((l) => Boolean(completedVideos[l.videoId]));

      const isWatched =
        watchedVideos[videoId] ||
        completedVideos[videoId] ||
        hasCompletedAfter ||
        localStorage.getItem(getVideoWatchedKey(currentUser.id, videoId)) === 'true';

      if (!isWatched) {
        setProgressError('Para completar esta misión debes ver el video de la clase hasta el final.');
        return;
      }

      if (currentModule && activeVideoIndex >= (currentModule.videos?.length || 1) - 1) {
        const hasQuiz = pluginManager.isEnabled('interactive-quizzes') && getModuleQuestionCount(currentModule.id) > 0;
        if (hasQuiz) {
          const attempt = quizzesPluginEngine.getUserAttempt(currentUser.id, currentModule.id);
          if (!attempt?.passed) {
            setProgressError('Para completar esta misión debes aprobar el examen interactivo del módulo.');
            return;
          }
        }
      }
    }

    // Al desmarcar una misión completada:
    if (!isCompleted) {
      // 1. Prohibir desmarcar si existen lecciones posteriores completadas en el curso.
      // La única forma de retroceder es desmarcando de una en una hacia atrás desde la última lección completada.
      const targetLessonIndex = lessons.findIndex((l) => l.videoId === videoId);
      if (targetLessonIndex !== -1) {
        const subsequentCompleted = lessons.slice(targetLessonIndex + 1).filter((l) => Boolean(completedVideos[l.videoId]));
        if (subsequentCompleted.length > 0) {
          setProgressError(
            'No puedes desmarcar esta misión porque tienes misiones posteriores completadas. Para retroceder, debes ir desmarcando de una en una hacia atrás desde la última lección completada.'
          );
          return;
        }
      }

      // 2. Si el video ya fue visto, se PRESERVA su estado visto para que al retroceder
      // el botón de marcar como completada esté inmediatamente disponible sin obligar a verlo de nuevo.
      localStorage.setItem(getVideoWatchedKey(currentUser.id, videoId), 'true');
      setWatchedVideos((prev) => ({ ...prev, [videoId]: true }));
    } else {
      localStorage.setItem(getVideoWatchedKey(currentUser.id, videoId), 'true');
      setWatchedVideos((prev) => ({ ...prev, [videoId]: true }));
    }

    const newCompletedMap = { ...completedVideos, [videoId]: isCompleted };
    const previousCompleted = completedVideos;
    setProgressError(null);
    setCompletedVideos(newCompletedMap);

    try {
      const res = await api.toggleProgress(videoId, isCompleted);
      if (res.certificate) {
        setCertificate(res.certificate);
      }

      if (onProgressChange) {
        onProgressChange(newCompletedMap);
      }

      if (isCompleted && currentVideo) {
        // Trigger Plugin Hook for Lesson Complete
        pluginManager.onLessonComplete(currentUser, currentVideo);

        // Check if course reached 100% completion
        const completedCount = Object.keys(newCompletedMap).filter((id) => newCompletedMap[id]).length;
        if (totalCourseVideos > 0 && completedCount === totalCourseVideos) {
          pluginManager.onCourseComplete(currentUser, course);
        }

        // Si se encuentra en el visor modal (Ruta Cósmica):
        // Se notifica el avance a la lección siguiente y se cierra el visor
        // para que el alumno pueda contemplar cómo el orbe celestial viaja
        // y entra con su estela cósmica en la siguiente misión, desplegándose automáticamente al llegar.
        if (isModal && onCloseModal) {
          const target = stepLesson(course, { moduleIndex: activeModuleIndex, videoIndex: activeVideoIndex }, 1);
          const locksAfterMarking = moduleLockStates(course, newCompletedMap, isQuizGateOpen);
          const nextTarget = target && isModuleOpen(locksAfterMarking, target.moduleIndex) ? target : null;

          if (onLessonCompletedAndAdvance) {
            onLessonCompletedAndAdvance(nextTarget);
          } else {
            setTimeout(() => {
              onCloseModal();
            }, 350);
          }
          return;
        }

        // Avanzar a la lección siguiente al completar
        const target = stepLesson(course, { moduleIndex: activeModuleIndex, videoIndex: activeVideoIndex }, 1);
        const locksAfterMarking = moduleLockStates(course, newCompletedMap, isQuizGateOpen);
        if (videoId === currentVideo.id && target && isModuleOpen(locksAfterMarking, target.moduleIndex)) {
          openLesson(target.moduleIndex, target.videoIndex);
        }
      }
    } catch (error) {
      console.error('Error toggling video progress:', error);
      setCompletedVideos(previousCompleted);
      setProgressError(
        isCompleted
          ? 'No se pudo guardar la clase como terminada. Revisa tu conexión e inténtalo otra vez.'
          : 'No se pudo desmarcar la clase. Revisa tu conexión e inténtalo otra vez.',
      );
    }
  };

  // Detección automática al terminar el video (YouTube IFrame API / evento ended)
  useEffect(() => {
    if (!currentVideo?.id) return;

    const handleWindowMessage = (event: MessageEvent) => {
      try {
        let data = event.data;
        if (typeof data === 'string') {
          try {
            data = JSON.parse(data);
          } catch {
            return;
          }
        }
        if (!data || typeof data !== 'object') return;

        // Detección exhaustiva para YouTube Player API:
        // 1. info === 0 (estado ENDED)
        // 2. info.playerState === 0 (estado ENDED en infoDelivery)
        // 3. currentTime >= duration - 2 (video completado al 99%+)
        const playerState = typeof data.info === 'object' ? data.info?.playerState : data.info;
        const currentTime = typeof data.info === 'object' ? data.info?.currentTime : undefined;
        const duration = typeof data.info === 'object' ? data.info?.duration : undefined;

        // Persistir el segundo donde el usuario va viendo el video
        if (typeof currentTime === 'number' && currentTime > 0) {
          localStorage.setItem(getVideoTimeKey(currentUser.id, currentVideo.id), String(Math.floor(currentTime)));
        }

        const isEnded =
          playerState === 0 ||
          (data?.event === 'onStateChange' && data?.info === 0) ||
          (typeof currentTime === 'number' && typeof duration === 'number' && duration > 0 && currentTime >= duration - 2);

        if (isEnded) {
          setWatchedVideos((prev) => ({ ...prev, [currentVideo.id]: true }));
          localStorage.setItem(getVideoWatchedKey(currentUser.id, currentVideo.id), 'true');
        }
      } catch {
        // Ignorar mensajes no compatibles
      }
    };

    window.addEventListener('message', handleWindowMessage);

    // Handshake periódico hacia iframes para activar la emisión de eventos de YouTube
    const handshakeInterval = setInterval(() => {
      const iframes = document.querySelectorAll('iframe');
      iframes.forEach((iframe) => {
        try {
          iframe.contentWindow?.postMessage(JSON.stringify({ event: 'listening' }), '*');
        } catch {
          // Ignorar restricciones cross-origin
        }
      });
    }, 1000);

    const videoEl = document.querySelector('video');
    const handleNativeEnded = () => {
      if (currentVideo) {
        setWatchedVideos((prev) => ({ ...prev, [currentVideo.id]: true }));
        localStorage.setItem(getVideoWatchedKey(currentUser.id, currentVideo.id), 'true');
      }
    };
    const handleNativeTimeUpdate = () => {
      if (!videoEl || !currentVideo) return;
      if (videoEl.currentTime > 0) {
        localStorage.setItem(getVideoTimeKey(currentUser.id, currentVideo.id), String(Math.floor(videoEl.currentTime)));
      }
      if (videoEl.duration > 0 && videoEl.currentTime >= videoEl.duration - 2) {
        setWatchedVideos((prev) => ({ ...prev, [currentVideo.id]: true }));
        localStorage.setItem(getVideoWatchedKey(currentUser.id, currentVideo.id), 'true');
      }
    };

    if (videoEl) {
      if (savedVideoTime > 3 && videoEl.currentTime === 0) {
        videoEl.currentTime = savedVideoTime;
      }
      videoEl.addEventListener('ended', handleNativeEnded);
      videoEl.addEventListener('timeupdate', handleNativeTimeUpdate);
    }

    return () => {
      window.removeEventListener('message', handleWindowMessage);
      clearInterval(handshakeInterval);
      if (videoEl) {
        videoEl.removeEventListener('ended', handleNativeEnded);
        videoEl.removeEventListener('timeupdate', handleNativeTimeUpdate);
      }
    };
  }, [currentVideo?.id, currentUser?.id, savedVideoTime]);

  const filteredComments = filterMentorOnly
    ? comments.filter((c) => c.isMentorResponse || (c.replies && c.replies.some((r) => r.isMentorResponse)))
    : comments;

  // La fuente que se reproduce: priorizar embedUrl directo con &start=${savedVideoTime} para reanudar donde se quedó
  const videoSource = useMemo(() => {
    if (selectedMeetingPlayback) {
      return parseVideoSource(selectedMeetingPlayback.recordingUrl || selectedMeetingPlayback.meetingUrl);
    }
    if (!currentVideo) return null;
    const parsed = parseVideoSource(currentVideo.embedUrl || currentVideo.driveFileId || currentVideo.playbackUrl);
    if (parsed && parsed.provider === 'youtube' && savedVideoTime > 3) {
      if (!parsed.embedUrl.includes('start=')) {
        parsed.embedUrl += `&start=${savedVideoTime}`;
      }
    }
    return parsed;
  }, [selectedMeetingPlayback, currentVideo, savedVideoTime]);

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

  // Solo se permite desmarcar si NO existen misiones posteriores completadas en el curso.
  // La ruta exige retroceder de una en una hacia atrás desde la última lección completada.
  const hasSubsequentCompleted = Boolean(
    currentLessonIndex !== -1 &&
    lessons.slice(currentLessonIndex + 1).some((l) => Boolean(completedVideos[l.videoId]))
  );
  const canUncompleteLesson = !hasSubsequentCompleted;

  // Validación estricta para desbloquear la misión:
  // 1. Debe haber visto el video completo (detectado automáticamente o persistido, o si ya tiene misiones posteriores completadas)
  // 2. Si la lección es la última del módulo y el módulo tiene cuestionario interactivo, debe haberlo aprobado.
  const isVideoWatched = Boolean(
    (currentVideo && (watchedVideos[currentVideo.id] || completedVideos[currentVideo.id])) ||
    (currentVideo && currentUser?.id && localStorage.getItem(getVideoWatchedKey(currentUser.id, currentVideo.id)) === 'true') ||
    hasSubsequentCompleted
  );
  const isLastLessonOfModule = Boolean(
    currentModule && currentModule.videos && activeVideoIndex >= currentModule.videos.length - 1
  );
  const moduleRequiresQuiz = Boolean(
    pluginManager.isEnabled('interactive-quizzes') &&
    currentModule &&
    getModuleQuestionCount(currentModule.id) > 0
  );
  const isQuizPassed = Boolean(
    !moduleRequiresQuiz ||
    (currentModule && currentUser?.id && quizzesPluginEngine.getUserAttempt(currentUser.id, currentModule.id)?.passed)
  );
  const canCompleteLesson = isVideoWatched && (!isLastLessonOfModule || isQuizPassed);
  const lessonLockedReason: 'video' | 'quiz' = !isVideoWatched ? 'video' : !isQuizPassed ? 'quiz' : 'video';
  const examenActivo =
    examenModuleIndex !== null &&
    hasAccess &&
    pluginManager.isEnabled('interactive-quizzes') &&
    Boolean(course.modules[examenModuleIndex]);
  const moduloDelExamen = examenModuleIndex !== null ? course.modules[examenModuleIndex] : undefined;
  const showsCertificate =
    hasAccess && pluginManager.isEnabled('pdf-certificates') && (courseProgressPct === 100 || Boolean(courseCertificate));
  // El examen ya no vive aquí abajo: lo único que queda bajo el video es el
  // diploma, y sin él esta fila no se monta para no dejar una banda vacía.
  const showsExtras = !hideCertificate && showsCertificate;

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

  const viewerBody = (
    <>
      {progressError && (
        <div
          role="alert"
          className="mx-4 mb-2 flex items-start gap-2 rounded-xl border border-danger/30 bg-danger/10 p-3 text-meta text-danger lg:mx-0"
        >
          <AlertCircle aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{progressError}</span>
        </div>
      )}

      {/* Ruta y cambio de curso. Sin esta fila, entrar en un curso encerraba
          al alumno dentro de él. Se oculta en modo modal */}
      {!isModal && (
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
          {onGoHome && <span aria-hidden className="text-ink-faint">/</span>}

          {onBackToPath && (
            <>
              <button
                type="button"
                onClick={onBackToPath}
                className="flex shrink-0 items-center gap-1.5 rounded-xl bg-cyan-500/10 dark:bg-cyan-500/20 px-3 py-1.5 text-xs font-bold text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/25 active:scale-95 transition-all shadow-sm"
              >
                <Compass aria-hidden className="h-3.5 w-3.5" />
                <span>Volver a la Ruta</span>
              </button>
              <span aria-hidden className="text-ink-faint">/</span>
            </>
          )}

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
      )}

      <div className={`lg:grid lg:gap-6 ${theaterMode ? 'lg:grid-cols-1' : 'lg:grid-cols-12'}`}>

          {/* Columna del reproductor */}
          <div className={theaterMode ? '' : 'lg:col-span-8'}>
            {/* El examen ocupa el sitio del reproductor, con su propio scroll
                en escritorio para que la fila no crezca y el temario siga a la
                vista. Verlo debajo del video mientras corría la clase era leer
                las preguntas —y el cronómetro— antes de llegar a ellas. */}
            {examenActivo && moduloDelExamen && (
              <div className="px-4 pb-4 lg:max-h-[calc(100dvh-9.5rem)] lg:overflow-y-auto lg:px-0">
                <ModuleQuizCard
                  key={`${moduloDelExamen.id}-examen`}
                  module={moduloDelExamen}
                  courseId={course.id}
                  user={currentUser}
                  onExit={cerrarExamen}
                  onPassed={() => { setQuizPassKey((prev) => prev + 1); void loadUserProgress(); }}
                />
              </div>
            )}

            {!examenActivo && (
            <>
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

            <div className="group relative mx-auto aspect-video w-full overflow-hidden bg-black lg:w-[min(100%,calc((100dvh-9.5rem)*16/9))] lg:rounded-2xl">
              {showsPlayer && videoSource ? (
                <iframe
                  /* La clave fuerza un iframe nuevo por lección o reunión grabada. */
                  key={selectedMeetingPlayback ? selectedMeetingPlayback.id : videoSource.embedUrl}
                  src={videoSource.embedUrl}
                  title={selectedMeetingPlayback ? selectedMeetingPlayback.title : (currentVideo?.title || 'Video')}
                  className="h-full w-full border-0 bg-black"
                  style={{ backgroundColor: '#000000' }}
                  referrerPolicy="strict-origin-when-cross-origin"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; fullscreen; picture-in-picture; web-share"
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
                    canComplete={canCompleteLesson}
                    canUncomplete={canUncompleteLesson}
                    lockedReason={lessonLockedReason}
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
                    canComplete={canCompleteLesson}
                    canUncomplete={canUncompleteLesson}
                    lockedReason={lessonLockedReason}
                    onToggleComplete={() => toggleVideoCompletion(currentVideo.id)}
                    playbackUrl={showsPlayer ? (currentVideo.playbackUrl || videoSource?.originalUrl || (videoSource?.videoId ? `https://www.youtube.com/watch?v=${videoSource.videoId}` : undefined)) : undefined}
                    isLive={Boolean(currentVideo.isLive || (activeLiveMeeting && activeLiveMeeting.id === currentVideo.id))}
                    meetingType={currentVideo.meetingType || activeLiveMeeting?.meetingType}
                    meetingUrl={currentVideo.meetingUrl || (activeLiveMeeting?.id === currentVideo.id ? activeLiveMeeting.meetingUrl : undefined)}
                  />
                )}

                {/* Notificación destacada cuando está en la última lección de un módulo con examen */}
                {(() => {
                  if (!currentModule || !currentModule.videos || currentModule.videos.length === 0) return null;
                  const isLastLesson = activeVideoIndex >= currentModule.videos.length - 1;
                  const hasQuiz =
                    pluginManager.isEnabled('interactive-quizzes') && getModuleQuestionCount(currentModule.id) > 0;

                  if (isLastLesson && hasQuiz) {
                    return (
                      <div className="mt-3 mx-4 lg:mx-0 p-4 rounded-2xl bg-gradient-to-r from-purple-50 via-indigo-50/80 to-slate-50 dark:from-purple-950/90 dark:via-indigo-950/90 dark:to-[#141420] border border-purple-200 dark:border-purple-500/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg dark:shadow-xl dark:shadow-purple-950/50">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="p-2.5 bg-purple-500/10 dark:bg-purple-500/20 rounded-xl text-amber-500 dark:text-amber-300 shrink-0 border border-purple-400/30 dark:border-purple-500/30">
                            <Award className="w-5 h-5" />
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-xs font-extrabold text-slate-900 dark:text-white flex flex-wrap items-center gap-2">
                              <span>🎯 ¡Última lección del módulo!</span>
                              <span className="text-[10px] bg-purple-500/15 dark:bg-purple-500/30 text-purple-700 dark:text-purple-300 border border-purple-400/30 dark:border-purple-500/40 px-2 py-0.5 rounded-full font-black uppercase tracking-wider">
                                Examen Requerido
                              </span>
                            </h4>
                            <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5">
                              Has llegado a la última clase de <strong className="text-slate-900 dark:text-white">"{currentModule.title}"</strong>. Realiza la evaluación para validar tu progreso.
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => abrirExamen(activeModuleIndex)}
                          className="btn-brand-primary px-4 py-2 text-xs font-black flex items-center gap-1.5 shrink-0 shadow-lg shadow-cyan-500/20 cursor-pointer"
                        >
                          <CheckSquare className="w-4 h-4 text-amber-300" />
                          <span>Rendir el examen</span>
                        </button>
                      </div>
                    );
                  }
                  return null;
                })()}
              </>
            )}
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
                  ...(!hideSyllabus
                    ? [
                        {
                          id: 'syllabus' as const,
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
                                onOpenQuiz={abrirExamen}
                                quizOpenModuleIndex={examenActivo ? examenModuleIndex : null}
                                onToggleComplete={toggleVideoCompletion}
                                onOpenPaywall={onOpenPaywall}
                              />
                            </div>
                          ),
                        },
                      ]
                    : []),
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
            <div className={`flex flex-col gap-4 px-4 py-4 lg:px-0 ${theaterMode ? '' : 'lg:col-span-8'}`}>
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
    </>
  );

  if (isModal) {
    return createPortal(
      <div
        className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 dark:bg-black/85 p-2 sm:p-4 md:p-6 backdrop-blur-md animate-fade-in"
        onMouseDown={onCloseModal}
      >
        <div
          className="constellation-mission-modal relative flex max-h-[94vh] w-full max-w-7xl flex-col overflow-hidden rounded-3xl border border-slate-200/90 dark:border-purple-500/30 bg-white dark:bg-[#0d0a1a] shadow-2xl text-slate-900 dark:text-white transition-colors"
          onMouseDown={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
        >
          {/* Cabecera del Modal de Misión */}
          <header className="flex shrink-0 items-center justify-between border-b border-slate-200/80 dark:border-white/10 px-5 py-4 bg-slate-50/90 dark:bg-[#140e26] transition-colors">
            <div className="flex items-center gap-3 min-w-0">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-purple-500/10 dark:bg-purple-600/30 border border-purple-400/30 dark:border-purple-400/40 text-purple-600 dark:text-purple-300">
                <Play className="h-4 w-4 fill-current" />
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-cyan-600 dark:text-cyan-400">
                    {currentModule?.title || 'Misión'}
                  </span>
                  <span className="text-[10px] text-purple-600/80 dark:text-purple-300/70 font-semibold">
                    Lección {activeVideoIndex + 1} de {currentModule?.videos.length || 1}
                  </span>
                </div>
                <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate max-w-xl">
                  {currentVideo?.title}
                </h2>
              </div>
            </div>

            <button
              type="button"
              onClick={onCloseModal}
              className="p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-white/10 transition-colors cursor-pointer"
              aria-label="Cerrar visor de misión"
            >
              <X className="h-5 w-5" />
            </button>
          </header>

          {/* Contenido scrolleable del modal */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50/40 dark:bg-transparent">
            {viewerBody}
          </div>
        </div>

        {/* Certificate Public Verification Modal */}
        <CertificateVerifyModal
          isOpen={showVerifyModal}
          onClose={() => setShowVerifyModal(false)}
          initialCode={courseCertificate?.verificationCode}
        />
      </div>,
      document.body
    );
  }

  return (
    <div className="animate-fade-in min-h-screen bg-canvas text-ink">
      <div className="mx-auto w-full max-w-[1800px] lg:px-6 lg:pt-6">
        {viewerBody}
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
