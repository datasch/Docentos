/**
 * Cliente de API para Academia Giantucchi
 * Gestiona llamadas al backend de Express, RBAC y Google Drive
 */

import {
  User,
  Course,
  MentorshipComment,
  DriveVideoFile,
  CourseAccessStatus,
  UserRole,
  TTSGuide,
  LandingConfig,
  CertificateRecord,
  CourseEnrollmentRecord,
  CourseResource,
  PaymentRecord,
  ImportPlan,
  ImportPreviewResponse,
  ImportOrganizeResponse,
  ImportApplyResponse,
} from '../types';

const fetch: typeof globalThis.fetch = (input, init) =>
  globalThis.fetch(input, { ...init, credentials: 'include' });

export const api = {

  // User & Auth
  async login(email: string, password: string): Promise<{ success: boolean; user: User; redirectPath: string }> {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Error al iniciar sesión');
    }
    return res.json();
  },

  async register(name: string, email: string, password: string): Promise<{ success: boolean; user: User; redirectPath: string }> {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
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

  async getCurrentUser(): Promise<{
    authenticated: boolean;
    user: User | null;
    hasAccess: boolean;
    sessionExpiresAt?: string;
  }> {
    const res = await fetch('/api/auth/me');
    if (!res.ok) throw new Error('Error al restaurar la sesión');
    return res.json();
  },

  async requestPasswordReset(email: string): Promise<{
    success: boolean;
    message: string;
    resetToken?: string;
    resetUrl?: string;
  }> {
    const res = await fetch('/api/auth/password/forgot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(payload.error || 'No se pudo solicitar la recuperación');
    return payload;
  },

  async resetPassword(token: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch('/api/auth/password/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, newPassword }),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(payload.error || 'No se pudo restablecer la contraseña');
    return payload;
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<{
    success: boolean;
    requiresLogin: boolean;
    message: string;
  }> {
    const res = await fetch('/api/auth/password', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(payload.error || 'No se pudo cambiar la contraseña');
    return payload;
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
  async checkoutCourse(courseId: string): Promise<{ success: boolean; message?: string; checkoutUrl?: string; paymentId?: string; stripeSessionId?: string; isDevSimulation?: boolean }> {
    const res = await fetch('/api/payments/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ courseId }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Error al procesar pago');
    }
    return res.json();
  },

  async getPaymentStatus(paymentId: string): Promise<PaymentRecord> {
    const res = await fetch(`/api/payments/${paymentId}/status`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Error al consultar estado de pago');
    }
    return res.json();
  },

  async simulateDevPayment(paymentId: string): Promise<{ success: boolean }> {
    const res = await fetch('/api/payments/dev-simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentId }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Error al simular pago');
    }
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
  async searchDriveVideos(
    query?: string,
    folderId?: string,
  ): Promise<{ success: boolean; videos: DriveVideoFile[]; configured?: boolean; isDemo?: boolean }> {
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
    if (!res.ok) {
      // Un mentor solo puede responder en los cursos que tiene asignados; sin
      // el motivo del servidor la respuesta se perdía sin decir por qué.
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Error al responder comentario');
    }
    return res.json();
  },

  async likeComment(commentId: string): Promise<{ success: boolean; likes: number }> {
    const res = await fetch(`/api/comments/${commentId}/like`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error('Error al dar me gusta');
    return res.json();
  },

  // Progress & Certificates
  async getProgress(): Promise<{
    success: boolean;
    completedVideos: Record<string, boolean>;
    /** Curso de la última lección marcada; null si el alumno aún no completó ninguna. */
    lastCourseId?: string | null;
    certificates?: CertificateRecord[];
  }> {
    const res = await fetch('/api/progress');
    if (!res.ok) throw new Error('Error al obtener progreso');
    return res.json();
  },

  async toggleProgress(videoId: string, completed: boolean): Promise<{
    success: boolean;
    videoId?: string;
    completed?: boolean;
    progress?: any;
    certificate?: CertificateRecord | null;
  }> {
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

  async getAuditLogs(limit = 50): Promise<{ logs: any[] }> {
    const res = await fetch(`/api/admin/audit-logs?limit=${encodeURIComponent(limit)}`);
    if (!res.ok) throw new Error('Error al cargar el historial de auditoría');
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
    if (!res.ok) {
      // El servidor explica por qué rechaza la asignación («esa cuenta es un
      // mentor», «está desactivada»). Sustituirlo por un texto genérico deja al
      // mentor sin saber qué corregir.
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Error al asignar mentee');
    }
    return res.json();
  },

  /** Todas las consultas del catálogo, con la clase de la que salió cada una. */
  async getMentorQna(): Promise<{ success: boolean; comments: MentorshipComment[] }> {
    const res = await fetch('/api/mentor/qna');
    if (!res.ok) throw new Error('Error al cargar las consultas de mentoría');
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

  // Certificates API
  async verifyCertificate(code: string): Promise<{
    valid: boolean;
    isRevoked?: boolean;
    certificate?: CertificateRecord;
    error?: string;
  }> {
    const res = await fetch(`/api/certificates/verify/${encodeURIComponent(code.trim().toUpperCase())}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { valid: false, error: data.error || 'Certificado inválido o no encontrado' };
    }
    return data;
  },

  async getCourseCertificate(courseId: string): Promise<{ certificate: CertificateRecord }> {
    const res = await fetch(`/api/courses/${courseId}/certificate`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'No se encontró certificado para este curso');
    }
    return res.json();
  },

  async getAdminCertificates(): Promise<{ certificates: CertificateRecord[] }> {
    const res = await fetch('/api/admin/certificates');
    if (!res.ok) throw new Error('Error al cargar lista de certificados');
    return res.json();
  },

  async revokeCertificate(certificateId: string, reason: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`/api/admin/certificates/${certificateId}/revoke`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Error al revocar certificado');
    }
    return res.json();
  },

  // Enrollments API
  async getAdminEnrollments(): Promise<{ enrollments: CourseEnrollmentRecord[] }> {
    const res = await fetch('/api/admin/enrollments');
    if (!res.ok) throw new Error('Error al cargar matrículas');
    return res.json();
  },

  async createEnrollment(data: { userId: string; courseId: string; status?: string; source?: string; accessExpiresAt?: string }): Promise<{ success: boolean; enrollment: CourseEnrollmentRecord }> {
    const res = await fetch('/api/admin/enrollments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Error al matricular usuario');
    }
    return res.json();
  },

  async updateEnrollmentStatus(enrollmentId: string, status: string): Promise<{ success: boolean; enrollment: CourseEnrollmentRecord }> {
    const res = await fetch(`/api/admin/enrollments/${enrollmentId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Error al actualizar estado de matrícula');
    }
    return res.json();
  },

  // Course Admin CRUD
  async createCourse(data: { title: string; description?: string; price?: number; currency?: string; published?: boolean; coverImage?: string; category?: string; isDemo?: boolean; sequentialUnlock?: boolean }): Promise<{ success: boolean; course: Course }> {
    const res = await fetch('/api/admin/courses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Error al crear curso');
    }
    return res.json();
  },

  async updateCourse(courseId: string, data: Partial<Course>): Promise<{ success: boolean; course: Course }> {
    const res = await fetch(`/api/admin/courses/${courseId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Error al actualizar curso');
    }
    return res.json();
  },

  async deleteCourse(courseId: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`/api/admin/courses/${courseId}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Error al eliminar curso');
    }
    return res.json();
  },

  // Module Admin CRUD
  async createModule(courseId: string, data: { title: string; description?: string; order?: number }): Promise<{ success: boolean; module: any }> {
    const res = await fetch(`/api/admin/courses/${courseId}/modules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Error al crear módulo');
    }
    return res.json();
  },

  async updateModule(moduleId: string, data: { title?: string; description?: string; order?: number }): Promise<{ success: boolean; module: any }> {
    const res = await fetch(`/api/admin/modules/${moduleId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Error al actualizar módulo');
    }
    return res.json();
  },

  async deleteModule(moduleId: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`/api/admin/modules/${moduleId}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Error al eliminar módulo');
    }
    return res.json();
  },

  // Video Admin CRUD
  async createModuleVideo(moduleId: string, data: { title: string; duration?: string; description?: string; driveFileId?: string; embedUrl?: string }): Promise<{ success: boolean; video: any }> {
    const res = await fetch(`/api/admin/modules/${moduleId}/videos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Error al crear video');
    }
    return res.json();
  },

  async updateVideo(videoId: string, data: { title?: string; description?: string; duration?: string; embedUrl?: string; order?: number }): Promise<{ success: boolean; video: any }> {
    const res = await fetch(`/api/admin/videos/${videoId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Error al actualizar video');
    }
    return res.json();
  },

  async deleteVideo(videoId: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`/api/admin/videos/${videoId}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Error al eliminar video');
    }
    return res.json();
  },

  // Resource Admin CRUD
  async createCourseResource(courseId: string, data: { moduleId?: string | null; title: string; description?: string; kind?: string; privateUrl: string; mimeType?: string; sizeBytes?: number; order?: number }): Promise<{ success: boolean; resource: CourseResource }> {
    const res = await fetch(`/api/admin/courses/${courseId}/resources`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Error al agregar recurso');
    }
    return res.json();
  },

  async deleteCourseResource(resourceId: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`/api/admin/resources/${resourceId}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Error al eliminar recurso');
    }
    return res.json();
  },

  // Importación de cursos desde una carpeta de Google Drive
  async getDriveImportStatus(): Promise<{
    success: boolean;
    importEnabled: boolean;
    strategy: 'public' | 'apikey';
    driveConfigured: boolean;
    aiProvider: 'openai' | 'deepseek' | 'none';
    limits: { maxDepth: number; maxNodes: number; timeoutMs: number };
  }> {
    const res = await fetch('/api/admin/drive/status');
    if (!res.ok) throw new Error('No se pudo consultar el estado de la importación');
    return res.json();
  },

  async previewDriveImport(url: string): Promise<ImportPreviewResponse> {
    const res = await fetch('/api/admin/drive/import/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'No se pudo leer la carpeta de Google Drive');
    }
    return res.json();
  },

  async organizeDriveImport(plan: ImportPlan): Promise<ImportOrganizeResponse> {
    const res = await fetch('/api/admin/drive/import/organize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'No se pudo organizar el curso con IA');
    }
    return res.json();
  },

  /**
   * Crea el curso a partir del plan. Un 409 significa que esa carpeta ya se
   * importó: se propaga el código para que la vista pregunte antes de duplicar.
   */
  async applyDriveImport(data: {
    plan: ImportPlan;
    price?: number;
    currency?: string;
    published?: boolean;
    coverImage?: string;
    category?: string;
    title?: string;
    description?: string;
    onDuplicate?: 'append' | 'create';
    courseId?: string;
  }): Promise<ImportApplyResponse> {
    const res = await fetch('/api/admin/drive/import/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const error: Error & { code?: string; course?: { id: string; title: string } } = new Error(
        err.error || 'No se pudo crear el curso',
      );
      error.code = err.code;
      error.course = err.course;
      throw error;
    }
    return res.json();
  },
};
