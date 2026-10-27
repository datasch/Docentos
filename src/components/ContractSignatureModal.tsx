import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { FileCheck, Shield, Calendar, Clock, AlertCircle, ChevronRight, Lock } from 'lucide-react';
import { api } from '../lib/api';
import { useBodyScrollLock } from '../lib/useBodyScrollLock';

interface ContractModalProps {
  contractData: {
    version: string;
    title: string;
    content: string;
    contractHash: string;
    calculatedDates: {
      startDate: string;
      endDate: string;
      retentionPeriodMonths: number;
      dataRetentionUntil: string;
    };
  };
  onSuccess: () => void;
}

export const ContractSignatureModal: React.FC<ContractModalProps> = ({ contractData, onSuccess }) => {
  useBodyScrollLock(true);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [acceptedDataPolicy, setAcceptedDataPolicy] = useState(false);
  const [acceptedCommercials, setAcceptedCommercials] = useState(false);
  const [isSigning, setIsSigning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formatDate = (isoStr: string) => {
    try {
      return new Date(isoStr).toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return isoStr;
    }
  };

  const isFormValid = acceptedTerms && acceptedPrivacy && acceptedDataPolicy;

  const handleSign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid || isSigning) return;

    setError(null);
    setIsSigning(true);

    try {
      await api.contracts.sign({
        contractVersion: contractData.version,
        contractHash: contractData.contractHash,
        acceptedTerms,
        acceptedPrivacy,
        acceptedDataPolicy,
        acceptedCommercials,
      });
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Error al firmar el contrato. Por favor intenta de nuevo.');
      setIsSigning(false);
    }
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md font-sans overscroll-contain"
      onWheel={(e) => e.stopPropagation()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="contract-signature-title"
        className="bg-[#0e0e17] border border-white/10 rounded-2xl w-full max-w-[620px] overflow-hidden shadow-2xl flex flex-col max-h-[95vh] animate-in fade-in zoom-in-95 duration-150 overscroll-contain"
        onWheel={(e) => e.stopPropagation()}
      >
        {/* Header amplio y profesional */}
        <div className="px-6 py-4.5 sm:py-5 bg-gradient-to-r from-cyan-950/40 via-purple-950/30 to-[#0e0e17] border-b border-white/10 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3.5">
            <div className="p-2.5 bg-cyan-500/10 border border-cyan-500/20 rounded-xl text-cyan-400">
              <FileCheck aria-hidden="true" className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <h2 id="contract-signature-title" className="text-base sm:text-lg font-bold text-white tracking-tight">
                Firma de Acuerdo y Términos de la Plataforma
              </h2>
              <p className="text-xs sm:text-[13px] text-slate-400 mt-0.5">
                Habilitación de acceso oficial para nuevos miembros registrados
              </p>
            </div>
          </div>
          <Shield aria-hidden="true" className="w-5 h-5 text-slate-500 hidden sm:block" />
        </div>

        {/* Resumen de Fechas Clave */}
        <div className="grid grid-cols-3 gap-3 px-6 py-3 bg-black/40 border-b border-white/10 text-xs shrink-0">
          <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-[#141420] border border-white/5">
            <Calendar aria-hidden="true" className="w-4 h-4 text-emerald-400 shrink-0" />
            <div className="min-w-0">
              <div className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Inicio</div>
              <div className="text-white font-semibold truncate text-xs">{formatDate(contractData.calculatedDates.startDate)}</div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-[#141420] border border-white/5">
            <Clock aria-hidden="true" className="w-4 h-4 text-cyan-400 shrink-0" />
            <div className="min-w-0">
              <div className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Vigencia</div>
              <div className="text-white font-semibold truncate text-xs">{formatDate(contractData.calculatedDates.endDate)}</div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-[#141420] border border-white/5">
            <Lock aria-hidden="true" className="w-4 h-4 text-purple-400 shrink-0" />
            <div className="min-w-0">
              <div className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Custodia</div>
              <div className="text-white font-semibold truncate text-xs">{contractData.calculatedDates.retentionPeriodMonths} meses</div>
            </div>
          </div>
        </div>

        {/* Visor de Contrato: más alto, estilizado y cómodo de leer */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 min-h-[220px] max-h-[420px] text-sm text-slate-200 leading-relaxed bg-black/20 border-b border-white/10 scrollbar-thin scrollbar-thumb-white/10">
          <div className="space-y-4 font-sans max-w-none">
            {contractData.content.split('\n\n').map((paragraph, idx) => {
              const trimmed = paragraph.trim();
              if (trimmed.startsWith('# ')) {
                return (
                  <h3 key={idx} className="text-base font-bold text-white border-b border-white/10 pb-1.5 pt-1">
                    {trimmed.replace('# ', '')}
                  </h3>
                );
              }
              if (trimmed.startsWith('### ')) {
                return (
                  <h4 key={idx} className="text-sm font-bold text-cyan-400 pt-2 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                    <span>{trimmed.replace('### ', '')}</span>
                  </h4>
                );
              }
              return (
                <div key={idx} className="text-slate-300 leading-relaxed text-xs sm:text-[13px]">
                  {trimmed.split('\n').map((line, lIdx) => {
                    const lineTrimmed = line.trim();
                    if (!lineTrimmed) return null;

                    // Formato para viñetas
                    if (lineTrimmed.startsWith('- ')) {
                      const cleanLine = lineTrimmed.replace('- ', '');
                      const parts = cleanLine.split('**');
                      return (
                        <div key={lIdx} className="flex items-start gap-2 pl-2 mb-1.5">
                          <span className="text-cyan-400 font-bold">•</span>
                          <span>
                            {parts.map((p, pIdx) =>
                              pIdx % 2 === 1 ? <strong key={pIdx} className="text-white font-semibold">{p}</strong> : p
                            )}
                          </span>
                        </div>
                      );
                    }

                    // Formato para líneas normales con negritas **texto**
                    const parts = lineTrimmed.split('**');
                    return (
                      <p key={lIdx} className="mb-1.5">
                        {parts.map((p, pIdx) =>
                          pIdx % 2 === 1 ? <strong key={pIdx} className="text-white font-semibold">{p}</strong> : p
                        )}
                      </p>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>

        {/* Formulario y Aceptaciones */}
        <form onSubmit={handleSign} className="p-6 bg-[#0e0e17] flex flex-col gap-4 shrink-0">
          {error && (
            <div role="alert" className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs flex items-center gap-2.5">
              <AlertCircle aria-hidden="true" className="w-4 h-4 shrink-0 text-red-400" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-2.5 text-xs sm:text-[13px]">
            <label className="flex items-start gap-2.5 cursor-pointer group">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-white/20 text-cyan-500 focus:ring-cyan-500 bg-[#141420]"
              />
              <span className="text-slate-300 group-hover:text-white transition-colors leading-snug">
                He leído y acepto los <strong className="text-white font-semibold">Términos y Condiciones</strong> de la plataforma.
              </span>
            </label>

            <label className="flex items-start gap-2.5 cursor-pointer group">
              <input
                type="checkbox"
                checked={acceptedPrivacy}
                onChange={(e) => setAcceptedPrivacy(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-white/20 text-cyan-500 focus:ring-cyan-500 bg-[#141420]"
              />
              <span className="text-slate-300 group-hover:text-white transition-colors leading-snug">
                Acepto la <strong className="text-white font-semibold">Política de Privacidad</strong> para el acceso a las clases.
              </span>
            </label>

            <label className="flex items-start gap-2.5 cursor-pointer group">
              <input
                type="checkbox"
                checked={acceptedDataPolicy}
                onChange={(e) => setAcceptedDataPolicy(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-white/20 text-cyan-500 focus:ring-cyan-500 bg-[#141420]"
              />
              <span className="text-slate-300 group-hover:text-white transition-colors leading-snug">
                Autorizo la <strong className="text-white font-semibold">custodia y retención de mis datos académicos</strong> por un período de {contractData.calculatedDates.retentionPeriodMonths} meses.
              </span>
            </label>

            <label className="flex items-start gap-2.5 cursor-pointer group">
              <input
                type="checkbox"
                checked={acceptedCommercials}
                onChange={(e) => setAcceptedCommercials(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-white/20 text-cyan-500 focus:ring-cyan-500 bg-[#141420]"
              />
              <span className="text-slate-400 group-hover:text-slate-200 transition-colors leading-snug">
                (Opcional) Acepto recibir novedades y actualizaciones académicas.
              </span>
            </label>
          </div>

          <div className="pt-2 flex items-center justify-end">
            <button
              type="submit"
              disabled={!isFormValid || isSigning}
              className={`px-6 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 transition-all shadow-lg ${
                isFormValid && !isSigning
                  ? 'bg-gradient-to-r from-cyan-400 to-purple-500 hover:opacity-90 text-slate-950 shadow-cyan-500/20 cursor-pointer'
                  : 'bg-white/5 text-slate-500 border border-white/10 cursor-not-allowed opacity-60'
              }`}
            >
              {isSigning ? (
                <>
                  <div className="w-4 h-4 border-2 border-slate-950/20 border-t-slate-950 rounded-full animate-spin" />
                  <span>Registrando firma con hash...</span>
                </>
              ) : (
                <>
                  <span>Firmar y Continuar</span>
                  <ChevronRight aria-hidden="true" className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
