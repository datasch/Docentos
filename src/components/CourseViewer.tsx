/**
 * Componente de Visualización de Cursos & Reproductor Google Drive
 * Academia Giantucchi
 *
 * Incluye:
 * 1. Lista de módulos a la izquierda (colapsable en móvil)
 * 2. Reproductor principal de videos de Drive
 * 3. Área de comentarios y preguntas de mentoría interactiva
 */

import React, { useState, useEffect } from 'react';
import { PlayCircle, CheckCircle2, ChevronLeft, ChevronRight, Home, MessageSquare, Send, ShieldCheck, ThumbsUp, Sparkles, HelpCircle, HardDrive, Maximize2, Lock, Youtube, Code, Award, CheckSquare, Bookmark, FileText, Clock, Download, FileCode, ExternalLink, Search } from 'lucide-react';
import { api } from '../lib/api';
import {
  countCompleted,
  findResumePosition,
  flattenLessons,
  indexOfLesson,
  stepLesson,
} from '../lib/courseNavigation';
import { Course, Module, VideoDriveLink, MentorshipComment, User, UserRole, TTSGuide, VideoNote, CertificateRecord, CourseResource } from '../types';
import { MentorTTSGuideWidget } from './MentorTTSGuideWidget';
import { parseVideoSource } from '../lib/videoParser';
import { pluginManager } from '../plugins/PluginManager';
import { downloadCertificate } from '../plugins/CertificateGenerator';
import { ModuleQuizCard } from './ModuleQuizCard';
import { CertificateVerifyModal } from './CertificateVerifyModal';

interface CourseViewerProps {

  course: Course;
  currentUser: User;
  hasAccess: boolean;
  onOpenPaywall: () => void;
  /** Catálogo al que puede cambiar el alumno sin salir del reproductor. */
  courses?: Course[];
  onSelectCourse?: (course: Course) => void;
  onGoHome?: () => void;
}

