/**
 * Panel de Administración & Mentoría
 * Academia Giantucchi
 *
 * Permite a los Profesores y Mentores:
 * 1. Gestionar Usuarios y Asignar Pases VIP (RBAC)
 * 2. Enlazar Videos de Google Drive a Módulos del Temario
 * 3. Responder Preguntas de Mentoría en la bandeja de entrada
 */

import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Shield, Crown, UserCheck, HardDrive, MessageSquare, Plus, RefreshCw, CheckCircle2, Users, Layers, ExternalLink, Sparkles, Volume2, Play, Trash2, Award, Wand2, Loader2, Sliders, GraduationCap, BookOpen, Download, FileText, Ban, Check, XCircle, AlertTriangle, Link2, FileCheck, Eye, HeartHandshake, Palette, LayoutDashboard, List, LayoutGrid } from 'lucide-react';
import { avatarSrc } from '../lib/avatar.js';
import { api } from '../lib/api';
import { User, UserRole, Course, Module, DriveVideoFile, TTSGuide, CertificateRecord, CourseEnrollmentRecord, CourseResource } from '../types';
import { SUPPORTED_TTS_VOICES } from '../lib/ttsService';
import { PluginManagerView } from './PluginManagerView';
import { LandingPageEditor } from './LandingPageEditor';
import { CourseManagerView } from './CourseManagerView';
import { AdminPeopleView } from './AdminPeopleView';
import { AdminEnrollSheet } from './AdminEnrollSheet';
import { AdminResourceSheet } from './AdminResourceSheet';
import { AdminDriveVideoSheet } from './AdminDriveVideoSheet';
import { AdminCoursePicker } from './AdminCoursePicker';
import { AdminSearchField, FilterMenu, ActiveFilters, Pager, useListView } from './AdminListKit';
import { AdminCertificationView } from './AdminCertificationView';
import { AdminSignatureSheet } from './AdminSignatureSheet';
import { AdminTTSView } from './AdminTTSView';
import { ListeningAdminPanel } from './ListeningAdminPanel';
import { pluginManager } from '../plugins/PluginManager';
import { DEFAULT_LOGO_URL } from '../lib/logoConfig';
import { FestiveHatOverlay } from './FestiveHatOverlay';
import { MODERN_ADMIN_MODULES, type ModernAdminModuleId } from '../lib/adminNavigation';

interface AdminDashboardProps {
  currentUser?: User;
  /**
   * Nulo en una instancia recien instalada: el catalogo esta vacio hasta que
   * el administrador cree el primer curso, y es justo aqui donde lo crea.
   */
  course: Course | null;
  onRefreshData: () => void;
}

/**
 * Marcador para las secciones que operan sobre un curso mientras todavia no
 * existe ninguno. Evita que el panel entero se caiga por un catalogo vacio.
 */
const CURSO_VACIO: Course = {
  id: '',
  title: 'Sin cursos todavia',
  description: '',
  price: 0,
  published: false,
  category: '',
  coverImage: '',
  modules: [],
};

export type MasterSection = 'courses' | 'users' | 'legal' | 'system';
export type SubTab =
  | 'overview'
  | 'users'
  | 'courses'
  | 'contracts'
  | 'drive'
  | 'tts'
  | 'plugins'
  | 'landing'
  | 'enrollments'
  | 'certificates'
  | 'resources'
  | 'listening';

const ADMIN_TABS: SubTab[] = ['overview', 'users', 'courses', 'contracts', 'drive', 'tts', 'plugins', 'landing', 'enrollments', 'certificates', 'resources', 'listening'];

