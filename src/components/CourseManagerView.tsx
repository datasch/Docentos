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
import { AdminSearchField, FilterMenu, ActiveFilters, Pager } from './AdminListKit';
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
  ChevronRight,
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
  LockKeyhole,
  LockKeyholeOpen,
  List,
  LayoutGrid,
  ArrowUpRight,
  FileText,
} from 'lucide-react';
import { api } from '../lib/api';
import { DriveCourseImport } from './DriveCourseImport';
import { YouTubeCourseBuilder } from './YouTubeCourseBuilder';
import { CourseCardDescription } from './CourseCardDescription';
import { Course, Module, VideoDriveLink, DriveVideoFile, QuizQuestion, User } from '../types';
import { QuizManagerModal } from './QuizManagerModal';
import { syncModuleQuizzes, getModuleQuestions } from '../plugins/QuizzesPlugin';

interface CourseManagerViewProps {
  currentUser?: User;
  onRefreshData: () => void;
  disableAnimation?: boolean;
  /** Abre la pestaña de Recursos desde el selector Catálogo | Recursos. */
  onOpenResources?: (courseId?: string) => void;
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
  onOpenResources,
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
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 639px)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)');
    const sync = () => setIsMobile(mq.matches);
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);
  const [storedViewMode, setViewMode] = useState<'list' | 'cards'>(() => {
    try {
      return localStorage.getItem(VIEW_MODE_KEY) === 'cards' ? 'cards' : 'list';
    } catch {
      return 'list';
    }
  });
  // En móvil solo hay tarjetas; la preferencia guardada de escritorio no se pisa.
  const viewMode = isMobile ? 'cards' : storedViewMode;
  const changeViewMode = (mode: 'list' | 'cards') => {
    setViewMode(mode);
    try {
      localStorage.setItem(VIEW_MODE_KEY, mode);
    } catch {
      // Sin almacenamiento la vista solo dura esta sesión.
    }
  };
  const [courseQuery, setCourseQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'published' | 'draft'>('ALL');
  const [accessFilter, setAccessFilter] = useState<'ALL' | 'members' | 'assigned'>('ALL');
  const [priceFilter, setPriceFilter] = useState<'ALL' | 'free' | 'paid'>('ALL');
  const [catFilter, setCatFilter] = useState('ALL');
  const [coursePage, setCoursePage] = useState(1);
  const [openModules, setOpenModules] = useState<Set<string>>(new Set());
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [savingCourse, setSavingCourse] = useState(false);
  const [generatingCover, setGeneratingCover] = useState(false);

  // Temario
  const [temarioCourseId, setTemarioCourseId] = useState<string | null>(null);
  const temarioCourse = courses.find((c) => c.id === temarioCourseId);
  const temarioRef = useRef<HTMLDialogElement>(null);
  const mentorsRef = useRef<HTMLDialogElement>(null);
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

  useEffect(() => {
    const d = temarioRef.current;
    if (!d) return;
    if (temarioCourseId && !d.open) d.showModal();
    if (!temarioCourseId && d.open) d.close();
  }, [temarioCourseId]);
  useEffect(() => {
    const d = mentorsRef.current;
    if (!d) return;
    if (mentorModalCourse && !d.open) d.showModal();
    if (!mentorModalCourse && d.open) d.close();
  }, [mentorModalCourse]);

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

  const searchDrive = async (query = driveQuery) => {
    setDriveLoading(true);
    setDriveError('');
    try {
      const res = await api.searchDriveVideos(query.trim() || undefined);
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

  useEffect(() => {
    if (!temarioCourseId) return;
    const c = courses.find((x) => x.id === temarioCourseId);
    const first = c ? [...c.modules].sort((a, b) => a.order - b.order)[0] : undefined;
    setOpenModules(new Set(first ? [first.id] : []));
  }, [temarioCourseId]);
  const toggleModule = (id: string) => setOpenModules((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const q = courseQuery.trim().toLowerCase();
  type Facets = { status: string; access: string; price: string; cat: string };
  const cur: Facets = { status: statusFilter, access: accessFilter, price: priceFilter, cat: catFilter };
  const matches = (c: Course, f: Facets) =>
    (!q || `${c.title} ${c.category}`.toLowerCase().includes(q)) &&
    (f.status === 'ALL' || (f.status === 'published') === c.published) &&
    (f.access === 'ALL' || (f.access === 'members') === !!c.openToAllRegistered) &&
    (f.price === 'ALL' || (f.price === 'paid') === (c.price > 0)) &&
    (f.cat === 'ALL' || c.category === f.cat);
  // Cada contador respeta los demás filtros: es lo que verás al elegir esa opción.
  const countWith = (patch: Partial<Facets>) => courses.filter((c) => matches(c, { ...cur, ...patch })).length;
  const categories = [...new Set(courses.map((c) => c.category).filter(Boolean))].sort();
  const visibleCourses = courses.filter((c) => matches(c, cur));
  const resourceCount = courses.reduce((total, course) =>
    total + (course.resources?.length || 0) + course.modules.reduce((moduleTotal, module) => moduleTotal + (module.resources?.length || 0), 0), 0);
  const pageSize = viewMode === 'list' ? 10 : 12;
  const curPage = Math.min(coursePage, Math.max(1, Math.ceil(visibleCourses.length / pageSize)));
  const pageCourses = visibleCourses.slice((curPage - 1) * pageSize, curPage * pageSize);
  const resetPage = () => setCoursePage(1);
  const clearCourseFilters = () => { setCourseQuery(''); setStatusFilter('ALL'); setAccessFilter('ALL'); setPriceFilter('ALL'); setCatFilter('ALL'); resetPage(); };
  const courseChips = [
    ...(statusFilter !== 'ALL' ? [{ key: 'st', text: statusFilter === 'published' ? 'Publicado' : 'Borrador', onRemove: () => { setStatusFilter('ALL'); resetPage(); } }] : []),
    ...(accessFilter !== 'ALL' ? [{ key: 'ac', text: accessFilter === 'members' ? 'Acceso para miembros' : 'Solo asignados', onRemove: () => { setAccessFilter('ALL'); resetPage(); } }] : []),
    ...(priceFilter !== 'ALL' ? [{ key: 'pr', text: priceFilter === 'free' ? 'Gratuito' : 'De pago', onRemove: () => { setPriceFilter('ALL'); resetPage(); } }] : []),
    ...(catFilter !== 'ALL' ? [{ key: 'ct', text: catFilter, onRemove: () => { setCatFilter('ALL'); resetPage(); } }] : []),
    ...(q ? [{ key: 'q', text: `«${courseQuery.trim()}»`, onRemove: () => { setCourseQuery(''); resetPage(); } }] : []),
  ];

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

      {onOpenResources && (
        <div className="admin-people-top">
          <div className="mentor-publication-filters" role="group" aria-label="Sección de cursos">
            <button type="button" aria-pressed="true">
              <span>Catálogo</span>
              <span className="mentor-publication-count">({courses.length})</span>
            </button>
            <button type="button" aria-pressed="false" onClick={() => onOpenResources()}>
              <span>Recursos</span>
              <span className="mentor-publication-count">({resourceCount})</span>
            </button>
          </div>
        </div>
      )}

      {creationTab === 'youtube' && (
        <div className="admin-courses-wizard">
          <YouTubeCourseBuilder
            currentUser={currentUser}
            onCourseCreated={() => {
              flash('¡Curso creado exitosamente con IA desde YouTube!');
              refreshAll();
              setCreationTab('manual');
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

          <div className="admin-course-sheet">
          <div className="admin-course-sheet__scroll">
          <form id="admin-course-form" onSubmit={handleSubmitCourse} className="admin-course-form">
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
              <label htmlFor="admin-course-cover">URL de la portada</label>
              <input
                id="admin-course-cover"
                type="text"
                inputMode="url"
                autoComplete="url"
                placeholder="https://ejemplo.com/portada.jpg"
                value={form.coverImage}
                onChange={(e) => setForm({ ...form, coverImage: e.target.value })}
                aria-describedby="admin-course-cover-hint"
              />
              <small id="admin-course-cover-hint" className="admin-sheet-note">Pega una URL o genera una portada con IA. Puedes dejarla vacía.</small>
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

          </form>
          </div>
          <div className="mentee-sheet__foot admin-course-form__foot">
            <button type="submit" form="admin-course-form" disabled={savingCourse} className="mentor-course-control mentor-course-publish admin-course-form__submit">
              {savingCourse ? <Loader2 aria-hidden="true" className="animate-spin" /> : editingCourseId ? <Save aria-hidden="true" /> : <Plus aria-hidden="true" />}
              {editingCourseId ? 'Guardar cambios' : 'Crear curso'}
            </button>
            <button type="button" className="mentor-course-control admin-course-form__cancel" onClick={resetForm}>Cancelar</button>
            {editingCourseId && (
              <button
                type="button"
                className="mentor-course-control"
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
          </div>
          </div>
        </div>
      </dialog>

      {/* Catálogo */}
      <div className="mentor-course-toolbar">
        <AdminSearchField value={courseQuery} onChange={(value) => { setCourseQuery(value); resetPage(); }} placeholder="Buscar curso" label="Buscar curso" />
        <FilterMenu
          groups={[
            { value: statusFilter, onChange: (v) => { setStatusFilter(v as typeof statusFilter); resetPage(); }, options: [
              { value: 'published', label: 'Publicado', count: countWith({ status: 'published' }) },
              { value: 'draft', label: 'Borrador', count: countWith({ status: 'draft' }) },
            ] },
            { value: accessFilter, onChange: (v) => { setAccessFilter(v as typeof accessFilter); resetPage(); }, options: [
              { value: 'members', label: 'Acceso para miembros', count: countWith({ access: 'members' }) },
              { value: 'assigned', label: 'Solo asignados', count: countWith({ access: 'assigned' }) },
            ] },
            { value: priceFilter, onChange: (v) => { setPriceFilter(v as typeof priceFilter); resetPage(); }, options: [
              { value: 'free', label: 'Gratuito', count: countWith({ price: 'free' }) },
              { value: 'paid', label: 'De pago', count: countWith({ price: 'paid' }) },
            ] },
            ...(categories.length > 1 ? [{ value: catFilter, onChange: (v: string) => { setCatFilter(v); resetPage(); }, options: categories.map((c) => ({ value: c, label: c, count: countWith({ cat: c }) })) }] : []),
          ]}
        />
        {!isMobile && <div className="mentor-publication-filters admin-view-toggle" role="group" aria-label="Vista del catálogo">
          <button type="button" aria-pressed={viewMode === 'list'} onClick={() => { changeViewMode('list'); resetPage(); }}>
            <List aria-hidden="true" />
            <span>Lista</span>
          </button>
          <button type="button" aria-pressed={viewMode === 'cards'} onClick={() => { changeViewMode('cards'); resetPage(); }}>
            <LayoutGrid aria-hidden="true" />
            <span>Tarjetas</span>
          </button>
        </div>}
      </div>

      <ActiveFilters chips={courseChips} shown={visibleCourses.length} total={courses.length} noun="cursos" onClear={clearCourseFilters} />

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
            {pageCourses.map((course) => {
              const modules = [...course.modules].sort((a, b) => a.order - b.order);

              return (
                <article
                  key={course.id}
                  className="mentor-course-card admin-course-card"
                  data-view={viewMode}
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
                      {course.description && <CourseCardDescription text={course.description} />}
                    </div>

                    <div className="admin-course-card__facts">
                      {onOpenResources && <button type="button" className="admin-course-card__resources" onClick={() => onOpenResources(course.id)} aria-label={`Ver recursos de ${course.title}`}><FileText aria-hidden="true" /><span>{(course.resources?.length || 0) + modules.reduce((count, module) => count + (module.resources?.length || 0), 0)} recursos</span><ArrowUpRight aria-hidden="true" /></button>}
                      <span className="mentor-course-access-label" data-access={course.openToAllRegistered ? 'members' : 'assigned'}>
                        {course.openToAllRegistered ? <LockKeyholeOpen aria-hidden="true" /> : <LockKeyhole aria-hidden="true" />}
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
                      onClick={() => setTemarioCourseId(course.id)}
                      className="mentor-course-control"
                      aria-haspopup="dialog"
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
                      className={`mentor-course-control admin-course-card__publish ${course.published ? '' : 'mentor-course-publish'}`}
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


                </article>
              );
            })}
          </div>
        )}
      </div>

      <Pager total={visibleCourses.length} size={pageSize} page={curPage} onPage={setCoursePage} noun="cursos" />

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

      {/* Mentores del curso en hoja lateral */}
      <dialog
        ref={mentorsRef}
        className="mentee-sheet"
        aria-labelledby="admin-course-mentors-title"
        onCancel={(e) => { e.preventDefault(); if (!savingCourseMentors) setMentorModalCourse(null); }}
        onClick={(e) => { if (e.target === e.currentTarget && !savingCourseMentors) setMentorModalCourse(null); }}
      >
        <div className="mentee-sheet__body">
          <header className="mentee-sheet__head">
            <span className="mentee-sheet__icon" aria-hidden="true"><UsersRound /></span>
            <div className="mentor-mentee-id">
              <strong id="admin-course-mentors-title">Mentores del curso</strong>
              <span>{mentorModalCourse?.title}</span>
            </div>
            <button type="button" disabled={savingCourseMentors} onClick={() => setMentorModalCourse(null)} className="mentee-sheet__close" aria-label="Cerrar">
              <X aria-hidden="true" />
            </button>
          </header>
          <div className="admin-course-sheet">
            <div className="admin-course-sheet__scroll">
              <p className="admin-sheet-note">Elige qué mentores pueden gestionar alumnos, tutorías y evaluaciones en este curso.</p>
              {courseMentorsNotice && (
                <p className="admin-sheet-note" role="status"><CheckCircle2 aria-hidden="true" /> {courseMentorsNotice}</p>
              )}
              {loadingCourseMentors ? (
                <p className="admin-sheet-note"><Loader2 aria-hidden="true" className="animate-spin" /> Cargando mentores…</p>
              ) : availableMentors.length === 0 ? (
                <p className="admin-sheet-note">No hay usuarios con rol Mentor o Administrador registrados.</p>
              ) : (
                availableMentors.map((m) => (
                  <label key={m.id} className="admin-course-check">
                    <input type="checkbox" checked={assignedMentorIds.includes(m.id)} onChange={() => handleToggleCourseMentor(m.id)} />
                    <span>
                      <strong>{m.name}</strong>
                      <small>{m.email} · {m.role}</small>
                    </span>
                  </label>
                ))
              )}
            </div>
            <div className="mentee-sheet__foot admin-course-form__foot">
              <button type="button" disabled={savingCourseMentors || loadingCourseMentors} onClick={handleSaveCourseMentors} className="mentor-course-control mentor-course-publish admin-course-form__submit">
                {savingCourseMentors ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Save aria-hidden="true" />}
                Guardar mentores ({assignedMentorIds.length})
              </button>
              <button type="button" disabled={savingCourseMentors} onClick={() => setMentorModalCourse(null)} className="mentor-course-control admin-course-form__cancel">Cancelar</button>
            </div>
          </div>
        </div>
      </dialog>

      {/* Temario del curso en hoja lateral */}
      <dialog
        ref={temarioRef}
        className="mentee-sheet"
        aria-labelledby="admin-course-temario-title"
        onCancel={(e) => { e.preventDefault(); setTemarioCourseId(null); }}
        onClick={(e) => { if (e.target === e.currentTarget) setTemarioCourseId(null); }}
      >
        <div className="mentee-sheet__body">
          <header className="mentee-sheet__head">
            <span className="mentee-sheet__icon" aria-hidden="true"><Layers /></span>
            <div className="mentor-mentee-id">
              <strong id="admin-course-temario-title">Temario</strong>
              <span>{temarioCourse?.title}</span>
            </div>
            <button type="button" onClick={() => setTemarioCourseId(null)} className="mentee-sheet__close" aria-label="Cerrar">
              <X aria-hidden="true" />
            </button>
          </header>
          <div className="admin-course-sheet__scroll">
            {temarioCourse && (() => {
              const course = temarioCourse;
              const modules = [...course.modules].sort((a, b) => a.order - b.order);
              return (
<div className="tmr">
                <div className="tmr-add">
                  <div className="meeting-field">
                    <label htmlFor="tmr-new-module">Nuevo módulo</label>
                    <input
                      id="tmr-new-module"
                      type="text"
                      placeholder="Título del módulo"
                      value={newModuleTitle}
                      onChange={(e) => setNewModuleTitle(e.target.value)}
                    />
                  </div>
                  <button type="button" onClick={() => handleCreateModule(course.id)} className="mentor-course-control mentor-course-publish">
                    <Plus aria-hidden="true" /> <span>Agregar módulo</span>
                  </button>
                </div>

                {modules.length === 0 ? (
                  <p className="admin-sheet-note">Este curso todavía no tiene módulos.</p>
                ) : (
                  modules.map((module, moduleIndex) => {
                    const videos = [...module.videos].sort((a, b) => a.order - b.order);
                    const isOpen = openModules.has(module.id) || videoModuleId === module.id;

                    return (
                      <section key={module.id} className="tmr-module" aria-label={module.title}>
                        {editingModuleId === module.id ? (
                          <div className="tmr-rename">
                            <div className="meeting-field">
                              <label htmlFor={`tmr-rename-${module.id}`}>Título del módulo</label>
                              <input
                                id={`tmr-rename-${module.id}`}
                                type="text"
                                value={editingModuleTitle}
                                onChange={(e) => setEditingModuleTitle(e.target.value)}
                                autoFocus
                              />
                            </div>
                            <button type="button" onClick={() => handleRenameModule(module.id)} className="mentor-course-control mentor-course-publish">
                              <Save aria-hidden="true" /> <span>Guardar</span>
                            </button>
                            <button type="button" onClick={() => setEditingModuleId(null)} className="mentor-course-control">
                              <X aria-hidden="true" /> <span>Cancelar</span>
                            </button>
                          </div>
                        ) : (
                          <>
                            <button type="button" className="tmr-module__head" aria-expanded={isOpen} onClick={() => toggleModule(module.id)}>
                              <ChevronRight aria-hidden="true" />
                              <h4>{module.order}. {module.title}</h4>
                              <span>{videos.length} {videos.length === 1 ? 'video' : 'videos'}</span>
                            </button>
                            {isOpen && <div className="tmr-actions">
                              <span className="tmr-actions__icons">
                              <span className="tmr-group">
                              <button type="button" className="mentor-course-control tmr-icon" onClick={() => handleMoveModule(modules, moduleIndex, -1)} disabled={moduleIndex === 0} aria-label={`Subir módulo ${module.title}`} title="Subir">
                                <ChevronUp aria-hidden="true" />
                              </button>
                              <button type="button" className="mentor-course-control tmr-icon" onClick={() => handleMoveModule(modules, moduleIndex, 1)} disabled={moduleIndex === modules.length - 1} aria-label={`Bajar módulo ${module.title}`} title="Bajar">
                                <ChevronDown aria-hidden="true" />
                              </button>
                              </span>
                              <span className="tmr-group">
                              <button type="button" className="mentor-course-control tmr-icon" onClick={() => { setEditingModuleId(module.id); setEditingModuleTitle(module.title); }} aria-label={`Renombrar módulo ${module.title}`} title="Renombrar">
                                <Pencil aria-hidden="true" />
                              </button>
                              <button type="button" className="mentor-course-control tmr-icon" data-danger="true" onClick={() => handleDeleteModule(module)} aria-label={`Eliminar módulo ${module.title}`} title="Eliminar módulo">
                                <Trash2 aria-hidden="true" />
                              </button>
                              </span>
                              </span>
                              <span className="tmr-actions__main">
                              <button type="button" className="mentor-course-control" onClick={() => setQuizModule(module)}>
                                <Sparkles aria-hidden="true" /> <span>Examen IA</span>
                              </button>
                              <button type="button" className="mentor-course-control" aria-expanded={videoModuleId === module.id} onClick={() => { resetVideoForm(); setVideoModuleId(videoModuleId === module.id ? null : module.id); }}>
                                <Plus aria-hidden="true" /> <span>Agregar video</span>
                              </button>
                              </span>
                            </div>}
                          </>
                        )}

                        {/* Alta de video */}
                        {isOpen && videoModuleId === module.id && (
                          <form onSubmit={(e) => handleCreateVideo(e, module.id)} className="tmr-form">
                            <div className="meeting-field">
                              <label htmlFor={`tmr-vt-${module.id}`}>Título del video</label>
                              <input id={`tmr-vt-${module.id}`} type="text" value={videoTitle} onChange={(e) => setVideoTitle(e.target.value)} required />
                            </div>
                            <div className="meeting-field">
                              <label htmlFor={`tmr-vd-${module.id}`}>Duración</label>
                              <input id={`tmr-vd-${module.id}`} type="text" placeholder="20:00" value={videoDuration} onChange={(e) => setVideoDuration(e.target.value)} />
                            </div>
                            <div className="meeting-field">
                              <label htmlFor={`tmr-vg-${module.id}`}>Archivo de Google Drive</label>
                              <div className="tmr-inline">
                                <input id={`tmr-vg-${module.id}`} type="text" placeholder="Pega el enlace de Drive o su ID" value={videoDriveId} onChange={(e) => setVideoDriveId(e.target.value)} />
                                <button
                                  type="button"
                                  className="mentor-course-control tmr-icon"
                                  aria-expanded={driveOpen}
                                  aria-label="Buscar en Google Drive"
                                  title="Buscar en Google Drive"
                                  onClick={() => {
                                    const opening = !driveOpen;
                                    setDriveOpen(opening);
                                    if (opening && driveResults.length === 0) searchDrive();
                                  }}
                                >
                                  <HardDrive aria-hidden="true" />
                                </button>
                              </div>
                            </div>

                            {/* Selector de Google Drive */}
                            {driveOpen && (
                              <div className="tmr-drive">
                                <div className="tmr-inline">
                                  <AdminSearchField className="tmr-drive-search" value={driveQuery} onChange={(value) => { setDriveQuery(value); if (!value && driveQuery) searchDrive(''); }} placeholder="Buscar por nombre en Google Drive…" label="Buscar en Google Drive" onKeyDown={(e) => {
                                    if (e.key === 'Enter') { e.preventDefault(); searchDrive(); }
                                  }} />
                                  <button type="button" className="mentor-course-control tmr-icon" onClick={() => searchDrive()} disabled={driveLoading} aria-label="Buscar">
                                    {driveLoading ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Search aria-hidden="true" />}
                                  </button>
                                </div>

                                {driveIsDemo && (
                                  <p className="tmr-warn">
                                    Google Drive no está configurado: estos resultados son de demostración y sus identificadores no existen, así que el reproductor quedará vacío. Pega el enlace real del vídeo en el campo de arriba, o configura las credenciales de Drive.
                                  </p>
                                )}
                                {driveError && <p className="tmr-warn">{driveError}</p>}

                                <div className="tmr-drive__list">
                                  {driveResults.map((file) => (
                                    <button type="button" key={file.id} onClick={() => pickDriveVideo(file)} className="tmr-drive__item" aria-pressed={videoDriveId === file.id}>
                                      {file.thumbnailLink ? (
                                        <img src={file.thumbnailLink} alt="" />
                                      ) : (
                                        <span className="tmr-drive__thumb" aria-hidden="true"><Play /></span>
                                      )}
                                      <span className="tmr-drive__text">
                                        <strong>{file.name}</strong>
                                        <small>{file.duration || 'sin duración'} · {file.id.slice(0, 14)}…</small>
                                      </span>
                                      {videoDriveId === file.id && <Link2 aria-hidden="true" />}
                                    </button>
                                  ))}
                                  {!driveLoading && driveResults.length === 0 && !driveError && (
                                    <p className="admin-sheet-note">Busca un video para enlazarlo.</p>
                                  )}
                                </div>
                              </div>
                            )}

                            <p className="admin-sheet-note">
                              {videoDriveId ? `Enlazado a Drive: ${videoDriveId}` : 'Sin archivo de Drive: se generará un enlace de marcador.'}
                            </p>
                            <button type="submit" className="mentor-course-control mentor-course-publish">
                              <Save aria-hidden="true" /> <span>Guardar video</span>
                            </button>
                          </form>
                        )}

                        {/* Videos del módulo */}
                        {isOpen && videos.length > 0 && (
                          <ul className="tmr-videos">
                            {videos.map((video, videoIndex) => (
                              <li key={video.id} className="tmr-video">
                                <Play aria-hidden="true" />
                                <span className="tmr-video__text">
                                  <strong>{video.title}</strong>
                                  {video.duration && <small>{video.duration}</small>}
                                </span>
                                <span className="tmr-video__actions">
                                  <span className="tmr-group">
                                  <button type="button" className="mentor-course-control tmr-icon" onClick={() => handleMoveVideo(videos, videoIndex, -1)} disabled={videoIndex === 0} aria-label={`Subir ${video.title}`} title="Subir">
                                    <ChevronUp aria-hidden="true" />
                                  </button>
                                  <button type="button" className="mentor-course-control tmr-icon" onClick={() => handleMoveVideo(videos, videoIndex, 1)} disabled={videoIndex === videos.length - 1} aria-label={`Bajar ${video.title}`} title="Bajar">
                                    <ChevronDown aria-hidden="true" />
                                  </button>
                                  </span>
                                  <button type="button" className="mentor-course-control tmr-icon" data-danger="true" onClick={() => handleDeleteVideo(video)} aria-label={`Eliminar ${video.title}`} title="Eliminar video">
                                    <Trash2 aria-hidden="true" />
                                  </button>
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </section>
                    );
                  })
                )}
              </div>
              );
            })()}
          </div>
        </div>
      </dialog>
    </div>
    </div>
  );
};