export const CourseViewer: React.FC<CourseViewerProps> = ({
  course,
  currentUser,
  hasAccess,
  onOpenPaywall,
  courses = [],
  onSelectCourse,
  onGoHome,
}) => {
  const [activeModuleIndex, setActiveModuleIndex] = useState(0);
  const [activeVideoIndex, setActiveVideoIndex] = useState(0);
  // Mientras nadie elija lección a mano, el curso se abre por donde se dejó.
  const [pickedByUser, setPickedByUser] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [theaterMode, setTheaterMode] = useState(false);

  // Mentorship Q&A State
  const [comments, setComments] = useState<MentorshipComment[]>([]);
  const [newQuestion, setNewQuestion] = useState('');
  const [replyTextMap, setReplyTextMap] = useState<Record<string, string>>({});
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [filterMentorOnly, setFilterMentorOnly] = useState(false);
  const [loadingComments, setLoadingComments] = useState(false);

  // Gamified TTS Guide State
  const [currentTtsGuide, setCurrentTtsGuide] = useState<TTSGuide | null>(null);

  // Progress state
  const [completedVideos, setCompletedVideos] = useState<Record<string, boolean>>({});
  const [quizPassKey, setQuizPassKey] = useState<number>(0);
  const [certificate, setCertificate] = useState<CertificateRecord | null>(null);
  const [showVerifyModal, setShowVerifyModal] = useState(false);

  // Video Notes State
  const [videoNotes, setVideoNotes] = useState<VideoNote[]>([]);
  const [newNoteContent, setNewNoteContent] = useState('');
  const [noteTimestampStr, setNoteTimestampStr] = useState('01:30');

  const currentModule = course.modules[activeModuleIndex] || course.modules[0];
  const currentVideo: VideoDriveLink | undefined = currentModule?.videos[activeVideoIndex];

  // Load saved user progress on mount
  useEffect(() => {
    setPickedByUser(false);
    setActiveModuleIndex(0);
    setActiveVideoIndex(0);
    loadUserProgress();
  }, [course.id]);

  const loadUserProgress = async () => {
    try {
      const res = await api.getProgress();
      if (res.completedVideos) {
        setCompletedVideos(res.completedVideos);
      }
      if (res.certificates && res.certificates.length > 0) {
        const found = res.certificates.find((c) => c.courseId === course.id);
        if (found) setCertificate(found);
      }
    } catch (error) {
      console.error('Error loading saved progress:', error);
    }
  };

  // Retomar donde se quedó: abrir siempre por la primera clase obliga a buscar
  // a mano por dónde iba uno, y en un curso de cincuenta lecciones eso es una
  // tarea. Solo actúa hasta que el alumno elige otra lección.
  useEffect(() => {
    if (pickedByUser) return;
    const resume = findResumePosition(course, completedVideos);
    if (!resume) return;
    setActiveModuleIndex(resume.moduleIndex);
    setActiveVideoIndex(resume.videoIndex);
  }, [course.id, completedVideos, pickedByUser]);

  const goToLesson = (moduleIndex: number, videoIndex: number) => {
    setPickedByUser(true);
    setActiveModuleIndex(moduleIndex);
    setActiveVideoIndex(videoIndex);
  };

  const lessons = flattenLessons(course);
  const currentLessonIndex = indexOfLesson(lessons, {
    moduleIndex: activeModuleIndex,
    videoIndex: activeVideoIndex,
  });
  const previousLesson = stepLesson(course, { moduleIndex: activeModuleIndex, videoIndex: activeVideoIndex }, -1);
  const nextLesson = stepLesson(course, { moduleIndex: activeModuleIndex, videoIndex: activeVideoIndex }, 1);

  // Calculate overall course progress metrics
  const totalCourseVideos = course.modules.reduce((acc, m) => acc + m.videos.length, 0);
  const completedCourseVideos = countCompleted(course, completedVideos);
  const courseProgressPct = totalCourseVideos > 0 ? Math.round((completedCourseVideos / totalCourseVideos) * 100) : 0;

  // Fetch comments, TTS guides & Video Notes when video changes
  useEffect(() => {
    if (currentVideo?.id) {
      loadComments(currentVideo.id);
      loadTtsGuide(currentVideo.id);
      loadVideoNotes(currentVideo.id);
    }
  }, [currentVideo?.id]);

  const loadVideoNotes = async (videoId: string) => {
    try {
      const res = await api.getVideoNotes(videoId);
      if (res.notes) setVideoNotes(res.notes);
    } catch (err) {
      console.error('Error loading video notes:', err);
    }
  };

  const parseTimestampToSeconds = (timeStr: string): number => {
    const parts = timeStr.split(':').map((p) => parseInt(p, 10));
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      return parts[0] * 60 + parts[1];
    }
    return 0;
  };

  const handleAddVideoNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteContent.trim() || !currentVideo?.id) return;

    const seconds = parseTimestampToSeconds(noteTimestampStr);
    try {
      const res = await api.addVideoNote(currentVideo.id, seconds, newNoteContent);
      if (res.note) {
        setVideoNotes([res.note, ...videoNotes]);
        setNewNoteContent('');
      }
    } catch (err) {
      console.error('Error saving video note:', err);
    }
  };

  const loadTtsGuide = async (videoId: string) => {
    try {
      const res = await api.getTTSGuides({ videoId });
      if (res.guides && res.guides.length > 0) {
        setCurrentTtsGuide(res.guides[0]);
      } else {
        setCurrentTtsGuide(null);
      }
    } catch (error) {
      console.error('Error loading video TTS guide:', error);
      setCurrentTtsGuide(null);
    }
  };


  const loadComments = async (videoId: string) => {
    setLoadingComments(true);
    try {
      const res = await api.getVideoComments(videoId);
      setComments(res.comments || []);
    } catch (error) {
      console.error('Error loading mentorship comments:', error);
    } finally {
      setLoadingComments(false);
    }
  };

  const handlePostQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuestion.trim() || !currentVideo?.id) return;

    try {
      const res = await api.addComment(currentVideo.id, newQuestion);
      if (res.comment) {
        setComments([res.comment, ...comments]);
        
        // Execute Plugin Hook
        pluginManager.onCommentSubmit(currentUser, {
          videoTitle: currentVideo.title,
          content: newQuestion,
        });

        setNewQuestion('');
      }
    } catch (error) {
      console.error('Error posting mentorship question:', error);
    }
  };

  const handlePostReply = async (commentId: string) => {
    const text = replyTextMap[commentId];
    if (!text || !text.trim()) return;

    try {
      const res = await api.replyToComment(commentId, text);
      if (res.reply) {
        setComments((prev) =>
          prev.map((c) => {
            if (c.id === commentId) {
              return {
                ...c,
                isResolved: true,
                replies: [...(c.replies || []), res.reply],
              };
            }
            return c;
          })
        );
        setReplyTextMap((prev) => ({ ...prev, [commentId]: '' }));
        setReplyingToId(null);
      }
    } catch (error) {
      console.error('Error submitting reply:', error);
    }
  };

  const handleLikeComment = async (commentId: string) => {
    try {
      const res = await api.likeComment(commentId);
      if (res.success) {
        setComments((prev) =>
          prev.map((c) => (c.id === commentId ? { ...c, likes: res.likes } : c))
        );
      }
    } catch (error) {
      console.error('Error liking comment:', error);
    }
  };

  const toggleVideoCompletion = async (videoId: string) => {
    const isCompleted = !completedVideos[videoId];
    const newCompletedMap = { ...completedVideos, [videoId]: isCompleted };
    setCompletedVideos(newCompletedMap);

    try {
      const res = await api.toggleProgress(videoId, isCompleted);
      if (res.certificate) {
        setCertificate(res.certificate);
      }

      if (isCompleted && currentVideo) {
        // Trigger Plugin Hook for Lesson Complete
        pluginManager.onLessonComplete(currentUser, currentVideo);

        // Check if course reached 100% completion
        const completedCount = Object.keys(newCompletedMap).filter((id) => newCompletedMap[id]).length;
        if (totalCourseVideos > 0 && completedCount === totalCourseVideos) {
          pluginManager.onCourseComplete(currentUser, course);
        }
      }
    } catch (error) {
      console.error('Error toggling video progress:', error);
    }
  };

  const filteredComments = filterMentorOnly
    ? comments.filter((c) => c.isMentorResponse || (c.replies && c.replies.some((r) => r.isMentorResponse)))
    : comments;

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white flex flex-col animate-fade-in">
      
      {/* Top Banner / Course Header */}
      <div className="bg-[#141420] border-b border-[#2d2d44] px-4 py-3 sm:px-6 flex items-center justify-between text-xs text-slate-300">
        <div className="flex items-center gap-2 overflow-hidden">
          {/* Desde dentro de un curso no habia manera de volver ni de cambiar a
              otro: el alumno quedaba encerrado en el que abrio. */}
          {onGoHome && (
            <button
              onClick={onGoHome}
              title="Volver al inicio"
              className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-[#1a1a2e] border border-[#2d2d44] hover:border-[#06b6d4] text-slate-200 text-xs font-bold transition-all shrink-0"
            >
              <Home className="w-3.5 h-3.5 text-[#06b6d4]" />
              <span className="hidden sm:inline">Inicio</span>
            </button>
          )}

          {courses.length > 1 && onSelectCourse ? (
            <select
              value={course.id}
              onChange={(event) => {
                const selected = courses.find((item) => item.id === event.target.value);
                if (selected) onSelectCourse(selected);
              }}
              aria-label="Cambiar de curso"
              className="max-w-[16rem] bg-[#1a1a2e] border border-[#2d2d44] hover:border-[#06b6d4] rounded-lg px-2 py-1.5 text-xs font-bold text-[#06b6d4] focus:outline-none focus:border-[#06b6d4] truncate"
            >
              {courses.map((item) => (
                <option key={item.id} value={item.id} className="bg-[#141420] text-white">
                  {item.title}
                </option>
              ))}
            </select>
          ) : (
            <span className="font-bold text-[#06b6d4] truncate">{course.title}</span>
          )}
          <span className="text-slate-600 hidden sm:inline">•</span>
          <span className="text-slate-400 hidden sm:inline truncate">{currentModule?.title}</span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1a1a2e] border border-[#2d2d44] hover:border-[#06b6d4] text-slate-200 text-xs font-medium transition-all"
          >
            {sidebarOpen ? <ChevronLeft className="w-4 h-4 text-[#06b6d4]" /> : <ChevronRight className="w-4 h-4 text-[#06b6d4]" />}
            <span className="hidden sm:inline">{sidebarOpen ? 'Ocultar Temario' : 'Ver Temario'}</span>
          </button>
        </div>
      </div>

      {/* Main Course Layout: Sidebar + Central Video + Mentorship QA */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        
        {/* Left Sidebar: Modules & Lessons */}
        <div
          className={`bg-[#141420] border-r border-[#2d2d44] transition-all duration-300 flex flex-col shrink-0 ${
            sidebarOpen ? 'w-full lg:w-80' : 'w-0 hidden lg:flex overflow-hidden opacity-0'
          }`}
        >
          {/* Sidebar Header with Overall Course Progress Bar */}
          <div className="p-4 border-b border-[#2d2d44] bg-[#1a1a2e]">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <PlayCircle className="w-4 h-4 text-[#06b6d4]" /> Temario del Programa
              </h3>
              <span className="text-[11px] font-bold text-white bg-brand-gradient px-2.5 py-0.5 rounded-lg shadow-sm">
                {courseProgressPct}% Completado
              </span>
            </div>

            {/* Overall Course Progress Bar */}
            <div className="w-full bg-[#0a0a0f] rounded-full h-2 border border-[#2d2d44] overflow-hidden">
              <div
                className="bg-gradient-to-r from-[#06b6d4] to-[#a855f7] h-full transition-all duration-500 rounded-full"
                style={{ width: `${courseProgressPct}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1.5 font-mono">
              <span>{completedCourseVideos} de {totalCourseVideos} lecciones</span>
              <span>{course.modules.length} Módulos</span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-[#2d2d44]">
            {course.modules.map((module, mIdx) => {
              const isCurrentModule = mIdx === activeModuleIndex;
              const isUnlocked = pluginManager.isModuleUnlocked(course.modules, mIdx, currentUser.id);

              // Module Progress Metrics
              const modTotal = module.videos.length;
              const modCompletedCount = module.videos.filter((v) => completedVideos[v.id]).length;
              const isModComplete = modTotal > 0 && modCompletedCount === modTotal;
              const modPct = modTotal > 0 ? Math.round((modCompletedCount / modTotal) * 100) : 0;

              return (
                <div key={module.id} className="bg-[#141420]">
                  <button
                    onClick={() => {
                      if (!isUnlocked) {
                        alert('🔒 Este módulo se encuentra bloqueado. Debes aprobar el examen del módulo anterior con al menos 80% para desbloquearlo.');
                        return;
                      }
                      goToLesson(mIdx, 0);
                    }}
                    className={`w-full p-3.5 text-left flex items-start justify-between gap-2 transition-colors ${
                      !isUnlocked ? 'opacity-60 cursor-not-allowed bg-[#0f0f18]' : 'hover:bg-[#1a1a2e]'
                    } ${isCurrentModule ? 'bg-[#1a1a2e] border-l-4 border-[#a855f7]' : ''}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase text-[#06b6d4] tracking-wider">
                          Módulo 0{mIdx + 1}
                        </span>
                        {!isUnlocked && (
                          <span className="text-[9px] font-extrabold text-amber-400 bg-amber-500/10 border border-amber-500/30 px-1.5 py-0.2 rounded flex items-center gap-1">
                            <Lock className="w-2.5 h-2.5" /> Bloqueado
                          </span>
                        )}
                        {isUnlocked && isModComplete && (
                          <span className="text-[9px] font-extrabold text-[#06b6d4] bg-[#06b6d4]/10 border border-[#06b6d4]/30 px-1.5 py-0.2 rounded">
                            Completado
                          </span>
                        )}
                      </div>

                      <h4 className="font-semibold text-xs text-slate-200 line-clamp-2 mt-0.5">
                        {module.title}
                      </h4>

                      {/* Mini Module Progress Bar */}
                      <div className="w-full bg-[#0a0a0f] rounded-full h-1 mt-2 overflow-hidden border border-[#2d2d44]">
                        <div
                          className={`h-full transition-all duration-300 ${
                            isModComplete ? 'bg-[#06b6d4]' : 'bg-[#a855f7]'
                          }`}
                          style={{ width: `${modPct}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {!isUnlocked ? (
                        <Lock className="w-4 h-4 text-slate-500" />
                      ) : isModComplete ? (
                        <CheckCircle2 className="w-4 h-4 text-[#06b6d4]" />
                      ) : (
                        <span className="text-[10px] bg-[#0a0a0f] text-slate-400 px-1.5 py-0.5 rounded-lg font-mono border border-[#2d2d44]">
                          {modCompletedCount}/{modTotal}
                        </span>
                      )}
                    </div>
                  </button>

                  {/* Module Lessons List */}
                  {isCurrentModule && (
                    <div className="bg-[#0a0a0f] divide-y divide-[#2d2d44] pl-2">
                      {module.videos.map((video, vIdx) => {
                        const isCurrentVideo = vIdx === activeVideoIndex;
                        const isCompleted = completedVideos[video.id];

                        return (
                          <div
                            key={video.id}
                            onClick={() => {
                              if (!hasAccess) {
                                onOpenPaywall();
                              } else {
                                goToLesson(mIdx, vIdx);
                              }
                            }}
                            className={`w-full p-3 text-left flex items-center justify-between gap-2 hover:bg-[#141420] transition-colors text-xs cursor-pointer ${
                              isCurrentVideo ? 'bg-[#1a1a2e] text-[#06b6d4] font-semibold border-l-2 border-[#06b6d4]' : 'text-slate-400'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleVideoCompletion(video.id);
                                }}
                                className="shrink-0 focus:outline-none transition-transform hover:scale-110"
                                title={isCompleted ? 'Marcar como pendiente' : 'Marcar como completada'}
                              >
                                {isCompleted ? (
                                  <CheckCircle2 className="w-4 h-4 text-[#06b6d4] fill-[#06b6d4]/10" />
                                ) : (
                                  <div className="w-4 h-4 rounded-full border border-[#2d2d44] hover:border-[#06b6d4]" />
                                )}
                              </button>
                              <span className={`truncate ${isCompleted ? 'text-slate-300' : ''}`}>
                                {video.title}
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              {isCompleted && (
                                <span className="text-[9px] font-bold text-[#06b6d4] bg-[#06b6d4]/10 border border-[#06b6d4]/30 px-1.5 py-0.2 rounded">
                                  ✓ Completado
                                </span>
                              )}
                              {!hasAccess && <Lock className="w-3 h-3 text-[#f97316]" />}
                              {video.duration && <span className="text-[10px] text-slate-400 font-mono">{video.duration}</span>}
                            </div>
                          </div>
                        );
                      })}

                      {/* Module Resources */}
                      {hasAccess && module.resources && module.resources.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-[#2d2d44]/50 space-y-1">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-1">
                            Recursos del Módulo
                          </span>
                          {module.resources.map((res) => (
                            <a
                              key={res.id}
                              href={res.downloadUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center justify-between p-2 rounded-lg bg-[#141420] hover:bg-[#202034] text-slate-300 hover:text-white transition-all text-xs border border-[#2d2d44]/60 group"
                            >
                              <div className="flex items-center gap-2 truncate">
                                <Download className="w-3.5 h-3.5 text-[#06b6d4] shrink-0" />
                                <span className="truncate">{res.title}</span>
                              </div>
                              <span className="text-[9px] font-mono bg-[#0a0a0f] text-slate-400 px-1.5 py-0.5 rounded shrink-0">
                                {res.kind}
                              </span>
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Course-wide Resources */}
            {hasAccess && course.resources && course.resources.length > 0 && (
              <div className="mt-4 p-3 rounded-xl bg-[#141420] border border-[#2d2d44] space-y-2">
                <span className="text-[11px] font-extrabold text-[#06b6d4] uppercase tracking-wider flex items-center gap-1.5">
                  <FileCode className="w-3.5 h-3.5" /> Recursos del Programa
                </span>
                <div className="space-y-1">
                  {course.resources.map((res) => (
                    <a
                      key={res.id}
                      href={res.downloadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between p-2 rounded-lg bg-[#0a0a0f] hover:bg-[#1a1a2e] text-slate-300 hover:text-white text-xs border border-[#2d2d44]/50 group transition-all"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <Download className="w-3.5 h-3.5 text-[#a855f7] shrink-0" />
                        <span className="truncate">{res.title}</span>
                      </div>
                      <ExternalLink className="w-3 h-3 text-slate-500 group-hover:text-white shrink-0" />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Central Content Column: Video Player & Mentorship Section */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5">
          
          {/* Active TTS Mentorship Guide Widget */}
          {hasAccess && currentTtsGuide && (
            <MentorTTSGuideWidget
              guide={currentTtsGuide}
              onRewardEarned={(xp) => {
                console.log(`Earned ${xp} XP for completing TTS guide!`);
              }}
            />
          )}

          {/* Main Multi-Provider Video Player Container */}
          <div className="bg-[#141420] rounded-2xl border border-[#2d2d44] overflow-hidden shadow-2xl">
            
            {hasAccess && currentVideo ? (
              <div className="relative">
                {/* 16:9 Responsive Embed Player */}
                <div className={`relative w-full bg-black ${theaterMode ? 'aspect-[21/9]' : 'aspect-video'}`}>
                  <iframe
                    src={parseVideoSource(currentVideo.playbackUrl || currentVideo.embedUrl || currentVideo.driveFileId).embedUrl}
                    title={currentVideo.title}
                    className="w-full h-full border-0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
                    allowFullScreen
                  />
                </div>

                {/* Video Info Bar below player */}
                <div className="p-4 bg-[#141420] border-t border-[#2d2d44] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div>
                    <div className="flex items-center gap-2 text-xs font-semibold mb-1">
                      {parseVideoSource(currentVideo.embedUrl || currentVideo.driveFileId).provider === 'youtube' && (
                        <span className="text-red-400 flex items-center gap-1">
                          <Youtube className="w-3.5 h-3.5" /> YouTube HD Stream
                        </span>
                      )}
                      {parseVideoSource(currentVideo.embedUrl || currentVideo.driveFileId).provider === 'drive' && (
                        <span className="text-[#06b6d4] flex items-center gap-1">
                          <HardDrive className="w-3.5 h-3.5" /> Google Drive Video Engine
                        </span>
                      )}
                      {parseVideoSource(currentVideo.embedUrl || currentVideo.driveFileId).provider === 'embed' && (
                        <span className="text-purple-400 flex items-center gap-1">
                          <Code className="w-3.5 h-3.5" /> Reproductor Embebido HTML
                        </span>
                      )}
                      <span className="text-slate-400">• Módulo {activeModuleIndex + 1}</span>
                    </div>
                    <h1 className="text-lg font-bold text-white tracking-tight">{currentVideo.title}</h1>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {/* Sin estos dos botones, avanzar exigía buscar la lección
                        siguiente en la lista lateral, una por una. */}
                    <button
                      onClick={() => previousLesson && goToLesson(previousLesson.moduleIndex, previousLesson.videoIndex)}
                      disabled={!previousLesson}
                      title={previousLesson ? 'Lección anterior' : 'Estás en la primera lección'}
                      className="px-3 py-1.5 rounded-lg bg-[#1a1a2e] border border-[#2d2d44] hover:border-[#06b6d4] text-slate-300 text-xs font-bold flex items-center gap-1.5 transition-all disabled:opacity-40 disabled:hover:border-[#2d2d44] disabled:cursor-not-allowed"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      <span className="hidden sm:inline">Anterior</span>
                    </button>

                    {currentLessonIndex >= 0 && lessons.length > 0 && (
                      <span className="text-[11px] font-mono text-slate-500 px-1">
                        {currentLessonIndex + 1}/{lessons.length}
                      </span>
                    )}

                    <button
                      onClick={() => nextLesson && goToLesson(nextLesson.moduleIndex, nextLesson.videoIndex)}
                      disabled={!nextLesson}
                      title={nextLesson ? 'Lección siguiente' : 'Es la última lección del curso'}
                      className="px-3 py-1.5 rounded-lg bg-[#1a1a2e] border border-[#2d2d44] hover:border-[#06b6d4] text-slate-300 text-xs font-bold flex items-center gap-1.5 transition-all disabled:opacity-40 disabled:hover:border-[#2d2d44] disabled:cursor-not-allowed"
                    >
                      <span className="hidden sm:inline">Siguiente</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => setTheaterMode(!theaterMode)}
                      className="px-3 py-1.5 rounded-lg bg-[#1a1a2e] border border-[#2d2d44] hover:border-[#06b6d4] text-slate-300 text-xs flex items-center gap-1.5 transition-all"
                    >
                      <Maximize2 className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Modo Cine</span>
                    </button>

                    <button
                      onClick={() => toggleVideoCompletion(currentVideo.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                        completedVideos[currentVideo.id]
                          ? 'bg-[#06b6d4]/20 text-[#06b6d4] border border-[#06b6d4]/40'
                          : 'btn-brand-primary'
                      }`}
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      {completedVideos[currentVideo.id] ? 'Completada' : 'Marcar Completada'}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* Paywall Preview Card when locked */
              <div className="p-10 text-center space-y-4">
                <div className="w-16 h-16 rounded-xl bg-brand-gradient text-white flex items-center justify-center mx-auto shadow-lg shadow-[#a855f7]/20">
                  <Lock className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-white">Contenido Bloqueado por Muro de Pago</h3>
                <p className="text-sm text-slate-400 max-w-lg mx-auto">
                  Accede a los videos de Google Drive y la caja de mentoría directa con el Profesor Giantucchi realizando la suscripción o activando tu Pase VIP.
                </p>
                <button
                  onClick={onOpenPaywall}
                  className="btn-brand-primary px-6 py-3 text-sm font-extrabold shadow-xl"
                >
                  Ver Opciones de Acceso y Pase VIP
                </button>
              </div>
            )}

          </div>

          {/* Certificate Download Banner when Course Completed */}
          {/* El diploma pertenece al final del curso: mostrarlo bajo cada lección
              anunciaba «Disponible» desde la primera clase. */}
          {hasAccess &&
            pluginManager.isEnabled('pdf-certificates') &&
            (courseProgressPct === 100 || certificate) && (
            <div className="bg-gradient-to-r from-[#0a0a0f] via-[#141420] to-[#1a1a2e] border-2 border-[#eab308] rounded-2xl p-6 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-[#eab308]/20 border border-[#eab308]/40 rounded-2xl text-[#eab308] shrink-0">
                  <Award className="w-8 h-8" />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-extrabold text-base text-white">Certificado Oficial de Formación</h3>
                    <span className="text-[10px] font-black bg-[#eab308] text-black px-2 py-0.5 rounded-full uppercase">
                      {courseProgressPct === 100 ? '100% Completado' : 'Disponible'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300">
                    Acredita tus competencias técnicas con el diploma oficial emitido por la Academia Giantucchi.
                  </p>
                  {certificate?.verificationCode && (
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-[11px] text-slate-400">Código de Verificación:</span>
                      <span className="font-mono text-xs font-bold text-amber-400 bg-black/60 px-2 py-0.5 rounded border border-[#eab308]/30">
                        {certificate.verificationCode}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 w-full md:w-auto justify-end">
                {certificate?.verificationCode && (
                  <button
                    onClick={() => setShowVerifyModal(true)}
                    className="px-4 py-3 bg-[#1a1a2e] hover:bg-[#25253e] text-amber-300 border border-[#eab308]/40 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all"
                  >
                    <ShieldCheck className="w-4 h-4 text-amber-400" />
                    <span>Verificar Código</span>
                  </button>
                )}
                <button
                  onClick={() =>
                    downloadCertificate({
                      studentName: currentUser.name,
                      courseTitle: course.title,
                      certificateId: certificate?.verificationCode,
                    })
                  }
                  className="px-5 py-3 bg-gradient-to-r from-[#eab308] to-[#f59e0b] hover:opacity-90 text-black font-extrabold text-xs rounded-xl shadow-lg flex items-center gap-2 transition-all"
                >
                  <Award className="w-4 h-4" />
                  <span>Descargar Diploma</span>
                </button>
              </div>
            </div>
          )}

          {/* Plugin: Interactive Module Quiz Card */}
          {hasAccess && pluginManager.isEnabled('interactive-quizzes') && currentModule && (
            <ModuleQuizCard
              key={`${currentModule.id}_${quizPassKey}`}
              module={currentModule}
              user={currentUser}
              onPassed={(score) => {
                console.log(`Quiz passed with ${score}% score!`);
                setQuizPassKey((prev) => prev + 1);
              }}
            />
          )}

          {/* Video Notes (Notas de Lección Temporizadas) */}
          {hasAccess && (
            <div className="bg-[#141420] border border-[#2d2d44] rounded-2xl p-5 md:p-6 space-y-4 shadow-xl">
              <div className="flex items-center justify-between border-b border-[#2d2d44] pb-3">
                <div className="flex items-center gap-2 text-white font-bold text-sm">
                  <Bookmark className="w-5 h-5 text-[#06b6d4]" />
                  <span>Notas Personales de la Lección</span>
                  <span className="text-xs bg-[#06b6d4]/10 text-[#06b6d4] font-mono px-2 py-0.5 rounded-md border border-[#06b6d4]/20">
                    {videoNotes.length}
                  </span>
                </div>
                <span className="text-xs text-slate-400">Guarda apuntes vinculados al minuto del video</span>
              </div>

              <form onSubmit={handleAddVideoNote} className="flex flex-col sm:flex-row gap-2">
                <div className="flex items-center gap-2 bg-[#0a0a0f] border border-[#2d2d44] rounded-xl px-3 py-1.5 shrink-0">
                  <Clock className="w-4 h-4 text-[#a855f7]" />
                  <input
                    type="text"
                    value={noteTimestampStr}
                    onChange={(e) => setNoteTimestampStr(e.target.value)}
                    placeholder="01:30"
                    className="w-16 bg-transparent text-xs text-white font-mono focus:outline-none"
                  />
                </div>
                <input
                  type="text"
                  placeholder="Escribe un apunte importante sobre este segundo..."
                  value={newNoteContent}
                  onChange={(e) => setNewNoteContent(e.target.value)}
                  className="flex-1 bg-[#0a0a0f] border border-[#2d2d44] rounded-xl px-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#06b6d4]"
                />
                <button
                  type="submit"
                  disabled={!newNoteContent.trim()}
                  className="px-4 py-2 bg-[#06b6d4] hover:bg-[#06b6d4]/80 disabled:opacity-50 text-black font-extrabold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all shrink-0"
                >
                  <FileText className="w-4 h-4" />
                  <span>Guardar Nota</span>
                </button>
              </form>

              {videoNotes.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  {videoNotes.map((note) => {
                    const min = Math.floor(note.timestampSeconds / 60);
                    const sec = note.timestampSeconds % 60;
                    const timeLabel = `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
                    return (
                      <div
                        key={note.id}
                        className="bg-[#1a1a2e] border border-[#2d2d44] hover:border-[#06b6d4]/40 rounded-xl p-3 flex items-start gap-3 transition-all"
                      >
                        <span className="px-2 py-1 rounded-lg bg-[#a855f7]/10 border border-[#a855f7]/30 text-[#a855f7] font-mono text-xs font-bold shrink-0">
                          ⏱ {timeLabel}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-slate-200 font-medium leading-relaxed truncate">
                            {note.content}
                          </p>
                          <span className="text-[10px] text-slate-500 block mt-1">
                            {new Date(note.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
          <div className="bg-[#141420] rounded-xl border border-[#2d2d44] p-5 md:p-6 space-y-6 shadow-xl">
            
            {/* Header with Filter options */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#2d2d44] pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-[#06b6d4]" />
                  <h3 className="font-bold text-base text-white">Caja de Mentoría y Preguntas</h3>
                  <span className="text-xs font-bold bg-[#1a1a2e] border border-[#2d2d44] text-[#a855f7] px-2 py-0.5 rounded-full animate-pulse-slow">
                    {comments.length}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Haz tus consultas de esta clase directamente a los mentores de la Academia Giantucchi.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setFilterMentorOnly(!filterMentorOnly)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                    filterMentorOnly
                      ? 'bg-brand-gradient text-white shadow-md'
                      : 'bg-[#1a1a2e] border border-[#2d2d44] text-slate-300 hover:text-white'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-[#a855f7]" />
                  Respuestas del Mentor
                </button>
              </div>
            </div>

            {/* Post New Question Box */}
            {hasAccess ? (
              <form onSubmit={handlePostQuestion} className="space-y-3 bg-[#1a1a2e] p-4 rounded-xl border border-[#2d2d44]">
                <div className="flex items-center gap-2 text-xs text-[#06b6d4] font-semibold">
                  <HelpCircle className="w-4 h-4 text-[#06b6d4]" /> Realizar una Pregunta de Mentoría:
                </div>
                <textarea
                  rows={2}
                  placeholder="Escribe tu duda técnica o consulta sobre esta lección..."
                  value={newQuestion}
                  onChange={(e) => setNewQuestion(e.target.value)}
                  className="w-full bg-[#0a0a0f] border border-[#2d2d44] rounded-xl p-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#06b6d4]"
                />
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={!newQuestion.trim()}
                    className="btn-brand-primary px-4 py-2 text-xs font-extrabold flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" />
                    Publicar Consulta
                  </button>
                </div>
              </form>
            ) : (
              <div className="p-4 bg-[#1a1a2e] rounded-xl border border-[#2d2d44] text-xs text-slate-400 text-center">
                Debes tener un pase activo o VIP para realizar preguntas de mentoría en esta lección.
              </div>
            )}

            {/* Comments & Replies List */}
            <div className="space-y-4">
              {filteredComments.map((comment) => (
                <div
                  key={comment.id}
                  className="bg-[#1a1a2e] border border-[#2d2d44] rounded-xl p-4 space-y-3"
                >
                  {/* User Author Bar */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <img
                        src={comment.userAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
                        alt={comment.userName}
                        className="w-7 h-7 rounded-full object-cover ring-1 ring-[#2d2d44]"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-xs text-white">{comment.userName}</span>
                          {comment.userRole === 'ADMIN' && (
                            <span className="text-[10px] bg-[#a855f7]/20 text-[#a855f7] font-bold px-2 py-0.5 rounded-lg border border-[#a855f7]/30 flex items-center gap-1">
                              <ShieldCheck className="w-3 h-3 text-[#a855f7]" /> MENTOR OFICIAL
                            </span>
                          )}
                          {comment.userRole === 'VIP' && (
                            <span className="text-[10px] bg-brand-gradient text-white font-bold px-1.5 py-0.5 rounded-lg shadow-sm">
                              VIP
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-500">
                          {new Date(comment.createdAt).toLocaleDateString('es-ES', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleLikeComment(comment.id)}
                      className="flex items-center gap-1 text-xs text-slate-400 hover:text-[#06b6d4] transition-colors bg-[#0a0a0f] px-2.5 py-1 rounded-lg border border-[#2d2d44]"
                    >
                      <ThumbsUp className="w-3.5 h-3.5" />
                      <span>{comment.likes}</span>
                    </button>
                  </div>

                  {/* Comment Body */}
                  <p className="text-xs md:text-sm text-slate-200 leading-relaxed pl-9">
                    {comment.content}
                  </p>

                  {/* Mentor Replies List */}
                  {comment.replies && comment.replies.length > 0 && (
                    <div className="pl-9 space-y-2 pt-2 border-t border-[#2d2d44]">
                      {comment.replies.map((reply) => (
                        <div
                          key={reply.id}
                          className="bg-[#141420] border border-[#a855f7]/40 rounded-xl p-3 space-y-1.5"
                        >
                          <div className="flex items-center gap-2">
                            <img
                              src={reply.userAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                              alt={reply.userName}
                              className="w-6 h-6 rounded-full object-cover"
                            />
                            <span className="font-bold text-xs text-[#a855f7]">{reply.userName}</span>
                            <span className="text-[9px] bg-[#a855f7]/20 text-[#a855f7] font-extrabold px-1.5 py-0.5 rounded-lg uppercase tracking-wider">
                              Respuesta Oficial Giantucchi
                            </span>
                          </div>
                          <p className="text-xs text-slate-200 leading-normal pl-8">
                            {reply.content}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Admin / Mentor Reply Form */}
                  {currentUser.role === 'ADMIN' && (
                    <div className="pl-9 pt-2">
                      {replyingToId === comment.id ? (
                        <div className="space-y-2">
                          <textarea
                            rows={2}
                            placeholder="Escribe una respuesta como Mentor Giantucchi..."
                            value={replyTextMap[comment.id] || ''}
                            onChange={(e) =>
                              setReplyTextMap({ ...replyTextMap, [comment.id]: e.target.value })
                            }
                            className="w-full bg-[#0a0a0f] border border-[#a855f7]/50 rounded-xl p-2 text-xs text-white focus:outline-none"
                          />
                          <div className="flex gap-2 justify-end">
                            <button
                              onClick={() => setReplyingToId(null)}
                              className="text-xs text-slate-400 hover:text-white px-2 py-1"
                            >
                              Cancelar
                            </button>
                            <button
                              onClick={() => handlePostReply(comment.id)}
                              className="px-3 py-1 bg-[#a855f7] hover:bg-[#a855f7]/80 text-white font-bold text-xs rounded-lg flex items-center gap-1 shadow-md"
                            >
                              <ShieldCheck className="w-3 h-3" /> Responder como Mentor
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => setReplyingToId(comment.id)}
                          className="text-xs text-[#a855f7] hover:underline font-semibold flex items-center gap-1"
                        >
                          <MessageSquare className="w-3 h-3" /> Responder como Mentor Giantucchi
                        </button>
                      )}
                    </div>
                  )}

                </div>
              ))}
            </div>

          </div>

        </div>

      </div>

      {/* Certificate Public Verification Modal */}
      <CertificateVerifyModal
        isOpen={showVerifyModal}
        onClose={() => setShowVerifyModal(false)}
        initialCode={certificate?.verificationCode}
      />
    </div>
  );
};
