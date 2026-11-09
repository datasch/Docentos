import React, { lazy, Suspense, useState } from 'react';
import { Award, Download, Eye, Loader2 } from 'lucide-react';
import type { CertificateRecord } from '../../types';

const Preview = lazy(() => import('./CertificatePreviewModal').then(module => ({ default: module.CertificatePreviewModal })));

export function LearningCertificates({ certificates, studentName, onVerify }: {
  certificates: CertificateRecord[];
  studentName: string;
  onVerify?: (code: string) => void;
}) {
  const [selected, setSelected] = useState<CertificateRecord | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [error, setError] = useState('');
  const valid = certificates.filter(certificate => !certificate.revokedAt);
  if (!valid.length) return null;

  async function download(certificate: CertificateRecord) {
    if (downloading) return;
    setDownloading(certificate.id);
    setError('');
    try {
      const { prepareCertificateData } = await import('./CertificatePreviewModal');
      const { downloadCertificate } = await import('../../plugins/CertificateGenerator');
      await downloadCertificate(await prepareCertificateData({
        courseTitle: certificate.courseTitle,
        studentName: certificate.recipientName || studentName,
        verificationCode: certificate.verificationCode,
        issuedAt: certificate.issuedAt,
      }));
    } catch {
      setError('No pudimos descargar el certificado. Vuelve a intentarlo.');
    } finally {
      setDownloading(null);
    }
  }

  return <section className="academy-learning-section">
    <h2>Certificados obtenidos</h2>
    {error && <p role="alert" className="academy-learning-notice">{error}</p>}
    <ul className="academy-learning-certificates">
      {valid.map(certificate => <li key={certificate.id}>
        <Award size={24} aria-hidden="true" />
        <div className="academy-learning-certificate__info"><h3>{certificate.courseTitle}</h3>
          <p>Emitido el {new Date(certificate.issuedAt).toLocaleDateString('es-PE')}</p></div>
        <div className="academy-learning-certificate__actions">
          <button type="button" className="academy-text-button" onClick={() => setSelected(certificate)} aria-label={`Ver certificado de ${certificate.courseTitle}`}><Eye size={17} aria-hidden="true" />Ver certificado</button>
          <button type="button" className="academy-text-button" disabled={Boolean(downloading)} onClick={() => download(certificate)} aria-label={`Descargar certificado de ${certificate.courseTitle}`}>
            {downloading === certificate.id ? <Loader2 size={17} className="animate-spin" aria-hidden="true" /> : <Download size={17} aria-hidden="true" />}Descargar
          </button>
        </div>
      </li>)}
    </ul>
    {selected && <Suspense fallback={<p role="status">Cargando certificado…</p>}><Preview
      key={selected.id} isOpen onClose={() => setSelected(null)} courseTitle={selected.courseTitle}
      studentName={selected.recipientName || studentName} verificationCode={selected.verificationCode} issuedAt={selected.issuedAt}
      onOpenVerifyModal={onVerify ? () => onVerify(selected.verificationCode) : undefined}
    /></Suspense>}
  </section>;
}
