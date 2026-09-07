/**
 * Panel de Administración & Mentoría
 * Academia Giantucchi
 *
 * Permite a los Profesores y Mentores:
 * 1. Gestionar Usuarios y Asignar Pases VIP (RBAC)
 * 2. Enlazar Videos de Google Drive a Módulos del Temario
 * 3. Responder Preguntas de Mentoría en la bandeja de entrada
 */

import React, { useState, useEffect } from 'react';
import { Shield, Crown, UserCheck, HardDrive, MessageSquare, Plus, RefreshCw, CheckCircle2, Users, Layers, ExternalLink, Sparkles, Volume2, Play, Trash2, Award, Wand2, Loader2, Sliders, GraduationCap, BookOpen, Download, FileText, Ban, Check, XCircle, AlertTriangle, Link2, Search } from 'lucide-react';
import { api } from '../lib/api';
import { User, UserRole, Course, Module, DriveVideoFile, TTSGuide, CertificateRecord, CourseEnrollmentRecord, CourseResource } from '../types';
import { SUPPORTED_TTS_VOICES, ttsService } from '../lib/ttsService';
import { PluginManagerView } from './PluginManagerView';
import { LandingPageEditor } from './LandingPageEditor';
import { CourseManagerView } from './CourseManagerView';

interface AdminDashboardProps {
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

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ course, onRefreshData }) => {
  const [activeTab, setActiveTab] = useState<'users' | 'courses' | 'drive' | 'tts' | 'plugins' | 'landing' | 'enrollments' | 'certificates' | 'resources'>('users');
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

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
  const [resTitle, setResTitle] = useState('');
  const [resPrivateUrl, setResPrivateUrl] = useState('');
  const [resKind, setResKind] = useState<'FILE' | 'LINK'>('FILE');
  const [resModuleId, setResModuleId] = useState<string>('');
  const [resSuccessMsg, setResSuccessMsg] = useState('');
  const [resErrorMsg, setResErrorMsg] = useState('');

  // Drive Linker State
  const [searchQuery, setSearchQuery] = useState('');
  const [driveVideos, setDriveVideos] = useState<DriveVideoFile[]>([]);
  const [loadingDrive, setLoadingDrive] = useState(false);
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
    loadCatalog();
  }, []);

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

  const handleRevokeCertificate = async (certId: string) => {
    const reason = revokeReason.trim() || 'Revocado por administración docente';
    try {
      await api.revokeCertificate(certId, reason);
      setRevokingCertId(null);
      setRevokeReason('');
      loadCertificates();
    } catch (err: any) {
      alert(err.message || 'Error al revocar certificado');
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
      setTimeout(() => setResSuccessMsg(''), 4000);
      refreshEverything();
    } catch (err: any) {
      setResErrorMsg(err.message || 'Error al agregar recurso');
    }
  };

  const handleDeleteResource = async (resourceId: string) => {
    if (!confirm('¿Deseas eliminar este recurso?')) return;
    try {
      await api.deleteCourseResource(resourceId);
      refreshEverything();
    } catch (err: any) {
      setResErrorMsg(err.message || 'Error al eliminar recurso');
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
    setLoadingDrive(true);
    setDriveErrorMsg('');
    try {
      const res = await api.searchDriveVideos(q);
      setDriveVideos(res.videos || []);
      // Sin credenciales el servidor responde con un catálogo de demostración
      // cuyos identificadores no existen: enlazarlos deja el reproductor negro.
      setDriveIsDemo(Boolean(res.isDemo));
    } catch (error: any) {
      setDriveErrorMsg(error?.message || 'No se pudo consultar Google Drive.');
    } finally {
      setLoadingDrive(false);
    }
  };

  const handleUpdateRole = async (userId: string, newRole: UserRole) => {
    try {
      await api.updateUserRole(userId, newRole);
      loadUsers();
      onRefreshData();
    } catch (error) {
      console.error('Error updating role:', error);
    }
  };

  const handleUpdateModeration = async (userId: string, currentStrikes: number = 0, currentActive: boolean = true, action: 'add_strike' | 'toggle_active' | 'reset') => {
    try {
      let newStrikes = currentStrikes;
      let newActive = currentActive;

      if (action === 'add_strike') newStrikes += 1;
      if (action === 'reset') newStrikes = 0;
      if (action === 'toggle_active') newActive = !currentActive;

      await api.updateUserModeration(userId, { strikes: newStrikes, isActive: newActive });
      loadUsers();
      onRefreshData();
    } catch (error) {
      console.error('Error updating moderation:', error);
    }
  };

  const [coursePrice, setCoursePrice] = useState<number>(course?.price || 49);
  const [updatingPrice, setUpdatingPrice] = useState(false);
  const [priceSuccessMsg, setPriceSuccessMsg] = useState('');

  const handleSaveCoursePrice = async () => {
    if (!course) return;
    setUpdatingPrice(true);
    try {
      await api.updateCoursePrice(course.id, coursePrice);
      setPriceSuccessMsg('¡Precio del curso actualizado exitosamente!');
      onRefreshData();
      setTimeout(() => setPriceSuccessMsg(''), 3000);
    } catch (err) {
      console.error('Error updating price:', err);
    } finally {
      setUpdatingPrice(false);
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

  /**
   * Sobre qué curso se está trabajando.
   *
   * Recursos, Videos Drive y Guías TTS escriben en un curso concreto; sin este
   * selector escribían siempre en el primero del catálogo y el administrador no
   * tenía manera de saberlo hasta abrir el curso equivocado.
   */
  const courseScopeBar = (
    <div className="bg-[#141420] border border-[#2d2d44] rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto">
        <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0">
          Curso sobre el que trabajas
        </label>
        <select
          value={workCourseId}
          onChange={(e) => setWorkCourseId(e.target.value)}
          className="w-full sm:w-96 bg-[#0a0a0f] border border-[#2d2d44] text-white text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-[#06b6d4]"
        >
          {allCourses.map((item) => (
            <option key={item.id} value={item.id}>
              {item.title}{item.published ? '' : ' — borrador'}
            </option>
          ))}
        </select>
      </div>

      <span className="text-[11px] font-mono text-slate-500 shrink-0">
        {workModules.length} módulos · {workLessonCount} clases
      </span>
    </div>
  );

  const noModulesNotice = workModules.length === 0 && (
    <div className="p-3 bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs rounded-xl flex items-start gap-2">
      <AlertTriangle className="w-4 h-4 shrink-0 mt-px" />
      <span>
        «{workCourse.title}» todavía no tiene módulos. Créalos en la pestaña Cursos o importando
        una carpeta de Drive antes de asignarle contenido.
      </span>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 animate-fade-in">
      
      {/* Admin Header */}
      <div className="bg-[#141420] border border-[#2d2d44] rounded-xl p-6 shadow-xl text-white flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 text-[#06b6d4] text-xs font-bold uppercase tracking-wider mb-1">
            <Shield className="w-4 h-4 text-[#06b6d4]" /> Panel de Mentoría & Administración RBAC
          </div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight">Academia Giantucchi Control Center</h2>
          <p className="text-slate-400 text-sm mt-1">
            Gestión de permisos de usuarios, asignación de Pases VIP y enlazado de videos de Google Drive.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex flex-wrap bg-[#0a0a0f] p-1.5 rounded-xl border border-[#2d2d44] gap-1 w-full">
          <button
            onClick={() => setActiveTab('users')}
            className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
              activeTab === 'users' ? 'btn-brand-primary' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5" /> Usuarios
          </button>
          <button
            onClick={() => setActiveTab('courses')}
            className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
              activeTab === 'courses' ? 'btn-brand-primary' : 'text-slate-400 hover:text-white'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5 text-cyan-400" /> Cursos
          </button>
          <button
            onClick={() => setActiveTab('enrollments')}
            className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
              activeTab === 'enrollments' ? 'btn-brand-primary' : 'text-slate-400 hover:text-white'
            }`}
          >
            <GraduationCap className="w-3.5 h-3.5 text-emerald-400" /> Matrículas
          </button>
          <button
            onClick={() => setActiveTab('certificates')}
            className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
              activeTab === 'certificates' ? 'btn-brand-primary' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Award className="w-3.5 h-3.5 text-amber-400" /> Certificados
          </button>
          <button
            onClick={() => setActiveTab('resources')}
            className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
              activeTab === 'resources' ? 'btn-brand-primary' : 'text-slate-400 hover:text-white'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5 text-cyan-400" /> Recursos
          </button>
          <button
            onClick={() => setActiveTab('drive')}
            className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
              activeTab === 'drive' ? 'btn-brand-primary' : 'text-slate-400 hover:text-white'
            }`}
          >
            <HardDrive className="w-3.5 h-3.5" /> Videos Drive
          </button>
          <button
            onClick={() => setActiveTab('tts')}
            className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
              activeTab === 'tts' ? 'bg-brand-gradient text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-[#eab308]" /> Guías TTS
          </button>
          <button
            onClick={() => setActiveTab('plugins')}
            className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
              activeTab === 'plugins' ? 'bg-brand-gradient text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-[#06b6d4]" /> Plugins
          </button>
          <button
            onClick={() => setActiveTab('landing')}
            className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
              activeTab === 'landing' ? 'bg-brand-gradient text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Sliders className="w-3.5 h-3.5 text-[#06b6d4]" /> Portada
          </button>
        </div>
      </div>



      {activeTab === 'courses' && <CourseManagerView onRefreshData={onRefreshData} />}

      {/* TAB 1: USER & VIP ROLE MANAGEMENT + MODERATION + PRICING */}
      {activeTab === 'users' && (
        <div className="space-y-6">
          {/* Course Pricing Configuration Card */}
          {course && (
          <div className="bg-[#141420] border border-[#2d2d44] rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#2d2d44] pb-3">
              <div>
                <h3 className="font-extrabold text-base text-white flex items-center gap-2">
                  <Crown className="w-5 h-5 text-[#eab308]" />
                  Monetización y Precio del Programa de Mentoría
                </h3>
                {/* Esta tarjeta edita el curso que abre el panel, no el que se
                    elige en las demás pestañas: nombrarlo evita cambiarle el
                    precio al curso equivocado. El precio por curso también se
                    edita, uno a uno, en la pestaña Cursos. */}
                <p className="text-xs text-slate-400">
                  Precio público de <span className="font-bold text-slate-200">«{course?.title}»</span>.
                  Deja en 0 para que sea completamente público y gratuito.
                </p>
              </div>
              {priceSuccessMsg && (
                <span className="text-xs text-emerald-400 font-bold bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 rounded-xl animate-fade-in">
                  {priceSuccessMsg}
                </span>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="flex items-center gap-2 bg-[#0a0a0f] border border-[#2d2d44] rounded-xl px-4 py-2 w-full sm:w-64">
                <span className="text-slate-400 font-extrabold text-sm">$</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={coursePrice}
                  onChange={(e) => setCoursePrice(Number(e.target.value))}
                  placeholder="Ej. 49"
                  className="w-full bg-transparent text-sm text-white font-mono focus:outline-none"
                />
                <span className="text-slate-500 text-xs uppercase font-bold">USD</span>
              </div>

              <button
                onClick={handleSaveCoursePrice}
                disabled={updatingPrice}
                className="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-[#eab308] to-[#f59e0b] hover:opacity-90 disabled:opacity-50 text-black font-extrabold text-xs rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all"
              >
                {updatingPrice && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>Guardar Precio del Curso</span>
              </button>
            </div>
          </div>
          )}

          <div className="bg-[#141420] border border-[#2d2d44] rounded-xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#2d2d44] pb-3">
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-[#06b6d4]" />
                Gestión de Usuarios, Roles VIP y Moderación de Mentees
              </h3>
              <button
                onClick={loadUsers}
                className="p-1.5 rounded-lg bg-[#1a1a2e] border border-[#2d2d44] text-slate-300 hover:text-white"
              >
                <RefreshCw className={`w-4 h-4 ${loadingUsers ? 'animate-spin' : ''}`} />
              </button>
            </div>

            <div className="overflow-x-auto rounded-xl border border-[#2d2d44]">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-[#0a0a0f] text-slate-400 uppercase font-semibold text-[11px] border-b border-[#2d2d44]">
                  <tr>
                    <th className="p-3.5">Usuario</th>
                    <th className="p-3.5">Email</th>
                    <th className="p-3.5">Rol Actual</th>
                    <th className="p-3.5">Strikes & Estado</th>
                    <th className="p-3.5 text-right">Moderación & Roles</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2d2d44]">
                  {users.map((u) => {
                    const strikes = u.strikes || 0;
                    const isActive = u.isActive !== false;
                    return (
                      <tr key={u.id} className="hover:bg-[#1a1a2e] transition-colors">
                        <td className="p-3.5 flex items-center gap-3">
                          <img
                            src={u.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
                            alt={u.name}
                            className="w-8 h-8 rounded-full object-cover ring-1 ring-[#2d2d44]"
                          />
                          <div>
                            <span className="font-semibold text-white block">{u.name}</span>
                            {!isActive && (
                              <span className="text-[10px] text-red-400 font-bold uppercase">Cuenta Suspendida</span>
                            )}
                          </div>
                        </td>
                        <td className="p-3.5 font-mono text-slate-400">{u.email}</td>
                        <td className="p-3.5">
                          {u.role === 'ADMIN' && (
                            <span className="bg-[#a855f7]/20 text-[#a855f7] border border-[#a855f7]/30 font-bold px-2.5 py-1 rounded-lg text-[10px] inline-flex items-center gap-1">
                              <Shield className="w-3 h-3" /> ADMIN
                            </span>
                          )}
                          {u.role === 'VIP' && (
                            <span className="bg-brand-gradient text-white font-extrabold px-2.5 py-1 rounded-lg text-[10px] inline-flex items-center gap-1 shadow-sm">
                              <Crown className="w-3 h-3" /> SOCIO VIP
                            </span>
                          )}
                          {u.role === 'EXTERNAL' && (
                            <span className="bg-[#1a1a2e] border border-[#2d2d44] text-slate-400 font-medium px-2.5 py-1 rounded-lg text-[10px]">
                              EXTERNO
                            </span>
                          )}
                        </td>
                        <td className="p-3.5">
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded-md font-mono text-[10px] font-bold border ${
                              strikes > 0 ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' : 'bg-slate-800 text-slate-400 border-slate-700'
                            }`}>
                              ⚠️ {strikes} Strikes
                            </span>
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                              isActive ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-red-500/10 border-red-500/30 text-red-400'
                            }`}>
                              {isActive ? 'Activo' : 'Suspendido'}
                            </span>
                          </div>
                        </td>
                        <td className="p-3.5 text-right space-x-1.5">
                          {/* Moderation actions */}
                          <button
                            onClick={() => handleUpdateModeration(u.id, strikes, isActive, 'add_strike')}
                            title="Dar Strike de Moderación"
                            className="px-2 py-1 bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 text-amber-300 font-bold rounded-lg text-[10px] transition-all"
                          >
                            +1 Strike
                          </button>
                          <button
                            onClick={() => handleUpdateModeration(u.id, strikes, isActive, 'toggle_active')}
                            title={isActive ? 'Suspender Usuario' : 'Activar Usuario'}
                            className={`px-2 py-1 border font-bold rounded-lg text-[10px] transition-all ${
                              isActive
                                ? 'bg-red-500/10 border-red-500/30 hover:bg-red-500/20 text-red-400'
                                : 'bg-emerald-500/10 border-emerald-500/30 hover:bg-emerald-500/20 text-emerald-400'
                            }`}
                          >
                            {isActive ? 'Suspender' : 'Activar'}
                          </button>

                          {/* Role actions */}
                          {u.role !== 'VIP' && (
                            <button
                              onClick={() => handleUpdateRole(u.id, 'VIP')}
                              className="px-2.5 py-1 bg-[#06b6d4] hover:bg-[#06b6d4]/80 text-white font-bold rounded-lg text-[10px] shadow-sm transition-all"
                            >
                              Pase VIP
                            </button>
                          )}
                          {u.role !== 'ADMIN' && (
                            <button
                              onClick={() => handleUpdateRole(u.id, 'ADMIN')}
                              className="px-2.5 py-1 bg-[#a855f7] hover:bg-[#a855f7]/80 text-white font-bold rounded-lg text-[10px] shadow-sm transition-all"
                            >
                              Admin
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: LINK GOOGLE DRIVE VIDEOS TO COURSE MODULES */}
      {activeTab === 'drive' && (
        <div className="space-y-6">
        {courseScopeBar}
        <div className="bg-[#141420] border border-[#2d2d44] rounded-xl p-6 shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[#2d2d44] pb-4">
            <div>
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                <HardDrive className="w-5 h-5 text-[#06b6d4]" />
                Enlazar Contenido de Google Drive al Temario
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Elige el módulo de «{workCourse.title}» y asóciale videos alojados en Google Drive.
              </p>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <label className="text-xs text-slate-400 font-semibold shrink-0">Módulo Destino:</label>
              <select
                value={selectedModuleId}
                onChange={(e) => setSelectedModuleId(e.target.value)}
                disabled={workModules.length === 0}
                className="bg-[#0a0a0f] border border-[#2d2d44] text-white text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-[#06b6d4] disabled:opacity-50"
              >
                {workModules.length === 0 && <option value="">Sin módulos</option>}
                {workModules.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {noModulesNotice}

          {linkSuccessMsg && (
            <div className="p-3 bg-[#06b6d4]/10 border border-[#06b6d4]/30 text-[#06b6d4] text-xs rounded-xl flex items-center gap-2 animate-fade-in font-semibold">
              <CheckCircle2 className="w-4 h-4" /> {linkSuccessMsg}
            </div>
          )}

          {driveErrorMsg && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-300 text-xs rounded-xl flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-px" /> <span>{driveErrorMsg}</span>
            </div>
          )}

          {/* De dónde salen estos videos. Sin decirlo, un catálogo de
              demostración se confunde con la cuenta de Drive del centro y se
              enlazan archivos que no existen. */}
          {driveIsDemo ? (
            <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-200 space-y-1.5">
              <p className="font-bold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" /> Google Drive no está conectado: esto es un catálogo de demostración
              </p>
              <p className="text-amber-200/80 leading-relaxed">
                Los videos de abajo son ejemplos y sus identificadores no existen; si los enlazas, el
                reproductor saldrá vacío. Para ver los archivos reales de tu cuenta, configura en el
                servidor <code className="font-mono">GOOGLE_DRIVE_CLIENT_EMAIL</code> y{' '}
                <code className="font-mono">GOOGLE_DRIVE_PRIVATE_KEY</code> (cuenta de servicio) o{' '}
                <code className="font-mono">GOOGLE_DRIVE_API_KEY</code>, más{' '}
                <code className="font-mono">GOOGLE_DRIVE_FOLDER_ID</code> con la carpeta a listar, y
                comparte esa carpeta con la cuenta de servicio. Mientras tanto, usa el alta por enlace.
              </p>
            </div>
          ) : (
            <p className="text-[11px] text-slate-500">
              Listando los videos de la carpeta de Drive configurada en el servidor
              (<code className="font-mono">GOOGLE_DRIVE_FOLDER_ID</code>). Si el video vive en otra
              carpeta, añádelo por enlace.
            </p>
          )}

          {/* Alta por enlace: el camino que funciona con o sin credenciales. */}
          <form
            onSubmit={handleAddManualVideo}
            className="bg-[#0a0a0f] border border-[#2d2d44] rounded-xl p-4 space-y-3"
          >
            <h4 className="text-xs font-bold text-white flex items-center gap-2">
              <Link2 className="w-4 h-4 text-[#a855f7]" /> Añadir una clase pegando su enlace
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
              <div className="md:col-span-2">
                <label className="text-[11px] font-bold text-slate-400 block mb-1">
                  Enlace de Drive o URL de reproducción
                </label>
                <input
                  type="text"
                  value={manualVideoUrl}
                  onChange={(e) => setManualVideoUrl(e.target.value)}
                  placeholder="https://drive.google.com/file/d/ABC123.../view"
                  className="w-full bg-[#141420] border border-[#2d2d44] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#06b6d4]"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-400 block mb-1">Título de la clase</label>
                <input
                  type="text"
                  value={manualVideoTitle}
                  onChange={(e) => setManualVideoTitle(e.target.value)}
                  placeholder="Ej. 03. Índices en PostgreSQL"
                  className="w-full bg-[#141420] border border-[#2d2d44] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#06b6d4]"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-bold text-slate-400 block mb-1">Duración</label>
                  <input
                    type="text"
                    value={manualVideoDuration}
                    onChange={(e) => setManualVideoDuration(e.target.value)}
                    placeholder="20:00"
                    className="w-full bg-[#141420] border border-[#2d2d44] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#06b6d4]"
                  />
                </div>
                <button
                  type="submit"
                  disabled={addingManualVideo || workModules.length === 0}
                  className="btn-brand-primary h-[38px] px-3 text-xs font-bold flex items-center justify-center gap-1.5 self-end disabled:opacity-50"
                >
                  {addingManualVideo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Añadir
                </button>
              </div>
            </div>
          </form>

          {/* Buscador de la carpeta configurada. */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              loadDriveVideos(searchQuery);
            }}
            className="flex items-center gap-2"
          >
            <div className="flex-1 flex items-center gap-2 bg-[#0a0a0f] border border-[#2d2d44] rounded-xl px-3">
              <Search className="w-4 h-4 text-slate-500 shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por nombre en la carpeta de Drive..."
                className="w-full bg-transparent py-2 text-xs text-white focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={loadingDrive}
              className="px-4 py-2 bg-[#1a1a2e] border border-[#2d2d44] hover:border-[#06b6d4] text-slate-200 text-xs font-bold rounded-xl flex items-center gap-2 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingDrive ? 'animate-spin' : ''}`} /> Buscar
            </button>
          </form>

          {!loadingDrive && driveVideos.length === 0 && (
            <p className="text-xs text-slate-500 py-6 text-center">
              No hay videos que mostrar para esa búsqueda.
            </p>
          )}

          {/* Drive Videos Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {driveVideos.map((video) => (
              <div
                key={video.id}
                className="bg-[#1a1a2e] border border-[#2d2d44] rounded-xl p-4 flex flex-col justify-between hover:border-[#06b6d4]/50 transition-all shadow-md"
              >
                <div className="space-y-2">
                  <div className="aspect-video bg-black rounded-xl overflow-hidden border border-[#2d2d44] relative">
                    <img
                      src={video.thumbnailLink || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&auto=format&fit=crop&q=80'}
                      alt={video.name}
                      className="w-full h-full object-cover"
                    />
                    {video.duration && (
                      <span className="absolute bottom-1.5 right-1.5 bg-black/90 text-[#06b6d4] text-[10px] font-bold px-2 py-0.5 rounded-lg border border-[#2d2d44]">
                        {video.duration}
                      </span>
                    )}
                  </div>
                  <h4 className="font-semibold text-xs text-white line-clamp-2">{video.name}</h4>
                </div>

                <div className="mt-4 pt-3 border-t border-[#2d2d44] flex items-center justify-between">
                  <span className="text-[10px] text-slate-500 font-mono">ID: {video.id.substring(0, 12)}...</span>
                  <button
                    onClick={() => handleLinkDriveVideo(video)}
                    disabled={linkingVideo?.id === video.id || workModules.length === 0}
                    className="px-3 py-1.5 bg-[#a855f7] hover:bg-[#a855f7]/80 text-white font-bold rounded-lg text-xs flex items-center gap-1 shadow-sm transition-all disabled:opacity-50"
                  >
                    {linkingVideo?.id === video.id ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <>
                        <Plus className="w-3.5 h-3.5" /> Enlazar al Módulo
                      </>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
        </div>
      )}

      {/* TAB 3: GESTIÓN DE GUÍAS DE MENTORÍA (TTS GAMIFICADO) */}
      {activeTab === 'tts' && (
        <div className="space-y-6">

          {/* La guía se guarda contra una clase concreta, así que el curso se
              elige antes que nada: sin esto el desplegable de lecciones sólo
              ofrecía las del primer curso del catálogo. */}
          {courseScopeBar}

          {/* Form Box */}
          <div className="bg-[#141420] border border-[#2d2d44] rounded-xl p-6 shadow-xl space-y-6">
            <div className="border-b border-[#2d2d44] pb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-[#06b6d4]" />
                <h3 className="font-bold text-base text-white">Gestión de Guías de Mentoría (TTS Gamificado)</h3>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Crea guías de voz sintéticas que orienten a los estudiantes al inicio de cada lección de
                «{workCourse.title}» y recompénsalos con XP por escuchar la introducción.
              </p>
            </div>

            {noModulesNotice}

            {ttsSuccessMsg && (
              <div className="p-3 bg-[#06b6d4]/10 border border-[#06b6d4]/30 text-[#06b6d4] text-xs rounded-xl flex items-center gap-2 font-semibold animate-fade-in">
                <CheckCircle2 className="w-4 h-4" /> {ttsSuccessMsg}
              </div>
            )}

            {ttsErrorMsg && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-300 text-xs rounded-xl flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-px" /> <span>{ttsErrorMsg}</span>
              </div>
            )}

            <form onSubmit={handleCreateTTSGuide} className="space-y-4">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Title */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                    Título de la Guía
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Guía de Orientación: Metodología Giantucchi"
                    value={ttsTitle}
                    onChange={(e) => setTtsTitle(e.target.value)}
                    className="w-full bg-[#0a0a0f] border border-[#2d2d44] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#06b6d4]"
                  />
                </div>

                {/* Target Lesson/Video Selector */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                    Asociar a Clase / Lección Destino
                  </label>
                  <select
                    value={ttsTargetVideoId}
                    onChange={(e) => setTtsTargetVideoId(e.target.value)}
                    disabled={workLessonCount === 0}
                    className="w-full bg-[#0a0a0f] border border-[#2d2d44] text-white text-xs rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-[#06b6d4] disabled:opacity-50"
                  >
                    {workLessonCount === 0 && <option value="">Este curso aún no tiene clases</option>}
                    {workModules.flatMap((m) =>
                      m.videos.map((v) => (
                        <option key={v.id} value={v.id}>
                          {m.title} → {v.title}
                        </option>
                      ))
                    )}
                  </select>
                </div>
              </div>

              {/* Voice Selector & Speed */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                      Voz Sintética TTS (Multilenguaje)
                    </label>
                    <button
                      type="button"
                      onClick={() => ttsService.testVoice(ttsVoice, ttsSpeed)}
                      className="text-[11px] font-bold text-[#06b6d4] bg-[#06b6d4]/10 border border-[#06b6d4]/30 px-2.5 py-0.5 rounded-lg hover:bg-[#06b6d4]/20 flex items-center gap-1 transition-all"
                    >
                      <Volume2 className="w-3.5 h-3.5" /> Probar Voz Seleccionada
                    </button>
                  </div>
                  <select
                    value={ttsVoice}
                    onChange={(e) => setTtsVoice(e.target.value)}
                    className="w-full bg-[#0a0a0f] border border-[#2d2d44] text-white text-xs rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-[#06b6d4]"
                  >
                    {SUPPORTED_TTS_VOICES.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.flag} {v.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                    Velocidad de Lectura (Speed: {ttsSpeed}x)
                  </label>
                  <input
                    type="range"
                    min="0.8"
                    max="1.4"
                    step="0.1"
                    value={ttsSpeed}
                    onChange={(e) => setTtsSpeed(parseFloat(e.target.value))}
                    className="w-full accent-[#06b6d4] mt-2 cursor-pointer"
                  />
                </div>
              </div>

              {/* Widget de Pruebas Rápidas de Voz Multilenguaje */}
              <div className="bg-[#0a0a0f] border border-[#2d2d44] rounded-xl p-4 space-y-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  🔊 Banco de Prueba Rápida de Voces por Idioma
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                  {SUPPORTED_TTS_VOICES.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => {
                        setTtsVoice(v.id);
                        ttsService.testVoice(v.id, ttsSpeed);
                      }}
                      className={`p-2 rounded-lg border text-[11px] font-semibold text-left flex items-center justify-between transition-all ${
                        ttsVoice === v.id
                          ? 'bg-[#06b6d4]/10 border-[#06b6d4] text-white shadow-sm'
                          : 'bg-[#141420] border-[#2d2d44] text-slate-400 hover:text-white hover:border-[#06b6d4]/40'
                      }`}
                    >
                      <span className="truncate">{v.flag} {v.name.split('(')[0]}</span>
                      <Volume2 className="w-3.5 h-3.5 text-[#06b6d4] shrink-0 ml-1" />
                    </button>
                  ))}
                </div>
              </div>

              {/* Script Text with Hybrid AI Generator Button */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Guion del Mensaje de Mentoría (Texto para TTS)
                  </label>

                  <button
                    type="button"
                    onClick={handleGenerateAiScript}
                    disabled={isGeneratingAiScript}
                    className="px-3 py-1 rounded-lg bg-gradient-to-r from-[#a855f7] to-[#06b6d4] text-white text-[11px] font-extrabold flex items-center gap-1.5 shadow-md hover:opacity-90 transition-all disabled:opacity-50"
                  >
                    {isGeneratingAiScript ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Generando...</span>
                      </>
                    ) : (
                      <>
                        <Wand2 className="w-3.5 h-3.5 text-[#eab308]" />
                        <span>Generar con IA</span>
                      </>
                    )}
                  </button>
                </div>

                <textarea
                  rows={4}
                  required
                  placeholder="Escribe o genera con IA las instrucciones iniciales que el alumno escuchará antes de ver la lección..."
                  value={ttsScript}
                  onChange={(e) => setTtsScript(e.target.value)}
                  className="w-full bg-[#0a0a0f] border border-[#2d2d44] rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#06b6d4] transition-all"
                />
              </div>

              {/* Form Action Buttons */}
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={handlePreviewAudio}
                  className="px-4 py-2 bg-[#1a1a2e] border border-[#2d2d44] hover:border-[#06b6d4] text-slate-200 text-xs font-bold rounded-xl flex items-center gap-2 transition-all"
                >
                  <Volume2 className={`w-4 h-4 ${isPreviewingAudio ? 'text-[#06b6d4] animate-bounce' : ''}`} />
                  {isPreviewingAudio ? 'Reproduciendo Audio de Prueba...' : 'Previsualizar Audio'}
                </button>

                <button
                  type="submit"
                  disabled={!ttsTargetVideoId}
                  className="btn-brand-primary px-6 py-2.5 text-xs font-extrabold flex items-center gap-2 shadow-lg shadow-[#06b6d4]/20 disabled:opacity-50"
                >
                  <Sparkles className="w-4 h-4 text-[#eab308]" /> Generar y Guardar Guía TTS
                </button>
              </div>

            </form>
          </div>

          {/* List of Existing TTS Guides */}
          <div className="bg-[#141420] border border-[#2d2d44] rounded-xl p-6 shadow-xl space-y-4">
            <h4 className="font-bold text-sm text-white flex items-center gap-2 border-b border-[#2d2d44] pb-3">
              <Award className="w-4 h-4 text-[#a855f7]" /> Guías de «{workCourse.title}» ({ttsGuides.length})
            </h4>

            {loadingTtsGuides ? (
              <p className="text-xs text-slate-500 py-4 text-center">Cargando guías...</p>
            ) : ttsGuides.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">Este curso todavía no tiene guías TTS.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {ttsGuides.map((guide) => (
                  <div
                    key={guide.id}
                    className="bg-[#1a1a2e] border border-[#2d2d44] rounded-xl p-4 space-y-3 relative hover:border-[#06b6d4]/40 transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <img
                          src={guide.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                          alt={guide.mentorName}
                          className="w-8 h-8 rounded-full object-cover ring-1 ring-[#2d2d44]"
                        />
                        <div>
                          <h5 className="font-bold text-xs text-white">{guide.title}</h5>
                          <span className="text-[10px] text-[#06b6d4] font-semibold">{guide.mentorName}</span>
                        </div>
                      </div>

                      <button
                        onClick={() => handleDeleteTTSGuide(guide.id)}
                        className="p-1.5 text-slate-500 hover:text-red-400 rounded-lg hover:bg-[#141420]"
                        title="Eliminar guía"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <p className="text-xs text-slate-300 italic bg-[#0a0a0f] p-2.5 rounded-lg border border-[#2d2d44] line-clamp-3">
                      "{guide.scriptText}"
                    </p>

                    <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => ttsService.speak({ text: guide.scriptText, voiceId: guide.voiceId, speed: guide.voiceSpeed })}
                          className="px-2.5 py-1 bg-[#06b6d4]/10 border border-[#06b6d4]/30 text-[#06b6d4] font-bold rounded-lg hover:bg-[#06b6d4]/20 flex items-center gap-1 transition-all"
                        >
                          <Volume2 className="w-3 h-3" /> Escuchar Guía
                        </button>
                        <span className="font-mono text-[#a855f7]">Voz: {guide.voiceId}</span>
                      </div>
                      <span className="font-bold text-[#eab308] bg-[#eab308]/10 px-2 py-0.5 rounded-lg border border-[#eab308]/20">
                        +{guide.xpReward} XP
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      )}

      {/* TAB 4: GESTIÓN DE PLUGINS & EXTENSIONES */}
      {activeTab === 'plugins' && (
        <PluginManagerView />
      )}

      {/* TAB: EDITOR DE PORTADA. La pestaña existia y el editor estaba
          importado, pero nadie lo pintaba: pulsar "Portada" dejaba la pagina en
          blanco por debajo de las pestañas. */}
      {activeTab === 'landing' && (
        <LandingPageEditor onSaved={onRefreshData} />
      )}

      {/* TAB: MATRÍCULAS (ENROLLMENTS) */}
      {activeTab === 'enrollments' && (
        <div className="space-y-6 animate-fade-in">
          {/* Matricular Usuario Manualmente */}
          <div className="bg-[#141420] border border-[#2d2d44] rounded-2xl p-6 shadow-xl space-y-4">
            <h3 className="text-base font-extrabold text-white flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-emerald-400" />
              <span>Matricular Usuario en Curso</span>
            </h3>
            <p className="text-xs text-slate-400">
              Asigna o actualiza la matrícula de un usuario con estado formal verificable (ACTIVE, COMPLETED, REVOKED, EXPIRED).
            </p>

            {enrollSuccessMsg && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" /> {enrollSuccessMsg}
              </div>
            )}

            <form onSubmit={handleCreateEnrollment} className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
              <div>
                <label className="text-[11px] font-bold text-slate-400 block mb-1">Usuario</label>
                <select
                  value={newEnrollUserId}
                  onChange={(e) => setNewEnrollUserId(e.target.value)}
                  className="w-full bg-[#0a0a0f] border border-[#2d2d44] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#06b6d4]"
                  required
                >
                  <option value="">Selecciona usuario...</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.email}) [{u.role}]
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-400 block mb-1">Curso</label>
                <select
                  value={newEnrollCourseId}
                  onChange={(e) => setNewEnrollCourseId(e.target.value)}
                  className="w-full bg-[#0a0a0f] border border-[#2d2d44] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#06b6d4]"
                  required
                >
                  <option value="">Selecciona curso...</option>
                  {allCourses.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.title}{item.published === false ? ' (borrador)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-400 block mb-1">Estado</label>
                <select
                  value={newEnrollStatus}
                  onChange={(e) => setNewEnrollStatus(e.target.value as any)}
                  className="w-full bg-[#0a0a0f] border border-[#2d2d44] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#06b6d4]"
                >
                  <option value="ACTIVE">ACTIVE (Activa)</option>
                  <option value="COMPLETED">COMPLETED (Graduado)</option>
                  <option value="REVOKED">REVOKED (Revocada)</option>
                  <option value="EXPIRED">EXPIRED (Expirada)</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-400 block mb-1">Origen</label>
                <select
                  value={newEnrollSource}
                  onChange={(e) => setNewEnrollSource(e.target.value as any)}
                  className="w-full bg-[#0a0a0f] border border-[#2d2d44] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#06b6d4]"
                >
                  <option value="ADMIN">ADMIN (Asignación Directa)</option>
                  <option value="PAYMENT">PAYMENT (Pago)</option>
                  <option value="MENTORSHIP">MENTORSHIP (Mentoría)</option>
                </select>
              </div>

              <button type="submit" className="btn-brand-primary py-2 px-4 text-xs font-bold flex items-center justify-center gap-1.5 h-[38px]">
                <Plus className="w-4 h-4" /> Matricular
              </button>
            </form>
          </div>

          {/* Tabla de Matrículas */}
          <div className="bg-[#141420] border border-[#2d2d44] rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-[#06b6d4]" />
                <span>Matrículas Registradas ({enrollments.length})</span>
              </h3>
              <button
                onClick={loadEnrollments}
                disabled={loadingEnrollments}
                className="p-2 bg-[#0a0a0f] hover:bg-[#1a1a2e] text-slate-300 rounded-xl border border-[#2d2d44] transition-all text-xs flex items-center gap-1"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingEnrollments ? 'animate-spin' : ''}`} />
                <span>Actualizar</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-[#0a0a0f] text-slate-400 uppercase font-mono text-[10px] border-b border-[#2d2d44]">
                  <tr>
                    <th className="py-3 px-4">Estudiante</th>
                    <th className="py-3 px-4">Curso</th>
                    <th className="py-3 px-4">Estado</th>
                    <th className="py-3 px-4">Origen</th>
                    <th className="py-3 px-4">Fecha</th>
                    <th className="py-3 px-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2d2d44]/50">
                  {enrollments.map((enr) => (
                    <tr key={enr.id} className="hover:bg-[#1a1a2e]/50 transition-colors">
                      <td className="py-3 px-4 font-semibold text-white">
                        {enr.userName || enr.userId}
                        <span className="block text-[10px] text-slate-500 font-normal">{enr.userEmail}</span>
                      </td>
                      <td className="py-3 px-4 text-slate-300">{enr.courseTitle || enr.courseId}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                            enr.status === 'ACTIVE'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                              : enr.status === 'COMPLETED'
                              ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
                              : enr.status === 'REVOKED'
                              ? 'bg-red-500/10 text-red-400 border border-red-500/30'
                              : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                          }`}
                        >
                          {enr.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-[10px] text-slate-400">{enr.source}</td>
                      <td className="py-3 px-4 text-slate-400">
                        {new Date(enr.createdAt).toLocaleDateString('es-ES')}
                      </td>
                      <td className="py-3 px-4 text-right space-x-1">
                        {enr.status !== 'ACTIVE' && (
                          <button
                            onClick={() => handleUpdateEnrollmentStatus(enr.id, 'ACTIVE')}
                            className="px-2 py-1 rounded bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 text-[10px] font-bold"
                          >
                            Activar
                          </button>
                        )}
                        {enr.status !== 'REVOKED' && (
                          <button
                            onClick={() => handleUpdateEnrollmentStatus(enr.id, 'REVOKED')}
                            className="px-2 py-1 rounded bg-red-500/20 text-red-300 hover:bg-red-500/30 text-[10px] font-bold"
                          >
                            Revocar
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {enrollments.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500">
                        No hay matrículas registradas aún.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB: CERTIFICADOS (CERTIFICATES) */}
      {activeTab === 'certificates' && (
        <div className="bg-[#141420] border border-[#2d2d44] rounded-2xl p-6 shadow-xl space-y-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                <Award className="w-5 h-5 text-amber-400" />
                <span>Certificados Oficiales Emitidos ({certificates.length})</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Certificados con código alfanumérico persistente y verificación pública contra base de datos.
              </p>
            </div>
            <button
              onClick={loadCertificates}
              disabled={loadingCertificates}
              className="p-2 bg-[#0a0a0f] hover:bg-[#1a1a2e] text-slate-300 rounded-xl border border-[#2d2d44] transition-all text-xs flex items-center gap-1"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingCertificates ? 'animate-spin' : ''}`} />
              <span>Actualizar</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-[#0a0a0f] text-slate-400 uppercase font-mono text-[10px] border-b border-[#2d2d44]">
                <tr>
                  <th className="py-3 px-4">Código Único</th>
                  <th className="py-3 px-4">Graduado</th>
                  <th className="py-3 px-4">Programa</th>
                  <th className="py-3 px-4">Emisión</th>
                  <th className="py-3 px-4">Estado</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2d2d44]/50">
                {certificates.map((cert) => (
                  <tr key={cert.id} className="hover:bg-[#1a1a2e]/50 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-amber-400">
                      {cert.verificationCode}
                    </td>
                    <td className="py-3 px-4 font-semibold text-white">
                      {cert.recipientName}
                      {cert.userEmail && <span className="block text-[10px] text-slate-500 font-normal">{cert.userEmail}</span>}
                    </td>
                    <td className="py-3 px-4 text-slate-300">{cert.courseTitle}</td>
                    <td className="py-3 px-4 text-slate-400">
                      {new Date(cert.issuedAt).toLocaleDateString('es-ES')}
                    </td>
                    <td className="py-3 px-4">
                      {cert.revokedAt ? (
                        <span className="px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/30 text-[10px] font-bold">
                          Revocado
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold">
                          Válido
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {!cert.revokedAt && (
                        revokingCertId === cert.id ? (
                          <div className="flex items-center gap-1 justify-end">
                            <input
                              type="text"
                              placeholder="Motivo..."
                              value={revokeReason}
                              onChange={(e) => setRevokeReason(e.target.value)}
                              className="bg-[#0a0a0f] border border-[#2d2d44] px-2 py-1 rounded text-[10px] text-white w-32"
                            />
                            <button
                              onClick={() => handleRevokeCertificate(cert.id)}
                              className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-[10px] font-bold"
                            >
                              Confirmar
                            </button>
                            <button
                              onClick={() => setRevokingCertId(null)}
                              className="px-1 py-1 text-slate-400 hover:text-white text-[10px]"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              setRevokingCertId(cert.id);
                              setRevokeReason('');
                            }}
                            className="px-2.5 py-1 rounded bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-[10px] font-bold"
                          >
                            Revocar
                          </button>
                        )
                      )}
                    </td>
                  </tr>
                ))}
                {certificates.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500">
                      No se han emitido certificados todavía.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB: RECURSOS DESCARGABLES (RESOURCES) */}
      {activeTab === 'resources' && (
        <div className="space-y-6 animate-fade-in">
          {/* El recurso se cuelga de un curso concreto; elegirlo va primero. */}
          {courseScopeBar}

          {/* Agregar Recurso */}
          <div className="bg-[#141420] border border-[#2d2d44] rounded-2xl p-6 shadow-xl space-y-4">
            <h3 className="text-base font-extrabold text-white flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-cyan-400" />
              <span>Agregar Recurso Descargable Protegido</span>
            </h3>
            <p className="text-xs text-slate-400">
              Material complementario (guías, PDF, repositorios o archivos ZIP) para
              «{workCourse.title}». La URL privada queda protegida y sólo será accesible mediante
              token de sesión autorizado.
            </p>

            {resSuccessMsg && (
              <div className="p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-xl text-cyan-400 text-xs font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" /> {resSuccessMsg}
              </div>
            )}

            {resErrorMsg && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300 text-xs flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-px" /> <span>{resErrorMsg}</span>
              </div>
            )}

            <form onSubmit={handleAddResource} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
              <div>
                <label className="text-[11px] font-bold text-slate-400 block mb-1">Título del Recurso</label>
                <input
                  type="text"
                  placeholder="Ej. Guía de Arquitectura.pdf"
                  value={resTitle}
                  onChange={(e) => setResTitle(e.target.value)}
                  className="w-full bg-[#0a0a0f] border border-[#2d2d44] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#06b6d4]"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-400 block mb-1">URL Privada / Archivo</label>
                <input
                  type="url"
                  placeholder="https://drive.google.com/..."
                  value={resPrivateUrl}
                  onChange={(e) => setResPrivateUrl(e.target.value)}
                  className="w-full bg-[#0a0a0f] border border-[#2d2d44] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#06b6d4]"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-400 block mb-1">Asignar a Módulo</label>
                <select
                  value={resModuleId}
                  onChange={(e) => setResModuleId(e.target.value)}
                  className="w-full bg-[#0a0a0f] border border-[#2d2d44] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#06b6d4]"
                >
                  <option value="">General del Curso</option>
                  {workModules.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.title}
                    </option>
                  ))}
                </select>
              </div>

              <button type="submit" className="btn-brand-primary py-2 px-4 text-xs font-bold flex items-center justify-center gap-1.5 h-[38px]">
                <Plus className="w-4 h-4" /> Agregar Recurso
              </button>
            </form>
          </div>

          {/* Lista de Recursos Existentes */}
          <div className="bg-[#141420] border border-[#2d2d44] rounded-2xl p-6 shadow-xl space-y-4">
            <h3 className="text-base font-extrabold text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#06b6d4]" />
              <span>Recursos de «{workCourse.title}» ({workResources.length})</span>
            </h3>

            <div className="space-y-2 max-h-[32rem] overflow-y-auto">
              {workResources.length > 0 ? (
                workResources.map(({ resource, moduleTitle }) => (
                  <div key={resource.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-[#0a0a0f] border border-[#2d2d44]">
                    <div className="flex items-center gap-3 min-w-0">
                      <Download className="w-4 h-4 text-cyan-400 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-white truncate">{resource.title}</p>
                        <span className="text-[10px] text-slate-500 font-mono truncate block">
                          {moduleTitle || 'General del Curso'} • {resource.kind} • {resource.downloadUrl}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteResource(resource.id)}
                      className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-500 py-4 text-center">Este curso todavía no tiene recursos.</p>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};


