/**
 * Componente de Buscador e Integración de Google Drive
 * Academia Giantucchi
 *
 * Permite buscar, filtrar y previsualizar videos alojados en Google Drive,
 * e integrarlos directamente en los módulos del curso.
 */

import React, { useState, useEffect } from 'react';
import { HardDrive, Search, Play, Plus, CheckCircle2, Film, ExternalLink, RefreshCw, Layers } from 'lucide-react';
import { api } from '../lib/api';
import { DriveVideoFile, Module, UserRole } from '../types';

interface DriveExplorerModalProps {
  userRole: UserRole;
  modules: Module[];
  onVideoLinked?: () => void;
}

export const DriveExplorerModal: React.FC<DriveExplorerModalProps> = ({
  userRole,
  modules,
  onVideoLinked,
}) => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [driveVideos, setDriveVideos] = useState<DriveVideoFile[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<DriveVideoFile | null>(null);
  const [selectedModuleId, setSelectedModuleId] = useState<string>(modules[0]?.id || '');
  const [linking, setLinking] = useState(false);
  const [linkedSuccess, setLinkedSuccess] = useState(false);
  const [isDemo, setIsDemo] = useState(false);

  const fetchVideos = async (searchQuery?: string) => {
    setLoading(true);
    try {
      const data = await api.searchDriveVideos(searchQuery);
      setDriveVideos(data.videos || []);
      setIsDemo(Boolean(data.isDemo));
    } catch (error) {
      console.error('Error fetching drive videos:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVideos();
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchVideos(query);
  };

  const handleLinkVideo = async () => {
    if (!selectedVideo || !selectedModuleId) return;
    setLinking(true);
    try {
      await api.addDriveVideoToModule(selectedModuleId, selectedVideo);
      setLinkedSuccess(true);
      if (onVideoLinked) onVideoLinked();
      setTimeout(() => setLinkedSuccess(false), 3000);
    } catch (error) {
      console.error('Error linking drive video:', error);
    } finally {
      setLinking(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 animate-fade-in">
      
      {/* Title & Drive API Status Banner */}
      <div className="bg-[#141420] border border-[#2d2d44] rounded-xl p-6 shadow-xl text-white flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 text-[#06b6d4] text-xs font-bold uppercase tracking-wider mb-1">
            <HardDrive className="w-4 h-4 text-[#06b6d4]" /> Integración con Google Drive API v3
          </div>
          <h2 className="text-2xl font-bold text-white">Buscador y Biblioteca de Videos Drive</h2>
          <p className="text-slate-400 text-sm mt-1">
            Explora videos almacenados en Google Drive organizados para la Academia Giantucchi.
          </p>
        </div>

        <form onSubmit={handleSearchSubmit} className="flex gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-80">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar en Google Drive..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full bg-[#0a0a0f] border border-[#2d2d44] rounded-xl pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:border-[#06b6d4]"
            />
          </div>
          <button
            type="submit"
            className="btn-brand-primary px-4 py-2 text-sm shrink-0"
          >
            Buscar
          </button>
        </form>
      </div>

      {isDemo && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 text-amber-300 text-sm">
          <strong className="font-bold">Modo demostración.</strong> No hay credenciales de Google
          Drive configuradas, así que este catálogo es de ejemplo: sus identificadores no
          corresponden a archivos reales y los vídeos que enlaces desde aquí no se reproducirán.
          Para usar tus vídeos, pega el enlace de Drive directamente al crear el vídeo en el módulo,
          o configura <code className="font-mono">GOOGLE_DRIVE_CLIENT_EMAIL</code> y{' '}
          <code className="font-mono">GOOGLE_DRIVE_PRIVATE_KEY</code>.
        </div>
      )}

      {/* Main Grid: Video List & Drive Embedded Player Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Video List */}
        <div className="lg:col-span-2 space-y-3">
          <h3 className="text-sm font-semibold text-slate-400 flex items-center justify-between">
            <span>Resultados de Google Drive ({driveVideos.length})</span>
            {loading && <RefreshCw className="w-4 h-4 animate-spin text-[#06b6d4]" />}
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {driveVideos.map((video) => {
              const isSelected = selectedVideo?.id === video.id;
              return (
                <div
                  key={video.id}
                  onClick={() => setSelectedVideo(video)}
                  className={`cursor-pointer rounded-xl border p-4 transition-all flex flex-col justify-between ${
                    isSelected
                      ? 'bg-[#1a1a2e] border-[#06b6d4] ring-2 ring-[#06b6d4]/30 shadow-lg'
                      : 'bg-[#141420] border-[#2d2d44] hover:border-[#06b6d4]/50 hover:bg-[#1a1a2e]'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="relative aspect-video rounded-xl overflow-hidden bg-black border border-[#2d2d44] group">
                      <img
                        src={video.thumbnailLink || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&auto=format&fit=crop&q=80'}
                        alt={video.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-80 group-hover:opacity-100 transition-opacity">
                        <div className="w-10 h-10 rounded-full bg-brand-gradient text-white flex items-center justify-center shadow-lg">
                          <Play className="w-5 h-5 fill-white text-white ml-0.5" />
                        </div>
                      </div>
                      {video.duration && (
                        <span className="absolute bottom-2 right-2 bg-black/90 text-[#06b6d4] text-[10px] font-bold px-2 py-0.5 rounded-lg border border-[#2d2d44]">
                          {video.duration}
                        </span>
                      )}
                    </div>

                    <h4 className="font-semibold text-sm text-slate-100 line-clamp-2 leading-snug">
                      {video.name}
                    </h4>
                  </div>

                  <div className="mt-3 pt-3 border-t border-[#2d2d44] flex items-center justify-between text-xs text-slate-400">
                    <span className="flex items-center gap-1 font-mono text-[11px] text-slate-400">
                      <Film className="w-3.5 h-3.5 text-[#06b6d4]" /> {video.size || 'Google Drive'}
                    </span>
                    <span className="text-[#06b6d4] font-semibold text-[11px] hover:underline flex items-center gap-1">
                      Previsualizar <ExternalLink className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Embedded Preview Player & Admin Linking Panel */}
        <div className="space-y-4">
          <div className="sticky top-20 bg-[#141420] border border-[#2d2d44] rounded-xl p-5 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Film className="w-5 h-5 text-[#06b6d4]" />
              Previsualización de Google Drive
            </h3>

            {selectedVideo ? (
              <div className="space-y-4">
                <div className="aspect-video w-full rounded-xl overflow-hidden bg-black border border-[#2d2d44] shadow-inner">
                  <iframe
                    src={selectedVideo.embedUrl}
                    title={selectedVideo.name}
                    className="w-full h-full border-0"
                    allow="autoplay; encrypted-media"
                    allowFullScreen
                  />
                </div>

                <div>
                  <h4 className="font-bold text-sm text-white">{selectedVideo.name}</h4>
                  <p className="text-xs text-slate-400 mt-1">ID de Archivo: <code className="text-[#06b6d4] font-mono">{selectedVideo.id}</code></p>
                </div>

                {/* Admin Linking Control */}
                {userRole === 'ADMIN' && (
                  <div className="bg-[#1a1a2e] border border-[#2d2d44] rounded-xl p-4 space-y-3 mt-4">
                    <div className="flex items-center gap-1.5 text-[#a855f7] font-bold text-xs">
                      <Layers className="w-4 h-4" /> Enlazar a Módulo de Curso (Admin)
                    </div>

                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Módulo Destino:</label>
                      <select
                        value={selectedModuleId}
                        onChange={(e) => setSelectedModuleId(e.target.value)}
                        className="w-full bg-[#0a0a0f] border border-[#2d2d44] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#06b6d4]"
                      >
                        {modules.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.title}
                          </option>
                        ))}
                      </select>
                    </div>

                    <button
                      onClick={handleLinkVideo}
                      disabled={linking || !selectedModuleId}
                      className="w-full py-2.5 px-4 rounded-lg bg-[#a855f7] hover:bg-[#a855f7]/80 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-[#a855f7]/25 transition-all disabled:opacity-50"
                    >
                      {linking ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <Plus className="w-4 h-4" />
                          Enlazar Video a Módulo
                        </>
                      )}
                    </button>

                    {linkedSuccess && (
                      <div className="p-2 bg-[#06b6d4]/10 border border-[#06b6d4]/30 text-[#06b6d4] rounded-lg text-xs flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4" /> ¡Video enlazado con éxito!
                      </div>
                    )}
                  </div>
                )}

              </div>
            ) : (
              <div className="p-8 text-center border-2 border-dashed border-[#2d2d44] rounded-xl text-slate-500 space-y-2">
                <HardDrive className="w-10 h-10 mx-auto opacity-40 text-slate-400" />
                <p className="text-xs">Selecciona un video de la lista para ver la previsualización directa en iframe de Google Drive.</p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
