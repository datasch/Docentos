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

import React, { useState, useEffect, useMemo } from 'react';
import {
  Video,
  Radio,
  Calendar,
  Clock,
  Plus,
  Trash2,
  Pencil,
  ExternalLink,
  Copy,
  Check,
  RefreshCw,
  Sparkles,
  Link2,
  PlaySquare,
  Globe,
  Layers,
  Search,
  X,
  AlertCircle,
  Save,
  CheckCircle2,
  Users,
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
import { useTranslation, Trans } from 'react-i18next'

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
  const { t } = useTranslation()
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [filterType, setFilterType] = useState<'ALL' | 'LIVE' | 'SYNC' | 'ASYNC'>('ALL');
  const [selectedCourseId, setSelectedCourseId] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string>('');

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
    flashNotice(t('salaJitsiGeneradaAutomaticamente', 'Sala Jitsi generada automáticamente'));
  };

  const handleSaveMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      setModalError(t('elTituloDeLaClaseEsObligatorio', 'El título de la clase es obligatorio'));
      return;
    }
    if (!formUrl.trim()) {
      setModalError(t('laUrlDeLaReunionOClaseEsObligatoria', 'La URL de la reunión o clase es obligatoria'));
      return;
    }

    try {
      setSaving(true);
      setModalError('');
      const normalizedUrl = normalizeMeetingUrl(formType, formUrl);

      if (editingMeeting) {
        const res = await api.updateMeeting(editingMeeting.id, {
          title: formTitle.trim(),
          description: formDescription.trim() || null,
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
          flashNotice(t('claseActualizadaCorrectamente', 'Clase actualizada correctamente'));
          setIsModalOpen(false);
        }
      } else {
        const res = await api.createMeeting({
          title: formTitle.trim(),
          description: formDescription.trim() || undefined,
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
          flashNotice(t('nuevaClaseProgramadaConExito', 'Nueva clase programada con éxito'));
          setIsModalOpen(false);
        }
      }
    } catch (err: any) {
      setModalError(err.message || t('errorAlGuardarLaReunion', 'Error al guardar la reunión'));
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
            ? t('transmisionEnVivoIniciadaTitle', '🔴 Transmisión EN VIVO iniciada: "{{title}}"', { title: meeting.title })
            : t('transmisionFinalizadaTitle', 'Transmisión finalizada: "{{title}}"', { title: meeting.title })
        );
      }
    } catch (err: any) {
      flashNotice(err.message || t('errorAlCambiarEstadoDeLaTransmision', 'Error al cambiar estado de la transmisión'));
    }
  };

  const handleDeleteMeeting = async (meeting: Meeting) => {
    if (!window.confirm(t('seguroQueDeseasEliminarLaClaseTitle', '¿Seguro que deseas eliminar la clase "{{title}}"?', { title: meeting.title }))) return;
    try {
      await api.deleteMeeting(meeting.id);
      setMeetings((prev) => prev.filter((m) => m.id !== meeting.id));
      flashNotice(t('claseEliminadaDelCatalogo', 'Clase eliminada del catálogo'));
    } catch (err: any) {
      flashNotice(err.message || t('errorAlEliminarLaClase', 'Error al eliminar la clase'));
    }
  };

  const handleCopyLink = async (meeting: Meeting) => {
    try {
      await navigator.clipboard.writeText(meeting.meetingUrl);
      setCopiedId(meeting.id);
      flashNotice(t('enlaceCopiadoAlPortapapeles', 'Enlace copiado al portapapeles'));
      setTimeout(() => setCopiedId(null), 2500);
    } catch {
      flashNotice(t('noSePudoCopiarAutomaticamenteElEnlace', 'No se pudo copiar automáticamente el enlace'));
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

  const liveCount = meetings.filter((m) => m.isLive).length;
  const syncCount = meetings.filter((m) => m.meetingType !== 'async_record').length;
  const asyncCount = meetings.filter((m) => m.meetingType === 'async_record').length;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Toast Notification Banner */}
      {actionNotice && (
        <div className="p-3 bg-brand-cyan/15 border border-brand-cyan/40 rounded-xl text-brand-cyan text-xs font-semibold flex items-center justify-between shadow-lg shadow-brand-cyan/10 animate-fade-in">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-brand-cyan" />
            <span>{actionNotice}</span>
          </div>
          <button onClick={() => setActionNotice('')} className="text-brand-cyan/70 hover:text-brand-cyan">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Header Banner - Giantucchi Design System */}
      <div className="bg-canvas border border-line rounded-2xl p-6 sm:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-xl">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-cyan/10 border border-brand-cyan/30 text-brand-cyan text-xs font-bold">
            <Radio className="w-3.5 h-3.5 animate-pulse text-brand-cyan" />
            <span>{t('livemeetingsEngineGoogleMeetJitsi', 'LiveMeetings Engine · Google Meet, Jitsi & Grabaciones')}</span>
          </div>
          <h2 className="text-2xl font-bold text-ink tracking-tight flex items-center gap-3">
            {t('gestorDeClasesSincronicasEnVivo', 'Gestor de Clases Sincrónicas & En Vivo')}
            {liveCount > 0 && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-micro font-bold bg-danger/20 text-danger-light border border-danger/40 animate-pulse-slow">
                <span className="w-2 h-2 rounded-full bg-danger animate-ping" />
                {t('liveCountEnVivo', '{{liveCount}} EN VIVO', { liveCount })}
              </span>
            )}
          </h2>
          <p className="text-xs text-ink-muted max-w-2xl leading-relaxed">
            {t('programaSesionesSincronicasConGeneracion', 'Programa sesiones sincrónicas con generación de salas instantáneas en Jitsi Meet, integra tus enlaces corporativos de Google Meet o publica grabaciones asincrónicas con streaming optimizado.')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <button
            onClick={loadMeetings}
            disabled={loading}
            className="px-3.5 py-2.5 bg-raised hover:bg-elevated border border-line text-ink-soft text-xs font-bold rounded-lg transition-all flex items-center gap-2"
            title={t('recargarReuniones', 'Recargar reuniones')}
          >
            <RefreshCw className={`w-3.5 h-3.5 text-brand-cyan ${loading ? 'animate-spin' : ''}`} />
            <span>{t('sincronizar', 'Sincronizar')}</span>
          </button>
          <button
            onClick={openCreateModal}
            className="btn-brand-primary px-4 py-2.5 text-xs font-bold rounded-lg flex items-center gap-2 shadow-lg shadow-brand-cyan/20"
          >
            <Plus className="w-4 h-4" />
            <span>{t('programarClase', 'Programar Clase')}</span>
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-raised border border-line rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-micro font-bold uppercase tracking-wider text-ink-muted">{t('totalClases', 'Total Clases')}</p>
            <h3 className="text-xl font-bold text-ink mt-0.5">{meetings.length}</h3>
          </div>
          <div className="w-9 h-9 rounded-lg bg-brand-cyan/10 border border-brand-cyan/30 flex items-center justify-center text-brand-cyan">
            <Video className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-raised border border-line rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-micro font-bold uppercase tracking-wider text-danger-light">{t('enVivoAhora', 'En Vivo Ahora')}</p>
            <h3 className="text-xl font-bold text-danger-light mt-0.5">{liveCount}</h3>
          </div>
          <div className="w-9 h-9 rounded-lg bg-danger/10 border border-danger/30 flex items-center justify-center text-danger-light">
            <Radio className="w-4 h-4 animate-pulse" />
          </div>
        </div>

        <div className="bg-raised border border-line rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-micro font-bold uppercase tracking-wider text-brand-purple">{t('sincronicas', 'Sincrónicas')}</p>
            <h3 className="text-xl font-bold text-brand-purple mt-0.5">{syncCount}</h3>
          </div>
          <div className="w-9 h-9 rounded-lg bg-brand-purple/10 border border-brand-purple/30 flex items-center justify-center text-brand-purple">
            <Calendar className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-raised border border-line rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-micro font-bold uppercase tracking-wider text-success-light">{t('asincronicas', 'Asincrónicas')}</p>
            <h3 className="text-xl font-bold text-success-light mt-0.5">{asyncCount}</h3>
          </div>
          <div className="w-9 h-9 rounded-lg bg-success/10 border border-success/30 flex items-center justify-center text-success-light">
            <PlaySquare className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Filter and Search Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {/* Type Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
          <button
            onClick={() => setFilterType('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${filterType === 'ALL'
                ? 'bg-brand-cyan text-black shadow-md'
                : 'bg-raised text-ink-muted hover:text-ink border border-line'
              }`}
          >
            {t('todasLength', 'Todas ({{length}})', { length: meetings.length })}
          </button>
          <button
            onClick={() => setFilterType('LIVE')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${filterType === 'LIVE'
                ? 'bg-danger text-ink shadow-md'
                : 'bg-raised text-ink-muted hover:text-danger-light border border-line'
              }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-danger-light" />
            {t('enVivoLiveCount', 'En Vivo ({{liveCount}})', { liveCount })}
          </button>
          <button
            onClick={() => setFilterType('SYNC')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${filterType === 'SYNC'
                ? 'bg-brand-purple text-ink shadow-md'
                : 'bg-raised text-ink-muted hover:text-ink border border-line'
              }`}
          >
            {t('sincronicasSyncCount', 'Sincrónicas ({{syncCount}})', { syncCount })}
          </button>
          <button
            onClick={() => setFilterType('ASYNC')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${filterType === 'ASYNC'
                ? 'bg-success text-black shadow-md'
                : 'bg-raised text-ink-muted hover:text-ink border border-line'
              }`}
          >
            {t('grabacionesAsyncCount', 'Grabaciones ({{asyncCount}})', { asyncCount })}
          </button>
        </div>

        {/* Course Filter Dropdown & Search */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full lg:w-auto">
          <select
            value={selectedCourseId}
            onChange={(e) => setSelectedCourseId(e.target.value)}
            className="w-full sm:w-48 md:w-56 truncate bg-raised border border-line text-ink-soft text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-brand-cyan shrink-0"
          >
            <option value="ALL">{t('todosLosCursos', 'Todos los Cursos')}</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>

          <div className="relative flex-1 sm:w-52 md:w-60">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint pointer-events-none" />
            <input
              type="text"
              placeholder={t('buscarClase', 'Buscar clase...')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-raised border border-line rounded-lg pl-8 pr-3 py-1.5 text-xs text-ink placeholder-ink-faint focus:outline-none focus:border-brand-cyan"
            />
          </div>
        </div>
      </div>

      {/* Meetings List */}
      {loading && meetings.length === 0 ? (
        <div className="py-20 text-center space-y-3 bg-raised/50 border border-line rounded-2xl">
          <RefreshCw className="w-8 h-8 mx-auto text-brand-cyan animate-spin" />
          <p className="text-xs font-bold text-ink-muted">{t('cargandoCatalogoDeClasesSincronicas', 'Cargando catálogo de clases sincrónicas...')}</p>
        </div>
      ) : filteredMeetings.length === 0 ? (
        <div className="py-16 text-center space-y-3 bg-raised/50 border border-line rounded-2xl p-6">
          <Video className="w-10 h-10 mx-auto text-ink-faint" />
          <h3 className="text-sm font-bold text-ink">{t('noSeEncontraronClases', 'No se encontraron clases')}</h3>
          <p className="text-xs text-ink-muted max-w-sm mx-auto">
            {searchQuery || filterType !== 'ALL' || selectedCourseId !== 'ALL'
              ? t('noHayReunionesQueCoincidanConLosFiltros', 'No hay reuniones que coincidan con los filtros seleccionados.')
              : t('programaTuPrimeraClaseSincronicaCon', 'Programa tu primera clase sincrónica con Google Meet o Jitsi Meet.')}
          </p>
          <button
            onClick={openCreateModal}
            className="btn-brand-primary px-4 py-2 text-xs font-bold rounded-lg inline-flex items-center gap-2 mt-2"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t('crearClaseAhora', 'Crear Clase Ahora')}</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredMeetings.map((meeting) => {
            const schedInfo = formatMeetingScheduledAt(meeting.scheduledAt);
            const isLive = meeting.isLive;

            return (
              <div
                key={meeting.id}
                className={`bg-raised border rounded-xl p-5 flex flex-col justify-between transition-all space-y-4 ${isLive
                    ? 'border-brand-cyan shadow-lg shadow-brand-cyan/10 ring-1 ring-brand-cyan/30'
                    : 'border-line hover:border-line-strong'
                  }`}
              >
                {/* Top Row: Badges & Actions */}
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      {isLive ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-micro font-bold bg-danger/20 text-danger-light border border-danger/50 animate-pulse-slow">
                          <span className="w-2 h-2 rounded-full bg-danger animate-ping" />
                          {t('enVivoAhora2', '🔴 ¡EN VIVO AHORA!')}
                        </span>
                      ) : meeting.meetingType === 'async_record' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-micro font-bold bg-success/10 text-success-light border border-success/30">
                          <PlaySquare className="w-3 h-3" />
                          {t('grabacionAsincronica', 'Grabación Asincrónica')}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-micro font-bold bg-brand-purple/10 text-brand-purple border border-brand-purple/30">
                          <Calendar className="w-3 h-3" />
                          {t('sincronicaProgramada', 'Sincrónica Programada')}
                        </span>
                      )}

                      {/* Provider Badge */}
                      <span className="px-2 py-0.5 rounded-md bg-elevated border border-line text-micro font-bold text-ink-soft uppercase">
                        {meeting.meetingType === 'jitsi'
                          ? t('jitsiMeet', 'Jitsi Meet')
                          : meeting.meetingType === 'meet'
                            ? t('googleMeet', 'Google Meet')
                            : t('grabacion', 'Grabación')}
                      </span>
                    </div>

                    {/* Action menu buttons */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => openEditModal(meeting)}
                        className="p-1.5 rounded-lg bg-elevated hover:bg-elevated border border-line text-ink-soft hover:text-ink transition-colors"
                        title={t('editarClase', 'Editar clase')}
                      >
                        <Pencil className="w-3.5 h-3.5 text-brand-cyan" />
                      </button>
                      <button
                        onClick={() => handleDeleteMeeting(meeting)}
                        className="p-1.5 rounded-lg bg-danger/10 hover:bg-danger/20 border border-danger/30 text-danger-light transition-colors"
                        title={t('eliminarClase', 'Eliminar clase')}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Title & Description */}
                  <div>
                    <h3 className="font-bold text-sm text-ink leading-snug line-clamp-2">
                      {meeting.title}
                    </h3>
                    {meeting.description && (
                      <p className="text-xs text-ink-muted mt-1 line-clamp-2 leading-relaxed">
                        {meeting.description}
                      </p>
                    )}
                  </div>

                  {/* Course & Module Context */}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-micro text-ink-muted pt-1">
                    {meeting.courseTitle && (
                      <span className="flex items-center gap-1 text-brand-cyan font-semibold">
                        <Layers className="w-3 h-3" />
                        {meeting.courseTitle}
                      </span>
                    )}
                    {meeting.moduleTitle && (
                      <span className="text-ink-faint">
                        • {meeting.moduleTitle}
                      </span>
                    )}
                  </div>
                </div>

                {/* Bottom Row: Scheduling, Host & Main CTA */}
                <div className="pt-3 border-t border-line/80 space-y-3">
                  <div className="flex flex-wrap items-center justify-between text-micro text-ink-muted gap-2">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-brand-cyan" />
                      <span>{schedInfo.dateFormatted} · {schedInfo.timeFormatted}</span>
                      <span className="text-micro text-ink-faint font-medium">({schedInfo.relativeLabel})</span>
                    </div>

                    {meeting.hostName && (
                      <div className="flex items-center gap-1.5 text-ink-muted">
                        <Users className="w-3 h-3 text-brand-purple" />
                        <span>{meeting.hostName}</span>
                      </div>
                    )}
                  </div>

                  {/* Buttons Toolbar */}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <a
                      href={meeting.meetingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`flex-1 min-w-[120px] px-3.5 py-2 rounded-lg text-xs font-bold text-center flex items-center justify-center gap-2 transition-all ${isLive
                          ? 'btn-brand-primary text-ink shadow-lg shadow-brand-cyan/20'
                          : 'bg-elevated hover:bg-elevated border border-brand-cyan/40 text-brand-cyan'
                        }`}
                    >
                      <Video className="w-3.5 h-3.5" />
                      <span>{isLive ? t('unirseALaClaseEnVivoBoton', 'Unirse a la Clase en Vivo') : t('abrirSalaEnlace', 'Abrir Sala / Enlace')}</span>
                      <ExternalLink className="w-3 h-3 opacity-70" />
                    </a>

                    <button
                      onClick={() => handleCopyLink(meeting)}
                      className="px-3 py-2 rounded-lg bg-raised hover:bg-elevated border border-line text-ink-soft text-xs font-bold transition-colors flex items-center gap-1.5"
                      title={t('copiarEnlaceDeLaClase', 'Copiar enlace de la clase')}
                    >
                      {copiedId === meeting.id ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-success-light" />
                          <span className="text-success-light">{t('copiado', '¡Copiado!')}</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-ink-muted" />
                          <span>{t('copiar', 'Copiar')}</span>
                        </>
                      )}
                    </button>

                    {meeting.meetingType !== 'async_record' && (
                      <button
                        onClick={() => handleToggleLive(meeting)}
                        className={`px-3 py-2 rounded-lg text-xs font-bold border transition-colors flex items-center gap-1.5 ${isLive
                            ? 'bg-danger/10 hover:bg-danger/20 border-danger/40 text-danger-light'
                            : 'bg-success/10 hover:bg-success/20 border-success/40 text-success-light'
                          }`}
                        title={isLive ? t('finalizarSesionEnVivo', 'Finalizar sesión en vivo') : t('iniciarSesionEnVivoAhora', 'Iniciar sesión en vivo ahora')}
                      >
                        <Radio className="w-3.5 h-3.5" />
                        <span>{isLive ? t('finalizar', 'Finalizar') : t('iniciarEnVivo', 'Iniciar En Vivo')}</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Programar / Editar Clase Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-canvas/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
          <div className="app-dialog bg-raised border border-line rounded-2xl w-full max-w-xl max-h-[calc(100dvh-2rem)] overflow-y-auto p-4 sm:p-7 space-y-6 shadow-2xl relative my-auto">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-3 right-3 flex h-11 w-11 items-center justify-center text-ink-muted hover:text-ink rounded-lg hover:bg-elevated"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-1 pr-10">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-brand-cyan/10 border border-brand-cyan/30 text-brand-cyan text-micro font-bold">
                <Video className="w-3 h-3" />
                <span>{t('livemeetingsProgramadorDeSesiones', 'LiveMeetings · Programador de Sesiones')}</span>
              </div>
              <h3 className="text-lg font-bold text-ink">
                {editingMeeting ? t('editarClase2', 'Editar Clase') : t('programarNuevaClase', 'Programar Nueva Clase')}
              </h3>
              <p className="text-xs text-ink-muted">
                {t('configuraElTipoDeSesionEnlaceDe', 'Configura el tipo de sesión, enlace de transmisión y fecha programada.')}
              </p>
            </div>

            {modalError && (
              <div className="p-3 rounded-xl bg-danger/15 border border-danger/40 text-danger-light text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleSaveMeeting} className="space-y-4">
              {/* Título de la clase */}
              <div>
                <label className="block text-xs font-bold text-ink-soft mb-1.5">
                  <Trans i18nKey="tituloDeLaClaseSesion">Título de la Clase / Sesión <span className="text-danger-light">*</span></Trans>
                </label>
                <input
                  type="text"
                  placeholder={t('ejMasterclassSincronicaArquitectura', 'Ej: Masterclass Sincrónica: Arquitectura Limpia y Despliegue')}
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  required
                  className="w-full bg-canvas border border-line rounded-xl px-3.5 py-2.5 text-xs text-ink placeholder-slate-600 focus:outline-none focus:border-brand-cyan"
                />
              </div>

              {/* Selector de Tipo de Clase (Segmented Control) */}
              <div>
                <label className="block text-xs font-bold text-ink-soft mb-2">
                  {t('tipoDeClaseProveedor', 'Tipo de Clase & Proveedor')}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setFormType('jitsi');
                      if (!formUrl || formUrl.includes('meet.google.com') || formUrl.includes('youtube.com')) {
                        setFormUrl(generateJitsiMeetingUrl());
                      }
                    }}
                    className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all ${formType === 'jitsi'
                        ? 'bg-brand-cyan/10 border-brand-cyan text-brand-cyan shadow-md shadow-brand-cyan/10'
                        : 'bg-canvas border-line text-ink-muted hover:text-ink'
                      }`}
                  >
                    <Globe className="w-4 h-4 mb-1" />
                    <div>
                      <p className="text-xs font-bold text-ink">{t('jitsiMeet', 'Jitsi Meet')}</p>
                      <p className="text-micro text-ink-faint">{t('salaDinamica1clic', 'Sala Dinámica 1-Clic')}</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setFormType('meet');
                      if (formUrl.includes('meet.jit.si')) setFormUrl('');
                    }}
                    className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all ${formType === 'meet'
                        ? 'bg-brand-purple/10 border-brand-purple text-brand-purple shadow-md shadow-brand-purple/10'
                        : 'bg-canvas border-line text-ink-muted hover:text-ink'
                      }`}
                  >
                    <Video className="w-4 h-4 mb-1" />
                    <div>
                      <p className="text-xs font-bold text-ink">{t('googleMeet', 'Google Meet')}</p>
                      <p className="text-micro text-ink-faint">{t('enlaceCorporativo', 'Enlace Corporativo')}</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setFormType('async_record');
                      setFormIsLive(false);
                      if (formUrl.includes('meet.jit.si') || formUrl.includes('meet.google.com')) setFormUrl('');
                    }}
                    className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all ${formType === 'async_record'
                        ? 'bg-success/10 border-success text-success-light shadow-md shadow-emerald-500/10'
                        : 'bg-canvas border-line text-ink-muted hover:text-ink'
                      }`}
                  >
                    <PlaySquare className="w-4 h-4 mb-1" />
                    <div>
                      <p className="text-xs font-bold text-ink">{t('asincronica', 'Asincrónica')}</p>
                      <p className="text-micro text-ink-faint">{t('videoGrabado', 'Video Grabado')}</p>
                    </div>
                  </button>
                </div>
              </div>

              {/* URL del Enlace */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-ink-soft">
                    {formType === 'jitsi'
                      ? t('enlaceDeSalaJitsiMeet', 'Enlace de Sala Jitsi Meet')
                      : formType === 'meet'
                        ? t('enlaceDeGoogleMeet', 'Enlace de Google Meet')
                        : t('enlaceDeLaGrabacionYoutubeVimeoDrive', 'Enlace de la Grabación (YouTube / Vimeo / Drive)')}
                    <span className="text-danger-light"> *</span>
                  </label>
                  {formType === 'jitsi' && (
                    <button
                      type="button"
                      onClick={handleGenerateJitsiUrl}
                      className="text-micro text-brand-cyan font-bold hover:underline flex items-center gap-1"
                    >
                      <Sparkles className="w-3 h-3" />
                      {t('generarSalaNueva', 'Generar Sala Nueva')}
                    </button>
                  )}
                </div>

                <div className="relative">
                  <Link2 className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
                  <input
                    type="url"
                    placeholder={
                      formType === 'jitsi'
                        ? 'https://meet.jit.si/docentos-mastery-live'
                        : formType === 'meet'
                          ? 'https://meet.google.com/abc-defg-hij'
                          : 'https://www.youtube.com/watch?v=...'
                    }
                    value={formUrl}
                    onChange={(e) => setFormUrl(e.target.value)}
                    required
                    className="w-full bg-canvas border border-line rounded-xl pl-9 pr-3.5 py-2.5 text-xs text-ink placeholder-slate-600 focus:outline-none focus:border-brand-cyan"
                  />
                </div>
                <p className="text-micro text-ink-faint mt-1">
                  {formType === 'jitsi'
                    ? t('losEstudiantesPodranIngresarSinInstalar', 'Los estudiantes podrán ingresar sin instalar aplicaciones adicionales directamente desde el navegador.')
                    : formType === 'meet'
                      ? t('pegaElEnlaceCreadoDesdeTuCuentaDeGoogle', 'Pega el enlace creado desde tu cuenta de Google Workspace o Meet.')
                      : t('permiteALosEstudiantesVerLaGrabacionDe', 'Permite a los estudiantes ver la grabación de una clase previa directamente en su reproductor.')}
                </p>
              </div>

              {/* Fecha y Hora Programada & Estado En Vivo */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-ink-soft mb-1.5">
                    {t('fechaYHoraProgramada', 'Fecha y Hora Programada')}
                  </label>
                  <input
                    type="datetime-local"
                    value={formScheduledAt}
                    onChange={(e) => setFormScheduledAt(e.target.value)}
                    className="w-full bg-canvas border border-line rounded-xl px-3 py-2 text-xs text-ink focus:outline-none focus:border-brand-cyan"
                  />
                </div>

                <div>
                  {formType === 'async_record' ? (
                    <div>
                      <label className="block text-xs font-bold text-ink-soft mb-1.5">
                        {t('modalidad', 'Modalidad')}
                      </label>
                      <div className="w-full py-2 px-3 rounded-xl border border-success/30 bg-success/10 text-success-light text-xs font-semibold flex items-center justify-center gap-2">
                        <PlaySquare className="w-3.5 h-3.5 text-success-light" />
                        <span>{t('grabacionBajoDemanda', 'Grabación Bajo Demanda')}</span>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-xs font-bold text-ink-soft mb-1.5">
                        {t('estadoDeTransmision', 'Estado de Transmisión')}
                      </label>
                      <button
                        type="button"
                        onClick={() => setFormIsLive(!formIsLive)}
                        className={`w-full py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${formIsLive
                            ? 'bg-danger/20 border-danger/50 text-danger-light'
                            : 'bg-canvas border-line text-ink-muted'
                          }`}
                      >
                        <Radio className={`w-3.5 h-3.5 ${formIsLive ? 'animate-pulse text-danger-light' : ''}`} />
                        <span>{formIsLive ? t('enVivoAhora3', '🔴 EN VIVO AHORA') : t('programadaOffline', 'Programada (Offline)')}</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Curso y Módulo Vinculados */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-ink-soft mb-1.5">
                    {t('cursoAsociado', 'Curso Asociado')}
                  </label>
                  <select
                    value={formCourseId}
                    onChange={(e) => {
                      setFormCourseId(e.target.value);
                      setFormModuleId('');
                    }}
                    className="w-full bg-canvas border border-line rounded-xl px-3 py-2 text-xs text-ink focus:outline-none focus:border-brand-cyan"
                  >
                    <option value="">{t('sinCursoAsignado', 'Sin curso asignado')}</option>
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-ink-soft mb-1.5">
                    {t('moduloEspecificoOpcional', 'Módulo Específico (Opcional)')}
                  </label>
                  <select
                    value={formModuleId}
                    onChange={(e) => setFormModuleId(e.target.value)}
                    disabled={!selectedCourse || selectedCourse.modules.length === 0}
                    className="w-full bg-canvas border border-line rounded-xl px-3 py-2 text-xs text-ink focus:outline-none focus:border-brand-cyan disabled:opacity-40"
                  >
                    <option value="">{t('todoElCurso', 'Todo el curso')}</option>
                    {selectedCourse?.modules.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Descripción opcional */}
              <div>
                <label className="block text-xs font-bold text-ink-soft mb-1.5">
                  {t('descripcionOTemasATratarOpcional', 'Descripción o Temas a Tratar (Opcional)')}
                </label>
                <textarea
                  rows={2}
                  placeholder={t('detallesSobreLosPuntosQueSeAbordaran', 'Detalles sobre los puntos que se abordarán durante la sesión...')}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full bg-canvas border border-line rounded-xl px-3.5 py-2 text-xs text-ink placeholder-slate-600 focus:outline-none focus:border-brand-cyan resize-none"
                />
              </div>

              {/* Botones de acción del Modal */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-line">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-elevated hover:bg-elevated border border-line text-xs font-bold text-ink-soft transition-colors"
                >
                  {t('cancelar', 'Cancelar')}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-brand-primary px-5 py-2 rounded-lg text-xs font-bold flex items-center gap-2"
                >
                  {saving ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>{t('guardando', 'Guardando...')}</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" />
                      <span>{editingMeeting ? t('guardarCambios2', 'Guardar Cambios') : t('crearClase', 'Crear Clase')}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
