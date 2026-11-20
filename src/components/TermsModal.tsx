import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Copy, RefreshCw, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { normalizeLanguage } from '../i18n/languages';
import { parseContract } from '../lib/contractMarkdown';
import { useBodyScrollLock } from '../lib/useBodyScrollLock';
import { ContractDocument } from './legal/ContractDocument';

interface TermsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type TermsData = Awaited<ReturnType<typeof api.contracts.getPublic>>;

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

/**
 * Términos y privacidad.
 *
 * Se lee en el idioma de la interfaz (el servidor entrega una traducción de cortesía)
 * y se puede alternar con el original en español, que es el que se firma. Un índice
 * lateral (chips en el móvil) lleva a cada cláusula y marca por cuál se va leyendo.
 */
export const TermsModal: React.FC<TermsModalProps> = ({ isOpen, onClose }) => {
  const { t, i18n } = useTranslation();
  useBodyScrollLock(isOpen);

  const language = normalizeLanguage(i18n.resolvedLanguage || i18n.language);
  const [showOriginal, setShowOriginal] = useState(false);
  const requestedLanguage = showOriginal ? 'es' : language;

  const [data, setData] = useState<TermsData | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);
  const [copied, setCopied] = useState(false);

  const bodyRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Cada vez que se abre vuelve a la traducción y al principio.
  useEffect(() => {
    if (isOpen) {
      setShowOriginal(false);
    }
  }, [isOpen]);

  // El texto se descarga al abrir y al cambiar de idioma. Mientras llega el nuevo se conserva el anterior.
  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;
    setStatus('loading');
    api.contracts
      .getPublic(requestedLanguage)
      .then((response) => {
        if (!isMounted) return;
        setData(response);
        setStatus('ready');
        bodyRef.current?.scrollTo({ top: 0 });
      })
      .catch(() => {
        if (isMounted) setStatus('error');
      });
    return () => {
      isMounted = false;
    };
  }, [isOpen, requestedLanguage, attempt]);

  // Escape cierra; al abrir el foco va al botón de cerrar y al cerrar vuelve a donde estaba.
  useEffect(() => {
    if (!isOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      previous?.focus?.();
    };
  }, [isOpen, onClose]);

  useEffect(() => () => clearTimeout(copyTimer.current), []);

  const doc = useMemo(() => (data ? parseContract(data.content) : null), [data]);

  const goToClause = useCallback((number: string) => {
    const target = document.getElementById(`terms-clause-${number}`);
    target?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
  }, []);

  const copySeal = async () => {
    if (!data?.contractHash) return;
    try {
      await navigator.clipboard.writeText(data.contractHash);
    } catch {
      const area = document.createElement('textarea');
      area.value = data.contractHash;
      document.body.appendChild(area);
      area.select();
      document.execCommand('copy');
      area.remove();
    }
    setCopied(true);
    clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen || typeof document === 'undefined') return null;

  const translated = Boolean(data?.translated);
  const canShowOriginal = language !== 'es';
  const facts = [
    { label: t('vigenciaAcceso', 'Vigencia del acceso'), value: t('legal.renewableMonths', '{{months}} meses renovables', { months: data?.accessPeriodMonths ?? 12 }) },
    { label: t('custodiaDiplomas', 'Custodia de datos'), value: t('legal.accreditedMonths', '{{months}} meses acreditados', { months: data?.retentionPeriodMonths ?? 24 }) },
  ];
  const stop = (event: React.SyntheticEvent) => event.stopPropagation();

  return createPortal(
    <div className="terms-overlay" onClick={onClose} onWheel={stop}>
      <div role="dialog" aria-modal="true" aria-labelledby="terms-modal-title" className="terms-frame" onClick={stop} onWheel={stop}>
        <article className="terms-paper" ref={bodyRef} aria-busy={status === 'loading'}>
          <header className="terms-paper__top">
            <div>
              <strong>{t('docentos', 'DocentOS')}</strong>
              <span>{t('plataformaELearning', 'Plataforma e-Learning')}</span>
            </div>
            {data?.version && (
              <div className="terms-paper__no">
                <span>{t('legal.versionLabel', 'Versión')}</span>
                <b>{data.version}</b>
              </div>
            )}
          </header>

          <h2 id="terms-modal-title">
            {data?.title || t('terminosYCondicionesDeLaPlataforma', 'Términos y Condiciones de la Plataforma')}
          </h2>

          {data && (
            <dl className="terms-paper__data">
              {facts.map((fact) => (
                <div key={fact.label}>
                  <dt>{fact.label}</dt>
                  <dd>{fact.value}</dd>
                </div>
              ))}
            </dl>
          )}

          {data && (translated || (showOriginal && canShowOriginal)) && (
            <p className="terms-paper__note">
              <span>
                {translated
                  ? t('legal.translationNotice', 'Traducción de cortesía. Si hay alguna diferencia, prevalece el texto original en español, que es el que se firma.')
                  : t('legal.originalNotice', 'Estás leyendo el texto original en español, el que se firma y el que fija el sello de integridad.')}
              </span>
              {canShowOriginal && (
                <button type="button" className="terms-paper__link" onClick={() => setShowOriginal((value) => !value)}>
                  {showOriginal ? t('legal.viewTranslation', 'Ver la traducción') : t('legal.viewOriginal', 'Ver el original en español')}
                </button>
              )}
            </p>
          )}

          {status === 'loading' && !data ? (
            <p className="terms-paper__state" role="status" aria-live="polite">
              {t('cargandoTerminosOficiales', 'Cargando términos oficiales...')}
            </p>
          ) : status === 'error' && !data ? (
            <div>
              <p className="terms-paper__state">
                {t('noSePudoSincronizarLaVersionMasReciente', 'No se pudo sincronizar la versión más reciente del contrato.')}
              </p>
              <p style={{ margin: '12px 0 0' }}>
                <button type="button" className="terms-paper__link" onClick={() => setAttempt((value) => value + 1)}>
                  <RefreshCw aria-hidden="true" style={{ width: 14, height: 14, verticalAlign: '-2px', marginRight: 6 }} />
                  {t('legal.retry', 'Reintentar')}
                </button>
              </p>
            </div>
          ) : data ? (
            <>
              {doc && doc.clauses.length > 2 && (
                <nav aria-label={t('legal.contractSectionsNav', 'Cláusulas del documento')}>
                  <h3 className="terms-paper__label">{t('legal.tocTitle', 'Contenido')}</h3>
                  <ol className="terms-paper__toc">
                    {doc.clauses.map((clause) => (
                      <li key={clause.number}>
                        <button type="button" onClick={() => goToClause(clause.number)}>
                          {clause.number}. {clause.title}
                        </button>
                      </li>
                    ))}
                  </ol>
                </nav>
              )}

              <div style={{ opacity: status === 'loading' ? 0.6 : 1 }}>
                <ContractDocument content={data.content} idPrefix="terms" paper />
              </div>

              {data.contractHash && (
                <section className="terms-paper__seal" aria-labelledby="terms-seal">
                  <h3 id="terms-seal" className="terms-paper__label" style={{ margin: 0 }}>{t('legal.integrityTitle', 'Sello de integridad')}</h3>
                  <p>{t('legal.integrityHelp', 'Huella SHA-256 del texto original en español. Permite comprobar que el documento que firmaste no ha cambiado.')}</p>
                  <div className="terms-paper__hash">
                    <code>{data.contractHash}</code>
                    <button type="button" onClick={copySeal}>
                      {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
                      <span aria-live="polite">{copied ? t('legal.sealCopied', 'Sello copiado') : t('legal.copySeal', 'Copiar sello')}</span>
                    </button>
                  </div>
                </section>
              )}
            </>
          ) : null}

          <footer className="terms-paper__foot">
            <span>{t('documentoLegalPublicoTransparente', 'Documento legal público')}</span>
            <button type="button" className="terms-paper__ok" onClick={onClose}>
              {t('entendido', 'Entendido')}
            </button>
          </footer>
        </article>

        <button ref={closeRef} type="button" className="terms-close" onClick={onClose} aria-label={t('cerrarModal', 'Cerrar modal')}>
          <X aria-hidden="true" />
        </button>
      </div>
    </div>,
    document.body,
  );
};
