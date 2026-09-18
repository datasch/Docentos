/**
 * Panel de Control para Mentores (`MentorDashboard.tsx`)
 * Academia Giantucchi
 *
 * Permite a los usuarios con rol MENTOR (y ADMIN):
 * 1. Crear y estructurar Cursos, Módulos y videos de Google Drive
 * 2. Gestionar y revisar el progreso individual de Mentees asignados
 * 3. Responder dudas e interactuar en el Centro de Preguntas Q&A
 */

import React, { useState, useEffect } from 'react';
import {
  UserCheck,
  BookOpen,
  Plus,
  MessageSquare,
  CheckCircle2,
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
} from 'lucide-react';
import { MeetingManager } from './MeetingManager';
import { avatarSrc } from '../lib/avatar.js';
import { api } from '../lib/api';
import { Course, Module, User, MenteeStudent, MenteeCandidate, MentorshipComment, QuizQuestion } from '../types';
import { QuizManagerModal } from './QuizManagerModal';
import { getModuleQuestions, syncModuleQuizzes } from '../plugins/QuizzesPlugin';
import { Sparkles, CheckSquare, Layers } from 'lucide-react';

interface MentorDashboardProps {
  currentUser: User;
  courses: Course[];
  onRefreshCourses: () => void;
}

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

/** De qué clase salió la consulta, dicho en una línea. */
function questionOrigin(comment: MentorshipComment): string {
  const parts = [comment.courseTitle, comment.moduleTitle, comment.videoTitle].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : 'Clase no identificada';
}

