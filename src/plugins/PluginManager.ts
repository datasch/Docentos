/**
 * Motor del Sistema de Plugins Extensible - Academia Giantucchi
 *
 * Permite registrar, activar, desactivar y ejecutar ganchos (hooks)
 * para extender la plataforma con certificados, evaluaciones, webhooks y analíticas.
 */

import { AcademiaPlugin, User, Course, VideoDriveLink, Module } from '../types';
import { googleDrivePlugin } from './googleDrivePlugin';
import { quizzesPlugin, quizzesPluginEngine } from './QuizzesPlugin';

export const DEFAULT_PLUGINS: AcademiaPlugin[] = [
  googleDrivePlugin,
  {
    id: 'pdf-certificates',
    name: 'Plugin de Certificados PDF Institucionales',
    description: 'Genera y emite un certificado oficial firmado al completar el 100% de un programa o curso de mentoría.',
    version: '1.2.0',
    enabled: true,
    category: 'certificates',
    icon: 'Award',
    config: {
      institutionName: 'Academia Giantucchi',
      signatoryTitle: 'Prof. Giantucchi - Mentor Director',
      primaryColor: '#06b6d4',
      badgeText: 'Certificado de Excelencia Técnica',
    },
  },
  quizzesPlugin,
  {
    id: 'discord-slack-bridge',
    name: 'Plugin de Integración Discord / Slack Webhook',
    description: 'Notifica en canales de la comunidad en tiempo real cuando un alumno realiza preguntas de mentoría o completa módulos.',
    version: '1.0.4',
    enabled: true,
    category: 'integrations',
    icon: 'MessageSquare',
    config: {
      webhookUrl: 'https://discord.com/api/webhooks/demo-giantucchi-academy',
      notifyOnQnA: true,
      notifyOnCompletion: true,
    },
  },
  {
    id: 'learning-analytics',
    name: 'Plugin de Analítica de Rendimiento de Mentees',
    description: 'Visualiza mapas de calor de estudio, duraciones medias por video y tasa de retención estudiantil.',
    version: '1.1.0',
    enabled: true,
    category: 'analytics',
    icon: 'BarChart3',
    config: {
      enableHeatmaps: true,
      trackSessionDuration: true,
    },
  },
];

export interface AnalyticsEvent {
  timestamp: string;
  eventType: 'lesson_complete' | 'course_complete' | 'comment_submit' | 'quiz_pass';
  userId: string;
  userName: string;
  meta: Record<string, any>;
}

class PluginManagerEngine {
  private plugins: AcademiaPlugin[] = [...DEFAULT_PLUGINS];
  private analyticsLog: AnalyticsEvent[] = [];

  public getPlugins(): AcademiaPlugin[] {
    return this.plugins;
  }

  public registerPlugin(plugin: AcademiaPlugin): void {
    const exists = this.plugins.some((p) => p.id === plugin.id);
    if (!exists) {
      this.plugins.push(plugin);
    }
  }

  public getPlugin(id: string): AcademiaPlugin | undefined {
    return this.plugins.find((p) => p.id === id);
  }

  public isEnabled(id: string): boolean {
    const p = this.getPlugin(id);
    return p ? p.enabled : false;
  }

  public togglePlugin(id: string, enabled?: boolean): AcademiaPlugin[] {
    this.plugins = this.plugins.map((p) => {
      if (p.id === id) {
        return { ...p, enabled: enabled !== undefined ? enabled : !p.enabled };
      }
      return p;
    });
    return this.plugins;
  }

  public updateConfig(id: string, newConfig: Record<string, any>): AcademiaPlugin[] {
    this.plugins = this.plugins.map((p) => {
      if (p.id === id) {
        return { ...p, config: { ...p.config, ...newConfig } };
      }
      return p;
    });
    return this.plugins;
  }

  public setPlugins(pluginsList: AcademiaPlugin[]): void {
    if (Array.isArray(pluginsList) && pluginsList.length > 0) {
      this.plugins = pluginsList;
    }
  }

  // ==================== LIFECYCLE HOOKS ====================

  /**
   * Hook 1: Se dispara cuando el estudiante marca una lección como completada
   */
  public async onLessonComplete(user: User, video: VideoDriveLink): Promise<void> {
    if (this.isEnabled('learning-analytics')) {
      this.recordAnalyticsEvent('lesson_complete', user, { videoId: video.id, title: video.title });
    }

    if (this.isEnabled('discord-slack-bridge')) {
      const bridgeConfig = this.getPlugin('discord-slack-bridge')?.config || {};
      if (bridgeConfig.notifyOnCompletion && bridgeConfig.webhookUrl) {
        this.sendWebhookNotification(bridgeConfig.webhookUrl, {
          content: `🎓 **DocentOS Integration**\n**Alumno:** ${user.name}\n**Acción:** Lección Completada — *"${video.title}"*`,
        });
      }
    }
  }

