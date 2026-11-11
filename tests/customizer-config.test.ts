import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCustomizerSaveConfig,
  mergeCustomizerDraft,
  normalizeCustomizerConfig,
  type CustomizerConfig,
} from '../src/lib/customizerConfig.js';

const baseConfig: CustomizerConfig = {
  interfaceVersion: 'v0.5-modern',
  colorTheme: 'cyan',
  colorMode: 'dark',
  density: 'compact',
  showQuickVersionSwitcher: false,
  customCampusName: 'DocentOS Command Center',
  customBrandName: 'DocentOS',
  customLogoUrl: '',
};

test('cambiar la paleta conserva la densidad seleccionada', () => {
  const draft = mergeCustomizerDraft(baseConfig, { colorTheme: 'amber' });

  assert.equal(draft.colorTheme, 'amber');
  assert.equal(draft.density, 'compact');
});

test('el guardado conserva la densidad y normaliza marca y campus', () => {
  const saved = buildCustomizerSaveConfig({
    ...baseConfig,
    density: 'compact',
    customBrandName: ' Academia ',
    customCampusName: ' Campus Central ',
  });

  assert.equal(saved.density, 'compact');
  assert.equal(saved.customBrandName, 'Academia');
  assert.equal(saved.customCampusName, 'Campus Central');
  assert.equal('institutionName' in saved, false);
});

test('la configuración inicial del modal tiene valores seguros y estables', () => {
  const normalized = normalizeCustomizerConfig({
    colorTheme: 'violet',
    density: 'compact',
    customBrandName: 'Academia',
  });

  assert.deepEqual(normalized, {
    interfaceVersion: 'v0.5-modern',
    colorTheme: 'violet',
    colorMode: 'dark',
    density: 'compact',
    showQuickVersionSwitcher: false,
    customCampusName: 'DocentOS Command Center',
    customBrandName: 'Academia',
    customLogoUrl: '',
  });
});
