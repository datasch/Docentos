import React from 'react';
import { Download, ExternalLink, File, FileArchive, FileSpreadsheet, FileText, FolderOpen, Link2, Presentation } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Course, CourseResource } from '../../types';

interface ResourcesPanelProps {
  course: Course;
  activeModuleIndex: number;
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

/**
 * Materiales del curso: lo del módulo que se estudia primero, luego lo general y el resto por módulo.
 * Cada fila es un enlace normal (sin JavaScript): se abre o se descarga igual en web, móvil y tableta.
 */
export const ResourcesPanel: React.FC<ResourcesPanelProps> = ({ course, activeModuleIndex }) => {
  const { t } = useTranslation();
  const modules = course.modules || [];
  const general = course.resources || [];
  const current = modules[activeModuleIndex];

  const groups: Array<{ key: string; title: string; items: CourseResource[] }> = [
    ...(current?.resources?.length ? [{ key: `m-${current.id}`, title: t('viewer.resourcesThisModule', 'Este módulo'), items: current.resources }] : []),
    ...(general.length ? [{ key: 'general', title: t('viewer.resourcesCourse', 'Todo el curso'), items: general }] : []),
    ...modules
      .filter((module, index) => index !== activeModuleIndex && module.resources?.length)
      .map((module) => ({ key: `m-${module.id}`, title: module.title, items: module.resources as CourseResource[] })),
  ];

  if (groups.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
        <FolderOpen aria-hidden className="h-8 w-8 text-ink-faint" />
        <p className="max-w-[16rem] text-sm leading-relaxed text-ink-muted">
          {t('viewer.resourcesEmpty', 'Este curso todavía no tiene materiales. Cuando se agreguen, aparecerán aquí.')}
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-4">
      {groups.map((group) => (
        <section key={group.key} aria-label={group.title}>
          <h3 className="mb-1 px-1 text-xs text-ink-muted">{group.title}</h3>
          <ul className="divide-y divide-line border-y border-line">
            {group.items.map((resource) => {
              const Icon = iconFor(resource);
              const isLink = resource.kind === 'LINK';
              const meta = [kindLabel(resource), sizeLabel(resource.sizeBytes)].filter(Boolean).join(' · ');
              return (
                <li key={resource.id} className="space-y-3 px-1 py-4">
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
            })}
          </ul>
        </section>
      ))}
    </div>
  );
};
