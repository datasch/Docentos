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
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { AcademiaPlugin } from '../types';
import { pluginManager } from '../plugins/PluginManager';

export const PluginManagerView: React.FC = () => {
  const { t } = useTranslation();
  const [plugins, setPlugins] = useState<AcademiaPlugin[]>(pluginManager.getPlugins());
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [configModalPlugin, setConfigModalPlugin] = useState<AcademiaPlugin | null>(null);
  const [configFormState, setConfigFormState] = useState<Record<string, any>>({});
  const [savingConfig, setSavingConfig] = useState<boolean>(false);

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
    setConfigFormState(plugin.config || {});
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
        {['ALL', 'certificates', 'quizzes', 'integrations', 'analytics'].map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              selectedCategory === cat
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
              className={`bg-[#0a0a0f] border rounded-2xl p-6 transition-all flex flex-col justify-between space-y-4 ${
                plugin.enabled ? 'border-[#06b6d4]/50 shadow-lg shadow-[#06b6d4]/5' : 'border-[#262626] opacity-75'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
                      plugin.enabled ? 'bg-[#06b6d4]/10 border-[#06b6d4] text-[#06b6d4]' : 'bg-[#141420] border-[#262626] text-slate-500'
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
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                      plugin.enabled ? 'bg-[#06b6d4]' : 'bg-[#141420] border border-[#262626]'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-black transition-transform ${
                        plugin.enabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                <p className="text-xs text-slate-400 leading-relaxed">
                  {plugin.description}
                </p>
              </div>

              {/* Plugin Footer Controls */}
              <div className="pt-3 border-t border-[#262626] flex items-center justify-between">
                <span className={`text-[10px] font-extrabold flex items-center gap-1 ${
                  plugin.enabled ? 'text-emerald-400' : 'text-slate-500'
                }`}>
                  <ShieldCheck className="w-3.5 h-3.5" />
                  {plugin.enabled ? 'Plugin Activo & Enlazado' : 'Desactivado'}
                </span>

                <button
                  onClick={() => handleOpenConfigModal(plugin)}
                  className="px-3 py-1.5 bg-[#141420] hover:bg-[#1a1a2e] border border-[#262626] hover:border-[#06b6d4] text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#0a0a0f] border border-[#262626] rounded-2xl p-6 w-full max-w-lg space-y-4">
            <div className="flex items-center justify-between border-b border-[#262626] pb-3">
              <h3 className="font-extrabold text-sm text-white flex items-center gap-2">
                <Sliders className="w-4 h-4 text-[#06b6d4]" />
                Configurar {configModalPlugin.name}
              </h3>
              <button
                onClick={() => setConfigModalPlugin(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveConfig} className="space-y-4">
              {Object.keys(configModalPlugin.config || {}).map((key) => {
                const val = configFormState[key];
                return (
                  <div key={key}>
                    <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1">
                      {key}
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
                      className="w-full py-2.5 px-3 bg-[#000000] border border-[#262626] focus:border-[#06b6d4] rounded-xl text-xs text-white focus:outline-none"
                    />
                  </div>
                );
              })}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#262626]">
                <button
                  type="button"
                  onClick={() => setConfigModalPlugin(null)}
                  className="px-4 py-2 bg-[#141420] text-slate-400 text-xs font-bold rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingConfig}
                  className="px-4 py-2 bg-gradient-to-r from-[#06b6d4] to-[#a855f7] text-black font-extrabold text-xs rounded-xl shadow-lg"
                >
                  {savingConfig ? 'Guardando...' : 'Guardar Ajustes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
