import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MODERN_ADMIN_MODULES,
  getModernModuleTarget,
  type ModernAdminModuleId,
} from '../src/lib/adminNavigation.js';

test('la navegación Moderna expone módulos orientados a tareas', () => {
  assert.deepEqual(
    MODERN_ADMIN_MODULES.map((module) => module.id),
    ['overview', 'courses', 'people', 'resources', 'certification', 'portal', 'system'],
  );
  assert.equal(MODERN_ADMIN_MODULES.some((module) => module.label === 'Módulos'), false);
});

test('cada módulo apunta a una vista existente del panel', () => {
  const expectedTargets: Record<ModernAdminModuleId, string> = {
    overview: 'overview',
    courses: 'courses',
    people: 'users',
    resources: 'resources',
    certification: 'certificates',
    portal: 'landing',
    system: 'plugins',
  };

  for (const module of MODERN_ADMIN_MODULES) {
    assert.equal(getModernModuleTarget(module.id), expectedTargets[module.id]);
  }
});