// Al recargar se vuelve a la pestaña de la URL (?tab=), no al inicio.
const tabFromUrl = (): SubTab | null => {
  if (typeof window === 'undefined') return null;
  const tab = new URLSearchParams(window.location.search).get('tab');
  return ADMIN_TABS.find((t) => t === tab) ?? null;
};

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ currentUser, course, onRefreshData }) => {
  const { t } = useTranslation();
  const [initialTab] = useState<SubTab | null>(tabFromUrl);
  const [masterSection, setMasterSection] = useState<MasterSection>('courses');
  const [activeTab, setActiveTab] = useState<SubTab>(initialTab ?? 'courses');

  // Estado interno para la vista unificada de Usuarios y Matrículas
  const [userSectionView, setUserSectionView] = useState<'directory' | 'enrollments'>(initialTab === 'enrollments' ? 'enrollments' : 'directory');
  const [showQuickEnroll, setShowQuickEnroll] = useState(false);
  const [enrollFromSheet, setEnrollFromSheet] = useState(false);

  // Estado unificado de Medios y Recursos (Descargables, Drive, TTS)
  const [mediaView, setMediaView] = useState<'resources' | 'drive' | 'tts'>(initialTab === 'drive' || initialTab === 'tts' ? initialTab : 'resources');

  // Estado unificado de Certificación y Legal (Certificados, Contratos)
  const [legalView, setLegalView] = useState<'certificates' | 'contracts'>(initialTab === 'contracts' ? 'contracts' : 'certificates');

  // Estado unificado de Portal y Feedback (Portada, Buzón NPS)
  const [portalView, setPortalView] = useState<'landing' | 'listening'>(initialTab === 'listening' ? 'listening' : 'landing');

  // Integración con el Plugin de Personalización y Versiones de DocentOS
  const isCustomizerEnabled = pluginManager.isEnabled('docentos-customizer');
  const [customizerConfig, setCustomizerConfig] = useState(() => pluginManager.getCustomizerConfig());
  const [uiVersion, setUiVersion] = useState<'v0.5-modern' | 'v0.4-classic'>(() => {
    try {
      const saved = localStorage.getItem('docentos_ui_version') as 'v0.5-modern' | 'v0.4-classic';
      if (saved === 'v0.5-modern' || saved === 'v0.4-classic') return saved;
    } catch {}
    return isCustomizerEnabled ? (customizerConfig.interfaceVersion || 'v0.5-modern') : 'v0.5-modern';
  });

  // Carga inmediata de la configuración de plugins desde el backend al entrar a Admin
  useEffect(() => {
    api.getPlugins().then((res) => {
      if (res?.plugins) {
        pluginManager.setPlugins(res.plugins);
        const latestCustomizer = res.plugins.find((p: any) => p.id === 'docentos-customizer');
        if (latestCustomizer?.config?.interfaceVersion) {
          const ver = latestCustomizer.config.interfaceVersion === 'v0.4-classic' ? 'v0.4-classic' : 'v0.5-modern';
          setUiVersion(ver);
          try {
            localStorage.setItem('docentos_ui_version', ver);
          } catch {}
        }
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-ui-version', uiVersion);
    const handleCustomizerUpdate = () => {
      const cfg = pluginManager.getCustomizerConfig();
      setCustomizerConfig(cfg);
      const effectiveVer = cfg.interfaceVersion || 'v0.5-modern';
      setUiVersion(effectiveVer);
      try {
        localStorage.setItem('docentos_ui_version', effectiveVer);
      } catch {}
    };
    window.addEventListener('docentos-customizer-change', handleCustomizerUpdate);
    window.addEventListener('docentos-brand-change', handleCustomizerUpdate);
    window.addEventListener('docentos-logo-change', handleCustomizerUpdate);
    return () => {
      window.removeEventListener('docentos-customizer-change', handleCustomizerUpdate);
      window.removeEventListener('docentos-brand-change', handleCustomizerUpdate);
      window.removeEventListener('docentos-logo-change', handleCustomizerUpdate);
    };
  }, [uiVersion]);

  useEffect(() => {
    if (uiVersion === 'v0.5-modern' && activeTab === 'courses' && masterSection === 'courses' && !initialTab) {
      setActiveTab('overview');
    }
    if (uiVersion === 'v0.4-classic' && activeTab === 'overview') {
      setActiveTab('courses');
    }
  }, [uiVersion]);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get('tab') === activeTab) return;
    url.searchParams.set('tab', activeTab);
    window.history.replaceState(window.history.state, '', url);
  }, [activeTab]);

  const handleSwitchUiVersion = async (targetVer: 'v0.5-modern' | 'v0.4-classic') => {
    setUiVersion(targetVer);
    try {
      localStorage.setItem('docentos_ui_version', targetVer);
    } catch {}
    setCustomizerConfig((prev) => ({ ...prev, interfaceVersion: targetVer }));
    pluginManager.updateConfig('docentos-customizer', { interfaceVersion: targetVer });
    try {
      const currentCfg = pluginManager.getPlugin('docentos-customizer')?.config || {};
      await api.updatePluginConfig('docentos-customizer', { ...currentCfg, interfaceVersion: targetVer });
    } catch (err) {
      console.error('Error al guardar versión de interfaz de DocentOS:', err);
    }
  };

  const selectTab = (tab: SubTab) => {
    setActiveTab(tab);

    if (tab === 'overview') {
      setMasterSection('courses');
      return;
    }
    if (tab === 'enrollments') {
      setUserSectionView('enrollments');
      setMasterSection('users');
      return;
    }
    if (tab === 'users') {
      setUserSectionView('directory');
      setMasterSection('users');
      return;
    }
    if (['resources', 'drive', 'tts'].includes(tab)) {
      setMediaView(tab as 'resources' | 'drive' | 'tts');
      setMasterSection('courses');
      return;
    }
    if (['certificates', 'contracts'].includes(tab)) {
      setLegalView(tab as 'certificates' | 'contracts');
      setMasterSection('legal');
      return;
    }
    if (['landing', 'listening'].includes(tab)) {
      setPortalView(tab as 'landing' | 'listening');
      setMasterSection('system');
      return;
    }
    if (tab === 'courses') setMasterSection('courses');
    else if (tab === 'plugins') setMasterSection('system');
  };

  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [roleErrorMsg, setRoleErrorMsg] = useState('');

  // Contracts / Legal Audit State
  const [contractSignatures, setContractSignatures] = useState<any[]>([]);
  const [loadingContracts, setLoadingContracts] = useState(false);
  const [contractSearch, setContractSearch] = useState('');
  const [selectedAuditSignature, setSelectedAuditSignature] = useState<any | null>(null);

  /**
   * El catálogo completo, no solo el curso abierto.
   *
   * El panel recibe un único `course` por props, y Recursos, Videos Drive y
   * Guías TTS trabajaban siempre sobre él: con varios cursos publicados, el
   * administrador solo podía tocar el primero y no había forma de decir sobre
   * cuál estaba operando. Aquí se carga el catálogo y se elige explícitamente.
   */
  const [allCourses, setAllCourses] = useState<Course[]>(course ? [course] : []);
  const [workCourseId, setWorkCourseId] = useState<string>(course?.id || '');
  const workCourse = allCourses.find((item) => item.id === workCourseId) || course || CURSO_VACIO;
  const workModules = workCourse.modules || [];

  // Gestión de Cursos Asignados a Mentores (Scoped Mentorship)
  const [selectedMentorForCourses, setSelectedMentorForCourses] = useState<User | null>(null);
  const [mentorAssignedCourseIds, setMentorAssignedCourseIds] = useState<string[]>([]);
  const [loadingMentorCourses, setLoadingMentorCourses] = useState<boolean>(false);
  const [savingMentorCourses, setSavingMentorCourses] = useState<boolean>(false);
  const [mentorCoursesNotice, setMentorCoursesNotice] = useState<string | null>(null);

  // Enrollments State
  const [enrollments, setEnrollments] = useState<CourseEnrollmentRecord[]>([]);
  const [loadingEnrollments, setLoadingEnrollments] = useState(false);
  const [newEnrollUserId, setNewEnrollUserId] = useState('');
  const [newEnrollCourseId, setNewEnrollCourseId] = useState(course?.id || '');
  const [newEnrollStatus, setNewEnrollStatus] = useState<'ACTIVE' | 'COMPLETED' | 'REVOKED' | 'EXPIRED'>('ACTIVE');
  const [newEnrollSource, setNewEnrollSource] = useState<'ADMIN' | 'PAYMENT' | 'MENTORSHIP'>('ADMIN');
  const [enrollSuccessMsg, setEnrollSuccessMsg] = useState('');

  // Certificates State
  const [certificates, setCertificates] = useState<CertificateRecord[]>([]);
  const [loadingCertificates, setLoadingCertificates] = useState(false);
  const [revokingCertId, setRevokingCertId] = useState<string | null>(null);
  const [revokeReason, setRevokeReason] = useState('');

  // Resources State
  const [resourceQuery, setResourceQuery] = useState('');
  const [resourceKindFilter, setResourceKindFilter] = useState('ALL');
  const [resourcePage, setResourcePage] = useState(1);
  const { isMobile: resourceIsMobile, view: resourceView, change: changeResourceView } = useListView('admin-resources-view');
  const [showResourceSheet, setShowResourceSheet] = useState(false);
  const [resourceToDelete, setResourceToDelete] = useState<CourseResource | null>(null);
  const [deletingResource, setDeletingResource] = useState(false);
  const resourceConfirmRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = resourceConfirmRef.current;
    if (!dialog) return;
    if (resourceToDelete && !dialog.open) dialog.showModal();
    if (!resourceToDelete && dialog.open) dialog.close();
  }, [resourceToDelete]);
  const [resTitle, setResTitle] = useState('');
  const [resPrivateUrl, setResPrivateUrl] = useState('');
  const [resKind, setResKind] = useState<'FILE' | 'LINK'>('FILE');
  const [resModuleId, setResModuleId] = useState<string>('');
  const [resSuccessMsg, setResSuccessMsg] = useState('');
  const [resErrorMsg, setResErrorMsg] = useState('');

  // Drive Linker State
  const [searchQuery, setSearchQuery] = useState('');
  const [driveVideos, setDriveVideos] = useState<DriveVideoFile[]>([]);
  const { isMobile: driveIsMobile, view: driveView, change: changeDriveView } = useListView('admin-drive-view');
  const [driveLinkFilter, setDriveLinkFilter] = useState('ALL');
  const [drivePage, setDrivePage] = useState(1);
  const [showDriveSheet, setShowDriveSheet] = useState(false);
  const [loadingDrive, setLoadingDrive] = useState(false);
  const driveRequestId = useRef(0);
  const driveSearchReady = useRef(false);
  const [driveIsDemo, setDriveIsDemo] = useState(false);
  const [selectedModuleId, setSelectedModuleId] = useState(course?.modules[0]?.id || '');
  const [linkingVideo, setLinkingVideo] = useState<DriveVideoFile | null>(null);
  const [linkSuccessMsg, setLinkSuccessMsg] = useState('');
  const [driveErrorMsg, setDriveErrorMsg] = useState('');
  // Alta directa por enlace: sin credenciales de Drive el buscador no ve la
  // cuenta del administrador, y pegar el enlace de «Compartir» es el único
  // camino que siempre funciona.
  const [manualVideoUrl, setManualVideoUrl] = useState('');
  const [manualVideoTitle, setManualVideoTitle] = useState('');
  const [manualVideoDuration, setManualVideoDuration] = useState('');
  const [addingManualVideo, setAddingManualVideo] = useState(false);

  // TTS Gamified Guides Management State
  const [ttsGuides, setTtsGuides] = useState<TTSGuide[]>([]);
  const [showTtsSheet, setShowTtsSheet] = useState(false);
  const [loadingTtsGuides, setLoadingTtsGuides] = useState(false);
  const [ttsTitle, setTtsTitle] = useState('');
  const [ttsScript, setTtsScript] = useState('');
  const [ttsVoice, setTtsVoice] = useState('es-ES-Carlos');
  const [ttsSpeed, setTtsSpeed] = useState(1.0);
  const [ttsTargetVideoId, setTtsTargetVideoId] = useState(course?.modules[0]?.videos[0]?.id || '');
  const [ttsSuccessMsg, setTtsSuccessMsg] = useState('');
  const [ttsErrorMsg, setTtsErrorMsg] = useState('');
  const [isPreviewingAudio, setIsPreviewingAudio] = useState(false);
  const [isGeneratingAiScript, setIsGeneratingAiScript] = useState(false);

  useEffect(() => {
    loadUsers();
    loadDriveVideos();
    loadEnrollments();
    loadCertificates();
    loadContracts();
    loadCatalog();
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get('tab') as SubTab;
    if (tabParam) {
      selectTab(tabParam);
    }
  }, []);

  const loadContracts = async (query?: string) => {
    setLoadingContracts(true);
    try {
      const res = await api.contracts.getAdminSignatures(query);
      setContractSignatures(res.signatures || []);
    } catch (err) {
      console.error('Error loading contract signatures:', err);
    } finally {
      setLoadingContracts(false);
    }
  };

  /**
   * El catálogo que alimenta al selector de curso de todas las pestañas.
   * Sin esta lista el panel matriculaba y publicaba siempre sobre el curso
   * abierto, sin decir en cuál, y no había forma de elegir otro.
   */
  const loadCatalog = async () => {
    try {
      const res = await api.getCourses();
      const list = res.courses || [];
      if (list.length === 0) return;
      setAllCourses(list);
      setNewEnrollCourseId((current) =>
        list.some((item) => item.id === current) ? current : list[0]?.id || '',
      );
      setWorkCourseId((current) =>
        list.some((item) => item.id === current) ? current : list[0]?.id || '',
      );
    } catch (err) {
      console.error('Error loading courses:', err);
    }
  };

  /** Tras crear o borrar algo hay que releer las dos fuentes: props y catálogo. */
  const refreshEverything = () => {
    onRefreshData();
    loadCatalog();
  };

  const handleOpenMentorCourses = async (mentor: User) => {
    setSelectedMentorForCourses(mentor);
    setLoadingMentorCourses(true);
    setMentorCoursesNotice(null);
    try {
      const res = await api.getAdminMentorCourses(mentor.id);
      setMentorAssignedCourseIds(res.courseIds || []);
    } catch (err: any) {
      setMentorCoursesNotice(err?.message || 'Error al cargar cursos del mentor');
    } finally {
      setLoadingMentorCourses(false);
    }
  };

  const handleToggleMentorCourse = (courseId: string) => {
    setMentorAssignedCourseIds((prev) =>
      prev.includes(courseId) ? prev.filter((id) => id !== courseId) : [...prev, courseId]
    );
  };

  const handleSaveMentorCourses = async () => {
    if (!selectedMentorForCourses) return;
    setSavingMentorCourses(true);
    setMentorCoursesNotice(null);
    try {
      const res = await api.setAdminMentorCourses(selectedMentorForCourses.id, mentorAssignedCourseIds);
      setMentorAssignedCourseIds(res.courseIds || []);
      setMentorCoursesNotice('Cursos asignados correctamente al mentor');
      setTimeout(() => {
        setSelectedMentorForCourses(null);
        setMentorCoursesNotice(null);
      }, 1000);
    } catch (err: any) {
      setMentorCoursesNotice(err?.message || 'Error al guardar los cursos del mentor');
    } finally {
      setSavingMentorCourses(false);
    }
  };

  // Al cambiar de curso, los desplegables que apuntaban a módulos y clases del
  // anterior quedan señalando identificadores que ya no existen: se reencuadran
  // sobre el curso elegido y se recargan sus guías.
  useEffect(() => {
    const modules = workCourse.modules || [];
    setResModuleId('');
    setSelectedModuleId(modules[0]?.id || '');
    setTtsTargetVideoId(modules.flatMap((m) => m.videos)[0]?.id || '');
    setResSuccessMsg('');
    setResErrorMsg('');
    setLinkSuccessMsg('');
    setDriveErrorMsg('');
    setTtsSuccessMsg('');
    setTtsErrorMsg('');
    loadTTSGuides(workCourse.id);
  }, [workCourse.id]);

  // Reparación, no reencuadre: al releer el catálogo tras cada alta, el módulo
  // que el administrador había elegido debe seguir elegido —obligarle a
  // volver a marcarlo por cada video que enlaza es una tortura—. Solo se toca
  // la selección cuando lo que apuntaba ya no existe.
  useEffect(() => {
    const modules = workCourse.modules || [];
    const lessons = modules.flatMap((m) => m.videos);

    if (!modules.some((m) => m.id === selectedModuleId)) {
      setSelectedModuleId(modules[0]?.id || '');
    }
    if (resModuleId && !modules.some((m) => m.id === resModuleId)) {
      setResModuleId('');
    }
    if (!lessons.some((v) => v.id === ttsTargetVideoId)) {
      setTtsTargetVideoId(lessons[0]?.id || '');
    }
  }, [workCourse.modules]);

  const loadEnrollments = async () => {
    setLoadingEnrollments(true);
    try {
      const res = await api.getAdminEnrollments();
      setEnrollments(res.enrollments || []);
    } catch (err) {
      console.error('Error loading enrollments:', err);
    } finally {
      setLoadingEnrollments(false);
    }
  };

  const loadCertificates = async () => {
    setLoadingCertificates(true);
    try {
      const res = await api.getAdminCertificates();
      setCertificates(res.certificates || []);
    } catch (err) {
      console.error('Error loading certificates:', err);
    } finally {
      setLoadingCertificates(false);
    }
  };

  const handleCreateEnrollment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEnrollUserId || !newEnrollCourseId) return;
    try {
      await api.createEnrollment({
        userId: newEnrollUserId,
        courseId: newEnrollCourseId,
        status: newEnrollStatus,
        source: newEnrollSource,
      });
      const enrolledUser = users.find((item) => item.id === newEnrollUserId);
      const enrolledCourse = allCourses.find((item) => item.id === newEnrollCourseId);
      setEnrollSuccessMsg(
        `${enrolledUser?.name || 'El usuario'} queda matriculado en «${enrolledCourse?.title || 'el curso'}».`,
      );
      setTimeout(() => setEnrollSuccessMsg(''), 3000);
      setShowQuickEnroll(false);
      loadEnrollments();
    } catch (err: any) {
      alert(err.message || 'Error al registrar matrícula');
    }
  };

  const handleUpdateEnrollmentStatus = async (enrollmentId: string, status: string) => {
    try {
      await api.updateEnrollmentStatus(enrollmentId, status);
      loadEnrollments();
    } catch (err: any) {
      alert(err.message || 'Error al actualizar matrícula');
    }
  };

  const handleRevokeCertificate = async (certId: string, reasonText: string): Promise<boolean> => {
    const reason = reasonText.trim() || 'Revocado por administración docente';
    try {
      await api.revokeCertificate(certId, reason);
      await loadCertificates();
      return true;
    } catch (err: any) {
      alert(err.message || 'Error al revocar certificado');
      return false;
    }
  };

  const handleAddResource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resTitle.trim() || !resPrivateUrl.trim()) return;
    setResErrorMsg('');
    try {
      await api.createCourseResource(workCourse.id, {
        moduleId: resModuleId || null,
        title: resTitle.trim(),
        privateUrl: resPrivateUrl.trim(),
        kind: resKind,
      });
      const target = workModules.find((m) => m.id === resModuleId);
      setResSuccessMsg(
        `«${resTitle.trim()}» añadido a ${target ? target.title : 'General del Curso'} en «${workCourse.title}».`,
      );
      setResTitle('');
      setResPrivateUrl('');
      setShowResourceSheet(false);
      setTimeout(() => setResSuccessMsg(''), 4000);
      refreshEverything();
    } catch (err: any) {
      setResErrorMsg(err.message || 'Error al agregar recurso');
    }
  };

  const handleDeleteResource = async (resourceId: string) => {
    setDeletingResource(true);
    setResErrorMsg('');
    try {
      await api.deleteCourseResource(resourceId);
      const deletedTitle = resourceToDelete?.title;
      setResourceToDelete(null);
      setResSuccessMsg(deletedTitle ? `«${deletedTitle}» eliminado.` : 'Recurso eliminado.');
      setTimeout(() => setResSuccessMsg(''), 4000);
      refreshEverything();
    } catch (err: any) {
      setResErrorMsg(err.message || 'Error al eliminar recurso');
    } finally {
      setDeletingResource(false);
    }
  };

  const handleGenerateAiScript = async () => {
    setIsGeneratingAiScript(true);
    try {
      // Find selected video title
      let targetVideoTitle = 'Lección de Mentoría Técnica';
      for (const mod of workModules) {
        const foundVid = mod.videos.find((v) => v.id === ttsTargetVideoId);
        if (foundVid) {
          targetVideoTitle = `${mod.title}: ${foundVid.title}`;
          break;
        }
      }

      const selectedVoiceConfig = SUPPORTED_TTS_VOICES.find((v) => v.id === ttsVoice);
      const targetLang = selectedVoiceConfig ? selectedVoiceConfig.lang : 'es';

      const res = await api.generateScriptWithAI({
        lessonTitle: targetVideoTitle,
        language: targetLang,
      });

      if (res.scriptText) {
        setTtsScript(res.scriptText);
        setTtsSuccessMsg('¡Guion generado por IA exitosamente!');
        setTimeout(() => setTtsSuccessMsg(''), 3000);
      }
    } catch (err) {
      console.error('Error generating AI script:', err);
    } finally {
      setIsGeneratingAiScript(false);
    }
  };

  const loadTTSGuides = async (courseId: string = workCourse.id) => {
    // Sin curso todavia no hay guias que pedir y el servidor rechazaria el id vacio.
    if (!courseId) {
      setTtsGuides([]);
      return;
    }
    setLoadingTtsGuides(true);
    try {
      const res = await api.getTTSGuides({ courseId });
      setTtsGuides(res.guides || []);
    } catch (error) {
      console.error('Error loading TTS guides:', error);
      setTtsGuides([]);
    } finally {
      setLoadingTtsGuides(false);
    }
  };

  const handlePreviewAudio = () => {
    if (!ttsScript.trim()) {
      alert('Por favor escribe un script para la guía antes de previsualizar el audio.');
      return;
    }

    if (!('speechSynthesis' in window)) {
      alert('Tu navegador no soporta síntesis de voz Web Speech API.');
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(ttsScript);

    const voices = window.speechSynthesis.getVoices();
    let selectedVoice = voices.find((v) => v.lang.startsWith('es'));
    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }

    utterance.rate = ttsSpeed;

    utterance.onstart = () => setIsPreviewingAudio(true);
    utterance.onend = () => setIsPreviewingAudio(false);
    utterance.onerror = () => setIsPreviewingAudio(false);

    window.speechSynthesis.speak(utterance);
  };

  const handleCreateTTSGuide = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ttsScript.trim()) return;

    // Una guía sin clase destino no se le puede reproducir a nadie: el
    // servidor la aceptaba y caía en un `videoId` por defecto de otro curso.
    if (!ttsTargetVideoId) {
      setTtsErrorMsg('Elige primero un curso con clases y la lección a la que acompaña la guía.');
      return;
    }
    setTtsErrorMsg('');

    try {
      const selectedModule = workModules.find((m) =>
        m.videos.some((v) => v.id === ttsTargetVideoId)
      );

      const res = await api.createTTSGuide({
        courseId: workCourse.id,
        moduleId: selectedModule?.id || workModules[0]?.id,
        videoId: ttsTargetVideoId,
        title: ttsTitle.trim() || 'Guía de Orientación de Mentoría',
        scriptText: ttsScript.trim(),
        voiceId: ttsVoice,
        voiceSpeed: ttsSpeed,
        xpReward: 50,
      });

      if (res.success) {
        setTtsSuccessMsg(`Guía guardada en «${workCourse.title}».`);
        setTtsScript('');
        setTtsTitle('');
        setShowTtsSheet(false);
        loadTTSGuides();
        setTimeout(() => setTtsSuccessMsg(''), 3500);
      }
    } catch (error: any) {
      setTtsErrorMsg(error?.message || 'No se pudo guardar la guía TTS.');
    }
  };

  const handleDeleteTTSGuide = async (id: string) => {
    try {
      await api.deleteTTSGuide(id);
      loadTTSGuides();
    } catch (error: any) {
      setTtsErrorMsg(error?.message || 'No se pudo eliminar la guía.');
    }
  };


  const loadUsers = async () => {
    setLoadingUsers(true);
    try {
      const res = await api.getAdminUsers();
      setUsers(res.users || []);
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setLoadingUsers(false);
    }
  };

  const loadDriveVideos = async (q?: string) => {
    const requestId = ++driveRequestId.current;
    setLoadingDrive(true);
    setDriveErrorMsg('');
    try {
      const res = await api.searchDriveVideos(q);
      if (requestId !== driveRequestId.current) return;
      setDriveVideos(res.videos || []);
      // Sin credenciales el servidor responde con un catálogo de demostración
      // cuyos identificadores no existen: enlazarlos deja el reproductor negro.
      setDriveIsDemo(Boolean(res.isDemo));
    } catch (error: any) {
      if (requestId === driveRequestId.current) setDriveErrorMsg(error?.message || 'No se pudo consultar Google Drive.');
    } finally {
      if (requestId === driveRequestId.current) setLoadingDrive(false);
    }
  };

  useEffect(() => {
    if (!driveSearchReady.current) {
      driveSearchReady.current = true;
      return;
    }
    const timeout = window.setTimeout(() => {
      setDrivePage(1);
      loadDriveVideos(searchQuery.trim() || undefined);
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [searchQuery]);

  const handleUpdateRole = async (userId: string, newRole: UserRole) => {
    setRoleErrorMsg('');
    try {
      await api.updateUserRole(userId, newRole);
      loadUsers();
      onRefreshData();
    } catch (error: any) {
      // Antes esto solo llegaba a la consola del navegador: el boton parecia no
      // hacer nada y no habia forma de saber que el servidor lo habia
      // rechazado.
      setRoleErrorMsg(error?.message || 'No se pudo cambiar el rol.');
    }
  };

  const handleUpdateModeration = async (userId: string, currentStrikes: number = 0, currentActive: boolean = true, action: 'add_strike' | 'toggle_active' | 'reset'): Promise<boolean> => {
    try {
      let newStrikes = currentStrikes;
      let newActive = currentActive;

      if (action === 'add_strike') newStrikes += 1;
      if (action === 'reset') newStrikes = 0;
      if (action === 'toggle_active') newActive = !currentActive;

      await api.updateUserModeration(userId, { strikes: newStrikes, isActive: newActive });
      await loadUsers();
      onRefreshData();
      return true;
    } catch (error) {
      console.error('Error updating moderation:', error);
      return false;
    }
  };

  const handleLinkDriveVideo = async (video: DriveVideoFile) => {
    if (!selectedModuleId) {
      setDriveErrorMsg('Elige antes el curso y el módulo de destino.');
      return;
    }
    setLinkingVideo(video);
    setDriveErrorMsg('');
    try {
      await api.addDriveVideoToModule(selectedModuleId, video);
      const target = workModules.find((m) => m.id === selectedModuleId);
      setLinkSuccessMsg(
        `«${video.name}» enlazado a ${target?.title || 'el módulo'} de «${workCourse.title}».`,
      );
      refreshEverything();
      setTimeout(() => setLinkSuccessMsg(''), 4000);
    } catch (error: any) {
      setDriveErrorMsg(error?.message || 'No se pudo enlazar el video.');
    } finally {
      setLinkingVideo(null);
    }
  };

  /**
   * Alta de una clase pegando el enlace del archivo.
   *
   * El buscador solo ve la carpeta de la cuenta de servicio configurada en el
   * servidor; si no hay credenciales, o el video vive en otra carpeta, este es
   * el camino. El servidor extrae el identificador del enlace de «Compartir».
   */
  const handleAddManualVideo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualVideoUrl.trim() || !manualVideoTitle.trim()) return;
    if (!selectedModuleId) {
      setDriveErrorMsg('Elige antes el curso y el módulo de destino.');
      return;
    }

    setAddingManualVideo(true);
    setDriveErrorMsg('');
    try {
      // Un enlace de Drive se guarda como archivo de Drive (el servidor extrae
      // el identificador); cualquier otra URL se guarda como reproducción
      // externa, que es como el propio servidor distingue los dos orígenes.
      const raw = manualVideoUrl.trim();
      const isDriveLink = /drive\.google\.com/i.test(raw) || /^[A-Za-z0-9_-]{10,}$/.test(raw);

      await api.addDriveVideoToModule(selectedModuleId, {
        id: isDriveLink ? raw : '',
        embedUrl: isDriveLink ? undefined : raw,
        name: manualVideoTitle.trim(),
        duration: manualVideoDuration.trim() || undefined,
      });
      const target = workModules.find((m) => m.id === selectedModuleId);
      setLinkSuccessMsg(
        `«${manualVideoTitle.trim()}» añadido a ${target?.title || 'el módulo'} de «${workCourse.title}».`,
      );
      setManualVideoUrl('');
      setManualVideoTitle('');
      setManualVideoDuration('');
      setShowDriveSheet(false);
      refreshEverything();
      setTimeout(() => setLinkSuccessMsg(''), 4000);
    } catch (error: any) {
      setDriveErrorMsg(error?.message || 'No se pudo añadir el video.');
    } finally {
      setAddingManualVideo(false);
    }
  };

  const workLessonCount = workModules.reduce((acc, m) => acc + m.videos.length, 0);

  /**
   * Todos los recursos del curso, generales y de módulo.
   *
   * El servidor los reparte en dos sitios: `course.resources` solo trae los que
   * no cuelgan de ningún módulo, y los demás viajan dentro de cada módulo. El
   * panel leía únicamente el primero, así que un recurso asignado a un módulo
   * desaparecía del listado en cuanto se guardaba.
   */
  const workResources = [
    ...(workCourse.resources || []).map((resource) => ({ resource, moduleTitle: '' })),
    ...workModules.flatMap((m) =>
      (m.resources || []).map((resource) => ({ resource, moduleTitle: m.title })),
    ),
  ];
  const catalogResourceCount = allCourses.reduce((total, item) =>
    total + (item.resources?.length || 0) + item.modules.reduce((moduleTotal, module) => moduleTotal + (module.resources?.length || 0), 0), 0);

  const resourceSearch = resourceQuery.trim().toLocaleLowerCase();
  const filteredResources = workResources.filter(({ resource, moduleTitle }) =>
    (!resourceSearch || [resource.title, moduleTitle, resource.kind].some((value) => value.toLocaleLowerCase().includes(resourceSearch))) &&
    (resourceKindFilter === 'ALL' || resource.kind === resourceKindFilter),
  );
  const resourceKindOptions = [
    { value: 'FILE', label: 'Archivo', count: workResources.filter(({ resource }) => resource.kind === 'FILE').length },
    { value: 'LINK', label: 'Enlace', count: workResources.filter(({ resource }) => resource.kind === 'LINK').length },
  ];
  const resourcePageSize = resourceView === 'list' ? 10 : 12;
  const resourcePageSafe = Math.min(resourcePage, Math.max(1, Math.ceil(filteredResources.length / resourcePageSize)));
  const resourceRows = filteredResources.slice((resourcePageSafe - 1) * resourcePageSize, resourcePageSafe * resourcePageSize);
  const visibleDriveVideos = driveVideos.filter((video) => {
    const linkedHere = Boolean(workModules.find((module) => module.id === selectedModuleId)?.videos.some((item) => item.driveFileId === video.id));
    return driveLinkFilter === 'ALL' || (driveLinkFilter === 'linked' ? linkedHere : !linkedHere);
  });
  const drivePageSize = driveView === 'list' ? 8 : 9;
  const drivePageSafe = Math.min(drivePage, Math.max(1, Math.ceil(visibleDriveVideos.length / drivePageSize)));
  const pagedDriveVideos = visibleDriveVideos.slice((drivePageSafe - 1) * drivePageSize, drivePageSafe * drivePageSize);

  /**
   * Sobre qué curso se está trabajando.
   *
   * Recursos, Videos Drive y Guías TTS escriben en un curso concreto; sin este
   * selector escribían siempre en el primero del catálogo y el administrador no
   * tenía manera de saberlo hasta abrir el curso equivocado.
   */
  const courseScopeBar = (
    <div className="bg-raised border border-line rounded-2xl p-4 flex flex-col xl:flex-row xl:items-center gap-3 justify-between">
      <div className="flex min-w-0 flex-col sm:flex-row sm:items-center gap-2 w-full xl:w-auto">
        <label className="text-[11px] font-bold text-ink-muted uppercase tracking-wider shrink-0">
          Curso sobre el que trabajas
        </label>
        <select
          value={workCourseId}
          onChange={(e) => setWorkCourseId(e.target.value)}
          className="w-full min-w-0 sm:w-64 xl:w-96 bg-surface border border-line text-white text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-[#06b6d4]"
        >
          {allCourses.map((item) => (
            <option key={item.id} value={item.id}>
              {item.title}{item.published ? '' : ' — borrador'}
            </option>
          ))}
        </select>
      </div>

      <span className="text-[11px] font-mono text-ink-muted shrink-0">
        {workModules.length} módulos · {workLessonCount} clases
      </span>
    </div>
  );

  const animClass = uiVersion === 'v0.4-classic' ? '' : 'animate-fade-in';
  const modernContextActions: Array<{ label: string; target: SubTab }> = activeTab === 'courses'
    ? [] // Cursos es una sola vista; Recursos ya es un módulo del nav
    : ['users', 'enrollments'].includes(activeTab)
      ? [] // Usuarios lleva su propio selector Directorio / Matrículas
      : ['resources', 'drive', 'tts'].includes(activeTab)
        ? [] // Recursos lleva su propio selector Materiales / Drive / Audio
        : ['certificates', 'contracts'].includes(activeTab)
          ? [] // Certificación lleva su propio selector Certificados / Contratos
          : ['landing', 'listening'].includes(activeTab)
            ? [] // Portal lleva su propio selector Portada / Escucha
            : activeTab === 'plugins'
              ? [{ label: 'Plugins y configuración', target: 'plugins' }]
              : [];

  return (
    <div data-ui-version={uiVersion} className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 ${animClass}`}>

      {/* NAVEGACIÓN Y CABECERA: MODO CLÁSICO v0.4 (Idéntico a captura del usuario) vs MODO MODERNO v0.5 */}
      {uiVersion === 'v0.4-classic' ? (
        <div className="bg-raised border border-line rounded-2xl p-6 shadow-xl text-white flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-black/40 border border-line flex items-center justify-center p-1.5 shrink-0 relative overflow-visible shadow-inner">
              <img
                src={customizerConfig.customLogoUrl || DEFAULT_LOGO_URL}
                alt="Logo"
                className="w-full h-full object-contain filter drop-shadow-[0_0_8px_rgba(6,182,212,0.4)]"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = DEFAULT_LOGO_URL;
                }}
              />
              <FestiveHatOverlay size="md" />
            </div>
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 text-brand-cyan text-xs font-bold uppercase tracking-wider">
                <Shield className="w-3.5 h-3.5" />
                <span>PANEL DE MENTORÍA & ADMINISTRACIÓN RBAC</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                {customizerConfig.customCampusName || `${customizerConfig.customBrandName || 'DocentOS'} Control Center`}
              </h1>
              <p className="text-ink-muted text-xs mt-1 max-w-md leading-relaxed">
                Gestión de permisos de usuarios, asignación de Pases VIP y enlazado de videos de Google Drive.
              </p>
            </div>
          </div>

          {/* Cápsula de 11 pestañas al lado derecho de la cabecera (Exactamente como en la captura del usuario) */}
          <div className="bg-[#0e0e17] border border-white/5 rounded-2xl px-5 py-3.5 flex flex-col gap-2.5 shadow-2xl shrink-0">
            {/* Fila 1 */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              {[
                { id: 'users' as SubTab, label: 'Usuarios', icon: Users, iconColor: 'text-white/70' },
                { id: 'courses' as SubTab, label: 'Cursos', icon: BookOpen, iconColor: 'text-cyan-400' },
                { id: 'enrollments' as SubTab, label: 'Matrículas', icon: GraduationCap, iconColor: 'text-emerald-400' },
                { id: 'certificates' as SubTab, label: 'Certificados', icon: Award, iconColor: 'text-amber-400' },
                { id: 'contracts' as SubTab, label: 'Contratos', icon: FileCheck, iconColor: 'text-blue-400' },
                { id: 'resources' as SubTab, label: 'Recursos', icon: BookOpen, iconColor: 'text-cyan-400' },
              ].map((t) => {
                const Icon = t.icon;
                const isSelected = activeTab === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => selectTab(t.id)}
                    className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-xl cursor-pointer ${
                      isSelected
                        ? 'bg-gradient-to-r from-cyan-500 via-fuchsia-500 to-orange-500 text-white font-bold'
                        : 'text-white/80 hover:text-white font-medium hover:bg-white/5'
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-white' : t.iconColor}`} />
                    <span>{t.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Fila 2 */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              {[
                { id: 'drive' as SubTab, label: 'Videos Drive', icon: HardDrive, iconColor: 'text-white/70' },
                { id: 'tts' as SubTab, label: 'Guías TTS', icon: Sparkles, iconColor: 'text-amber-300' },
                { id: 'plugins' as SubTab, label: 'Plugins', icon: Layers, iconColor: 'text-cyan-400' },
                { id: 'landing' as SubTab, label: 'Portada', icon: Sliders, iconColor: 'text-cyan-400' },
                { id: 'listening' as SubTab, label: 'Escucha', icon: HeartHandshake, iconColor: 'text-cyan-400' },
              ].map((t) => {
                const Icon = t.icon;
                const isSelected = activeTab === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => selectTab(t.id)}
                    className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-xl cursor-pointer ${
                      isSelected
                        ? 'bg-gradient-to-r from-cyan-500 via-fuchsia-500 to-orange-500 text-white font-bold'
                        : 'text-white/80 hover:text-white font-medium hover:bg-white/5'
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-white' : t.iconColor}`} />
                    <span>{t.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Admin Header v0.5 Moderna */}
          <div className="bg-canvas border border-line rounded-2xl p-4 sm:p-6 shadow-xl text-white flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-raised border border-line flex items-center justify-center p-2 shrink-0 relative overflow-visible shadow-inner">
                <img
                  src={customizerConfig.customLogoUrl || DEFAULT_LOGO_URL}
                  alt={customizerConfig.customBrandName || customizerConfig.customCampusName || 'Logo'}
                  className="w-full h-full object-contain filter drop-shadow-[0_0_8px_rgba(6,182,212,0.4)]"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src = DEFAULT_LOGO_URL;
                  }}
                />
                <FestiveHatOverlay size="md" />
              </div>
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-cyan/10 border border-brand-cyan/30 text-brand-cyan text-xs font-bold mb-2">
                  <Shield className="w-3.5 h-3.5" />
                  <span>{t('admin.badge', 'Panel de Control & Administración Global RBAC')}</span>
                </div>
                <h2 className="text-2xl font-extrabold text-ink tracking-tight">
                  {customizerConfig.customCampusName || `${customizerConfig.customBrandName || 'DocentOS'} Command Center`}
                </h2>
                <p className="text-ink-muted text-xs mt-1 max-w-2xl leading-relaxed">
                  {t('admin.desc', 'Gestión integral de contenidos y cursos, asignación de permisos RBAC, emisión de certificados verificables y configuración de extensiones modulares.')}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-stretch md:self-auto shrink-0 flex-wrap">
              <button
                onClick={refreshEverything}
                className="px-3.5 py-2.5 bg-raised hover:bg-elevated border border-line text-ink-soft text-xs font-bold rounded-xl transition-all flex items-center gap-2 shadow-sm"
                title={t('admin.syncTitle', 'Recargar todos los datos')}
              >
                <RefreshCw className="w-3.5 h-3.5 text-brand-cyan" />
                <span>{t('admin.syncBtn', 'Sincronizar Panel')}</span>
              </button>
            </div>
          </div>

          {/* Navegación única de DocentOS 0.5 Moderna */}
          <nav
            aria-label="Módulos de administración"
            className="admin-module-nav mentor-module-nav grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6"
          >
            {MODERN_ADMIN_MODULES.map((module) => {
              const iconByModule: Record<ModernAdminModuleId, React.ElementType> = {
                overview: LayoutDashboard,
                courses: BookOpen,
                people: Users,
                certification: Award,
                portal: Sliders,
                system: Shield,
              };
              const Icon = iconByModule[module.id];
              const selectedTarget = module.target === 'overview'
                ? activeTab === 'overview'
                : module.target === activeTab || (
                  module.id === 'courses' && ['resources', 'drive', 'tts'].includes(activeTab)
                ) || (
                  module.id === 'people' && ['users', 'enrollments'].includes(activeTab)
                ) || (
                  module.id === 'certification' && ['certificates', 'contracts'].includes(activeTab)
                ) || (
                  module.id === 'portal' && ['landing', 'listening'].includes(activeTab)
                );
              return (
                <button
                  key={module.id}
                  type="button"
                  aria-current={selectedTarget ? 'page' : undefined}
                  onClick={() => selectTab(module.target as SubTab)}
                  className="flex items-center gap-2.5 text-left"
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="min-w-0">
                    <span className="block truncate">{module.label}</span>
                  </span>
                </button>
              );
            })}
          </nav>

          {modernContextActions.length > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-1" aria-label="Acciones del módulo actual">
              <span className="text-xs font-medium text-ink-muted shrink-0">En este módulo</span>
              <div className="flex flex-wrap gap-1.5">
                {modernContextActions.map((action) => (
                  <button
                    key={action.target}
                    type="button"
                    aria-current={activeTab === action.target ? 'page' : undefined}
                    onClick={() => selectTab(action.target)}
                    className={`min-h-9 px-3 rounded-lg border text-xs font-medium transition-colors ${
                      activeTab === action.target
                        ? 'bg-brand-cyan/10 border-brand-cyan/40 text-brand-cyan'
                        : 'bg-transparent border-line text-ink-muted hover:border-line-strong hover:text-ink'
                    }`}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {false && (
          <>
          {/* Nivel 1: Las 4 Secciones Maestras */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <button
          type="button"
          onClick={() => {
            setMasterSection('courses');
            if (!['courses', 'resources', 'tts', 'drive'].includes(activeTab)) {
              setActiveTab('courses');
            }
          }}
          className={`p-4 rounded-2xl border text-left transition-all flex flex-col justify-between gap-3 ${
            masterSection === 'courses'
              ? 'bg-elevated border-brand-cyan shadow-lg shadow-brand-cyan/10 ring-1 ring-brand-cyan/40'
              : 'bg-raised/70 border-line hover:border-line-strong hover:bg-elevated/60'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`p-2.5 rounded-xl border ${
              masterSection === 'courses'
                ? 'bg-brand-cyan/20 border-brand-cyan/40 text-brand-cyan'
                : 'bg-canvas border-line text-ink-muted'
            }`}>
              <BookOpen className="w-4 h-4" />
            </span>
            <span className="text-[10px] font-mono font-bold text-ink-muted bg-canvas px-2 py-0.5 rounded-md border border-line">
              {allCourses.length} cursos
            </span>
          </div>
          <div>
            <div className="text-sm font-bold text-ink">{t('admin.coursesTitle', 'Cursos & Contenidos')}</div>
            <div className="text-[11px] text-ink-muted mt-0.5">{t('admin.coursesSubtitle', 'Temarios, recursos y videos')}</div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            setMasterSection('users');
            setActiveTab('users');
          }}
          className={`p-4 rounded-2xl border text-left transition-all flex flex-col justify-between gap-3 ${
            masterSection === 'users'
              ? 'bg-elevated border-brand-cyan shadow-lg shadow-brand-cyan/10 ring-1 ring-brand-cyan/40'
              : 'bg-raised/70 border-line hover:border-line-strong hover:bg-elevated/60'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`p-2.5 rounded-xl border ${
              masterSection === 'users'
                ? 'bg-brand-blue/20 border-brand-blue/40 text-brand-blue'
                : 'bg-canvas border-line text-ink-muted'
            }`}>
              <Users className="w-4 h-4" />
            </span>
            <span className="text-[10px] font-mono font-bold text-ink-muted bg-canvas px-2 py-0.5 rounded-md border border-line">
              {users.length} usuarios • {enrollments.length} matrículas
            </span>
          </div>
          <div>
            <div className="text-sm font-bold text-ink">{t('admin.usersTitle', 'Usuarios & Matrículas')}</div>
            <div className="text-[11px] text-ink-muted mt-0.5">{t('admin.usersSubtitle', 'Directorio RBAC, pases y admisiones')}</div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            setMasterSection('legal');
            if (!['certificates', 'contracts'].includes(activeTab)) {
              setActiveTab('certificates');
            }
          }}
          className={`p-4 rounded-2xl border text-left transition-all flex flex-col justify-between gap-3 ${
            masterSection === 'legal'
              ? 'bg-elevated border-brand-cyan shadow-lg shadow-brand-cyan/10 ring-1 ring-brand-cyan/40'
              : 'bg-raised/70 border-line hover:border-line-strong hover:bg-elevated/60'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`p-2.5 rounded-xl border ${
              masterSection === 'legal'
                ? 'bg-amber-500/20 border-amber-500/40 text-amber-400'
                : 'bg-canvas border-line text-ink-muted'
            }`}>
              <Award className="w-4 h-4" />
            </span>
            <span className="text-[10px] font-mono font-bold text-ink-muted bg-canvas px-2 py-0.5 rounded-md border border-line">
              {certificates.length} diplomas
            </span>
          </div>
          <div>
            <div className="text-sm font-bold text-ink">{t('admin.legalTitle', 'Certificación & Legal')}</div>
            <div className="text-[11px] text-ink-muted mt-0.5">{t('admin.legalSubtitle', 'Diplomas y auditoría forense')}</div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            setMasterSection('system');
            if (!['plugins', 'landing', 'listening'].includes(activeTab)) {
              setActiveTab('plugins');
            }
          }}
          className={`p-4 rounded-2xl border text-left transition-all flex flex-col justify-between gap-3 ${
            masterSection === 'system'
              ? 'bg-elevated border-brand-cyan shadow-lg shadow-brand-cyan/10 ring-1 ring-brand-cyan/40'
              : 'bg-raised/70 border-line hover:border-line-strong hover:bg-elevated/60'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`p-2.5 rounded-xl border ${
              masterSection === 'system'
                ? 'bg-brand-purple/20 border-brand-purple/40 text-brand-purple'
                : 'bg-canvas border-line text-ink-muted'
            }`}>
              <Sliders className="w-4 h-4" />
            </span>
            <span className="text-[10px] font-mono font-bold text-ink-muted bg-canvas px-2 py-0.5 rounded-md border border-line">
              Configuración
            </span>
          </div>
          <div>
            <div className="text-sm font-bold text-ink">{t('admin.systemTitle', 'Configuración & Portal')}</div>
            <div className="text-[11px] text-ink-muted mt-0.5">{t('admin.systemSubtitle', 'Plugins, portada y escucha')}</div>
          </div>
        </button>
      </div>

      {/* Nivel 2: Barra de sub-navegación contextual */}
      <div className="bg-raised border border-line rounded-xl p-2.5 flex flex-wrap items-center justify-between gap-2 shadow-sm">
        <div className="flex flex-wrap items-center gap-1.5">
          {masterSection === 'courses' && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('courses')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                  activeTab === 'courses'
                    ? 'btn-brand-primary shadow-sm'
                    : 'bg-canvas hover:bg-elevated text-ink-muted hover:text-ink border border-line'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>{t('admin.tabCourses', 'Catálogo y Temarios')} ({allCourses.length})</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab(mediaView || 'resources');
                }}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                  ['resources', 'drive', 'tts'].includes(activeTab)
                    ? 'btn-brand-primary shadow-sm'
                    : 'bg-canvas hover:bg-elevated text-ink-muted hover:text-ink border border-line'
                }`}
              >
                <Layers className="w-3.5 h-3.5 text-cyan-400" />
                <span>{t('admin.tabResources', 'Estudio de Medios y Recursos')}</span>
              </button>
            </div>
          )}

          {masterSection === 'users' && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('users');
                  setUserSectionView('directory');
                }}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                  userSectionView === 'directory'
                    ? 'btn-brand-primary shadow-sm'
                    : 'bg-canvas hover:bg-elevated text-ink-muted hover:text-ink border border-line'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>{t('admin.tabUsers', 'Directorio & Roles RBAC')} ({users.length})</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('users');
                  setUserSectionView('enrollments');
                }}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                  userSectionView === 'enrollments'
                    ? 'btn-brand-primary shadow-sm'
                    : 'bg-canvas hover:bg-elevated text-ink-muted hover:text-ink border border-line'
                }`}
              >
                <GraduationCap className="w-3.5 h-3.5 text-emerald-400" />
                <span>{t('admin.tabEnrollments', 'Registro de Matrículas')} ({enrollments.length})</span>
              </button>
            </div>
          )}

          {masterSection === 'legal' && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('certificates');
                  setLegalView('certificates');
                }}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                  activeTab === 'certificates'
                    ? 'btn-brand-primary shadow-sm'
                    : 'bg-canvas hover:bg-elevated text-ink-muted hover:text-ink border border-line'
                }`}
              >
                <Award className="w-3.5 h-3.5 text-amber-400" />
                <span>{t('admin.tabCertificates', 'Certificados Oficiales')} ({certificates.length})</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('contracts');
                  setLegalView('contracts');
                }}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                  activeTab === 'contracts'
                    ? 'btn-brand-primary shadow-sm'
                    : 'bg-canvas hover:bg-elevated text-ink-muted hover:text-ink border border-line'
                }`}
              >
                <FileCheck className="w-3.5 h-3.5 text-brand-blue" />
                <span>{t('admin.tabContracts', 'Auditoría Forense de Contratos')} ({contractSignatures.length})</span>
              </button>
            </div>
          )}

          {masterSection === 'system' && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('plugins')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                  activeTab === 'plugins'
                    ? 'btn-brand-primary shadow-sm'
                    : 'bg-canvas hover:bg-elevated text-ink-muted hover:text-ink border border-line'
                }`}
              >
                <Layers className="w-3.5 h-3.5 text-brand-cyan" />
                <span>{t('admin.tabPlugins', 'Plugins y Extensiones')}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab(portalView || 'landing');
                }}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                  ['landing', 'listening'].includes(activeTab)
                    ? 'btn-brand-primary shadow-sm'
                    : 'bg-canvas hover:bg-elevated text-ink-muted hover:text-ink border border-line'
                }`}
              >
                <Sliders className="w-3.5 h-3.5 text-brand-purple" />
                <span>{t('admin.tabLanding', 'Portal Web y Feedback Alumnos')}</span>
              </button>
            </div>
          )}
        </div>
      </div>
      </>
      )}
      </>
      )}


      {uiVersion === 'v0.5-modern' && activeTab === 'overview' && (
        <section className={`space-y-6 ${animClass}`} aria-labelledby="admin-overview-title">
          <div className="flex flex-col gap-2">
            <h1 id="admin-overview-title" className="text-2xl sm:text-3xl font-semibold text-ink tracking-tight">
              Estado general
            </h1>
            <p className="max-w-2xl text-sm text-ink-muted">
              Un punto de entrada para revisar el sistema y continuar con la tarea que necesita atención.
            </p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: 'Cursos', value: allCourses.length, target: 'courses' as SubTab },
              { label: 'Usuarios', value: users.length, target: 'users' as SubTab },
              { label: 'Matrículas', value: enrollments.length, target: 'enrollments' as SubTab },
              { label: 'Certificados', value: certificates.length, target: 'certificates' as SubTab },
            ].map((stat) => (
              <button
                key={stat.label}
                type="button"
                onClick={() => selectTab(stat.target)}
                className="min-w-0 p-4 text-left bg-raised border border-line rounded-xl hover:border-line-strong hover:bg-elevated transition-colors"
              >
                <span className="block text-xs text-ink-muted">{stat.label}</span>
                <span className="block mt-2 text-2xl font-semibold text-ink tabular-nums">{stat.value}</span>
                <span className="block mt-1 text-[11px] text-brand-cyan">Abrir módulo</span>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)] gap-4">
            <div className="bg-raised border border-line rounded-xl p-5">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-base font-semibold text-ink">Entradas principales</h2>
                  <p className="mt-1 text-xs text-ink-muted">Accede directamente a las áreas de trabajo.</p>
                </div>
                <LayoutDashboard className="w-5 h-5 text-brand-cyan" aria-hidden />
              </div>
              <div className="divide-y divide-line border-y border-line">
                {MODERN_ADMIN_MODULES.filter((module) => module.id !== 'overview').map((module) => (
                  <button
                    key={module.id}
                    type="button"
                    onClick={() => selectTab(module.target as SubTab)}
                    className="w-full py-3.5 text-left flex items-center justify-between gap-4 hover:text-ink transition-colors"
                  >
                    <span>
                      <span className="block text-sm font-medium text-ink">{module.label}</span>
                      <span className="block mt-0.5 text-xs text-ink-muted">{module.description}</span>
                    </span>
                    <ExternalLink className="w-4 h-4 shrink-0 text-ink-faint" aria-hidden />
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-raised border border-line rounded-xl p-5">
              <h2 className="text-base font-semibold text-ink">Siguiente paso</h2>
              <p className="mt-1 text-xs text-ink-muted">
                Selecciona un módulo para trabajar con su contexto y herramientas específicas.
              </p>
              <button
                type="button"
                onClick={() => selectTab('courses')}
                className="mt-5 w-full min-h-11 px-4 rounded-lg btn-brand-primary text-sm font-semibold"
              >
                Abrir cursos
              </button>
            </div>
          </div>
        </section>
      )}

      {activeTab === 'courses' && (
        <CourseManagerView
          currentUser={currentUser}
          onRefreshData={onRefreshData}
          disableAnimation={uiVersion === 'v0.4-classic'}
          onOpenResources={(courseId) => { if (courseId) setWorkCourseId(courseId); selectTab('resources'); }}
        />
      )}

      {/* PERSONAS: directorio y matrículas */}
      {(activeTab === 'users' || activeTab === 'enrollments') && (
        <div className={`space-y-6 ${animClass}`}>
          {enrollSuccessMsg && (
            <div role="status" className="p-3 bg-elevated border border-line rounded-xl text-ink text-xs font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-brand-cyan" /> {enrollSuccessMsg}
            </div>
          )}

          <AdminPeopleView
            users={users}
            enrollments={enrollments}
            loading={loadingUsers}
            roleError={roleErrorMsg}
            section={userSectionView}
            onSection={(s) => selectTab(s === 'directory' ? 'users' : 'enrollments')}
            onEnrollmentStatus={handleUpdateEnrollmentStatus}
            onNewEnrollment={() => { setEnrollFromSheet(false); setShowQuickEnroll(true); }}
            onEnrollUser={(id) => { setNewEnrollUserId(id); setEnrollFromSheet(true); setShowQuickEnroll(true); }}
            onUpdateRole={handleUpdateRole}
            onModerate={(u, action) => handleUpdateModeration(u.id, u.strikes || 0, u.isActive !== false, action)}
            onMentorCourses={handleOpenMentorCourses}
          />

          <AdminEnrollSheet
            open={showQuickEnroll}
            canGoBack={enrollFromSheet}
            onClose={() => setShowQuickEnroll(false)}
            users={users}
            courses={allCourses}
            userId={newEnrollUserId}
            courseId={newEnrollCourseId}
            status={newEnrollStatus}
            source={newEnrollSource}
            onUserId={setNewEnrollUserId}
            onCourseId={setNewEnrollCourseId}
            onStatus={setNewEnrollStatus}
            onSource={setNewEnrollSource}
            onSubmit={handleCreateEnrollment}
          />
        </div>
      )}

      {/* TAB: ESTUDIO DE MEDIOS Y RECURSOS DEL CURSO (RECURSOS + DRIVE + TTS) */}
      {['resources', 'drive', 'tts'].includes(activeTab) && (
        <div className={`space-y-6 ${animClass}`}>
          {uiVersion === 'v0.5-modern' ? (
            <div data-mentor-ui="modern" className="admin-courses-root admin-resources-shell">
              <div className="mentor-mentees-panel admin-people-panel">
                <div className="mentor-section-heading">
                  <div>
                    <h2>Cursos</h2>
                    <p>Gestiona el catálogo y los materiales de aprendizaje.</p>
                  </div>
                  {activeTab === 'resources' && <button type="button" className="mentor-course-control admin-resources__header-add" onClick={() => { setResErrorMsg(''); setShowResourceSheet(true); }}><Plus size={18} aria-hidden="true" />Agregar recurso</button>}
                  {activeTab === 'drive' && <button type="button" className="mentor-course-control admin-resources__header-add" onClick={() => { setDriveErrorMsg(''); setShowDriveSheet(true); }} disabled={workModules.length === 0}><Plus size={18} aria-hidden="true" />Añadir video</button>}
                </div>
                <div className="admin-people-top">
                  <div className="mentor-publication-filters" role="group" aria-label="Sección de cursos">
                    <button type="button" aria-pressed="false" onClick={() => selectTab('courses')}><span>Catálogo</span><span className="mentor-publication-count">({allCourses.length})</span></button>
                    <button type="button" aria-pressed="true"><span>Recursos</span><span className="mentor-publication-count">({catalogResourceCount})</span></button>
                  </div>
                  {activeTab === 'tts' && <button type="button" className="mentor-course-control admin-resources__header-add" onClick={() => { setTtsErrorMsg(''); setShowTtsSheet(true); }} disabled={workLessonCount === 0}><Plus size={18} aria-hidden="true" />Nueva guía</button>}
                </div>
                <div className="admin-resources-shell__media" role="group" aria-label="Tipo de recurso">
                  <button type="button" aria-pressed={activeTab === 'resources'} onClick={() => { setActiveTab('resources'); setMediaView('resources'); }}>Materiales</button>
                  <button type="button" aria-pressed={activeTab === 'drive'} onClick={() => { setActiveTab('drive'); setMediaView('drive'); }}>Videos Drive</button>
                  <button type="button" aria-pressed={activeTab === 'tts'} onClick={() => { setActiveTab('tts'); setMediaView('tts'); }}>Audio TTS</button>
                </div>
                <div className="admin-resources-shell__scope">
                  <AdminCoursePicker courses={allCourses} value={workCourseId} onChange={(courseId) => { setWorkCourseId(courseId); setResourceQuery(''); setResourceKindFilter('ALL'); setResourcePage(1); setResSuccessMsg(''); setResErrorMsg(''); }} />
                </div>
              </div>
            </div>
          ) : courseScopeBar}

          {/* Materiales del curso */}
          {(uiVersion === 'v0.4-classic' ? activeTab === 'resources' : (mediaView === 'resources' || activeTab === 'resources')) && (
            <section data-mentor-ui="modern" className="admin-resources" aria-label="Materiales del curso">
              <div className="mentor-course-toolbar admin-resources__toolbar">
                <AdminSearchField value={resourceQuery} onChange={(value) => { setResourceQuery(value); setResourcePage(1); }} placeholder="Buscar recurso" label="Buscar recurso" />
                <FilterMenu groups={[{ value: resourceKindFilter, onChange: (value) => { setResourceKindFilter(value); setResourcePage(1); }, options: resourceKindOptions }]} />
                {!resourceIsMobile && <div className="mentor-publication-filters admin-view-toggle" role="group" aria-label="Vista de recursos">
                  <button type="button" aria-pressed={resourceView === 'list'} aria-label="Vista de lista" onClick={() => { changeResourceView('list'); setResourcePage(1); }}><List aria-hidden="true" /><span>Lista</span></button>
                  <button type="button" aria-pressed={resourceView === 'cards'} aria-label="Vista de tarjetas" onClick={() => { changeResourceView('cards'); setResourcePage(1); }}><LayoutGrid aria-hidden="true" /><span>Tarjetas</span></button>
                </div>}
              </div>
              {uiVersion === 'v0.4-classic' && <div className="admin-resources__classic-add"><button type="button" className="mentor-course-control admin-resources__add" onClick={() => { setResErrorMsg(''); setShowResourceSheet(true); }}><Plus size={18} aria-hidden="true" />Agregar recurso</button></div>}
              <ActiveFilters noun="recursos" shown={filteredResources.length} total={workResources.length} onClear={() => { setResourceQuery(''); setResourceKindFilter('ALL'); setResourcePage(1); }} chips={[
                ...(resourceKindFilter !== 'ALL' ? [{ key: 'kind', text: resourceKindFilter === 'FILE' ? 'Archivo' : 'Enlace', onRemove: () => { setResourceKindFilter('ALL'); setResourcePage(1); } }] : []),
                ...(resourceQuery.trim() ? [{ key: 'query', text: `«${resourceQuery.trim()}»`, onRemove: () => { setResourceQuery(''); setResourcePage(1); } }] : []),
              ]} />
              {resSuccessMsg && <div role="status" className="admin-resources__notice admin-resources__notice--success"><CheckCircle2 size={18} aria-hidden="true" />{resSuccessMsg}</div>}
              {resErrorMsg && !showResourceSheet && !resourceToDelete && <div role="alert" className="admin-resources__notice admin-resources__notice--error"><AlertTriangle size={18} aria-hidden="true" />{resErrorMsg}</div>}
              {filteredResources.length ? (
                <div className="admin-resources__table" data-view={resourceView}>
                  {resourceView === 'list' && <div className="admin-resources__table-head" aria-hidden="true"><span>Recurso</span><span>Ubicación</span><span>Acciones</span></div>}
                  <ul className="admin-resources__list" data-view={resourceView}>
                    {resourceRows.map(({ resource, moduleTitle }) => (
                      <li key={resource.id} className="admin-resources__item" data-view={resourceView} aria-labelledby={`admin-resource-${resource.id}`}>
                        <div className="admin-resources__item-main">
                          <span className="admin-resources__file" aria-hidden="true">{resource.kind === 'LINK' ? <Link2 /> : <FileText />}</span>
                          <div className="admin-resources__item-copy">
                            <span className="admin-resources__item-kind">{resource.kind === 'LINK' ? 'Enlace' : 'Archivo'}</span>
                            <h3 id={`admin-resource-${resource.id}`}>{resource.title}</h3>
                            {resource.description && <p>{resource.description}</p>}
                          </div>
                        </div>
                        <span className="admin-resources__item-module"><Layers aria-hidden="true" />{moduleTitle || 'General del curso'}</span>
                        <div className="admin-resources__item-actions">
                          <a className="admin-resources__open" href={resource.downloadUrl} target="_blank" rel="noopener noreferrer" aria-label={`Abrir ${resource.title} en otra pestaña`}>Abrir<ExternalLink aria-hidden="true" /></a>
                          <button type="button" className="mentor-course-control admin-resources__delete" data-danger="true" onClick={() => { setResErrorMsg(''); setResourceToDelete(resource); }} aria-haspopup="dialog" aria-label={`Eliminar ${resource.title}`}><Trash2 aria-hidden="true" />Eliminar</button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="admin-resources__empty"><FileText size={28} aria-hidden="true" /><p>{workResources.length ? 'Nada coincide con la búsqueda o los filtros' : 'Este curso todavía no tiene recursos'}</p><span>{workResources.length ? 'Prueba otra búsqueda o limpia los filtros.' : 'Agrega el primer material para compartirlo con tus estudiantes.'}</span>{workResources.length === 0 && <button type="button" className="mentor-course-control admin-resources__add" onClick={() => setShowResourceSheet(true)}>Agregar recurso</button>}</div>
              )}
              <Pager total={filteredResources.length} size={resourcePageSize} page={resourcePageSafe} onPage={setResourcePage} noun="recursos" />
              <dialog ref={resourceConfirmRef} className="mentor-confirm admin-resource-confirm" aria-labelledby="admin-resource-delete-title" aria-describedby="admin-resource-delete-description" onCancel={(event) => { event.preventDefault(); if (!deletingResource) setResourceToDelete(null); }} onClick={(event) => { if (event.target === event.currentTarget && !deletingResource) setResourceToDelete(null); }}>
                {resourceToDelete && <div className="mentor-confirm__body">
                  <h3 id="admin-resource-delete-title" className="admin-confirm-title"><AlertTriangle aria-hidden="true" />Eliminar recurso</h3>
                  <p id="admin-resource-delete-description">Vas a eliminar <strong>{resourceToDelete.title}</strong>. Los estudiantes de este curso perderán el acceso. No se puede deshacer.</p>
                  {resErrorMsg && <p role="alert" className="admin-confirm-error"><strong>{resErrorMsg}</strong> Inténtalo de nuevo.</p>}
                  <div className="mentor-confirm__actions">
                    <button type="button" className="mentor-course-control" onClick={() => setResourceToDelete(null)} disabled={deletingResource}>Cancelar</button>
                    <button type="button" className="mentor-course-control" data-danger="true" onClick={() => handleDeleteResource(resourceToDelete.id)} disabled={deletingResource} aria-busy={deletingResource}>{deletingResource ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Trash2 aria-hidden="true" />}Eliminar recurso</button>
                  </div>
                </div>}
              </dialog>
              <AdminResourceSheet open={showResourceSheet} onClose={() => setShowResourceSheet(false)} onSubmit={handleAddResource} modules={workModules} title={resTitle} onTitle={setResTitle} privateUrl={resPrivateUrl} onPrivateUrl={setResPrivateUrl} moduleId={resModuleId} onModuleId={setResModuleId} error={resErrorMsg} />
            </section>
          )}

          {/* VIDEOS DE DRIVE */}
          {(uiVersion === 'v0.4-classic' ? activeTab === 'drive' : (mediaView === 'drive' || activeTab === 'drive')) && (
            <section data-mentor-ui="modern" className="admin-drive" aria-labelledby="admin-drive-title">
              <div className="admin-drive__head">
                <div>
                  <h3 id="admin-drive-title">Biblioteca de Drive</h3>
                  <p>Elige un módulo y enlaza los videos que formarán parte del temario.</p>
                </div>
                <label className="admin-drive__destination" htmlFor="admin-drive-module">
                  <span>Módulo de destino</span>
                  <select id="admin-drive-module" value={selectedModuleId} onChange={(event) => { setSelectedModuleId(event.target.value); setDriveLinkFilter('ALL'); setDrivePage(1); }} disabled={workModules.length === 0}>
                    {workModules.length === 0 && <option value="">Sin módulos</option>}
                    {workModules.map((module) => <option key={module.id} value={module.id}>{module.title}</option>)}
                  </select>
                </label>
              </div>

              {workModules.length === 0 && <div className="admin-drive__empty" role="status"><Layers aria-hidden="true" /><strong>Este curso aún no tiene módulos</strong><span>Crea uno en el catálogo para poder asignarle videos.</span><button type="button" onClick={() => selectTab('courses')}>Ir al catálogo</button></div>}
              {linkSuccessMsg && <p role="status" className="admin-resources__notice admin-resources__notice--success"><CheckCircle2 aria-hidden="true" />{linkSuccessMsg}</p>}
              {driveErrorMsg && !showDriveSheet && <p role="alert" className="admin-resources__notice admin-resources__notice--error"><AlertTriangle aria-hidden="true" />{driveErrorMsg}</p>}
              {driveIsDemo && <p className="admin-drive__demo"><AlertTriangle aria-hidden="true" /><span>Drive no está conectado. Esta lista es una demostración; puedes añadir un video real mediante su enlace.</span></p>}

              <div className="mentor-course-toolbar admin-resources__toolbar admin-drive__toolbar">
                <AdminSearchField value={searchQuery} onChange={setSearchQuery} placeholder="Buscar video en Drive" label="Buscar video en Drive" />
                <FilterMenu groups={[{ value: driveLinkFilter, onChange: (value) => { setDriveLinkFilter(value); setDrivePage(1); }, options: [
                  { value: 'unlinked', label: 'Sin enlazar', count: driveVideos.filter((video) => !workModules.find((module) => module.id === selectedModuleId)?.videos.some((item) => item.driveFileId === video.id)).length },
                  { value: 'linked', label: 'En este módulo', count: driveVideos.filter((video) => workModules.find((module) => module.id === selectedModuleId)?.videos.some((item) => item.driveFileId === video.id)).length },
                ] }]} />
                {!driveIsMobile && <div className="mentor-publication-filters admin-view-toggle" role="group" aria-label="Vista de videos"><button type="button" aria-pressed={driveView === 'list'} aria-label="Vista de lista" onClick={() => { changeDriveView('list'); setDrivePage(1); }}><List aria-hidden="true" /><span>Lista</span></button><button type="button" aria-pressed={driveView === 'cards'} aria-label="Vista de tarjetas" onClick={() => { changeDriveView('cards'); setDrivePage(1); }}><LayoutGrid aria-hidden="true" /><span>Tarjetas</span></button></div>}
              </div>

              <ActiveFilters noun="videos" shown={visibleDriveVideos.length} total={driveVideos.length} onClear={() => { setDriveLinkFilter('ALL'); setDrivePage(1); }} chips={driveLinkFilter === 'ALL' ? [] : [{ key: 'linked', text: driveLinkFilter === 'linked' ? 'En este módulo' : 'Sin enlazar', onRemove: () => { setDriveLinkFilter('ALL'); setDrivePage(1); } }]} />
              {!loadingDrive && driveVideos.length > 0 && <p className="admin-drive__count">{visibleDriveVideos.length} {visibleDriveVideos.length === 1 ? 'video' : 'videos'} en la carpeta</p>}

              {loadingDrive ? <div className="admin-drive__grid" data-view="cards" role="status" aria-label="Cargando videos">{[0, 1, 2].map((index) => <div key={index} className="admin-drive__skeleton" />)}</div> : visibleDriveVideos.length === 0 ? (
                <div className="admin-drive__empty" role="status"><HardDrive aria-hidden="true" /><strong>{driveVideos.length ? 'No hay videos con ese filtro' : 'No encontramos videos en la carpeta'}</strong><span>{driveVideos.length ? 'Prueba otra opción de filtro.' : 'Busca por otro nombre o añade el video con su enlace.'}</span><button type="button" onClick={() => { setDriveErrorMsg(''); setShowDriveSheet(true); }} disabled={workModules.length === 0}>Añadir por enlace</button></div>
              ) : (
                <div className="admin-drive__grid" data-view={driveView}>
                  {pagedDriveVideos.map((video) => {
                    const linkedHere = Boolean(workModules.find((module) => module.id === selectedModuleId)?.videos.some((item) => item.driveFileId === video.id));
                    return <article key={video.id} className="admin-drive__card" data-view={driveView} aria-labelledby={`admin-drive-video-${video.id}`}>
                      <div className="admin-drive__poster">{video.thumbnailLink ? <img src={video.thumbnailLink} alt="" loading="lazy" /> : <Play aria-hidden="true" />}{video.duration && <span className="admin-drive__duration">{video.duration}</span>}</div>
                      <div className="admin-drive__card-body"><span className="admin-drive__source">Video de Drive</span><h4 id={`admin-drive-video-${video.id}`} title={video.name}>{video.name}</h4><span className="admin-drive__state" data-linked={linkedHere}>{linkedHere ? 'En este módulo' : 'Disponible para enlazar'}</span></div>
                      <div className="admin-drive__card-actions">{video.webViewLink && <a href={video.webViewLink} target="_blank" rel="noopener noreferrer" aria-label={`Ver ${video.name} en Drive`}>Ver en Drive<ExternalLink aria-hidden="true" /></a>}<button type="button" onClick={() => handleLinkDriveVideo(video)} disabled={driveIsDemo || linkedHere || linkingVideo?.id === video.id || workModules.length === 0} aria-busy={linkingVideo?.id === video.id}>{linkingVideo?.id === video.id ? <Loader2 className="animate-spin" aria-hidden="true" /> : linkedHere ? <Check aria-hidden="true" /> : <Plus aria-hidden="true" />}{linkedHere ? 'Enlazado' : 'Enlazar'}</button></div>
                    </article>;
                  })}
                </div>
              )}
              <Pager total={visibleDriveVideos.length} size={drivePageSize} page={drivePageSafe} onPage={setDrivePage} noun="videos" />
              <AdminDriveVideoSheet open={showDriveSheet} onClose={() => setShowDriveSheet(false)} onSubmit={handleAddManualVideo} modules={workModules} moduleId={selectedModuleId} onModuleId={setSelectedModuleId} url={manualVideoUrl} onUrl={setManualVideoUrl} title={manualVideoTitle} onTitle={setManualVideoTitle} duration={manualVideoDuration} onDuration={setManualVideoDuration} busy={addingManualVideo} error={driveErrorMsg} />
            </section>
          )}

          {/* 3. GUÍAS DE AUDIO TTS */}
          {(uiVersion === 'v0.4-classic' ? activeTab === 'tts' : (mediaView === 'tts' || activeTab === 'tts')) && (
            <AdminTTSView
              courseId={workCourse.id}
              courseTitle={workCourse.title}
              modules={workModules}
              guides={ttsGuides}
              loading={loadingTtsGuides}
              sheetOpen={showTtsSheet}
              showCreateButton={uiVersion === 'v0.4-classic'}
              onOpenSheet={() => { setTtsErrorMsg(''); setShowTtsSheet(true); }}
              onCloseSheet={() => setShowTtsSheet(false)}
              title={ttsTitle}
              onTitle={setTtsTitle}
              script={ttsScript}
              onScript={setTtsScript}
              voice={ttsVoice}
              onVoice={setTtsVoice}
              speed={ttsSpeed}
              onSpeed={setTtsSpeed}
              videoId={ttsTargetVideoId}
              onVideoId={setTtsTargetVideoId}
              onSubmit={handleCreateTTSGuide}
              onGenerate={handleGenerateAiScript}
              onPreview={handlePreviewAudio}
              generating={isGeneratingAiScript}
              previewing={isPreviewingAudio}
              success={ttsSuccessMsg}
              error={ttsErrorMsg}
              onDelete={handleDeleteTTSGuide}
            />
          )}
      </div>
      )}

      {/* TAB 4: GESTIÓN DE PLUGINS & EXTENSIONES */}
      {activeTab === 'plugins' && (
        <PluginManagerView />
      )}

      {/* TAB: PORTAL WEB Y FEEDBACK ALUMNOS (PORTADA + BUZÓN NPS) */}
      {['landing', 'listening'].includes(activeTab) && (
        <div className={`space-y-6 ${animClass}`}>
          {uiVersion === 'v0.5-modern' && (
            <div data-mentor-ui="modern" className="admin-courses-root admin-resources-shell">
              <div className="mentor-mentees-panel admin-people-panel">
                <div className="mentor-section-heading">
                  <div>
                    <h2>Portal</h2>
                    <p>Edita la portada pública y atiende el buzón de escucha.</p>
                  </div>
                </div>
                <div className="admin-people-top">
                  <div className="mentor-publication-filters" role="group" aria-label="Sección del portal">
                    <button type="button" aria-pressed={activeTab === 'landing' || portalView === 'landing'} onClick={() => { setActiveTab('landing'); setPortalView('landing'); }}><span>Portada</span></button>
                    <button type="button" aria-pressed={activeTab === 'listening' || portalView === 'listening'} onClick={() => { setActiveTab('listening'); setPortalView('listening'); }}><span>Escucha</span></button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {(uiVersion === 'v0.4-classic' ? activeTab === 'landing' : (activeTab === 'landing' || portalView === 'landing')) && (
            <LandingPageEditor onSaved={onRefreshData} disableAnimation={uiVersion === 'v0.4-classic'} />
          )}

          {(uiVersion === 'v0.4-classic' ? activeTab === 'listening' : (activeTab === 'listening' || portalView === 'listening')) && (
            <ListeningAdminPanel />
          )}
        </div>
      )}



      {/* CERTIFICACIÓN: certificados emitidos y auditoría de contratos */}
      {(activeTab === 'certificates' || activeTab === 'contracts') && (
        <div className={animClass}>
          <AdminCertificationView
            section={activeTab}
            onSection={(sec) => selectTab(sec)}
            certificates={certificates}
            signatures={contractSignatures}
            onRevoke={handleRevokeCertificate}
            onViewSignature={setSelectedAuditSignature}
          />
        </div>
      )}

      <AdminSignatureSheet signature={selectedAuditSignature} onClose={() => setSelectedAuditSignature(null)} />

      {/* Modal para Asignar Cursos a un Mentor */}
      {selectedMentorForCourses && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget && !savingMentorCourses) {
              setSelectedMentorForCourses(null);
            }
          }}
        >
          <div className="bg-[#0e0e18] border border-line rounded-2xl p-6 w-full max-w-lg shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-brand-cyan/10 text-brand-cyan flex items-center justify-center">
                  <BookOpen className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-white">
                    Cursos Asignados al Mentor
                  </h3>
                  <p className="text-xs text-ink-muted">
                    {selectedMentorForCourses.name} ({selectedMentorForCourses.email})
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={savingMentorCourses}
                onClick={() => setSelectedMentorForCourses(null)}
                className="text-ink-muted hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-ink-soft">
              Marca los cursos que este mentor puede gestionar. Solo podrá ver, inscribir y tutelar estudiantes en los cursos seleccionados.
            </p>

            {mentorCoursesNotice && (
              <div className="p-3 bg-brand-cyan/10 border border-brand-cyan/30 rounded-xl text-brand-cyan text-xs font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" /> {mentorCoursesNotice}
              </div>
            )}

            {loadingMentorCourses ? (
              <div className="py-8 flex flex-col items-center justify-center text-ink-muted gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-brand-cyan" />
                <span className="text-xs">Cargando cursos asignados...</span>
              </div>
            ) : (
              <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                {allCourses.length === 0 ? (
                  <p className="text-xs text-ink-muted py-4 text-center">No hay cursos en el catálogo.</p>
                ) : (
                  allCourses.map((c) => {
                    const isChecked = mentorAssignedCourseIds.includes(c.id);
                    return (
                      <label
                        key={c.id}
                        className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                          isChecked
                            ? 'bg-brand-cyan/10 border-brand-cyan/40 text-white'
                            : 'bg-[#141424] border-line text-ink-muted hover:text-ink'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleMentorCourse(c.id)}
                            className="w-4 h-4 accent-[#06b6d4] rounded cursor-pointer"
                          />
                          <div className="min-w-0">
                            <p className="text-xs font-bold truncate">{c.title}</p>
                            <span className="text-[10px] text-ink-muted">{c.category}</span>
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

            <div className="flex items-center justify-between pt-3 border-t border-line">
              <span className="text-xs text-ink-muted font-mono">
                {mentorAssignedCourseIds.length} curso{mentorAssignedCourseIds.length === 1 ? '' : 's'} asignado{mentorAssignedCourseIds.length === 1 ? '' : 's'}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={savingMentorCourses}
                  onClick={() => setSelectedMentorForCourses(null)}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold text-ink-muted hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={savingMentorCourses || loadingMentorCourses}
                  onClick={handleSaveMentorCourses}
                  className="btn-brand-primary px-4 py-1.5 text-xs font-bold flex items-center gap-1.5"
                >
                  {savingMentorCourses && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Guardar Asignaciones</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

