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
    const pluginCfg = pluginManager.getPlugin('live-meetings')?.config;
    const defType: MeetingType = (pluginCfg?.defaultProvider as MeetingType) || 'jitsi';
    const jitsiDomain = (pluginCfg?.jitsiDomain as string) || 'meet.jit.si';
    setFormType(defType);
    if (defType === 'jitsi') {
      setFormUrl(generateJitsiMeetingUrl(undefined, jitsiDomain));
    } else {
      setFormUrl('');
    }
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
    const pluginCfg = pluginManager.getPlugin('live-meetings')?.config;
    const jitsiDomain = (pluginCfg?.jitsiDomain as string) || 'meet.jit.si';
    const newUrl = generateJitsiMeetingUrl(undefined, jitsiDomain);
    setFormUrl(newUrl);
    flashNotice('Sala Jitsi generada automáticamente');
  };

  const handleSaveMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
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
          flashNotice('Clase actualizada correctamente');
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
            ? `🔴 Transmisión EN VIVO iniciada: "${meeting.title}"`
            : `Transmisión finalizada: "${meeting.title}"`
        );
      }
    } catch (err: any) {
      flashNotice(err.message || 'Error al cambiar estado de la transmisión');
    }
  };

  const handleDeleteMeeting = async (meeting: Meeting) => {
    if (!window.confirm(`¿Seguro que deseas eliminar la clase "${meeting.title}"?`)) return;
    try {
      await api.deleteMeeting(meeting.id);
      setMeetings((prev) => prev.filter((m) => m.id !== meeting.id));
      flashNotice('Clase eliminada del catálogo');
    } catch (err: any) {
      flashNotice(err.message || 'Error al eliminar la clase');
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

  const liveCount = meetings.filter((m) => m.isLive).length;
  const syncCount = meetings.filter((m) => m.meetingType !== 'async_record').length;
  const asyncCount = meetings.filter((m) => m.meetingType === 'async_record').length;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Toast Notification Banner */}
      {actionNotice && (
        <div className="p-3 bg-[#06b6d4]/15 border border-[#06b6d4]/40 rounded-xl text-[#06b6d4] text-xs font-semibold flex items-center justify-between shadow-lg shadow-[#06b6d4]/10 animate-fade-in">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#06b6d4]" />
            <span>{actionNotice}</span>
          </div>
          <button onClick={() => setActionNotice('')} className="text-[#06b6d4]/70 hover:text-[#06b6d4]">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Header Banner - Giantucchi Design System */}
      <div className="bg-[#0a0a0f] border border-[#262626] rounded-2xl p-6 sm:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-xl">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#06b6d4]/10 border border-[#06b6d4]/30 text-[#06b6d4] text-xs font-bold">
            <Radio className="w-3.5 h-3.5 animate-pulse text-[#06b6d4]" />
            <span>LiveMeetings Engine · Google Meet, Jitsi & Grabaciones</span>
          </div>
          <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-3">
            Gestor de Clases Sincrónicas & En Vivo
            {liveCount > 0 && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse-slow">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                {liveCount} EN VIVO
              </span>
            )}
          </h2>
          <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
            Programa sesiones sincrónicas con generación de salas instantáneas en Jitsi Meet, integra tus enlaces corporativos de Google Meet o publica grabaciones asincrónicas con streaming optimizado.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <button
            onClick={loadMeetings}
            disabled={loading}
            className="px-3.5 py-2.5 bg-[#141420] hover:bg-[#1c1c30] border border-[#2d2d44] text-slate-300 text-xs font-bold rounded-lg transition-all flex items-center gap-2"
            title="Recargar reuniones"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#06b6d4] ${loading ? 'animate-spin' : ''}`} />
            <span>Sincronizar</span>
          </button>
          <button
            onClick={openCreateModal}
            className="btn-brand-primary px-4 py-2.5 text-xs font-extrabold rounded-lg flex items-center gap-2 shadow-lg shadow-[#06b6d4]/20"
          >
            <Plus className="w-4 h-4" />
            <span>Programar Clase</span>
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-[#141420] border border-[#2d2d44] rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Clases</p>
            <h3 className="text-xl font-extrabold text-white mt-0.5">{meetings.length}</h3>
          </div>
          <div className="w-9 h-9 rounded-lg bg-[#06b6d4]/10 border border-[#06b6d4]/30 flex items-center justify-center text-[#06b6d4]">
            <Video className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-[#141420] border border-[#2d2d44] rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-red-400">En Vivo Ahora</p>
            <h3 className="text-xl font-extrabold text-red-400 mt-0.5">{liveCount}</h3>
          </div>
          <div className="w-9 h-9 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400">
            <Radio className="w-4 h-4 animate-pulse" />
          </div>
        </div>

        <div className="bg-[#141420] border border-[#2d2d44] rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#a855f7]">Sincrónicas</p>
            <h3 className="text-xl font-extrabold text-[#a855f7] mt-0.5">{syncCount}</h3>
          </div>
          <div className="w-9 h-9 rounded-lg bg-[#a855f7]/10 border border-[#a855f7]/30 flex items-center justify-center text-[#a855f7]">
            <Calendar className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-[#141420] border border-[#2d2d44] rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Asincrónicas</p>
            <h3 className="text-xl font-extrabold text-emerald-400 mt-0.5">{asyncCount}</h3>
          </div>
          <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <PlaySquare className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Filter and Search Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Type Filter Pills */}
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setFilterType('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              filterType === 'ALL'
                ? 'bg-[#06b6d4] text-black shadow-md'
                : 'bg-[#141420] text-slate-400 hover:text-white border border-[#2d2d44]'
            }`}
          >
            Todas ({meetings.length})
          </button>
          <button
            onClick={() => setFilterType('LIVE')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              filterType === 'LIVE'
                ? 'bg-red-500 text-white shadow-md'
                : 'bg-[#141420] text-slate-400 hover:text-red-400 border border-[#2d2d44]'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
            En Vivo ({liveCount})
          </button>
          <button
            onClick={() => setFilterType('SYNC')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              filterType === 'SYNC'
                ? 'bg-[#a855f7] text-white shadow-md'
                : 'bg-[#141420] text-slate-400 hover:text-white border border-[#2d2d44]'
            }`}
          >
            Sincrónicas ({syncCount})
          </button>
          <button
            onClick={() => setFilterType('ASYNC')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              filterType === 'ASYNC'
                ? 'bg-emerald-500 text-black shadow-md'
                : 'bg-[#141420] text-slate-400 hover:text-white border border-[#2d2d44]'
            }`}
          >
            Grabaciones ({asyncCount})
          </button>
        </div>

        {/* Course Filter Dropdown & Search */}
        <div className="flex items-center gap-2">
          <select
            value={selectedCourseId}
            onChange={(e) => setSelectedCourseId(e.target.value)}
            className="bg-[#141420] border border-[#2d2d44] text-slate-300 text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-[#06b6d4]"
          >
            <option value="ALL">Todos los Cursos</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>

          <div className="relative flex-1 sm:w-60">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Buscar clase..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#141420] border border-[#2d2d44] rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#06b6d4]"
            />
          </div>
        </div>
      </div>

      {/* Meetings List */}
      {loading && meetings.length === 0 ? (
        <div className="py-20 text-center space-y-3 bg-[#141420]/50 border border-[#2d2d44] rounded-2xl">
          <RefreshCw className="w-8 h-8 mx-auto text-[#06b6d4] animate-spin" />
          <p className="text-xs font-bold text-slate-400">Cargando catálogo de clases sincrónicas...</p>
        </div>
      ) : filteredMeetings.length === 0 ? (
        <div className="py-16 text-center space-y-3 bg-[#141420]/50 border border-[#2d2d44] rounded-2xl p-6">
          <Video className="w-10 h-10 mx-auto text-slate-600" />
          <h3 className="text-sm font-extrabold text-white">No se encontraron clases</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {searchQuery || filterType !== 'ALL' || selectedCourseId !== 'ALL'
              ? 'No hay reuniones que coincidan con los filtros seleccionados.'
              : 'Programa tu primera clase sincrónica con Google Meet o Jitsi Meet.'}
          </p>
          <button
            onClick={openCreateModal}
            className="btn-brand-primary px-4 py-2 text-xs font-bold rounded-lg inline-flex items-center gap-2 mt-2"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Crear Clase Ahora</span>
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
                className={`bg-[#141420] border rounded-xl p-5 flex flex-col justify-between transition-all space-y-4 ${
                  isLive
                    ? 'border-[#06b6d4] shadow-lg shadow-[#06b6d4]/10 ring-1 ring-[#06b6d4]/30'
                    : 'border-[#2d2d44] hover:border-[#3d3d5c]'
                }`}
              >
                {/* Top Row: Badges & Actions */}
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      {isLive ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black bg-red-500/20 text-red-400 border border-red-500/50 animate-pulse-slow">
                          <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                          🔴 ¡EN VIVO AHORA!
                        </span>
                      ) : meeting.meetingType === 'async_record' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                          <PlaySquare className="w-3 h-3" />
                          Grabación Asincrónica
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#a855f7]/10 text-[#a855f7] border border-[#a855f7]/30">
                          <Calendar className="w-3 h-3" />
                          Sincrónica Programada
                        </span>
                      )}

                      {/* Provider Badge */}
                      <span className="px-2 py-0.5 rounded-md bg-[#1a1a2e] border border-[#2d2d44] text-[10px] font-bold text-slate-300 uppercase">
                        {meeting.meetingType === 'jitsi'
                          ? 'Jitsi Meet'
                          : meeting.meetingType === 'meet'
                          ? 'Google Meet'
                          : 'Grabación'}
                      </span>
                    </div>

                    {/* Action menu buttons */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => openEditModal(meeting)}
                        className="p-1.5 rounded-lg bg-[#1a1a2e] hover:bg-[#252542] border border-[#2d2d44] text-slate-300 hover:text-white transition-colors"
                        title="Editar clase"
                      >
                        <Pencil className="w-3.5 h-3.5 text-[#06b6d4]" />
                      </button>
                      <button
                        onClick={() => handleDeleteMeeting(meeting)}
                        className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 transition-colors"
                        title="Eliminar clase"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Title & Description */}
                  <div>
                    <h3 className="font-extrabold text-sm text-white leading-snug line-clamp-2">
                      {meeting.title}
                    </h3>
                    {meeting.description && (
                      <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                        {meeting.description}
                      </p>
                    )}
                  </div>

                  {/* Course & Module Context */}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400 pt-1">
                    {meeting.courseTitle && (
                      <span className="flex items-center gap-1 text-[#06b6d4] font-semibold">
                        <Layers className="w-3 h-3" />
                        {meeting.courseTitle}
                      </span>
                    )}
                    {meeting.moduleTitle && (
                      <span className="text-slate-500">
                        • {meeting.moduleTitle}
                      </span>
                    )}
                  </div>
                </div>

                {/* Bottom Row: Scheduling, Host & Main CTA */}
                <div className="pt-3 border-t border-[#2d2d44]/80 space-y-3">
                  <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-400 gap-2">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-[#06b6d4]" />
                      <span>{schedInfo.dateFormatted} · {schedInfo.timeFormatted}</span>
                      <span className="text-[10px] text-slate-500 font-medium">({schedInfo.relativeLabel})</span>
                    </div>

                    {meeting.hostName && (
                      <div className="flex items-center gap-1.5 text-slate-400">
                        <Users className="w-3 h-3 text-[#a855f7]" />
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
                      className={`flex-1 min-w-[120px] px-3.5 py-2 rounded-lg text-xs font-bold text-center flex items-center justify-center gap-2 transition-all ${
                        isLive
                          ? 'btn-brand-primary text-white shadow-lg shadow-[#06b6d4]/20'
                          : 'bg-[#1a1a2e] hover:bg-[#252542] border border-[#06b6d4]/40 text-[#06b6d4]'
                      }`}
                    >
                      <Video className="w-3.5 h-3.5" />
                      <span>{isLive ? 'Unirse a la Clase en Vivo' : 'Abrir Sala / Enlace'}</span>
                      <ExternalLink className="w-3 h-3 opacity-70" />
                    </a>

                    <button
                      onClick={() => handleCopyLink(meeting)}
                      className="px-3 py-2 rounded-lg bg-[#141420] hover:bg-[#1f1f33] border border-[#2d2d44] text-slate-300 text-xs font-bold transition-colors flex items-center gap-1.5"
                      title="Copiar enlace de la clase"
                    >
                      {copiedId === meeting.id ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400">¡Copiado!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-slate-400" />
                          <span>Copiar</span>
                        </>
                      )}
                    </button>

                    {meeting.meetingType !== 'async_record' && (
                      <button
                        onClick={() => handleToggleLive(meeting)}
                        className={`px-3 py-2 rounded-lg text-xs font-bold border transition-colors flex items-center gap-1.5 ${
                          isLive
                            ? 'bg-red-500/10 hover:bg-red-500/20 border-red-500/40 text-red-400'
                            : 'bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                        }`}
                        title={isLive ? 'Finalizar sesión en vivo' : 'Iniciar sesión en vivo ahora'}
                      >
                        <Radio className="w-3.5 h-3.5" />
                        <span>{isLive ? 'Finalizar' : 'Iniciar En Vivo'}</span>
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
        <div className="fixed inset-0 z-50 bg-[#0a0a0f]/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
          <div className="bg-[#141420] border border-[#2d2d44] rounded-2xl w-full max-w-xl p-6 sm:p-7 space-y-6 shadow-2xl relative my-8">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-[#1a1a2e]"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#06b6d4]/10 border border-[#06b6d4]/30 text-[#06b6d4] text-[10px] font-bold">
                <Video className="w-3 h-3" />
                <span>LiveMeetings · Programador de Sesiones</span>
              </div>
              <h3 className="text-lg font-black text-white">
                {editingMeeting ? 'Editar Clase' : 'Programar Nueva Clase'}
              </h3>
              <p className="text-xs text-slate-400">
                Configura el tipo de sesión, enlace de transmisión y fecha programada.
              </p>
            </div>

            {modalError && (
              <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/40 text-red-400 text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleSaveMeeting} className="space-y-4">
              {/* Título de la clase */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Título de la Clase / Sesión <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Ej: Masterclass Sincrónica: Arquitectura Limpia y Despliegue"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  required
                  className="w-full bg-[#0a0a0f] border border-[#2d2d44] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-[#06b6d4]"
                />
              </div>

              {/* Selector de Tipo de Clase (Segmented Control) */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-2">
                  Tipo de Clase & Proveedor
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
                    className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all ${
                      formType === 'jitsi'
                        ? 'bg-[#06b6d4]/10 border-[#06b6d4] text-[#06b6d4] shadow-md shadow-[#06b6d4]/10'
                        : 'bg-[#0a0a0f] border-[#2d2d44] text-slate-400 hover:text-white'
                    }`}
                  >
                    <Globe className="w-4 h-4 mb-1" />
                    <div>
                      <p className="text-xs font-extrabold text-white">Jitsi Meet</p>
                      <p className="text-[10px] text-slate-500">Sala Dinámica 1-Clic</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setFormType('meet');
                      if (formUrl.includes('meet.jit.si')) setFormUrl('');
                    }}
                    className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all ${
                      formType === 'meet'
                        ? 'bg-[#a855f7]/10 border-[#a855f7] text-[#a855f7] shadow-md shadow-[#a855f7]/10'
                        : 'bg-[#0a0a0f] border-[#2d2d44] text-slate-400 hover:text-white'
                    }`}
                  >
                    <Video className="w-4 h-4 mb-1" />
                    <div>
                      <p className="text-xs font-extrabold text-white">Google Meet</p>
                      <p className="text-[10px] text-slate-500">Enlace Corporativo</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setFormType('async_record');
                      setFormIsLive(false);
                      if (formUrl.includes('meet.jit.si') || formUrl.includes('meet.google.com')) setFormUrl('');
                    }}
                    className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all ${
                      formType === 'async_record'
                        ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400 shadow-md shadow-emerald-500/10'
                        : 'bg-[#0a0a0f] border-[#2d2d44] text-slate-400 hover:text-white'
                    }`}
                  >
                    <PlaySquare className="w-4 h-4 mb-1" />
                    <div>
                      <p className="text-xs font-extrabold text-white">Asincrónica</p>
                      <p className="text-[10px] text-slate-500">Video Grabado</p>
                    </div>
                  </button>
                </div>
              </div>

              {/* URL del Enlace */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-300">
                    {formType === 'jitsi'
                      ? 'Enlace de Sala Jitsi Meet'
                      : formType === 'meet'
                      ? 'Enlace de Google Meet'
                      : 'Enlace de la Grabación (YouTube / Vimeo / Drive)'}
                    <span className="text-red-400"> *</span>
                  </label>
                  {formType === 'jitsi' && (
                    <button
                      type="button"
                      onClick={handleGenerateJitsiUrl}
                      className="text-[11px] text-[#06b6d4] font-bold hover:underline flex items-center gap-1"
                    >
                      <Sparkles className="w-3 h-3" />
                      Generar Sala Nueva
                    </button>
                  )}
                </div>

                <div className="relative">
                  <Link2 className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
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
                    className="w-full bg-[#0a0a0f] border border-[#2d2d44] rounded-xl pl-9 pr-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-[#06b6d4]"
                  />
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  {formType === 'jitsi'
                    ? 'Los estudiantes podrán ingresar sin instalar aplicaciones adicionales directamente desde el navegador.'
                    : formType === 'meet'
                    ? 'Pega el enlace creado desde tu cuenta de Google Workspace o Meet.'
                    : 'Permite a los estudiantes ver la grabación de una clase previa directamente en su reproductor.'}
                </p>
              </div>

              {/* Fecha y Hora Programada & Estado En Vivo */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    Fecha y Hora Programada
                  </label>
                  <input
                    type="datetime-local"
                    value={formScheduledAt}
                    onChange={(e) => setFormScheduledAt(e.target.value)}
                    className="w-full bg-[#0a0a0f] border border-[#2d2d44] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#06b6d4]"
                  />
                </div>

                <div>
                  {formType === 'async_record' ? (
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1.5">
                        Modalidad
                      </label>
                      <div className="w-full py-2 px-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-xs font-semibold flex items-center justify-center gap-2">
                        <PlaySquare className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Grabación Bajo Demanda</span>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1.5">
                        Estado de Transmisión
                      </label>
                      <button
                        type="button"
                        onClick={() => setFormIsLive(!formIsLive)}
                        className={`w-full py-2 px-3 rounded-xl border text-xs font-extrabold flex items-center justify-center gap-2 transition-all ${
                          formIsLive
                            ? 'bg-red-500/20 border-red-500/50 text-red-400'
                            : 'bg-[#0a0a0f] border-[#2d2d44] text-slate-400'
                        }`}
                      >
                        <Radio className={`w-3.5 h-3.5 ${formIsLive ? 'animate-pulse text-red-400' : ''}`} />
                        <span>{formIsLive ? '🔴 EN VIVO AHORA' : 'Programada (Offline)'}</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Curso y Módulo Vinculados */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    Curso Asociado
                  </label>
                  <select
                    value={formCourseId}
                    onChange={(e) => {
                      setFormCourseId(e.target.value);
                      setFormModuleId('');
                    }}
                    className="w-full bg-[#0a0a0f] border border-[#2d2d44] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#06b6d4]"
                  >
                    <option value="">Sin curso asignado</option>
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    Módulo Específico (Opcional)
                  </label>
                  <select
                    value={formModuleId}
                    onChange={(e) => setFormModuleId(e.target.value)}
                    disabled={!selectedCourse || selectedCourse.modules.length === 0}
                    className="w-full bg-[#0a0a0f] border border-[#2d2d44] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#06b6d4] disabled:opacity-40"
                  >
                    <option value="">Todo el curso</option>
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
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Descripción o Temas a Tratar (Opcional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Detalles sobre los puntos que se abordarán durante la sesión..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full bg-[#0a0a0f] border border-[#2d2d44] rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-[#06b6d4] resize-none"
                />
              </div>

              {/* Botones de acción del Modal */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#2d2d44]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-[#1a1a2e] hover:bg-[#262640] border border-[#2d2d44] text-xs font-bold text-slate-300 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-brand-primary px-5 py-2 rounded-lg text-xs font-extrabold flex items-center gap-2"
                >
                  {saving ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Guardando...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" />
                      <span>{editingMeeting ? 'Guardar Cambios' : 'Crear Clase'}</span>
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
