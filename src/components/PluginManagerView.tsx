/**
 * Panel de Administración de Plugins (`PluginManagerView.tsx`)
 * Academia Giantucchi
 *
 * Módulo para Administradores y Mentores para:
 * 1. Listar plugins instalados en la plataforma
 * 2. Activar o desactivar plugins en tiempo real
 * 3. Editar variables de configuración (IDs, Webhooks, Títulos de Certificado)
 */

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Layers,
  Award,
  CheckSquare,
  MessageSquare,
  BarChart3,
  Sliders,
  Check,
  X,
  Sparkles,
  Settings,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  PenTool,
  Download,
  Upload,
  Trash2,
  Video,
  Youtube,
  HardDrive,
  Palette,
  Monitor,
  Sun,
  Moon,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { AcademiaPlugin } from '../types';
import { pluginManager } from '../plugins/PluginManager';
import { SignaturePad } from './SignaturePad';
import { downloadCertificate } from '../plugins/CertificateGenerator';
import { applyPlatformTheme, ColorTheme, ColorMode, getCurrentColorMode, setColorMode } from '../lib/themeApplicator';
import { setCustomLogoUrl, setCustomBrandName, DEFAULT_LOGO_URL } from '../lib/logoConfig';
import { Image as ImageIcon, RotateCcw } from 'lucide-react';
import { FestiveHatOverlay } from './FestiveHatOverlay';

const FIELD_LABELS: Record<string, string> = {
  institutionName: 'Nombre de la Institución',
  signatoryTitle: 'Título / Cargo del Firmante',
  primaryColor: 'Color Primario del Certificado',
  badgeText: 'Texto del Distintivo / Insignia',
  webhookUrl: 'URL del Webhook de Discord / Slack',
  notifyOnQnA: 'Notificar en preguntas y respuestas (Q&A)',
  notifyOnCompletion: 'Notificar al completar módulos o cursos',
  passingScore: 'Puntuación mínima de aprobación (%)',
  maxAttempts: 'Intentos máximos permitidos',
  enableHeatmaps: 'Habilitar mapas de calor de progreso',
  trackSessionDuration: 'Registrar duración de sesiones',
  apiKeyConfigured: 'API Key de Google Drive configurada',
  autoEmbedPreview: 'Previsualización automática de video',
  allowPublicSharing: 'Permitir visualización pública',
  defaultProvider: 'Proveedor por defecto',
  jitsiDomain: 'Dominio del proveedor',
  enableAutoRecordingLink: 'Habilitar enlaces de grabación automática',
  requireVipAccess: 'Requerir Pase VIP para ingresar a clases en vivo',
  roomPrefix: 'Prefijo de sala Jitsi Meet',
  enableAiStructuring: 'Estructuración temática automática con IA',
  defaultLanguage: 'Idioma de generación por defecto',
  allowMentorAccess: 'Permitir a los mentores crear cursos desde YouTube',
  interfaceVersion: 'Versión de Interfaz DocentOS',
  colorTheme: 'Paleta de Acento Visual',
  density: 'Densidad de Interfaz',
  showQuickVersionSwitcher: 'Mostrar selector rápido de versiones en cabecera',
  customCampusName: 'Nombre del Campus / Institución',
};

