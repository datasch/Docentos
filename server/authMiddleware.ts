import { NextFunction, Request, Response } from 'express';
import { securityLimits } from './rateLimits.js';
import { logger } from './logger.js';

export type UserRole = 'ADMIN' | 'MENTOR' | 'MENTEE' | 'PUBLIC_USER' | 'VIP' | 'EXTERNAL';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatarUrl?: string | null;
  strikes?: number;
  isActive?: boolean;
}

export interface AuthenticatedSession {
  id: string;
  expiresAt: Date;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      authSession?: AuthenticatedSession;
    }
  }
}

export function requireAuthenticated(req: Request, res: Response, next: NextFunction) {
  if (!req.user || !req.authSession) {
    return res.status(401).json({ error: 'Debes iniciar sesión para continuar.' });
  }

  next();
}

export function requireRole(allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !req.authSession) {
      return res.status(401).json({ error: 'Debes iniciar sesión para continuar.' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return securityLimits.forbidden(req, res, () => {
        logger.warn('authorization.denied', { userId: req.user!.id, method: req.method, route: req.route?.path });
        res.status(403).json({ error: 'Acceso denegado. Permisos insuficientes.', code: 'ACCESS_DENIED' });
      });
    }

    next();
  };
}
