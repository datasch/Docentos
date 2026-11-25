import { AdminSelect } from './AdminSelect';
import { useEffect, useRef } from 'react';
import { FilePlus2, X } from 'lucide-react';
import type { Module } from '../types';
import { useTranslation } from 'react-i18next'

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (event: React.FormEvent) => void;
  modules: Module[];
  title: string;
  onTitle: (value: string) => void;
  privateUrl: string;
  onPrivateUrl: (value: string) => void;
  moduleId: string;
  onModuleId: (value: string) => void;
  /** Lección dentro del módulo elegido; vacío = material general del módulo. */
  videoId: string;
  onVideoId: (value: string) => void;
  error: string;
}

export function AdminResourceSheet({ open, onClose, onSubmit, modules, title, onTitle, privateUrl, onPrivateUrl, moduleId, onModuleId, videoId, onVideoId, error }: Props) {
  const { t } = useTranslation()
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const previous = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    return () => { document.documentElement.style.overflow = previous; };
  }, [open]);

  return (
    <div data-mentor-ui="modern" className="admin-courses-root">
      <dialog ref={ref} className="mentee-sheet admin-resource-sheet-dialog" aria-labelledby="admin-resource-sheet-title" onClose={onClose} onClick={(event) => { if (event.target === ref.current) onClose(); }}>
        <div className="mentee-sheet__body admin-person-sheet">
          <header className="mentee-sheet__head">
            <span className="mentee-sheet__icon" aria-hidden="true"><FilePlus2 /></span>
            <div className="mentor-mentee-id"><strong id="admin-resource-sheet-title">{t('nuevoRecurso', 'Nuevo recurso')}</strong><span>{t('materialComplementarioDelCurso', 'Material complementario del curso')}</span></div>
            <button type="button" className="mentee-sheet__close" onClick={onClose} aria-label={t('cerrar', 'Cerrar')}><X aria-hidden="true" /></button>
          </header>
          <form id="admin-resource-form" onSubmit={onSubmit} className="admin-person-sheet__scroll">
            <div className="meeting-field"><label htmlFor="resource-title">{t('tituloDelRecurso', 'Título del recurso')}</label><input id="resource-title" type="text" placeholder={t('ejGuiaDeArquitecturapdf', 'Ej. Guía de Arquitectura.pdf')} value={title} onChange={(event) => onTitle(event.target.value)} required /></div>
            <div className="meeting-field"><label htmlFor="resource-url">{t('urlPrivadaDelArchivo', 'URL privada del archivo')}</label><input id="resource-url" type="url" placeholder="https://drive.google.com/..." value={privateUrl} onChange={(event) => onPrivateUrl(event.target.value)} required /></div>
            <div className="meeting-field"><label htmlFor="resource-module">{t('asignarAModulo', 'Asignar a módulo')}</label><AdminSelect inline id="resource-module" value={moduleId} onChange={onModuleId} options={[{ value: '', label: t('generalDelCurso', 'General del curso') }, ...modules.map((module) => ({ value: module.id, label: module.title }))]} /></div>
            {moduleId && (modules.find((module) => module.id === moduleId)?.videos?.length ?? 0) > 0 && (
              <div className="meeting-field"><label htmlFor="resource-lesson">{t('asignarALeccion', 'Asignar a lección (opcional)')}</label><AdminSelect inline id="resource-lesson" value={videoId} onChange={onVideoId} options={[{ value: '', label: t('materialGeneralDelModulo', 'Material general del módulo') }, ...(modules.find((module) => module.id === moduleId)?.videos || []).map((video) => ({ value: video.id, label: video.title }))]} /></div>
            )}
            <p className="admin-resource-sheet__hint">{t('elEnlaceSeEntregaSoloAQuienesTienen', 'El enlace se entrega solo a quienes tienen acceso al curso.')}</p>
            {error && <p role="alert" className="admin-resource-sheet__error">{error}</p>}
          </form>
          <footer className="mentee-sheet__foot mentee-sheet__foot--actions"><button type="submit" form="admin-resource-form" className="mentor-course-control mentor-course-import">{t('guardarRecurso', 'Guardar recurso')}</button></footer>
        </div>
      </dialog>
    </div>
  );
}
