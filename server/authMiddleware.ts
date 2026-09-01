import { NextFunction, Request, Response } from 'express';

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
      return res.status(403).json({
        error: 'Acceso denegado. Permisos insuficientes.',
        requiredRoles: allowedRoles,
        currentRole: req.user.role,
      });
    }

    next();
  };
}
