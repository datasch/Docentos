/**
 * Gestor de Clases Sincrónicas y Asincrónicas (`MeetingManager.tsx`)
 * Academia Giantucchi / DocentOS
 *
 * Módulo para Mentores y Administradores para:
 * 1. Programar clases sincrónicas en vivo con Google Meet o salas automatizadas de Jitsi Meet
 * 2. Vincular grabaciones asincrónicas (YouTube / Vimeo / Google Drive)
 * 3. Activar o finalizar transmisiones en tiempo real (`isLive`)
 * 4. Gestionar salas, copiar enlaces y sincronizar con los cursos y módulos del catálogo
 */

import { useToastMessage } from '../lib/useToastMessage';
import { PageLoader } from './loading/PageLoader';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Video,
  UsersRound,
  Play,
  Square,
  ChevronLeft,
  ChevronRight,
  CirclePlay,
  Radio,
  Clock,
  Plus,
  Trash2,
  Pencil,
  ExternalLink,
  Copy,
  Check,
  RefreshCw,
  Layers,
  Search,
  X,
  AlertCircle,
} from 'lucide-react';
import { api } from '../lib/api';
import { Course, Meeting, MeetingType, User } from '../types';
import {
  generateJitsiMeetingUrl,
  generateJitsiRoomName,
  formatMeetingScheduledAt,
  normalizeMeetingUrl,
} from '../plugins/LiveMeetingsPlugin';
import { pluginManager } from '../plugins/PluginManager';
import { stripEmoji } from '../lib/stripEmoji';

interface MeetingManagerProps {
  currentUser: User;
  courses: Course[];
  onRefreshCourses?: () => void;
}

