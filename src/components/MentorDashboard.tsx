/**
 * Panel de Control para Mentores (`MentorDashboard.tsx`)
 * Academia Giantucchi
 *
 * Permite a los usuarios con rol MENTOR (y ADMIN):
 * 1. Crear y estructurar Cursos, Módulos y videos de Google Drive
 * 2. Gestionar y revisar el progreso individual de Mentees asignados
 * 3. Responder dudas e interactuar en el Centro de Preguntas Q&A
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowUpRight,
  UsersRound,
  LockKeyhole,
  LockKeyholeOpen,
  BookOpen,
  Plus,
  MessageSquare,
  CheckCircle2,
  Check,
  Users,
  Clock,
  Send,
  AlertCircle,
  Loader2,
  RefreshCw,
  Inbox,
  GraduationCap,
  Search,
  X,
  Globe,
  Lock,
  Video,
  Radio,
  Youtube,
  Download,
  ChevronRight,
  ChevronDown,
} from 'lucide-react';
import { MeetingManager } from './MeetingManager';
import { CourseCardDescription } from './CourseCardDescription';
import { MenteeCoursesDialog } from './MenteeCoursesDialog';
import { QuizCourseSheet } from './QuizCourseSheet';
import { courseHue } from '../lib/courseHue';
import { stripEmoji } from '../lib/stripEmoji';
import { relativeTime } from './notifications/NotificationBell';
import { avatarSrc } from '../lib/avatar.js';
import { api, type AppNotification } from '../lib/api';
import { patchCourseCard, type CourseCardPatch } from '../lib/courseCardUpdate';
import { filterCoursesByPublication, type CoursePublicationFilter } from '../lib/coursePublication';
import { MENTOR_QNA_EVENT, MENTOR_TAB_STORAGE_KEY, NOTIFICATION_EVENT } from '../lib/useNotifications';
import { Course, Module, User, MenteeStudent, MenteeCandidate, MentorshipComment, QuizQuestion, CourseAccessRequest } from '../types';
import { QuizManagerModal } from './QuizManagerModal';
import { getModuleQuestions, syncModuleQuizzes } from '../plugins/QuizzesPlugin';
import { COURSE_CATEGORIES } from './CourseManagerView';
import { MENTORSHIP_CATEGORIES, TECHNICAL_CATEGORIES } from '../lib/courseCategories';
import { Sparkles, CheckSquare, Layers } from 'lucide-react';
import { YouTubeCourseBuilder } from './YouTubeCourseBuilder';
import i18next from 'i18next'
import { formatPrice } from '../i18n/format';

interface MentorDashboardProps {
  currentUser: User;
  courses: Course[];
  onRefreshCourses: () => void;
  onCourseUpdated?: (courseId: string, patch: CourseCardPatch) => void;
}

const MENTOR_TABS = ['courses', 'mentees', 'qna', 'meetings', 'quizzes', 'youtube-builder'] as const;
type MentorTab = (typeof MENTOR_TABS)[number];

/** La fecha cruda ISO del servidor no se lee; en la bandeja importa el cuándo. */
function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** «hace 2 h» hasta un mes; más allá, la fecha. */
function askedAt(value: string): string {
  const age = Date.now() - new Date(value).getTime();
  return Number.isNaN(age) || age > 30 * 24 * 3600 * 1000 ? formatDate(value) : relativeTime(value);
}

/** De qué clase salió la consulta, dicho en una línea. */
function questionOrigin(comment: MentorshipComment): string {
  const parts = [comment.courseTitle, comment.moduleTitle, comment.videoTitle].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : i18next.t('claseNoIdentificada', 'Clase no identificada');
}

