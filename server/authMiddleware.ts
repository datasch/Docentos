/**
 * Middleware de Autenticación y Control de Acceso basado en Roles (RBAC)
 * Academia Giantucchi
 *
 * Implementa la lógica de negocio para:
 * 1. RBAC (ADMIN, VIP, EXTERNAL)
 * 2. Bypass automático del muro de pago para usuarios VIP y ADMIN
 * 3. Verificación de pago completado para usuarios EXTERNAL
 */

import { Request, Response, NextFunction } from 'express';

export type UserRole = 'ADMIN' | 'MENTOR' | 'MENTEE' | 'PUBLIC_USER' | 'VIP' | 'EXTERNAL';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

// Augment Express Request interface
declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

/**
 * Extract authenticated user context from request headers or default state
 */
export function authenticateUser(req: Request, res: Response, next: NextFunction) {
  const roleHeader = (req.headers['x-user-role'] as UserRole) || 'EXTERNAL';
  const userId = (req.headers['x-user-id'] as string) || 'user-demo-1';
  const userEmail = (req.headers['x-user-email'] as string) || 'estudiante@giantucchi.com';
  const userName = (req.headers['x-user-name'] as string) || 'Estudiante Giantucchi';

  req.user = {
    id: userId,
    email: userEmail,
    name: userName,
    role: roleHeader,
  };

  next();
}

/**
 * Middleware to restrict access to specific roles
 */
export function requireRole(allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'No autenticado en la plataforma' });
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

/**
 * Middleware de Validación de Acceso a Cursos con Bypass VIP
 *
 * Reglas de negocio:
 * - ADMIN y VIP: Acceso concedido instantáneamente (Bypass Muro de Pago)
 * - EXTERNAL: Requiere un pago registrado con status COMPLETED para el curso objetivo
 */
export function createCourseAccessGuard(paymentsStore: Map<string, Set<string>>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;
    const courseId = req.params.courseId || req.body.courseId || (req.query.courseId as string);

    if (!user) {
      return res.status(401).json({ error: 'Usuario no identificado' });
    }

    // 1. ADMIN, MENTOR & MENTEE (VIP) Bypass
    if (user.role === 'ADMIN' || user.role === 'MENTOR' || user.role === 'MENTEE' || user.role === 'VIP') {
      return next();
    }

    // 2. Check payment for EXTERNAL user
    if (courseId) {
      const userPaidCourses = paymentsStore.get(user.id);
      const hasPaid = userPaidCourses && userPaidCourses.has(courseId);

      if (hasPaid) {
        return next();
      }
    }

    // 3. Reject access with Paywall prompt metadata
    return res.status(402).json({
      error: 'Muro de Pago Activo - Se requiere Pase VIP o Pago de Curso',
      hasAccess: false,
      requiresPayment: true,
      courseId,
      userRole: user.role,
      vipPassAvailable: true,
      priceUSD: 149,
      message: 'Para acceder a los módulos de mentoría avanzada de la Academia Giantucchi, adquiere el curso o activa tu Pase VIP.',
    });
  };
}
