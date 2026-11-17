/**
 * Middleware setupGuard para Express.js - Academia Giantucchi Open Source
 * Intercepta las solicitudes API para verificar si el sistema requiere la instalación inicial (First Run Setup).
 */

import { Request, Response, NextFunction } from 'express';
import { resolveRequestLanguage, getLocalizedMessage } from './serverI18n.js';

// Definición de interfaz para la verificación de usuarios
export interface SetupGuardOptions {
  isSetupComplete: () => Promise<boolean> | boolean;
}

/**
 * Middleware que bloquea el acceso a rutas protegidas si no existe ningún usuario registrado.
 */
export function createSetupGuard(isSetupComplete: () => Promise<boolean> | boolean) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // El frontend debe poder cargar el asistente aun cuando la base este vacia.
    if (!req.path.startsWith('/api')) return next();

    const openPaths = ['/api/setup', '/api/setup/status', '/api/health', '/api/version', '/api/runtime-config'];
    if (openPaths.includes(req.path)) {
      return next();
    }

    try {
      if (!(await isSetupComplete())) {
        const lang = resolveRequestLanguage(req);
        return res.status(428).json({
          isSetupRequired: true,
          code: 'SETUP_REQUIRED',
          error: getLocalizedMessage('SETUP_REQUIRED', lang, 'Instalación inicial requerida (First Run Setup)'),
          message: 'No existen usuarios en el sistema. Por favor complete el asistente de configuración en /setup',
          redirect: '/setup',
        });
      }

      next();
    } catch (error) {
      console.error('Error en setupGuard al verificar número de usuarios:', error);
      const lang = resolveRequestLanguage(req);
      return res.status(503).json({
        code: 'DB_UNAVAILABLE',
        error: getLocalizedMessage('SERVICE_UNAVAILABLE', lang, 'No se pudo verificar el estado de instalacion.'),
        message: 'La base de datos no esta disponible o no tiene el esquema compatible.',
      });
    }
  };
}