export const PluginManagerView: React.FC = () => {
  const { t } = useTranslation();
  const [plugins, setPlugins] = useState<AcademiaPlugin[]>(pluginManager.getPlugins());
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [configModalPlugin, setConfigModalPlugin] = useState<AcademiaPlugin | null>(null);
  const [configFormState, setConfigFormState] = useState<Record<string, any>>({});
  const [savingConfig, setSavingConfig] = useState<boolean>(false);
  const [downloadingSampleCert, setDownloadingSampleCert] = useState<boolean>(false);

  const handleDownloadSampleCert = async () => {
    try {
      setDownloadingSampleCert(true);
      await downloadCertificate({
        studentName: 'Estudiante Ejemplar',
        courseTitle: 'Programa de Certificación Profesional',
        institutionName: configFormState.institutionName || 'Academia Giantucchi',
        signatoryTitle: configFormState.signatoryTitle || 'Prof. Giancarlo Giantucchi - Mentor Director & Evaluador',
        signatureImage: configFormState.signatureImage || configFormState.signature,
        enableUniversitySignature: Boolean(configFormState.enableUniversitySignature),
        universitySignatoryTitle: configFormState.universitySignatoryTitle || 'Dirección Académica - Universidad / Instituto',
        universitySignatureImage: configFormState.universitySignatureImage,
        primaryColor: configFormState.primaryColor || '#06b6d4',
        badgeText: configFormState.badgeText || 'Certificado de Excelencia Técnica',
        backgroundColor: configFormState.backgroundColor || 'dark',
        institutionLogo: configFormState.institutionLogo || '/logo.avif',
        certificateId: 'DOCENTOS-MUESTRA-2026',
      });
    } catch (err) {
      console.error('Error al descargar certificado de muestra:', err);
    } finally {
      setDownloadingSampleCert(false);
    }
  };

  useEffect(() => {
    loadPlugins();
  }, []);

  const loadPlugins = async () => {
    try {
      const res = await api.getPlugins();
      // `if (res.plugins)` daba verdadero con una lista vacia —en JavaScript
      // `[]` lo es— y entonces la vista se quedaba en blanco sin decir nada.
      // Medido en produccion el 17 sep 2026: la tabla estaba vacia y el panel
      // parecia roto. Se comprueba que sea una lista de verdad, y el vacio se
      // anuncia abajo en vez de disimularse.
      if (Array.isArray(res.plugins)) {
        setPlugins(res.plugins);
        pluginManager.setPlugins(res.plugins);
      }
    } catch (error) {
      console.error('Error al cargar plugins:', error);
    }
  };

  const handleTogglePlugin = async (pluginId: string, currentStatus: boolean) => {
    try {
      const res = await api.togglePlugin(pluginId, !currentStatus);
      if (res.plugins) {
        setPlugins(res.plugins);
        pluginManager.setPlugins(res.plugins);
      }
    } catch (error) {
      console.error('Error al cambiar estado del plugin:', error);
    }
  };

  const handleOpenConfigModal = (plugin: AcademiaPlugin) => {
    setConfigModalPlugin(plugin);
    const initialConfig = { ...(plugin.config || {}) };
    if (plugin.category === 'certificates' || plugin.id === 'pdf-certificates') {
      if (!initialConfig.institutionName) initialConfig.institutionName = 'Academia Giantucchi';
      if (!initialConfig.signatoryTitle) initialConfig.signatoryTitle = 'Prof. Giancarlo Giantucchi - Mentor Director & Evaluador';
      if (initialConfig.signatureImage === undefined) initialConfig.signatureImage = '';
      if (initialConfig.enableUniversitySignature === undefined) initialConfig.enableUniversitySignature = false;
      if (!initialConfig.universitySignatoryTitle) initialConfig.universitySignatoryTitle = 'Dirección Académica - Universidad / Instituto';
      if (initialConfig.universitySignatureImage === undefined) initialConfig.universitySignatureImage = '';
      if (!initialConfig.institutionLogo) initialConfig.institutionLogo = '/logo.avif';
      if (initialConfig.backgroundColor === undefined) initialConfig.backgroundColor = 'dark';
      if (!initialConfig.primaryColor) initialConfig.primaryColor = '#06b6d4';
    }
    if (plugin.id === 'live-meetings' || plugin.category === 'meetings') {
      if (!initialConfig.defaultProvider) initialConfig.defaultProvider = 'jitsi';
      if (!initialConfig.jitsiDomain) initialConfig.jitsiDomain = 'meet.jit.si';
    }
    if (plugin.id === 'docentos-customizer') {
      if (!initialConfig.colorMode) initialConfig.colorMode = getCurrentColorMode();
      const currentBrand = initialConfig.customCampusName || initialConfig.customBrandName;
      if (currentBrand) {
        initialConfig.customCampusName = currentBrand;
        initialConfig.customBrandName = currentBrand;
      }
    }
    setConfigFormState(initialConfig);
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!configModalPlugin) return;

    try {
      setSavingConfig(true);
      const unifiedState = { ...configFormState };
      if (configModalPlugin.id === 'docentos-customizer') {
        const brand = unifiedState.customCampusName || unifiedState.customBrandName;
        if (brand) {
          unifiedState.customCampusName = brand;
          unifiedState.customBrandName = brand;
        }
      }
      const res = await api.updatePluginConfig(configModalPlugin.id, unifiedState);
      if (res.plugins) {
        setPlugins(res.plugins);
        pluginManager.setPlugins(res.plugins);
      }
      if (configModalPlugin.id === 'docentos-customizer') {
        applyPlatformTheme(unifiedState.colorTheme, 'comfortable', unifiedState.colorMode);
        if (unifiedState.customLogoUrl !== undefined) {
          setCustomLogoUrl(unifiedState.customLogoUrl);
        }
        const brand = unifiedState.customCampusName || unifiedState.customBrandName;
        if (brand) {
          setCustomBrandName(brand);
        }
      }
      setConfigModalPlugin(null);
    } catch (error) {
      console.error('Error al guardar configuración de plugin:', error);
    } finally {
      setSavingConfig(false);
    }
  };

  const getPluginIcon = (iconName: string) => {
    switch (iconName) {
      case 'Award': return Award;
      case 'CheckSquare': return CheckSquare;
      case 'MessageSquare': return MessageSquare;
      case 'BarChart3': return BarChart3;
      case 'Video': return Video;
      case 'Youtube': return Youtube;
      case 'HardDrive': return HardDrive;
      case 'Palette': return Palette;
      default: return Layers;
    }
  };

  const filteredPlugins = selectedCategory === 'ALL'
    ? plugins
    : plugins.filter((p) => p.category === selectedCategory);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-canvas border border-line rounded-2xl p-6 sm:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-cyan/10 border border-brand-cyan/30 text-brand-cyan text-xs font-bold">
            <Layers className="w-3.5 h-3.5" />
            <span>Arquitectura Modular de Plugins & Extensiones</span>
          </div>
          <h2 className="text-2xl font-bold text-ink tracking-tight">
            Gestor de Plugins Institucionales
          </h2>
          <p className="text-xs text-ink-muted max-w-2xl">
            Amplía la capacidad de la plataforma instalando y activando módulos de certificados PDF, exámenes interactivos, integración con webhooks de Discord/Slack, personalización y analíticas.
          </p>
        </div>

        <button
          onClick={loadPlugins}
          className="px-4 py-2 bg-raised hover:bg-elevated border border-line text-ink-soft text-xs font-bold rounded-xl transition-all flex items-center gap-2"
        >
          <RefreshCw className="w-3.5 h-3.5 text-brand-cyan" />
          <span>Sincronizar Plugins</span>
        </button>
      </div>

      {/* Category Pills */}
      <div className="flex flex-wrap gap-2">
        {['ALL', 'certificates', 'quizzes', 'integrations', 'analytics', 'meetings', 'custom'].map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${selectedCategory === cat
              ? 'bg-brand-cyan text-black shadow-md'
              : 'bg-canvas text-ink-muted hover:text-ink border border-line'
              }`}
          >
            {cat === 'ALL' ? 'Todos los Plugins' : cat === 'custom' ? 'PERSONALIZACIÓN' : cat.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Un panel en blanco se lee como «esto esta roto». Si no hay nada que
          enseñar, se dice cual de las dos cosas pasa: que no hay plugins, o que
          el filtro no encuentra ninguno. */}
      {filteredPlugins.length === 0 && (
        <div className="bg-raised border border-line rounded-xl p-8 text-center space-y-1">
          <p className="text-sm font-bold text-ink">
            {plugins.length === 0 ? 'No hay plugins registrados' : 'Ningún plugin en esta categoría'}
          </p>
          <p className="text-meta text-ink-muted">
            {plugins.length === 0
              ? 'El catálogo se registra solo al arrancar la aplicación. Si sigues viendo esto, revisa el registro del servidor.'
              : 'Prueba con «Todos los Plugins».'}
          </p>
        </div>
      )}

      {/* Plugins Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredPlugins.map((plugin) => {
          const IconComponent = getPluginIcon(plugin.icon);
          return (
            <div
              key={plugin.id}
              className={`bg-raised border rounded-xl p-6 transition-all flex flex-col justify-between space-y-4 ${plugin.enabled ? 'border-brand-cyan/50 shadow-lg shadow-brand-cyan/5' : 'border-line opacity-75'
                }`}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center border ${plugin.enabled ? 'bg-brand-cyan/10 border-brand-cyan text-brand-cyan' : 'bg-elevated border-line text-ink-faint'
                      }`}>
                      <IconComponent className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-ink flex items-center gap-2">
                        {plugin.name}
                        <span className="text-micro font-mono text-ink-faint font-normal">
                          v{plugin.version}
                        </span>
                      </h3>
                      <span className="text-micro font-bold text-brand-purple uppercase tracking-wider">
                        Categoría: {plugin.category}
                      </span>
                    </div>
                  </div>

                  {/* Toggle Switch */}
                  <button
                    onClick={() => handleTogglePlugin(plugin.id, plugin.enabled)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${plugin.enabled ? 'bg-brand-cyan' : 'bg-elevated border border-line'
                      }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-black transition-transform ${plugin.enabled ? 'translate-x-6' : 'translate-x-1'
                        }`}
                    />
                  </button>
                </div>

                <p className="text-xs text-ink-muted leading-relaxed">
                  {plugin.description}
                </p>
              </div>

              {/* Plugin Footer Controls */}
              <div className="pt-3 border-t border-line flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`text-micro font-bold flex items-center gap-1 ${plugin.enabled ? 'text-success-light' : 'text-ink-faint'
                    }`}>
                    <ShieldCheck className="w-3.5 h-3.5" />
                    {plugin.enabled ? 'Plugin Activo & Enlazado' : 'Desactivado'}
                  </span>

                  {plugin.category === 'certificates' && (plugin.config?.signatureImage || plugin.config?.signature) && (
                    <span className="text-micro font-bold text-brand-cyan bg-brand-cyan/10 border border-brand-cyan/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <PenTool className="w-2.5 h-2.5" /> Firma Lista
                    </span>
                  )}
                </div>

                <button
                  onClick={() => handleOpenConfigModal(plugin)}
                  className="px-3 py-1.5 bg-elevated hover:bg-elevated border border-line hover:border-brand-cyan text-ink text-xs font-bold rounded-lg transition-all flex items-center gap-1.5"
                >
                  <Settings className="w-3.5 h-3.5 text-brand-cyan" />
                  <span>Configurar</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Configuration Modal */}
      {configModalPlugin && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md animate-fade-in"
          onMouseDown={() => setConfigModalPlugin(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className={`bg-raised border border-line rounded-2xl w-full ${
              configModalPlugin.id === 'docentos-customizer' ? 'max-w-3xl' : 'max-w-xl'
            } max-h-[85vh] flex flex-col shadow-2xl overflow-hidden`}
            onMouseDown={(e) => e.stopPropagation()}
          >
            
            {/* Header del Modal (Fijo arriba) */}
            <div className="flex items-center justify-between border-b border-line px-6 py-4 shrink-0 bg-raised/95 backdrop-blur-md">
              <div>
                <h3 className="font-bold text-sm text-ink flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-brand-cyan" />
                  <span>Configurar {configModalPlugin.name}</span>
                </h3>
                <p className="text-micro text-ink-muted mt-0.5">
                  {(configModalPlugin.id === 'pdf-certificates' || configModalPlugin.category === 'certificates')
                    ? 'Personaliza el logo, fondo blanco/negro, doble firma oficial y acreditación del diploma.'
                    : 'Ajusta los parámetros operativos del plugin institucional.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setConfigModalPlugin(null)}
                className="text-ink-muted hover:text-ink p-1.5 rounded-lg hover:bg-canvas transition-colors"
                title="Cerrar modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveConfig} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              {/* Cuerpo del Formulario (Scrollable) */}
              <div className="flex-1 overflow-y-auto p-6 space-y-5">
                {/* Specialized Form for Certificates Plugin */}
                {(configModalPlugin.id === 'pdf-certificates' || configModalPlugin.category === 'certificates') && (
                <div className="space-y-4">
                  {/* General Certificate Fields */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-micro font-bold text-ink-soft uppercase tracking-wider mb-1">
                        Nombre de la Institución / Academia
                      </label>
                      <input
                        type="text"
                        value={configFormState.institutionName ?? ''}
                        onChange={(e) =>
                          setConfigFormState({ ...configFormState, institutionName: e.target.value })
                        }
                        className="w-full py-2 px-3 bg-canvas border border-line focus:border-brand-cyan rounded-xl text-xs text-ink focus:outline-none transition-colors"
                        placeholder="ej. Academia Giantucchi"
                      />
                    </div>

                    <div>
                      <label className="block text-micro font-bold text-ink-soft uppercase tracking-wider mb-1">
                        Texto de Insignia / Distintivo
                      </label>
                      <input
                        type="text"
                        value={configFormState.badgeText ?? ''}
                        onChange={(e) =>
                          setConfigFormState({ ...configFormState, badgeText: e.target.value })
                        }
                        className="w-full py-2 px-3 bg-canvas border border-line focus:border-brand-cyan rounded-xl text-xs text-ink focus:outline-none transition-colors"
                        placeholder="ej. CERTIFICADO DE EXCELENCIA TÉCNICA"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-micro font-bold text-ink-soft uppercase tracking-wider mb-1">
                        Color Primario del Certificado (Acento Brand Spectrum)
                      </label>
                      <div className="flex gap-2 items-center">
                        <input
                          type="color"
                          value={configFormState.primaryColor || '#06b6d4'}
                          onChange={(e) =>
                            setConfigFormState({ ...configFormState, primaryColor: e.target.value })
                          }
                          className="w-9 h-9 rounded-lg border border-line bg-canvas cursor-pointer p-0.5"
                        />
                        <input
                          type="text"
                          value={configFormState.primaryColor ?? '#06b6d4'}
                          onChange={(e) =>
                            setConfigFormState({ ...configFormState, primaryColor: e.target.value })
                          }
                          className="flex-1 py-2 px-3 bg-canvas border border-line focus:border-brand-cyan rounded-xl text-xs text-ink focus:outline-none font-mono"
                        />
                        {/* Quick Giantucchi Brand Palette Presets */}
                        <div className="flex items-center gap-1.5 pl-1">
                          {[
                            { name: 'Cyan', hex: '#06b6d4' },
                            { name: 'Blue', hex: '#3b82f6' },
                            { name: 'Purple', hex: '#a855f7' },
                            { name: 'Magenta', hex: '#ec4899' },
                            { name: 'Orange', hex: '#f97316' },
                            { name: 'Yellow', hex: '#eab308' },
                          ].map((c) => (
                            <button
                              key={c.hex}
                              type="button"
                              title={`Color ${c.name} (${c.hex})`}
                              onClick={() => setConfigFormState({ ...configFormState, primaryColor: c.hex })}
                              style={{ backgroundColor: c.hex }}
                              className={`w-5 h-5 rounded-full border transition-transform hover:scale-110 ${configFormState.primaryColor === c.hex
                                ? 'border-white ring-2 ring-white/30 scale-110'
                                : 'border-transparent'
                                }`}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Personalización de Fondo: Blanco y Negro */}
                  <div className="bg-raised border border-line rounded-xl p-3.5 space-y-2">
                    <label className="block text-micro font-bold text-ink-soft uppercase tracking-wider">
                      Fondo del Certificado (Blanco / Negro)
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setConfigFormState({ ...configFormState, backgroundColor: 'white' })}
                        className={`py-2.5 px-3 rounded-lg border text-xs font-bold flex items-center justify-center gap-2 transition-all ${configFormState.backgroundColor === 'white'
                          ? 'bg-elevated border-brand-cyan text-ink shadow-md'
                          : 'bg-canvas border-line text-ink-muted hover:text-ink'
                          }`}
                      >
                        <span className="w-3.5 h-3.5 rounded-full bg-white border border-slate-300 inline-block" />
                        <span>Fondo Blanco Oficial</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfigFormState({ ...configFormState, backgroundColor: 'dark' })}
                        className={`py-2.5 px-3 rounded-lg border text-xs font-bold flex items-center justify-center gap-2 transition-all ${(configFormState.backgroundColor || 'dark') === 'dark'
                          ? 'bg-elevated border-brand-cyan text-ink shadow-md'
                          : 'bg-canvas border-line text-ink-muted hover:text-ink'
                          }`}
                      >
                        <span className="w-3.5 h-3.5 rounded-full bg-canvas border border-slate-600 inline-block" />
                        <span>Fondo Negro / Oscuro</span>
                      </button>

                    </div>
                  </div>

                  {/* Logo de la Institución: Por defecto Giantucchi con opción de Universidad */}
                  <div className="bg-raised border border-line rounded-xl p-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-micro font-bold text-ink-soft uppercase tracking-wider flex items-center gap-1.5">
                        <Upload className="w-3.5 h-3.5 text-brand-cyan" />
                        Logo del Certificado (Por defecto: Giantucchi)
                      </label>
                      {configFormState.institutionLogo && configFormState.institutionLogo !== '/logo.avif' ? (
                        <span className="text-micro font-bold text-warning-light bg-warning/10 border border-warning/20 px-2 py-0.5 rounded-full">
                          Logo Universitario Activo
                        </span>
                      ) : (
                        <span className="text-micro font-bold text-brand-cyan bg-brand-cyan/10 border border-brand-cyan/20 px-2 py-0.5 rounded-full">
                          Logo Oficial Giantucchi (Por Defecto)
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between p-3 bg-canvas border border-line rounded-xl">
                      <div className="flex items-center gap-3">
                        <div className="w-14 h-12 rounded-lg bg-raised border border-line flex items-center justify-center p-1 overflow-visible relative">
                          <img
                            src={configFormState.institutionLogo || '/logo.avif'}
                            alt="Logo Institucional"
                            className="max-h-full max-w-full object-contain"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                          <FestiveHatOverlay size="md" />
                        </div>
                        <div>
                          <span className="text-xs font-bold text-ink block">
                            {configFormState.institutionLogo && configFormState.institutionLogo !== '/logo.avif'
                              ? 'Logo de Universidad / Instituto Cargado'
                              : 'Logo Oficial Academia Giantucchi'}
                          </span>
                          <span className="text-micro text-ink-muted">
                            {configFormState.institutionLogo && configFormState.institutionLogo !== '/logo.avif'
                              ? 'Se mostrará en la cabecera oficial del diploma'
                              : 'Emblema institucional por defecto de la academia'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {configFormState.institutionLogo && configFormState.institutionLogo !== '/logo.avif' && (
                          <button
                            type="button"
                            onClick={() => setConfigFormState({ ...configFormState, institutionLogo: '/logo.avif' })}
                            className="px-2.5 py-1.5 text-xs text-ink-soft hover:text-ink bg-elevated hover:bg-elevated border border-line rounded-lg transition-colors"
                          >
                            Restablecer Giantucchi
                          </button>
                        )}
                        <input
                          type="file"
                          id="univ-logo-input"
                          accept="image/png,image/jpeg,image/svg+xml,image/webp,image/avif"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            if (file.size > 2 * 1024 * 1024) {
                              alert('El logo no debe superar 2 MB. Por favor elige una imagen más pequeña.');
                              e.target.value = '';
                              return;
                            }
                            e.target.value = '';
                            const reader = new FileReader();
                            reader.onload = (ev) => {
                              const dataUrl = ev.target?.result as string;
                              if (dataUrl) {
                                setConfigFormState({ ...configFormState, institutionLogo: dataUrl });
                              }
                            };
                            reader.readAsDataURL(file);
                          }}
                          className="hidden"
                        />
                        <label
                          htmlFor="univ-logo-input"
                          className="px-2.5 py-1.5 text-xs font-bold text-black bg-gradient-to-r from-brand-cyan to-brand-purple hover:opacity-95 rounded-lg cursor-pointer flex items-center gap-1 transition-all"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          <span>Subir Logo Universidad</span>
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* ═══════════════════════════════════════════════════════════════ */}
                  {/* SECCIÓN DE FIRMAS (GIANTUCCHI + UNIVERSIDAD/INSTITUTO OPCIONAL) */}
                  {/* ═══════════════════════════════════════════════════════════════ */}
                  <div className="border-t border-line pt-3 space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-ink flex items-center gap-2">
                        <PenTool className="w-4 h-4 text-brand-magenta" />
                        <span>Firmas y Acreditación Institucional</span>
                      </h4>
                      <span className="text-micro text-ink-muted">
                        Configuración de Firmas Oficiales
                      </span>
                    </div>

                    {/* FIRMA 1: GIANTUCCHI (PRINCIPAL / OBLIGATORIA) */}
                    <div className="bg-raised border border-line rounded-xl p-3.5 space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-micro font-bold text-brand-magenta uppercase tracking-wider flex items-center gap-1.5">
                          <Check className="w-3.5 h-3.5 text-brand-magenta" />
                          Firma 1 : Academia Giantucchi (Principal)
                        </label>
                        <span className="text-micro font-bold text-brand-magenta bg-brand-magenta/10 border border-brand-magenta/20 px-2 py-0.5 rounded-full">
                          Mentor Director & Evaluador
                        </span>
                      </div>

                      <div>
                        <label className="block text-micro font-bold text-ink-soft uppercase tracking-wider mb-1">
                          Nombre y Cargo del Firmante Giantucchi
                        </label>
                        <input
                          type="text"
                          value={configFormState.signatoryTitle ?? ''}
                          onChange={(e) =>
                            setConfigFormState({ ...configFormState, signatoryTitle: e.target.value })
                          }
                          className="w-full py-2 px-3 bg-canvas border border-line focus:border-brand-magenta rounded-xl text-xs text-ink focus:outline-none transition-colors"
                          placeholder="ej. Prof. Giancarlo Giantucchi - Mentor Director & Evaluador"
                        />
                      </div>

                      <SignaturePad
                        value={configFormState.signatureImage || configFormState.signature || ''}
                        onChange={(sig) =>
                          setConfigFormState((prev) => ({
                            ...prev,
                            signatureImage: sig,
                            signature: sig,
                          }))
                        }
                        signatoryTitle={configFormState.signatoryTitle || 'Prof. Giancarlo Giantucchi - Mentor Director & Evaluador'}
                        label="Firma Oficial de Giantucchi"
                      />
                    </div>

                    {/* FIRMA 2: UNIVERSIDADES O INSTITUTOS (OPCIONAL CON TOGGLE) */}
                    <div className="bg-raised border border-line rounded-xl p-3.5 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <label className="text-micro font-bold text-brand-cyan uppercase tracking-wider flex items-center gap-1.5">
                            <PenTool className="w-3.5 h-3.5 text-brand-cyan" />
                            Firma 2 : Universidad o Instituto (Co-Certificación)
                          </label>
                          <p className="text-micro text-ink-muted mt-0.5">
                            {configFormState.enableUniversitySignature
                              ? 'Co-certificación activa: El diploma incluirá la segunda firma institucional a la izquierda.'
                              : 'Opcional (Desactivada): El diploma se emitirá con firma única de Giantucchi centrada.'}
                          </p>
                        </div>

                        {/* Toggle de Firma Opcional */}
                        <button
                          type="button"
                          onClick={() =>
                            setConfigFormState({
                              ...configFormState,
                              enableUniversitySignature: !configFormState.enableUniversitySignature,
                            })
                          }
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${configFormState.enableUniversitySignature ? 'bg-brand-cyan' : 'bg-elevated border border-line'
                            }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-black transition-transform ${configFormState.enableUniversitySignature ? 'translate-x-6' : 'translate-x-1'
                              }`}
                          />
                        </button>
                      </div>

                      {configFormState.enableUniversitySignature ? (
                        <div className="space-y-3 pt-2 border-t border-line">
                          <div>
                            <label className="block text-micro font-bold text-ink-soft uppercase tracking-wider mb-1">
                              Nombre y Cargo del Firmante de la Universidad / Instituto
                            </label>
                            <input
                              type="text"
                              value={configFormState.universitySignatoryTitle ?? ''}
                              onChange={(e) =>
                                setConfigFormState({ ...configFormState, universitySignatoryTitle: e.target.value })
                              }
                              className="w-full py-2 px-3 bg-canvas border border-line focus:border-brand-cyan rounded-xl text-xs text-ink focus:outline-none transition-colors"
                              placeholder="ej. Dirección Académica - Universidad / Instituto"
                            />
                          </div>

                          <SignaturePad
                            value={configFormState.universitySignatureImage || ''}
                            onChange={(sig) =>
                              setConfigFormState((prev) => ({
                                ...prev,
                                universitySignatureImage: sig,
                              }))
                            }
                            signatoryTitle={configFormState.universitySignatoryTitle || 'Dirección Académica - Universidad / Instituto'}
                            label="Firma Oficial de la Universidad / Instituto"
                          />
                        </div>
                      ) : (
                        <div className="p-2.5 bg-canvas border border-line rounded-lg text-center">
                          <span className="text-micro text-ink-muted font-medium">
                            🔒 Firma de institución inactiva. El certificado se emitirá con diseño de <strong className="text-ink">Firma Única Centrada de Giantucchi</strong>.
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Botón para Descargar Certificado de Muestra */}
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={handleDownloadSampleCert}
                      disabled={downloadingSampleCert}
                      className="w-full py-2.5 px-4 bg-gradient-to-r from-brand-cyan/20 via-brand-purple/20 to-brand-yellow/20 hover:from-brand-cyan/30 hover:to-brand-yellow/30 border border-brand-cyan/50 hover:border-brand-cyan text-ink rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-lg"
                    >
                      <Download className={`w-4 h-4 text-brand-cyan ${downloadingSampleCert ? 'animate-bounce' : ''}`} />
                      <span>{downloadingSampleCert ? 'Generando diploma de alta resolución...' : 'Descargar Certificado de Muestra (PNG)'}</span>
                    </button>
                    <p className="text-micro text-ink-muted text-center mt-1">
                      Genera y descarga un diploma en PNG con tu fondo, logo, ambas firmas oficiales y metadatos centrados.
                    </p>
                  </div>
                </div>
              )}

              {/* Form Fields for Other Plugins (SIN FIRMA) */}
              {configModalPlugin.id !== 'pdf-certificates' && configModalPlugin.category !== 'certificates' && (
                <div className="space-y-4">
                  {/* Special: live-meetings provider selector with auto domain */}
                  {configModalPlugin.id === 'live-meetings' && (
                    <div className="space-y-3 p-4 bg-canvas border border-line rounded-xl">
                      <div>
                        <label className="block text-micro font-bold text-ink-soft uppercase tracking-wider mb-1.5">
                          Proveedor por defecto
                        </label>
                        <div className="grid grid-cols-2 gap-2.5">
                          {[
                            { value: 'jitsi', label: 'Jitsi Meet', icon: '🎥', color: '#06b6d4' },
                            { value: 'meet', label: 'Google Meet', icon: '📹', color: '#34a853' },
                          ].map((opt) => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => {
                                const domainMap: Record<string, string> = {
                                  jitsi: 'meet.jit.si',
                                  meet: 'meet.google.com',
                                };
                                setConfigFormState({
                                  ...configFormState,
                                  defaultProvider: opt.value,
                                  jitsiDomain: domainMap[opt.value] ?? (opt.value === 'meet' ? 'meet.google.com' : 'meet.jit.si'),
                                });
                              }}
                              className={`flex items-center justify-center gap-2 py-3 px-3 rounded-xl border text-xs font-bold transition-all ${
                                (configFormState.defaultProvider === opt.value || (!configFormState.defaultProvider && opt.value === 'jitsi'))
                                  ? 'border-brand-cyan bg-brand-cyan/10 text-ink shadow-md ring-1 ring-brand-cyan/30'
                                  : 'border-line bg-raised text-ink-muted hover:border-line-strong hover:text-ink'
                              }`}
                            >
                              <span className="text-base">{opt.icon}</span>
                              <span>{opt.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="block text-micro font-bold text-ink-soft uppercase tracking-wider mb-1">
                          Dominio del proveedor
                        </label>
                        <div className="flex gap-2 items-center">
                          <input
                            type="text"
                            value={configFormState.jitsiDomain ?? (configFormState.defaultProvider === 'meet' ? 'meet.google.com' : 'meet.jit.si')}
                            onChange={(e) =>
                              setConfigFormState({ ...configFormState, jitsiDomain: e.target.value })
                            }
                            placeholder={configFormState.defaultProvider === 'meet' ? 'meet.google.com' : 'meet.jit.si'}
                            className="flex-1 py-2.5 px-3 bg-canvas border border-line focus:border-brand-cyan rounded-xl text-xs text-ink focus:outline-none transition-colors font-mono"
                          />
                          {configFormState.defaultProvider === 'meet' ? (
                            <span className="text-micro font-bold text-success-light bg-success/10 border border-success/30 px-2 py-1 rounded-lg whitespace-nowrap">
                              Google Meet
                            </span>
                          ) : (
                            <span className="text-micro font-bold text-brand-cyan bg-brand-cyan/10 border border-brand-cyan/30 px-2 py-1 rounded-lg whitespace-nowrap">
                              Jitsi Meet
                            </span>
                          )}
                        </div>
                        <p className="text-micro text-ink-faint mt-1">
                          {configFormState.defaultProvider === 'meet'
                            ? 'Al programar una clase, el formulario abrirá con Google Meet pre-seleccionado.'
                            : 'Al programar una clase, el formulario abrirá con Jitsi Meet pre-seleccionado y generará la sala automáticamente.'}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Special: docentos-customizer visual suite */}
                  {configModalPlugin.id === 'docentos-customizer' && (
                    <div className="space-y-6 p-5 sm:p-6 bg-canvas border border-line rounded-2xl">
                      {/* Arquitectura y Versión de Navegación */}
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between">
                          <label className="block text-micro font-bold text-ink-soft uppercase tracking-wider">
                            Arquitectura y Versión de Navegación
                          </label>
                          <span className="text-micro font-bold text-brand-cyan">
                            {configFormState.interfaceVersion === 'v0.4-classic' ? '🏛️ v0.4 Clásica Activa' : '🌟 v0.5 Moderna Activa'}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Tarjeta 1: v0.5 Moderna */}
                          <button
                            type="button"
                            onClick={() => {
                              setConfigFormState((prev) => ({ ...prev, interfaceVersion: 'v0.5-modern' }));
                              pluginManager.updateConfig('docentos-customizer', { interfaceVersion: 'v0.5-modern' });
                            }}
                            className={`p-4 rounded-xl border text-left transition-all flex flex-col justify-between gap-3 cursor-pointer ${
                              configFormState.interfaceVersion !== 'v0.4-classic'
                                ? 'border-brand-cyan bg-brand-cyan/10 ring-2 ring-brand-cyan/40 text-ink shadow-md'
                                : 'border-line bg-raised text-ink-muted hover:border-line-strong hover:text-ink'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-bold text-ink flex items-center gap-2">
                                <span>🌟</span> DocentOS 0.5 (Moderna)
                              </span>
                              <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-brand-cyan/20 text-brand-cyan font-bold border border-brand-cyan/30">
                                Unificada
                              </span>
                            </div>
                            <p className="text-xs text-ink-muted leading-relaxed">
                              4 Macro-secciones con sub-navegación simétrica (2 botones por sección) y estudios integrados de Medios y Portal.
                            </p>
                          </button>

                          {/* Tarjeta 2: v0.4 Clásica */}
                          <button
                            type="button"
                            onClick={() => {
                              setConfigFormState((prev) => ({ ...prev, interfaceVersion: 'v0.4-classic' }));
                              pluginManager.updateConfig('docentos-customizer', { interfaceVersion: 'v0.4-classic' });
                            }}
                            className={`p-4 rounded-xl border text-left transition-all flex flex-col justify-between gap-3 cursor-pointer ${
                              configFormState.interfaceVersion === 'v0.4-classic'
                                ? 'border-brand-cyan bg-brand-cyan/10 ring-2 ring-brand-cyan/40 text-ink shadow-md'
                                : 'border-line bg-raised text-ink-muted hover:border-line-strong hover:text-ink'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-bold text-ink flex items-center gap-2">
                                <span>🏛️</span> DocentOS 0.4 (Clásica)
                              </span>
                              <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-bold border border-amber-500/30">
                                Apartado Anterior
                              </span>
                            </div>
                            <p className="text-xs text-ink-muted leading-relaxed">
                              La vista original con la barra completa de 11 pestañas directas desplegadas en horizontal tal como estaba antes.
                            </p>
                          </button>
                        </div>
                      </div>

                      {/* Paleta de Color de Acento con cambio global en caliente */}
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between">
                          <label className="block text-micro font-bold text-ink-soft uppercase tracking-wider">
                            Color de Acento del Campus (Cambio Global en Vivo)
                          </label>
                          <span className="text-micro font-bold text-brand-cyan">
                            Activo: {
                              configFormState.colorTheme === 'violet' ? 'Violeta Neón (#a855f7)' :
                              configFormState.colorTheme === 'emerald' ? 'Esmeralda (#10b981)' :
                              configFormState.colorTheme === 'amber' ? 'Ámbar Gold (#f59e0b)' :
                              'Cian DocentOS (#06b6d4)'
                            }
                          </span>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          {[
                            { key: 'cyan', label: 'Cian DocentOS', bg: '#06b6d4' },
                            { key: 'violet', label: 'Violeta Neón', bg: '#8b5cf6' },
                            { key: 'emerald', label: 'Esmeralda', bg: '#10b981' },
                            { key: 'amber', label: 'Ámbar Gold', bg: '#f59e0b' },
                          ].map((c) => {
                            const isSelected = (configFormState.colorTheme || 'cyan') === c.key;
                            return (
                              <button
                                key={c.key}
                                type="button"
                                onClick={() => {
                                  const chosenColor = c.key as ColorTheme;
                                  setConfigFormState((prev) => ({ ...prev, colorTheme: chosenColor, density: 'comfortable' }));
                                  applyPlatformTheme(chosenColor, 'comfortable');
                                  pluginManager.updateConfig('docentos-customizer', { colorTheme: chosenColor, density: 'comfortable' });
                                }}
                                className={`p-3 rounded-xl border text-xs font-bold flex items-center gap-2.5 transition-all cursor-pointer ${
                                  isSelected
                                    ? 'border-brand-cyan bg-elevated text-ink ring-2 ring-brand-cyan shadow-md'
                                    : 'border-line bg-raised text-ink-muted hover:text-ink hover:border-line-strong'
                                }`}
                              >
                                <span className="theme-dot w-4 h-4 rounded-full shadow-sm ring-1 ring-white/20 shrink-0" style={{ backgroundColor: c.bg }} />
                                <span className="font-semibold">{c.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Modo de Iluminación: Claro vs Oscuro */}
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between">
                          <label className="block text-micro font-bold text-ink-soft uppercase tracking-wider">
                            Modo de Iluminación (Tema Claro / Oscuro)
                          </label>
                          <span className="text-micro font-bold text-brand-cyan">
                            Activo: {configFormState.colorMode === 'light' ? '☀️ Modo Claro (Blanco)' : '🌙 Modo Oscuro'}
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {/* Opción Modo Oscuro */}
                          <button
                            type="button"
                            onClick={() => {
                              setConfigFormState((prev) => ({ ...prev, colorMode: 'dark' }));
                              setColorMode('dark');
                              pluginManager.updateConfig('docentos-customizer', { colorMode: 'dark' });
                            }}
                            className={`p-3.5 rounded-xl border text-left transition-all flex items-center justify-between cursor-pointer ${
                              configFormState.colorMode !== 'light'
                                ? 'border-brand-cyan bg-brand-cyan/10 ring-2 ring-brand-cyan/40 text-ink shadow-md'
                                : 'border-line bg-raised text-ink-muted hover:border-line-strong hover:text-ink'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-lg bg-[#0e0e17] border border-[#2d2d44] flex items-center justify-center text-indigo-400 shrink-0">
                                <Moon className="w-5 h-5" />
                              </div>
                              <div>
                                <div className="text-sm font-bold text-ink">Modo Oscuro</div>
                                <div className="text-micro text-ink-muted">Contraste nocturno descansado</div>
                              </div>
                            </div>
                            {configFormState.colorMode !== 'light' && (
                              <Check className="w-5 h-5 text-brand-cyan shrink-0" />
                            )}
                          </button>

                          {/* Opción Modo Claro */}
                          <button
                            type="button"
                            onClick={() => {
                              setConfigFormState((prev) => ({ ...prev, colorMode: 'light' }));
                              setColorMode('light');
                              pluginManager.updateConfig('docentos-customizer', { colorMode: 'light' });
                            }}
                            className={`p-3.5 rounded-xl border text-left transition-all flex items-center justify-between cursor-pointer ${
                              configFormState.colorMode === 'light'
                                ? 'border-brand-cyan bg-brand-cyan/10 ring-2 ring-brand-cyan/40 text-ink shadow-md'
                                : 'border-line bg-raised text-ink-muted hover:border-line-strong hover:text-ink'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-lg bg-white border border-slate-300 flex items-center justify-center text-amber-500 shadow-sm shrink-0">
                                <Sun className="w-5 h-5" />
                              </div>
                              <div>
                                <div className="text-sm font-bold text-ink">Modo Claro (Blanco)</div>
                                <div className="text-micro text-ink-muted">Fondos claros de alta legibilidad</div>
                              </div>
                            </div>
                            {configFormState.colorMode === 'light' && (
                              <Check className="w-5 h-5 text-brand-cyan shrink-0" />
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Nombre de la Institución o Campus (Global) */}
                      <div className="space-y-2 p-4 rounded-xl bg-raised border border-line">
                        <div className="flex items-center justify-between">
                          <label className="block text-micro font-bold text-ink-soft uppercase tracking-wider flex items-center gap-1.5">
                            <Sliders className="w-3.5 h-3.5 text-brand-cyan" />
                            <span>Nombre de la Institución o Campus (Global)</span>
                          </label>
                          <span className="text-micro font-bold text-brand-cyan">
                            Cambio Global en Vivo
                          </span>
                        </div>
                        <p className="text-[11px] text-ink-muted leading-relaxed">
                          Define el nombre oficial de tu plataforma. Se actualiza en tiempo real en la barra de navegación, panel administrativo, diplomas y portal.
                        </p>
                        <input
                          type="text"
                          value={configFormState.customCampusName ?? configFormState.customBrandName ?? ''}
                          onChange={(e) => {
                            const newName = e.target.value;
                            setConfigFormState((prev) => ({
                              ...prev,
                              customCampusName: newName,
                              customBrandName: newName,
                            }));
                            setCustomBrandName(newName);
                          }}
                          className="w-full py-2.5 px-3.5 bg-canvas border border-line focus:border-brand-cyan rounded-xl text-xs text-ink focus:outline-none transition-colors font-medium"
                          placeholder="ej. DocentOS, Academia Giantucchi o Nombre de tu Institución"
                        />
                        <div className="flex items-center gap-2 pt-1 flex-wrap">
                          <span className="text-[10px] text-ink-muted">Sugerencias:</span>
                          {['DocentOS', 'Academia Giantucchi', 'Instituto Tecnológico'].map((name) => (
                            <button
                              key={name}
                              type="button"
                              onClick={() => {
                                setConfigFormState((prev) => ({
                                  ...prev,
                                  customCampusName: name,
                                  customBrandName: name,
                                }));
                                setCustomBrandName(name);
                              }}
                              className="text-[10px] px-2 py-0.5 rounded-md bg-canvas border border-line text-ink-soft hover:text-ink hover:border-brand-cyan transition-colors cursor-pointer"
                            >
                              {name}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Logo Institucional y Sincronización con Scroll Animation */}
                      <div className="space-y-3 pt-2 border-t border-line">
                        <div className="flex items-center justify-between">
                          <label className="block text-micro font-bold text-ink-soft uppercase tracking-wider flex items-center gap-1.5">
                            <ImageIcon className="w-3.5 h-3.5 text-brand-cyan" />
                            <span>Logo de la Institución & Animación de Scroll</span>
                          </label>
                          <span className="text-micro font-bold text-brand-cyan">
                            Sincroniza Canvas 3D + Navbar
                          </span>
                        </div>
                        <p className="text-[11px] text-ink-muted leading-relaxed">
                          Al cambiar el logo aquí, se actualiza automáticamente el Navbar, el branding del campus y el 
                          <span className="text-brand-cyan font-bold"> efecto de Scroll Animation en la portada</span>, 
                          ensamblando las partículas 3D con la silueta de tu nuevo logo.
                        </p>

                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 rounded-xl bg-raised border border-line">
                          {/* Previsualización del Logo */}
                          <div className="w-16 h-16 rounded-xl bg-black/40 border border-line flex items-center justify-center p-2 shrink-0 overflow-visible shadow-inner relative group">
                            <img
                              src={configFormState.customLogoUrl || DEFAULT_LOGO_URL}
                              alt="Logo Institución"
                              className="w-full h-full object-contain filter drop-shadow-[0_0_8px_rgba(6,182,212,0.5)]"
                              onError={(e) => {
                                (e.currentTarget as HTMLImageElement).src = DEFAULT_LOGO_URL;
                              }}
                            />
                            {/* Gorro festivo adaptado al logo personalizado */}
                            <FestiveHatOverlay size="lg" />
                          </div>

                          {/* Opciones de carga */}
                          <div className="flex-1 w-full space-y-2">
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                value={configFormState.customLogoUrl ?? ''}
                                onChange={(e) => {
                                  const newLogo = e.target.value;
                                  setConfigFormState((prev) => ({ ...prev, customLogoUrl: newLogo }));
                                  setCustomLogoUrl(newLogo);
                                }}
                                className="flex-1 py-2 px-3 bg-canvas border border-line focus:border-brand-cyan rounded-lg text-xs text-ink focus:outline-none transition-colors"
                                placeholder="URL de la imagen (ej: /logo.avif o https://...)"
                              />

                              {/* Botón para subir archivo local y convertir a Base64 */}
                              <label className="px-3 py-2 rounded-lg bg-elevated hover:bg-canvas border border-line hover:border-brand-cyan text-ink text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0">
                                <Upload className="w-3.5 h-3.5 text-brand-cyan" />
                                <span className="hidden md:inline">Subir</span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      const reader = new FileReader();
                                      reader.onload = (evt) => {
                                        const base64 = evt.target?.result as string;
                                        if (base64) {
                                          setConfigFormState((prev) => ({ ...prev, customLogoUrl: base64 }));
                                          setCustomLogoUrl(base64);
                                        }
                                      };
                                      reader.readAsDataURL(file);
                                    }
                                  }}
                                />
                              </label>

                              {/* Botón Restablecer */}
                              {configFormState.customLogoUrl && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setConfigFormState((prev) => ({ ...prev, customLogoUrl: '' }));
                                    setCustomLogoUrl('');
                                  }}
                                  className="p-2 rounded-lg bg-raised hover:bg-elevated border border-line text-ink-muted hover:text-ink transition-all cursor-pointer"
                                  title="Restablecer logo por defecto"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>

                            {/* Presets rápidos */}
                            <div className="flex flex-wrap items-center gap-1.5 pt-1">
                              <span className="text-[10px] text-ink-muted font-bold mr-1">Presets:</span>
                              {[
                                { label: '🌌 Giantucchi Hex', url: '/logo.avif' },
                                { label: '⚛️ React Core', url: 'https://upload.wikimedia.org/wikipedia/commons/a/a7/React-icon.svg' },
                                { label: '🌐 Web Globe', url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150&auto=format&fit=crop&q=80' },
                              ].map((preset) => (
                                <button
                                  key={preset.label}
                                  type="button"
                                  onClick={() => {
                                    setConfigFormState((prev) => ({ ...prev, customLogoUrl: preset.url }));
                                    setCustomLogoUrl(preset.url);
                                  }}
                                  className="text-[10px] px-2 py-0.5 rounded-md bg-canvas hover:bg-elevated border border-line text-ink-soft hover:text-ink transition-colors cursor-pointer"
                                >
                                  {preset.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {Object.keys(configModalPlugin.config || {})
                    .filter((k) => {
                      if (k === 'signatureImage' || k === 'signature' || k === 'institutionLogo' || k === 'backgroundColor') return false;
                      if (configModalPlugin.id === 'live-meetings' && (k === 'defaultProvider' || k === 'jitsiDomain')) return false;
                      if (configModalPlugin.id === 'docentos-customizer') return false;
                      return true;
                    })
                    .map((key) => {
                      const val = configFormState[key];
                      const label = FIELD_LABELS[key] || key;

                      if (typeof val === 'boolean') {
                        return (
                          <div key={key} className="flex items-center justify-between p-3 bg-canvas border border-line rounded-xl">
                            <label className="text-xs font-bold text-ink-soft">
                              {label}
                            </label>
                            <input
                              type="checkbox"
                              checked={Boolean(val)}
                              onChange={(e) =>
                                setConfigFormState({
                                  ...configFormState,
                                  [key]: e.target.checked,
                                })
                              }
                              className="w-4 h-4 rounded text-brand-cyan focus:ring-0 cursor-pointer"
                            />
                          </div>
                        );
                      }

                      return (
                        <div key={key}>
                          <label className="block text-micro font-bold text-ink-soft uppercase tracking-wider mb-1">
                            {label}
                          </label>
                          <input
                            type={typeof val === 'number' ? 'number' : 'text'}
                            value={val !== undefined ? val : ''}
                            onChange={(e) =>
                              setConfigFormState({
                                ...configFormState,
                                [key]: typeof val === 'number' ? Number(e.target.value) : e.target.value,
                              })
                            }
                            className="w-full py-2.5 px-3 bg-canvas border border-line focus:border-brand-cyan rounded-xl text-xs text-ink focus:outline-none transition-colors"
                          />
                        </div>
                      );
                    })}
                </div>
              )}
              </div>

              {/* Footer Fijo del Modal (Siempre visible en pantalla) */}
              <div className="flex items-center justify-end gap-2.5 px-5 sm:px-6 py-3.5 border-t border-line shrink-0 bg-raised/95 backdrop-blur-md">
                <button
                  type="button"
                  onClick={() => setConfigModalPlugin(null)}
                  className="px-4 py-2 bg-elevated hover:bg-canvas text-ink-soft hover:text-ink text-xs font-bold rounded-lg border border-line transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingConfig}
                  className="px-5 py-2 btn-brand-primary text-black font-bold text-xs rounded-lg shadow-lg flex items-center gap-1.5 transition-opacity"
                >
                  {savingConfig ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Guardando...</span>
                    </>
                  ) : (
                    <span>Guardar Ajustes</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
};
