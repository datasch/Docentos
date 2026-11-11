import { NextFunction, Request, Response } from 'express';
import { securityLimits } from './rateLimits.js';
import { logger } from './logger.js';
import { resolveRequestSession } from './authService.js';

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

type RequestSessionResolver = typeof resolveRequestSession;

const PRIVATE_NOT_FOUND_PAGE = `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="theme-color" content="#0b0d14">
    <title>DocentOS · Página no encontrada</title>
    <style>
      :root {
        color-scheme: dark;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: #0b0d14;
        color: #eef0f5;
      }
      * { box-sizing: border-box; }
      body { min-width: 320px; min-height: 100vh; margin: 0; background: #0b0d14; }
      main { display: grid; min-height: 100vh; place-items: center; padding: 32px 20px; }
      .shell {
        width: min(100%, 640px);
        padding: clamp(32px, 7vw, 64px);
        border: 1px solid rgba(238,240,245,.1);
        border-radius: 20px;
        background: #11141c;
        box-shadow: 0 16px 48px rgba(0,0,0,.24);
        text-align: center;
      }
      .brand { color: #a3a9b8; font-size: 14px; font-weight: 500; }
      .orbit-line {
        width: 128px;
        height: 32px;
        margin: 28px auto 20px;
        border: 1px solid rgba(103,232,249,.55);
        border-radius: 50%;
        transform: rotate(-8deg);
      }
      .code {
        margin: -52px 0 0;
        color: #eef0f5;
        font-size: clamp(88px, 18vw, 144px);
        font-weight: 500;
        letter-spacing: -.03em;
        line-height: .9;
      }
      h1 { margin: 24px 0 0; color: #eef0f5; font-size: clamp(24px, 4vw, 32px); font-weight: 500; }
      p { max-width: 400px; margin: 12px auto 0; color: #a3a9b8; font-size: 15px; line-height: 1.6; }
      a {
        display: inline-flex;
        margin-top: 28px;
        padding: 12px 18px;
        border: 1px solid rgba(238,240,245,.12);
        border-radius: 10px;
        background: #eef0f5;
        color: #0b0d14;
        font-size: 14px;
        font-weight: 500;
        text-decoration: none;
        transition: background .16s ease, border-color .16s ease;
      }
      a:hover { border-color: #67e8f9; background: #cffafe; }
      a:focus-visible { outline: 3px solid rgba(103,232,249,.7); outline-offset: 4px; }
    </style>
  </head>
  <body>
    <main>
      <section class="shell" aria-labelledby="page-title">
        <div class="brand">DocentOS</div>
        <div class="orbit-line" aria-hidden="true"></div>
        <div class="code" aria-hidden="true">404</div>
        <h1 id="page-title">Página no disponible</h1>
        <p>La dirección solicitada no está disponible.</p>
        <a href="/">Volver al inicio</a>
      </section>
    </main>
  </body>
</html>`;

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

export function createPrivatePageGuard(resolveSession: RequestSessionResolver = resolveRequestSession) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!['GET', 'HEAD'].includes(req.method) || !/^\/(?:admin|mentor)(?:\/|$)/.test(req.path)) {
      return next();
    }

    res.setHeader('Cache-Control', 'no-store');

    try {
      const authentication = await resolveSession(req);
      const isAdminPage = /^\/admin(?:\/|$)/.test(req.path);
      const allowed = authentication && (isAdminPage
        ? authentication.user.role === 'ADMIN'
        : authentication.user.role === 'ADMIN' || authentication.user.role === 'MENTOR');

      if (!allowed) {
        return res.status(404).type('html').send(PRIVATE_NOT_FOUND_PAGE);
      }

      req.user = authentication.user;
      req.authSession = authentication.session;
      return next();
    } catch (error) {
      logger.error('private_page.authorization_unavailable', {
        method: req.method,
        path: req.path,
        errorType: error instanceof Error ? error.name : 'UnknownError',
      });
      return res.status(503).send('Service temporarily unavailable');
    }
  };
}