  /**
   * Hook 2: Se dispara cuando el estudiante alcanza el 100% de progreso del curso
   */
  public async onCourseComplete(user: User, course: Course): Promise<void> {
    if (this.isEnabled('learning-analytics')) {
      this.recordAnalyticsEvent('course_complete', user, { courseId: course.id, title: course.title });
    }

    if (this.isEnabled('discord-slack-bridge')) {
      const bridgeConfig = this.getPlugin('discord-slack-bridge')?.config || {};
      if (bridgeConfig.notifyOnCompletion && bridgeConfig.webhookUrl) {
        this.sendWebhookNotification(bridgeConfig.webhookUrl, {
          content: `🏆 **¡Curso Graduado en DocentOS!**\n**Alumno:** ${user.name}\n**Curso:** *"${course.title}"*\n¡El certificado oficial ha sido emitido con éxito!`,
        });
      }
    }
  }

  /**
   * Hook 3: Se dispara cuando un usuario publica una pregunta en la zona de mentoría
   */
  public async onCommentSubmit(user: User, commentData: { videoTitle: string; content: string }): Promise<void> {
    if (this.isEnabled('learning-analytics')) {
      this.recordAnalyticsEvent('comment_submit', user, commentData);
    }

    if (this.isEnabled('discord-slack-bridge')) {
      const bridgeConfig = this.getPlugin('discord-slack-bridge')?.config || {};
      if (bridgeConfig.notifyOnQnA && bridgeConfig.webhookUrl) {
        this.sendWebhookNotification(bridgeConfig.webhookUrl, {
          content: `💬 **Nueva Consulta de Mentoría**\n**Usuario:** ${user.name}\n**Lección:** ${commentData.videoTitle}\n**Pregunta:** "${commentData.content}"`,
        });
      }
    }
  }

  /**
   * Hook 4: Se dispara al renderizar el visor del curso
   */
  public onRenderCourseViewer(course: Course): { hasQuizzes: boolean; hasCertificates: boolean } {
    return {
      hasQuizzes: this.isEnabled('interactive-quizzes'),
      hasCertificates: this.isEnabled('pdf-certificates'),
    };
  }

  public get quizzesEngine() {
    return quizzesPluginEngine;
  }

  /**
   * Hook 5: Se dispara cuando un estudiante aprueba un examen
   */
  public async onQuizPass(user: User, moduleId: string, scorePercentage: number): Promise<void> {
    if (this.isEnabled('learning-analytics')) {
      this.recordAnalyticsEvent('quiz_pass', user, { moduleId, scorePercentage });
    }

    if (this.isEnabled('discord-slack-bridge')) {
      const bridgeConfig = this.getPlugin('discord-slack-bridge')?.config || {};
      if (bridgeConfig.notifyOnCompletion && bridgeConfig.webhookUrl) {
        this.sendWebhookNotification(bridgeConfig.webhookUrl, {
          content: `📝 **Examen Aprobado**\n**Alumno:** ${user.name}\n**Módulo ID:** ${moduleId}\n**Nota Obtendida:** ${scorePercentage}%`,
        });
      }
    }
  }

  /**
   * Verifica si un módulo está desbloqueado para el usuario según la configuración del plugin
   */
  public isModuleUnlocked(modules: Module[], moduleIndex: number, userId: string): boolean {
    const plugin = this.getPlugin('interactive-quizzes');
    const enabled = plugin ? plugin.enabled : false;
    const enforceLocking = plugin?.config?.enforceModuleLocking !== false;
    const passingThreshold = plugin?.config?.passingScore || 80;

    if (!enforceLocking) return true;
    return quizzesPluginEngine.isModuleUnlocked(modules, moduleIndex, userId, passingThreshold, enabled);
  }

  /**
   * Helper privado para enviar Petición HTTP Real a Webhooks de Slack / Discord
   */
  private async sendWebhookNotification(webhookUrl: string, payload: { content: string }): Promise<void> {
    if (!webhookUrl || !webhookUrl.startsWith('http')) return;
    try {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      console.warn('[DocentOS Webhook Note]: Webhook dispatch attempted:', err);
    }
  }

  /**
   * Helper de registro de analíticas
   */
  private recordAnalyticsEvent(
    eventType: AnalyticsEvent['eventType'],
    user: User,
    meta: Record<string, any>
  ): void {
    const evt: AnalyticsEvent = {
      timestamp: new Date().toISOString(),
      eventType,
      userId: user.id,
      userName: user.name,
      meta,
    };
    this.analyticsLog.unshift(evt);
  }

  public getAnalyticsEvents(): AnalyticsEvent[] {
    return this.analyticsLog;
  }
}

export const pluginManager = new PluginManagerEngine();
