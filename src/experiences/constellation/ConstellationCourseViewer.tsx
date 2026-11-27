import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Home, Play } from 'lucide-react';
import { Course, User, Module, VideoDriveLink, CertificateRecord } from '../../types';
import { CourseViewer } from '../../components/CourseViewer';
import { ConstellationCosmicPath } from './ConstellationCosmicPath';
import { api } from '../../lib/api';
import { LESSON_FOCUS_EVENT, readLessonFocus, type LessonFocus } from '../../lib/useNotifications';
import { CourseShareButton } from '../../components/CourseShareButton';
import { CourseNpsModal } from '../../components/CourseNpsModal';
import { resolveCourseNpsStage, type CourseNpsStage } from '../../lib/courseNps';
import { syncModuleQuizCounts, quizzesPluginEngine, getModuleQuestionCount } from '../../plugins/QuizzesPlugin';
import { pluginManager } from '../../plugins/PluginManager';

interface ConstellationCourseViewerProps {
  course: Course;
  currentUser: User | null;
  hasAccess: boolean;
  onOpenPaywall: () => void;
  onGoHome: () => void;
  onSelectCourse?: (course: Course) => void;
  courses?: Course[];
}

// Verdadero solo hasta que el visor se monta por primera vez tras cargar la página (entrada directa o recarga).
let pageJustLoaded = true;

