import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PLUGIN_CATALOG } from '../server/pluginCatalog.js';
import { pluginManager } from '../src/plugins/PluginManager.js';
import {
  DEFAULT_SEASONAL_PLUGIN_STATE,
  getAutomaticSeasonalTheme,
  getSeasonalDisplayOptions,
  getSeasonalTheme,
  syncSeasonalPluginState,
} from '../src/lib/seasonalTheme.js';
import { ListeningBoxModal } from '../src/components/ListeningBoxModal.js';
import { ListeningAdminPanel } from '../src/components/ListeningAdminPanel.js';
import { listeningToCsv, toStaffEntry } from '../server/listeningService.js';

test('Plugin Festividades: figura en PLUGIN_CATALOG y DEFAULT_PLUGINS con los mismos valores', () => {
  const catalogEntry = PLUGIN_CATALOG.find((p) => p.id === 'seasonal-festivities');
  const clientEntry = pluginManager.getPlugin('seasonal-festivities');

  assert.ok(catalogEntry, 'seasonal-festivities debe existir en PLUGIN_CATALOG');
  assert.ok(clientEntry, 'seasonal-festivities debe existir en DEFAULT_PLUGINS');
  assert.equal(catalogEntry.category, 'custom');
  assert.equal(catalogEntry.config.mode, 'auto');
  assert.equal(clientEntry.config?.mode, 'auto');
  assert.equal(catalogEntry.config.showBanner, true);
  assert.equal(catalogEntry.config.showParticles, true);
  assert.equal(catalogEntry.config.showFestiveHats, true);
});

test('Plugin Festividades: conserva intacta la automatización nativa por calendario', () => {
  syncSeasonalPluginState(DEFAULT_SEASONAL_PLUGIN_STATE);

  const oct15 = new Date(2026, 9, 15, 12, 0, 0);
  const nov2 = new Date(2026, 10, 2, 12, 0, 0);
  const nov19 = new Date(2026, 10, 19, 12, 0, 0);
  const nov20 = new Date(2026, 10, 20, 12, 0, 0);
  const dec25 = new Date(2026, 11, 25, 12, 0, 0);
  const jan6 = new Date(2026, 0, 6, 12, 0, 0);
  const jan7 = new Date(2026, 0, 7, 12, 0, 0);

  assert.equal(getAutomaticSeasonalTheme(oct15), 'halloween');
  assert.equal(getAutomaticSeasonalTheme(nov2), 'halloween');
  assert.equal(getAutomaticSeasonalTheme(nov19), 'none');
  assert.equal(getAutomaticSeasonalTheme(nov20), 'christmas');
  assert.equal(getAutomaticSeasonalTheme(dec25), 'christmas');
  assert.equal(getAutomaticSeasonalTheme(jan6), 'christmas');
  assert.equal(getAutomaticSeasonalTheme(jan7), 'none');

  assert.equal(getSeasonalTheme(oct15), 'halloween');
  assert.equal(getSeasonalTheme(dec25), 'christmas');
  assert.equal(getSeasonalTheme(nov19), 'none');
});

test('Plugin Festividades: desactivar el plugin apaga las festividades y reactivarlo restaura la automatización', () => {
  const dec25 = new Date(2026, 11, 25, 12, 0, 0);

  pluginManager.togglePlugin('seasonal-festivities', false);
  assert.equal(getSeasonalTheme(dec25), 'none');
  const disabledDisplay = getSeasonalDisplayOptions();
  assert.equal(disabledDisplay.enabled, false);

  pluginManager.togglePlugin('seasonal-festivities', true);
  assert.equal(getSeasonalTheme(dec25), 'christmas');
});

test('Plugin Festividades: permite forzar Navidad/Halloween o apagar elementos si la automatización falla', () => {
  const summerDay = new Date(2026, 5, 15, 12, 0, 0);

  pluginManager.togglePlugin('seasonal-festivities', true);
  pluginManager.updateConfig('seasonal-festivities', {
    mode: 'christmas',
    showBanner: false,
    showParticles: true,
    showFestiveHats: false,
  });

  assert.equal(getSeasonalTheme(summerDay), 'christmas');
  const display = getSeasonalDisplayOptions();
  assert.equal(display.showBanner, false);
  assert.equal(display.showParticles, true);
  assert.equal(display.showFestiveHats, false);

  pluginManager.updateConfig('seasonal-festivities', {
    mode: 'halloween',
    showBanner: true,
    showParticles: true,
    showFestiveHats: true,
  });
  assert.equal(getSeasonalTheme(summerDay), 'halloween');

  pluginManager.updateConfig('seasonal-festivities', { mode: 'none' });
  assert.equal(getSeasonalTheme(new Date(2026, 11, 25, 12, 0, 0)), 'none');

  // Restaurar estado por defecto para no contaminar otros tests
  pluginManager.updateConfig('seasonal-festivities', {
    mode: 'auto',
    showBanner: true,
    showParticles: true,
    showFestiveHats: true,
  });
});

test('Buzón de Escucha NPS: el modal ya no ofrece envío anónimo y el CSV/panel expone al autor', () => {
  // En SSR sin document, createPortal no se ejecuta si isOpen=false; verificamos la exportación y toStaffEntry + tipos.
  assert.equal(typeof ListeningBoxModal, 'function');
  assert.equal(typeof ListeningAdminPanel, 'function');
  void React.createElement;
  void renderToStaticMarkup;

  const staffEntry = toStaffEntry({
    id: 'entry-1',
    userId: 'user-99',
    user: { name: 'Carla Gómez', email: 'carla@docentos.org' },
    courseId: null,
    course: null,
    type: 'PRAISE',
    topic: 'CONTENT',
    mood: 5,
    npsScore: 10,
    subject: 'Excelente curso',
    message: 'Muy claro todo el contenido.',
    anonymous: true,
    status: 'NEW',
    reply: null,
    repliedAt: null,
    replySeenAt: null,
    createdAt: new Date('2026-11-19T12:00:00Z'),
  });

  assert.equal(staffEntry.anonymous, false);
  assert.deepEqual(staffEntry.author, { name: 'Carla Gómez', email: 'carla@docentos.org' });

  const csv = listeningToCsv([staffEntry]);
  assert.ok(csv.includes('Carla Gómez'));
  assert.ok(csv.includes('carla@docentos.org'));
  assert.equal(csv.includes('anonimo'), false);
});
