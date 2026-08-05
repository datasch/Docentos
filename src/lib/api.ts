/**
 * Cliente de API para Academia Giantucchi
 * Gestiona llamadas al backend de Express, RBAC y Google Drive
 */

import { User, Course, MentorshipComment, DriveVideoFile, CourseAccessStatus, UserRole, TTSGuide, LandingConfig } from '../types';

export const api = {

  // User & Auth
  async login(email: string, password?: string): Promise<{ success: boolean; token: string; user: User; redirectPath: string }> {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: password || '123456' }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Error al iniciar sesión');
    }
    return res.json();
  },

  async register(name: string, email: string, password?: string, role?: UserRole): Promise<{ success: boolean; token: string; user: User; redirectPath: string }> {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password: password || '123456', role }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Error al registrar usuario');
    }
    return res.json();
  },

  async logout(): Promise<{ success: boolean }> {
    const res = await fetch('/api/auth/logout', { method: 'POST' });
    if (!res.ok) throw new Error('Error al cerrar sesión');
    return res.json();
  },

  async getCurrentUser(): Promise<{ user: User; allDemoUsers: User[]; hasPaidDefaultCourse: boolean }> {
    const res = await fetch('/api/me');
    if (!res.ok) throw new Error('Error al obtener usuario');
    return res.json();
  },

  async switchRole(role?: UserRole, userId?: string): Promise<{ success: boolean; user: User }> {
    const res = await fetch('/api/users/switch-role', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role, userId }),
    });
    if (!res.ok) throw new Error('Error al cambiar rol');
    return res.json();
  },

  // Courses & Access
  async getCourses(): Promise<{ courses: Course[]; userRole: UserRole; hasAccess: boolean }> {
    const res = await fetch('/api/courses');
    if (!res.ok) throw new Error('Error al obtener cursos');
    return res.json();
  },

  async getCourseAccess(courseId: string): Promise<CourseAccessStatus> {
    const res = await fetch(`/api/courses/${courseId}/access`);
    if (!res.ok) throw new Error('Error al consultar acceso');
    return res.json();
  },

  // Paywall & Payments
  async checkoutCourse(courseId: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch('/api/payments/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ courseId }),
    });
    if (!res.ok) throw new Error('Error al procesar pago');
    return res.json();
  },

  async activateVipPass(): Promise<{ success: boolean; message: string; user: User }> {
    const res = await fetch('/api/vip/activate', {
      method: 'POST',
    });
    if (!res.ok) throw new Error('Error al activar Pase VIP');
    return res.json();
  },

  // Google Drive API
  async searchDriveVideos(query?: string, folderId?: string): Promise<{ success: boolean; videos: DriveVideoFile[] }> {
    const params = new URLSearchParams();
    if (query) params.append('q', query);
    if (folderId) params.append('folderId', folderId);

    const res = await fetch(`/api/drive/videos?${params.toString()}`);
    if (!res.ok) throw new Error('Error al buscar videos en Drive');
    return res.json();
  },

  // Comments & Mentorship Q&A
  async getVideoComments(videoId: string): Promise<{ comments: MentorshipComment[] }> {
    const res = await fetch(`/api/videos/${videoId}/comments`);
    if (!res.ok) throw new Error('Error al cargar comentarios de mentoría');
    return res.json();
  },

  async addComment(videoId: string, content: string): Promise<{ success: boolean; comment: MentorshipComment }> {
    const res = await fetch(`/api/videos/${videoId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });
    if (!res.ok) throw new Error('Error al publicar pregunta de mentoría');
    return res.json();
  },

  async replyToComment(commentId: string, content: string): Promise<{ success: boolean; reply: MentorshipComment }> {
    const res = await fetch(`/api/comments/${commentId}/reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });
    if (!res.ok) throw new Error('Error al responder comentario');
    return res.json();
  },

  async likeComment(commentId: string): Promise<{ success: boolean; likes: number }> {
    const res = await fetch(`/api/comments/${commentId}/like`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error('Error al dar me gusta');
    return res.json();
  },

  // Progress
  async getProgress(): Promise<{ success: boolean; completedVideos: Record<string, boolean> }> {
    const res = await fetch('/api/progress');
    if (!res.ok) throw new Error('Error al obtener progreso');
    return res.json();
  },

  async toggleProgress(videoId: string, completed: boolean): Promise<{ success: boolean }> {
    const res = await fetch('/api/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoId, completed }),
    });
    if (!res.ok) throw new Error('Error al actualizar progreso');
    return res.json();
  },

  // Admin Management
  async getLandingConfig(): Promise<{ success: boolean; config: LandingConfig }> {
    const res = await fetch('/api/public/landing-config');
    if (!res.ok) throw new Error('Error al obtener la configuración de la portada');
    return res.json();
  },

  async updateLandingConfig(configData: Partial<LandingConfig>): Promise<{ success: boolean; config: LandingConfig; message: string }> {
    const res = await fetch('/api/admin/landing-config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(configData),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Error al actualizar la configuración de la portada');
    }
    return res.json();
  },

  async getAdminUsers(): Promise<{ users: User[] }> {
    const res = await fetch('/api/admin/users');
    if (!res.ok) throw new Error('Error al cargar usuarios');
    return res.json();
  },

  async updateUserRole(userId: string, role: UserRole): Promise<{ success: boolean; user: User }> {
    const res = await fetch(`/api/admin/users/${userId}/role`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    });
    if (!res.ok) throw new Error('Error al actualizar rol');
    return res.json();
  },

  async addDriveVideoToModule(moduleId: string, videoData: Partial<DriveVideoFile>): Promise<{ success: boolean }> {
    const res = await fetch(`/api/admin/modules/${moduleId}/videos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        driveFileId: videoData.id,
        title: videoData.name,
        duration: videoData.duration || '20:00',
        embedUrl: videoData.embedUrl,
      }),
    });
    if (!res.ok) throw new Error('Error al enlazar video de Drive');
    return res.json();
  },

  // TTS Gamified Guides
  async getTTSGuides(params?: { videoId?: string; courseId?: string }): Promise<{ guides: TTSGuide[] }> {
    const urlParams = new URLSearchParams();
    if (params?.videoId) urlParams.append('videoId', params.videoId);
    if (params?.courseId) urlParams.append('courseId', params.courseId);

    const res = await fetch(`/api/tts-guides?${urlParams.toString()}`);
    if (!res.ok) throw new Error('Error al cargar guías TTS');
    return res.json();
  },

  async createTTSGuide(guideData: Partial<TTSGuide>): Promise<{ success: boolean; guide: TTSGuide; message: string }> {
    const res = await fetch('/api/tts-guides', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(guideData),
    });
    if (!res.ok) throw new Error('Error al guardar guía TTS');
    return res.json();
  },

  async deleteTTSGuide(id: string): Promise<{ success: boolean }> {
    const res = await fetch(`/api/tts-guides/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Error al eliminar guía TTS');
    return res.json();
  },

  // AI Script Generator
  async generateScriptWithAI(data: { lessonTitle: string; language?: string; customInstructions?: string }): Promise<{ success: boolean; scriptText: string; message: string }> {
    const res = await fetch('/api/ai/generate-script', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Error al generar guion con IA');
    return res.json();
  },

  // Student Onboarding Feedback
  async submitFeedback(data: { rating: number; comment?: string }): Promise<{ success: boolean; message: string }> {
    const res = await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Error al enviar opinión');
    return res.json();
  },

  async getFeedback(): Promise<{ feedback: any[] }> {
    const res = await fetch('/api/feedback');
    if (!res.ok) throw new Error('Error al obtener lista de opiniones');
    return res.json();
  },

  // Plugin System API
  async getPlugins(): Promise<{ success: boolean; plugins: any[] }> {
    const res = await fetch('/api/plugins');
    if (!res.ok) throw new Error('Error al obtener plugins');
    return res.json();
  },

  async togglePlugin(pluginId: string, enabled?: boolean): Promise<{ success: boolean; plugin: any; plugins: any[] }> {
    const res = await fetch('/api/plugins/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pluginId, enabled }),
    });
    if (!res.ok) throw new Error('Error al cambiar estado del plugin');
    return res.json();
  },

  async updatePluginConfig(pluginId: string, config: Record<string, any>): Promise<{ success: boolean; plugin: any; plugins: any[] }> {
    const res = await fetch('/api/plugins/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pluginId, config }),
    });
    if (!res.ok) throw new Error('Error al guardar configuración del plugin');
    return res.json();
  },

  // Mentor Dashboard API
  async getMentorMentees(): Promise<{ success: boolean; mentees: any[] }> {
    const res = await fetch('/api/mentor/mentees');
    if (!res.ok) throw new Error('Error al obtener mentees');
    return res.json();
  },

  async assignMentee(name: string, email: string, mentorId?: string): Promise<{ success: boolean; mentee: any }> {
    const res = await fetch('/api/mentor/assign-mentee', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, mentorId }),
    });
    if (!res.ok) throw new Error('Error al asignar mentee');
    return res.json();
  },

  // Moderation API
  async updateUserModeration(userId: string, data: { strikes?: number; isActive?: boolean }): Promise<{ success: boolean; user: any }> {
    const res = await fetch(`/api/admin/users/${userId}/moderation`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Error al actualizar moderación del usuario');
    return res.json();
  },

  // Video Notes API
  async getVideoNotes(videoId: string): Promise<{ success: boolean; notes: any[] }> {
    const res = await fetch(`/api/notes/${videoId}`);
    if (!res.ok) throw new Error('Error al cargar notas de la lección');
    return res.json();
  },

  async addVideoNote(videoId: string, timestampSeconds: number, content: string): Promise<{ success: boolean; note: any }> {
    const res = await fetch('/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoId, timestampSeconds, content }),
    });
    if (!res.ok) throw new Error('Error al guardar nota');
    return res.json();
  },

  async updateCoursePrice(courseId: string, price: number): Promise<{ success: boolean; course: any }> {
    const res = await fetch(`/api/courses/${courseId}/price`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ price }),
    });
    if (!res.ok) throw new Error('Error al actualizar precio del curso');
    return res.json();
  },
};

