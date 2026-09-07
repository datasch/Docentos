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
} from 'lucide-react';
import { api } from '../lib/api';
import { Course, User, MenteeStudent, MentorshipComment } from '../types';

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
  const [activeTab, setActiveTab] = useState<'courses' | 'mentees' | 'qna'>('courses');

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

  useEffect(() => {
    loadMenteesData();
    loadQnaData();
  }, []);

  const announce = (message: string) => {
    setActionNotice(message);
    setTimeout(() => setActionNotice(''), 4000);
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

  const handleAssignMenteeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMenteeName.trim() || !newMenteeEmail.trim()) return;

    setAssigningMentee(true);
    setAssignError('');
    try {
      await api.assignMentee(newMenteeName.trim(), newMenteeEmail.trim(), currentUser.id);
      setNewMenteeName('');
      setNewMenteeEmail('');
      setShowAssignMenteeModal(false);
      announce(`${newMenteeName.trim()} queda asignado a tu mentoría.`);
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

        {/* Quick Actions */}
        <div className="flex flex-wrap items-center gap-3 z-10">
          <button
            onClick={() => {
              setAssignError('');
              setShowAssignMenteeModal(true);
            }}
            className="px-4 py-2.5 bg-[#141420] hover:bg-[#1a1a2e] border border-[#262626] hover:border-[#06b6d4] text-white text-xs font-bold rounded-xl transition-all flex items-center gap-2"
          >
            <Users className="w-4 h-4 text-[#06b6d4]" />
            <span>Asignar Nuevo Mentee</span>
          </button>

          <button
            onClick={() => {
              setCreateCourseError('');
              setShowCreateCourseModal(true);
            }}
            className="px-4 py-2.5 bg-gradient-to-r from-[#06b6d4] to-[#a855f7] hover:opacity-90 text-black text-xs font-extrabold rounded-xl shadow-lg transition-all flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Crear Nuevo Programa</span>
          </button>
        </div>
      </div>

      {actionNotice && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-bold rounded-xl flex items-center gap-2 animate-fade-in">
          <CheckCircle2 className="w-4 h-4" /> {actionNotice}
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
      </div>

      {/* Tab Content 1: Courses Management */}
      {activeTab === 'courses' && (
        <div className="space-y-6">
          {courses.length === 0 ? (
            <div className="bg-[#0a0a0f] border border-[#262626] rounded-2xl p-10 text-center space-y-3">
              <BookOpen className="w-8 h-8 text-slate-600 mx-auto" />
              <p className="text-xs text-slate-400">
                Todavía no hay programas. Crea el primero desde «Crear Nuevo Programa».
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
            <div>
              <h3 className="font-bold text-sm text-white">Seguimiento de Mentees</h3>
              <p className="text-xs text-slate-400">Progreso individual y estado de estudio de alumnos asignados</p>
            </div>
            <button
              onClick={() => {
                setAssignError('');
                setShowAssignMenteeModal(true);
              }}
              className="px-3.5 py-1.5 bg-[#06b6d4] text-black font-extrabold text-xs rounded-xl flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" /> Asignar Mentee
            </button>
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
                    src={m.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
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
                        src={comment.userAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
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

      {/* Assign Mentee Modal */}
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
