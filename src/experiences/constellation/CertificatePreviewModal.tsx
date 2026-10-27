import React, { useState, useEffect } from 'react';
import { Award, Download, ShieldCheck, X, Sparkles, Loader2 } from 'lucide-react';
import { generateCertificatePNG, downloadCertificate, CertificateData } from '../../plugins/CertificateGenerator';
import { pluginManager } from '../../plugins/PluginManager';
import { api } from '../../lib/api';
import { getCustomBrandName, getCustomLogoUrl } from '../../lib/logoConfig';
import { useBodyScrollLock } from '../../lib/useBodyScrollLock';

interface CertificatePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  courseTitle: string;
  studentName: string;
  verificationCode?: string;
  onOpenVerifyModal?: () => void;
}

export const CertificatePreviewModal: React.FC<CertificatePreviewModalProps> = ({
  isOpen,
  onClose,
  courseTitle,
  studentName,
  verificationCode,
  onOpenVerifyModal,
}) => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [certData, setCertData] = useState<CertificateData | null>(null);
  useBodyScrollLock(isOpen);

  useEffect(() => {
    if (!isOpen) {
      setPreviewUrl(null);
      return;
    }

    let isMounted = true;
    setLoading(true);

    const generatePreview = async () => {
      try {
        let cfg = pluginManager.getPlugin('pdf-certificates')?.config;
        if (!cfg?.signatureImage && !cfg?.signatoryTitle) {
          try {
            const pRes = await api.getPlugins();
            if (pRes?.plugins) {
              pluginManager.setPlugins(pRes.plugins);
              cfg = pluginManager.getPlugin('pdf-certificates')?.config;
            }
          } catch {
            // Usa configuración por defecto
          }
        }

        const finalCfg = cfg || {};
        const data: CertificateData = {
          studentName: studentName || 'Estudiante',
          courseTitle: courseTitle,
          certificateId: verificationCode,
          institutionName: finalCfg.institutionName || 'Academia Giantucchi',
          signatoryTitle: finalCfg.signatoryTitle || 'Prof. Giancarlo Giantucchi - Mentor Director & Evaluador',
          primaryColor: finalCfg.primaryColor || '#06b6d4',
          badgeText: finalCfg.badgeText || 'Certificado de Excelencia Técnica',
          backgroundColor: finalCfg.backgroundColor || 'dark',
          institutionLogo: finalCfg.institutionLogo || getCustomLogoUrl(),
          signatureImage: finalCfg.signatureImage || finalCfg.signature,
          enableUniversitySignature: finalCfg.enableUniversitySignature ?? false,
          universitySignatoryTitle: finalCfg.universitySignatoryTitle || 'Dirección Académica - Universidad / Instituto',
          universitySignatureImage: finalCfg.universitySignatureImage,
        };

        if (isMounted) setCertData(data);
        const url = await generateCertificatePNG(data);
        if (isMounted) {
          setPreviewUrl(url);
          setLoading(false);
        }
      } catch (err) {
        console.error('Error generating certificate preview:', err);
        if (isMounted) setLoading(false);
      }
    };

    generatePreview();

    return () => {
      isMounted = false;
    };
  }, [isOpen, courseTitle, studentName, verificationCode]);

  if (!isOpen) return null;

  const handleDownload = async () => {
    if (certData) {
      await downloadCertificate(certData);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center bg-black/85 p-3 sm:p-6 backdrop-blur-md animate-fade-in overscroll-contain"
      onClick={onClose}
      onWheel={(e) => e.stopPropagation()}
    >
      <div
        className="relative flex flex-col max-h-[95vh] w-full max-w-5xl overflow-hidden rounded-3xl border-2 border-amber-500/40 bg-white dark:bg-[#0d0a17] shadow-2xl dark:shadow-[0_0_80px_rgba(245,158,11,0.25)] text-slate-900 dark:text-white transition-colors overscroll-contain"
        onClick={(e) => e.stopPropagation()}
        onWheel={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Cabecera del Modal */}
        <header className="flex shrink-0 items-center justify-between border-b border-slate-200 dark:border-purple-500/20 px-6 py-4 bg-slate-50 dark:bg-[#140e24] transition-colors">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-500 dark:text-amber-400 shadow-sm shrink-0">
              <Award className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">
                  Diploma Oficial Verificado
                </span>
                <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-bold bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border border-cyan-500/20">
                  <Sparkles className="w-3 h-3 text-cyan-600 dark:text-cyan-400" />
                  Alta Definición
                </span>
              </div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white truncate max-w-xl">
                Vista Previa del Certificado
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 dark:text-purple-300/60 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-white/10 transition-colors cursor-pointer"
            title="Cerrar vista previa"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        {/* Cuerpo con el lienzo visual del diploma */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex flex-col items-center justify-center bg-slate-100/70 dark:bg-[#08070e] transition-colors">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-600 dark:text-purple-300">
              <Loader2 className="w-8 h-8 animate-spin text-amber-500 dark:text-amber-400" />
              <p className="text-xs font-semibold text-slate-600 dark:text-purple-200/80">
                Generando diploma digital de alta resolución...
              </p>
            </div>
          ) : previewUrl ? (
            <div className="relative w-full max-w-4xl flex flex-col items-center">
              <div className="relative rounded-2xl overflow-hidden border-2 border-amber-400/40 shadow-xl bg-black">
                <img
                  src={previewUrl}
                  alt={`Certificado Oficial de ${studentName} - ${courseTitle}`}
                  className="w-full h-auto object-contain max-h-[62vh] block"
                />
              </div>

              {/* Tira informativa con metadatos del certificado */}
              <div className="mt-4 w-full flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-white dark:bg-[#141022]/90 border border-slate-200 dark:border-purple-500/20 text-xs text-slate-700 dark:text-purple-200/80 shadow-sm">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase text-purple-600 dark:text-purple-400">Estudiante:</span>
                  <span className="font-bold text-slate-900 dark:text-white">{studentName}</span>
                </div>
                {verificationCode && (
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase text-purple-600 dark:text-purple-400">Código DOC:</span>
                    <span className="font-mono font-bold text-amber-600 dark:text-amber-300">{verificationCode}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase text-purple-600 dark:text-purple-400">Emisor:</span>
                  <span className="font-semibold text-slate-900 dark:text-white">{certData?.institutionName || 'Academia Giantucchi'}</span>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-xs text-red-500 py-10">
              No se pudo renderizar la vista previa del certificado.
            </p>
          )}
        </div>

        {/* Pie de acciones */}
        <footer className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-200 dark:border-purple-500/20 px-6 py-4 bg-slate-50 dark:bg-[#140e24] transition-colors">
          <p className="text-[11px] text-slate-500 dark:text-purple-300/60 text-center sm:text-left">
            Este diploma cuenta con firma digital y registro criptográfico de autenticidad.
          </p>

          <div className="flex items-center gap-3 shrink-0 w-full sm:w-auto justify-end">
            {verificationCode && onOpenVerifyModal && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenVerifyModal();
                }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-white/10 dark:hover:bg-white/15 text-xs font-bold text-slate-800 dark:text-white border border-slate-300 dark:border-white/15 transition-all cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4 text-cyan-600 dark:text-cyan-300" />
                <span>Verificar Código</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleDownload}
              disabled={loading || !previewUrl}
              className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 text-slate-950 text-xs font-black shadow-lg shadow-amber-400/25 transition-all hover:scale-105 active:scale-95 cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
            >
              <Download className="w-4 h-4" />
              <span>Descargar Diploma (PNG)</span>
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};
