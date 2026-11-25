import React from 'react';
import { ChevronDown, Download, ExternalLink, File, FileArchive, FileSpreadsheet, FileText, FolderOpen, Link2, Presentation } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Course, CourseResource } from '../../types';

interface ResourcesPanelProps {
  course: Course;
  activeModuleIndex: number;
  /** Lección que se está viendo: sus materiales van primero y a la vista. */
  activeVideoId?: string | null;
}

const iconFor = (resource: CourseResource) => {
  if (resource.kind === 'LINK') return Link2;
  const mime = (resource.mimeType || '').toLowerCase();
  const name = resource.title.toLowerCase();
  if (mime.includes('pdf') || name.endsWith('.pdf')) return FileText;
  if (mime.includes('sheet') || mime.includes('excel') || mime.includes('csv') || /\.(xlsx?|csv)$/.test(name)) return FileSpreadsheet;
  if (mime.includes('presentation') || mime.includes('powerpoint') || /\.pptx?$/.test(name)) return Presentation;
  if (mime.includes('zip') || mime.includes('compressed') || /\.(zip|rar|7z)$/.test(name)) return FileArchive;
  if (mime.includes('text') || mime.includes('word') || /\.(docx?|txt|md)$/.test(name)) return FileText;
  return File;
};

const kindLabel = (resource: CourseResource) => {
  if (resource.kind === 'LINK') return 'Enlace';
  const mime = (resource.mimeType || '').toLowerCase();
  if (mime.includes('pdf')) return 'PDF';
  if (mime.includes('sheet') || mime.includes('excel') || mime.includes('csv')) return 'Hoja de cálculo';
  if (mime.includes('presentation') || mime.includes('powerpoint')) return 'Presentación';
  if (mime.includes('zip') || mime.includes('compressed')) return 'ZIP';
  if (mime.includes('word')) return 'Documento';
  return 'Archivo';
};

const sizeLabel = (bytes?: string | null) => {
  const value = Number(bytes);
  if (!value || value < 0) return '';
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
};

export interface ResourceGroups {
  /** Material de la lección que se está viendo. */
  lesson: CourseResource[];
  /**
   * Material sin lección asignada. Para no repetirlo en todas las clases, solo
   * sale en la primera lección de su módulo (el del módulo) o del curso (el del
   * curso), hasta que administración lo asigne a una lección concreta.
   */
  general: CourseResource[];
}

/**
 * Qué materiales corresponden a la lección actual. Los de otros módulos o de
 * otras lecciones no se muestran: cada clase enseña solo los suyos.
 */
export function groupResources(course: Course, activeModuleIndex: number, activeVideoId?: string | null): ResourceGroups {
  const modules = course.modules || [];
  const current = modules[activeModuleIndex];
  const own = current?.resources || [];
  const firstOfModule = Boolean(activeVideoId && current?.videos?.[0]?.id === activeVideoId);
  const firstModuleWithLessons = modules.findIndex((module) => (module.videos || []).length > 0);
  const firstOfCourse = firstOfModule && firstModuleWithLessons === activeModuleIndex;
  return {
    lesson: activeVideoId ? own.filter((resource) => resource.videoId === activeVideoId) : [],
    general: [
      ...(firstOfModule ? own.filter((resource) => !resource.videoId) : []),
      ...(firstOfCourse ? course.resources || [] : []),
    ],
  };
}

const ResourceRow: React.FC<{ resource: CourseResource }> = ({ resource }) => {
  const { t } = useTranslation();
  const Icon = iconFor(resource);
  const isLink = resource.kind === 'LINK';
  const meta = [kindLabel(resource), sizeLabel(resource.sizeBytes)].filter(Boolean).join(' · ');
  return (
    <li className="space-y-3 px-1 py-4">
      <div className="grid grid-cols-[2.25rem_minmax(0,1fr)] items-start gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-lg border border-line bg-raised text-ink-soft">
          <Icon aria-hidden className="h-4 w-4" />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-medium leading-snug text-ink [overflow-wrap:anywhere]">{resource.title}</span>
          {resource.description && <span className="mt-0.5 block text-xs leading-relaxed text-ink-soft [overflow-wrap:anywhere]">{resource.description}</span>}
          <span className="mt-0.5 block text-xs text-ink-muted">{meta}</span>
        </span>
      </div>
      <a
        href={resource.downloadUrl}
        target="_blank"
        rel="noopener noreferrer"
        {...(isLink ? {} : { download: true })}
        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-line px-4 text-sm font-medium text-ink transition-colors hover:bg-ink/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        {isLink ? <ExternalLink aria-hidden className="h-4 w-4 shrink-0" /> : <Download aria-hidden className="h-4 w-4 shrink-0" />}
        {isLink ? t('viewer.resourceOpenLink', 'Abrir enlace') : t('viewer.resourceDownload', 'Descargar')}
      </a>
    </li>
  );
};

/**
 * Materiales de la lección que se estudia. Cada fila es un enlace normal (sin
 * JavaScript): se abre o se descarga igual en web, móvil y tableta. El scroll
 * es interno y sin barra visible para no duplicar el de la página.
 */
export const ResourcesPanel: React.FC<ResourcesPanelProps> = ({ course, activeModuleIndex, activeVideoId }) => {
  const { t } = useTranslation();
  const { lesson, general } = groupResources(course, activeModuleIndex, activeVideoId);

  if (lesson.length === 0 && general.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
        <FolderOpen aria-hidden className="h-8 w-8 text-ink-faint" />
        <p className="max-w-[16rem] text-sm leading-relaxed text-ink-muted">
          {t('viewer.resourcesEmptyLesson', 'Esta lección todavía no tiene materiales. Cuando se agreguen, aparecerán aquí.')}
        </p>
      </div>
    );
  }

  return (
    <div className="scroll-invisible min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain p-4">
      {lesson.length > 0 ? (
        <section aria-label={t('viewer.resourcesThisLesson', 'Esta lección')}>
          <h3 className="mb-1 px-1 text-xs text-ink-muted">{t('viewer.resourcesThisLesson', 'Esta lección')}</h3>
          <ul className="divide-y divide-line border-y border-line">
            {lesson.map((resource) => <ResourceRow key={resource.id} resource={resource} />)}
          </ul>
        </section>
      ) : (
        <p className="px-1 text-sm leading-relaxed text-ink-muted">
          {t('viewer.resourcesNoneForLesson', 'Esta lección no tiene materiales propios.')}
        </p>
      )}
      {general.length > 0 && (
        <details className="group">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 rounded-lg px-1 text-sm font-medium text-ink-soft hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink">
            <span>{t('viewer.resourcesGeneral', 'Material general del módulo y del curso')} ({general.length})</span>
            <ChevronDown aria-hidden className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" />
          </summary>
          <ul className="divide-y divide-line border-y border-line">
            {general.map((resource) => <ResourceRow key={resource.id} resource={resource} />)}
          </ul>
        </details>
      )}
    </div>
  );
};
