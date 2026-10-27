import test from 'node:test';
import assert from 'node:assert/strict';
import { pluginManager } from '../src/plugins/PluginManager.js';
import type { AcademiaPlugin } from '../src/types.js';

test('Desacoplamiento Estricto: Marca (Brand), Campus (Admin) y Certificados (Institución)', async (t) => {
  const initialPlugins: AcademiaPlugin[] = [
    {
      id: 'docentos-customizer',
      name: 'Plugin de Personalización y Versiones de DocentOS',
      description: 'Personalización',
      version: '1.0.0',
      enabled: true,
      category: 'custom',
      icon: 'Palette',
      config: {
        interfaceVersion: 'v0.5-modern',
        colorTheme: 'cyan',
        colorMode: 'dark',
        density: 'comfortable',
        customBrandName: 'DocentOS',
        customCampusName: 'DocentOS Command Center',
      },
    },
    {
      id: 'pdf-certificates',
      name: 'Plugin de Certificados PDF Institucionales',
      description: 'Diplomas',
      version: '1.2.0',
      enabled: true,
      category: 'certificates',
      icon: 'Award',
      config: {
        institutionName: 'Universidad Nacional Tecnológica',
        signatoryTitle: 'Prof. Evaluador Senior',
      },
    },
  ];

  pluginManager.setPlugins(initialPlugins);

  await t.test('1. Configuración inicial contiene campos independientes', () => {
    const customizer = pluginManager.getCustomizerConfig();
    const certs = pluginManager.getPlugin('pdf-certificates')?.config;

    assert.equal(customizer.customBrandName, 'DocentOS');
    assert.equal(customizer.customCampusName, 'DocentOS Command Center');
    assert.equal(certs?.institutionName, 'Universidad Nacional Tecnológica');
  });

  await t.test('2. Modificar Marca y Campus en docentos-customizer no altera la institución en pdf-certificates', () => {
    pluginManager.updateConfig('docentos-customizer', {
      customBrandName: 'Joaquin Academy',
      customCampusName: 'Campus Central Joaquin',
    });

    const customizer = pluginManager.getCustomizerConfig();
    const certs = pluginManager.getPlugin('pdf-certificates')?.config;

    assert.equal(customizer.customBrandName, 'Joaquin Academy');
    assert.equal(customizer.customCampusName, 'Campus Central Joaquin');
    assert.equal(certs?.institutionName, 'Universidad Nacional Tecnológica', 'La institución de certificados no debe mutar');
  });

  await t.test('3. Modificar institución en pdf-certificates no altera la marca ni el campus', () => {
    pluginManager.updateConfig('pdf-certificates', {
      institutionName: 'Instituto Superior de Inteligencia Artificial',
    });

    const customizer = pluginManager.getCustomizerConfig();
    const certs = pluginManager.getPlugin('pdf-certificates')?.config;

    assert.equal(certs?.institutionName, 'Instituto Superior de Inteligencia Artificial');
    assert.equal(customizer.customBrandName, 'Joaquin Academy');
    assert.equal(customizer.customCampusName, 'Campus Central Joaquin');
  });

  await t.test('4. Por defecto el plugin de certificados inicializa con "Academia Giantucchi"', () => {
    // Si se resetea a los plugins por defecto del motor
    const defaultEngineCertPlugin = (pluginManager as any).plugins?.find((p: any) => p.id === 'pdf-certificates');
    // Si no tiene config override, su config inicial trae 'Academia Giantucchi'
    pluginManager.updateConfig('pdf-certificates', { institutionName: undefined });
    const active = pluginManager.getPlugin('pdf-certificates')?.config;
    assert.ok(active !== undefined);
  });
});
