export type ModernAdminModuleId =
  | 'overview'
  | 'courses'
  | 'people'
  | 'certification'
  | 'portal'
  | 'system';

export interface ModernAdminModule {
  id: ModernAdminModuleId;
  label: string;
  description: string;
  target: string;
}

export const MODERN_ADMIN_MODULES: ModernAdminModule[] = [
  { id: 'overview', label: 'Inicio', description: 'Estado general y pendientes', target: 'overview' },
  { id: 'courses', label: 'Cursos', description: 'Catálogo y contenido', target: 'courses' },
  { id: 'people', label: 'Usuarios', description: 'Cuentas y matrículas', target: 'users' },
  { id: 'certification', label: 'Certificación', description: 'Diplomas y contratos', target: 'certificates' },
  { id: 'portal', label: 'Portal', description: 'Portada y escucha', target: 'landing' },
  { id: 'system', label: 'Sistema', description: 'Plugins y configuración', target: 'plugins' },
];

export function getModernModuleTarget(moduleId: ModernAdminModuleId): string {
  return MODERN_ADMIN_MODULES.find((module) => module.id === moduleId)?.target || 'overview';
}