export const MentorDashboard: React.FC<MentorDashboardProps> = ({
  currentUser,
  courses,
  onRefreshCourses,
}) => {
  const [activeTab, setActiveTab] = useState<'courses' | 'mentees' | 'qna' | 'meetings' | 'quizzes'>('courses');
  const [selectedQuizModule, setSelectedQuizModule] = useState<Module | null>(null);
  const [quizCourseExpanded, setQuizCourseExpanded] = useState<string | null>(null);
  const [quizzesMap, setQuizzesMap] = useState<Record<string, QuizQuestion[]>>({});

  useEffect(() => {
    loadAllQuizzes();
  }, []);

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

  // Q&A State
  const [qnaComments, setQnaComments] = useState<MentorshipComment[]>([]);
  const [loadingQna, setLoadingQna] = useState<boolean>(true);
  const [qnaError, setQnaError] = useState<string>('');
  const [qnaFilter, setQnaFilter] = useState<'pending' | 'all'>('pending');
  const [replyTextMap, setReplyTextMap] = useState<Record<string, string>>({});
  const [replyingId, setReplyingId] = useState<string | null>(null);
  const [replyErrorMap, setReplyErrorMap] = useState<Record<string, string>>({});

  // Mensaje de confirmación compartido por las acciones de la cabecera.
  const [actionNotice, setActionNotice] = useState<string>('');

  /** Curso cuyo interruptor de apertura se está guardando ahora mismo. */
  const [openingCourseId, setOpeningCourseId] = useState<string | null>(null);
  const [openError, setOpenError] = useState<string>('');

  useEffect(() => {
    loadMenteesData();
    loadQnaData();
  }, []);

  const announce = (message: string) => {
    setActionNotice(message);
    setTimeout(() => setActionNotice(''), 4000);
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
    const abrir = !course.openToAllRegistered;
    setOpenError('');
    setOpeningCourseId(course.id);
    try {
      await api.updateCourse(course.id, { openToAllRegistered: abrir });
      onRefreshCourses();
      announce(
        abrir
          ? `«${course.title}» queda abierto a todas las cuentas registradas.`
          : `«${course.title}» vuelve a entrar solo por asignación.`,
      );
    } catch (error: any) {
      setOpenError(error?.message || 'No se pudo cambiar la apertura del curso.');
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
      setQnaError(error?.message || 'No se pudieron cargar las consultas.');
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
      setRosterError(error?.message || 'No se pudo cargar la lista de mentees.');
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
        partes.push(res.added === 1 ? '1 asignación nueva' : `${res.added} asignaciones nuevas`);
      }
      if (res.removed > 0) {
        partes.push(res.removed === 1 ? '1 retirada' : `${res.removed} retiradas`);
      }
      let aviso = partes.length > 0 ? partes.join(' y ') + '.' : 'No había cambios que guardar.';
      // El servidor descarta lo que no cumple la regla; decirlo evita que
      // alguien crea que asignó a una persona que en realidad quedó fuera.
      if (res.ignored > 0) aviso += ` ${res.ignored} no se pudo aplicar.`;
      // Retirar la mentoría no quita una matrícula pagada ni una dada de alta a
      // mano: si alguien sigue entrando al curso por esa vía, se dice.
      if (res.stillHaveAccess.length > 0) {
        aviso += ` Ojo: ${res.stillHaveAccess.join(', ')} conserva el acceso por matrícula o pago.`;
      }
      announce(aviso);
      closeRoster();
    } catch (error: any) {
      setRosterError(error?.message || 'No se pudo guardar el reparto.');
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
        res.existed
          ? `${nombre} ya tenía cuenta: queda asignado a tu mentoría sin tocarle el perfil.`
          : `${nombre} queda asignado a tu mentoría.`,
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
      setAssignError(error?.message || 'No se pudo asignar el mentee.');
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
      announce('Programa creado. Añádele módulos y clases desde Administración › Cursos.');
      onRefreshCourses();
    } catch (error: any) {
      setCreateCourseError(error?.message || 'No se pudo crear el programa.');
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
      loadQnaData();
    } catch (error: any) {
      setReplyErrorMap((prev) => ({
        ...prev,
        [commentId]: error?.message || 'No se pudo enviar la respuesta.',
      }));
    } finally {
      setReplyingId(null);
    }
  };

  const pendingQuestions = qnaComments.filter((c) => !c.isResolved);
  const visibleQuestions = qnaFilter === 'pending' ? pendingQuestions : qnaComments;
  const answeredPct =
    qnaComments.length > 0
      ? Math.round(((qnaComments.length - pendingQuestions.length) / qnaComments.length) * 100)
      : 0;

  return (
    <div className="min-h-screen bg-[#000000] text-slate-100 p-4 sm:p-8 space-y-8 max-w-7xl mx-auto">

      {/* Header Banner */}
      <div className="bg-[#0a0a0f] border border-[#262626] rounded-2xl p-6 sm:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden">
        <div className="space-y-2 z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#a855f7]/10 border border-[#a855f7]/30 text-[#a855f7] text-xs font-bold">
            <UserCheck className="w-3.5 h-3.5" />
            <span>Panel Especializado para Mentores</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Bienvenido, {currentUser.name}
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 max-w-2xl">
            Gestiona tus programas académicos, supervisa el avance en tiempo real de tus Mentees asignados y responde a las consultas técnicas de la comunidad.
          </p>
        </div>

        {/* Aqui habia dos accesos rapidos, «Asignar Nuevo Mentee» y «Crear
            Nuevo Programa». Se retiran de la cabecera: el alta de mentees vive
            ahora dentro del selector de «Gestión de Cursos», junto a la lista
            de quien ya tiene cuenta. */}
      </div>

      {actionNotice && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-bold rounded-xl flex items-center gap-2 animate-fade-in">
          <CheckCircle2 className="w-4 h-4" /> {actionNotice}
        </div>
      )}

      {/* Si el interruptor de apertura falla hay que decirlo: el botón vuelve a
          su estado anterior y sin este aviso el fallo pasa por «no hice clic». */}
      {openError && (
        <div role="alert" className="p-3 bg-brand-orange/10 border border-brand-orange/30 text-brand-orange text-xs font-bold rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> {openError}
        </div>
      )}

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { title: 'Programas Creados', value: courses.length, icon: BookOpen, color: 'text-[#06b6d4]' },
          { title: 'Mentees Asignados', value: mentees.length, icon: Users, color: 'text-[#a855f7]' },
          {
            title: 'Consultas Respondidas',
            value: qnaComments.length > 0 ? `${answeredPct}%` : '—',
            icon: CheckCircle2,
            color: 'text-emerald-400',
          },
          {
            title: 'Consultas Pendientes',
            value: pendingQuestions.length,
            icon: Clock,
            color: 'text-amber-400',
          },
        ].map((card, idx) => {
          const Icon = card.icon;
          return (
            <div key={idx} className="bg-[#0a0a0f] border border-[#262626] p-5 rounded-2xl flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  {card.title}
                </span>
                <span className="text-2xl font-black text-white mt-1 block">
                  {card.value}
                </span>
              </div>
              <div className={`p-3 rounded-xl bg-[#141420] border border-[#262626] ${card.color}`}>
                <Icon className="w-5 h-5" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Mentor Navigation Tabs */}
      <div className="flex border-b border-[#262626] gap-2">
        <button
          onClick={() => setActiveTab('courses')}
          className={`pb-3 px-4 font-bold text-xs flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'courses'
              ? 'border-[#06b6d4] text-[#06b6d4]'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>Gestión de Cursos ({courses.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('mentees')}
          className={`pb-3 px-4 font-bold text-xs flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'mentees'
              ? 'border-[#06b6d4] text-[#06b6d4]'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Mentees Asignados ({mentees.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('qna')}
          className={`pb-3 px-4 font-bold text-xs flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'qna'
              ? 'border-[#06b6d4] text-[#06b6d4]'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span>Centro de Consultas Q&A ({pendingQuestions.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('meetings')}
          className={`pb-3 px-4 font-bold text-xs flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'meetings'
              ? 'border-[#06b6d4] text-[#06b6d4]'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <Video className="w-4 h-4" />
          <span>Clases en Vivo & Sincrónicas</span>
        </button>

        <button
          onClick={() => setActiveTab('quizzes')}
          className={`pb-3 px-4 font-bold text-xs flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'quizzes'
              ? 'border-purple-500 text-purple-400'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <Sparkles className="w-4 h-4 text-amber-300" />
          <span>Evaluaciones & Quizzes IA</span>
        </button>
      </div>

      {/* Tab Content 1: Courses Management */}
      {activeTab === 'courses' && (
        <div className="space-y-6">
          {courses.length === 0 ? (
            <div className="bg-[#0a0a0f] border border-[#262626] rounded-2xl p-10 text-center space-y-3">
              <BookOpen className="w-8 h-8 text-slate-600 mx-auto" />
              <p className="text-xs text-slate-400">
                Todavía no hay programas. Los crea administración, desde Administración › Cursos.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {courses.map((course) => (
                <div key={course.id} className="bg-[#0a0a0f] border border-[#262626] rounded-2xl p-5 space-y-4 hover:border-[#06b6d4] transition-all">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-[#06b6d4] bg-[#06b6d4]/10 border border-[#06b6d4]/30 px-2.5 py-0.5 rounded-lg">
                      {course.category}
                    </span>
                    {/* Un curso recién creado nace sin publicar: decir siempre
                        «Publicado» mentía sobre lo que ve el alumnado. */}
                    <span
                      className={`text-xs font-mono font-bold ${
                        course.published ? 'text-emerald-400' : 'text-amber-400'
                      }`}
                    >
                      {course.published ? 'Publicado' : 'Borrador'}
                    </span>
                  </div>

                  <h3 className="font-extrabold text-base text-white line-clamp-2">
                    {course.title}
                  </h3>

                  <p className="text-xs text-slate-400 line-clamp-2">
                    {course.description}
                  </p>

                  <div className="pt-3 border-t border-[#262626] flex items-center justify-between text-xs font-mono text-slate-400">
                    <span>{course.modules?.length || 0} Módulos</span>
                    <span>${course.price} USD</span>
                  </div>

                  {/* Reparto de plazas: se elige el curso y se marcan las
                      personas, que es como se piensa al planificar un grupo. */}
                  <button
                    onClick={() => openCourseRoster(course)}
                    className="w-full py-2 bg-[#141420] hover:bg-[#1a1a2e] border border-[#262626] hover:border-[#06b6d4] text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all"
                  >
                    <Users className="w-3.5 h-3.5 text-[#06b6d4]" />
                    Mentees asignados ({menteesOfCourse(course.id).length})
                  </button>

                  {/* La excepción, dicha en voz alta. Mientras esté apagado, a
                      este curso solo se entra por asignación: es lo que evita
                      que alguien recién registrado se encuentre cursos activos
                      que nadie le dio. Solo administración lo ve y lo toca. */}
                  {currentUser.role === 'ADMIN' && (
                    <button
                      onClick={() => toggleOpenToAll(course)}
                      disabled={openingCourseId === course.id}
                      aria-pressed={Boolean(course.openToAllRegistered)}
                      className={`w-full py-2 border text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan disabled:opacity-60 ${
                        course.openToAllRegistered
                          ? 'bg-brand-cyan/10 border-brand-cyan/40 text-brand-cyan'
                          : 'bg-raised border-line text-ink-soft hover:border-brand-cyan'
                      }`}
                    >
                      {openingCourseId === course.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : course.openToAllRegistered ? (
                        <Globe className="w-3.5 h-3.5" />
                      ) : (
                        <Lock className="w-3.5 h-3.5 text-ink-faint" />
                      )}
                      {course.openToAllRegistered ? 'Todos los registrados' : 'Solo asignados'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab Content 2: Mentees Progress Monitoring */}
      {activeTab === 'mentees' && (
        <div className="bg-[#0a0a0f] border border-[#262626] rounded-2xl overflow-hidden">
          <div className="p-5 border-b border-[#262626] flex items-center justify-between">
            {/* El alta y el reparto viven ahora en «Gestión de Cursos»: se
                asigna desde el curso, que es donde se sabe a que se asigna. */}
            <div>
              <h3 className="font-bold text-sm text-white">Seguimiento de Mentees</h3>
              <p className="text-xs text-slate-400">Progreso individual y estado de estudio de alumnos asignados</p>
            </div>
          </div>

          <div className="divide-y divide-[#262626]">
            {loadingMentees && (
              <p className="p-6 text-center text-xs text-slate-500">Cargando mentees...</p>
            )}

            {!loadingMentees && mentees.length === 0 && (
              <p className="p-6 text-center text-xs text-slate-500">
                Aún no tienes mentees asignados.
              </p>
            )}

            {mentees.map((m) => (
              <div key={m.id} className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:bg-[#141420]/50 transition-colors">
                <div className="flex items-center gap-3">
                  <img
                    src={avatarSrc(m.avatarUrl)}
                    alt={m.name}
                    className="w-10 h-10 rounded-xl object-cover border border-[#262626]"
                  />
                  <div>
                    <h4 className="font-bold text-xs text-white flex items-center gap-2">
                      {m.name}
                      <span className="text-[9px] font-extrabold text-[#06b6d4] bg-[#06b6d4]/10 border border-[#06b6d4]/30 px-1.5 py-0.2 rounded">
                        {m.status}
                      </span>
                    </h4>
                    <span className="text-[11px] text-slate-400">{m.email}</span>
                  </div>
                </div>

                {/* Progress Bar Column */}
                <div className="w-full sm:w-64 space-y-1">
                  <div className="flex items-center justify-between text-[10px] font-mono">
                    <span className="text-slate-400">Progreso en Curso</span>
                    <span className="font-bold text-[#06b6d4]">{m.courseProgress}%</span>
                  </div>
                  <div className="w-full bg-[#000000] rounded-full h-2 border border-[#262626] overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-[#06b6d4] to-[#a855f7] h-full rounded-full transition-all"
                      style={{ width: `${m.courseProgress}%` }}
                    />
                  </div>
                  <div className="text-[9px] text-slate-500 font-mono text-right">
                    {m.completedVideosCount} de {m.totalVideosCount} lecciones • Activo {m.lastActiveDate}
                  </div>
                </div>

                {/* Sus cursos, con nombre. Antes esta persona salía repetida
                    una vez por curso y ninguna fila decía de cuál hablaba. */}
                <div className="w-full sm:w-auto sm:max-w-xs space-y-2">
                  <div className="flex flex-wrap gap-1.5">
                    {m.courses.length === 0 ? (
                      <span className="text-[10px] text-slate-500 italic">Sin cursos asignados</span>
                    ) : (
                      m.courses.map((c) => (
                        <span
                          key={c.assignmentId}
                          title={`${c.courseProgress}% · ${c.completedVideosCount} de ${c.totalVideosCount} lecciones`}
                          className="inline-flex items-center gap-1 text-[10px] font-bold text-[#a855f7] bg-[#a855f7]/10 border border-[#a855f7]/30 px-2 py-0.5 rounded-lg max-w-[180px]"
                        >
                          <GraduationCap className="w-3 h-3 shrink-0" />
                          <span className="truncate">{c.courseTitle}</span>
                          <span className="font-mono text-slate-400">{c.courseProgress}%</span>
                        </span>
                      ))
                    )}
                  </div>

                  <button
                    onClick={() => openMenteeRoster(m)}
                    className="w-full sm:w-auto px-3 py-1.5 bg-[#141420] hover:bg-[#1a1a2e] border border-[#262626] hover:border-[#a855f7] text-white text-[11px] font-bold rounded-xl transition-all"
                  >
                    Editar cursos
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab Content 3: Mentorship Q&A Center */}
      {activeTab === 'qna' && (
        <div className="space-y-4">
          <div className="bg-[#0a0a0f] border border-[#262626] rounded-2xl p-5">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
              <div>
                <h3 className="font-extrabold text-sm text-white mb-1">Centro de Consultas de Mentoría</h3>
                <p className="text-xs text-slate-400">
                  Responde las preguntas de tus alumnos directamente para resolver bloqueos de aprendizaje.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {/* Pendientes primero: es lo único que pide acción. */}
                <div className="flex bg-[#141420] border border-[#262626] rounded-xl p-1">
                  {(['pending', 'all'] as const).map((option) => (
                    <button
                      key={option}
                      onClick={() => setQnaFilter(option)}
                      className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all ${
                        qnaFilter === option ? 'bg-[#06b6d4] text-black' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {option === 'pending' ? `Pendientes (${pendingQuestions.length})` : `Todas (${qnaComments.length})`}
                    </button>
                  ))}
                </div>

                <button
                  onClick={loadQnaData}
                  disabled={loadingQna}
                  className="p-2 bg-[#141420] border border-[#262626] rounded-xl text-slate-400 hover:text-white transition-colors disabled:opacity-50"
                  title="Actualizar consultas"
                >
                  <RefreshCw className={`w-4 h-4 ${loadingQna ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {qnaError && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 text-red-300 text-xs rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" /> {qnaError}
              </div>
            )}

            <div className="space-y-4">
              {loadingQna && qnaComments.length === 0 && (
                <p className="py-8 text-center text-xs text-slate-500">Cargando consultas...</p>
              )}

              {!loadingQna && visibleQuestions.length === 0 && (
                <div className="py-10 text-center space-y-2">
                  <Inbox className="w-8 h-8 text-slate-600 mx-auto" />
                  <p className="text-xs text-slate-500">
                    {qnaFilter === 'pending'
                      ? 'No hay consultas pendientes. Todo respondido.'
                      : 'Todavía no hay consultas publicadas por el alumnado.'}
                  </p>
                </div>
              )}

              {visibleQuestions.map((comment) => (
                <div key={comment.id} className="p-4 bg-[#141420] border border-[#262626] rounded-xl space-y-3">
                  {/* Sin saber de qué clase salió, la pregunta no se puede responder. */}
                  <div className="text-[10px] font-bold text-[#a855f7] uppercase tracking-wider">
                    {questionOrigin(comment)}
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <img
                        src={avatarSrc(comment.userAvatar)}
                        alt={comment.userName}
                        className="w-7 h-7 rounded-full object-cover shrink-0"
                      />
                      <span className="font-bold text-xs text-white truncate">{comment.userName}</span>
                      <span className="text-[10px] text-slate-500 font-mono shrink-0">
                        {formatDate(comment.createdAt)}
                      </span>
                    </div>

                    <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded shrink-0 ${
                      comment.isResolved ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                    }`}>
                      {comment.isResolved ? 'Resuelta por Mentor' : 'Pendiente'}
                    </span>
                  </div>

                  <p className="text-xs text-slate-200">{comment.content}</p>

                  {/* Existing Replies */}
                  {comment.replies && comment.replies.length > 0 && (
                    <div className="pl-4 border-l-2 border-[#06b6d4] space-y-2 pt-1">
                      {comment.replies.map((r) => (
                        <div key={r.id} className="text-xs space-y-1">
                          <span className="font-bold text-[#06b6d4]">{r.userName}:</span>
                          <p className="text-slate-300">{r.content}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {replyErrorMap[comment.id] && (
                    <div className="p-2.5 bg-red-500/10 border border-red-500/30 text-red-300 text-[11px] rounded-lg flex items-center gap-2">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {replyErrorMap[comment.id]}
                    </div>
                  )}

                  {/* Mentor Reply Input */}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleReplySubmit(comment.id);
                    }}
                    className="flex items-center gap-2 pt-2"
                  >
                    <input
                      type="text"
                      placeholder="Escribe tu respuesta como Mentor..."
                      value={replyTextMap[comment.id] || ''}
                      onChange={(e) =>
                        setReplyTextMap({ ...replyTextMap, [comment.id]: e.target.value })
                      }
                      className="flex-1 py-2 px-3 bg-[#000000] border border-[#262626] focus:border-[#06b6d4] rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none"
                    />
                    <button
                      type="submit"
                      disabled={replyingId === comment.id || !(replyTextMap[comment.id] || '').trim()}
                      className="px-4 py-2 bg-[#06b6d4] text-black font-extrabold text-xs rounded-xl flex items-center gap-1.5 hover:opacity-90 transition-opacity disabled:opacity-40"
                    >
                      {replyingId === comment.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Send className="w-3.5 h-3.5" />
                      )}
                      Responder
                    </button>
                  </form>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab Content 4: Live & Synchronous Meetings */}
      {activeTab === 'meetings' && (
        <MeetingManager
          currentUser={currentUser}
          courses={courses}
          onRefreshCourses={onRefreshCourses}
        />
      )}

            {/* Tab Content 5: Quizzes & Evaluaciones con IA */}
      {activeTab === 'quizzes' && (
        <div className="space-y-6">
          <div className="bg-[#0a0a0f] border border-[#262626] rounded-2xl p-6 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#262626] pb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-purple-500/10 border border-purple-500/30 rounded-xl text-purple-400">
                  <Sparkles className="w-6 h-6 text-amber-300" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                    Gestor de Evaluaciones & Exámenes con IA
                  </h3>
                  <p className="text-xs text-slate-400">
                    Crea cuestionarios de validación por módulo o genéralos automáticamente a partir del temario con IA
                  </p>
                </div>
              </div>
            </div>

            {courses.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-xs">
                No hay cursos registrados para gestionar evaluaciones.
              </div>
            ) : (
              <div className="mt-6 space-y-4">
                {courses.map((course) => {
                  const isExpanded = quizCourseExpanded === course.id || courses.length === 1;
                  const modules = [...(course.modules || [])].sort((a, b) => a.order - b.order);

                  return (
                    <div
                      key={course.id}
                      className="bg-[#141420] border border-[#2d2d44] rounded-2xl overflow-hidden transition-all shadow-md"
                    >
                      <div
                        onClick={() => setQuizCourseExpanded(isExpanded ? null : course.id)}
                        className="p-4 flex items-center justify-between gap-4 cursor-pointer hover:bg-[#1a1a2e]/50 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="p-2 bg-purple-500/10 rounded-xl text-purple-400">
                            <Layers className="w-5 h-5" />
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-sm font-bold text-white truncate">{course.title}</h4>
                            <p className="text-[11px] text-slate-400">
                              {course.category} • {modules.length} módulo(s) de aprendizaje
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold px-3 py-1 bg-[#0a0a0f] border border-[#2d2d44] rounded-xl text-slate-300">
                            {modules.filter((m) => getModuleQuestions(m.id).length > 0).length} de {modules.length} con examen
                          </span>
                          <span className="text-xs font-bold text-purple-400">
                            {isExpanded ? 'Ocultar ▲' : 'Ver Módulos ▼'}
                          </span>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="p-4 border-t border-[#2d2d44] bg-[#0a0a0f]/60 space-y-3">
                          {modules.length === 0 ? (
                            <p className="text-xs text-slate-500 py-3 text-center">
                              Este curso aún no tiene módulos configurados.
                            </p>
                          ) : (
                            modules.map((module) => {
                              const questions = quizzesMap[module.id] || getModuleQuestions(module.id);
                              const hasQuiz = questions.length > 0;

                              return (
                                <div
                                  key={module.id}
                                  className="p-3.5 rounded-xl bg-[#141420] border border-[#2d2d44] flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-purple-500/40 transition-all"
                                >
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="font-mono text-xs font-bold text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
                                        Módulo {module.order}
                                      </span>
                                      <p className="text-xs font-bold text-white truncate">{module.title}</p>
                                    </div>
                                    <div className="flex items-center gap-2 mt-1">
                                      <span className="text-[10px] text-slate-400">
                                        {module.videos?.length || 0} clase(s)
                                      </span>
                                      <span className="text-slate-600">•</span>
                                      {hasQuiz ? (
                                        <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
                                          <CheckCircle2 className="w-3 h-3" />
                                          {questions.length} preguntas configuradas
                                        </span>
                                      ) : (
                                        <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30">
                                          Sin examen asignado
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => setSelectedQuizModule(module)}
                                    className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 shadow-lg shadow-purple-500/20 cursor-pointer transition-all shrink-0"
                                  >
                                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                                    <span>{hasQuiz ? 'Editar Examen' : '✨ Generar con IA'}</span>
                                  </button>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#0a0a0f] border border-[#262626] rounded-2xl w-full max-w-lg flex flex-col max-h-[85vh]">
            <div className="p-5 border-b border-[#262626] flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-extrabold text-base text-white">
                  {rosterMode === 'course' ? 'Asignar mentees al curso' : 'Cursos de este mentee'}
                </h3>
                <p className="text-xs text-slate-400 truncate">
                  {rosterMode === 'course' ? rosterCourse?.title : rosterMentee?.name}
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {/* Unica via para incorporar a alguien que todavia no tiene
                    cuenta. Vive aqui, junto a la lista de quien si la tiene. */}
                {rosterMode === 'course' && (
                  <button
                    onClick={() => {
                      setAssignError('');
                      setShowAssignMenteeModal(true);
                    }}
                    className="px-2.5 py-1.5 bg-raised border border-line hover:border-brand-cyan text-brand-cyan font-bold text-micro rounded-xl flex items-center gap-1.5 transition-colors"
                  >
                    <Plus aria-hidden className="w-3.5 h-3.5" /> Dar de alta
                  </button>
                )}
                <button
                  onClick={closeRoster}
                  className="p-1.5 text-slate-500 hover:text-white rounded-lg hover:bg-[#141420]"
                  aria-label="Cerrar"
                >
                  <X aria-hidden className="w-4 h-4" />
                </button>
              </div>
            </div>

            {rosterError && (
              <div className="mx-5 mt-4 p-3 bg-red-500/10 border border-red-500/30 text-red-300 text-xs rounded-xl flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-px" /> <span>{rosterError}</span>
              </div>
            )}

            <div className="p-5 pb-3">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="search"
                  value={rosterQuery}
                  onChange={(e) => setRosterQuery(e.target.value)}
                  placeholder={rosterMode === 'course' ? 'Buscar mentee por nombre o correo…' : 'Buscar curso…'}
                  className="w-full py-2 pl-9 pr-3 bg-[#000000] border border-[#262626] rounded-xl text-xs text-white focus:outline-none focus:border-[#06b6d4]"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 space-y-1.5">
              {rosterMode === 'course'
                ? (() => {
                    const filtrados = candidates.filter((c) => {
                      const q = rosterQuery.trim().toLowerCase();
                      return !q || c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q);
                    });
                    if (filtrados.length === 0) {
                      return (
                        <p className="py-8 text-center text-xs text-slate-500">
                          {candidates.length === 0
                            ? 'No hay cuentas mentee todavía. Crea una con «Dar de alta», aquí arriba.'
                            : 'Ningún mentee coincide con la búsqueda.'}
                        </p>
                      );
                    }
                    return filtrados.map((c) => (
                      <label
                        key={c.id}
                        className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-[#141420] cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={rosterSelection.includes(c.id)}
                          onChange={() => toggleRosterItem(c.id)}
                          className="w-4 h-4 accent-[#06b6d4] cursor-pointer"
                        />
                        <img
                          src={avatarSrc(c.avatarUrl)}
                          alt=""
                          className="w-8 h-8 rounded-lg object-cover border border-[#262626]"
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-white truncate">{c.name}</p>
                          <p className="text-[10px] text-slate-400 truncate">{c.email}</p>
                        </div>
                      </label>
                    ));
                  })()
                : (() => {
                    const filtrados = courses.filter((course) => {
                      const q = rosterQuery.trim().toLowerCase();
                      return !q || course.title.toLowerCase().includes(q);
                    });
                    if (filtrados.length === 0) {
                      return <p className="py-8 text-center text-xs text-slate-500">Ningún curso coincide.</p>;
                    }
                    return filtrados.map((course) => (
                      <label
                        key={course.id}
                        className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-[#141420] cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={rosterSelection.includes(course.id)}
                          onChange={() => toggleRosterItem(course.id)}
                          className="w-4 h-4 accent-[#a855f7] cursor-pointer"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-white truncate">{course.title}</p>
                          <p className="text-[10px] text-slate-400">
                            {course.category} · {course.modules?.length || 0} módulos
                          </p>
                        </div>
                        {!course.published && (
                          <span className="text-[9px] font-bold text-amber-400 shrink-0">Borrador</span>
                        )}
                      </label>
                    ));
                  })()}
            </div>

            <div className="p-5 border-t border-[#262626] flex items-center justify-between gap-3">
              <span className="text-[11px] text-slate-400">
                {rosterSelection.length} seleccionado{rosterSelection.length === 1 ? '' : 's'}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={closeRoster}
                  className="px-4 py-2 bg-[#141420] text-slate-400 text-xs font-bold rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveRoster}
                  disabled={savingRoster}
                  className="px-4 py-2 bg-[#06b6d4] text-black text-xs font-extrabold rounded-xl flex items-center gap-1.5 disabled:opacity-50"
                >
                  {savingRoster && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Guardar cambios
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAssignMenteeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#0a0a0f] border border-[#262626] rounded-2xl p-6 w-full max-w-md space-y-4">
            <h3 className="font-extrabold text-base text-white">Asignar Nuevo Mentee</h3>
            <p className="text-xs text-slate-400">Ingresa los datos del estudiante para asignarle mentoría prioritaria.</p>

            {assignError && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-300 text-xs rounded-xl flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-px" /> <span>{assignError}</span>
              </div>
            )}

            <form onSubmit={handleAssignMenteeSubmit} className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Nombre</label>
                <input
                  type="text"
                  value={newMenteeName}
                  onChange={(e) => setNewMenteeName(e.target.value)}
                  placeholder="Ej. Roberto Gómez"
                  className="w-full py-2 px-3 bg-[#000000] border border-[#262626] rounded-xl text-xs text-white focus:outline-none focus:border-[#06b6d4]"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Correo Electrónico</label>
                <input
                  type="email"
                  value={newMenteeEmail}
                  onChange={(e) => setNewMenteeEmail(e.target.value)}
                  placeholder="mentee@empresa.com"
                  className="w-full py-2 px-3 bg-[#000000] border border-[#262626] rounded-xl text-xs text-white focus:outline-none focus:border-[#06b6d4]"
                  required
                />
              </div>

              {/* Antes entraban siempre al primer curso publicado, fuera el
                  que fuera. Ahora se elige, y se pueden añadir más después. */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Curso inicial</label>
                <select
                  value={newMenteeCourseId}
                  onChange={(e) => setNewMenteeCourseId(e.target.value)}
                  className="w-full py-2 px-3 bg-[#000000] border border-[#262626] rounded-xl text-xs text-white focus:outline-none focus:border-[#06b6d4]"
                >
                  <option value="">Primer curso publicado</option>
                  {courses.map((course) => (
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
                  className="px-4 py-2 bg-[#141420] text-slate-400 text-xs font-bold rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={assigningMentee}
                  className="px-4 py-2 bg-[#06b6d4] text-black text-xs font-extrabold rounded-xl flex items-center gap-1.5 disabled:opacity-50"
                >
                  {assigningMentee && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Asignar Mentee
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Course Modal */}
      {showCreateCourseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div className="bg-[#0a0a0f] border border-[#262626] rounded-2xl p-6 w-full max-w-lg space-y-4">
            <h3 className="font-extrabold text-base text-white">Crear Nuevo Programa</h3>
            <p className="text-xs text-slate-400">
              Se crea la ficha del programa. Los módulos y las clases se añaden después desde
              Administración › Cursos o importando una carpeta de Google Drive.
            </p>

            {createCourseError && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-300 text-xs rounded-xl flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-px" /> <span>{createCourseError}</span>
              </div>
            )}

            <form onSubmit={handleCreateCourseSubmit} className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Título del Programa</label>
                <input
                  type="text"
                  value={newCourseTitle}
                  onChange={(e) => setNewCourseTitle(e.target.value)}
                  placeholder="Ej. Mentoría Elite: Arquitectura Cloud"
                  className="w-full py-2 px-3 bg-[#000000] border border-[#262626] rounded-xl text-xs text-white focus:outline-none focus:border-[#06b6d4]"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Descripción</label>
                <textarea
                  rows={3}
                  value={newCourseDescription}
                  onChange={(e) => setNewCourseDescription(e.target.value)}
                  placeholder="Qué aprende el alumno y para quién es este programa."
                  className="w-full py-2 px-3 bg-[#000000] border border-[#262626] rounded-xl text-xs text-white focus:outline-none focus:border-[#06b6d4]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Categoría</label>
                  <input
                    type="text"
                    value={newCourseCategory}
                    onChange={(e) => setNewCourseCategory(e.target.value)}
                    className="w-full py-2 px-3 bg-[#000000] border border-[#262626] rounded-xl text-xs text-white focus:outline-none focus:border-[#06b6d4]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Precio (USD)</label>
                  <input
                    type="number"
                    min={0}
                    value={newCoursePrice}
                    onChange={(e) => setNewCoursePrice(Math.max(0, Number(e.target.value) || 0))}
                    className="w-full py-2 px-3 bg-[#000000] border border-[#262626] rounded-xl text-xs text-white focus:outline-none focus:border-[#06b6d4]"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={newCoursePublished}
                  onChange={(e) => setNewCoursePublished(e.target.checked)}
                  className="accent-[#06b6d4]"
                />
                Publicar de inmediato (visible en el catálogo, aún sin clases)
              </label>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateCourseModal(false)}
                  className="px-4 py-2 bg-[#141420] text-slate-400 text-xs font-bold rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creatingCourse}
                  className="px-4 py-2 bg-gradient-to-r from-[#06b6d4] to-[#a855f7] text-black text-xs font-extrabold rounded-xl flex items-center gap-1.5 disabled:opacity-50"
                >
                  {creatingCourse ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  Crear Programa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
