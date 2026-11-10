export type ActiveTab = 'landing' | 'courses' | 'learning' | 'viewer' | 'mentor' | 'admin' | 'plugins' | 'vip';

export const TAB_PATHS: Record<ActiveTab, string> = {
  landing: '/', courses: '/courses', learning: '/learning', viewer: '/courses',
  mentor: '/mentor/dashboard', admin: '/admin', plugins: '/admin/plugins', vip: '/vip',
};

export function tabFromPath(pathname: string): ActiveTab {
  if (pathname.startsWith('/admin/plugins')) return 'plugins';
  if (pathname.startsWith('/admin')) return 'admin';
  if (pathname.startsWith('/mentor')) return 'mentor';
  if (pathname.startsWith('/learning')) return 'learning';
  if (pathname.startsWith('/search') || pathname.startsWith('/courses')) return 'courses';
  if (pathname.startsWith('/vip')) return 'vip';
  return 'landing';
}
