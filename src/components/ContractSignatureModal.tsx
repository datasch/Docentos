import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { FileCheck, Shield, Calendar, Clock, AlertCircle, ChevronRight, Lock, Languages } from 'lucide-react';
import { api } from '../lib/api';
import { normalizeLanguage } from '../i18n/languages';
import { ContractDocument } from './legal/ContractDocument';
import { useBodyScrollLock } from '../lib/useBodyScrollLock';
import { useTranslation, Trans } from 'react-i18next'

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

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md font-sans overscroll-contain"
      onWheel={(e) => e.stopPropagation()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="contract-signature-title"
        className="app-dialog flex flex-col bg-surface text-ink border border-line rounded-2xl w-full max-w-[620px] overflow-hidden shadow-2xl max-h-[calc(100dvh-1.5rem)] animate-in fade-in zoom-in-95 duration-150 overscroll-contain"
        onWheel={(e) => e.stopPropagation()}
      >
        {/* Header amplio y profesional */}
        <div className="px-6 py-4.5 sm:py-5 bg-gradient-to-r from-brand-cyan/10 via-brand-purple/5 to-surface border-b border-line flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3.5">
            <div className="p-2.5 bg-brand-cyan/10 border border-brand-cyan/20 rounded-xl text-brand-cyan">
              <FileCheck aria-hidden="true" className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <h2 id="contract-signature-title" className="text-base sm:text-lg font-bold text-ink tracking-tight">
                {t('firmaDeAcuerdoYTerminosDeLaPlataforma', 'Firma de Acuerdo y Términos de la Plataforma')}
              </h2>
              <p className="text-xs sm:text-[13px] text-ink-muted mt-0.5">
                {t('habilitacionDeAccesoOficialParaNuevos', 'Habilitación de acceso oficial para nuevos miembros registrados')}
              </p>
            </div>
          </div>
          <Shield aria-hidden="true" className="w-5 h-5 text-ink-faint hidden sm:block" />
        </div>

        {/* Resumen de Fechas Clave */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 px-4 sm:px-6 py-3 bg-raised/60 border-b border-line text-xs shrink-0">
          <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-raised border border-line">
            <Calendar aria-hidden="true" className="w-4 h-4 text-success-light shrink-0" />
            <div className="min-w-0">
              <div className="text-ink-muted text-[10px] uppercase font-bold tracking-wider">{t('inicio', 'Inicio')}</div>
              <div className="text-ink font-semibold truncate text-xs">{formatDate(contractData.calculatedDates.startDate)}</div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-raised border border-line">
            <Clock aria-hidden="true" className="w-4 h-4 text-brand-cyan shrink-0" />
            <div className="min-w-0">
              <div className="text-ink-muted text-[10px] uppercase font-bold tracking-wider">{t('vigencia', 'Vigencia')}</div>
              <div className="text-ink font-semibold truncate text-xs">{formatDate(contractData.calculatedDates.endDate)}</div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-raised border border-line">
            <Lock aria-hidden="true" className="w-4 h-4 text-brand-purple shrink-0" />
            <div className="min-w-0">
              <div className="text-ink-muted text-[10px] uppercase font-bold tracking-wider">{t('custodia', 'Custodia')}</div>
              <div className="text-ink font-semibold truncate text-xs">{t('retentionPeriodMonthsMeses', '{{retentionPeriodMonths}} meses', { retentionPeriodMonths: contractData.calculatedDates.retentionPeriodMonths })}</div>
            </div>
          </div>
        </div>

        {/* Visor de Contrato: cláusulas numeradas y fáciles de recorrer */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 min-h-0 max-h-[40dvh] bg-canvas/60 border-b border-line scrollbar-thin scrollbar-thumb-white/10">
          {isTranslation && (
            <p className="mb-4 flex items-start gap-2.5 rounded-xl border border-brand-cyan/25 bg-brand-cyan/5 p-3 text-xs leading-relaxed text-ink-soft">
              <Languages aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-brand-cyan" />
              <span>{t('legal.translationNotice', 'Traducción de cortesía. Si hay alguna diferencia, prevalece el texto original en español, que es el que se firma.')}</span>
            </p>
          )}
          <ContractDocument content={contractText} idPrefix="sign" />
        </div>

        {/* Formulario y Aceptaciones */}
        <form onSubmit={handleSign} className="p-6 bg-surface flex flex-col gap-4 shrink-0">
          {error && (
            <div role="alert" className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-danger-light text-xs flex items-center gap-2.5">
              <AlertCircle aria-hidden="true" className="w-4 h-4 shrink-0 text-danger-light" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-2.5 text-xs sm:text-[13px]">
            <label className="flex items-start gap-2.5 cursor-pointer group">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-line-strong accent-brand-cyan text-brand-cyan focus:ring-brand-cyan bg-raised"
              />
              <span className="text-ink-soft group-hover:text-ink transition-colors leading-snug">
                <Trans i18nKey="heLeidoYAceptoLosTerminosYCondicionesDe">He leído y acepto los <strong className="text-ink font-semibold">Términos y Condiciones</strong> de la plataforma.</Trans>
              </span>
            </label>

            <label className="flex items-start gap-2.5 cursor-pointer group">
              <input
                type="checkbox"
                checked={acceptedPrivacy}
                onChange={(e) => setAcceptedPrivacy(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-line-strong accent-brand-cyan text-brand-cyan focus:ring-brand-cyan bg-raised"
              />
              <span className="text-ink-soft group-hover:text-ink transition-colors leading-snug">
                <Trans i18nKey="aceptoLaPoliticaDePrivacidadParaElAcceso">Acepto la <strong className="text-ink font-semibold">Política de Privacidad</strong> para el acceso a las clases.</Trans>
              </span>
            </label>

            <label className="flex items-start gap-2.5 cursor-pointer group">
              <input
                type="checkbox"
                checked={acceptedDataPolicy}
                onChange={(e) => setAcceptedDataPolicy(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-line-strong accent-brand-cyan text-brand-cyan focus:ring-brand-cyan bg-raised"
              />
              <span className="text-ink-soft group-hover:text-ink transition-colors leading-snug">
                <Trans i18nKey="autorizoLaCustodiaYRetencionDeMisDatos">Autorizo la <strong className="text-ink font-semibold">custodia y retención de mis datos académicos</strong> por un período de {{ retentionPeriodMonths: contractData.calculatedDates.retentionPeriodMonths }} meses.</Trans>
              </span>
            </label>

            <label className="flex items-start gap-2.5 cursor-pointer group">
              <input
                type="checkbox"
                checked={acceptedCommercials}
                onChange={(e) => setAcceptedCommercials(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-line-strong accent-brand-cyan text-brand-cyan focus:ring-brand-cyan bg-raised"
              />
              <span className="text-ink-muted group-hover:text-ink-soft transition-colors leading-snug">
                {t('opcionalAceptoRecibirNovedadesY', '(Opcional) Acepto recibir novedades y actualizaciones académicas.')}
              </span>
            </label>
          </div>

          <div className="pt-2 flex items-center justify-end">
            <button
              type="submit"
              disabled={!isFormValid || isSigning}
              className={`px-6 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 transition-all shadow-lg ${
                isFormValid && !isSigning
                  ? 'btn-brand-primary cursor-pointer'
                  : 'bg-raised text-ink-muted border border-line cursor-not-allowed opacity-60'
              }`}
            >
              {isSigning ? (
                <>
                  <div className="w-4 h-4 border-2 border-current/25 border-t-current rounded-full animate-spin" />
                  <span>{t('registrandoFirmaConHash', 'Registrando firma con hash...')}</span>
                </>
              ) : (
                <>
                  <span>{t('firmarYContinuar', 'Firmar y Continuar')}</span>
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
