/**
 * Gestor de Cursos (`CourseManagerView.tsx`)
 * Academia Giantucchi
 *
 * Módulo para Administradores para:
 * 1. Crear, editar, publicar y eliminar cursos
 * 2. Crear, reordenar y eliminar módulos del temario
 * 3. Enlazar, reordenar y eliminar videos dentro de cada módulo
 */

import React, { useState, useEffect, useRef } from 'react';
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
  Globe,
  Youtube,
  Sparkles,
  AlertTriangle,
  Users,
  UsersRound,
  List,
  LayoutGrid,
} from 'lucide-react';
import { api } from '../lib/api';
import { DriveCourseImport } from './DriveCourseImport';
import { YouTubeCourseBuilder } from './YouTubeCourseBuilder';
import { Course, Module, VideoDriveLink, DriveVideoFile, QuizQuestion, User } from '../types';
import { QuizManagerModal } from './QuizManagerModal';
import { syncModuleQuizzes, getModuleQuestions } from '../plugins/QuizzesPlugin';

interface CourseManagerViewProps {
  currentUser?: User;
  onRefreshData: () => void;
  disableAnimation?: boolean;
}

import {
  MENTORSHIP_CATEGORIES,
  TECHNICAL_CATEGORIES,
  STANDARD_COURSE_CATEGORIES,
} from '../lib/courseCategories';

export const COURSE_CATEGORIES = STANDARD_COURSE_CATEGORIES;

const emptyForm = {
  title: '',
  description: '',
  category: 'Mentoría Elite',
  price: 0,
  currency: 'USD',
  coverImage: '',
  published: false,
  sequentialUnlock: false,
  openToAllRegistered: false,
};

type CourseForm = typeof emptyForm;

const VIEW_MODE_KEY = 'docentos_admin_courses_view';

interface DeleteTarget {
  type: 'course' | 'module' | 'video';
  id: string;
  title: string;
  warningText?: string;
  error?: string;
  canForce?: boolean;
}

