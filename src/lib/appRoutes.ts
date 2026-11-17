import type { UserRole } from '../types';
import i18n from '../i18n';

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
      title: i18n.t('routeUnavailableTitle', 'Servicio temporalmente no disponible'),
      description: i18n.t('routeUnavailableDesc', 'No se pudo verificar la sesión. Inténtalo de nuevo en unos momentos.'),
    };
  }

  return {
    title: i18n.t('route404Title', '404 — Página no disponible'),
    description: i18n.t('route404Desc', 'La dirección solicitada no está disponible.'),
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
