/**
 * Modal de Verificación Pública de Certificados
 * DocentOS LMS
 *
 * Permite a cualquier usuario, reclutador o institución validar
 * la autenticidad de un certificado emitido con su código único.
 */

import React, { useState, useEffect } from 'react';
import { Award, CheckCircle2, XCircle, Search, ShieldCheck, Copy, Check, ExternalLink, X, Loader2 } from 'lucide-react';
import { api } from '../lib/api';
import { CertificateRecord } from '../types';

interface CertificateVerifyModalProps {
  initialCode?: string;
  isOpen: boolean;
  onClose: () => void;
}

export const CertificateVerifyModal: React.FC<CertificateVerifyModalProps> = ({
  initialCode = '',
  isOpen,
  onClose,
}) => {
  const [code, setCode] = useState(initialCode);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<{
    valid: boolean;
    isRevoked?: boolean;
    certificate?: CertificateRecord;
    error?: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (initialCode) {
      setCode(initialCode);
      handleVerify(initialCode);
    }
  }, [initialCode, isOpen]);

  const handleVerify = async (codeToVerify?: string) => {
    const targetCode = (codeToVerify || code).trim();
    if (!targetCode) return;

    setIsSearching(true);
    setSearchResult(null);
    try {
      const res = await api.verifyCertificate(targetCode);
      setSearchResult(res);
    } catch (err: any) {
      setSearchResult({ valid: false, error: err.message || 'Error al verificar certificado' });
    } finally {
      setIsSearching(false);
    }
  };

  const copyVerificationLink = () => {
    const link = `${window.location.origin}/verify/${encodeURIComponent(code.trim().toUpperCase())}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl bg-[#141420] border border-[#2d2d44] p-6 sm:p-8 shadow-2xl text-white">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-[#1a1a2e] transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="text-center space-y-2 mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-brand-gradient text-white mb-1 shadow-lg shadow-[#06b6d4]/20">
            <Award className="w-7 h-7" />
          </div>
          <h3 className="text-xl font-extrabold text-white tracking-tight">
            Verificación Oficial de Certificados
          </h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Ingresa el código único del certificado para comprobar su autenticidad y estado de validez en la base de datos de DocentOS.
          </p>
        </div>

        {/* Search Input */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleVerify();
          }}
          className="flex items-center gap-2 bg-[#0a0a0f] border border-[#2d2d44] focus-within:border-[#06b6d4] rounded-xl px-3 py-2 mb-6 transition-all"
        >
          <Search className="w-4 h-4 text-slate-500 shrink-0" />
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Ej. DOC-6A1B2C3D4E5F6789"
            className="w-full bg-transparent text-sm text-white font-mono placeholder:text-slate-600 focus:outline-none"
          />
          <button
            type="submit"
            disabled={isSearching || !code.trim()}
            className="btn-brand-primary px-4 py-2 text-xs font-bold shrink-0 disabled:opacity-50"
          >
            {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Verificar'}
          </button>
        </form>

        {/* Result Card */}
        {searchResult && (
          <div className="space-y-4 animate-fade-in">
            {searchResult.valid && searchResult.certificate ? (
              <div className="bg-[#1a1a2e] border-2 border-emerald-500/40 rounded-xl p-5 space-y-4 shadow-xl">
                <div className="flex items-center justify-between border-b border-[#2d2d44] pb-3">
                  <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                    <CheckCircle2 className="w-5 h-5" />
                    <span>CERTIFICADO OFICIAL VÁLIDO</span>
                  </div>
                  <span className="text-[10px] bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono px-2 py-0.5 rounded-lg">
                    100% Verificado
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold block">Graduado</span>
                    <span className="text-base font-bold text-white">{searchResult.certificate.recipientName}</span>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold block">Programa Académico</span>
                    <span className="text-sm font-semibold text-[#06b6d4]">{searchResult.certificate.courseTitle}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[#2d2d44]">
                    <div>
                      <span className="text-[10px] text-slate-500 block">Fecha de Emisión</span>
                      <span className="text-slate-300 font-medium">
                        {new Date(searchResult.certificate.issuedAt).toLocaleDateString('es-ES', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block">Código Único</span>
                      <span className="font-mono text-[11px] text-amber-400">{searchResult.certificate.verificationCode}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-[#2d2d44] flex items-center justify-between">
                  <button
                    onClick={copyVerificationLink}
                    className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? '¡Enlace copiado!' : 'Copiar enlace público'}</span>
                  </button>
                  <div className="flex items-center gap-1 text-[10px] text-slate-500">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Emitido por DocentOS Engine</span>
                  </div>
                </div>
              </div>
            ) : searchResult.isRevoked ? (
              <div className="bg-red-500/10 border-2 border-red-500/40 rounded-xl p-5 space-y-2 text-center">
                <XCircle className="w-8 h-8 text-red-400 mx-auto" />
                <h4 className="font-bold text-sm text-red-300 uppercase">Certificado Revocado</h4>
                <p className="text-xs text-slate-400">
                  Este certificado fue revocado formalmente por la administración académica.
                </p>
                {searchResult.certificate?.revocationReason && (
                  <p className="text-xs text-red-200 font-medium bg-black/40 p-2 rounded-lg">
                    Motivo: {searchResult.certificate.revocationReason}
                  </p>
                )}
              </div>
            ) : (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-5 text-center space-y-2">
                <XCircle className="w-8 h-8 text-amber-400 mx-auto" />
                <h4 className="font-bold text-sm text-amber-300">Certificado No Encontrado</h4>
                <p className="text-xs text-slate-400">
                  {searchResult.error || 'No se localizó ningún diploma emitido con el código proporcionado.'}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