export const MentorDashboard: React.FC<MentorDashboardProps> = ({
  currentUser,
  courses,
  onRefreshCourses,
  onCourseUpdated,
}) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<MentorTab>(() => {
    // Al abrir un aviso de pregunta nueva se entra directo a las consultas.
    try {
      if (sessionStorage.getItem(MENTOR_TAB_STORAGE_KEY) === 'qna') {
        sessionStorage.removeItem(MENTOR_TAB_STORAGE_KEY);
        return 'qna';
      }
    } catch {
      // Sin almacenamiento se queda en la pestaña por defecto.
    }
    // Al recargar se vuelve a la pestaña de la URL, no a la de por defecto.
    const fromUrl = typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('tab');
    return MENTOR_TABS.find(tab => tab === fromUrl) ?? 'courses';
  });
  const [selectedQuizModule, setSelectedQuizModule] = useState<Module | null>(null);
  const [quizQuery, setQuizQuery] = useState<string>('');
  const [quizFilter, setQuizFilter] = useState<'all' | 'without' | 'complete'>('all');
  const [quizLimit, setQuizLimit] = useState<number>(12);
  const [quizSheetCourseId, setQuizSheetCourseId] = useState<string | null>(null);
  const [quizzesMap, setQuizzesMap] = useState<Record<string, QuizQuestion[]>>({});

  // Cursos asignados estrictamente a este mentor (Principio de Menor Privilegio)
  const [scopedCourses, setScopedCourses] = useState<Course[]>(courses || []);
  const [loadingScopedCourses, setLoadingScopedCourses] = useState<boolean>(currentUser.role === 'MENTOR');

  const loadScopedCourses = useCallback(async () => {
    if (currentUser.role !== 'MENTOR') {
      setScopedCourses(courses || []);
      setLoadingScopedCourses(false);
      return;
    }
    setLoadingScopedCourses(true);
    try {
      const res = await api.getMentorCourses();
      setScopedCourses(res.courses || []);
    } catch (err) {
      console.error('Error al cargar cursos asignados al mentor:', err);
    } finally {
      setLoadingScopedCourses(false);
    }
  }, [currentUser.role, courses]);

  useEffect(() => {
    loadScopedCourses();
  }, [loadScopedCourses]);

  const displayCourses = scopedCourses;
  const [publicationFilter, setPublicationFilter] = useState<CoursePublicationFilter>('all');
  const [courseQuery, setCourseQuery] = useState<string>('');
  const courseNeedle = courseQuery.trim().toLowerCase();
  const visibleCourses = filterCoursesByPublication(displayCourses, publicationFilter)
    .filter(course => !courseNeedle || course.title.toLowerCase().includes(courseNeedle));
  const publicationCounts = {
    all: displayCourses.length,
    published: displayCourses.filter(course => course.published).length,
    draft: displayCourses.filter(course => !course.published).length,
  };
  const [courseNotices, setCourseNotices] = useState<Record<string, { error?: boolean; message: string }>>({});

  const updateCourseCard = (courseId: string, patch: CourseCardPatch) => {
    setScopedCourses(previous => patchCourseCard(previous, courseId, patch));
    onCourseUpdated?.(courseId, patch);
  };

  useEffect(() => {
    loadAllQuizzes();
  }, []);

  // La pestaña queda en la URL (?tab=) para que recargar no devuelva a Cursos.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get('tab') === activeTab) return;
    url.searchParams.set('tab', activeTab);
    window.history.replaceState(window.history.state, '', url);
  }, [activeTab]);

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

  /**
   * Reparto de cursos. El mismo selector sirve en los dos sentidos: desde un
   * curso se marcan mentees, y desde un mentee se marcan cursos. Lo que cambia
   * es `rosterMode`; la lista marcada siempre es `rosterSelection`.
   */
  const [rosterMode, setRosterMode] = useState<'course' | 'mentee' | null>(null);
  const [rosterCourse, setRosterCourse] = useState<Course | null>(null);
  const [rosterMentee, setRosterMentee] = useState<MenteeStudent | null>(null);
  const [rosterSelection, setRosterSelection] = useState<string[]>([]);
  const [rosterQuery, setRosterQuery] = useState<string>('');
  const [candidates, setCandidates] = useState<MenteeCandidate[]>([]);
  const [savingRoster, setSavingRoster] = useState<boolean>(false);
  const [rosterError, setRosterError] = useState<string>('');

  /** Curso al que entra un mentee recién dado de alta. */
  const [newMenteeCourseId, setNewMenteeCourseId] = useState<string>('');

  // Mentees State
  const [mentees, setMentees] = useState<MenteeStudent[]>([]);
  const [loadingMentees, setLoadingMentees] = useState<boolean>(true);
  const [menteeQuery, setMenteeQuery] = useState<string>('');
  const [menteeFilter, setMenteeFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [menteeLimit, setMenteeLimit] = useState<number>(12);
  const [detailMenteeId, setDetailMenteeId] = useState<string | null>(null);
  const [showAssignMenteeModal, setShowAssignMenteeModal] = useState<boolean>(false);
  const [newMenteeName, setNewMenteeName] = useState<string>('');
  const [newMenteeEmail, setNewMenteeEmail] = useState<string>('');
  const [assigningMentee, setAssigningMentee] = useState<boolean>(false);
  const [assignError, setAssignError] = useState<string>('');

  // Course Creation State
  const [showCreateCourseModal, setShowCreateCourseModal] = useState<boolean>(false);
  const [newCourseTitle, setNewCourseTitle] = useState<string>('');
  const [newCourseDescription, setNewCourseDescription] = useState<string>('');
  const [newCoursePrice, setNewCoursePrice] = useState<number>(149);
  const [newCourseCategory, setNewCourseCategory] = useState<string>('Mentoría Elite');
  const [newCoursePublished, setNewCoursePublished] = useState<boolean>(false);
  const [creatingCourse, setCreatingCourse] = useState<boolean>(false);
  const [createCourseError, setCreateCourseError] = useState<string>('');
  const [publishingCourseId, setPublishingCourseId] = useState<string | null>(null);

  const handlePublishMentorCourse = async (courseId: string) => {
    try {
      setPublishingCourseId(courseId);
      setCourseNotices(previous => ({ ...previous, [courseId]: { message: '' } }));
      const published = await api.youtube.publishCourse(courseId, true);
      if (!published) throw new Error(t('mentor.publishFailed', 'No se pudo publicar el curso'));
      updateCourseCard(courseId, { published: true });
      setCourseNotices(previous => ({ ...previous, [courseId]: { message: t('mentor.publishSaved', 'Curso publicado') } }));
    } catch (err: any) {
      setCourseNotices(previous => ({ ...previous, [courseId]: { error: true, message: err?.message || t('mentor.publishFailed', 'No se pudo publicar el curso') } }));
    } finally {
      setPublishingCourseId(null);
    }
  };

  // Q&A State
  const [qnaComments, setQnaComments] = useState<MentorshipComment[]>([]);
  const [loadingQna, setLoadingQna] = useState<boolean>(true);
  const [qnaError, setQnaError] = useState<string>('');
  const [qnaFilter, setQnaFilter] = useState<'pending' | 'resolved'>('pending');
  const [replyTextMap, setReplyTextMap] = useState<Record<string, string>>({});
  const [replyingId, setReplyingId] = useState<string | null>(null);
  const [replyErrorMap, setReplyErrorMap] = useState<Record<string, string>>({});
  const [qnaQuery, setQnaQuery] = useState<string>('');
  const [qnaLimit, setQnaLimit] = useState<number>(10);
  // Respondida en esta sesión: se queda a la vista como «Resuelta» en vez de desaparecer de Pendientes.
  const [answeredIds, setAnsweredIds] = useState<Set<string>>(() => new Set());
  const [openThreads, setOpenThreads] = useState<Set<string>>(() => new Set());
  const [openReplies, setOpenReplies] = useState<Set<string>>(() => new Set());

  const [accessRequests, setAccessRequests] = useState<CourseAccessRequest[]>([]);
  const [loadingRequests, setLoadingRequests] = useState<boolean>(false);
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(null);

  // Mensaje de confirmación compartido por las acciones de la cabecera.
  const [actionNotice, setActionNotice] = useState<string>('');

  /** Curso cuyo interruptor de apertura se está guardando ahora mismo. */
  const [openingCourseId, setOpeningCourseId] = useState<string | null>(null);

  useEffect(() => {
    loadMenteesData();
    loadAccessRequests();
    loadQnaData();
  }, []);

  // Tiempo real: una pregunta nueva recarga la bandeja sin refrescar la página.
  useEffect(() => {
    const onNotification = (event: Event) => {
      const detail = (event as CustomEvent<AppNotification>).detail;
      if (detail?.type === 'qna.question') loadQnaData();
    };
    const onOpenQna = () => {
      setActiveTab('qna');
      loadQnaData();
    };
    window.addEventListener(NOTIFICATION_EVENT, onNotification);
    window.addEventListener(MENTOR_QNA_EVENT, onOpenQna);
    return () => {
      window.removeEventListener(NOTIFICATION_EVENT, onNotification);
      window.removeEventListener(MENTOR_QNA_EVENT, onOpenQna);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const announce = (message: string) => {
    setActionNotice(message);
    setTimeout(() => setActionNotice(''), 4000);
  };

  const loadAccessRequests = async () => {
    try {
      setLoadingRequests(true);
      const res = await api.getMentorAccessRequests();
      if (res?.requests) {
        setAccessRequests(res.requests);
      }
    } catch (error) {
      console.error('Error al cargar solicitudes de acceso:', error);
    } finally {
      setLoadingRequests(false);
    }
  };

  const handleApproveRequest = async (requestId: string) => {
    try {
      setProcessingRequestId(requestId);
      const res = await api.approveCourseAccessRequest(requestId);
      announce(res.message || t('accesoAprobadoExitosamente', 'Acceso aprobado exitosamente'));
      await Promise.all([loadAccessRequests(), loadMenteesData()]);
      onRefreshCourses();
    } catch (error: any) {
      announce(error?.message || t('errorAlAprobarSolicitud', 'Error al aprobar solicitud'));
    } finally {
      setProcessingRequestId(null);
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    try {
      setProcessingRequestId(requestId);
      const res = await api.rejectCourseAccessRequest(requestId);
      announce(res.message || 'Solicitud rechazada');
      await loadAccessRequests();
    } catch (error: any) {
      announce(error?.message || t('errorAlRechazarSolicitud', 'Error al rechazar solicitud'));
    } finally {
      setProcessingRequestId(null);
    }
  };

  /**
   * Abre o cierra un curso a todo el mundo que tenga cuenta.
   *
   * Es la única excepción a la regla de la casa —el acceso lo reparte
   * administración, persona a persona— y por eso se pide en voz alta desde
   * aquí, en vez de deducirse del precio como se hacía antes. Solo ADMIN ve el
   * botón, y el servidor lo vuelve a exigir: la ruta es `requireRole(['ADMIN'])`.
   */
  const toggleOpenToAll = async (course: Course) => {
    const openToAllRegistered = !course.openToAllRegistered;
    setOpeningCourseId(course.id);
    setCourseNotices(previous => ({ ...previous, [course.id]: { message: '' } }));
    try {
      await api.updateCourse(course.id, { openToAllRegistered });
      updateCourseCard(course.id, { openToAllRegistered });
      setCourseNotices(previous => ({ ...previous, [course.id]: { message: t('mentor.accessSaved', 'Acceso actualizado') } }));
    } catch (error: any) {
      setCourseNotices(previous => ({ ...previous, [course.id]: { error: true, message: error?.message || t('mentor.accessFailed', 'No se pudo cambiar el acceso') } }));
    } finally {
      setOpeningCourseId(null);
    }
  };

  const loadMenteesData = async () => {
    try {
      setLoadingMentees(true);
      const res = await api.getMentorMentees();
      if (res.mentees) {
        setMentees(res.mentees);
      }
    } catch (error) {
      console.error('Error al cargar mentees:', error);
    } finally {
      setLoadingMentees(false);
    }
  };

  /**
   * La bandeja lee `/api/mentor/qna`, que recorre todo el catálogo.
   *
   * Antes pedía los comentarios de un único video fijo (`video-intro-01`) que
   * ni siquiera existe en la base: el centro de consultas salía siempre vacío
   * por muchas preguntas que hubiera publicado el alumnado.
   */
  const loadQnaData = async () => {
    setLoadingQna(true);
    setQnaError('');
    try {
      const res = await api.getMentorQna();
      setQnaComments(res.comments || []);
    } catch (error: any) {
      console.error('Error al cargar preguntas:', error);
      setQnaError(error?.message || t('noSePudieronCargarLasConsultas', 'No se pudieron cargar las consultas.'));
    } finally {
      setLoadingQna(false);
    }
  };

  /** Quién está ya en un curso, para marcar las casillas al abrir. */
  const menteesOfCourse = (courseId: string) =>
    mentees.filter((m) => m.courses.some((c) => c.courseId === courseId)).map((m) => m.id);

  const openCourseRoster = async (course: Course) => {
    setRosterMode('course');
    setRosterCourse(course);
    setRosterMentee(null);
    setRosterSelection(menteesOfCourse(course.id));
    setRosterQuery('');
    setRosterError('');
    try {
      const res = await api.getMenteeCandidates();
      setCandidates(res.candidates || []);
    } catch (error: any) {
      setRosterError(error?.message || t('noSePudoCargarLaListaDeMentees', 'No se pudo cargar la lista de mentees.'));
    }
  };

  const openMenteeRoster = (mentee: MenteeStudent) => {
    setRosterMode('mentee');
    setRosterMentee(mentee);
    setRosterCourse(null);
    setRosterSelection(mentee.courses.map((c) => c.courseId));
    setRosterQuery('');
    setRosterError('');
  };

  const rosterRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = rosterRef.current;
    if (rosterMode && d && !d.open) d.showModal();
  }, [rosterMode]);

  const closeRoster = () => {
    setRosterMode(null);
    setRosterCourse(null);
    setRosterMentee(null);
    setRosterSelection([]);
    setRosterError('');
  };

  const toggleRosterItem = (id: string) => {
    setRosterSelection((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  /**
   * Guarda el reparto. Se manda la lista completa, no un «añade este»: el
   * servidor deja el curso (o el mentee) exactamente con lo marcado, así que
   * desmarcar retira la asignación en el mismo paso.
   */
  const handleSaveRoster = async () => {
    setSavingRoster(true);
    setRosterError('');
    try {
      const res =
        rosterMode === 'course' && rosterCourse
          ? await api.setCourseMentees(rosterCourse.id, rosterSelection)
          : rosterMentee
            ? await api.setMenteeCourses(rosterMentee.id, rosterSelection)
            : null;
      if (!res) return;
      setMentees(res.mentees);
      const partes = [];
      // «asignación» pierde la tilde en plural: asignaciones, no asignaciónes.
      if (res.added > 0) {
        partes.push(t('countAsignacionesNuevas', { defaultValue_one: '1 asignación nueva', defaultValue_other: '{{count}} asignaciones nuevas', count: res.added }));
      }
      if (res.reactivated > 0) {
        partes.push(t('countAccesosReactivados', { defaultValue_one: '1 acceso reactivado', defaultValue_other: '{{count}} accesos reactivados', count: res.reactivated }));
      }
      if (res.removed > 0) {
        partes.push(t('countRetiradas', { defaultValue_one: '1 retirada', defaultValue_other: '{{count}} retiradas', count: res.removed }));
      }
      let aviso = partes.length > 0 ? partes.join(t('y', ' y ')) + '.' : t('noHabiaCambiosQueGuardar', 'No había cambios que guardar.');
      // El servidor descarta lo que no cumple la regla; decirlo evita que
      // alguien crea que asignó a una persona que en realidad quedó fuera.
      if (res.ignored > 0) aviso += t('ignoredNoSePudoAplicar', '{{ignored}} no se pudo aplicar.', { ignored: res.ignored });
      // Retirar la mentoría no quita una matrícula pagada ni una dada de alta a
      // mano: si alguien sigue entrando al curso por esa vía, se dice.
      if (res.stillHaveAccess.length > 0) {
        aviso += t('ojoStillHaveAccessConservaElAccesoPor', 'Ojo: {{stillHaveAccess}} conserva el acceso por matrícula o pago.', { stillHaveAccess: res.stillHaveAccess.join(', ') });
      }
      announce(aviso);
      closeRoster();
    } catch (error: any) {
      setRosterError(error?.message || t('noSePudoGuardarElReparto', 'No se pudo guardar el reparto.'));
    } finally {
      setSavingRoster(false);
    }
  };

  const handleAssignMenteeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMenteeName.trim() || !newMenteeEmail.trim()) return;

    setAssigningMentee(true);
    setAssignError('');
    try {
      const res = await api.assignMentee(
        newMenteeName.trim(),
        newMenteeEmail.trim(),
        currentUser.id,
        newMenteeCourseId || undefined,
      );
      setNewMenteeName('');
      setNewMenteeEmail('');
      setShowAssignMenteeModal(false);
      // A una cuenta que ya existía no se le pisa el nombre, así que el aviso
      // usa el que está guardado y no el que se acaba de teclear.
      const nombre = res.mentee?.name || newMenteeName.trim();
      announce(
        res.reactivated
          ? t('nombreAccesoReactivadoConservandoSu', '{{nombre}}: acceso reactivado, conservando su progreso.', { nombre })
          : res.existed
          ? t('nombreYaTeniaCuentaQuedaAsignadoATu', '{{nombre}} ya tenía cuenta: queda asignado a tu mentoría sin tocarle el perfil.', { nombre })
          : t('nombreQuedaAsignadoATuMentoria', '{{nombre}} queda asignado a tu mentoría.', { nombre }),
      );
      // Si el alta se hizo desde el selector del curso, este se queda abierto
      // detras. Hay que refrescar la lista y dejar marcada a la persona: lo
      // que no esta marcado se retira al guardar, asi que sin esto «Guardar
      // cambios» deshacia la asignacion recien creada.
      if (rosterMode === 'course' && res.mentee?.id) {
        const nuevoId = res.mentee.id as string;
        setRosterSelection((previa) => (previa.includes(nuevoId) ? previa : [...previa, nuevoId]));
        try {
          const lista = await api.getMenteeCandidates();
          setCandidates(lista.candidates || []);
        } catch {
          // La asignacion ya esta hecha en el servidor; no poder repintar la
          // lista no la invalida.
        }
      }
      loadMenteesData();
    } catch (error: any) {
      // El servidor rechaza con un motivo concreto (cuenta administrativa,
      // cuenta desactivada, permisos). Tragárselo dejaba el formulario
      // aparentemente muerto: se pulsaba «Asignar» y no ocurría nada.
      setAssignError(error?.message || t('noSePudoAsignarElMentee', 'No se pudo asignar el mentee.'));
    } finally {
      setAssigningMentee(false);
    }
  };

  /**
   * Alta de un programa nuevo.
   *
   * El botón de la cabecera abría un estado que ningún modal leía, así que no
   * pasaba nada al pulsarlo. El curso nace sin publicar salvo que se marque:
   * publicar uno vacío lo pone en el escaparate sin una sola clase dentro.
   */
  const handleCreateCourseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCourseTitle.trim()) return;

    setCreatingCourse(true);
    setCreateCourseError('');
    try {
      await api.createCourse({
        title: newCourseTitle.trim(),
        description: newCourseDescription.trim(),
        price: newCoursePrice,
        category: newCourseCategory.trim() || 'Mentoría Elite',
        published: newCoursePublished,
      });
      setNewCourseTitle('');
      setNewCourseDescription('');
      setNewCoursePrice(149);
      setNewCourseCategory('Mentoría Elite');
      setNewCoursePublished(false);
      setShowCreateCourseModal(false);
      setActiveTab('courses');
      announce(t('programaCreadoAnadeleModulosYClasesDesde', 'Programa creado. Añádele módulos y clases desde Administración › Cursos.'));
      onRefreshCourses();
    } catch (error: any) {
      setCreateCourseError(error?.message || t('noSePudoCrearElPrograma', 'No se pudo crear el programa.'));
    } finally {
      setCreatingCourse(false);
    }
  };

  const handleReplySubmit = async (commentId: string) => {
    const replyText = replyTextMap[commentId];
    if (!replyText || !replyText.trim()) return;

    setReplyingId(commentId);
    setReplyErrorMap((prev) => ({ ...prev, [commentId]: '' }));
    try {
      await api.replyToComment(commentId, replyText.trim());
      setReplyTextMap((prev) => ({ ...prev, [commentId]: '' }));
      setAnsweredIds((prev) => new Set(prev).add(commentId));
      setOpenReplies((prev) => { const next = new Set(prev); next.delete(commentId); return next; });
      setOpenThreads((prev) => new Set(prev).add(commentId));
      announce('Respuesta enviada');
      loadQnaData();
    } catch (error: any) {
      setReplyErrorMap((prev) => ({
        ...prev,
        [commentId]: error?.message || t('noSePudoEnviarLaRespuesta', 'No se pudo enviar la respuesta.'),
      }));
    } finally {
      setReplyingId(null);
    }
  };

  const pendingQuestions = qnaComments.filter((c) => !c.isResolved);
  const resolvedQuestions = qnaComments.filter((c) => c.isResolved);
  const visibleQuestions = qnaFilter === 'pending' ? pendingQuestions : resolvedQuestions;
  const answeredPct =
    qnaComments.length > 0
      ? Math.round(((qnaComments.length - pendingQuestions.length) / qnaComments.length) * 100)
      : 0;

  return (
    <div
      data-mentor-ui="modern"
      className="academy-mentor-dashboard mentor-workspace animate-backdrop-fade min-h-screen bg-canvas text-ink px-4 sm:px-6 lg:px-8 py-6 space-y-6 w-full max-w-7xl mx-auto overflow-x-hidden"
    >

      <section className="mentor-command-header" aria-labelledby="mentor-workspace-title">
        <div className="mentor-header-main">
          <h1 id="mentor-workspace-title">{t('mentor.workspaceTitle', 'Mentoría')}</h1>
          <p>{t('mentor.workspaceDescription', 'Cursos y mentees a tu cargo')}</p>
          <button
            type="button"
            className="mentor-review-button"
            disabled={loadingQna}
            onClick={() => {
              if (qnaError) {
                loadQnaData();
              } else {
                setQnaFilter('pending');
                setActiveTab('qna');
              }
            }}
          >
            {qnaError ? t('mentor.retryInbox', 'Reintentar carga') : t('mentor.reviewInbox', 'Revisar consultas')}
            {loadingQna ? <Loader2 aria-hidden="true" className="animate-spin" /> : <ArrowUpRight aria-hidden="true" />}
          </button>
        </div>
        <div className="mentor-priority-card" data-state={loadingQna ? 'loading' : qnaError ? 'error' : pendingQuestions.length > 0 ? 'pending' : 'clear'}>
          <span className="mentor-inbox-label">{t('mentor.inboxLabel', 'Consultas')}</span>
          <strong role="status" aria-live="polite">
            {loadingQna
              ? t('mentor.inboxLoading', 'Cargando consultas…')
              : qnaError
                ? t('mentor.inboxUnavailable', 'No se pudieron cargar')
                : pendingQuestions.length === 0
                  ? t('mentor.inboxClear', 'Sin consultas pendientes')
                  : t('mentor.inboxPending', {
                      count: pendingQuestions.length,
                      defaultValue: pendingQuestions.length === 1 ? '1 consulta por responder' : `${pendingQuestions.length} consultas por responder`,
                    })}
          </strong>
        </div>
      </section>

      {actionNotice && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-success-light text-xs font-bold rounded-xl flex items-center gap-2 animate-fade-in">
          <CheckCircle2 className="w-4 h-4" /> {actionNotice}
        </div>
      )}

      {/* Statistics Cards */}
      <div className="mentor-stat-grid grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[
          { title: currentUser.role === 'MENTOR' ? t('mentor.assignedPrograms', 'Programas Asignados') : t('mentor.catalogPrograms', 'Programas del Catálogo'), value: displayCourses.length, icon: BookOpen, color: 'text-[var(--color-brand-cyan)]' },
          { title: t('mentor.assignedMentees', 'Mentees Asignados'), value: mentees.length, icon: Users, color: 'text-[#a855f7]' },
          {
            title: t('mentor.answeredQuestions', 'Consultas Respondidas'),
            value: qnaComments.length > 0 ? `${answeredPct}%` : '—',
            icon: CheckCircle2,
            color: 'text-success-light',
          },
          {
            title: t('mentor.pendingQuestions', 'Consultas Pendientes'),
            value: pendingQuestions.length,
            icon: Clock,
            color: 'text-warning-light',
          },
        ].map((card, idx) => {
          const Icon = card.icon;
          return (
            <div key={idx} className="mentor-stat-card bg-surface border border-line p-3 sm:p-5 rounded-2xl flex items-center justify-between min-w-0">
              <div className="min-w-0 pr-1">
                <span className="text-[10px] sm:text-[11px] font-medium text-ink-muted block truncate">
                  {card.title}
                </span>
                <span className="text-xl sm:text-2xl font-semibold text-ink mt-1 block tabular-nums">
                  {card.value}
                </span>
              </div>
              <div className={`p-2.5 sm:p-3 rounded-xl bg-raised border border-line ${card.color} shrink-0`}>
                <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Mentor Navigation Tabs */}
      <nav aria-label={t('modulosDeMentoria', 'Módulos de mentoría')} className="mentor-module-nav grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-1.5 p-1.5 bg-raised border border-line rounded-2xl">
        <button
          aria-current={activeTab === 'courses' ? 'page' : undefined}
          onClick={() => setActiveTab('courses')}
          className={`shrink-0 whitespace-nowrap pb-2.5 px-2.5 sm:px-3.5 font-medium text-xs flex items-center gap-1.5 sm:gap-2 border-b-2 transition-colors cursor-pointer ${
            activeTab === 'courses'
              ? 'border-[var(--color-brand-cyan)] text-[var(--color-brand-cyan)]'
              : 'border-transparent text-ink-muted hover:text-ink'
          }`}
        >
          <BookOpen className="w-4 h-4 shrink-0" />
          <span>{t('mentor.tabCourses', 'Gestión de Cursos')} ({displayCourses.length})</span>
        </button>

        <button
          aria-current={activeTab === 'mentees' ? 'page' : undefined}
          onClick={() => setActiveTab('mentees')}
          className={`shrink-0 whitespace-nowrap pb-2.5 px-2.5 sm:px-3.5 font-medium text-xs flex items-center gap-1.5 sm:gap-2 border-b-2 transition-colors cursor-pointer ${
            activeTab === 'mentees'
              ? 'border-[var(--color-brand-cyan)] text-[var(--color-brand-cyan)]'
              : 'border-transparent text-ink-muted hover:text-ink'
          }`}
        >
          <Users className="w-4 h-4 shrink-0" />
          <span>{t('mentor.tabMentees', 'Mentees Asignados')} ({mentees.length})</span>
          {accessRequests.length > 0 && (
            <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/20 text-warning-light border border-amber-500/30">
              {accessRequests.length} {accessRequests.length === 1 ? t('mentor.requestSingular', 'solicitud') : t('mentor.requestPlural', 'solicitudes')}
            </span>
          )}
        </button>

        <button
          aria-current={activeTab === 'qna' ? 'page' : undefined}
          onClick={() => setActiveTab('qna')}
          className={`shrink-0 whitespace-nowrap pb-2.5 px-2.5 sm:px-3.5 font-medium text-xs flex items-center gap-1.5 sm:gap-2 border-b-2 transition-colors cursor-pointer ${
            activeTab === 'qna'
              ? 'border-[var(--color-brand-cyan)] text-[var(--color-brand-cyan)]'
              : 'border-transparent text-ink-muted hover:text-ink'
          }`}
        >
          <MessageSquare className="w-4 h-4 shrink-0" />
          <span>{t('mentor.tabQna', 'Consultas Q&A')} ({pendingQuestions.length})</span>
        </button>

        <button
          aria-current={activeTab === 'meetings' ? 'page' : undefined}
          onClick={() => setActiveTab('meetings')}
          className={`shrink-0 whitespace-nowrap pb-2.5 px-2.5 sm:px-3.5 font-medium text-xs flex items-center gap-1.5 sm:gap-2 border-b-2 transition-colors cursor-pointer ${
            activeTab === 'meetings'
              ? 'border-[var(--color-brand-cyan)] text-[var(--color-brand-cyan)]'
              : 'border-transparent text-ink-muted hover:text-ink'
          }`}
        >
          <Video className="w-4 h-4 shrink-0" />
          <span>{t('mentor.tabMeetings', 'Clases en Vivo')}</span>
        </button>

        <button
          aria-current={activeTab === 'quizzes' ? 'page' : undefined}
          onClick={() => setActiveTab('quizzes')}
          className={`shrink-0 whitespace-nowrap pb-2.5 px-2.5 sm:px-3.5 font-medium text-xs flex items-center gap-1.5 sm:gap-2 border-b-2 transition-colors cursor-pointer ${
            activeTab === 'quizzes'
            ? 'border-brand-cyan text-ink'
            : 'border-transparent text-ink-muted hover:text-ink'
          }`}
        >
          <CheckSquare className="w-4 h-4 shrink-0" />
          <span>{t('mentor.tabQuizzes', 'Evaluaciones')}</span>
        </button>

        <button
          aria-current={activeTab === 'youtube-builder' ? 'page' : undefined}
          onClick={() => setActiveTab('youtube-builder')}
          className={`shrink-0 whitespace-nowrap pb-2.5 px-2.5 sm:px-3.5 font-medium text-xs flex items-center gap-1.5 sm:gap-2 border-b-2 transition-colors cursor-pointer ${
            activeTab === 'youtube-builder'
            ? 'border-brand-cyan text-ink'
            : 'border-transparent text-ink-muted hover:text-ink'
          }`}
        >
          <Youtube className="w-4 h-4 shrink-0" />
          <span>{t('mentor.tabYoutubeBuilder', 'Curso desde YouTube')}</span>
        </button>
      </nav>

      {/* Tab Content 1: Courses Management */}
      {activeTab === 'courses' && (
        <section className="mentor-courses-panel" aria-labelledby="mentor-courses-title">
          <div className="mentor-section-heading">
            <div>
              <h2 id="mentor-courses-title">{t('mentor.coursesTitle', 'Cursos')}</h2>
              <p>{t('mentor.coursesDescription', 'Publicación, acceso y mentees de cada curso')}</p>
            </div>
          </div>

          <div className="mentor-promo">
            <Youtube aria-hidden="true" />
            <div>
              <h3>{t('mentor.aiPromoTitle', 'Importar un curso')}</h3>
              <p>{t('mentor.aiPromoDesc', 'Usa una playlist de YouTube para crear el temario')}</p>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('youtube-builder')}
              className="mentor-course-control mentor-course-import"
            >
              <Download aria-hidden="true" />
              {t('mentor.aiPromoBtn', 'Importar desde YouTube')}
            </button>
          </div>

          <div className="mentor-course-toolbar">
            <label className="mentor-mentee-search">
              <Search aria-hidden="true" />
              <input
                type="search"
                value={courseQuery}
                onChange={(e) => setCourseQuery(e.target.value)}
                placeholder={t('mentor.courseSearch', 'Buscar curso')}
                aria-label={t('mentor.courseSearch', 'Buscar curso')}
              />
            </label>
            <div className="mentor-publication-filters" role="group" aria-label={t('mentor.publicationFilter', 'Filtrar por publicación')}>
              {(['all', 'published', 'draft'] as const).map(filter => (
                <button
                  key={filter}
                  type="button"
                  aria-pressed={publicationFilter === filter}
                  onClick={() => setPublicationFilter(filter)}
                >
                  <span>{filter === 'all'
                    ? t('mentor.publicationAll', 'Todos')
                    : filter === 'published'
                      ? t('mentor.filterPublished', 'Publicados')
                      : t('mentor.filterDrafts', 'Borradores')}</span>
                  <span className="mentor-publication-count">{publicationCounts[filter]}</span>
                </button>
              ))}
            </div>
            <span className="mentor-course-filter-result" role="status" aria-live="polite">
              {t('mentor.filterResults', { count: visibleCourses.length, total: displayCourses.length, defaultValue: `${visibleCourses.length} de ${displayCourses.length} cursos` })}
            </span>
          </div>

          {loadingScopedCourses && displayCourses.length === 0 ? (
            <div className="mentor-courses-empty" role="status">
              <Loader2 aria-hidden="true" className="animate-spin" />
              <p>{t('mentor.loadingCourses', 'Cargando tus cursos…')}</p>
            </div>
          ) : displayCourses.length === 0 ? (
            <div className="mentor-courses-empty">
              <BookOpen aria-hidden="true" />
              <p>
                {currentUser.role === 'MENTOR'
                  ? t('mentor.noCoursesMentor', 'Aún no tienes cursos asignados. Contacta con administración para empezar.')
                  : t('mentor.noCoursesAdmin', 'Aún no hay cursos. Puedes crearlos desde Administración › Cursos.')}
              </p>
            </div>
          ) : visibleCourses.length === 0 ? (
            <div className="mentor-courses-empty">
              <BookOpen aria-hidden="true" />
              <p>{publicationFilter === 'draft'
                ? t('mentor.noDraftCourses', 'No hay cursos en borrador')
                : t('mentor.noPublishedCourses', 'No hay cursos publicados')}</p>
              <button type="button" className="mentor-course-control" onClick={() => setPublicationFilter('all')}>
                {t('mentor.showAllCourses', 'Ver todos los cursos')}
              </button>
            </div>
          ) : (
            <div className="mentor-courses-grid">
              {visibleCourses.map((course) => (
                <article key={course.id} className="mentor-course-card" aria-labelledby={`mentor-course-${course.id}`}>
                  <div className="mentor-course-card__header">
                    <span className="mentor-course-card__category">{course.category}</span>
                    <span className="mentor-course-card__status" data-published={course.published}>
                      {course.published ? t('mentor.published', 'Publicado') : t('mentor.draft', 'Borrador')}
                    </span>
                  </div>

                  <div className="mentor-course-card__body">
                    <h3 id={`mentor-course-${course.id}`} className="mentor-course-card__title">
                      {course.title}
                    </h3>
                    {course.description && (
                      <CourseCardDescription text={course.description} />
                    )}
                  </div>

                  <div className="mentor-course-card__footer">
                    <span className="mentor-course-access-label" data-access={course.openToAllRegistered ? 'members' : 'assigned'}>
                      {course.openToAllRegistered ? <Globe aria-hidden="true" /> : <Lock aria-hidden="true" />}
                      {course.openToAllRegistered ? t('mentor.membersAccess', 'Acceso para miembros') : t('mentor.onlyAssigned', 'Solo asignados')}
                    </span>
                    <div className="mentor-course-card__meta">
                      <span>{t('mentor.modulesCount', { count: course.modules?.length || 0, defaultValue: `${course.modules?.length || 0} módulos` })}</span>
                      <span>{course.price > 0 ? `${formatPrice(course.price, course.currency)} ${(course.currency || 'USD').toUpperCase()}` : t('gratuito', 'Gratuito')}</span>
                    </div>
                    <div className="mentor-course-card__actions">
                      <button
                        type="button"
                        onClick={() => openCourseRoster(course)}
                        className="mentor-course-control mentor-course-roster"
                        aria-haspopup="dialog"
                        aria-label={t('mentor.manageCourseMentees', { title: course.title, defaultValue: `Gestionar mentees de ${course.title}` })}
                      >
                        <UsersRound aria-hidden="true" />
                        <span>{t('mentor.assignedMenteesBtn', { total: menteesOfCourse(course.id).length, defaultValue: `Gestionar (${menteesOfCourse(course.id).length})` })}</span>
                      </button>
                      {currentUser.role === 'ADMIN' && (
                        <button
                          type="button"
                          onClick={() => toggleOpenToAll(course)}
                          disabled={openingCourseId === course.id}
                          aria-pressed={Boolean(course.openToAllRegistered)}
                          aria-label={t('mentor.toggleMembersAccess', { title: course.title, defaultValue: `Acceso para miembros: ${course.title}` })}
                          aria-busy={openingCourseId === course.id}
                          className="mentor-course-control mentor-course-access"
                        >
                          {openingCourseId === course.id ? (
                            <Loader2 aria-hidden="true" className="animate-spin" />
                          ) : course.openToAllRegistered ? (
                            <LockKeyhole aria-hidden="true" />
                          ) : (
                            <LockKeyholeOpen aria-hidden="true" />
                          )}
                          <span>{course.openToAllRegistered ? t('mentor.restrictAccess', 'Solo asignados') : t('mentor.openMembers', 'Abrir a miembros')}</span>
                        </button>
                      )}
                    </div>
                    {!course.published ? (
                      <button
                        type="button"
                        onClick={() => handlePublishMentorCourse(course.id)}
                        disabled={publishingCourseId === course.id}
                        aria-busy={publishingCourseId === course.id}
                        className="mentor-course-control mentor-course-publish"
                      >
                        {publishingCourseId === course.id ? (
                          <Loader2 aria-hidden="true" className="animate-spin" />
                        ) : (
                          <BookOpen aria-hidden="true" />
                        )}
                        {t('mentor.publishCourseAction', 'Publicar en catálogo')}
                      </button>
                    ) : (
                      <span className="mentor-course-published-note">
                        <CheckCircle2 aria-hidden="true" />
                        {t('mentor.visibleInCatalog', 'Visible en el catálogo')}
                      </span>
                    )}
                    <p className="mentor-course-feedback" role="status" aria-live="polite" data-error={courseNotices[course.id]?.error || undefined}>
                      {courseNotices[course.id]?.message || ''}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Tab Content 2: Mentees Progress Monitoring */}
      {activeTab === 'mentees' && (
        <section className="mentor-mentees-panel" aria-labelledby="mentor-mentees-title">
          <div className="mentor-section-heading">
            <div>
              <h2 id="mentor-mentees-title">{t('mentor.menteesTitle', 'Mentees')}</h2>
              <p>{t('mentor.menteesDescription', 'Progreso individual y cursos asignados')}</p>
            </div>
          </div>

          {accessRequests.length > 0 && (
            <div className="mentor-surface-block" aria-labelledby="mentor-requests-title">
              <div className="mentor-surface-block__head">
                <h3 id="mentor-requests-title">
                  {t('mentor.pendingRequestsTitle', 'Solicitudes de acceso pendientes')}
                </h3>
                <span className="mentor-section-count">{accessRequests.length}</span>
              </div>
              <p className="mentor-surface-block__hint">
                {t('mentor.pendingRequestsDesc', 'Mentees que pidieron acceso en 1 clic desde la plataforma')}
              </p>

              <ul className="mentor-mentee-list">
                {accessRequests.map((req) => (
                  <li key={req.id} className="mentor-mentee-row mentor-mentee-row--request">
                    <img src={avatarSrc(req.menteeAvatarUrl)} alt="" className="mentor-mentee-avatar" />
                    <div className="mentor-mentee-id">
                      <strong>{req.menteeName}</strong>
                      <span>{req.menteeEmail}</span>
                    </div>
                    <p className="mentor-mentee-request">
                      <GraduationCap aria-hidden="true" />
                      <span>{req.courseTitle}</span>
                      <time>{formatDate(req.createdAt)}</time>
                    </p>
                    <div className="mentor-mentee-actions">
                      <button
                        type="button"
                        onClick={() => handleApproveRequest(req.id)}
                        disabled={processingRequestId === req.id}
                        className="mentor-course-control mentor-course-import"
                      >
                        {processingRequestId === req.id ? (
                          <Loader2 aria-hidden="true" className="animate-spin" />
                        ) : (
                          <CheckCircle2 aria-hidden="true" />
                        )}
                        {t('mentor.approve', 'Aprobar acceso')}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRejectRequest(req.id)}
                        disabled={processingRequestId === req.id}
                        className="mentor-course-control"
                      >
                        {t('mentor.reject', 'Rechazar')}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {loadingMentees && (
            <p className="mentor-courses-empty" role="status">{t('mentor.menteesLoading', 'Cargando mentees')}</p>
          )}

          {!loadingMentees && mentees.length === 0 && (
            <p className="mentor-courses-empty" role="status">
              {t('mentor.menteesEmpty', 'Aún no tienes mentees asignados')}
            </p>
          )}

          {mentees.length > 0 && (() => {
            const q = menteeQuery.trim().toLowerCase();
            // Graduado solo si TODOS sus cursos lo están (lo decide el servidor).
            const isDone = (m: MenteeStudent) => m.status === 'GRADUATED';
            const counts = {
              all: mentees.length,
              active: mentees.filter(m => !isDone(m)).length,
              completed: mentees.filter(isDone).length,
            };
            const visible = mentees.filter(m =>
              (menteeFilter === 'all' || (menteeFilter === 'completed' ? isDone(m) : !isDone(m))) &&
              (!q || m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q))
            );
            return (
              <>
                <div className="mentor-course-toolbar">
                  <label className="mentor-mentee-search">
                    <Search aria-hidden="true" />
                    <input
                      type="search"
                      value={menteeQuery}
                      onChange={(e) => { setMenteeQuery(e.target.value); setMenteeLimit(12); }}
                      placeholder={t('mentor.menteeSearch', 'Buscar mentee')}
                      aria-label={t('mentor.menteeSearch', 'Buscar mentee')}
                    />
                  </label>
                  <div className="mentor-publication-filters" role="group" aria-label={t('mentor.menteeFilter', 'Filtrar mentees')}>
                    {(['all', 'active', 'completed'] as const).map(f => (
                      <button key={f} type="button" aria-pressed={menteeFilter === f} onClick={() => { setMenteeFilter(f); setMenteeLimit(12); }}>
                        <span>{f === 'all' ? t('mentor.publicationAll', 'Todos') : f === 'active' ? t('mentor.menteeActive', 'En curso') : t('mentor.menteeCompleted', 'Completados')}</span>
                        <span className="mentor-publication-count">{counts[f]}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {visible.length === 0 ? (
                  <p className="mentor-courses-empty" role="status">{t('mentor.menteesNoMatch', 'Ningún mentee coincide con el filtro')}</p>
                ) : (
                  <ul className="mentor-mentee-grid">
                    {visible.slice(0, menteeLimit).map((m) => {
                      const graduatedCount = m.courses.filter(c => c.status === 'GRADUATED').length;
                      return (
                        <li key={m.id} className="mentor-mentee-card">
                          <div className="mentor-mentee-card__head">
                            <img src={avatarSrc(m.avatarUrl)} alt="" className="mentor-mentee-avatar" />
                            <div className="mentor-mentee-id">
                              <strong>{m.name}</strong>
                              <span title={m.email}>{m.email}</span>
                            </div>
                          </div>

                          <div className="mentor-mentee-card__progress">
                            <div className="mentor-mentee-card__figure">
                              <b>{m.courses.length === 0 ? '—' : `${m.courseProgress}%`}</b>
                              <span className="mentor-mentee-status" data-state={m.status === 'GRADUATED' ? 'graduated' : 'active'}>
                                {m.status === 'GRADUATED' && <Check aria-hidden="true" />}
                                {m.status === 'GRADUATED' ? t('mentor.statusGraduated', 'Graduado') : m.status === 'PENDING' ? t('mentor.statusPending', 'Pendiente') : t('mentor.statusActive', 'En curso')}
                              </span>
                            </div>
                            <div
                              className="mentor-mentee-bar"
                              role="progressbar"
                              aria-valuemin={0}
                              aria-valuemax={100}
                              aria-valuenow={m.courseProgress}
                              aria-label={t('mentor.menteeProgress', { defaultValue: 'Progreso de {{name}}', name: m.name })}
                            >
                              <span style={{ width: `${m.courseProgress}%` }} />
                            </div>
                            <div className="mentor-mentee-card__foot">
                              <span>
                                {m.totalVideosCount > 0 ? t('completedVideosCountDeTotalVideosCount', '{{completedVideosCount}} de {{totalVideosCount}} lecciones', { completedVideosCount: m.completedVideosCount, totalVideosCount: m.totalVideosCount }) : ''}
                              </span>
                              <span>
                                {m.courses.length === 0 || !m.lastActiveDate || m.lastActiveDate === '-'
                                  ? t('mentor.noActivity', 'Sin actividad')
                                  : t('activoLastActiveDate', 'Activo {{lastActiveDate}}', { lastActiveDate: m.lastActiveDate })}
                              </span>
                            </div>
                          </div>

                          {/* Sus cursos, con nombre: antes la persona salía repetida
                              una vez por curso y ninguna fila decía de cuál hablaba. */}
                          <button
                            type="button"
                            className="mentor-mentee-toggle"
                            disabled={m.courses.length === 0}
                            onClick={() => setDetailMenteeId(m.id)}
                          >
                            <GraduationCap aria-hidden="true" />
                            <span>
                              {m.courses.length === 0
                                ? t('mentor.noCoursesAssigned', 'Sin cursos asignados')
                                : t('mentor.menteeCoursesSummary', { defaultValue: '{{done}} de {{total}} cursos graduados', done: graduatedCount, total: m.courses.length })}
                            </span>
                            {m.courses.length > 0 && <ChevronRight aria-hidden="true" className="mentor-mentee-toggle__chevron" />}
                          </button>

                          <button type="button" onClick={() => openMenteeRoster(m)} className="mentor-course-control">
                            {t('mentor.editCourses', 'Editar cursos')}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}

                {visible.length > menteeLimit && (
                  <div className="mentor-mentee-more">
                    <span className="mentor-course-filter-result" role="status">
                      {t('mentor.menteesShown', { defaultValue: '{{shown}} de {{total}} mentees', shown: menteeLimit, total: visible.length })}
                    </span>
                    <button type="button" className="mentor-course-control" onClick={() => setMenteeLimit(l => l + 12)}>
                      {t('mentor.showMore', 'Mostrar más')}
                    </button>
                  </div>
                )}
              </>
            );
          })()}

          <MenteeCoursesDialog
            mentee={mentees.find(m => m.id === detailMenteeId) ?? null}
            onClose={() => setDetailMenteeId(null)}
            onEdit={(m) => { setDetailMenteeId(null); openMenteeRoster(m); }}
          />
        </section>
      )}

      {/* Tab Content 3: Mentorship Q&A Center */}
      {activeTab === 'qna' && (() => {
        const needle = qnaQuery.trim().toLowerCase();
        const matches = (c: MentorshipComment) =>
          !needle ||
          c.userName.toLowerCase().includes(needle) ||
          c.content.toLowerCase().includes(needle) ||
          questionOrigin(c).toLowerCase().includes(needle);
        // Pendientes: la más antigua primero (es la que más espera). Todas: la más reciente primero.
        const byDate = (a: MentorshipComment, b: MentorshipComment) =>
          qnaFilter === 'pending'
            ? new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
            : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        const rows = qnaComments
          .filter((c) => (qnaFilter === 'pending' ? !c.isResolved || answeredIds.has(c.id) : c.isResolved))
          .filter(matches)
          .sort(byDate);
        const toggle = (setter: React.Dispatch<React.SetStateAction<Set<string>>>, id: string) =>
          setter((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
          });
        return (
          <section className="mentor-qna-panel" aria-labelledby="mentor-qna-title">
            <div className="mentor-section-heading">
              <div>
                <h2 id="mentor-qna-title">{t('mentor.qnaTitle', 'Consultas')}</h2>
                <p>{t('mentor.qnaSubtitle', 'Responde las preguntas de tus alumnos para resolver bloqueos de aprendizaje')}</p>
              </div>
              <button
                type="button"
                className="mentor-course-control mentor-qna-refresh"
                onClick={loadQnaData}
                disabled={loadingQna}
                aria-label={t('mentor.qnaRefresh', 'Actualizar consultas')}
                title={t('mentor.qnaRefresh', 'Actualizar consultas')}
              >
                <RefreshCw aria-hidden="true" className={loadingQna ? 'animate-spin' : ''} />
              </button>
            </div>

            {qnaError && (
              <p className="mentee-sheet__error" role="alert">
                <AlertCircle aria-hidden="true" /> <span>{qnaError}</span>
              </p>
            )}

            <div className="mentor-course-toolbar">
              <label className="mentor-mentee-search">
                <Search aria-hidden="true" />
                <input
                  type="search"
                  value={qnaQuery}
                  onChange={(e) => { setQnaQuery(e.target.value); setQnaLimit(10); }}
                  placeholder={t('mentor.qnaSearch', 'Buscar consulta')}
                  aria-label={t('mentor.qnaSearch', 'Buscar consulta')}
                />
              </label>
              <div className="mentor-publication-filters" role="group" aria-label={t('mentor.qnaFilter', 'Filtrar consultas')}>
                {(['resolved', 'pending'] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={qnaFilter === option}
                    onClick={() => { setQnaFilter(option); setQnaLimit(10); }}
                  >
                    <span>{option === 'pending' ? t('mentor.qnaPending', 'Pendientes') : t('mentor.qnaResolvedTab', 'Resueltas')}</span>
                    <span className="mentor-publication-count">{option === 'pending' ? pendingQuestions.length : resolvedQuestions.length}</span>
                  </button>
                ))}
              </div>
            </div>

            {loadingQna && qnaComments.length === 0 ? (
              <p className="mentor-courses-empty" role="status">
                <Loader2 aria-hidden="true" className="animate-spin" />
                {t('mentor.qnaLoading', 'Cargando consultas')}
              </p>
            ) : rows.length === 0 ? (
              <p className="mentor-courses-empty" role="status">
                <Inbox aria-hidden="true" />
                {needle
                  ? t('mentor.qnaNoMatch', 'Ninguna consulta coincide con la búsqueda')
                  : qnaFilter === 'pending'
                    ? t('mentor.qnaNonePending', 'No hay consultas pendientes')
                    : t('mentor.qnaNoneResolved', 'No hay consultas resueltas')}
              </p>
            ) : (
              <ul className="mentor-qna-list">
                {rows.slice(0, qnaLimit).map((comment) => {
                  const replies = comment.replies ?? [];
                  const threadOpen = openThreads.has(comment.id);
                  const replyOpen = openReplies.has(comment.id);
                  const text = replyTextMap[comment.id] || '';
                  return (
                    <li key={comment.id} className="mentor-qna-card">
                      <header className="mentor-qna-card__head">
                        <img src={avatarSrc(comment.userAvatar)} alt="" className="mentor-mentee-avatar" />
                        <div className="mentor-mentee-id">
                          <strong>{comment.userName}</strong>
                          <span title={formatDate(comment.createdAt)}>{askedAt(comment.createdAt)}</span>
                        </div>
                        <span className="mentor-qna-status" data-state={comment.isResolved ? 'resolved' : 'pending'}>
                          {comment.isResolved && <Check aria-hidden="true" />}
                          {comment.isResolved ? t('mentor.qnaResolved', 'Resuelta') : t('mentor.qnaPendingOne', 'Pendiente')}
                        </span>
                      </header>

                      {/* Sin saber de qué clase salió, la pregunta no se puede responder. */}
                      <p className="mentor-qna-card__origin">
                        <BookOpen aria-hidden="true" />
                        <span>{questionOrigin(comment)}</span>
                      </p>

                      <p className="mentor-qna-card__text">{comment.content}</p>

                      {replies.length > 0 && (
                        <>
                          <button
                            type="button"
                            className="mentor-qna-toggle"
                            aria-expanded={threadOpen}
                            aria-controls={`qna-replies-${comment.id}`}
                            onClick={() => toggle(setOpenThreads, comment.id)}
                          >
                            <span>{t('mentor.qnaReplies', { defaultValue: '{{count}} respuestas', count: replies.length })}</span>
                            <ChevronDown aria-hidden="true" />
                          </button>
                          {threadOpen && (
                            <ul id={`qna-replies-${comment.id}`} className="mentor-qna-replies">
                              {replies.map((r) => (
                                <li key={r.id}>
                                  <div>
                                    <strong>{r.userName}</strong>
                                    <span title={formatDate(r.createdAt)}>{askedAt(r.createdAt)}</span>
                                  </div>
                                  <p>{r.content}</p>
                                </li>
                              ))}
                            </ul>
                          )}
                        </>
                      )}

                      {replyErrorMap[comment.id] && (
                        <p className="mentee-sheet__error" role="alert">
                          <AlertCircle aria-hidden="true" /> <span>{replyErrorMap[comment.id]}</span>
                        </p>
                      )}

                      {replyOpen ? (
                        <form
                          className="mentor-qna-form"
                          onSubmit={(e) => { e.preventDefault(); handleReplySubmit(comment.id); }}
                        >
                          <textarea
                            autoFocus
                            rows={3}
                            value={text}
                            placeholder={t('mentor.qnaReplyPlaceholder', 'Escribe tu respuesta')}
                            aria-label={t('mentor.qnaReplyPlaceholder', 'Escribe tu respuesta')}
                            onChange={(e) => setReplyTextMap({ ...replyTextMap, [comment.id]: e.target.value })}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                                e.preventDefault();
                                handleReplySubmit(comment.id);
                              }
                            }}
                          />
                          <div className="mentor-qna-form__actions">
                            <button type="button" className="mentor-course-control" onClick={() => toggle(setOpenReplies, comment.id)}>
                              {t('mentor.cancel', 'Cancelar')}
                            </button>
                            <button
                              type="submit"
                              className="mentor-course-control mentor-course-import"
                              disabled={replyingId === comment.id || !text.trim()}
                            >
                              {replyingId === comment.id ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Send aria-hidden="true" />}
                              {t('mentor.reply', 'Responder')}
                            </button>
                          </div>
                        </form>
                      ) : (
                        <button type="button" className="mentor-course-control" onClick={() => toggle(setOpenReplies, comment.id)}>
                          {t('mentor.reply', 'Responder')}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}

            {rows.length > qnaLimit && (
              <div className="mentor-mentee-more">
                <span className="mentor-course-filter-result" role="status">
                  {t('mentor.qnaShown', { defaultValue: '{{shown}} de {{total}} consultas', shown: qnaLimit, total: rows.length })}
                </span>
                <button type="button" className="mentor-course-control" onClick={() => setQnaLimit((l) => l + 10)}>
                  {t('mentor.showMore', 'Mostrar más')}
                </button>
              </div>
            )}
          </section>
        );
      })()}

      {/* Tab Content 4: Live & Synchronous Meetings */}
      {activeTab === 'meetings' && (
        <MeetingManager
          currentUser={currentUser}
          courses={displayCourses}
          onRefreshCourses={onRefreshCourses}
        />
      )}

      {/* Tab Content 5: Evaluaciones */}
      {activeTab === 'quizzes' && (() => {
        const needle = quizQuery.trim().toLowerCase();
        const questionsOf = (moduleId: string) => quizzesMap[moduleId] || getModuleQuestions(moduleId);
        const stats = displayCourses.map((course) => {
          const modules = course.modules || [];
          const withExam = modules.filter((m) => questionsOf(m.id).length > 0).length;
          const questions = modules.reduce((sum, m) => sum + questionsOf(m.id).length, 0);
          return { course, modules: modules.length, withExam, questions };
        });
        const counts = {
          all: stats.length,
          without: stats.filter((s) => s.withExam < s.modules).length,
          complete: stats.filter((s) => s.modules > 0 && s.withExam === s.modules).length,
        };
        const rows = stats.filter((s) =>
          (!needle || stripEmoji(s.course.title).toLowerCase().includes(needle) || s.course.category.toLowerCase().includes(needle)) &&
          (quizFilter === 'all' || (quizFilter === 'without' ? s.withExam < s.modules : s.modules > 0 && s.withExam === s.modules))
        );
        const filterLabel = { all: 'Todos', without: 'Por completar', complete: 'Completos' } as const;
        return (
          <section className="mentor-quiz-panel" aria-labelledby="mentor-quiz-title">
            <div className="mentor-section-heading">
              <div>
                <h2 id="mentor-quiz-title">{t('evaluaciones', 'Evaluaciones')}</h2>
                <p>{t('creaExamenesPorModuloOGeneraUnaPropuesta', 'Crea exámenes por módulo o genera una propuesta a partir del temario')}</p>
              </div>
            </div>

            <div className="mentor-course-toolbar">
              <label className="mentor-mentee-search">
                <Search aria-hidden="true" />
                <input
                  type="search"
                  value={quizQuery}
                  onChange={(e) => { setQuizQuery(e.target.value); setQuizLimit(12); }}
                  placeholder={t('buscarCurso', 'Buscar curso')}
                  aria-label={t('buscarCurso', 'Buscar curso')}
                />
              </label>
              <div className="mentor-publication-filters" role="group" aria-label={t('filtrarCursos', 'Filtrar cursos')}>
                {(['all', 'without', 'complete'] as const).map((f) => (
                  <button key={f} type="button" aria-pressed={quizFilter === f} onClick={() => { setQuizFilter(f); setQuizLimit(12); }}>
                    <span>{filterLabel[f]}</span>
                    <span className="mentor-publication-count">{counts[f]}</span>
                  </button>
                ))}
              </div>
            </div>

            {displayCourses.length === 0 ? (
              <p className="mentor-courses-empty" role="status">{t('noHayCursosDisponiblesParaGestionar', 'No hay cursos disponibles para gestionar evaluaciones')}</p>
            ) : rows.length === 0 ? (
              <p className="mentor-courses-empty" role="status">{t('ningunCursoCoincideConLosFiltros', 'Ningún curso coincide con los filtros')}</p>
            ) : (
              <ul className="mentor-quiz-list">
                {rows.slice(0, quizLimit).map(({ course, modules, withExam, questions }) => {
                  const pct = modules > 0 ? Math.round((withExam / modules) * 100) : 0;
                  return (
                    <li key={course.id} className="mentor-quiz-card" style={{ '--course-hue': courseHue(displayCourses, course.id) } as React.CSSProperties}>
                      <header className="mentor-quiz-card__head">
                        <span className="mentor-quiz-card__category"><i aria-hidden="true" />{course.category}</span>
                        <span className="mentor-quiz-status" data-state={modules > 0 && withExam === modules ? 'resolved' : 'pending'}>
                          {modules > 0 && withExam === modules && <Check aria-hidden="true" />}
                          {modules === 0 ? t('sinModulos', 'Sin módulos') : withExam === modules ? t('completo', 'Completo') : t('porCompletar', 'Por completar')}
                        </span>
                      </header>
                      <h3 title={stripEmoji(course.title)}>{stripEmoji(course.title)}</h3>
                      <div className="mentor-quiz-card__progress">
                        <div className="mentor-quiz-card__figure">
                          <b>{t('withExamDeModules', '{{withExam}} de {{modules}}', { withExam, modules })}</b>
                          <span>{t('modulosConExamen', 'módulos con examen')}</span>
                        </div>
                        <div className="mentor-mentee-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={t('examenesDeStripEmoji', 'Exámenes de {{stripEmoji}}', { stripEmoji: stripEmoji(course.title) })}>
                          <span style={{ width: `${pct}%` }} />
                        </div>
                        <span className="mentor-quiz-card__meta">{t('countPreguntasEnTotal', { defaultValue_one: '{{count}} pregunta en total', defaultValue_other: '{{count}} preguntas en total', count: questions })}</span>
                      </div>
                      <button type="button" className="mentor-course-control" disabled={modules === 0} onClick={() => setQuizSheetCourseId(course.id)}>
                        {t('verModulos', 'Ver módulos')}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            {rows.length > quizLimit && (
              <div className="mentor-mentee-more">
                <span className="mentor-course-filter-result" role="status">{t('quizLimitDeLengthCursos', '{{quizLimit}} de {{length}} cursos', { quizLimit, length: rows.length })}</span>
                <button type="button" className="mentor-course-control" onClick={() => setQuizLimit((l) => l + 12)}>{t('mostrarMas', 'Mostrar más')}</button>
              </div>
            )}

            <QuizCourseSheet
              course={displayCourses.find((c) => c.id === quizSheetCourseId) ?? null}
              questionsOf={questionsOf}
              onClose={() => setQuizSheetCourseId(null)}
              onOpenEditor={(m) => setSelectedQuizModule(m)}
            />
          </section>
        );
      })()}

      {/* Tab Content: YouTube AI Course Builder */}
      {activeTab === 'youtube-builder' && (
        <YouTubeCourseBuilder
          currentUser={currentUser}
          onCourseCreated={(_courseId) => {
            onRefreshCourses();
            announce(t('cursoGeneradoYGuardadoDesdeYoutube', 'Curso generado y guardado desde YouTube'));
            setActiveTab('courses');
          }}
          onCancel={() => setActiveTab('courses')}
        />
      )}

      {/* Modal de Exámenes para Mentores */}
      {selectedQuizModule && (
        <QuizManagerModal
          module={selectedQuizModule}
          isOpen={Boolean(selectedQuizModule)}
          onClose={() => setSelectedQuizModule(null)}
          onSaved={async () => {
            await loadAllQuizzes();
            onRefreshCourses();
          }}
        />
      )}

      {/* Assign Mentee Modal */}
      {/* Selector de reparto. En modo «curso» se marcan mentees; en modo
          «mentee», cursos. Lo marcado es el estado final: lo que se desmarca
          se retira al guardar. */}
      {rosterMode && (
        <dialog
          ref={rosterRef}
          className="mentee-sheet"
          aria-labelledby="roster-title"
          onCancel={(e) => { e.preventDefault(); closeRoster(); }}
          onClick={(e) => { if (e.target === e.currentTarget) closeRoster(); }}
        >
          <div className="mentee-sheet__body">
            <header className="mentee-sheet__head">
              {rosterMode === 'mentee' && rosterMentee ? (
                <img src={avatarSrc(rosterMentee.avatarUrl)} alt="" className="mentor-mentee-avatar" />
              ) : (
                <span className="mentee-sheet__icon" aria-hidden="true"><GraduationCap /></span>
              )}
              <div className="mentor-mentee-id">
                <strong id="roster-title">
                  {rosterMode === 'course' ? rosterCourse?.title : rosterMentee?.name}
                </strong>
                <span>{rosterMode === 'course' ? t('asignarMenteesAlCurso', 'Asignar mentees al curso') : t('elegirLosCursosDeEsteMentee', 'Elegir los cursos de este mentee')}</span>
              </div>
              <button type="button" onClick={closeRoster} className="mentee-sheet__close" aria-label={t('cerrar', 'Cerrar')}>
                <X aria-hidden="true" />
              </button>
            </header>

            <div className="mentee-sheet__tools">
              <label className="mentor-mentee-search">
                <Search aria-hidden="true" />
                <input
                  type="search"
                  value={rosterQuery}
                  onChange={(e) => setRosterQuery(e.target.value)}
                  placeholder={rosterMode === 'course' ? 'Buscar mentee' : 'Buscar curso'}
                  aria-label={rosterMode === 'course' ? t('buscarMenteePorNombreOCorreo', 'Buscar mentee por nombre o correo') : t('buscarCurso', 'Buscar curso')}
                />
              </label>
              {/* Unica via para incorporar a alguien que todavia no tiene
                  cuenta. Vive aqui, junto a la lista de quien si la tiene. */}
              {rosterMode === 'course' && (
                <button
                  type="button"
                  onClick={() => {
                    setAssignError('');
                    setShowAssignMenteeModal(true);
                  }}
                  className="mentor-course-control"
                >
                  <Plus aria-hidden="true" /> {t('darDeAlta', 'Dar de alta')}
                </button>
              )}
            </div>

            <div className="mentee-sheet__list">
              {rosterError && (
                <p className="mentee-sheet__error" role="alert">
                  <AlertCircle aria-hidden="true" /> <span>{rosterError}</span>
                </p>
              )}
              {rosterMode === 'course'
                ? (() => {
                    const filtrados = candidates.filter((c) => {
                      const q = rosterQuery.trim().toLowerCase();
                      return !q || c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q);
                    });
                    if (filtrados.length === 0) {
                      return (
                        <p className="mentee-sheet__empty">
                          {t('ningunMenteeCoincideConLaBusqueda', { defaultValue_zero: 'No hay cuentas mentee todavía. Crea una con «Dar de alta».', defaultValue_other: 'Ningún mentee coincide con la búsqueda', count: candidates.length })}
                        </p>
                      );
                    }
                    return filtrados.map((c) => (
                      <label key={c.id} className="roster-option">
                        <input type="checkbox" checked={rosterSelection.includes(c.id)} onChange={() => toggleRosterItem(c.id)} />
                        <img src={avatarSrc(c.avatarUrl)} alt="" className="roster-option__avatar" />
                        <span className="roster-option__text">
                          <strong>{c.name}</strong>
                          <small>{c.email}</small>
                        </span>
                      </label>
                    ));
                  })()
                : (() => {
                    const filtrados = displayCourses.filter((course) => {
                      const q = rosterQuery.trim().toLowerCase();
                      return !q || course.title.toLowerCase().includes(q);
                    });
                    if (filtrados.length === 0) {
                      return <p className="mentee-sheet__empty">{t('ningunCursoCoincide', 'Ningún curso coincide')}</p>;
                    }
                    return filtrados.map((course) => (
                      <label key={course.id} className="roster-option">
                        <input type="checkbox" checked={rosterSelection.includes(course.id)} onChange={() => toggleRosterItem(course.id)} />
                        <span className="roster-option__text">
                          <strong>{course.title}</strong>
                          <small>{course.category} · {course.modules?.length || 0} {t('modulos', 'módulos')}</small>
                        </span>
                        {!course.published && <span className="roster-option__tag">{t('borrador', 'Borrador')}</span>}
                      </label>
                    ));
                  })()}
            </div>

            <footer className="mentee-sheet__foot mentee-sheet__foot--actions">
              <span role="status" aria-live="polite">
                {t('countSeleccionados', { defaultValue_one: '{{count}} seleccionado', defaultValue_other: '{{count}} seleccionados', count: rosterSelection.length })}
              </span>
              <div>
                <button type="button" onClick={closeRoster} className="mentor-course-control">
                  {t('cancelar', 'Cancelar')}
                </button>
                <button type="button" onClick={handleSaveRoster} disabled={savingRoster} className="mentor-course-control mentor-course-import">
                  {savingRoster && <Loader2 aria-hidden="true" className="animate-spin" />}
                  {t('guardarCambios', 'Guardar cambios')}
                </button>
              </div>
            </footer>
          </div>
        </dialog>
      )}

      {showAssignMenteeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-surface border border-line rounded-2xl p-6 w-full max-w-md space-y-4">
            <h3 className="font-semibold text-base text-white">{t('asignarNuevoMentee', 'Asignar Nuevo Mentee')}</h3>
            <p className="text-xs text-ink-muted">{t('ingresaLosDatosDelEstudiantePara', 'Ingresa los datos del estudiante para asignarle mentoría prioritaria.')}</p>

            {assignError && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 text-danger-light text-xs rounded-xl flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-px" /> <span>{assignError}</span>
              </div>
            )}

            <form onSubmit={handleAssignMenteeSubmit} className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-ink-muted uppercase mb-1">{t('nombre', 'Nombre')}</label>
                <input
                  type="text"
                  value={newMenteeName}
                  onChange={(e) => setNewMenteeName(e.target.value)}
                  placeholder={t('ejRobertoGomez', 'Ej. Roberto Gómez')}
                  className="w-full py-2 px-3 bg-canvas border border-line rounded-xl text-xs text-white focus:outline-none focus:border-[var(--color-brand-cyan)]"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-ink-muted uppercase mb-1">{t('correoElectronico', 'Correo Electrónico')}</label>
                <input
                  type="email"
                  value={newMenteeEmail}
                  onChange={(e) => setNewMenteeEmail(e.target.value)}
                  placeholder="mentee@empresa.com"
                  className="w-full py-2 px-3 bg-canvas border border-line rounded-xl text-xs text-white focus:outline-none focus:border-[var(--color-brand-cyan)]"
                  required
                />
              </div>

              {/* Antes entraban siempre al primer curso publicado, fuera el
                  que fuera. Ahora se elige, y se pueden añadir más después. */}
              <div>
                <label className="block text-[10px] font-bold text-ink-muted uppercase mb-1">{t('cursoInicial', 'Curso inicial')}</label>
                <select
                  value={newMenteeCourseId}
                  onChange={(e) => setNewMenteeCourseId(e.target.value)}
                  className="w-full py-2 px-3 bg-canvas border border-line rounded-xl text-xs text-white focus:outline-none focus:border-[var(--color-brand-cyan)]"
                >
                  <option value="">{t('primerCursoPublicado', 'Primer curso publicado')}</option>
                  {displayCourses.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAssignMenteeModal(false)}
                  className="px-4 py-2 bg-raised text-ink-muted text-xs font-bold rounded-xl"
                >
                  {t('cancelar', 'Cancelar')}
                </button>
                <button
                  type="submit"
                  disabled={assigningMentee}
                  className="px-4 py-2 bg-[var(--color-brand-cyan)] text-black text-xs font-semibold rounded-xl flex items-center gap-1.5 disabled:opacity-50"
                >
                  {assigningMentee && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {t('asignarMentee', 'Asignar Mentee')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Course Modal */}
      {showCreateCourseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div className="bg-surface border border-line rounded-2xl p-6 w-full max-w-lg space-y-4">
            <h3 className="font-semibold text-base text-white">{t('crearNuevoPrograma', 'Crear Nuevo Programa')}</h3>
            <p className="text-xs text-ink-muted">
              {t('seCreaLaFichaDelProgramaLosModulosYLas', 'Se crea la ficha del programa. Los módulos y las clases se añaden después desde Administración › Cursos o importando una carpeta de Google Drive.')}
            </p>

            {createCourseError && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 text-danger-light text-xs rounded-xl flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-px" /> <span>{createCourseError}</span>
              </div>
            )}

            <form onSubmit={handleCreateCourseSubmit} className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-ink-muted uppercase mb-1">{t('tituloDelPrograma', 'Título del Programa')}</label>
                <input
                  type="text"
                  value={newCourseTitle}
                  onChange={(e) => setNewCourseTitle(e.target.value)}
                  placeholder={t('ejMentoriaEliteArquitecturaCloud', 'Ej. Mentoría Elite: Arquitectura Cloud')}
                  className="w-full py-2 px-3 bg-canvas border border-line rounded-xl text-xs text-white focus:outline-none focus:border-[var(--color-brand-cyan)]"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-ink-muted uppercase mb-1">{t('descripcion', 'Descripción')}</label>
                <textarea
                  rows={3}
                  value={newCourseDescription}
                  onChange={(e) => setNewCourseDescription(e.target.value)}
                  placeholder={t('queAprendeElAlumnoYParaQuienEsEste', 'Qué aprende el alumno y para quién es este programa.')}
                  className="w-full py-2 px-3 bg-canvas border border-line rounded-xl text-xs text-white focus:outline-none focus:border-[var(--color-brand-cyan)]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-ink-muted uppercase mb-1">{t('categoria', 'Categoría')}</label>
                  <select
                    value={newCourseCategory}
                    onChange={(e) => setNewCourseCategory(e.target.value)}
                    className="w-full py-2 px-3 bg-canvas border border-line rounded-xl text-xs text-white focus:outline-none focus:border-[var(--color-brand-cyan)] cursor-pointer"
                  >
                    <optgroup label={t('modalidadesDeMentoria', 'Modalidades de Mentoría')}>
                      {MENTORSHIP_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label={t('areasTematicasTecnicas', 'Áreas Temáticas Técnicas')}>
                      {TECHNICAL_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-ink-muted uppercase mb-1">{t('precioUsd', 'Precio (USD)')}</label>
                  <input
                    type="number"
                    min={0}
                    value={newCoursePrice}
                    onChange={(e) => setNewCoursePrice(Math.max(0, Number(e.target.value) || 0))}
                    className="w-full py-2 px-3 bg-canvas border border-line rounded-xl text-xs text-white focus:outline-none focus:border-[var(--color-brand-cyan)]"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs text-ink-soft">
                <input
                  type="checkbox"
                  checked={newCoursePublished}
                  onChange={(e) => setNewCoursePublished(e.target.checked)}
                  className="accent-[var(--color-brand-cyan)]"
                />
                {t('publicarDeInmediatoVisibleEnElCatalogo', 'Publicar de inmediato (visible en el catálogo, aún sin clases)')}
              </label>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateCourseModal(false)}
                  className="px-4 py-2 bg-raised text-ink-muted text-xs font-bold rounded-xl"
                >
                  {t('cancelar', 'Cancelar')}
                </button>
                <button
                  type="submit"
                  disabled={creatingCourse}
                  className="px-4 py-2 bg-brand-cyan text-on-brand text-xs font-semibold rounded-xl flex items-center gap-1.5 disabled:opacity-50"
                >
                  {creatingCourse ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  {t('crearPrograma', 'Crear Programa')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
