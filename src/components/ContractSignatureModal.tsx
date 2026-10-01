import React, { useState } from 'react';
import { FileCheck, Shield, Calendar, Clock, AlertCircle, ChevronRight, Lock } from 'lucide-react';
import { api } from '../lib/api';

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-sm font-sans">
      <div className="bg-slate-900 border border-slate-700/80 rounded-xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[88vh] animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header compacto */}
        <div className="px-4 py-3 bg-gradient-to-r from-blue-900/30 via-indigo-900/30 to-slate-900 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 bg-blue-500/10 border border-blue-500/20 rounded-lg text-blue-400">
              <FileCheck className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white tracking-tight">
                Firma de Acuerdo y Términos
              </h2>
              <p className="text-[11px] text-slate-400">
                Paso obligatorio para habilitar tu cuenta en Academia Giantucchi
              </p>
            </div>
          </div>
          <Shield className="w-4 h-4 text-slate-500 hidden sm:block" />
        </div>

        {/* Resumen de Fechas Clave */}
        <div className="grid grid-cols-3 gap-2 px-4 py-2 bg-slate-800/30 border-b border-slate-800 text-[11px]">
          <div className="flex items-center gap-1.5 p-1.5 rounded-md bg-slate-800/50 border border-slate-700/30">
            <Calendar className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <div className="min-w-0">
              <div className="text-slate-400 text-[9px] uppercase font-semibold">Inicio</div>
              <div className="text-white font-medium truncate text-[11px]">{formatDate(contractData.calculatedDates.startDate)}</div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 p-1.5 rounded-md bg-slate-800/50 border border-slate-700/30">
            <Clock className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <div className="min-w-0">
              <div className="text-slate-400 text-[9px] uppercase font-semibold">Vigencia</div>
              <div className="text-white font-medium truncate text-[11px]">{formatDate(contractData.calculatedDates.endDate)}</div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 p-1.5 rounded-md bg-slate-800/50 border border-slate-700/30">
            <Lock className="w-3.5 h-3.5 text-purple-400 shrink-0" />
            <div className="min-w-0">
              <div className="text-slate-400 text-[9px] uppercase font-semibold">Custodia Datos</div>
              <div className="text-white font-medium truncate text-[11px]">{contractData.calculatedDates.retentionPeriodMonths} meses</div>
            </div>
          </div>
        </div>

        {/* Visor de Contrato Renderizado con estilo Markdown limpio */}
        <div className="p-4 overflow-y-auto flex-1 text-xs text-slate-300 leading-relaxed bg-slate-950/40 border-b border-slate-800 scrollbar-thin scrollbar-thumb-slate-700">
          <div className="space-y-3 font-sans">
            {contractData.content.split('\n\n').map((paragraph, idx) => {
              const trimmed = paragraph.trim();
              if (trimmed.startsWith('# ')) {
                return (
                  <h3 key={idx} className="text-sm font-bold text-white border-b border-slate-800/80 pb-1 pt-0.5">
                    {trimmed.replace('# ', '')}
                  </h3>
                );
              }
              if (trimmed.startsWith('### ')) {
                return (
                  <h4 key={idx} className="text-xs font-semibold text-blue-300 pt-1">
                    {trimmed.replace('### ', '')}
                  </h4>
                );
              }
              return (
                <div key={idx} className="text-slate-300 leading-relaxed">
                  {trimmed.split('\n').map((line, lIdx) => {
                    const lineTrimmed = line.trim();
                    if (!lineTrimmed) return null;

                    // Formato para viñetas
                    if (lineTrimmed.startsWith('- ')) {
                      const cleanLine = lineTrimmed.replace('- ', '');
                      const parts = cleanLine.split('**');
                      return (
                        <div key={lIdx} className="flex items-start gap-1.5 pl-1 mb-1">
                          <span className="text-blue-400 mt-0.5">•</span>
                          <span>
                            {parts.map((p, pIdx) =>
                              pIdx % 2 === 1 ? <strong key={pIdx} className="text-slate-100 font-semibold">{p}</strong> : p
                            )}
                          </span>
                        </div>
                      );
                    }

                    // Formato para líneas normales con negritas **texto**
                    const parts = lineTrimmed.split('**');
                    return (
                      <p key={lIdx} className="mb-1">
                        {parts.map((p, pIdx) =>
                          pIdx % 2 === 1 ? <strong key={pIdx} className="text-slate-100 font-semibold">{p}</strong> : p
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
        <form onSubmit={handleSign} className="p-4 bg-slate-900 flex flex-col gap-2.5">
          {error && (
            <div className="p-2.5 bg-red-500/10 border border-red-500/30 rounded-lg text-red-300 text-[11px] flex items-center gap-2">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 text-red-400" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-2 text-[11px]">
            <label className="flex items-start gap-2 cursor-pointer group">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="mt-0.5 rounded border-slate-700 text-blue-600 focus:ring-blue-500 bg-slate-800"
              />
              <span className="text-slate-300 group-hover:text-white transition-colors leading-tight">
                He leído y acepto los <strong className="text-white font-medium">Términos y Condiciones</strong> de la plataforma.
              </span>
            </label>

            <label className="flex items-start gap-2 cursor-pointer group">
              <input
                type="checkbox"
                checked={acceptedPrivacy}
                onChange={(e) => setAcceptedPrivacy(e.target.checked)}
                className="mt-0.5 rounded border-slate-700 text-blue-600 focus:ring-blue-500 bg-slate-800"
              />
              <span className="text-slate-300 group-hover:text-white transition-colors leading-tight">
                Acepto la <strong className="text-white font-medium">Política de Privacidad</strong> para el acceso a las clases.
              </span>
            </label>

            <label className="flex items-start gap-2 cursor-pointer group">
              <input
                type="checkbox"
                checked={acceptedDataPolicy}
                onChange={(e) => setAcceptedDataPolicy(e.target.checked)}
                className="mt-0.5 rounded border-slate-700 text-blue-600 focus:ring-blue-500 bg-slate-800"
              />
              <span className="text-slate-300 group-hover:text-white transition-colors leading-tight">
                Autorizo la <strong className="text-white font-medium">custodia y retención de mis datos académicos</strong> por un período de {contractData.calculatedDates.retentionPeriodMonths} meses.
              </span>
            </label>

            <label className="flex items-start gap-2 cursor-pointer group">
              <input
                type="checkbox"
                checked={acceptedCommercials}
                onChange={(e) => setAcceptedCommercials(e.target.checked)}
                className="mt-0.5 rounded border-slate-700 text-blue-600 focus:ring-blue-500 bg-slate-800"
              />
              <span className="text-slate-400 group-hover:text-slate-300 transition-colors leading-tight">
                (Opcional) Acepto recibir novedades y actualizaciones académicas.
              </span>
            </label>
          </div>

          <div className="pt-1 flex items-center justify-end">
            <button
              type="submit"
              disabled={!isFormValid || isSigning}
              className={`px-5 py-2 rounded-lg font-medium text-xs flex items-center gap-1.5 transition-all shadow-md ${
                isFormValid && !isSigning
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white cursor-pointer'
                  : 'bg-slate-800 text-slate-500 border border-slate-700/50 cursor-not-allowed'
              }`}
            >
              {isSigning ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  <span>Registrando firma...</span>
                </>
              ) : (
                <>
                  <span>Firmar y Continuar</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
