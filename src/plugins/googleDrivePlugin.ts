/**
 * Google Drive Video Engine Plugin - Academia Giantucchi
 *
 * Módulo de plugin abstraído para integración nativa con Google Drive API v3.
 * Permite buscar, conectar e incrustar videos de Drive en la plataforma de cursos.
 */

import { AcademiaPlugin } from '../types';

export const googleDrivePlugin: AcademiaPlugin = {
  id: 'google-drive',
  name: 'Plugin de Integración Google Drive Video Engine',
  description: 'Permite buscar, indexar e incrustar clases y videos directamente desde Google Drive.',
  version: '1.5.0',
  enabled: true,
  category: 'integrations',
  icon: 'HardDrive',
  config: {
    apiKeyConfigured: true,
    autoEmbedPreview: true,
    supportedMimeTypes: ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-matroska'],
    defaultFolderId: 'root',
    allowPublicSharing: true,
  },
};

export function isGoogleDrivePluginEnabled(plugins?: AcademiaPlugin[]): boolean {
  if (!plugins || plugins.length === 0) return true; // Default active
  const drivePlugin = plugins.find((p) => p.id === 'google-drive');
  return drivePlugin ? drivePlugin.enabled : true;
}
