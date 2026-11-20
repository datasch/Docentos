/**
 * Modal de Verificación Pública de Certificados
 * DocentOS LMS
 *
 * Permite a cualquier usuario, reclutador o institución validar
 * la autenticidad de un certificado emitido con su código único.
 */

import { dateLocale } from '../i18n/format';
import React, { useState, useEffect } from 'react';
import { CheckCircle2, XCircle, ShieldCheck, Copy, Check, X } from 'lucide-react';
import { api } from '../lib/api';
import { CertificateRecord } from '../types';
import { useBodyScrollLock } from '../lib/useBodyScrollLock';
import { useTranslation } from 'react-i18next'

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
  const { t } = useTranslation()
  useBodyScrollLock(isOpen);
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
      setSearchResult({ valid: false, error: err.message || t('errorAlVerificarCertificado', 'Error al verificar certificado') });
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

  const cert = searchResult?.certificate;
  const state = searchResult?.valid && cert ? 'valid' : searchResult?.isRevoked ? 'revoked' : 'missing';
  const stop = (event: React.SyntheticEvent) => event.stopPropagation();

  return (
    <div className="terms-overlay" onClick={onClose} onWheel={stop}>
      <div role="dialog" aria-modal="true" aria-labelledby="verify-title" className="terms-frame" onClick={stop} onWheel={stop}>
        <article className="terms-paper">
          <header className="terms-paper__top">
            <div>
              <strong>{t('docentos', 'DocentOS')}</strong>
              <span>{t('plataformaELearning', 'Plataforma e-Learning')}</span>
            </div>
          </header>

          <h2 id="verify-title">{t('viewer.verifyTitle', 'Verificación oficial de certificados')}</h2>
          <p className="terms-paper__state" style={{ textAlign: 'center' }}>
            {t('viewer.verifyLead', 'Escribe el código del certificado para comprobar que es auténtico y que sigue vigente.')}
          </p>

          <form
            className="verify-form"
            onSubmit={(event) => {
              event.preventDefault();
              handleVerify();
            }}
          >
            <label htmlFor="verify-code">{t('viewer.verifyCodeLabel', 'Código del certificado')}</label>
            <div className="verify-form__row">
              <input
                id="verify-code"
                type="text"
                value={code}
                autoComplete="off"
                spellCheck={false}
                onChange={(event) => setCode(event.target.value.toUpperCase())}
                placeholder={t('ejDoc6a1b2c3d4e5f6789', 'Ej. DOC-6A1B2C3D4E5F6789')}
              />
              <button type="submit" disabled={isSearching || !code.trim()}>
                {isSearching ? t('viewer.verifying', 'Verificando…') : t('verificar', 'Verificar')}
              </button>
            </div>
          </form>

          {searchResult && (
            <section aria-live="polite" className="verify-result">
              {state === 'valid' && cert ? (
                <>
                  <div className="verify-valid-head">
                    <span className="verify-stamp" data-state="valid">
                      <CheckCircle2 aria-hidden size={16} />
                      {t('viewer.verifyValid', 'Certificado válido')}
                    </span>
                    <svg className="verify-seal" aria-hidden width="76" height="76" viewBox="0 0 76 76">
                      <defs><path id="verify-seal-ring" d="M38 38 m-27 0 a27 27 0 1 1 54 0 a27 27 0 1 1 -54 0" /></defs>
                      <circle cx="38" cy="38" r="35" fill="none" stroke="currentColor" strokeWidth="2" />
                      <circle cx="38" cy="38" r="21" fill="none" stroke="currentColor" strokeWidth="1" />
                      <text fontSize="6.4" fontWeight="700" letterSpacing="1.6" fill="currentColor"><textPath href="#verify-seal-ring">{t('docentosCertificadoVerificado', 'DOCENTOS · CERTIFICADO VERIFICADO ·')} </textPath></text>
                      <path d="M28 38.5l7 7 13-14" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <dl className="terms-paper__data">
                    <div><dt>{t('graduado', 'Graduado')}</dt><dd>{cert.recipientName}</dd></div>
                    <div><dt>{t('viewer.vProgram', 'Programa académico')}</dt><dd>{cert.courseTitle}</dd></div>
                    <div>
                      <dt>{t('viewer.vIssued', 'Fecha de emisión')}</dt>
                      <dd>{new Date(cert.issuedAt).toLocaleDateString(dateLocale(), { year: 'numeric', month: 'long', day: 'numeric' })}</dd>
                    </div>
                    <div><dt>{t('viewer.vCode', 'Código')}</dt><dd style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 14 }}>{cert.verificationCode}</dd></div>
                  </dl>
                  <button type="button" className="verify-secondary" onClick={copyVerificationLink}>
                    {copied ? <Check aria-hidden size={16} /> : <Copy aria-hidden size={16} />}
                    {copied ? t('enlaceCopiado', 'Enlace copiado') : t('copiarEnlacePublico', 'Copiar enlace público')}
                  </button>
                </>
              ) : state === 'revoked' ? (
                <>
                  <span className="verify-stamp" data-state="revoked">
                    <XCircle aria-hidden size={16} />
                    {t('viewer.verifyRevoked', 'Certificado revocado')}
                  </span>
                  <p className="terms-paper__state">{t('esteCertificadoFueRevocadoFormalmentePor', 'Este certificado fue revocado formalmente por la administración académica.')}</p>
                  {cert?.revocationReason && (
                    <p className="terms-paper__state"><strong>{t('viewer.revocationReason', 'Motivo')}:</strong> {cert.revocationReason}</p>
                  )}
                </>
              ) : (
                <>
                  <span className="verify-stamp" data-state="missing">
                    <XCircle aria-hidden size={16} />
                    {t('viewer.verifyMissing', 'Certificado no encontrado')}
                  </span>
                  <p className="terms-paper__state">{searchResult.error || t('noSeLocalizoNingunDiplomaEmitidoConEl', 'No se localizó ningún diploma emitido con el código proporcionado.')}</p>
                </>
              )}
            </section>
          )}

          <footer className="terms-paper__foot">
            <span><ShieldCheck aria-hidden size={14} style={{ display: 'inline', verticalAlign: '-2px', marginRight: 6 }} />{t('viewer.verifyFoot', 'Consulta pública, sin necesidad de iniciar sesión')}</span>
            <button type="button" className="terms-paper__ok" onClick={onClose}>{t('viewer.close', 'Cerrar')}</button>
          </footer>
        </article>

        <button type="button" className="terms-close" onClick={onClose} aria-label={t('cerrarModal', 'Cerrar modal')}>
          <X aria-hidden />
        </button>
      </div>
    </div>
  );
};
