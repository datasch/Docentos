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
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { AcademiaPlugin } from '../types';
import { pluginManager } from '../plugins/PluginManager';
import { SignaturePad } from './SignaturePad';
import { downloadCertificate } from '../plugins/CertificateGenerator';

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
      if (res.plugins) {
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
    setConfigFormState(initialConfig);
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!configModalPlugin) return;

    try {
      setSavingConfig(true);
      const res = await api.updatePluginConfig(configModalPlugin.id, configFormState);
      if (res.plugins) {
        setPlugins(res.plugins);
        pluginManager.setPlugins(res.plugins);
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
      default: return Layers;
    }
  };

  const filteredPlugins = selectedCategory === 'ALL'
    ? plugins
    : plugins.filter((p) => p.category === selectedCategory);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-[#0a0a0f] border border-[#262626] rounded-2xl p-6 sm:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#06b6d4]/10 border border-[#06b6d4]/30 text-[#06b6d4] text-xs font-bold">
            <Layers className="w-3.5 h-3.5" />
            <span>Arquitectura Modular de Plugins & Extensiones</span>
          </div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight">
            Gestor de Plugins Institucionales
          </h2>
          <p className="text-xs text-slate-400 max-w-2xl">
            Amplía la capacidad de la plataforma instalando y activando módulos de certificados PDF, exámenes interactivos, integración con webhooks de Discord/Slack y analíticas.
          </p>
        </div>

        <button
          onClick={loadPlugins}
          className="px-4 py-2 bg-[#141420] hover:bg-[#1f1f33] border border-[#262626] text-slate-300 text-xs font-bold rounded-xl transition-all flex items-center gap-2"
        >
          <RefreshCw className="w-3.5 h-3.5 text-[#06b6d4]" />
          <span>Sincronizar Plugins</span>
        </button>
      </div>

      {/* Category Pills */}
      <div className="flex flex-wrap gap-2">
        {['ALL', 'certificates', 'quizzes', 'integrations', 'analytics', 'meetings'].map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${selectedCategory === cat
              ? 'bg-[#06b6d4] text-black shadow-md'
              : 'bg-[#0a0a0f] text-slate-400 hover:text-white border border-[#262626]'
              }`}
          >
            {cat === 'ALL' ? 'Todos los Plugins' : cat.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Plugins Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredPlugins.map((plugin) => {
          const IconComponent = getPluginIcon(plugin.icon);
          return (
            <div
              key={plugin.id}
              className={`bg-[#141420] border rounded-xl p-6 transition-all flex flex-col justify-between space-y-4 ${plugin.enabled ? 'border-[#06b6d4]/50 shadow-lg shadow-[#06b6d4]/5' : 'border-[#2d2d44] opacity-75'
                }`}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center border ${plugin.enabled ? 'bg-[#06b6d4]/10 border-[#06b6d4] text-[#06b6d4]' : 'bg-[#1a1a2e] border-[#2d2d44] text-slate-500'
                      }`}>
                      <IconComponent className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-sm text-white flex items-center gap-2">
                        {plugin.name}
                        <span className="text-[10px] font-mono text-slate-500 font-normal">
                          v{plugin.version}
                        </span>
                      </h3>
                      <span className="text-[9px] font-bold text-[#a855f7] uppercase tracking-wider">
                        Categoría: {plugin.category}
                      </span>
                    </div>
                  </div>

                  {/* Toggle Switch */}
                  <button
                    onClick={() => handleTogglePlugin(plugin.id, plugin.enabled)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${plugin.enabled ? 'bg-[#06b6d4]' : 'bg-[#1a1a2e] border border-[#2d2d44]'
                      }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-black transition-transform ${plugin.enabled ? 'translate-x-6' : 'translate-x-1'
                        }`}
                    />
                  </button>
                </div>

                <p className="text-xs text-slate-400 leading-relaxed">
                  {plugin.description}
                </p>
              </div>

              {/* Plugin Footer Controls */}
              <div className="pt-3 border-t border-[#2d2d44] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-extrabold flex items-center gap-1 ${plugin.enabled ? 'text-emerald-400' : 'text-slate-500'
                    }`}>
                    <ShieldCheck className="w-3.5 h-3.5" />
                    {plugin.enabled ? 'Plugin Activo & Enlazado' : 'Desactivado'}
                  </span>

                  {plugin.category === 'certificates' && (plugin.config?.signatureImage || plugin.config?.signature) && (
                    <span className="text-[9px] font-bold text-[#06b6d4] bg-[#06b6d4]/10 border border-[#06b6d4]/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <PenTool className="w-2.5 h-2.5" /> Firma Lista
                    </span>
                  )}
                </div>

                <button
                  onClick={() => handleOpenConfigModal(plugin)}
                  className="px-3 py-1.5 bg-[#1a1a2e] hover:bg-[#2d2d44] border border-[#2d2d44] hover:border-[#06b6d4] text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1.5"
                >
                  <Settings className="w-3.5 h-3.5 text-[#06b6d4]" />
                  <span>Configurar</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Configuration Modal */}
      {configModalPlugin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div className="bg-[#141420] border border-[#2d2d44] rounded-xl p-6 w-full max-w-xl space-y-4 my-8 max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#2d2d44] pb-3">
              <div>
                <h3 className="font-extrabold text-sm text-white flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-[#06b6d4]" />
                  Configurar {configModalPlugin.name}
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {(configModalPlugin.id === 'pdf-certificates' || configModalPlugin.category === 'certificates')
                    ? 'Personaliza el logo, fondo blanco/negro, doble firma oficial y acreditación del diploma.'
                    : 'Ajusta los parámetros operativos del plugin institucional.'}
                </p>
              </div>
              <button
                onClick={() => setConfigModalPlugin(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-[#141420]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveConfig} className="space-y-4">
              {/* Specialized Form for Certificates Plugin */}
              {(configModalPlugin.id === 'pdf-certificates' || configModalPlugin.category === 'certificates') && (
                <div className="space-y-4">
                  {/* General Certificate Fields */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1">
                        Nombre de la Institución / Academia
                      </label>
                      <input
                        type="text"
                        value={configFormState.institutionName ?? ''}
                        onChange={(e) =>
                          setConfigFormState({ ...configFormState, institutionName: e.target.value })
                        }
                        className="w-full py-2 px-3 bg-[#0a0a0f] border border-[#2d2d44] focus:border-[#06b6d4] rounded-xl text-xs text-white focus:outline-none transition-colors"
                        placeholder="ej. Academia Giantucchi"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1">
                        Texto de Insignia / Distintivo
                      </label>
                      <input
                        type="text"
                        value={configFormState.badgeText ?? ''}
                        onChange={(e) =>
                          setConfigFormState({ ...configFormState, badgeText: e.target.value })
                        }
                        className="w-full py-2 px-3 bg-[#0a0a0f] border border-[#2d2d44] focus:border-[#06b6d4] rounded-xl text-xs text-white focus:outline-none transition-colors"
                        placeholder="ej. CERTIFICADO DE EXCELENCIA TÉCNICA"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1">
                        Color Primario del Certificado (Acento Brand Spectrum)
                      </label>
                      <div className="flex gap-2 items-center">
                        <input
                          type="color"
                          value={configFormState.primaryColor || '#06b6d4'}
                          onChange={(e) =>
                            setConfigFormState({ ...configFormState, primaryColor: e.target.value })
                          }
                          className="w-9 h-9 rounded-lg border border-[#2d2d44] bg-[#0a0a0f] cursor-pointer p-0.5"
                        />
                        <input
                          type="text"
                          value={configFormState.primaryColor ?? '#06b6d4'}
                          onChange={(e) =>
                            setConfigFormState({ ...configFormState, primaryColor: e.target.value })
                          }
                          className="flex-1 py-2 px-3 bg-[#0a0a0f] border border-[#2d2d44] focus:border-[#06b6d4] rounded-xl text-xs text-white focus:outline-none font-mono"
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
                  <div className="bg-[#141420] border border-[#2d2d44] rounded-xl p-3.5 space-y-2">
                    <label className="block text-[11px] font-extrabold text-slate-300 uppercase tracking-wider">
                      Fondo del Certificado (Blanco / Negro)
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setConfigFormState({ ...configFormState, backgroundColor: 'white' })}
                        className={`py-2.5 px-3 rounded-lg border text-xs font-bold flex items-center justify-center gap-2 transition-all ${configFormState.backgroundColor === 'white'
                          ? 'bg-[#1a1a2e] border-[#06b6d4] text-white shadow-md'
                          : 'bg-[#0a0a0f] border-[#2d2d44] text-slate-400 hover:text-white'
                          }`}
                      >
                        <span className="w-3.5 h-3.5 rounded-full bg-white border border-slate-300 inline-block" />
                        <span>Fondo Blanco Oficial</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfigFormState({ ...configFormState, backgroundColor: 'dark' })}
                        className={`py-2.5 px-3 rounded-lg border text-xs font-bold flex items-center justify-center gap-2 transition-all ${(configFormState.backgroundColor || 'dark') === 'dark'
                          ? 'bg-[#1a1a2e] border-[#06b6d4] text-white shadow-md'
                          : 'bg-[#0a0a0f] border-[#2d2d44] text-slate-400 hover:text-white'
                          }`}
                      >
                        <span className="w-3.5 h-3.5 rounded-full bg-[#0a0a0f] border border-slate-600 inline-block" />
                        <span>Fondo Negro / Oscuro</span>
                      </button>

                    </div>
                  </div>

                  {/* Logo de la Institución: Por defecto Giantucchi con opción de Universidad */}
                  <div className="bg-[#141420] border border-[#2d2d44] rounded-xl p-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-extrabold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                        <Upload className="w-3.5 h-3.5 text-[#06b6d4]" />
                        Logo del Certificado (Por defecto: Giantucchi)
                      </label>
                      {configFormState.institutionLogo && configFormState.institutionLogo !== '/logo.avif' ? (
                        <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                          Logo Universitario Activo
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-[#06b6d4] bg-[#06b6d4]/10 border border-[#06b6d4]/20 px-2 py-0.5 rounded-full">
                          Logo Oficial Giantucchi (Por Defecto)
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between p-3 bg-[#0a0a0f] border border-[#2d2d44] rounded-xl">
                      <div className="flex items-center gap-3">
                        <div className="w-14 h-12 rounded-lg bg-[#141420] border border-[#2d2d44] flex items-center justify-center p-1 overflow-hidden">
                          <img
                            src={configFormState.institutionLogo || '/logo.avif'}
                            alt="Logo Institucional"
                            className="max-h-full max-w-full object-contain"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        </div>
                        <div>
                          <span className="text-xs font-bold text-white block">
                            {configFormState.institutionLogo && configFormState.institutionLogo !== '/logo.avif'
                              ? 'Logo de Universidad / Instituto Cargado'
                              : 'Logo Oficial Academia Giantucchi'}
                          </span>
                          <span className="text-[10px] text-slate-400">
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
                            className="px-2.5 py-1.5 text-xs text-slate-300 hover:text-white bg-[#1a1a2e] hover:bg-[#2d2d44] border border-[#2d2d44] rounded-lg transition-colors"
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
                          className="px-2.5 py-1.5 text-xs font-bold text-black bg-gradient-to-r from-[#06b6d4] to-[#a855f7] hover:opacity-95 rounded-lg cursor-pointer flex items-center gap-1 transition-all"
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
                  <div className="border-t border-[#2d2d44] pt-3 space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-2">
                        <PenTool className="w-4 h-4 text-[#ec4899]" />
                        <span>Firmas y Acreditación Institucional</span>
                      </h4>
                      <span className="text-[10px] text-slate-400">
                        Configuración de Firmas Oficiales
                      </span>
                    </div>

                    {/* FIRMA 1: GIANTUCCHI (PRINCIPAL / OBLIGATORIA) */}
                    <div className="bg-[#141420] border border-[#2d2d44] rounded-xl p-3.5 space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-extrabold text-[#ec4899] uppercase tracking-wider flex items-center gap-1.5">
                          <Check className="w-3.5 h-3.5 text-[#ec4899]" />
                          Firma 1 : Academia Giantucchi (Principal)
                        </label>
                        <span className="text-[9px] font-bold text-[#ec4899] bg-[#ec4899]/10 border border-[#ec4899]/20 px-2 py-0.5 rounded-full">
                          Mentor Director & Evaluador
                        </span>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-300 uppercase tracking-wider mb-1">
                          Nombre y Cargo del Firmante Giantucchi
                        </label>
                        <input
                          type="text"
                          value={configFormState.signatoryTitle ?? ''}
                          onChange={(e) =>
                            setConfigFormState({ ...configFormState, signatoryTitle: e.target.value })
                          }
                          className="w-full py-2 px-3 bg-[#0a0a0f] border border-[#2d2d44] focus:border-[#ec4899] rounded-xl text-xs text-white focus:outline-none transition-colors"
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
                    <div className="bg-[#141420] border border-[#2d2d44] rounded-xl p-3.5 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <label className="text-[11px] font-extrabold text-[#06b6d4] uppercase tracking-wider flex items-center gap-1.5">
                            <PenTool className="w-3.5 h-3.5 text-[#06b6d4]" />
                            Firma 2 : Universidad o Instituto (Co-Certificación)
                          </label>
                          <p className="text-[10px] text-slate-400 mt-0.5">
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
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${configFormState.enableUniversitySignature ? 'bg-[#06b6d4]' : 'bg-[#1a1a2e] border border-[#2d2d44]'
                            }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-black transition-transform ${configFormState.enableUniversitySignature ? 'translate-x-6' : 'translate-x-1'
                              }`}
                          />
                        </button>
                      </div>

                      {configFormState.enableUniversitySignature ? (
                        <div className="space-y-3 pt-2 border-t border-[#2d2d44]">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-300 uppercase tracking-wider mb-1">
                              Nombre y Cargo del Firmante de la Universidad / Instituto
                            </label>
                            <input
                              type="text"
                              value={configFormState.universitySignatoryTitle ?? ''}
                              onChange={(e) =>
                                setConfigFormState({ ...configFormState, universitySignatoryTitle: e.target.value })
                              }
                              className="w-full py-2 px-3 bg-[#0a0a0f] border border-[#2d2d44] focus:border-[#06b6d4] rounded-xl text-xs text-white focus:outline-none transition-colors"
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
                        <div className="p-2.5 bg-[#0a0a0f] border border-[#2d2d44] rounded-lg text-center">
                          <span className="text-[11px] text-slate-400 font-medium">
                            🔒 Firma de institución inactiva. El certificado se emitirá con diseño de <strong className="text-white">Firma Única Centrada de Giantucchi</strong>.
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
                      className="w-full py-2.5 px-4 bg-gradient-to-r from-[#06b6d4]/20 via-[#a855f7]/20 to-[#eab308]/20 hover:from-[#06b6d4]/30 hover:to-[#eab308]/30 border border-[#06b6d4]/50 hover:border-[#06b6d4] text-white rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-lg"
                    >
                      <Download className={`w-4 h-4 text-[#06b6d4] ${downloadingSampleCert ? 'animate-bounce' : ''}`} />
                      <span>{downloadingSampleCert ? 'Generando diploma de alta resolución...' : 'Descargar Certificado de Muestra (PNG)'}</span>
                    </button>
                    <p className="text-[10px] text-slate-400 text-center mt-1">
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
                    <div className="space-y-3 p-4 bg-[#0a0a0f] border border-[#2d2d44] rounded-xl">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
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
                                  ? 'border-[#06b6d4] bg-[#06b6d4]/10 text-white shadow-md ring-1 ring-[#06b6d4]/30'
                                  : 'border-[#2d2d44] bg-[#141420] text-slate-400 hover:border-[#3d3d5c] hover:text-white'
                              }`}
                            >
                              <span className="text-base">{opt.icon}</span>
                              <span>{opt.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1">
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
                            className="flex-1 py-2.5 px-3 bg-[#000000] border border-[#2d2d44] focus:border-[#06b6d4] rounded-xl text-xs text-white focus:outline-none transition-colors font-mono"
                          />
                          {configFormState.defaultProvider === 'meet' ? (
                            <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-1 rounded-lg whitespace-nowrap">
                              Google Meet
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-[#06b6d4] bg-[#06b6d4]/10 border border-[#06b6d4]/30 px-2 py-1 rounded-lg whitespace-nowrap">
                              Jitsi Meet
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-500 mt-1">
                          {configFormState.defaultProvider === 'meet'
                            ? 'Al programar una clase, el formulario abrirá con Google Meet pre-seleccionado.'
                            : 'Al programar una clase, el formulario abrirá con Jitsi Meet pre-seleccionado y generará la sala automáticamente.'}
                        </p>
                      </div>
                    </div>
                  )}

                  {Object.keys(configModalPlugin.config || {})
                    .filter((k) => {
                      if (k === 'signatureImage' || k === 'signature' || k === 'institutionLogo' || k === 'backgroundColor') return false;
                      if (configModalPlugin.id === 'live-meetings' && (k === 'defaultProvider' || k === 'jitsiDomain')) return false;
                      return true;
                    })
                    .map((key) => {
                      const val = configFormState[key];
                      const label = FIELD_LABELS[key] || key;

                      if (typeof val === 'boolean') {
                        return (
                          <div key={key} className="flex items-center justify-between p-3 bg-[#000000] border border-[#262626] rounded-xl">
                            <label className="text-xs font-bold text-slate-200">
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
                              className="w-4 h-4 rounded text-[#06b6d4] focus:ring-0 cursor-pointer"
                            />
                          </div>
                        );
                      }

                      return (
                        <div key={key}>
                          <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1">
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
                            className="w-full py-2.5 px-3 bg-[#0a0a0f] border border-[#2d2d44] focus:border-[#06b6d4] rounded-xl text-xs text-white focus:outline-none transition-colors"
                          />
                        </div>
                      );
                    })}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#2d2d44]">
                <button
                  type="button"
                  onClick={() => setConfigModalPlugin(null)}
                  className="px-4 py-2 bg-[#1a1a2e] hover:bg-[#2d2d44] text-slate-300 hover:text-white text-xs font-bold rounded-lg border border-[#2d2d44] transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingConfig}
                  className="px-5 py-2 btn-brand-primary text-black font-extrabold text-xs rounded-lg shadow-lg flex items-center gap-1.5"
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
        </div>
      )}

    </div>
  );
};
