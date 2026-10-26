import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Home, Play } from 'lucide-react';
import { Course, User, Module, VideoDriveLink, CertificateRecord } from '../../types';
import { CourseViewer } from '../../components/CourseViewer';
import { ConstellationCosmicPath } from './ConstellationCosmicPath';
import { api } from '../../lib/api';

interface ConstellationCourseViewerProps {
  course: Course;
  currentUser: User | null;
  hasAccess: boolean;
  onOpenPaywall: () => void;
  onGoHome: () => void;
  onSelectCourse?: (course: Course) => void;
  courses?: Course[];
}

export const ConstellationCourseViewer: React.FC<ConstellationCourseViewerProps> = ({
  course: initialCourse,
  currentUser,
  hasAccess,
  onOpenPaywall,
  onGoHome,
  onSelectCourse,
  courses = [],
}) => {
  const [course, setCourse] = useState<Course>(initialCourse);
  const [loadingCourse, setLoadingCourse] = useState<boolean>(
    !initialCourse.modules || initialCourse.modules.length === 0
  );
  const [isPlayerModalOpen, setIsPlayerModalOpen] = useState(false);
  const [selectedModuleIndex, setSelectedModuleIndex] = useState<number>(0);
  const [selectedVideoIndex, setSelectedVideoIndex] = useState<number>(0);
  const [completedVideoIds, setCompletedVideoIds] = useState<string[]>([]);
  const [certificate, setCertificate] = useState<CertificateRecord | null>(null);
  const [progressLoaded, setProgressLoaded] = useState(false);
  const hasAutoNavigatedRef = useRef<string | null>(null);

  const effectiveUser: User = currentUser || {
    id: 'guest',
    name: 'Estudiante',
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
  }, [initialCourse.id]);

  const loadProgress = async () => {
    try {
      const res = await api.getProgress();
      if (res?.completedVideos) {
        // Asegurar consistencia secuencial: si una lección avanzada está completada,
        // todas las lecciones previas en la ruta se consideran completadas.
        const allVideoIds: string[] = [];
        (course.modules || []).forEach((m) => {
          (m.videos || []).forEach((v) => allVideoIds.push(v.id));
        });

        let highestCompletedIdx = -1;
        allVideoIds.forEach((id, idx) => {
          if (res.completedVideos[id]) {
            highestCompletedIdx = Math.max(highestCompletedIdx, idx);
          }
        });

        const completedSet = new Set<string>();
        if (highestCompletedIdx >= 0) {
          for (let i = 0; i <= highestCompletedIdx; i++) {
            completedSet.add(allVideoIds[i]);
          }
        }
        Object.entries(res.completedVideos).forEach(([id, done]) => {
          if (done) completedSet.add(id);
        });

        setCompletedVideoIds(Array.from(completedSet));
      }
      const found = res?.certificates?.find((c) => c.courseId === course.id);
      setCertificate(found || null);
    } catch {
      // Si falla la red o es modo invitado, mantiene estado local
    } finally {
      setProgressLoaded(true);
    }
  };

  useEffect(() => {
    loadProgress();
  }, [currentUser, course.id]);

  const handleOpenLesson = (video: VideoDriveLink, module: Module) => {
    const modules = course.modules || [];
    const modIdx = modules.findIndex((m) => m.id === module.id);
    const resolvedModIdx = modIdx >= 0 ? modIdx : 0;
    const vidIdx = modules[resolvedModIdx]?.videos?.findIndex((v) => v.id === video.id) ?? 0;
    const resolvedVidIdx = vidIdx >= 0 ? vidIdx : 0;

    setSelectedModuleIndex(resolvedModIdx);
    setSelectedVideoIndex(resolvedVidIdx);
    setIsPlayerModalOpen(true);
  };

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

    const pending = allVideos.find((item) => !completedVideoIds.includes(item.video.id));
    const target = pending ?? allVideos[allVideos.length - 1];

    setSelectedModuleIndex(target.modIdx);
    setSelectedVideoIndex(target.vidIdx);
    setIsPlayerModalOpen(true);
  };

  const handleLessonCompletedAndAdvance = (nextTarget: { moduleIndex: number; videoIndex: number } | null) => {
    // 1. Cerrar el visor para que el alumno regrese de inmediato a la ruta cósmica
    setIsPlayerModalOpen(false);

    // 2. Si es el final del curso o no hay lección siguiente, actualizar progreso
    if (!nextTarget) {
      loadProgress();
      return;
    }

    // 3. Fijar la siguiente lección en el estado
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

  // Lista plana de IDs de videos en orden secuencial del curso
  const allVideoIds = useMemo(() => {
    const ids: string[] = [];
    (course.modules || []).forEach((m) => {
      (m.videos || []).forEach((v) => ids.push(v.id));
    });
    return ids;
  }, [course.modules]);

  // La misión que le corresponde activamente al alumno (frontera actual de aprendizaje).
  // Permite abrir lecciones anteriores para repasar o reforzar sin que el orbe se mueva de su lugar.
  const frontierVideoId = useMemo(() => {
    if (allVideoIds.length === 0) return undefined;
    const pending = allVideoIds.find((id) => !completedVideoIds.includes(id));
    return pending ?? allVideoIds[allVideoIds.length - 1];
  }, [allVideoIds, completedVideoIds]);

  // Al entrar al curso: animación suave que desciende en la ruta cósmica hasta donde está el orbe celestial,
  // y al enfocarlo abre automáticamente la lección correspondiente.
  useEffect(() => {
    if (loadingCourse || !progressLoaded) return;
    if (hasAutoNavigatedRef.current === course.id) return;
    hasAutoNavigatedRef.current = course.id;

    let openTimer: ReturnType<typeof setTimeout> | undefined;
    const scrollTimer = setTimeout(() => {
      const targetEl =
        document.getElementById('celestial-orb-target') ||
        document.getElementById('celestial-orb-island');

      if (targetEl) {
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }

      openTimer = setTimeout(() => {
        handleOpenActiveLesson();
      }, 1050);
    }, 300);

    return () => {
      clearTimeout(scrollTimer);
      if (openTimer) clearTimeout(openTimer);
    };
  }, [loadingCourse, progressLoaded, course.id]);

  if (loadingCourse) {
    return (
      <div className="constellation-viewer-root w-full min-h-screen bg-[#f8fafc] dark:bg-[#07070b] text-slate-900 dark:text-white flex flex-col items-center justify-center p-6 select-none relative overflow-hidden">
        {/* Nebulosas de fondo */}
        <div className="absolute top-1/3 left-1/3 w-80 h-80 bg-purple-600/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/3 right-1/3 w-80 h-80 bg-cyan-600/15 rounded-full blur-3xl pointer-events-none" />
        
        {/* Orbe pulsante cósmico */}
        <div className="relative mb-6">
          <div className="w-20 h-20 rounded-full border-2 border-purple-400/40 border-t-cyan-400 animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center text-2xl animate-pulse">
            ✨
          </div>
        </div>

        <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-wide mb-2 text-center">
          Trazando la Ruta Estelar de Aprendizaje...
        </h2>
        <p className="text-xs text-slate-600 dark:text-slate-400 max-w-md text-center line-clamp-2">
          {course.title}
        </p>
      </div>
    );
  }

  return (
    <div className="constellation-viewer-root w-full min-h-screen bg-[#f8fafc] dark:bg-[#07070b] text-slate-900 dark:text-white">
      {/* Barra superior de contexto en Constellation */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-4 pb-2 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={onGoHome}
            className="flex shrink-0 items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <Home className="w-3.5 h-3.5" />
            <span>Inicio</span>
          </button>
          <span className="text-slate-700">/</span>
          <span className="text-xs font-bold text-cyan-400 truncate max-w-[200px] sm:max-w-md">
            {course.title}
          </span>
        </div>

        {/* Botón de acceso directo a la misión activa */}
        <button
          type="button"
          onClick={handleOpenActiveLesson}
          className="flex shrink-0 items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-extrabold bg-[#1d1633] border border-purple-500/30 text-purple-200 hover:text-white hover:border-purple-400/60 shadow-sm transition-all cursor-pointer"
        >
          <Play className="w-3.5 h-3.5 fill-current text-cyan-400" />
          <span>Ver Lección</span>
        </button>
      </div>

      {/* Ruta de Misiones Cósmicas (Separada por módulos con Certificado Final) */}
      <ConstellationCosmicPath
        course={course}
        courses={courses}
        onSelectCourse={onSelectCourse || (() => {})}
        onOpenLesson={handleOpenLesson}
        completedVideoIds={completedVideoIds}
        currentUser={effectiveUser}
        certificate={certificate}
        activeVideoId={frontierVideoId}
      />

      {/* Visor de Misión en Modal Superpuesto (como el Buzón de Escucha) */}
      {isPlayerModalOpen && (
        <CourseViewer
          key={`player_${selectedModuleIndex}_${selectedVideoIndex}`}
          course={course}
          currentUser={effectiveUser}
          hasAccess={hasAccess}
          onOpenPaywall={onOpenPaywall}
          courses={courses.length > 0 ? courses : [course]}
          onSelectCourse={onSelectCourse}
          onGoHome={onGoHome}
          initialModuleIndex={selectedModuleIndex}
          initialVideoIndex={selectedVideoIndex}
          isModal={true}
          hideSyllabus={true}
          hideCertificate={true}
          onActiveLessonChange={(modIdx, vidIdx) => {
            setSelectedModuleIndex(modIdx);
            setSelectedVideoIndex(vidIdx);
          }}
          onProgressChange={(newCompletedMap) => {
            const ids = Object.entries(newCompletedMap)
              .filter(([_, done]) => Boolean(done))
              .map(([id]) => id);
            setCompletedVideoIds(ids);
          }}
          onLessonCompletedAndAdvance={handleLessonCompletedAndAdvance}
          onCloseModal={() => {
            setIsPlayerModalOpen(false);
            loadProgress();
          }}
        />
      )}
    </div>
  );
};
