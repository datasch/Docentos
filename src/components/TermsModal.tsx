import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Shield, FileCheck, X, Calendar, Lock, CheckCircle2, AlertCircle } from 'lucide-react';
import { api } from '../lib/api';
import { useBodyScrollLock } from '../lib/useBodyScrollLock';

interface TermsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TermsModal: React.FC<TermsModalProps> = ({ isOpen, onClose }) => {
  useBodyScrollLock(isOpen);
  const [loading, setLoading] = useState<boolean>(true);
  const [termsData, setTermsData] = useState<{
    version: string;
    title: string;
    content: string;
    contractHash: string;
    retentionPeriodMonths: number;
    accessPeriodMonths: number;
  } | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setLoading(true);

    api.contracts
      .getPublic()
      .then((data) => {
        if (isMounted) {
          setTermsData(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error('Error al cargar términos:', err);
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  // Soporte para tecla Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md overscroll-contain"
      onWheel={(e) => e.stopPropagation()}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="terms-modal-title"
        className="bg-[#0e0e17] border border-white/10 rounded-2xl w-full max-w-[640px] overflow-hidden shadow-2xl flex flex-col max-h-[95vh] animate-in fade-in zoom-in-95 duration-150 overscroll-contain"
        onClick={(e) => e.stopPropagation()}
        onWheel={(e) => e.stopPropagation()}
      >
        {/* Cabecera */}
        <div className="px-6 py-4 bg-gradient-to-r from-cyan-950/40 via-purple-950/30 to-[#0e0e17] border-b border-white/10 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-cyan-500/10 border border-cyan-500/20 rounded-xl text-cyan-400">
              <FileCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 id="terms-modal-title" className="text-base font-bold text-white tracking-tight">
                Términos y Condiciones de la Plataforma
              </h2>
              <p className="text-xs text-slate-400">
                Políticas de servicio, privacidad y custodia legal de certificaciones
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
            aria-label="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Resumen destacado de compromisos */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 px-6 py-3 bg-black/40 border-b border-white/10 text-xs shrink-0">
          <div className="flex items-center gap-2 p-2 rounded-xl bg-[#141420] border border-white/5">
            <Calendar className="w-4 h-4 text-cyan-400 shrink-0" />
            <div>
              <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Vigencia Acceso</div>
              <div className="text-xs font-semibold text-white">12 Meses Renovables</div>
            </div>
          </div>

          <div className="flex items-center gap-2 p-2 rounded-xl bg-[#141420] border border-white/5">
            <Lock className="w-4 h-4 text-purple-400 shrink-0" />
            <div>
              <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Custodia Diplomas</div>
              <div className="text-xs font-semibold text-white">24 Meses Acreditados</div>
            </div>
          </div>

          <div className="flex items-center gap-2 p-2 rounded-xl bg-[#141420] border border-white/5">
            <Shield className="w-4 h-4 text-emerald-400 shrink-0" />
            <div>
              <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Privacidad & ARCO</div>
              <div className="text-xs font-semibold text-white">Garantía Protegida</div>
            </div>
          </div>
        </div>

        {/* Cuerpo del contrato con scroll independiente */}
        <div className="p-6 overflow-y-auto flex-1 min-h-[220px] max-h-[440px] text-sm text-slate-200 leading-relaxed bg-black/20 space-y-4">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center space-y-3">
              <div className="w-8 h-8 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
              <p className="text-xs text-slate-400">Cargando términos oficiales...</p>
            </div>
          ) : termsData ? (
            <div className="space-y-4 font-sans">
              <div className="p-3.5 rounded-xl bg-[#141420] border border-white/5 text-xs space-y-1">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="font-bold text-white">Resumen de lo que aceptas:</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
                    {termsData.version}
                  </span>
                </div>
                <p className="text-slate-400 text-xs leading-relaxed">
                  Al registrarte en la plataforma, aceptas las condiciones de uso formativo, los períodos de acceso a clases y la custodia segura de tus calificaciones y diplomas verificables.
                </p>
              </div>

              {termsData.content.split('\n\n').map((paragraph, idx) => {
                const trimmed = paragraph.trim();
                if (trimmed.startsWith('# ')) {
                  return (
                    <h3 key={idx} className="text-sm font-bold text-ink border-b border-line pb-1.5 pt-2">
                      {trimmed.replace('# ', '')}
                    </h3>
                  );
                }
                if (trimmed.startsWith('### ')) {
                  return (
                    <h4 key={idx} className="text-xs font-bold text-brand-cyan pt-2 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-brand-cyan shrink-0" />
                      <span>{trimmed.replace('### ', '')}</span>
                    </h4>
                  );
                }
                return (
                  <p key={idx} className="text-ink-soft leading-relaxed text-xs">
                    {trimmed}
                  </p>
                );
              })}

              {termsData.contractHash && (
                <div className="pt-3 border-t border-line text-[10px] text-ink-muted font-mono flex items-center justify-between flex-wrap gap-2">
                  <span>Sello de Integridad SHA-256:</span>
                  <span className="text-ink-soft truncate max-w-xs">{termsData.contractHash}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-ink-muted space-y-2">
              <AlertCircle className="w-6 h-6 text-amber-500 mx-auto" />
              <p>No se pudo sincronizar la versión más reciente del contrato.</p>
            </div>
          )}
        </div>

        {/* Footer del Modal */}
        <div className="px-6 py-3.5 bg-black/40 border-t border-white/10 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-slate-400">
            Documento legal público transparente
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold rounded-xl transition-all shadow-sm cursor-pointer"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