export const CourseManagerView: React.FC<CourseManagerViewProps> = ({
  currentUser,
  onRefreshData,
  disableAnimation = false,
}) => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  // Modo de creación activo: 'manual' | 'youtube' | 'drive'
  const [creationTab, setCreationTab] = useState<'manual' | 'youtube' | 'drive'>('manual');

  // Formulario de alta / edición de curso
  const [form, setForm] = useState<CourseForm>(emptyForm);
  const formRef = useRef<HTMLDialogElement>(null);
  const deleteRef = useRef<HTMLDialogElement>(null);
  const unpublishRef = useRef<HTMLDialogElement>(null);
  const [unpublishTarget, setUnpublishTarget] = useState<Course | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'cards'>(() => {
    try {
      return localStorage.getItem(VIEW_MODE_KEY) === 'cards' ? 'cards' : 'list';
    } catch {
      return 'list';
    }
  });
  const changeViewMode = (mode: 'list' | 'cards') => {
    setViewMode(mode);
    try {
      localStorage.setItem(VIEW_MODE_KEY, mode);
    } catch {
      // Sin almacenamiento la vista solo dura esta sesión.
    }
  };
  const [courseQuery, setCourseQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'draft'>('all');
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [savingCourse, setSavingCourse] = useState(false);
  const [generatingCover, setGeneratingCover] = useState(false);

  // Temario
  const [expandedCourseId, setExpandedCourseId] = useState<string | null>(null);
  const [newModuleTitle, setNewModuleTitle] = useState('');
  const [editingModuleId, setEditingModuleId] = useState<string | null>(null);
  const [editingModuleTitle, setEditingModuleTitle] = useState('');

  // Alta de video
  const [videoModuleId, setVideoModuleId] = useState<string | null>(null);
  const [videoTitle, setVideoTitle] = useState('');
  const [videoDuration, setVideoDuration] = useState('20:00');
  const [quizModule, setQuizModule] = useState<Module | null>(null);
  const [videoDriveId, setVideoDriveId] = useState('');
  const [videoEmbedUrl, setVideoEmbedUrl] = useState('');
  const [quizzesMap, setQuizzesMap] = useState<Record<string, QuizQuestion[]>>({});

  // Selector de Google Drive
  const [driveOpen, setDriveOpen] = useState(false);
  const [driveQuery, setDriveQuery] = useState('');
  const [driveResults, setDriveResults] = useState<DriveVideoFile[]>([]);
  const [driveLoading, setDriveLoading] = useState(false);
  const [driveError, setDriveError] = useState('');
  const [driveIsDemo, setDriveIsDemo] = useState(false);

  // Forzar / Confirmar eliminación
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Gestión de Mentores por Curso
  const [mentorModalCourse, setMentorModalCourse] = useState<Course | null>(null);
  const [availableMentors, setAvailableMentors] = useState<User[]>([]);
  const [assignedMentorIds, setAssignedMentorIds] = useState<string[]>([]);
  const [loadingCourseMentors, setLoadingCourseMentors] = useState<boolean>(false);
  const [savingCourseMentors, setSavingCourseMentors] = useState<boolean>(false);
  const [courseMentorsNotice, setCourseMentorsNotice] = useState<string | null>(null);

  const handleOpenCourseMentors = async (targetCourse: Course) => {
    setMentorModalCourse(targetCourse);
    setLoadingCourseMentors(true);
    setCourseMentorsNotice(null);
    try {
      const [mentorsRes, usersRes] = await Promise.all([
        api.getAdminCourseMentors(targetCourse.id),
        api.getAdminUsers(),
      ]);
      setAssignedMentorIds(mentorsRes.mentorIds || []);
      const mentorUsers = (usersRes.users || []).filter(
        (u: User) => u.role === 'MENTOR' || u.role === 'ADMIN'
      );
      setAvailableMentors(mentorUsers);
    } catch (err: any) {
      setCourseMentorsNotice(err?.message || 'Error al cargar mentores');
    } finally {
      setLoadingCourseMentors(false);
    }
  };

  const handleToggleCourseMentor = (mentorId: string) => {
    setAssignedMentorIds((prev) =>
      prev.includes(mentorId) ? prev.filter((id) => id !== mentorId) : [...prev, mentorId]
    );
  };

  const handleSaveCourseMentors = async () => {
    if (!mentorModalCourse) return;
    setSavingCourseMentors(true);
    setCourseMentorsNotice(null);
    try {
      const res = await api.setAdminCourseMentors(mentorModalCourse.id, assignedMentorIds);
      setAssignedMentorIds(res.mentorIds || []);
      setCourseMentorsNotice('Mentores asignados correctamente al curso');
      setTimeout(() => {
        setMentorModalCourse(null);
        setCourseMentorsNotice(null);
      }, 1000);
    } catch (err: any) {
      setCourseMentorsNotice(err?.message || 'Error al guardar mentores del curso');
    } finally {
      setSavingCourseMentors(false);
    }
  };

  useEffect(() => {
    loadCourses();
  }, []);

  const flash = (message: string) => {
    setSuccessMsg(message);
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const loadAllQuizzes = async () => {
    try {
      const res = await api.getAllQuizzes();
      if (res.success && res.quizzes) {
        setQuizzesMap(res.quizzes);
        syncModuleQuizzes(res.quizzes);
      }
    } catch (err) {
      console.error('Error al sincronizar evaluaciones:', err);
    }
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
    await Promise.all([loadCourses(), loadAllQuizzes()]);
    onRefreshData();
  };

  const resetForm = () => {
    setForm(emptyForm);
    setEditingCourseId(null);
    formRef.current?.close();
  };

  const openNewCourse = () => {
    setCreationTab('manual');
    setForm(emptyForm);
    setEditingCourseId(null);
    formRef.current?.showModal();
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
      openToAllRegistered: Boolean(course.openToAllRegistered),
      sequentialUnlock: Boolean(course.sequentialUnlock),
    });
    formRef.current?.showModal();
  };

  const handleGenerateCover = async () => {
    if (!form.title.trim()) {
      alert('Escribe primero el título del curso para generar una portada temática con IA.');
      return;
    }
    setGeneratingCover(true);
    try {
      const res = await api.generateCourseCover({
        title: form.title.trim(),
        category: form.category.trim() || 'Mentoría Elite',
        description: form.description.trim(),
      });
      if (res.success && res.coverImage) {
        setForm((prev) => ({ ...prev, coverImage: res.coverImage }));
        flash('Portada generada con IA + logo del plugin de personalización.');
      }
    } catch (err: any) {
      alert(err.message || 'No se pudo generar la portada con IA');
    } finally {
      setGeneratingCover(false);
    }
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

  const handleDeleteCourse = (course: Course) => {
    setDeleteTarget({
      type: 'course',
      id: course.id,
      title: course.title,
      warningText: `Se borrarán sus ${course.modules.length} módulo(s), ${countVideos(course)} video(s) y recursos vinculados.${
        course.published ? ' Está publicado: los alumnos perderán el acceso.' : ''
      }`,
    });
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

  const handleDeleteModule = (module: Module) => {
    setDeleteTarget({
      type: 'module',
      id: module.id,
      title: module.title,
      warningText: `Se eliminará el módulo con sus ${module.videos.length} video(s).`,
    });
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

  const handleDeleteVideo = (video: VideoDriveLink) => {
    setDeleteTarget({
      type: 'video',
      id: video.id,
      title: video.title,
      warningText: 'Se eliminará esta misión/lección de video del módulo.',
    });
  };

  const executeDelete = async (force: boolean) => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      if (deleteTarget.type === 'course') {
        setBusyId(deleteTarget.id);
        await api.deleteCourse(deleteTarget.id, force);
        if (expandedCourseId === deleteTarget.id) setExpandedCourseId(null);
        if (editingCourseId === deleteTarget.id) resetForm();
        flash(force ? 'Curso forzado y eliminado por completo.' : 'Curso eliminado.');
      } else if (deleteTarget.type === 'module') {
        await api.deleteModule(deleteTarget.id, force);
        flash(force ? 'Módulo forzado y eliminado.' : 'Módulo eliminado.');
      } else if (deleteTarget.type === 'video') {
        await api.deleteVideo(deleteTarget.id, force);
        flash(force ? 'Video forzado y eliminado.' : 'Video eliminado.');
      }
      setDeleteTarget(null);
      await refreshAll();
    } catch (err: any) {
      setDeleteTarget((prev) =>
        prev
          ? {
              ...prev,
              error: err.message || 'Error al eliminar.',
              canForce: true,
            }
          : null,
      );
    } finally {
      setIsDeleting(false);
      setBusyId(null);
    }
  };

  const countVideos = (course: Course) =>
    course.modules.reduce((total, m) => total + m.videos.length, 0);

  useEffect(() => {
    for (const [target, ref] of [[deleteTarget, deleteRef], [unpublishTarget, unpublishRef]] as const) {
      const d = ref.current;
      if (target && d && !d.open) d.showModal();
      if (!target && d?.open) d.close();
    }
  }, [deleteTarget, unpublishTarget]);

  const statusCounts = {
    all: courses.length,
    published: courses.filter((c) => c.published).length,
    draft: courses.filter((c) => !c.published).length,
  };
  const q = courseQuery.trim().toLowerCase();
  const visibleCourses = courses.filter(
    (c) =>
      (statusFilter === 'all' || (statusFilter === 'published') === c.published) &&
      (!q || `${c.title} ${c.category}`.toLowerCase().includes(q)),
  );

  return (
    <div data-mentor-ui="modern" className="admin-courses-root">
    <div className={`mentor-courses-panel admin-courses-panel ${disableAnimation ? '' : 'animate-fade-in'}`}>
      {successMsg && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" /> {successMsg}
        </div>
      )}

      {/* Cabecera: crear curso (manual, YouTube o Drive) */}
      <div className="mentor-section-heading">
        <div>
          <h2 id="admin-courses-title">Cursos</h2>
          <p>Crea, publica y organiza el temario de cada curso.</p>
        </div>
        <div className="admin-courses-actions">
          <button type="button" className="mentor-course-control mentor-course-publish" onClick={openNewCourse}>
            <Plus aria-hidden="true" />
            Nuevo curso
          </button>
          <button
            type="button"
            className="mentor-course-control"
            aria-pressed={creationTab === 'youtube'}
            onClick={() => setCreationTab(creationTab === 'youtube' ? 'manual' : 'youtube')}
          >
            <Youtube aria-hidden="true" />
            Desde YouTube con IA
          </button>
          <button
            type="button"
            className="mentor-course-control"
            aria-pressed={creationTab === 'drive'}
            onClick={() => setCreationTab(creationTab === 'drive' ? 'manual' : 'drive')}
          >
            <HardDrive aria-hidden="true" />
            Desde Google Drive
          </button>
        </div>
      </div>

      {creationTab === 'youtube' && (
        <div className="admin-courses-wizard">
          <YouTubeCourseBuilder
            currentUser={currentUser}
            onCourseCreated={(newId) => {
              flash('¡Curso creado exitosamente con IA desde YouTube!');
              refreshAll();
              setCreationTab('manual');
              setExpandedCourseId(newId);
            }}
            onCancel={() => setCreationTab('manual')}
          />
        </div>
      )}

      {creationTab === 'drive' && (
        <div className="admin-courses-wizard">
          <DriveCourseImport onImported={refreshAll} />
        </div>
      )}

      {/* Formulario manual en hoja lateral */}
      <dialog
        ref={formRef}
        className="mentee-sheet"
        aria-labelledby="admin-course-form-title"
        onCancel={(e) => { e.preventDefault(); resetForm(); }}
        onClick={(e) => { if (e.target === e.currentTarget) resetForm(); }}
      >
        <div className="mentee-sheet__body">
          <header className="mentee-sheet__head">
            <span className="mentee-sheet__icon" aria-hidden="true"><BookOpen /></span>
            <div className="mentor-mentee-id">
              <strong id="admin-course-form-title">{editingCourseId ? 'Editar curso' : 'Nuevo curso'}</strong>
              <span>{editingCourseId ? 'Cambia los datos y guarda.' : 'Los cursos nuevos quedan en borrador hasta publicarlos.'}</span>
            </div>
            <button type="button" onClick={resetForm} className="mentee-sheet__close" aria-label="Cerrar">
              <X aria-hidden="true" />
            </button>
          </header>

          <form onSubmit={handleSubmitCourse} className="admin-course-form">
            <div className="admin-course-fields">
            <div className="meeting-field">
              <label htmlFor="admin-course-title">Título del curso</label>
              <input
                id="admin-course-title"
                type="text"
                placeholder="Ej. Arquitectura Cloud Avanzada"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
              />
            </div>
            <div className="meeting-field">
              <label htmlFor="admin-course-category">Categoría</label>
              <select
                id="admin-course-category"
                value={form.category || 'Mentoría Especializada'}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                {form.category && !COURSE_CATEGORIES.includes(form.category as any) && (
                  <option value={form.category}>{form.category}</option>
                )}
                <optgroup label="Modalidades de Mentoría">
                  {MENTORSHIP_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </optgroup>
                <optgroup label="Áreas Temáticas Técnicas">
                  {TECHNICAL_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </optgroup>
              </select>
            </div>
            <div className="meeting-field">
              <label htmlFor="admin-course-description">Descripción</label>
              <textarea
                id="admin-course-description"
                rows={3}
                placeholder="Qué aprenderá el estudiante en este programa."
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="meeting-field__row">
              <div className="meeting-field">
                <label htmlFor="admin-course-price">Precio</label>
                <input
                  id="admin-course-price"
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
                />
              </div>
              <div className="meeting-field">
                <label htmlFor="admin-course-currency">Moneda</label>
                <select
                  id="admin-course-currency"
                  value={form.currency}
                  onChange={(e) => setForm({ ...form, currency: e.target.value })}
                >
                  {['USD', 'EUR', 'MXN', 'COP', 'ARS'].map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="meeting-field">
              <label htmlFor="admin-course-cover">Imagen de portada</label>
              <input
                id="admin-course-cover"
                type="text"
                placeholder="Vacía: se genera una portada con IA y el logo"
                value={form.coverImage}
                onChange={(e) => setForm({ ...form, coverImage: e.target.value })}
              />
              <div className="admin-course-cover-tools">
                <button
                  type="button"
                  className="mentor-course-control"
                  onClick={handleGenerateCover}
                  disabled={generatingCover}
                >
                  {generatingCover ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Sparkles aria-hidden="true" />}
                  {generatingCover ? 'Generando…' : 'Generar con IA'}
                </button>
                {form.coverImage && (
                  <button type="button" className="mentor-course-control" onClick={() => setForm({ ...form, coverImage: '' })}>
                    <X aria-hidden="true" />
                    Quitar
                  </button>
                )}
              </div>
              {form.coverImage && <img src={form.coverImage} alt="Vista previa de la portada" className="admin-course-cover-preview" />}
            </div>

            <label className="admin-course-check">
              <input
                type="checkbox"
                checked={form.sequentialUnlock}
                onChange={(e) => setForm({ ...form, sequentialUnlock: e.target.checked })}
              />
              <span>
                <strong>Progresión secuencial</strong>
                <small>El alumno abre el Módulo 1 y desbloquea cada módulo al terminar el anterior.</small>
              </span>
            </label>
            <label className="admin-course-check">
              <input
                type="checkbox"
                checked={form.openToAllRegistered}
                onChange={(e) => setForm({ ...form, openToAllRegistered: e.target.checked })}
              />
              <span>
                <strong>Acceso para miembros</strong>
                <small>Mentees y personal de la academia. El resto necesita compra o asignación.</small>
              </span>
            </label>
            <label className="admin-course-check">
              <input
                type="checkbox"
                checked={form.published}
                onChange={(e) => setForm({ ...form, published: e.target.checked })}
              />
              <span>
                <strong>Publicar al guardar</strong>
                <small>Visible en el catálogo desde ahora.</small>
              </span>
            </label>

            </div>

            <div className="mentee-sheet__foot">
              {editingCourseId && (
                <button
                  type="button"
                  className="mentor-course-control admin-course-form__delete"
                  data-danger="true"
                  onClick={() => {
                    const target = courses.find((c) => c.id === editingCourseId);
                    resetForm();
                    if (target) handleDeleteCourse(target);
                  }}
                >
                  <Trash2 aria-hidden="true" />
                  Eliminar curso
                </button>
              )}
              <button type="button" className="mentor-course-control" onClick={resetForm}>Cancelar</button>
              <button type="submit" disabled={savingCourse} className="mentor-course-control mentor-course-publish">
                {savingCourse ? <Loader2 aria-hidden="true" className="animate-spin" /> : editingCourseId ? <Save aria-hidden="true" /> : <Plus aria-hidden="true" />}
                {editingCourseId ? 'Guardar cambios' : 'Crear curso'}
              </button>
            </div>
          </form>
        </div>
      </dialog>

      {/* Catálogo */}
      <div className="mentor-course-toolbar">
        <label className="mentor-mentee-search">
          <Search aria-hidden="true" />
          <input
            type="search"
            value={courseQuery}
            onChange={(e) => setCourseQuery(e.target.value)}
            placeholder="Buscar curso"
            aria-label="Buscar curso"
          />
        </label>
        <div className="mentor-publication-filters" role="group" aria-label="Filtrar por publicación">
          {(['all', 'published', 'draft'] as const).map((filter) => (
            <button key={filter} type="button" aria-pressed={statusFilter === filter} onClick={() => setStatusFilter(filter)}>
              <span>{filter === 'all' ? 'Todos' : filter === 'published' ? 'Publicados' : 'Borradores'}</span>
              <span className="mentor-publication-count">{statusCounts[filter]}</span>
            </button>
          ))}
        </div>
        <span className="mentor-course-filter-result" role="status" aria-live="polite">
          {visibleCourses.length} de {courses.length} cursos
        </span>
        <div className="mentor-publication-filters admin-view-toggle" role="group" aria-label="Vista del catálogo">
          <button type="button" aria-pressed={viewMode === 'list'} onClick={() => changeViewMode('list')}>
            <List aria-hidden="true" />
            <span>Lista</span>
          </button>
          <button type="button" aria-pressed={viewMode === 'cards'} onClick={() => changeViewMode('cards')}>
            <LayoutGrid aria-hidden="true" />
            <span>Tarjetas</span>
          </button>
        </div>
        <button type="button" className="mentor-course-control" onClick={loadCourses} aria-label="Actualizar catálogo">
          <RefreshCw aria-hidden="true" className={loading ? 'animate-spin' : ''} />
          Actualizar
        </button>
      </div>

      <div>
        {loading && courses.length === 0 ? (
          <div className="mentor-courses-empty" role="status">
            <Loader2 aria-hidden="true" className="animate-spin" />
            <p>Cargando cursos…</p>
          </div>
        ) : courses.length === 0 ? (
          <div className="mentor-courses-empty">
            <BookOpen aria-hidden="true" />
            <p>Todavía no hay cursos. Crea el primero con «Nuevo curso».</p>
          </div>
        ) : visibleCourses.length === 0 ? (
          <div className="mentor-courses-empty">
            <BookOpen aria-hidden="true" />
            <p>Ningún curso coincide con la búsqueda.</p>
          </div>
        ) : (
          <div className="admin-courses-list mentor-courses-grid" data-view={viewMode}>
            {visibleCourses.map((course) => {
              const isExpanded = expandedCourseId === course.id;
              const modules = [...course.modules].sort((a, b) => a.order - b.order);

              return (
                <article
                  key={course.id}
                  className="mentor-course-card admin-course-card"
                  data-view={viewMode}
                  data-expanded={isExpanded || undefined}
                  aria-labelledby={`admin-course-${course.id}`}
                >
                  {course.coverImage ? (
                    <img src={course.coverImage} alt="" loading="lazy" className="admin-course-card__cover" />
                  ) : (
                    <span className="admin-course-card__cover admin-course-card__cover--empty" aria-hidden="true">
                      <BookOpen />
                    </span>
                  )}
                  <div className="admin-course-card__summary">
                    <div className="mentor-course-card__header">
                      <span className="mentor-course-card__category">{course.category}</span>
                      <span className="mentor-course-card__status" data-published={course.published}>
                        {course.published ? 'Publicado' : 'Borrador'}
                      </span>
                    </div>

                    <div className="mentor-course-card__body">
                      <h3 id={`admin-course-${course.id}`} className="mentor-course-card__title">{course.title}</h3>
                      {course.description && <p className="mentor-course-card__description">{course.description}</p>}
                    </div>

                    <div className="admin-course-card__facts">
                      <span className="mentor-course-access-label" data-access={course.openToAllRegistered ? 'members' : 'assigned'}>
                        {course.openToAllRegistered ? <Globe aria-hidden="true" /> : <Lock aria-hidden="true" />}
                        {course.openToAllRegistered ? 'Acceso para miembros' : 'Solo asignados'}
                      </span>
                      <div className="mentor-course-card__meta">
                        <span>{modules.length} {modules.length === 1 ? 'módulo' : 'módulos'} · {countVideos(course)} {countVideos(course) === 1 ? 'video' : 'videos'}{course.sequentialUnlock ? ' · Secuencial' : ''}</span>
                        <span>{course.price > 0 ? `$${course.price} ${course.currency || 'USD'}` : 'Gratuito'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mentor-course-card__actions admin-course-card__actions">
                    <button
                      type="button"
                      onClick={() => handleOpenCourseMentors(course)}
                      className="mentor-course-control"
                      aria-haspopup="dialog"
                      aria-label={`Gestionar mentores de ${course.title}`}
                    >
                      <UsersRound aria-hidden="true" /> <span>Mentores</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setExpandedCourseId(isExpanded ? null : course.id)}
                      className="mentor-course-control"
                      aria-expanded={isExpanded}
                      aria-label={`Temario de ${course.title}`}
                    >
                      <Layers aria-hidden="true" /> <span>Temario</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => startEditing(course)}
                      className="mentor-course-control"
                      aria-label={`Editar ${course.title}`}
                    >
                      <Pencil aria-hidden="true" /> <span>Editar</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => (course.published ? setUnpublishTarget(course) : handleTogglePublished(course))}
                      disabled={busyId === course.id}
                      aria-busy={busyId === course.id}
                      className={`mentor-course-control ${course.published ? '' : 'mentor-course-publish'}`}
                      aria-label={`${course.published ? 'Pasar a borrador' : 'Publicar en catálogo'}: ${course.title}`}
                    >
                      {busyId === course.id ? (
                        <Loader2 aria-hidden="true" className="animate-spin" />
                      ) : course.published ? (
                        <EyeOff aria-hidden="true" />
                      ) : (
                        <BookOpen aria-hidden="true" />
                      )}
                      <span>{course.published ? 'Pasar a borrador' : 'Publicar'}</span>
                    </button>
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
                                        type="button"
                                        onClick={() => setQuizModule(module)}
                                        className="px-2 py-1 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center gap-1 text-[11px] font-bold transition-all cursor-pointer"
                                        title="Gestionar Examen con IA"
                                      >
                                        <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                                        <span>Examen IA</span>
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
                                  className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2 items-end p-2 rounded-lg bg-[#141420] border border-[#2d2d44]"
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
                                    <div className="col-span-full rounded-lg bg-[#0a0a0f] border border-[#2d2d44] p-2 space-y-2">
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

                                  <div className="col-span-full flex flex-wrap items-center justify-between gap-2">
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
                </article>
              );
            })}
          </div>
        )}
      </div>

      {quizModule && (
        <QuizManagerModal
          module={quizModule}
          isOpen={Boolean(quizModule)}
          onClose={() => setQuizModule(null)}
          onSaved={async () => {
            await loadAllQuizzes();
            loadCourses();
          }}
        />
      )}

      {/* Confirmaciones (mismo diálogo que el panel de mentor) */}
      <dialog
        ref={deleteRef}
        className="mentor-confirm"
        aria-labelledby="admin-delete-title"
        onCancel={(e) => { e.preventDefault(); if (!isDeleting) setDeleteTarget(null); }}
        onClick={(e) => { if (e.target === e.currentTarget && !isDeleting) setDeleteTarget(null); }}
      >
        {deleteTarget && (
          <div className="mentor-confirm__body">
            <h3 id="admin-delete-title" className="admin-confirm-title">
              <AlertTriangle aria-hidden="true" />
              {deleteTarget.type === 'course' ? 'Eliminar curso' : deleteTarget.type === 'module' ? 'Eliminar módulo' : 'Eliminar video'}
            </h3>
            <p>
              Vas a eliminar <strong>{deleteTarget.title}</strong>. {deleteTarget.warningText} No se puede deshacer.
            </p>
            {deleteTarget.error && (
              <p role="alert" className="admin-confirm-error">
                <strong>{deleteTarget.error}</strong>{' '}
                {deleteTarget.type === 'course'
                  ? 'El curso tiene pagos, matrículas, certificados o progreso de alumnos. Eliminarlo de todos modos borra todos esos registros.'
                  : deleteTarget.type === 'module'
                  ? 'El módulo tiene intentos de examen o progreso de alumnos. Eliminarlo de todos modos borra esos datos.'
                  : 'Esta lección tiene progreso o notas de alumnos. Eliminarla de todos modos borra ese progreso.'}
              </p>
            )}
            <div className="mentor-confirm__actions">
              <button type="button" className="mentor-course-control" disabled={isDeleting} onClick={() => setDeleteTarget(null)}>
                Cancelar
              </button>
              <button
                type="button"
                className="mentor-course-control"
                data-danger="true"
                disabled={isDeleting}
                onClick={() => executeDelete(Boolean(deleteTarget.error))}
              >
                {isDeleting ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Trash2 aria-hidden="true" />}
                {deleteTarget.error
                  ? 'Eliminar de todos modos'
                  : deleteTarget.type === 'course' ? 'Eliminar curso' : deleteTarget.type === 'module' ? 'Eliminar módulo' : 'Eliminar video'}
              </button>
            </div>
          </div>
        )}
      </dialog>

      <dialog
        ref={unpublishRef}
        className="mentor-confirm"
        aria-labelledby="admin-unpublish-title"
        onCancel={(e) => { e.preventDefault(); setUnpublishTarget(null); }}
        onClick={(e) => { if (e.target === e.currentTarget) setUnpublishTarget(null); }}
      >
        {unpublishTarget && (
          <div className="mentor-confirm__body">
            <h3 id="admin-unpublish-title" className="admin-confirm-title">
              <EyeOff aria-hidden="true" />
              Pasar a borrador
            </h3>
            <p>
              <strong>{unpublishTarget.title}</strong> dejará de aparecer en el catálogo y los alumnos no podrán abrirlo hasta que lo publiques de nuevo.
            </p>
            <div className="mentor-confirm__actions">
              <button type="button" className="mentor-course-control" onClick={() => setUnpublishTarget(null)}>
                Cancelar
              </button>
              <button
                type="button"
                className="mentor-course-control"
                data-danger="true"
                onClick={() => { const c = unpublishTarget; setUnpublishTarget(null); handleTogglePublished(c); }}
              >
                <EyeOff aria-hidden="true" />
                Pasar a borrador
              </button>
            </div>
          </div>
        )}
      </dialog>

      {/* Modal para Asignar Mentores a un Curso */}
      {mentorModalCourse && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget && !savingCourseMentors) {
              setMentorModalCourse(null);
            }
          }}
        >
          <div className="bg-[#0e0e18] border border-[#2d2d44] rounded-2xl p-6 w-full max-w-lg shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#2d2d44] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-brand-cyan/10 text-brand-cyan flex items-center justify-center">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-white">
                    Mentores a Cargo del Curso
                  </h3>
                  <p className="text-xs text-slate-400 truncate max-w-sm">
                    {mentorModalCourse.title}
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={savingCourseMentors}
                onClick={() => setMentorModalCourse(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Selecciona qué mentores tienen permiso para gestionar alumnos, tutorías y evaluaciones en este curso.
            </p>

            {courseMentorsNotice && (
              <div className="p-3 bg-brand-cyan/10 border border-brand-cyan/30 rounded-xl text-brand-cyan text-xs font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" /> {courseMentorsNotice}
              </div>
            )}

            {loadingCourseMentors ? (
              <div className="py-8 flex flex-col items-center justify-center text-slate-400 gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-brand-cyan" />
                <span className="text-xs">Cargando mentores disponibles...</span>
              </div>
            ) : (
              <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                {availableMentors.length === 0 ? (
                  <p className="text-xs text-slate-500 py-4 text-center">
                    No hay usuarios con rol Mentor o Administrador registrados.
                  </p>
                ) : (
                  availableMentors.map((m) => {
                    const isChecked = assignedMentorIds.includes(m.id);
                    return (
                      <label
                        key={m.id}
                        className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                          isChecked
                            ? 'bg-brand-cyan/10 border-brand-cyan/40 text-white'
                            : 'bg-[#141424] border-[#2d2d44] text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleCourseMentor(m.id)}
                            className="w-4 h-4 accent-[#06b6d4] rounded cursor-pointer"
                          />
                          <div className="min-w-0">
                            <p className="text-xs font-bold truncate">{m.name}</p>
                            <span className="text-[10px] text-slate-500">{m.email} [{m.role}]</span>
                          </div>
                        </div>
                        {isChecked && (
                          <span className="text-[10px] font-mono font-bold text-brand-cyan uppercase ml-2 shrink-0">
                            Asignado
                          </span>
                        )}
                      </label>
                    );
                  })
                )}
              </div>
            )}

            <div className="flex items-center justify-between pt-3 border-t border-[#2d2d44]">
              <span className="text-xs text-slate-400 font-mono">
                {assignedMentorIds.length} mentor{assignedMentorIds.length === 1 ? '' : 'es'} asignado{assignedMentorIds.length === 1 ? '' : 's'}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={savingCourseMentors}
                  onClick={() => setMentorModalCourse(null)}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={savingCourseMentors || loadingCourseMentors}
                  onClick={handleSaveCourseMentors}
                  className="btn-brand-primary px-4 py-1.5 text-xs font-bold flex items-center gap-1.5"
                >
                  {savingCourseMentors && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Guardar Mentores</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
    </div>
  );
};
