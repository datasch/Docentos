import type { UserRole } from '../types';

export type ActiveTab = 'landing' | 'courses' | 'learning' | 'viewer' | 'mentor' | 'admin' | 'plugins' | 'vip';

export const TAB_PATHS: Record<ActiveTab, string> = {
  landing: '/', courses: '/courses', learning: '/learning', viewer: '/courses',
  mentor: '/mentor/dashboard', admin: '/admin', plugins: '/admin/plugins', vip: '/vip',
};

export function isPrivatePath(pathname: string): boolean {
  return /^\/(?:admin|mentor)(?:\/|$)/.test(pathname);
}

export function privateRouteRoleAllowed(pathname: string, role: UserRole | null | undefined): boolean {
  if (!role) return false;
  if (/^\/admin(?:\/|$)/.test(pathname)) return role === 'ADMIN';
  if (/^\/mentor(?:\/|$)/.test(pathname)) return role === 'ADMIN' || role === 'MENTOR';
  return true;
}

export function privateRouteView(status: 'unauthorized' | 'unavailable'): {
  title: string;
  description: string;
} {
  if (status === 'unavailable') {
    return {
      title: 'Servicio temporalmente no disponible',
      description: 'No se pudo verificar la sesión. Inténtalo de nuevo en unos momentos.',
    };
  }

  return {
    title: '404 — Página no disponible',
    description: 'La dirección solicitada no está disponible.',
  };
}

export function tabFromPath(pathname: string): ActiveTab {
  if (pathname.startsWith('/admin/plugins')) return 'plugins';
  if (pathname.startsWith('/admin')) return 'admin';
  if (pathname.startsWith('/mentor')) return 'mentor';
  if (pathname.startsWith('/learning')) return 'learning';
  if (pathname.startsWith('/search') || pathname.startsWith('/courses')) return 'courses';
  if (pathname.startsWith('/vip')) return 'vip';
  return 'landing';
}