export const ConstellationCourseViewer: React.FC<ConstellationCourseViewerProps> = ({
  course: initialCourse,
  currentUser,
  hasAccess,
  onOpenPaywall,
  onGoHome,
  onSelectCourse,
  courses = [],
}) => {
  const { t } = useTranslation();
  const [course, setCourse] = useState<Course>(initialCourse);
  const [loadingCourse, setLoadingCourse] = useState<boolean>(
    !initialCourse.modules || initialCourse.modules.length === 0
  );
  const [isPlayerModalOpen, setIsPlayerModalOpen] = useState(false);
  const [selectedModuleIndex, setSelectedModuleIndex] = useState<number>(0);
  const [selectedVideoIndex, setSelectedVideoIndex] = useState<number>(0);
  /** Módulo cuyo examen se abre como lección propia (null: se abre un video). */
  const [examModuleIndex, setExamModuleIndex] = useState<number | null>(null);
  const [completedVideoIds, setCompletedVideoIds] = useState<string[]>([]);
  const [certificate, setCertificate] = useState<CertificateRecord | null>(null);
  const [progressLoaded, setProgressLoaded] = useState(false);
  const hasAutoNavigatedRef = useRef<string | null>(null);
  const [openedByReload] = useState(() => { const first = pageJustLoaded; pageJustLoaded = false; return first; });
  const [npsEligible, setNpsEligible] = useState(false);
  const [npsStatusLoaded, setNpsStatusLoaded] = useState(false);
  const [resolvedNpsStages, setResolvedNpsStages] = useState<CourseNpsStage[]>([]);
  const [activeNpsStage, setActiveNpsStage] = useState<CourseNpsStage | null>(null);
  const completedCountRef = useRef(0);
  const resolvedNpsStagesRef = useRef<CourseNpsStage[]>([]);
  const pendingNextLessonRef = useRef<{ moduleIndex: number; videoIndex: number } | null>(null);
  const pendingAutoStartRef = useRef(false);

  const effectiveUser: User = currentUser || {
    id: 'guest',
    name: t('estudiante', 'Estudiante'),
    email: 'estudiante@docentos.io',
    role: 'PUBLIC_USER',
    strikes: 0,
    isActive: true,
  };

  // Cargar detalles completos del curso (módulos, videos, recursos) solo si no vienen cargados
  useEffect(() => {
    let active = true;
    setCourse(initialCourse);

    const hasModules = initialCourse.modules && initialCourse.modules.length > 0;
    if (!hasModules) {
      setLoadingCourse(true);
      api.getCourse(initialCourse.id)
        .then((res) => {
          if (active && res?.course) {
            setCourse(res.course);
          }
        })
        .catch((err) => {
          console.error('Error al cargar detalles completos del curso:', err);
        })
        .finally(() => {
          if (active) setLoadingCourse(false);
        });
    } else {
      setLoadingCourse(false);
    }

    return () => {
      active = false;
    };
  }, [initialCourse]);

  // Lista plana de IDs de videos en orden secuencial del curso
  const allVideoIds = useMemo(() => {
    const ids: string[] = [];
    (course.modules || []).forEach((m) => {
      (m.videos || []).forEach((v) => ids.push(v.id));
    });
    return ids;
  }, [course.modules]);

  const loadProgress = async () => {
    try {
      const res = await api.getProgress();
      if (res?.completedVideos) {
        // Asegurar consistencia secuencial: si una lección avanzada está completada,
        // todas las lecciones previas en la ruta se consideran completadas.
        let highestCompletedIdx = -1;
        allVideoIds.forEach((id, idx) => {
          if (res.completedVideos[id]) {
            highestCompletedIdx = Math.max(highestCompletedIdx, idx);
          }
        });

        const courseVideoSet = new Set(allVideoIds);
        const completedSet = new Set<string>();
        if (highestCompletedIdx >= 0) {
          for (let i = 0; i <= highestCompletedIdx; i++) {
            completedSet.add(allVideoIds[i]);
          }
        }
        Object.entries(res.completedVideos).forEach(([id, done]) => {
          if (done && courseVideoSet.has(id)) completedSet.add(id);
        });

        const courseIds = Array.from(completedSet);
        completedCountRef.current = courseIds.length;
        setCompletedVideoIds(courseIds);
      }
      const found = res?.certificates?.find((c) => c.courseId === course.id);
      setCertificate(found || null);
    } catch {
      // Si falla la red o es modo invitado, mantiene estado local
    } finally {
      setProgressLoaded(true);
    }
  };

  const loadQuizzes = async () => {
    try {
      const [summaryRes, attemptsRes] = await Promise.all([
        api.getCourseQuizSummary(course.id).catch(() => null),
        api.getCourseQuizAttempts(course.id).catch(() => null),
      ]);
      if (summaryRes?.counts) {
        syncModuleQuizCounts(summaryRes.counts);
      }
      if (attemptsRes?.attempts) {
        quizzesPluginEngine.restoreAttempts(
          effectiveUser.id,
          attemptsRes.attempts,
          (course.modules || []).map((m) => m.id)
        );
      }
    } catch {
      // Si falla la red o es modo invitado, mantiene estado local
    }
  };

  useEffect(() => {
    loadProgress();
    loadQuizzes();
  }, [currentUser?.id, course.id, allVideoIds.length]);

  useEffect(() => {
    let active = true;
    setNpsStatusLoaded(false);
    setNpsEligible(false);
    resolvedNpsStagesRef.current = [];
    setResolvedNpsStages([]);
    setActiveNpsStage(null);
    pendingNextLessonRef.current = null;
    pendingAutoStartRef.current = false;

    const canAnswerSurvey = Boolean(currentUser && hasAccess);
    if (!canAnswerSurvey) {
      setNpsStatusLoaded(true);
      return;
    }

    api
      .getCourseNpsStatus(course.id)
      .then((res) => {
        if (!active) return;
        setNpsEligible(res.eligible);
        resolvedNpsStagesRef.current = res.resolvedStages;
        setResolvedNpsStages(res.resolvedStages);
      })
      .catch(() => {
        if (!active) return;
        setNpsEligible(false);
      })
      .finally(() => {
        if (active) setNpsStatusLoaded(true);
      });

    return () => {
      active = false;
    };
  }, [currentUser?.id, currentUser?.role, hasAccess, course.id]);

  const handleOpenLesson = (video: VideoDriveLink, module: Module) => {
    const modules = course.modules || [];
    const modIdx = modules.findIndex((m) => m.id === module.id);
    const resolvedModIdx = modIdx >= 0 ? modIdx : 0;
    const vidIdx = modules[resolvedModIdx]?.videos?.findIndex((v) => v.id === video.id) ?? 0;
    const resolvedVidIdx = vidIdx >= 0 ? vidIdx : 0;

    setSelectedModuleIndex(resolvedModIdx);
    setSelectedVideoIndex(resolvedVidIdx);
    setExamModuleIndex(null);
    setIsPlayerModalOpen(true);
  };

  /** Abre la lección «Examen» de un módulo: el visor empieza directamente en el examen. */
  const handleOpenExam = (module: Module) => {
    const modules = course.modules || [];
    const modIdx = modules.findIndex((m) => m.id === module.id);
    if (modIdx < 0) return;
    setSelectedModuleIndex(modIdx);
    setSelectedVideoIndex(Math.max(0, (modules[modIdx].videos?.length || 1) - 1));
    setExamModuleIndex(modIdx);
    setIsPlayerModalOpen(true);
  };

  /** Abre una lección concreta por su id. Devuelve false si no está en este curso. */
  const openLessonById = (videoId: string | null | undefined): boolean => {
    if (!videoId) return false;
    const modules = course.modules || [];
    for (let modIdx = 0; modIdx < modules.length; modIdx++) {
      const vidIdx = (modules[modIdx].videos || []).findIndex((v) => v.id === videoId);
      if (vidIdx >= 0) {
        setSelectedModuleIndex(modIdx);
        setSelectedVideoIndex(vidIdx);
        setExamModuleIndex(null);
        setIsPlayerModalOpen(true);
        return true;
      }
    }
    return false;
  };

  // Aviso pulsado con este curso ya abierto: se abre la lección de la consulta.
  useEffect(() => {
    if (loadingCourse) return;
    const onFocus = (event: Event) => {
      const detail = (event as CustomEvent<LessonFocus>).detail;
      if (!detail || detail.courseId !== course.id) return;
      readLessonFocus(course.id); // ya se atiende aquí: que no se repita al montar
      openLessonById(detail.videoId);
    };
    window.addEventListener(LESSON_FOCUS_EVENT, onFocus);
    return () => window.removeEventListener(LESSON_FOCUS_EVENT, onFocus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [course.id, course.modules, loadingCourse]);

  const handleOpenActiveLesson = () => {
    const modules = course.modules || [];
    const allVideos: { video: VideoDriveLink; modIdx: number; vidIdx: number }[] = [];
    modules.forEach((mod, modIdx) => {
      (mod.videos || []).forEach((vid, vidIdx) => {
        allVideos.push({ video: vid, modIdx, vidIdx });
      });
    });

    if (allVideos.length === 0) {
      setSelectedModuleIndex(0);
      setSelectedVideoIndex(0);
      setIsPlayerModalOpen(true);
      return;
    }

    // Un módulo ya visto con su examen sin aprobar: lo siguiente es el examen.
    const quizzesOn = pluginManager.isEnabled('interactive-quizzes');
    for (let modIdx = 0; modIdx < modules.length; modIdx++) {
      const vids = modules[modIdx].videos || [];
      if (vids.length === 0) continue;
      if (vids.some((v) => !completedVideoIds.includes(v.id))) break;
      if (quizzesOn && getModuleQuestionCount(modules[modIdx].id) > 0 && !quizzesPluginEngine.getUserAttempt(effectiveUser.id, modules[modIdx].id)?.passed) {
        handleOpenExam(modules[modIdx]);
        return;
      }
    }

    const pending = allVideos.find((item) => !completedVideoIds.includes(item.video.id));
    const target = pending ?? allVideos[allVideos.length - 1];

    setSelectedModuleIndex(target.modIdx);
    setSelectedVideoIndex(target.vidIdx);
    setExamModuleIndex(null);
    setIsPlayerModalOpen(true);
  };

  useEffect(() => {
    completedCountRef.current = completedVideoIds.length;
  }, [completedVideoIds]);

  const handleLessonCompletedAndAdvance = (nextTarget: { moduleIndex: number; videoIndex: number } | null) => {
    // 1. Cerrar el visor para que el alumno regrese de inmediato a la ruta cósmica
    setIsPlayerModalOpen(false);

    // Verificar si corresponde mostrar la encuesta NPS de mitad o fin de curso
    if (npsEligible && npsStatusLoaded) {
      const dueStage = resolveCourseNpsStage(
        completedCountRef.current,
        allVideoIds.length,
        new Set(resolvedNpsStagesRef.current),
      );
      if (dueStage === 'MID' || dueStage === 'END') {
        pendingNextLessonRef.current = nextTarget;
        setActiveNpsStage(dueStage);
        if (!nextTarget) loadProgress();
        return;
      }
    }

    // 2. Si es el final del curso o no hay lección siguiente, actualizar progreso
    if (!nextTarget) {
      loadProgress();
      return;
    }

    // 3. Fijar la siguiente lección en el estado
    setExamModuleIndex(null);
    setSelectedModuleIndex(nextTarget.moduleIndex);
    setSelectedVideoIndex(nextTarget.videoIndex);

    // 4. Una vez que el orbe celestial concluye su recorrido (~1.25s) y entra en la siguiente lección,
    // desplegar automáticamente la nueva lección
    setTimeout(() => {
      const nextMod = course.modules?.[nextTarget.moduleIndex];
      const nextVid = nextMod?.videos?.[nextTarget.videoIndex];
      if (nextMod && nextVid) {
        setIsPlayerModalOpen(true);
      }
    }, 1400);
  };

  // La lección abierta queda en la URL (sin crear historial): al recargar la página se retoma donde estaba.
  const openVideoId = isPlayerModalOpen ? course.modules?.[selectedModuleIndex]?.videos?.[selectedVideoIndex]?.id : undefined;
  useEffect(() => {
    if (loadingCourse || !progressLoaded) return;
    const url = new URL(window.location.href);
    if (openVideoId) url.searchParams.set('leccion', openVideoId);
    else url.searchParams.delete('leccion');
    if (url.href !== window.location.href) window.history.replaceState(window.history.state, '', url);
  }, [openVideoId, loadingCourse, progressLoaded]);

  // La misión que le corresponde activamente al alumno (frontera actual de aprendizaje).
  // Permite abrir lecciones anteriores para repasar o reforzar sin que el orbe se mueva de su lugar.
  const frontierVideoId = useMemo(() => {
    if (allVideoIds.length === 0) return undefined;
    const pending = allVideoIds.find((id) => !completedVideoIds.includes(id));
    return pending ?? allVideoIds[allVideoIds.length - 1];
  }, [allVideoIds, completedVideoIds]);

  // Al entrar al curso: guía suavemente al alumno directamente a donde se quedó (orbe celestial)
  // y al enfocarlo abre automáticamente la lección correspondiente.
  useEffect(() => {
    if (loadingCourse || !progressLoaded || !npsStatusLoaded) return;
    if (hasAutoNavigatedRef.current === course.id) return;
    hasAutoNavigatedRef.current = course.id;

    let openTimer: ReturnType<typeof setTimeout> | undefined;
    const scrollTimer = setTimeout(() => {
      const targetEl =
        document.getElementById('celestial-orb-target') ||
        document.getElementById('celestial-orb-island');

      if (targetEl) {
        const rect = targetEl.getBoundingClientRect();
        const scrollTop = window.scrollY || document.documentElement.scrollTop;
        const targetY = Math.max(0, scrollTop + rect.top - (window.innerHeight / 2) + (rect.height / 2));
        window.scrollTo({ top: targetY, behavior: 'smooth' });
      }

      openTimer = setTimeout(() => {
        // Si se llegó desde un aviso de respuesta, se abre esa lección.
        const focus = readLessonFocus(course.id);
        // Tras recargar, vuelve a la lección que se estaba viendo (?leccion=) y no a la primera pendiente.
        const fromUrl = new URLSearchParams(window.location.search).get('leccion');
        if (focus && openLessonById(focus.videoId)) return;
        if (fromUrl && openLessonById(fromUrl)) return;
        const dueStage = npsEligible
          ? resolveCourseNpsStage(completedVideoIds.length, allVideoIds.length, new Set(resolvedNpsStages))
          : null;
        if (dueStage) {
          if (!openedByReload) pendingAutoStartRef.current = true;
          setActiveNpsStage(dueStage);
          return;
        }
        // Tras recargar la página no se abre sola ninguna lección: se queda donde estaba (la ruta del curso).
        if (!openedByReload) handleOpenActiveLesson();
      }, 750);
    }, 200);

    return () => {
      clearTimeout(scrollTimer);
      if (openTimer) clearTimeout(openTimer);
    };
  }, [loadingCourse, progressLoaded, npsStatusLoaded, course.id]);

  // Dispara la encuesta NPS correspondiente (START al entrar, MID al 50% o END al 100%)
  // sin superponerse con otro modal de encuesta ya abierto.
  useEffect(() => {
    if (loadingCourse || !progressLoaded || !npsStatusLoaded || !npsEligible || activeNpsStage) {
      return;
    }
    const dueStage = resolveCourseNpsStage(
      completedVideoIds.length,
      allVideoIds.length,
      new Set(resolvedNpsStages),
    );
    if (dueStage) {
      setActiveNpsStage(dueStage);
    }
  }, [loadingCourse, progressLoaded, npsStatusLoaded, npsEligible, activeNpsStage, completedVideoIds.length, allVideoIds.length, resolvedNpsStages]);

  const finishNpsModal = (updatedStages: CourseNpsStage[]) => {
    const merged = Array.from(new Set([...resolvedNpsStagesRef.current, ...updatedStages]));
    resolvedNpsStagesRef.current = merged;
    setResolvedNpsStages(merged);
    setActiveNpsStage(null);

    const nextTarget = pendingNextLessonRef.current;
    pendingNextLessonRef.current = null;
    if (nextTarget) {
      setSelectedModuleIndex(nextTarget.moduleIndex);
      setSelectedVideoIndex(nextTarget.videoIndex);
      const nextMod = course.modules?.[nextTarget.moduleIndex];
      const nextVid = nextMod?.videos?.[nextTarget.videoIndex];
      if (nextMod && nextVid) {
        setIsPlayerModalOpen(true);
      }
      return;
    }

    if (pendingAutoStartRef.current) {
      pendingAutoStartRef.current = false;
      handleOpenActiveLesson();
    }
  };

  if (loadingCourse) {
    return (
      <div className="constellation-viewer-root w-full min-h-screen bg-canvas dark:bg-[#07070b] text-ink dark:text-white flex flex-col items-center justify-center p-6 select-none relative overflow-hidden">
        {/* Nebulosas de fondo */}
        <div className="absolute top-1/3 left-1/3 w-80 h-80 bg-purple-600/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/3 right-1/3 w-80 h-80 bg-brand-cyan/15 rounded-full blur-3xl pointer-events-none" />
        
        {/* Orbe pulsante cósmico */}
        <div className="relative mb-6">
          <div className="w-20 h-20 rounded-full border-2 border-purple-400/40 border-t-cyan-400 animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center text-2xl animate-pulse">
            ✨
          </div>
        </div>

        <h2 className="text-lg font-semibold text-slate-900 dark:text-white tracking-wide mb-2 text-center">
          {t('viewer.tracingRoute', 'Trazando la Ruta Estelar de Aprendizaje...')}
        </h2>
        <p className="text-xs text-slate-600 dark:text-slate-400 max-w-md text-center line-clamp-2">
          {course.title}
        </p>
      </div>
    );
  }

  return (
    <div className="constellation-viewer-root w-full min-h-screen bg-canvas dark:bg-[#07070b] text-ink dark:text-white">
      {/* Barra superior de contexto en Constellation */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-4 pb-2 flex flex-wrap items-center justify-between gap-4">
        <div className="flex w-full min-w-0 flex-1 items-center gap-2">
          <button
            type="button"
            onClick={onGoHome}
            className="flex min-h-11 shrink-0 items-center gap-1.5 text-sm font-semibold text-ink-soft hover:text-ink transition-colors cursor-pointer"
          >
            <Home className="w-3.5 h-3.5" />
            <span>{t('viewer.myLearning', 'Mi aprendizaje')}</span>
          </button>

        </div>

        {/* Acciones del curso */}
        <div className="flex w-full sm:w-auto sm:ml-auto shrink-0 flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleOpenActiveLesson}
            className="academy-button min-h-11 shrink-0 whitespace-nowrap"
          >
            <Play aria-hidden className="w-3.5 h-3.5 fill-current" />
            <span>{t('viewer.viewLesson', 'Ver lección')}</span>
          </button>
          <CourseShareButton course={course} />
        </div>
      </div>

      {/* Ruta de Misiones Cósmicas (Separada por módulos con Certificado Final) */}
      <ConstellationCosmicPath
        course={course}
        courses={courses}
        onSelectCourse={onSelectCourse || (() => {})}
        onOpenLesson={handleOpenLesson}
        onOpenExam={handleOpenExam}
        completedVideoIds={completedVideoIds}
        currentUser={effectiveUser}
        certificate={certificate}
        activeVideoId={frontierVideoId}
        isLessonModalOpen={isPlayerModalOpen}
      />

      {/* Visor de Misión en Modal Superpuesto (como el Buzón de Escucha) */}
      {isPlayerModalOpen && (
        <CourseViewer
          key={`player_${selectedModuleIndex}_${selectedVideoIndex}_${examModuleIndex ?? 'v'}`}
          course={course}
          currentUser={effectiveUser}
          hasAccess={hasAccess}
          onOpenPaywall={onOpenPaywall}
          courses={courses.length > 0 ? courses : [course]}
          onSelectCourse={onSelectCourse}
          onGoHome={onGoHome}
          initialModuleIndex={selectedModuleIndex}
          initialVideoIndex={selectedVideoIndex}
          initialExamModuleIndex={examModuleIndex}
          isModal={true}
          hideSyllabus={true}
          hideCertificate={true}
          onActiveLessonChange={(modIdx, vidIdx) => {
            setSelectedModuleIndex(modIdx);
            setSelectedVideoIndex(vidIdx);
          }}
          onProgressChange={(newCompletedMap) => {
            const ids = allVideoIds.filter((id) => Boolean(newCompletedMap[id]));
            completedCountRef.current = ids.length;
            setCompletedVideoIds(ids);
          }}
          onLessonCompletedAndAdvance={handleLessonCompletedAndAdvance}
          onCloseModal={() => {
            setIsPlayerModalOpen(false);
            loadProgress();
            loadQuizzes();
          }}
          onQuizPassed={() => {
            loadProgress();
            loadQuizzes();
          }}
        />
      )}

      <CourseNpsModal
        isOpen={activeNpsStage !== null}
        courseId={course.id}
        courseTitle={course.title}
        stage={activeNpsStage}
        onCompleted={finishNpsModal}
        onDismissed={finishNpsModal}
      />
    </div>
  );
};
