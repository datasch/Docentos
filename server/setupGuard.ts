/**
 * Middleware setupGuard para Express.js - Academia Giantucchi Open Source
 * Intercepta las solicitudes API para verificar si el sistema requiere la instalación inicial (First Run Setup).
 */

import { Request, Response, NextFunction } from 'express';

// Definición de interfaz para la verificación de usuarios
export interface SetupGuardOptions {
  getUserCount: () => Promise<number> | number;
}

/**
 * Middleware que bloquea el acceso a rutas protegidas si no existe ningún usuario registrado.
 */
export function createSetupGuard(getUserCount: () => Promise<number> | number) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Permitir acceso sin intercepción a rutas de setup y archivos estáticos
    const openPaths = ['/api/setup', '/api/setup/status', '/api/health'];
    if (openPaths.includes(req.path)) {
      return next();
    }

    try {
      const count = await getUserCount();

      if (count === 0) {
        return res.status(428).json({
          isSetupRequired: true,
          error: 'Instalación inicial requerida (First Run Setup)',
          message: 'No existen usuarios en el sistema. Por favor complete el asistente de configuración en /setup',
          redirect: '/setup',
        });
      }

      next();
    } catch (error) {
      console.error('Error en setupGuard al verificar número de usuarios:', error);
      // En caso de fallo grave en DB, permitir continuar para no romper la app en demo
      next();
    }
  };
}
