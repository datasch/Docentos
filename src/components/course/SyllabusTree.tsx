import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, CheckCircle2, ChevronRight, Download, Lock, Play } from 'lucide-react';
import { Course, User } from '../../types';
import { pluginManager } from '../../plugins/PluginManager';
import { ProgressMeter } from './ProgressMeter';
import { moduleHue } from './hues';

interface SyllabusTreeProps {
  course: Course;
  currentUser: User;
  hasAccess: boolean;
  completedVideos: Record<string, boolean>;
  activeModuleIndex: number;
  activeVideoIndex: number;
  courseProgressPct: number;
  completedCourseVideos: number;
  totalCourseVideos: number;
  onSelectLesson: (moduleIndex: number, videoIndex: number) => void;
  onToggleComplete: (videoId: string) => void;
  onOpenPaywall: () => void;
}

/** Una fila navegable del arbol: cabecera de modulo o leccion. */
type Row =
  | { key: string; kind: 'module'; moduleIndex: number }
  | { key: string; kind: 'lesson'; moduleIndex: number; videoIndex: number };

export const SyllabusTree: React.FC<SyllabusTreeProps> = ({
  course,
  currentUser,
  hasAccess,
  completedVideos,
  activeModuleIndex,
  activeVideoIndex,
  courseProgressPct,
  completedCourseVideos,
  totalCourseVideos,
  onSelectLesson,
  onToggleComplete,
  onOpenPaywall,
}) => {
  const [expanded, setExpanded] = useState<Record<number, boolean>>({ [activeModuleIndex]: true });
  // El foco del teclado se mueve con las flechas sobre una sola fila tabulable:
  // con cincuenta lecciones, dejarlas todas en el orden de tabulacion convierte
  // el temario en una trampa de la que cuesta salir.
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const rowRefs = useRef(new Map<string, HTMLElement>());

  // El modulo que se esta viendo se abre solo: si el alumno salta de leccion con
  // los botones del reproductor, el temario debe seguirle.
  useEffect(() => {
    setExpanded((prev) => (prev[activeModuleIndex] ? prev : { ...prev, [activeModuleIndex]: true }));
  }, [activeModuleIndex]);

  const unlocked = useMemo(
    () => course.modules.map((_, mIdx) => pluginManager.isModuleUnlocked(course.modules, mIdx, currentUser.id)),
    [course.modules, currentUser.id],
  );

  /** Filas visibles, en el orden en que se ven. Es lo que recorren las flechas. */
  const rows = useMemo<Row[]>(() => {
    const list: Row[] = [];
    course.modules.forEach((module, mIdx) => {
      list.push({ key: `m${mIdx}`, kind: 'module', moduleIndex: mIdx });
      if (expanded[mIdx] && unlocked[mIdx]) {
        module.videos.forEach((_, vIdx) => {
          list.push({ key: `m${mIdx}v${vIdx}`, kind: 'lesson', moduleIndex: mIdx, videoIndex: vIdx });
        });
      }
    });
    return list;
  }, [course.modules, expanded, unlocked]);

  const activeKey = `m${activeModuleIndex}v${activeVideoIndex}`;
  const tabbableKey = rows.some((row) => row.key === focusKey)
    ? focusKey
    : rows.some((row) => row.key === activeKey)
      ? activeKey
      : rows[0]?.key;

  const focusRow = (key: string) => {
    setFocusKey(key);
    rowRefs.current.get(key)?.focus();
  };

  const toggleModule = (mIdx: number) =>
    setExpanded((prev) => ({ ...prev, [mIdx]: !prev[mIdx] }));

  const handleKeyDown = (event: React.KeyboardEvent, row: Row) => {
    // Las lecciones viven dentro del treeitem de su modulo, asi que sus teclas
    // burbujean hasta el: sin esta guarda una flecha se procesaria dos veces.
    if (event.currentTarget !== event.target) return;

    const index = rows.findIndex((item) => item.key === row.key);
    if (index < 0) return;

    switch (event.key) {
      case 'Enter':
      case ' ':
        event.preventDefault();
        if (row.kind === 'lesson') {
          if (hasAccess) onSelectLesson(row.moduleIndex, row.videoIndex);
          else onOpenPaywall();
        } else if (unlocked[row.moduleIndex]) {
          toggleModule(row.moduleIndex);
        }
        break;
      case 'ArrowDown':
        event.preventDefault();
        focusRow(rows[Math.min(index + 1, rows.length - 1)].key);
        break;
      case 'ArrowUp':
        event.preventDefault();
        focusRow(rows[Math.max(index - 1, 0)].key);
        break;
      case 'Home':
        event.preventDefault();
        focusRow(rows[0].key);
        break;
      case 'End':
        event.preventDefault();
        focusRow(rows[rows.length - 1].key);
        break;
      case 'ArrowRight':
        // Abre el modulo cerrado; si ya esta abierto, baja a su primera leccion.
        if (row.kind === 'module' && unlocked[row.moduleIndex]) {
          event.preventDefault();
          if (!expanded[row.moduleIndex]) toggleModule(row.moduleIndex);
          else if (rows[index + 1]?.kind === 'lesson') focusRow(rows[index + 1].key);
        }
        break;
      case 'ArrowLeft':
        event.preventDefault();
        if (row.kind === 'lesson') focusRow(`m${row.moduleIndex}`);
        else if (expanded[row.moduleIndex]) toggleModule(row.moduleIndex);
        break;
      default:
        break;
    }
  };

  const registerRow = (key: string) => (node: HTMLElement | null) => {
    if (node) rowRefs.current.set(key, node);
    else rowRefs.current.delete(key);
  };

  return (
    <div className="flex flex-col">
      {/* Cabecera de progreso. La barra manda y el porcentaje la acompana: al
          reves —un badge con gradiente— competia con el titulo de la leccion. */}
      <div className="border-b border-line px-4 py-3.5">
        <div className="flex items-center gap-3">
          <ProgressMeter value={courseProgressPct} label="Progreso del curso" className="flex-1" />
          <span className="shrink-0 text-meta text-ink tabular-nums">{courseProgressPct} %</span>
        </div>
        <p className="mt-2 text-meta text-ink-muted tabular-nums">
          {completedCourseVideos} de {totalCourseVideos} lecciones · {course.modules.length} módulos
        </p>
      </div>

      <div role="tree" aria-label="Temario del curso" className="flex flex-col p-2">
        {course.modules.map((module, mIdx) => {
          const hue = moduleHue(mIdx);
          const isUnlocked = unlocked[mIdx];
          const isOpen = Boolean(expanded[mIdx]) && isUnlocked;
          const isCurrentModule = mIdx === activeModuleIndex;
          const total = module.videos.length;
          const done = module.videos.filter((video) => completedVideos[video.id]).length;
          const isComplete = total > 0 && done === total;
          const pct = total > 0 ? Math.round((done / total) * 100) : 0;
          const moduleKey = `m${mIdx}`;

          return (
            <div
              key={module.id}
              ref={registerRow(moduleKey)}
              role="treeitem"
              aria-expanded={isUnlocked ? isOpen : undefined}
              aria-disabled={!isUnlocked}
              aria-current={isCurrentModule ? 'true' : undefined}
              aria-level={1}
              tabIndex={tabbableKey === moduleKey ? 0 : -1}
              onFocus={() => setFocusKey(moduleKey)}
              onKeyDown={(event) => handleKeyDown(event, { key: moduleKey, kind: 'module', moduleIndex: mIdx })}
              style={{ '--hue': hue } as React.CSSProperties}
              className={`overflow-hidden rounded-xl transition-colors ${isOpen ? 'bg-raised' : ''}`}
            >
              <div
                onClick={() => {
                  if (!isUnlocked) return;
                  toggleModule(mIdx);
                }}
                className={`flex w-full items-start gap-2.5 rounded-xl p-3 text-left transition-colors ${
                  isUnlocked ? 'cursor-pointer hover:bg-raised' : 'cursor-not-allowed'
                }`}
              >
                <ChevronRight
                  aria-hidden
                  className={`mt-0.5 h-4 w-4 shrink-0 transition-transform duration-200 ${
                    isUnlocked ? 'text-ink-muted' : 'text-ink-faint'
                  } ${isOpen ? 'rotate-90' : ''}`}
                />

                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span
                      className={`text-micro font-semibold ${isUnlocked ? 'text-(--hue)' : 'text-ink-faint'}`}
                    >
                      Módulo {String(mIdx + 1).padStart(2, '0')}
                    </span>
                    {!isUnlocked && <Lock aria-hidden className="h-3 w-3 text-ink-faint" />}
                    {isUnlocked && isComplete && (
                      <CheckCircle2 aria-hidden className="h-3.5 w-3.5 text-(--hue)" />
                    )}
                  </span>

                  <span
                    className={`mt-0.5 block text-section font-semibold ${
                      isUnlocked ? 'text-ink' : 'text-ink-faint'
                    }`}
                  >
                    {module.title}
                  </span>

                  {isUnlocked ? (
                    <span className="mt-2 flex items-center gap-2.5">
                      <ProgressMeter value={pct} tone="hue" label={`Progreso de ${module.title}`} className="flex-1" />
                      <span className="shrink-0 text-micro text-ink-muted tabular-nums">
                        {done}/{total}
                      </span>
                    </span>
                  ) : (
                    <span className="mt-1.5 block text-micro leading-snug text-ink-faint">
                      Aprueba el examen del módulo anterior con 80 % para abrirlo.
                    </span>
                  )}
                </span>
              </div>

              <div className="accordion-shell" data-open={isOpen}>
                <div>
                  <ul role="group" className="flex flex-col px-2 pb-2">
                    {module.videos.map((video, vIdx) => {
                      const isCurrent = isCurrentModule && vIdx === activeVideoIndex;
                      const isDone = Boolean(completedVideos[video.id]);
                      const lessonKey = `m${mIdx}v${vIdx}`;
                      const isLast = vIdx === module.videos.length - 1;

                      return (
                        <li key={video.id} role="none" className="relative flex items-center">
                          {/* Riel que enhebra las lecciones del modulo. Arranca y
                              termina a 10px del centro de cada punto para no
                              pasar por debajo de ellos. */}
                          {!isLast && (
                            <span
                              aria-hidden
                              className={`absolute top-[calc(50%+10px)] left-[1.125rem] h-[calc(100%-20px)] w-0.5 -translate-x-1/2 rounded-full ${
                                isDone ? 'bg-(--hue)/40' : 'bg-line'
                              }`}
                            />
                          )}

                          {/* Marcar hecha es su propio boton, hermano del de la
                              leccion: anidar uno dentro de otro no es HTML valido
                              y el teclado no sabria cual esta activando. Queda
                              fuera del orden de tabulacion porque la misma accion
                              vive, accesible, en la barra bajo el reproductor. */}
                          <div
                            ref={registerRow(lessonKey)}
                            role="treeitem"
                            aria-current={isCurrent ? 'true' : undefined}
                            aria-level={2}
                            tabIndex={tabbableKey === lessonKey ? 0 : -1}
                            onFocus={() => setFocusKey(lessonKey)}
                            onKeyDown={(event) =>
                              handleKeyDown(event, { key: lessonKey, kind: 'lesson', moduleIndex: mIdx, videoIndex: vIdx })
                            }
                            onClick={() => (hasAccess ? onSelectLesson(mIdx, vIdx) : onOpenPaywall())}
                            className={`flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 rounded-lg pr-2.5 text-left transition-colors ${
                              isCurrent ? 'bg-raised' : 'hover:bg-raised'
                            }`}
                          >
                            <button
                              type="button"
                              tabIndex={-1}
                              disabled={!hasAccess}
                              aria-pressed={isDone}
                              aria-label={
                                isDone
                                  ? `Marcar ${video.title} como pendiente`
                                  : `Marcar ${video.title} como completada`
                              }
                              onClick={(event) => {
                                event.stopPropagation();
                                onToggleComplete(video.id);
                              }}
                              className="relative z-10 shrink-0 rounded-full p-2.5 disabled:cursor-not-allowed"
                            >
                              <span
                                className={`flex h-4 w-4 items-center justify-center rounded-full transition-colors ${
                                  isDone || isCurrent ? 'bg-(--hue)' : 'border border-line hover:border-(--hue)'
                                }`}
                              >
                                {isDone && <Check aria-hidden className="h-3 w-3 text-canvas" strokeWidth={3.5} />}
                                {!isDone && isCurrent && (
                                  <Play aria-hidden className="h-2 w-2 fill-canvas text-canvas" />
                                )}
                              </span>
                            </button>

                            <span
                              className={`min-w-0 flex-1 truncate text-row ${
                                isCurrent
                                  ? 'font-medium text-(--hue)'
                                  : isDone
                                    ? 'text-ink-muted'
                                    : 'text-ink-soft'
                              }`}
                            >
                              {video.title}
                            </span>

                            {!hasAccess && <Lock aria-hidden className="h-3 w-3 shrink-0 text-ink-faint" />}
                            {video.duration && (
                              <span className="shrink-0 text-micro text-ink-muted tabular-nums">
                                {video.duration}
                              </span>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>

                  {hasAccess && module.resources && module.resources.length > 0 && (
                    <div className="border-t border-line px-3 py-3">
                      <p className="mb-1.5 text-micro text-ink-muted">Recursos del módulo</p>
                      <div className="flex flex-col gap-1">
                        {module.resources.map((res) => (
                          <a
                            key={res.id}
                            href={res.downloadUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-meta text-ink-soft transition-colors hover:bg-surface hover:text-ink"
                          >
                            <Download aria-hidden className="h-3.5 w-3.5 shrink-0 text-(--hue)" />
                            <span className="min-w-0 flex-1 truncate">{res.title}</span>
                            <span className="shrink-0 text-micro text-ink-faint">{res.kind}</span>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {hasAccess && course.resources && course.resources.length > 0 && (
        <div className="border-t border-line px-4 py-4">
          <p className="mb-2 text-micro text-ink-muted">Recursos del programa</p>
          <div className="flex flex-col gap-1">
            {course.resources.map((res) => (
              <a
                key={res.id}
                href={res.downloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-meta text-ink-soft transition-colors hover:bg-raised hover:text-ink"
              >
                <Download aria-hidden className="h-3.5 w-3.5 shrink-0 text-brand-cyan" />
                <span className="min-w-0 flex-1 truncate">{res.title}</span>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
