/**
 * Gestor de Cursos (`CourseManagerView.tsx`)
 * Academia Giantucchi
 *
 * Módulo para Administradores para:
 * 1. Crear, editar, publicar y eliminar cursos
 * 2. Crear, reordenar y eliminar módulos del temario
 * 3. Enlazar, reordenar y eliminar videos dentro de cada módulo
 */

import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  Plus,
  Trash2,
  RefreshCw,
  CheckCircle2,
  Eye,
  EyeOff,
  ChevronUp,
  ChevronDown,
  Layers,
  Play,
  Pencil,
  X,
  Save,
  Loader2,
  HardDrive,
  Search,
  Link2,
  Lock,
  Unlock,
} from 'lucide-react';
import { api } from '../lib/api';
import { DriveCourseImport } from './DriveCourseImport';
import { Course, Module, VideoDriveLink, DriveVideoFile } from '../types';

interface CourseManagerViewProps {
  onRefreshData: () => void;
}

const emptyForm = {
  title: '',
  description: '',
  category: 'Mentoría Elite',
  price: 0,
  currency: 'USD',
  coverImage: '',
  published: false,
  sequentialUnlock: false,
};

type CourseForm = typeof emptyForm;

export const CourseManagerView: React.FC<CourseManagerViewProps> = ({ onRefreshData }) => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  // Formulario de alta / edición de curso
  const [form, setForm] = useState<CourseForm>(emptyForm);
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [savingCourse, setSavingCourse] = useState(false);

  // Temario
  const [expandedCourseId, setExpandedCourseId] = useState<string | null>(null);
  const [newModuleTitle, setNewModuleTitle] = useState('');
  const [editingModuleId, setEditingModuleId] = useState<string | null>(null);
  const [editingModuleTitle, setEditingModuleTitle] = useState('');

  // Alta de video
  const [videoModuleId, setVideoModuleId] = useState<string | null>(null);
  const [videoTitle, setVideoTitle] = useState('');
  const [videoDuration, setVideoDuration] = useState('20:00');
  const [videoDriveId, setVideoDriveId] = useState('');
  const [videoEmbedUrl, setVideoEmbedUrl] = useState('');

  // Selector de Google Drive
  const [driveOpen, setDriveOpen] = useState(false);
  const [driveQuery, setDriveQuery] = useState('');
  const [driveResults, setDriveResults] = useState<DriveVideoFile[]>([]);
  const [driveLoading, setDriveLoading] = useState(false);
  const [driveError, setDriveError] = useState('');
  const [driveIsDemo, setDriveIsDemo] = useState(false);

  useEffect(() => {
    loadCourses();
  }, []);

  const flash = (message: string) => {
    setSuccessMsg(message);
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const loadCourses = async () => {
    setLoading(true);
    try {
      // Un ADMIN recibe también los borradores desde GET /api/courses
      const res = await api.getCourses();
      setCourses(res.courses || []);
    } catch (err) {
      console.error('Error loading courses:', err);
    } finally {
      setLoading(false);
    }
  };

  const refreshAll = async () => {
    await loadCourses();
    onRefreshData();
  };

  const resetForm = () => {
    setForm(emptyForm);
    setEditingCourseId(null);
  };

  const startEditing = (course: Course) => {
    setEditingCourseId(course.id);
    setForm({
      title: course.title,
      description: course.description || '',
      category: course.category || 'Mentoría Elite',
      price: course.price || 0,
      currency: course.currency || 'USD',
      coverImage: course.coverImage || '',
      published: course.published,
      sequentialUnlock: Boolean(course.sequentialUnlock),
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmitCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;

    setSavingCourse(true);
    try {
      if (editingCourseId) {
        await api.updateCourse(editingCourseId, form);
        flash('Curso actualizado correctamente.');
      } else {
        await api.createCourse(form);
        flash('Curso creado correctamente.');
      }
      resetForm();
      await refreshAll();
    } catch (err: any) {
      alert(err.message || 'Error al guardar el curso');
    } finally {
      setSavingCourse(false);
    }
  };

  const handleTogglePublished = async (course: Course) => {
    setBusyId(course.id);
    try {
      await api.updateCourse(course.id, { published: !course.published });
      flash(course.published ? 'Curso pasado a borrador.' : 'Curso publicado.');
      await refreshAll();
    } catch (err: any) {
      alert(err.message || 'Error al cambiar la publicación');
    } finally {
      setBusyId(null);
    }
  };

  const handleDeleteCourse = async (course: Course) => {
    const confirmed = window.confirm(
      `Se eliminará "${course.title}" junto con sus módulos, videos y recursos. Esta acción no se puede deshacer.\n\n¿Continuar?`,
    );
    if (!confirmed) return;

    setBusyId(course.id);
    try {
      await api.deleteCourse(course.id);
      if (expandedCourseId === course.id) setExpandedCourseId(null);
      if (editingCourseId === course.id) resetForm();
      flash('Curso eliminado.');
      await refreshAll();
    } catch (err: any) {
      alert(err.message || 'Error al eliminar el curso');
    } finally {
      setBusyId(null);
    }
  };

  const handleCreateModule = async (courseId: string) => {
    if (!newModuleTitle.trim()) return;
    try {
      await api.createModule(courseId, { title: newModuleTitle.trim() });
      setNewModuleTitle('');
      flash('Módulo agregado.');
      await refreshAll();
    } catch (err: any) {
      alert(err.message || 'Error al crear el módulo');
    }
  };

  const handleRenameModule = async (moduleId: string) => {
    if (!editingModuleTitle.trim()) return;
    try {
      await api.updateModule(moduleId, { title: editingModuleTitle.trim() });
      setEditingModuleId(null);
      setEditingModuleTitle('');
      flash('Módulo actualizado.');
      await refreshAll();
    } catch (err: any) {
      alert(err.message || 'Error al renombrar el módulo');
    }
  };

  const handleDeleteModule = async (module: Module) => {
    const confirmed = window.confirm(
      `Se eliminará el módulo "${module.title}" y sus ${module.videos.length} video(s). ¿Continuar?`,
    );
    if (!confirmed) return;
    try {
      await api.deleteModule(module.id);
      flash('Módulo eliminado.');
      await refreshAll();
    } catch (err: any) {
      alert(err.message || 'Error al eliminar el módulo');
    }
  };

  // Intercambia el campo `order` con el elemento vecino para reordenar.
  const handleMoveModule = async (modules: Module[], index: number, direction: -1 | 1) => {
    const target = modules[index + direction];
    const current = modules[index];
    if (!target || !current) return;

    try {
      await api.updateModule(current.id, { order: target.order });
      await api.updateModule(target.id, { order: current.order });
      await refreshAll();
    } catch (err: any) {
      alert(err.message || 'Error al reordenar los módulos');
    }
  };

  const resetVideoForm = () => {
    setVideoTitle('');
    setVideoDriveId('');
    setVideoEmbedUrl('');
    setVideoDuration('20:00');
    setDriveOpen(false);
    setDriveResults([]);
    setDriveQuery('');
    setDriveError('');
  };

  const searchDrive = async () => {
    setDriveLoading(true);
    setDriveError('');
    try {
      const res = await api.searchDriveVideos(driveQuery.trim() || undefined);
      setDriveResults(res.videos || []);
      setDriveIsDemo(Boolean(res.isDemo));
      if (!res.videos || res.videos.length === 0) {
        setDriveError('Sin resultados en Google Drive para esa búsqueda.');
      }
    } catch (err: any) {
      setDriveResults([]);
      setDriveError(err.message || 'No se pudo consultar Google Drive.');
    } finally {
      setDriveLoading(false);
    }
  };

  // Al elegir un archivo de Drive se rellena el formulario; el admin aún puede editarlo.
  const pickDriveVideo = (file: DriveVideoFile) => {
    setVideoDriveId(file.id);
    setVideoEmbedUrl(file.embedUrl || '');
    setVideoTitle((current) => current.trim() || file.name);
    if (file.duration) setVideoDuration(file.duration);
    setDriveOpen(false);
  };

  const handleCreateVideo = async (e: React.FormEvent, moduleId: string) => {
    e.preventDefault();
    if (!videoTitle.trim()) return;
    try {
      await api.createModuleVideo(moduleId, {
        title: videoTitle.trim(),
        duration: videoDuration.trim() || '20:00',
        ...(videoDriveId.trim() ? { driveFileId: videoDriveId.trim() } : {}),
        ...(videoEmbedUrl.trim() ? { embedUrl: videoEmbedUrl.trim() } : {}),
      });
      resetVideoForm();
      setVideoModuleId(null);
      flash('Video agregado al módulo.');
      await refreshAll();
    } catch (err: any) {
      alert(err.message || 'Error al agregar el video');
    }
  };

  const handleMoveVideo = async (videos: VideoDriveLink[], index: number, direction: -1 | 1) => {
    const target = videos[index + direction];
    const current = videos[index];
    if (!target || !current) return;

    try {
      await api.updateVideo(current.id, { order: target.order });
      await api.updateVideo(target.id, { order: current.order });
      await refreshAll();
    } catch (err: any) {
      alert(err.message || 'Error al reordenar los videos');
    }
  };

  const handleDeleteVideo = async (video: VideoDriveLink) => {
    if (!window.confirm(`¿Eliminar el video "${video.title}"?`)) return;
    try {
      await api.deleteVideo(video.id);
      flash('Video eliminado.');
      await refreshAll();
    } catch (err: any) {
      alert(err.message || 'Error al eliminar el video');
    }
  };

  const countVideos = (course: Course) =>
    course.modules.reduce((total, m) => total + m.videos.length, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      {successMsg && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" /> {successMsg}
        </div>
      )}

      {/* Importación desde Drive: crea el curso entero de una pasada */}
      {!editingCourseId && <DriveCourseImport onImported={refreshAll} />}

      {/* Alta / edición de curso */}
      <div className="bg-[#141420] border border-[#2d2d44] rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-[#2d2d44] pb-3">
          <div>
            <h3 className="font-extrabold text-base text-white flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-cyan-400" />
              {editingCourseId ? 'Editar Curso' : 'Crear Nuevo Curso'}
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Los cursos nuevos se guardan como borrador hasta que los publiques. Un precio de 0 los
              convierte en cursos públicos y gratuitos.
            </p>
          </div>
          {editingCourseId && (
            <button
              onClick={resetForm}
              className="text-xs font-bold text-slate-400 hover:text-white flex items-center gap-1.5"
            >
              <X className="w-4 h-4" /> Cancelar
            </button>
          )}
        </div>

        <form onSubmit={handleSubmitCourse} className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-slate-400 block mb-1">Título del Curso</label>
              <input
                type="text"
                placeholder="Ej. Arquitectura Cloud Avanzada"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="w-full bg-[#0a0a0f] border border-[#2d2d44] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#06b6d4]"
                required
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-400 block mb-1">Categoría</label>
              <input
                type="text"
                placeholder="Mentoría Elite"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full bg-[#0a0a0f] border border-[#2d2d44] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#06b6d4]"
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-400 block mb-1">Descripción</label>
            <textarea
              rows={3}
              placeholder="Qué aprenderá el estudiante en este programa."
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full bg-[#0a0a0f] border border-[#2d2d44] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#06b6d4]"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="text-[11px] font-bold text-slate-400 block mb-1">Precio</label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
                className="w-full bg-[#0a0a0f] border border-[#2d2d44] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#06b6d4]"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-400 block mb-1">Moneda</label>
              <select
                value={form.currency}
                onChange={(e) => setForm({ ...form, currency: e.target.value })}
                className="w-full bg-[#0a0a0f] border border-[#2d2d44] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#06b6d4]"
              >
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="MXN">MXN</option>
                <option value="COP">COP</option>
                <option value="ARS">ARS</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="text-[11px] font-bold text-slate-400 block mb-1">Imagen de Portada (URL)</label>
              <input
                type="url"
                placeholder="https://images.unsplash.com/..."
                value={form.coverImage}
                onChange={(e) => setForm({ ...form, coverImage: e.target.value })}
                className="w-full bg-[#0a0a0f] border border-[#2d2d44] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#06b6d4]"
              />
            </div>
          </div>

          {/* Progresión secuencial: el candado del temario del alumno. Va en su
              propia caja porque no es una casilla más del formulario, sino la
              regla con la que se recorre el curso entero. */}
          <label className="flex items-start gap-3 rounded-xl border border-[#2d2d44] bg-[#0a0a0f] p-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form.sequentialUnlock}
              onChange={(e) => setForm({ ...form, sequentialUnlock: e.target.checked })}
              className="accent-[#06b6d4] w-4 h-4 mt-0.5 shrink-0"
            />
            <span className="min-w-0">
              <span className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
                {form.sequentialUnlock ? (
                  <Lock className="w-3.5 h-3.5 text-amber-400" />
                ) : (
                  <Unlock className="w-3.5 h-3.5 text-slate-500" />
                )}
                Progresión secuencial (bloquear módulos)
              </span>
              <span className="block text-[11px] text-slate-400 mt-1 leading-relaxed">
                El alumno empieza con el Módulo 1 abierto y el resto con candado. Cada módulo se
                desbloquea cuando termina todas las lecciones del anterior. Apagado, el temario se
                ve completo desde el primer día.
              </span>
            </span>
          </label>

          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center gap-2 text-xs font-bold text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={form.published}
                onChange={(e) => setForm({ ...form, published: e.target.checked })}
                className="accent-[#06b6d4] w-4 h-4"
              />
              Publicar inmediatamente
            </label>

            <button
              type="submit"
              disabled={savingCourse}
              className="btn-brand-primary py-2 px-4 text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {savingCourse ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : editingCourseId ? (
                <Save className="w-4 h-4" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              {editingCourseId ? 'Guardar Cambios' : 'Crear Curso'}
            </button>
          </div>
        </form>
      </div>

      {/* Catálogo de cursos */}
      <div className="bg-[#141420] border border-[#2d2d44] rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-[#2d2d44] pb-3">
          <h3 className="text-base font-extrabold text-white flex items-center gap-2">
            <Layers className="w-5 h-5 text-[#06b6d4]" />
            Catálogo ({courses.length})
          </h3>
          <button
            onClick={loadCourses}
            className="text-xs font-bold text-slate-400 hover:text-white flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Actualizar
          </button>
        </div>

        {loading && courses.length === 0 ? (
          <p className="text-xs text-slate-500 py-6 text-center">Cargando cursos…</p>
        ) : courses.length === 0 ? (
          <p className="text-xs text-slate-500 py-6 text-center">
            Todavía no hay cursos. Crea el primero con el formulario de arriba.
          </p>
        ) : (
          <div className="space-y-3">
            {courses.map((course) => {
              const isExpanded = expandedCourseId === course.id;
              const modules = [...course.modules].sort((a, b) => a.order - b.order);

              return (
                <div
                  key={course.id}
                  className="rounded-xl bg-[#0a0a0f] border border-[#2d2d44] overflow-hidden"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3 p-4">
                    <div className="flex items-center gap-3 min-w-0">
                      {course.coverImage && (
                        <img
                          src={course.coverImage}
                          alt=""
                          className="w-14 h-10 rounded-lg object-cover border border-[#2d2d44] shrink-0"
                        />
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-xs font-bold text-white truncate">{course.title}</p>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              course.published
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                                : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                            }`}
                          >
                            {course.published ? 'Publicado' : 'Borrador'}
                          </span>
                          {course.isDemo && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-500/10 text-slate-400 border border-slate-500/30">
                              Demo
                            </span>
                          )}
                          {course.sequentialUnlock && (
                            <span
                              title="Los módulos se desbloquean uno a uno"
                              className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center gap-1"
                            >
                              <Lock className="w-2.5 h-2.5" /> Secuencial
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-500">
                          {course.category} • {course.price > 0 ? `${course.price} ${course.currency || 'USD'}` : 'Gratuito'} •{' '}
                          {modules.length} módulo(s) • {countVideos(course)} video(s)
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setExpandedCourseId(isExpanded ? null : course.id)}
                        className="px-2.5 py-1.5 rounded-lg bg-[#141420] border border-[#2d2d44] text-[11px] font-bold text-slate-300 hover:text-white transition-colors flex items-center gap-1.5"
                      >
                        <Layers className="w-3.5 h-3.5" /> Temario
                      </button>
                      <button
                        onClick={() => startEditing(course)}
                        className="p-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 transition-colors"
                        title="Editar curso"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleTogglePublished(course)}
                        disabled={busyId === course.id}
                        className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 transition-colors disabled:opacity-50"
                        title={course.published ? 'Pasar a borrador' : 'Publicar'}
                      >
                        {course.published ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => handleDeleteCourse(course)}
                        disabled={busyId === course.id}
                        className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors disabled:opacity-50"
                        title="Eliminar curso"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Temario del curso */}
                  {isExpanded && (
                    <div className="border-t border-[#2d2d44] p-4 space-y-3 bg-[#141420]/40">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Título del nuevo módulo"
                          value={newModuleTitle}
                          onChange={(e) => setNewModuleTitle(e.target.value)}
                          className="flex-1 bg-[#0a0a0f] border border-[#2d2d44] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#06b6d4]"
                        />
                        <button
                          onClick={() => handleCreateModule(course.id)}
                          className="btn-brand-primary py-2 px-3 text-xs font-bold flex items-center gap-1.5"
                        >
                          <Plus className="w-4 h-4" /> Módulo
                        </button>
                      </div>

                      {modules.length === 0 ? (
                        <p className="text-xs text-slate-500 py-3 text-center">
                          Este curso todavía no tiene módulos.
                        </p>
                      ) : (
                        modules.map((module, moduleIndex) => {
                          const videos = [...module.videos].sort((a, b) => a.order - b.order);

                          return (
                            <div
                              key={module.id}
                              className="rounded-xl bg-[#0a0a0f] border border-[#2d2d44] p-3 space-y-2"
                            >
                              <div className="flex items-center justify-between gap-2">
                                {editingModuleId === module.id ? (
                                  <div className="flex items-center gap-2 flex-1">
                                    <input
                                      type="text"
                                      value={editingModuleTitle}
                                      onChange={(e) => setEditingModuleTitle(e.target.value)}
                                      className="flex-1 bg-[#141420] border border-[#2d2d44] rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-[#06b6d4]"
                                      autoFocus
                                    />
                                    <button
                                      onClick={() => handleRenameModule(module.id)}
                                      className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400"
                                    >
                                      <Save className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => setEditingModuleId(null)}
                                      className="p-1.5 rounded-lg bg-slate-500/10 hover:bg-slate-500/20 text-slate-400"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                ) : (
                                  <>
                                    <div className="min-w-0">
                                      <p className="text-xs font-bold text-white truncate">
                                        {module.order}. {module.title}
                                      </p>
                                      <span className="text-[10px] text-slate-500">
                                        {videos.length} video(s)
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <button
                                        onClick={() => handleMoveModule(modules, moduleIndex, -1)}
                                        disabled={moduleIndex === 0}
                                        className="p-1 rounded-lg bg-[#141420] border border-[#2d2d44] text-slate-400 hover:text-white disabled:opacity-30"
                                        title="Subir"
                                      >
                                        <ChevronUp className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        onClick={() => handleMoveModule(modules, moduleIndex, 1)}
                                        disabled={moduleIndex === modules.length - 1}
                                        className="p-1 rounded-lg bg-[#141420] border border-[#2d2d44] text-slate-400 hover:text-white disabled:opacity-30"
                                        title="Bajar"
                                      >
                                        <ChevronDown className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        onClick={() => {
                                          setEditingModuleId(module.id);
                                          setEditingModuleTitle(module.title);
                                        }}
                                        className="p-1 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400"
                                        title="Renombrar"
                                      >
                                        <Pencil className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        onClick={() => {
                                          resetVideoForm();
                                          setVideoModuleId(videoModuleId === module.id ? null : module.id);
                                        }}
                                        className="p-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400"
                                        title="Agregar video"
                                      >
                                        <Plus className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        onClick={() => handleDeleteModule(module)}
                                        className="p-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400"
                                        title="Eliminar módulo"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </>
                                )}
                              </div>

                              {/* Alta de video */}
                              {videoModuleId === module.id && (
                                <form
                                  onSubmit={(e) => handleCreateVideo(e, module.id)}
                                  className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end p-2 rounded-lg bg-[#141420] border border-[#2d2d44]"
                                >
                                  <div className="md:col-span-2">
                                    <label className="text-[10px] font-bold text-slate-400 block mb-1">
                                      Título del video
                                    </label>
                                    <input
                                      type="text"
                                      value={videoTitle}
                                      onChange={(e) => setVideoTitle(e.target.value)}
                                      className="w-full bg-[#0a0a0f] border border-[#2d2d44] rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-[#06b6d4]"
                                      required
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[10px] font-bold text-slate-400 block mb-1">
                                      Duración
                                    </label>
                                    <input
                                      type="text"
                                      placeholder="20:00"
                                      value={videoDuration}
                                      onChange={(e) => setVideoDuration(e.target.value)}
                                      className="w-full bg-[#0a0a0f] border border-[#2d2d44] rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-[#06b6d4]"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[10px] font-bold text-slate-400 block mb-1">
                                      Archivo de Google Drive
                                    </label>
                                    <div className="flex gap-1">
                                      <input
                                        type="text"
                                        placeholder="Pega el enlace de Drive o su ID"
                                        value={videoDriveId}
                                        onChange={(e) => setVideoDriveId(e.target.value)}
                                        className="flex-1 min-w-0 bg-[#0a0a0f] border border-[#2d2d44] rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-[#06b6d4]"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const opening = !driveOpen;
                                          setDriveOpen(opening);
                                          if (opening && driveResults.length === 0) searchDrive();
                                        }}
                                        className="shrink-0 px-2 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                                        title="Buscar en Google Drive"
                                      >
                                        <HardDrive className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </div>

                                  {/* Selector de Google Drive */}
                                  {driveOpen && (
                                    <div className="md:col-span-4 rounded-lg bg-[#0a0a0f] border border-[#2d2d44] p-2 space-y-2">
                                      <div className="flex gap-1">
                                        <input
                                          type="text"
                                          placeholder="Buscar por nombre en Google Drive…"
                                          value={driveQuery}
                                          onChange={(e) => setDriveQuery(e.target.value)}
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                              e.preventDefault();
                                              searchDrive();
                                            }
                                          }}
                                          className="flex-1 bg-[#141420] border border-[#2d2d44] rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-[#06b6d4]"
                                        />
                                        <button
                                          type="button"
                                          onClick={searchDrive}
                                          disabled={driveLoading}
                                          className="px-2.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 disabled:opacity-50"
                                        >
                                          {driveLoading ? (
                                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                          ) : (
                                            <Search className="w-3.5 h-3.5" />
                                          )}
                                        </button>
                                      </div>

                                      {driveIsDemo && (
                                        <p className="text-[10px] text-amber-400 leading-snug">
                                          Google Drive no está configurado: estos resultados son de
                                          demostración y sus identificadores no existen, así que el
                                          reproductor quedará vacío. Pega el enlace real del vídeo en
                                          el campo de arriba, o configura las credenciales de Drive.
                                        </p>
                                      )}

                                      {driveError && (
                                        <p className="text-[10px] text-amber-400">{driveError}</p>
                                      )}

                                      <div className="max-h-52 overflow-y-auto space-y-1">
                                        {driveResults.map((file) => (
                                          <button
                                            type="button"
                                            key={file.id}
                                            onClick={() => pickDriveVideo(file)}
                                            className={`w-full flex items-center gap-2 p-1.5 rounded-lg border text-left transition-colors ${
                                              videoDriveId === file.id
                                                ? 'bg-cyan-500/10 border-cyan-500/40'
                                                : 'bg-[#141420] border-[#2d2d44] hover:border-[#06b6d4]'
                                            }`}
                                          >
                                            {file.thumbnailLink ? (
                                              <img
                                                src={file.thumbnailLink}
                                                alt=""
                                                className="w-12 h-8 rounded object-cover shrink-0"
                                              />
                                            ) : (
                                              <div className="w-12 h-8 rounded bg-[#0a0a0f] border border-[#2d2d44] flex items-center justify-center shrink-0">
                                                <Play className="w-3 h-3 text-slate-500" />
                                              </div>
                                            )}
                                            <div className="min-w-0 flex-1">
                                              <p className="text-[11px] text-slate-200 truncate">{file.name}</p>
                                              <span className="text-[9px] text-slate-500 font-mono">
                                                {file.duration || 'sin duración'} • {file.id.slice(0, 14)}…
                                              </span>
                                            </div>
                                            {videoDriveId === file.id && (
                                              <Link2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                                            )}
                                          </button>
                                        ))}
                                        {!driveLoading && driveResults.length === 0 && !driveError && (
                                          <p className="text-[10px] text-slate-500 text-center py-3">
                                            Busca un video para enlazarlo.
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  )}

                                  <div className="md:col-span-4 flex items-center justify-between gap-2">
                                    <span className="text-[10px] text-slate-500 truncate">
                                      {videoDriveId
                                        ? `Enlazado a Drive: ${videoDriveId}`
                                        : 'Sin archivo de Drive: se generará un enlace de marcador.'}
                                    </span>
                                    <button
                                      type="submit"
                                      className="btn-brand-primary py-1.5 px-3 text-xs font-bold flex items-center gap-1.5 shrink-0"
                                    >
                                      <Plus className="w-3.5 h-3.5" /> Agregar Video
                                    </button>
                                  </div>
                                </form>
                              )}

                              {/* Videos del módulo */}
                              {videos.length > 0 && (
                                <div className="space-y-1">
                                  {videos.map((video, videoIndex) => (
                                    <div
                                      key={video.id}
                                      className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg bg-[#141420] border border-[#2d2d44]"
                                    >
                                      <div className="flex items-center gap-2 min-w-0">
                                        <Play className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                                        <span className="text-[11px] text-slate-300 truncate">
                                          {video.title}
                                        </span>
                                        <span className="text-[10px] text-slate-500 shrink-0">
                                          {video.duration}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-1 shrink-0">
                                        <button
                                          onClick={() => handleMoveVideo(videos, videoIndex, -1)}
                                          disabled={videoIndex === 0}
                                          className="p-1 rounded bg-[#0a0a0f] border border-[#2d2d44] text-slate-400 hover:text-white disabled:opacity-30"
                                          title="Subir"
                                        >
                                          <ChevronUp className="w-3 h-3" />
                                        </button>
                                        <button
                                          onClick={() => handleMoveVideo(videos, videoIndex, 1)}
                                          disabled={videoIndex === videos.length - 1}
                                          className="p-1 rounded bg-[#0a0a0f] border border-[#2d2d44] text-slate-400 hover:text-white disabled:opacity-30"
                                          title="Bajar"
                                        >
                                          <ChevronDown className="w-3 h-3" />
                                        </button>
                                        <button
                                          onClick={() => handleDeleteVideo(video)}
                                          className="p-1 rounded bg-red-500/10 hover:bg-red-500/20 text-red-400"
                                          title="Eliminar video"
                                        >
                                          <Trash2 className="w-3 h-3" />
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
