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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-canvas/80 backdrop-blur-sm font-sans">
      <div role="dialog" aria-modal="true" aria-labelledby="contract-signature-title" className="bg-surface border border-line-strong/80 rounded-xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[88vh] animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header compacto */}
        <div className="px-4 py-3 bg-gradient-to-r from-brand-blue/30 via-brand-violet/30 to-surface border-b border-line flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 bg-brand-blue/10 border border-brand-blue/20 rounded-lg text-brand-blue">
              <FileCheck aria-hidden="true" className="w-4 h-4" />
            </div>
            <div>
              <h2 id="contract-signature-title" className="text-sm font-semibold text-ink tracking-tight">
                Firma de Acuerdo y Términos
              </h2>
              <p className="text-[11px] text-ink-muted">
                Paso obligatorio para habilitar tu cuenta en Academia Giantucchi
              </p>
            </div>
          </div>
          <Shield aria-hidden="true" className="w-4 h-4 text-ink-faint hidden sm:block" />
        </div>

        {/* Resumen de Fechas Clave */}
        <div className="grid grid-cols-3 gap-2 px-4 py-2 bg-raised/30 border-b border-line text-[11px]">
          <div className="flex items-center gap-1.5 p-1.5 rounded-md bg-raised/50 border border-line-strong/30">
            <Calendar aria-hidden="true" className="w-3.5 h-3.5 text-success-light shrink-0" />
            <div className="min-w-0">
              <div className="text-ink-muted text-micro uppercase font-semibold">Inicio</div>
              <div className="text-ink font-medium truncate text-[11px]">{formatDate(contractData.calculatedDates.startDate)}</div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 p-1.5 rounded-md bg-raised/50 border border-line-strong/30">
            <Clock aria-hidden="true" className="w-3.5 h-3.5 text-brand-blue shrink-0" />
            <div className="min-w-0">
              <div className="text-ink-muted text-micro uppercase font-semibold">Vigencia</div>
              <div className="text-ink font-medium truncate text-[11px]">{formatDate(contractData.calculatedDates.endDate)}</div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 p-1.5 rounded-md bg-raised/50 border border-line-strong/30">
            <Lock aria-hidden="true" className="w-3.5 h-3.5 text-brand-violet-light shrink-0" />
            <div className="min-w-0">
              <div className="text-ink-muted text-micro uppercase font-semibold">Custodia Datos</div>
              <div className="text-ink font-medium truncate text-[11px]">{contractData.calculatedDates.retentionPeriodMonths} meses</div>
            </div>
          </div>
        </div>

        {/* Visor de Contrato Renderizado con estilo Markdown limpio */}
        <div className="p-4 overflow-y-auto flex-1 text-xs text-ink-soft leading-relaxed bg-canvas/40 border-b border-line scrollbar-thin scrollbar-thumb-elevated">
          <div className="space-y-3 font-sans">
            {contractData.content.split('\n\n').map((paragraph, idx) => {
              const trimmed = paragraph.trim();
              if (trimmed.startsWith('# ')) {
                return (
                  <h3 key={idx} className="text-sm font-bold text-ink border-b border-line/80 pb-1 pt-0.5">
                    {trimmed.replace('# ', '')}
                  </h3>
                );
              }
              if (trimmed.startsWith('### ')) {
                return (
                  <h4 key={idx} className="text-xs font-semibold text-brand-blue pt-1">
                    {trimmed.replace('### ', '')}
                  </h4>
                );
              }
              return (
                <div key={idx} className="text-ink-soft leading-relaxed">
                  {trimmed.split('\n').map((line, lIdx) => {
                    const lineTrimmed = line.trim();
                    if (!lineTrimmed) return null;

                    // Formato para viñetas
                    if (lineTrimmed.startsWith('- ')) {
                      const cleanLine = lineTrimmed.replace('- ', '');
                      const parts = cleanLine.split('**');
                      return (
                        <div key={lIdx} className="flex items-start gap-1.5 pl-1 mb-1">
                          <span className="text-brand-blue mt-0.5">•</span>
                          <span>
                            {parts.map((p, pIdx) =>
                              pIdx % 2 === 1 ? <strong key={pIdx} className="text-ink font-semibold">{p}</strong> : p
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
                          pIdx % 2 === 1 ? <strong key={pIdx} className="text-ink font-semibold">{p}</strong> : p
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
        <form onSubmit={handleSign} className="p-4 bg-surface flex flex-col gap-2.5">
          {error && (
            <div role="alert" className="p-2.5 bg-danger/10 border border-danger/30 rounded-lg text-danger-light text-[11px] flex items-center gap-2">
              <AlertCircle aria-hidden="true" className="w-3.5 h-3.5 shrink-0 text-danger-light" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-2 text-[11px]">
            <label className="flex items-start gap-2 cursor-pointer group">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="mt-0.5 rounded border-line-strong text-brand-blue focus:ring-brand-blue bg-raised"
              />
              <span className="text-ink-soft group-hover:text-ink transition-colors leading-tight">
                He leído y acepto los <strong className="text-ink font-medium">Términos y Condiciones</strong> de la plataforma.
              </span>
            </label>

            <label className="flex items-start gap-2 cursor-pointer group">
              <input
                type="checkbox"
                checked={acceptedPrivacy}
                onChange={(e) => setAcceptedPrivacy(e.target.checked)}
                className="mt-0.5 rounded border-line-strong text-brand-blue focus:ring-brand-blue bg-raised"
              />
              <span className="text-ink-soft group-hover:text-ink transition-colors leading-tight">
                Acepto la <strong className="text-ink font-medium">Política de Privacidad</strong> para el acceso a las clases.
              </span>
            </label>

            <label className="flex items-start gap-2 cursor-pointer group">
              <input
                type="checkbox"
                checked={acceptedDataPolicy}
                onChange={(e) => setAcceptedDataPolicy(e.target.checked)}
                className="mt-0.5 rounded border-line-strong text-brand-blue focus:ring-brand-blue bg-raised"
              />
              <span className="text-ink-soft group-hover:text-ink transition-colors leading-tight">
                Autorizo la <strong className="text-ink font-medium">custodia y retención de mis datos académicos</strong> por un período de {contractData.calculatedDates.retentionPeriodMonths} meses.
              </span>
            </label>

            <label className="flex items-start gap-2 cursor-pointer group">
              <input
                type="checkbox"
                checked={acceptedCommercials}
                onChange={(e) => setAcceptedCommercials(e.target.checked)}
                className="mt-0.5 rounded border-line-strong text-brand-blue focus:ring-brand-blue bg-raised"
              />
              <span className="text-ink-muted group-hover:text-ink-soft transition-colors leading-tight">
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
                  ? 'bg-gradient-to-r from-brand-blue to-brand-violet hover:from-brand-blue hover:to-brand-violet text-ink cursor-pointer'
                  : 'bg-raised text-ink-faint border border-line-strong/50 cursor-not-allowed'
              }`}
            >
              {isSigning ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-ink/20 border-t-ink rounded-full animate-spin" />
                  <span>Registrando firma...</span>
                </>
              ) : (
                <>
                  <span>Firmar y Continuar</span>
                  <ChevronRight aria-hidden="true" className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
