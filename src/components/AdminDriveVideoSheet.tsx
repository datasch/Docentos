import { AdminSelect } from './AdminSelect';
import { useEffect, useRef } from 'react';
import { Link2, X } from 'lucide-react';
import type { Module } from '../types';

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (event: React.FormEvent) => void;
  modules: Module[];
  moduleId: string;
  onModuleId: (value: string) => void;
  url: string;
  onUrl: (value: string) => void;
  title: string;
  onTitle: (value: string) => void;
  duration: string;
  onDuration: (value: string) => void;
  busy: boolean;
  error: string;
}

export function AdminDriveVideoSheet({ open, onClose, onSubmit, modules, moduleId, onModuleId, url, onUrl, title, onTitle, duration, onDuration, busy, error }: Props) {
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
      <dialog ref={ref} className="mentee-sheet admin-drive-sheet" aria-labelledby="admin-drive-sheet-title" onClose={onClose} onClick={(event) => { if (event.target === ref.current && !busy) onClose(); }}>
        <div className="mentee-sheet__body admin-person-sheet">
          <header className="mentee-sheet__head">
            <span className="mentee-sheet__icon" aria-hidden="true"><Link2 /></span>
            <div className="mentor-mentee-id"><strong id="admin-drive-sheet-title">Añadir video</strong><span>Enlace de Drive o de reproducción</span></div>
            <button type="button" className="mentee-sheet__close" onClick={onClose} disabled={busy} aria-label="Cerrar"><X aria-hidden="true" /></button>
          </header>
          <form id="admin-drive-video-form" onSubmit={onSubmit} className="admin-person-sheet__scroll">
            <div className="meeting-field"><label htmlFor="admin-drive-video-url">Enlace del video</label><input id="admin-drive-video-url" type="text" placeholder="https://drive.google.com/file/d/..." value={url} onChange={(event) => onUrl(event.target.value)} required /></div>
            <div className="meeting-field"><label htmlFor="admin-drive-video-title">Título de la clase</label><input id="admin-drive-video-title" type="text" placeholder="Ej. Introducción a la arquitectura" value={title} onChange={(event) => onTitle(event.target.value)} required /></div>
            <div className="meeting-field"><label htmlFor="admin-drive-video-module">Módulo de destino</label><AdminSelect inline id="admin-drive-video-module" required value={moduleId} onChange={onModuleId} options={modules.map((module) => ({ value: module.id, label: module.title }))} /></div>
            <div className="meeting-field"><label htmlFor="admin-drive-video-duration">Duración <span className="admin-drive-sheet__optional">(opcional)</span></label><input id="admin-drive-video-duration" type="text" placeholder="20:00" value={duration} onChange={(event) => onDuration(event.target.value)} /></div>
            <p className="admin-resource-sheet__hint">El video aparecerá en el temario del curso dentro del módulo elegido.</p>
            {error && <p className="admin-resource-sheet__error" role="alert">{error}</p>}
          </form>
          <footer className="mentee-sheet__foot mentee-sheet__foot--actions"><button type="submit" form="admin-drive-video-form" className="mentor-course-control mentor-course-import" disabled={busy || modules.length === 0}>{busy ? 'Guardando…' : 'Guardar video'}</button></footer>
        </div>
      </dialog>
    </div>
  );
}
