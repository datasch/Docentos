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
  Video,
  MessageSquare,
  CheckCircle2,
  Users,
  Search,
  Sparkles,
  PlayCircle,
  Clock,
  Layers,
  Send,
  HelpCircle,
  TrendingUp,
  Award,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { Course, User, MenteeStudent, MentorshipComment, DriveVideoFile } from '../types';

interface MentorDashboardProps {
  currentUser: User;
  courses: Course[];
  onRefreshCourses: () => void;
}

export const MentorDashboard: React.FC<MentorDashboardProps> = ({
  currentUser,
  courses,
  onRefreshCourses,
}) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'courses' | 'mentees' | 'qna'>('courses');

  // Mentees State
  const [mentees, setMentees] = useState<MenteeStudent[]>([]);
  const [loadingMentees, setLoadingMentees] = useState<boolean>(true);
  const [showAssignMenteeModal, setShowAssignMenteeModal] = useState<boolean>(false);
  const [newMenteeName, setNewMenteeName] = useState<string>('');
  const [newMenteeEmail, setNewMenteeEmail] = useState<string>('');

  // Course Creation State
  const [showCreateCourseModal, setShowCreateCourseModal] = useState<boolean>(false);
  const [newCourseTitle, setNewCourseTitle] = useState<string>('');
  const [newCourseDescription, setNewCourseDescription] = useState<string>('');
  const [newCoursePrice, setNewCoursePrice] = useState<number>(149);
  const [newCourseCategory, setNewCourseCategory] = useState<string>('Mentoría Elite');

  // Q&A State
  const [qnaComments, setQnaComments] = useState<MentorshipComment[]>([]);
  const [replyTextMap, setReplyTextMap] = useState<Record<string, string>>({});

  useEffect(() => {
    loadMenteesData();
    loadQnaData();
  }, []);

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

  const loadQnaData = async () => {
    try {
      const res = await api.getVideoComments('video-intro-01');
      if (res.comments) {
        setQnaComments(res.comments);
      }
    } catch (error) {
      console.error('Error al cargar preguntas:', error);
    }
  };

  const handleAssignMenteeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMenteeName.trim() || !newMenteeEmail.trim()) return;

    try {
      await api.assignMentee(newMenteeName.trim(), newMenteeEmail.trim(), currentUser.id);
      setNewMenteeName('');
      setNewMenteeEmail('');
      setShowAssignMenteeModal(false);
      loadMenteesData();
    } catch (error) {
      console.error('Error al asignar mentee:', error);
    }
  };

  const handleReplySubmit = async (commentId: string) => {
    const replyText = replyTextMap[commentId];
    if (!replyText || !replyText.trim()) return;

    try {
      await api.replyToComment(commentId, replyText.trim());
      setReplyTextMap((prev) => ({ ...prev, [commentId]: '' }));
      loadQnaData();
    } catch (error) {
      console.error('Error al enviar respuesta:', error);
    }
  };

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
            onClick={() => setShowAssignMenteeModal(true)}
            className="px-4 py-2.5 bg-[#141420] hover:bg-[#1a1a2e] border border-[#262626] hover:border-[#06b6d4] text-white text-xs font-bold rounded-xl transition-all flex items-center gap-2"
          >
            <Users className="w-4 h-4 text-[#06b6d4]" />
            <span>Asignar Nuevo Mentee</span>
          </button>

          <button
            onClick={() => setShowCreateCourseModal(true)}
            className="px-4 py-2.5 bg-gradient-to-r from-[#06b6d4] to-[#a855f7] hover:opacity-90 text-black text-xs font-extrabold rounded-xl shadow-lg transition-all flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Crear Nuevo Programa</span>
          </button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { title: 'Programas Creados', value: courses.length, icon: BookOpen, color: 'text-[#06b6d4]' },
          { title: 'Mentees Asignados', value: mentees.length, icon: Users, color: 'text-[#a855f7]' },
          { title: 'Preguntas Respondidas', value: '94%', icon: CheckCircle2, color: 'text-emerald-400' },
          { title: 'Horas de Mentoría', value: '320h', icon: Clock, color: 'text-amber-400' },
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
          <span>Centro de Consultas Q&A</span>
        </button>
      </div>

      {/* Tab Content 1: Courses Management */}
      {activeTab === 'courses' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {courses.map((course) => (
              <div key={course.id} className="bg-[#0a0a0f] border border-[#262626] rounded-2xl p-5 space-y-4 hover:border-[#06b6d4] transition-all">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-[#06b6d4] bg-[#06b6d4]/10 border border-[#06b6d4]/30 px-2.5 py-0.5 rounded-lg">
                    {course.category}
                  </span>
                  <span className="text-xs font-mono font-bold text-emerald-400">
                    Publicado
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
              onClick={() => setShowAssignMenteeModal(true)}
              className="px-3.5 py-1.5 bg-[#06b6d4] text-black font-extrabold text-xs rounded-xl flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" /> Asignar Mentee
            </button>
          </div>

          <div className="divide-y divide-[#262626]">
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
            <h3 className="font-extrabold text-sm text-white mb-1">Centro de Consultas de Mentoría</h3>
            <p className="text-xs text-slate-400 mb-4">
              Responde las preguntas de tus alumnos directamente para resolver bloqueos de aprendizaje.
            </p>

            <div className="space-y-4">
              {qnaComments.map((comment) => (
                <div key={comment.id} className="p-4 bg-[#141420] border border-[#262626] rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <img
                        src={comment.userAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
                        alt={comment.userName}
                        className="w-7 h-7 rounded-full object-cover"
                      />
                      <span className="font-bold text-xs text-white">{comment.userName}</span>
                      <span className="text-[10px] text-slate-500 font-mono">{comment.createdAt}</span>
                    </div>

                    <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded ${
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

                  {/* Mentor Reply Input */}
                  <div className="flex items-center gap-2 pt-2">
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
                      onClick={() => handleReplySubmit(comment.id)}
                      className="px-4 py-2 bg-[#06b6d4] text-black font-extrabold text-xs rounded-xl flex items-center gap-1.5 hover:opacity-90 transition-opacity"
                    >
                      <Send className="w-3.5 h-3.5" /> Responder
                    </button>
                  </div>
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
                  className="px-4 py-2 bg-[#06b6d4] text-black text-xs font-extrabold rounded-xl"
                >
                  Asignar Mentee
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
