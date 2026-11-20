import { AdminSelect } from './AdminSelect';
import { useEffect, useRef } from 'react';
import { X, ArrowLeft, GraduationCap } from 'lucide-react';
import type { User, Course, CourseEnrollmentRecord } from '../types';

type Status = CourseEnrollmentRecord['status'];
type Source = Exclude<CourseEnrollmentRecord['source'], 'IMPORT'>;

interface Props {
  open: boolean;
  /** Se abrió desde la hoja de una persona: cerrar esta hoja devuelve a esa hoja. */
  canGoBack?: boolean;
  onClose: () => void;
  users: User[];
  courses: Course[];
  userId: string;
  courseId: string;
  status: Status;
  source: Source;
  onUserId: (v: string) => void;
  onCourseId: (v: string) => void;
  onStatus: (v: Status) => void;
  onSource: (v: Source) => void;
  onSubmit: (e: React.FormEvent) => void;
}

/** Alta de matrícula en la hoja lateral, igual que el resto de formularios del panel. */
export function AdminEnrollSheet({ open, canGoBack, onClose, users, courses, userId, courseId, status, source, onUserId, onCourseId, onStatus, onSource, onSubmit }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <div data-mentor-ui="modern" className="admin-courses-root">
      <dialog
        ref={ref}
        className="mentee-sheet"
        aria-labelledby="admin-enroll-title"
        onClose={onClose}
        onClick={(e) => { if (e.target === ref.current) onClose(); }}
      >
        <div className="mentee-sheet__body admin-person-sheet">
          <header className="mentee-sheet__head">
            {canGoBack ? (
              <button type="button" className="mentee-sheet__close" onClick={onClose} aria-label="Volver a gestionar">
                <ArrowLeft aria-hidden="true" />
              </button>
            ) : (
              <span className="mentee-sheet__icon" aria-hidden="true"><GraduationCap /></span>
            )}
            <div className="mentor-mentee-id">
              <strong id="admin-enroll-title">Nueva matrícula</strong>
              <span>Da acceso a un usuario a un curso.</span>
            </div>
            <button type="button" className="mentee-sheet__close" onClick={onClose} aria-label="Cerrar">
              <X aria-hidden="true" />
            </button>
          </header>

          <form id="admin-enroll-form" onSubmit={onSubmit} className="admin-person-sheet__scroll">
            <div className="meeting-field">
              <label htmlFor="enroll-user">Usuario</label>
              <AdminSelect inline id="enroll-user" required value={userId} onChange={onUserId} placeholder="Selecciona un usuario" options={users.map((u) => ({ value: u.id, label: u.name, hint: u.email }))} />
            </div>
            <div className="meeting-field">
              <label htmlFor="enroll-course">Curso</label>
              <AdminSelect inline id="enroll-course" required value={courseId} onChange={onCourseId} placeholder="Selecciona un curso" options={courses.map((c) => ({ value: c.id, label: `${c.title}${c.published === false ? ' (borrador)' : ''}` }))} />
            </div>
            <div className="meeting-field__row">
              <div className="meeting-field">
                <label htmlFor="enroll-status">Estado</label>
                <AdminSelect inline id="enroll-status" value={status} onChange={(v) => onStatus(v as Status)} options={[{ value: 'ACTIVE', label: 'Activa' }, { value: 'COMPLETED', label: 'Graduado' }, { value: 'REVOKED', label: 'Revocada' }, { value: 'EXPIRED', label: 'Expirada' }]} />
              </div>
              <div className="meeting-field">
                <label htmlFor="enroll-source">Origen</label>
                <AdminSelect inline id="enroll-source" value={source} onChange={(v) => onSource(v as Source)} options={[{ value: 'ADMIN', label: 'Asignación directa' }, { value: 'PAYMENT', label: 'Pago' }, { value: 'MENTORSHIP', label: 'Mentoría' }]} />
              </div>
            </div>
          </form>

          <footer className="mentee-sheet__foot mentee-sheet__foot--actions">
            {canGoBack && (
              <button type="button" className="mentor-course-control" onClick={onClose}>
                <ArrowLeft aria-hidden="true" /> Volver a gestionar
              </button>
            )}
            <button type="submit" form="admin-enroll-form" className="mentor-course-control mentor-course-import">
              Matricular
            </button>
          </footer>
        </div>
      </dialog>
    </div>
  );
}
