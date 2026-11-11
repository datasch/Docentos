import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isPrivatePath,
  privateRouteRoleAllowed,
  privateRouteView,
} from '../src/lib/appRoutes.js';

test('clasifica las rutas privadas y solo permite los roles correspondientes', () => {
  assert.equal(isPrivatePath('/admin'), true);
  assert.equal(isPrivatePath('/admin/plugins'), true);
  assert.equal(isPrivatePath('/mentor/dashboard'), true);
  assert.equal(isPrivatePath('/courses'), false);

  assert.equal(privateRouteRoleAllowed('/admin', 'ADMIN'), true);
  assert.equal(privateRouteRoleAllowed('/admin/plugins', 'ADMIN'), true);
  assert.equal(privateRouteRoleAllowed('/admin', 'MENTOR'), false);
  assert.equal(privateRouteRoleAllowed('/mentor/dashboard', 'MENTOR'), true);
  assert.equal(privateRouteRoleAllowed('/mentor/dashboard', 'ADMIN'), true);
  assert.equal(privateRouteRoleAllowed('/mentor/dashboard', 'MENTEE'), false);
  assert.equal(privateRouteRoleAllowed('/admin', null), false);
});

test('una verificación temporal no se presenta como un 404 de autorización', () => {
  assert.deepEqual(privateRouteView('unauthorized'), {
    title: '404 — Página no disponible',
    description: 'La dirección solicitada no está disponible.',
  });
  assert.deepEqual(privateRouteView('unavailable'), {
    title: 'Servicio temporalmente no disponible',
    description: 'No se pudo verificar la sesión. Inténtalo de nuevo en unos momentos.',
  });
});
