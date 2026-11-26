import i18n from '../i18n';

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
  {
    id: 'overview',
    get label() { return i18n.t('adminNav_overview_label', 'Inicio'); },
    get description() { return i18n.t('adminNav_overview_desc', 'Estado general y pendientes'); },
    target: 'overview',
  },
  {
    id: 'courses',
    get label() { return i18n.t('adminNav_courses_label', 'Cursos'); },
    get description() { return i18n.t('adminNav_courses_desc', 'Catálogo y contenido'); },
    target: 'courses',
  },
  {
    id: 'people',
    get label() { return i18n.t('adminNav_people_label', 'Usuarios'); },
    get description() { return i18n.t('adminNav_people_desc', 'Cuentas y matrículas'); },
    target: 'users',
  },
  {
    id: 'certification',
    get label() { return i18n.t('adminNav_certification_label', 'Certificación'); },
    get description() { return i18n.t('adminNav_certification_desc', 'Diplomas y contratos'); },
    target: 'certificates',
  },
  {
    id: 'portal',
    get label() { return i18n.t('adminNav_portal_label', 'Portal'); },
    get description() { return i18n.t('adminNav_portal_desc', 'Portada y NPS'); },
    target: 'landing',
  },
  {
    id: 'system',
    get label() { return i18n.t('adminNav_system_label', 'Sistema'); },
    get description() { return i18n.t('adminNav_system_desc', 'Plugins y configuración'); },
    target: 'plugins',
  },
];

export function getModernModuleTarget(moduleId: ModernAdminModuleId): string {
  return MODERN_ADMIN_MODULES.find((module) => module.id === moduleId)?.target || 'overview';
}
