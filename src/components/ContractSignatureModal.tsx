import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../lib/api';
import { normalizeLanguage } from '../i18n/languages';
import { ContractDocument } from './legal/ContractDocument';
import { useBodyScrollLock } from '../lib/useBodyScrollLock';
import { useTranslation, Trans } from 'react-i18next';
import '../styles/terms-paper.css';

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
  const { t, i18n } = useTranslation()
  useBodyScrollLock(true);
  const language = normalizeLanguage(i18n.resolvedLanguage || i18n.language);
  // El texto sigue el idioma de la interfaz. La versión, el sello y las fechas no cambian: son los del original.
  const [localized, setLocalized] = useState<{ content: string; translated: boolean } | null>(null);
  useEffect(() => {
    let active = true;
    api.contracts
      .getPending(language)
      .then((response) => {
        if (active && response.requiresSignature && response.contract) {
          setLocalized({ content: response.contract.content, translated: Boolean(response.contract.translated) });
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [language]);
  const contractText = localized?.content ?? contractData.content;
  const isTranslation = localized?.translated ?? false;
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [acceptedDataPolicy, setAcceptedDataPolicy] = useState(false);
  const [acceptedCommercials, setAcceptedCommercials] = useState(false);
  // Las casillas se habilitan al llegar al final del contrato: así «He leído» es cierto.
  const [readAll, setReadAll] = useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const checkRead = React.useCallback(() => {
    const el = scrollRef.current;
    if (el && el.scrollHeight - el.scrollTop - el.clientHeight <= 8) setReadAll(true);
  }, []);
  useEffect(() => {
    checkRead();
    window.addEventListener('resize', checkRead);
    return () => window.removeEventListener('resize', checkRead);
  }, [checkRead, contractText]);
  const [isSigning, setIsSigning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formatDate = (isoStr: string) => {
    try {
      return new Date(isoStr).toLocaleDateString(language, {
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
      setError(err.message || t('errorAlFirmarElContratoPorFavorIntentaDe', 'Error al firmar el contrato. Por favor intenta de nuevo.'));
      setIsSigning(false);
    }
  };

  if (typeof document === 'undefined') return null;

  const dates = contractData.calculatedDates;
  const facts = [
    { label: t('inicio', 'Inicio'), value: formatDate(dates.startDate) },
    { label: t('vigencia', 'Vigencia'), value: formatDate(dates.endDate) },
    { label: t('custodia', 'Custodia'), value: t('retentionPeriodMonthsMeses', '{{retentionPeriodMonths}} meses', { retentionPeriodMonths: dates.retentionPeriodMonths }) },
  ];
  const required: Array<{ checked: boolean; set: (value: boolean) => void; label: React.ReactNode }> = [
    { checked: acceptedTerms, set: setAcceptedTerms, label: <Trans i18nKey="heLeidoYAceptoLosTerminosYCondicionesDe">He leído y acepto los <strong>Términos y Condiciones</strong> de la plataforma.</Trans> },
    { checked: acceptedPrivacy, set: setAcceptedPrivacy, label: <Trans i18nKey="aceptoLaPoliticaDePrivacidadParaElAcceso">Acepto la <strong>Política de Privacidad</strong> para el acceso a las clases.</Trans> },
    { checked: acceptedDataPolicy, set: setAcceptedDataPolicy, label: <Trans i18nKey="autorizoLaCustodiaYRetencionDeMisDatos">Autorizo la <strong>custodia y retención de mis datos académicos</strong> por un período de {{ retentionPeriodMonths: dates.retentionPeriodMonths }} meses.</Trans> },
  ];

  return createPortal(
    <div className="terms-overlay" onWheel={(e) => e.stopPropagation()}>
      <div role="dialog" aria-modal="true" aria-labelledby="contract-signature-title" className="terms-frame" onWheel={(e) => e.stopPropagation()}>
        <article className="terms-paper sign-paper">
          <header className="terms-paper__top">
            <div>
              <strong>DocentOS</strong>
              <span>{t('plataformaELearning', 'Plataforma e-Learning')}</span>
            </div>
            <div className="terms-paper__no">
              <span>{t('legal.versionLabel', 'Versión')}</span>
              <b>{contractData.version}</b>
            </div>
          </header>

          <div className="sign-paper__head">
            <h2 id="contract-signature-title">{t('antesDeEmpezar', 'Antes de empezar')}</h2>
            <p>{t('leeYAceptaParaEntrar', 'Lee con calma y acepta estas condiciones para entrar a las clases.')}</p>
          </div>

          <dl className="sign-paper__facts">
            {facts.map((fact) => (
              <div key={fact.label}>
                <dt>{fact.label}</dt>
                <dd>{fact.value}</dd>
              </div>
            ))}
          </dl>

          <div className={`sign-paper__reader${readAll ? '' : ' is-unread'}`}>
            <div ref={scrollRef} onScroll={checkRead} className="sign-paper__scroll" tabIndex={0} role="region" aria-label={t('legal.contractSectionsNav', 'Cláusulas del documento')} aria-describedby="sign-read-hint">
              {isTranslation && (
                <p className="terms-paper__note" style={{ marginBottom: 20 }}>
                  <span>{t('legal.translationNotice', 'Traducción de cortesía. Si hay alguna diferencia, prevalece el texto original en español, que es el que se firma.')}</span>
                </p>
              )}
              <ContractDocument content={contractText} idPrefix="sign" paper />
            </div>
          </div>

          <p id="sign-read-hint" className="sign-paper__hint" data-done={readAll || undefined} role="status">
            {readAll
              ? t('yaPuedesAceptar', 'Listo, ya puedes aceptar.')
              : t('lesHastaElFinalParaAceptar', 'Desplázate hasta el final para poder aceptar.')}
          </p>

          <form onSubmit={handleSign} className="sign-paper__form">
            {error && <p role="alert" className="sign-paper__error">{error}</p>}

            <fieldset className="sign-paper__checks" disabled={!readAll}>
              {required.map((item, index) => (
                <label key={index}>
                  <input type="checkbox" checked={item.checked} onChange={(e) => item.set(e.target.checked)} />
                  <span>{item.label}</span>
                </label>
              ))}
              <label className="is-optional">
                <input type="checkbox" checked={acceptedCommercials} onChange={(e) => setAcceptedCommercials(e.target.checked)} />
                <span>{t('opcionalAceptoRecibirNovedadesY', '(Opcional) Acepto recibir novedades y actualizaciones académicas.')}</span>
              </label>
            </fieldset>

            <button type="submit" className="terms-paper__ok sign-paper__submit" disabled={!readAll || !isFormValid || isSigning}>
              {isSigning ? t('guardandoTuAceptacion', 'Guardando tu aceptación...') : t('aceptarYContinuar', 'Aceptar y continuar')}
            </button>
          </form>
        </article>
      </div>
    </div>,
    document.body
  );
};
