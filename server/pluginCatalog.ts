/**
 * Catalogo de plugins: la unica lista, y la que la aplicacion garantiza.
 *
 * Antes vivia dentro de `prisma/seed.ts`, y el seed entero esta detras de
 * `SEED_DEMO_DATA`, que produccion **rechaza** arrancar (`config.ts:134`). El
 * resultado medido el 17 sep 2026: la tabla `Plugin` de produccion estaba
 * vacia, el panel salia en blanco, y no habia forma de arreglarlo sin entrar a
 * la base a mano.
 *
 * Un catalogo de plugins no son datos de demostracion: es configuracion del
 * producto. Por eso se asegura al arrancar, siempre, en cualquier entorno.
 *
 * La operacion es idempotente y **no pisa lo que administracion haya tocado**:
 * actualiza los metadatos (nombre, descripcion, version, categoria, icono) y
 * deja en paz `enabled` y `configJson`, que son decisiones de quien administra.
 */

import { prisma } from './prisma.js';
import { logger } from './logger.js';

export interface PluginCatalogEntry {
  id: string;
  name: string;
  description: string;
  version: string;
  category: string;
  icon: string;
  config: Record<string, unknown>;
}

export const PLUGIN_CATALOG: PluginCatalogEntry[] = [
  {
    id: 'pdf-certificates',
    name: 'Plugin de Certificados PDF Institucionales',
    description: 'Genera y emite un certificado oficial firmado al completar el 100% de un programa o curso de mentoría.',
    version: '1.2.0',
    category: 'certificates',
    icon: 'Award',
    config: {
      institutionName: 'Academia Giantucchi',
      signatoryTitle: 'Prof.Giantucchi - Mentor Director & Evaluador',
      primaryColor: '#06b6d4',
      badgeText: 'Certificado de Excelencia Técnica',
      backgroundColor: 'dark',
      signatureImage: '',
      universitySignatoryTitle: 'Dirección Académica - Universidad / Instituto',
      universitySignatureImage: '',
      institutionLogo: '/logo.avif',
    },
  },
  {
    id: 'interactive-quizzes',
    name: 'Plugin de Evaluaciones Interactivas',
    description: 'Añade cuestionarios por módulo y registra intentos de los estudiantes.',
    version: '1.0.0',
    category: 'quizzes',
    icon: 'ClipboardCheck',
    config: { passingScore: 70, maxAttempts: 3 },
  },
  {
    id: 'discord-webhooks',
    name: 'Plugin de Webhooks para Comunidad',
    description: 'Envía eventos de progreso y finalización a Discord o Slack.',
    version: '1.0.0',
    category: 'integrations',
    icon: 'Webhook',
    config: { webhookUrl: '', notifyOnCompletion: true },
  },
  {
    id: 'learning-analytics',
    name: 'Plugin de Analítica de Rendimiento de Mentees',
    description: 'Visualiza mapas de calor de estudio, duraciones medias por video y tasa de retención estudiantil.',
    version: '1.1.0',
    category: 'analytics',
    icon: 'BarChart3',
    config: { enableHeatmaps: true, trackSessionDuration: true },
  },
  {
    id: 'live-meetings',
    name: 'Plugin de Clases Sincrónicas & Live Meetings',
    description: 'Permite a los mentores programar y transmitir clases en vivo mediante Google Meet, Jitsi Meet abierto o grabaciones asincrónicas.',
    version: '1.0.0',
    category: 'integrations',
    icon: 'Video',
    config: {
      defaultProvider: 'jitsi',
      jitsiDomain: 'meet.jit.si',
      enableAutoRecordingLink: true,
      requireVipAccess: false,
    },
  },
  {
    id: 'google-drive',
    name: 'Plugin de Integración Google Drive Video Engine',
    description: 'Permite buscar, indexar e incrustar clases y videos directamente desde Google Drive.',
    version: '1.5.0',
    category: 'integrations',
    icon: 'HardDrive',
    config: {
      apiKeyConfigured: true,
      autoEmbedPreview: true,
      supportedMimeTypes: ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-matroska'],
      defaultFolderId: 'root',
      allowPublicSharing: true,
    },
  },
  {
    id: 'discord-slack-bridge',
    name: 'Plugin de Integración Discord / Slack Webhook',
    description: 'Notifica en canales de la comunidad en tiempo real cuando un alumno realiza preguntas de mentoría o completa módulos.',
    version: '1.0.4',
    category: 'integrations',
    icon: 'MessageSquare',
    config: {
      webhookUrl: '',
      notifyOnQnA: true,
      notifyOnCompletion: true,    },
  },
];

/**
 * Crea las filas que falten y refresca los metadatos de las que ya estan.
 *
 * No tumba la aplicacion si falla: un catalogo desactualizado es un problema
 * menor comparado con no arrancar. Se registra y se sigue.
 */
export async function ensurePluginCatalog(): Promise<number> {
  let escritos = 0;
  for (const plugin of PLUGIN_CATALOG) {
    await prisma.plugin.upsert({
      where: { id: plugin.id },
      update: {
        name: plugin.name,
        description: plugin.description,
        version: plugin.version,
        category: plugin.category,
        icon: plugin.icon,
      },
      create: {
        id: plugin.id,
        name: plugin.name,
        description: plugin.description,
        version: plugin.version,
        category: plugin.category,
        icon: plugin.icon,
        configJson: JSON.stringify(plugin.config),
      },
    });
    escritos++;
  }
  return escritos;
}