export const MeetingManager: React.FC<MeetingManagerProps> = ({
  currentUser,
  courses,
  onRefreshCourses,
}) => {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [filterType, setFilterType] = useState<'ALL' | 'LIVE' | 'SYNC' | 'ASYNC'>('ALL');
  const [selectedCourseId, setSelectedCourseId] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string>('');
  useToastMessage(actionNotice, 'success');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingMeeting, setEditingMeeting] = useState<Meeting | null>(null);
  const [saving, setSaving] = useState<boolean>(false);
  const [modalError, setModalError] = useState<string>('');

  // Form State
  const [formTitle, setFormTitle] = useState<string>('');
  const [formDescription, setFormDescription] = useState<string>('');
  const [formType, setFormType] = useState<MeetingType>('jitsi');
  const [formUrl, setFormUrl] = useState<string>('');
  const [formScheduledAt, setFormScheduledAt] = useState<string>(
    new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 16)
  );
  const [formIsLive, setFormIsLive] = useState<boolean>(false);
  const [formCourseId, setFormCourseId] = useState<string>(courses[0]?.id || '');
  const [formModuleId, setFormModuleId] = useState<string>('');
  const [formRecordingUrl, setFormRecordingUrl] = useState<string>('');

  useEffect(() => {
    loadMeetings();
  }, []);

  const [meetingLimit, setMeetingLimit] = useState<number>(12);
  const [slide, setSlide] = useState<number>(0);
  const listRef = useRef<HTMLUListElement>(null);
  const [deleteTarget, setDeleteTarget] = useState<Meeting | null>(null);
  const confirmRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = confirmRef.current;
    if (!d) return;
    if (deleteTarget && !d.open) d.showModal();
    if (!deleteTarget && d.open) d.close();
  }, [deleteTarget]);
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (isModalOpen && !d.open) d.showModal();
    if (!isModalOpen && d.open) d.close();
  }, [isModalOpen]);

  const flashNotice = (msg: string) => {
    setActionNotice(msg);
    setTimeout(() => setActionNotice(''), 3500);
  };

  const loadMeetings = async () => {
    try {
      setLoading(true);
      const res = await api.getMeetings();
      if (res.meetings) {
        setMeetings(res.meetings);
      }
    } catch (err: any) {
      console.error('Error al cargar reuniones:', err);
    } finally {
      setLoading(false);
    }
  };

  const selectedCourse = useMemo(() => {
    return courses.find((c) => c.id === formCourseId) || null;
  }, [courses, formCourseId]);

  const openCreateModal = () => {
    setEditingMeeting(null);
    setFormTitle('');
    setFormDescription('');
    setFormType('jitsi');
    const autoJitsi = generateJitsiMeetingUrl();
    setFormUrl(autoJitsi);
    setFormScheduledAt(new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 16));
    setFormIsLive(false);
    const initialCourseId = courses[0]?.id || '';
    setFormCourseId(initialCourseId);
    setFormModuleId('');
    setFormRecordingUrl('');
    setModalError('');
    setIsModalOpen(true);
  };

  const openEditModal = (meeting: Meeting) => {
    setEditingMeeting(meeting);
    setFormTitle(meeting.title);
    setFormDescription(meeting.description || '');
    setFormType((meeting.meetingType as MeetingType) || 'jitsi');
    setFormUrl(meeting.meetingUrl);
    try {
      const d = new Date(meeting.scheduledAt);
      if (!Number.isNaN(d.getTime())) {
        const offset = d.getTimezoneOffset() * 60000;
        const localIso = new Date(d.getTime() - offset).toISOString().slice(0, 16);
        setFormScheduledAt(localIso);
      } else {
        setFormScheduledAt(new Date().toISOString().slice(0, 16));
      }
    } catch {
      setFormScheduledAt(new Date().toISOString().slice(0, 16));
    }
    setFormIsLive(meeting.isLive);
    setFormCourseId(meeting.courseId || '');
    setFormModuleId(meeting.moduleId || '');
    setFormRecordingUrl(meeting.recordingUrl || '');
    setModalError('');
    setIsModalOpen(true);
  };

  const handleGenerateJitsiUrl = () => {
    const newUrl = generateJitsiMeetingUrl();
    setFormUrl(newUrl);
    flashNotice('Sala Jitsi generada automáticamente');
  };

  const handleSaveMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripEmoji(formTitle)) {
      setModalError('El título de la clase es obligatorio');
      return;
    }
    if (!formUrl.trim()) {
      setModalError('La URL de la reunión o clase es obligatoria');
      return;
    }

    try {
      setSaving(true);
      setModalError('');
      const normalizedUrl = normalizeMeetingUrl(formType, formUrl);

      if (editingMeeting) {
        const res = await api.updateMeeting(editingMeeting.id, {
          title: stripEmoji(formTitle),
          description: stripEmoji(formDescription) || null,
          meetingType: formType,
          meetingUrl: normalizedUrl,
          scheduledAt: new Date(formScheduledAt).toISOString(),
          isLive: formType === 'async_record' ? false : formIsLive,
          courseId: formCourseId || null,
          moduleId: formModuleId || null,
          recordingUrl: formRecordingUrl.trim() || null,
        });
        if (res.meeting) {
          setMeetings((prev) => prev.map((m) => (m.id === res.meeting.id ? res.meeting : m)));
          flashNotice('Clase actualizada correctamente');
          setIsModalOpen(false);
        }
      } else {
        const res = await api.createMeeting({
          title: stripEmoji(formTitle),
          description: stripEmoji(formDescription) || undefined,
          meetingType: formType,
          meetingUrl: normalizedUrl,
          scheduledAt: new Date(formScheduledAt).toISOString(),
          isLive: formType === 'async_record' ? false : formIsLive,
          courseId: formCourseId || undefined,
          moduleId: formModuleId || undefined,
          recordingUrl: formRecordingUrl.trim() || undefined,
        });
        if (res.meeting) {
          setMeetings((prev) => [res.meeting, ...prev]);
          flashNotice('Nueva clase programada con éxito');
          setIsModalOpen(false);
        }
      }
    } catch (err: any) {
      setModalError(err.message || 'Error al guardar la reunión');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleLive = async (meeting: Meeting) => {
    try {
      const res = await api.toggleMeetingLive(meeting.id, !meeting.isLive);
      if (res.meeting) {
        setMeetings((prev) => prev.map((m) => (m.id === res.meeting.id ? res.meeting : m)));
        flashNotice(
          res.meeting.isLive
            ? `Transmisión en vivo iniciada: "${stripEmoji(meeting.title)}"`
            : `Transmisión finalizada: "${stripEmoji(meeting.title)}"`
        );
      }
    } catch (err: any) {
      flashNotice(err.message || 'Error al cambiar estado de la transmisión');
    }
  };

  const handleDeleteMeeting = async (meeting: Meeting) => {
    try {
      await api.deleteMeeting(meeting.id);
      setMeetings((prev) => prev.filter((m) => m.id !== meeting.id));
      flashNotice('Clase eliminada');
    } catch (err: any) {
      flashNotice(err.message || 'Error al eliminar la clase');
    } finally {
      setDeleteTarget(null);
    }
  };

  const handleCopyLink = async (meeting: Meeting) => {
    try {
      await navigator.clipboard.writeText(meeting.meetingUrl);
      setCopiedId(meeting.id);
      flashNotice('Enlace copiado al portapapeles');
      setTimeout(() => setCopiedId(null), 2500);
    } catch {
      flashNotice('No se pudo copiar automáticamente el enlace');
    }
  };

  const filteredMeetings = useMemo(() => {
    return meetings.filter((m) => {
      // Type tab filter
      if (filterType === 'LIVE' && !m.isLive) return false;
      if (filterType === 'SYNC' && m.meetingType === 'async_record') return false;
      if (filterType === 'ASYNC' && m.meetingType !== 'async_record') return false;

      // Course filter
      if (selectedCourseId !== 'ALL' && m.courseId !== selectedCourseId) return false;

      // Query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = m.title.toLowerCase().includes(q);
        const matchDesc = m.description?.toLowerCase().includes(q) || false;
        const matchCourse = m.courseTitle?.toLowerCase().includes(q) || false;
        if (!matchTitle && !matchDesc && !matchCourse) return false;
      }

      return true;
    });
  }, [meetings, filterType, selectedCourseId, searchQuery]);

  useEffect(() => {
    setMeetingLimit(12);
    setSlide(0);
    if (listRef.current) listRef.current.scrollLeft = 0;
  }, [filterType, selectedCourseId, searchQuery]);

  const liveCount = meetings.filter((m) => m.isLive).length;
  const syncCount = meetings.filter((m) => m.meetingType !== 'async_record').length;
  const asyncCount = meetings.filter((m) => m.meetingType === 'async_record').length;

  const stateOf = (m: Meeting): 'live' | 'recording' | 'ended' | 'scheduled' =>
    m.isLive
      ? 'live'
      : m.meetingType === 'async_record'
        ? 'recording'
        : formatMeetingScheduledAt(m.scheduledAt).isPast
          ? 'ended'
          : 'scheduled';

  /** Un color estable por curso: así se distingue de un vistazo a qué curso pertenece cada clase. */
  const courseHue = (id?: string | null) => {
    if (!id) return 0;
    // Ángulo áureo sobre la posición del curso: tonos bien separados aunque haya muchos cursos.
    const index = courses.findIndex((c) => c.id === id);
    if (index >= 0) return Math.round((255 + index * 137.508) % 360);
    let h = 0;
    for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) % 360;
    return h;
  };

  const slideStep = () => {
    const list = listRef.current;
    const first = list?.firstElementChild as HTMLElement | null;
    return first ? first.offsetWidth + 12 : 0;
  };
  const goToSlide = (direction: 1 | -1) => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    listRef.current?.scrollBy({ left: direction * slideStep(), behavior: reduce ? 'auto' : 'smooth' });
  };

  const typeLabel = (m: Meeting) =>
    m.meetingType === 'jitsi' ? 'Jitsi Meet' : m.meetingType === 'meet' ? 'Google Meet' : 'Grabación';

  const whenLabel = (value: string) => {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    const day = d.toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'short' });
    const time = d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
    return `${day} · ${time}`;
  };

  const filterOptions = [
    { id: 'ALL', label: 'Todas', count: meetings.length },
    { id: 'LIVE', label: 'En vivo', count: liveCount },
    { id: 'SYNC', label: 'Sesiones', count: syncCount },
    { id: 'ASYNC', label: 'Grabaciones', count: asyncCount },
  ] as const;

  return (
    <section className="mentor-meetings-panel" aria-labelledby="mentor-meetings-title">
      <div className="mentor-section-heading">
        <div>
          <h2 id="mentor-meetings-title">Clases en vivo</h2>
          <p>Programa sesiones, comparte la sala y publica las grabaciones</p>
        </div>
        <div className="mentor-meetings-actions">
          <button type="button" className="mentor-course-control mentor-course-import" onClick={openCreateModal}>
            <Plus aria-hidden="true" />
            Programar clase
          </button>
          <button
            type="button"
            className="mentor-course-control mentor-icon-control"
            onClick={loadMeetings}
            disabled={loading}
            aria-label="Actualizar clases"
            title="Actualizar clases"
          >
            <RefreshCw aria-hidden="true" className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>


      <div className="mentor-course-toolbar">
        <label className="mentor-mentee-search">
          <Search aria-hidden="true" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar clase"
            aria-label="Buscar clase"
          />
        </label>
        {courses.length > 1 && (
          <select
            className="mentor-meetings-select"
            value={selectedCourseId}
            onChange={(e) => setSelectedCourseId(e.target.value)}
            aria-label="Filtrar por curso"
          >
            <option value="ALL">Todos los cursos</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>{stripEmoji(c.title)}</option>
            ))}
          </select>
        )}
        <div className="mentor-publication-filters" data-options="4" role="group" aria-label="Filtrar clases">
          {filterOptions.map((o) => (
            <button key={o.id} type="button" aria-pressed={filterType === o.id} onClick={() => setFilterType(o.id)}>
              <span>{o.label}</span>
              <span className="mentor-publication-count">{o.count}</span>
            </button>
          ))}
        </div>
      </div>

      {loading && meetings.length === 0 ? (
        <PageLoader label="Cargando clases" />
      ) : filteredMeetings.length === 0 ? (
        <div className="mentor-courses-empty" role="status">
          <Video aria-hidden="true" />
          <p>{meetings.length === 0 ? 'Aún no hay clases programadas' : 'Ninguna clase coincide con los filtros'}</p>
          {meetings.length === 0 && (
            <button type="button" className="mentor-course-control mentor-course-import" onClick={openCreateModal}>
              <Plus aria-hidden="true" />
              Programar clase
            </button>
          )}
        </div>
      ) : (
        <>
        <ul
          ref={listRef}
          className="mentor-meetings-list"
          onScroll={(e) => {
            const step = slideStep();
            if (step > 0) setSlide(Math.round(e.currentTarget.scrollLeft / step));
          }}
        >
          {filteredMeetings.slice(0, meetingLimit).map((meeting) => {
            const state = stateOf(meeting);
            const info = formatMeetingScheduledAt(meeting.scheduledAt);
            return (
              <li key={meeting.id} className="mentor-meeting-card" data-state={state}>
                <header className="mentor-meeting-card__head">
                  <div className="mentor-meeting-card__when">
                    <strong>{typeLabel(meeting)}</strong>
                    <span>{whenLabel(meeting.scheduledAt)}</span>
                  </div>
                  <span className="mentor-meeting-status" data-state={state}>
                    {state === 'live' ? 'En vivo ahora' : state === 'recording' ? 'Disponible' : state === 'ended' ? 'Finalizada' : 'Programada'}
                  </span>
                </header>

                <div className="mentor-meeting-card__body">
                  <p
                    className="mentor-meeting-card__course"
                    data-empty={meeting.courseTitle ? undefined : 'true'}
                    style={{ '--course-hue': courseHue(meeting.courseId) } as React.CSSProperties}
                    title={[meeting.courseTitle, meeting.moduleTitle].filter(Boolean).join(' · ') || undefined}
                  >
                    <i aria-hidden="true" />
                    <span>
                      <strong>{stripEmoji(meeting.courseTitle) || 'Sin curso asignado'}</strong>
                      <small>{stripEmoji(meeting.moduleTitle) || (meeting.courseTitle ? 'Todo el curso' : '')}</small>
                    </span>
                  </p>
                  <h3 title={stripEmoji(meeting.title)}>{stripEmoji(meeting.title)}</h3>
                  {stripEmoji(meeting.description) && <p className="mentor-meeting-card__desc">{stripEmoji(meeting.description)}</p>}
                </div>

                <div className="mentor-meeting-card__meta">
                  <span><Clock aria-hidden="true" />{state === 'recording' ? 'Bajo demanda' : info.relativeLabel}</span>
                  {meeting.hostName && <span><UsersRound aria-hidden="true" />{meeting.hostName}</span>}
                </div>

                <div className="mentor-meeting-card__actions">
                  {state === 'live' && (
                    <>
                      <a className="mentor-course-control mentor-course-import mentor-span-2" href={meeting.meetingUrl} target="_blank" rel="noopener noreferrer">
                        <Video aria-hidden="true" />
                        Unirse a la clase
                      </a>
                      <button type="button" className="mentor-course-control" onClick={() => handleCopyLink(meeting)}>
                        {copiedId === meeting.id ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
                        {copiedId === meeting.id ? 'Copiado' : 'Copiar enlace'}
                      </button>
                      <button type="button" className="mentor-course-control" onClick={() => handleToggleLive(meeting)}>
                        <Square aria-hidden="true" />
                        Terminar clase
                      </button>
                    </>
                  )}
                  {state === 'scheduled' && (
                    <>
                      <button type="button" className="mentor-course-control mentor-course-import mentor-span-2" onClick={() => handleToggleLive(meeting)}>
                        <Play aria-hidden="true" />
                        Iniciar clase en vivo
                      </button>
                      <a className="mentor-course-control" href={meeting.meetingUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink aria-hidden="true" />
                        Abrir sala
                      </a>
                      <button type="button" className="mentor-course-control" onClick={() => handleCopyLink(meeting)}>
                        {copiedId === meeting.id ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
                        {copiedId === meeting.id ? 'Copiado' : 'Copiar enlace'}
                      </button>
                    </>
                  )}
                  {(state === 'recording' || state === 'ended') && (
                    <>
                      <a
                        className={`mentor-course-control mentor-span-2${state === 'recording' ? ' mentor-course-import' : ''}`}
                        href={meeting.recordingUrl || meeting.meetingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {state === 'recording' ? <CirclePlay aria-hidden="true" /> : <ExternalLink aria-hidden="true" />}
                        {state === 'recording' || meeting.recordingUrl ? 'Ver grabación' : 'Abrir sala'}
                      </a>
                      <button type="button" className="mentor-course-control mentor-span-2" onClick={() => handleCopyLink(meeting)}>
                        {copiedId === meeting.id ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
                        {copiedId === meeting.id ? 'Copiado' : 'Copiar enlace'}
                      </button>
                    </>
                  )}
                </div>

                <footer className="mentor-meeting-card__foot">
                  <button type="button" className="mentor-course-control" onClick={() => openEditModal(meeting)}>
                    <Pencil aria-hidden="true" />
                    Editar
                  </button>
                  <button type="button" className="mentor-course-control" data-danger="true" onClick={() => setDeleteTarget(meeting)}>
                    <Trash2 aria-hidden="true" />
                    Eliminar
                  </button>
                </footer>
              </li>
            );
          })}
        </ul>

        {filteredMeetings.length > 1 && (
          <div className="mentor-meetings-carousel" role="group" aria-label="Desplazar clases">
            <button type="button" className="mentor-course-control mentor-icon-control" onClick={() => goToSlide(-1)} disabled={slide <= 0} aria-label="Clase anterior">
              <ChevronLeft aria-hidden="true" />
            </button>
            <span role="status" aria-live="polite">{Math.min(slide + 1, Math.min(filteredMeetings.length, meetingLimit))} de {Math.min(filteredMeetings.length, meetingLimit)}</span>
            <button type="button" className="mentor-course-control mentor-icon-control" onClick={() => goToSlide(1)} disabled={slide >= Math.min(filteredMeetings.length, meetingLimit) - 1} aria-label="Clase siguiente">
              <ChevronRight aria-hidden="true" />
            </button>
          </div>
        )}

        {filteredMeetings.length > meetingLimit && (
          <div className="mentor-mentee-more">
            <span className="mentor-course-filter-result" role="status">{meetingLimit} de {filteredMeetings.length} clases</span>
            <button type="button" className="mentor-course-control" onClick={() => setMeetingLimit((l) => l + 12)}>Mostrar más</button>
          </div>
        )}
        </>
      )}

      <dialog
        ref={dialogRef}
        className="mentee-sheet"
        aria-labelledby="meeting-form-title"
        onCancel={(e) => { e.preventDefault(); setIsModalOpen(false); }}
        onClick={(e) => { if (e.target === e.currentTarget) setIsModalOpen(false); }}
      >
        {isModalOpen && (
          <form className="mentee-sheet__body" onSubmit={handleSaveMeeting}>
            <header className="mentee-sheet__head mentee-sheet__head--plain">
              <div className="mentor-mentee-id">
                <strong id="meeting-form-title">{editingMeeting ? 'Editar clase' : 'Programar clase'}</strong>
                <span>Tipo de sesión, enlace y fecha</span>
              </div>
              <button type="button" className="mentee-sheet__close" onClick={() => setIsModalOpen(false)} aria-label="Cerrar">
                <X aria-hidden="true" />
              </button>
            </header>

            <div className="mentee-sheet__list mentor-meeting-form">
              {modalError && (
                <p className="mentee-sheet__error" role="alert">
                  <AlertCircle aria-hidden="true" /> <span>{modalError}</span>
                </p>
              )}

              <label className="meeting-field">
                <span>Título</span>
                <input
                  type="text"
                  placeholder="Ej: Masterclass de arquitectura limpia"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  required
                />
              </label>

              <fieldset className="meeting-field">
                <legend>Tipo de clase</legend>
                <div className="meeting-types" role="radiogroup" aria-label="Tipo de clase">
                  {([
                    { id: 'jitsi', label: 'Jitsi Meet', hint: 'Sala al instante' },
                    { id: 'meet', label: 'Google Meet', hint: 'Tu enlace' },
                    { id: 'async_record', label: 'Grabación', hint: 'Video previo' },
                  ] as const).map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      role="radio"
                      aria-checked={formType === option.id}
                      onClick={() => {
                        setFormType(option.id);
                        if (option.id === 'jitsi') {
                          if (!formUrl || formUrl.includes('meet.google.com') || formUrl.includes('youtube.com')) {
                            setFormUrl(generateJitsiMeetingUrl());
                          }
                        } else if (option.id === 'meet') {
                          if (formUrl.includes('meet.jit.si')) setFormUrl('');
                        } else {
                          setFormIsLive(false);
                          if (formUrl.includes('meet.jit.si') || formUrl.includes('meet.google.com')) setFormUrl('');
                        }
                      }}
                    >
                      <strong>{option.label}</strong>
                      <small>{option.hint}</small>
                    </button>
                  ))}
                </div>
              </fieldset>

              <div className="meeting-field">
                <div className="meeting-field__row">
                  <label htmlFor="meeting-url">
                    {formType === 'jitsi' ? 'Enlace de la sala' : formType === 'meet' ? 'Enlace de Google Meet' : 'Enlace de la grabación'}
                  </label>
                  {formType === 'jitsi' && (
                    <button type="button" className="meeting-field__link" onClick={handleGenerateJitsiUrl}>
                      Generar sala nueva
                    </button>
                  )}
                </div>
                <input
                  id="meeting-url"
                  type="url"
                  placeholder={
                    formType === 'jitsi'
                      ? 'https://meet.jit.si/docentos-sala'
                      : formType === 'meet'
                        ? 'https://meet.google.com/abc-defg-hij'
                        : 'https://www.youtube.com/watch?v=...'
                  }
                  value={formUrl}
                  onChange={(e) => setFormUrl(e.target.value)}
                  required
                />
                <small>
                  {formType === 'jitsi'
                    ? 'Los alumnos entran desde el navegador, sin instalar nada.'
                    : formType === 'meet'
                      ? 'Pega el enlace creado desde tu cuenta de Google.'
                      : 'YouTube, Vimeo o Drive. Se reproduce dentro de la plataforma.'}
                </small>
              </div>

              <label className="meeting-field">
                <span>Fecha y hora</span>
                <input type="datetime-local" value={formScheduledAt} onChange={(e) => setFormScheduledAt(e.target.value)} />
              </label>

              {formType !== 'async_record' && (
                <label className="roster-option">
                  <input type="checkbox" checked={formIsLive} onChange={(e) => setFormIsLive(e.target.checked)} />
                  <span className="roster-option__text">
                    <strong>Transmitir en vivo ahora</strong>
                    <small>Los alumnos verán la clase como activa</small>
                  </span>
                </label>
              )}

              <label className="meeting-field">
                <span>Curso</span>
                <select
                  value={formCourseId}
                  onChange={(e) => { setFormCourseId(e.target.value); setFormModuleId(''); }}
                >
                  <option value="">Sin curso asignado</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>{stripEmoji(c.title)}</option>
                  ))}
                </select>
              </label>

              <label className="meeting-field">
                <span>Módulo <em>(opcional)</em></span>
                <select
                  value={formModuleId}
                  onChange={(e) => setFormModuleId(e.target.value)}
                  disabled={!selectedCourse || selectedCourse.modules.length === 0}
                >
                  <option value="">Todo el curso</option>
                  {selectedCourse?.modules.map((m) => (
                    <option key={m.id} value={m.id}>{stripEmoji(m.title)}</option>
                  ))}
                </select>
              </label>

              <label className="meeting-field">
                <span>Descripción <em>(opcional)</em></span>
                <textarea
                  rows={3}
                  placeholder="Temas que se tratarán en la sesión"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                />
              </label>
            </div>

            <footer className="mentee-sheet__foot mentee-sheet__foot--actions">
              <div>
                <button type="button" className="mentor-course-control" onClick={() => setIsModalOpen(false)}>
                  Cancelar
                </button>
                <button type="submit" className="mentor-course-control mentor-course-import" disabled={saving}>
                  {saving && <RefreshCw aria-hidden="true" className="animate-spin" />}
                  {editingMeeting ? 'Guardar cambios' : 'Crear clase'}
                </button>
              </div>
            </footer>
          </form>
        )}
      </dialog>

      <dialog
        ref={confirmRef}
        className="mentor-confirm"
        aria-labelledby="meeting-delete-title"
        onCancel={(e) => { e.preventDefault(); setDeleteTarget(null); }}
        onClick={(e) => { if (e.target === e.currentTarget) setDeleteTarget(null); }}
      >
        {deleteTarget && (
          <div className="mentor-confirm__body">
            <h3 id="meeting-delete-title">Eliminar clase</h3>
            <p>
              Vas a eliminar <strong>{stripEmoji(deleteTarget.title)}</strong>. Los alumnos dejarán de verla. Esta acción es <strong className="mentor-confirm__permanent">permanente</strong>.
            </p>
            <div className="mentor-confirm__actions">
              <button type="button" className="mentor-course-control" onClick={() => setDeleteTarget(null)}>
                Cancelar
              </button>
              <button type="button" className="mentor-course-control" data-danger="true" onClick={() => handleDeleteMeeting(deleteTarget)}>
                <Trash2 aria-hidden="true" />
                Eliminar
              </button>
            </div>
          </div>
        )}
      </dialog>
    </section>
  );
};
