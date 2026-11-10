import React, { useState, useEffect } from 'react';
import { Download, ShieldCheck, X, Loader2 } from 'lucide-react';
import { generateCertificatePNG, CertificateData } from '../../plugins/CertificateGenerator';
import { pluginManager } from '../../plugins/PluginManager';
import { api } from '../../lib/api';
import { getCustomLogoUrl } from '../../lib/logoConfig';
import { useBodyScrollLock } from '../../lib/useBodyScrollLock';

interface CertificatePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  courseTitle: string;
  studentName: string;
  verificationCode?: string;
  issuedAt?: string;
  onOpenVerifyModal?: () => void;
}

export async function prepareCertificateData({ courseTitle, studentName, verificationCode, issuedAt }: Pick<CertificatePreviewModalProps, 'courseTitle' | 'studentName' | 'verificationCode' | 'issuedAt'>): Promise<CertificateData> {
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
  return {
    studentName: studentName || 'Estudiante',
    courseTitle: courseTitle,
    certificateId: verificationCode,
    dateStr: issuedAt ? new Date(issuedAt).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' }) : undefined,
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
}

export const CertificatePreviewModal: React.FC<CertificatePreviewModalProps> = ({
  isOpen,
  onClose,
  courseTitle,
  studentName,
  verificationCode,
  issuedAt,
  onOpenVerifyModal,
}) => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
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
        const data = await prepareCertificateData({ courseTitle, studentName, verificationCode, issuedAt });

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
  }, [isOpen, courseTitle, studentName, verificationCode, issuedAt]);

  if (!isOpen) return null;

  const handleDownload = () => {
    if (!previewUrl) return;
    const link = document.createElement('a');
    link.href = previewUrl;
    link.download = `Certificado_${studentName.replace(/\s+/g, '_')}_DocentOS.png`;
    link.click();
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/75 p-3 sm:p-6" onClick={onClose}>
      <section role="dialog" aria-modal="true" aria-labelledby="certificate-preview-title"
        className="academy-certificate-preview" onClick={event => event.stopPropagation()}>
        <header>
          <div><h2 id="certificate-preview-title">Tu certificado</h2><p>{courseTitle}</p></div>
          <button type="button" onClick={onClose} aria-label="Cerrar certificado"><X size={22} /></button>
        </header>
        <div className="academy-certificate-preview__canvas">
          {loading ? <p role="status"><Loader2 size={24} className="animate-spin" aria-hidden="true" />Preparando certificado…</p>
            : previewUrl ? <img src={previewUrl} alt={`Certificado de ${studentName}: ${courseTitle}`} />
            : <p role="alert">No pudimos cargar el certificado. Cierra la ventana y vuelve a intentarlo.</p>}
        </div>
        <footer>
          {verificationCode && onOpenVerifyModal && <button type="button" className="academy-text-button" onClick={() => { onClose(); onOpenVerifyModal(); }}><ShieldCheck size={18} aria-hidden="true" />Verificar certificado</button>}
          <button type="button" className="academy-button" onClick={handleDownload} disabled={loading || !previewUrl}>
            <Download size={18} aria-hidden="true" />Descargar PNG
          </button>
        </footer>
      </section>
    </div>
  );
};
