import React, { useRef } from 'react';
import { LucideIcon, Maximize2, Minimize2 } from 'lucide-react';

export type PanelTabId = 'syllabus' | 'notes' | 'mentorship';

interface PanelTab {
  id: PanelTabId;
  label: string;
  icon: LucideIcon;
  /** Contador discreto junto a la etiqueta; se omite cuando es cero. */
  count?: number;
  content: React.ReactNode;
}

interface CoursePanelProps {
  tabs: PanelTab[];
  active: PanelTabId;
  onChange: (id: PanelTabId) => void;
  theaterMode: boolean;
  onToggleTheater: () => void;
}

/**
 * Los tres paneles del curso en un solo contenedor con pestanas.
 *
 * Antes vivian apilados uno bajo otro: en escritorio dejaban una columna vacia
 * de novecientos pixeles y en movil obligaban a pasar el temario entero antes de
 * llegar al video. Con una pestana activa a la vez el patron es identico en los
 * dos anchos, asi que lo aprendido en uno sirve en el otro.
 */
export const CoursePanel: React.FC<CoursePanelProps> = ({
  tabs,
  active,
  onChange,
  theaterMode,
  onToggleTheater,
}) => {
  const tabRefs = useRef(new Map<PanelTabId, HTMLButtonElement>());

  const handleKeyDown = (event: React.KeyboardEvent) => {
    const index = tabs.findIndex((tab) => tab.id === active);
    let next = index;

    if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
    else if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = tabs.length - 1;
    else return;

    event.preventDefault();
    onChange(tabs[next].id);
    tabRefs.current.get(tabs[next].id)?.focus();
  };

  const activeTab = tabs.find((tab) => tab.id === active) ?? tabs[0];

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-line bg-surface">
      <div className="flex shrink-0 items-stretch border-b border-line">
        <div role="tablist" aria-label="Paneles del curso" className="flex min-w-0 flex-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = tab.id === active;

            return (
              <button
                key={tab.id}
                ref={(node) => {
                  if (node) tabRefs.current.set(tab.id, node);
                  else tabRefs.current.delete(tab.id);
                }}
                role="tab"
                id={`panel-tab-${tab.id}`}
                aria-selected={isActive}
                aria-controls={isActive ? `panel-${tab.id}` : undefined}
                tabIndex={isActive ? 0 : -1}
                onClick={() => onChange(tab.id)}
                onKeyDown={handleKeyDown}
                className={`relative flex min-w-0 flex-1 items-center justify-center gap-1.5 px-2 py-3.5 text-meta transition-colors ${
                  isActive ? 'text-ink' : 'text-ink-muted hover:text-ink-soft'
                }`}
              >
                <Icon aria-hidden className="h-4 w-4 shrink-0" />
                <span className="truncate">{tab.label}</span>
                {typeof tab.count === 'number' && tab.count > 0 && (
                  <span className="shrink-0 text-micro text-ink-muted tabular-nums">{tab.count}</span>
                )}
                {isActive && (
                  <span aria-hidden className="absolute inset-x-0 -bottom-px h-0.5 bg-brand-cyan" />
                )}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={onToggleTheater}
          aria-pressed={theaterMode}
          className="hidden shrink-0 items-center border-l border-line px-3 text-ink-muted transition-colors hover:text-ink lg:flex"
        >
          {theaterMode ? (
            <Minimize2 aria-hidden className="h-4 w-4" />
          ) : (
            <Maximize2 aria-hidden className="h-4 w-4" />
          )}
          <span className="sr-only">
            {theaterMode ? 'Salir del modo cine' : 'Ver en modo cine'}
          </span>
        </button>
      </div>

      <div
        role="tabpanel"
        id={`panel-${activeTab.id}`}
        aria-labelledby={`panel-tab-${activeTab.id}`}
        className="flex min-h-0 flex-1 flex-col overflow-hidden"
      >
        {activeTab.content}
      </div>
    </section>
  );
};
