import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertCircle,
  Calendar,
  Check,
  Copy,
  FileCheck,
  Languages,
  Lock,
  RefreshCw,
  Shield,
  ShieldCheck,
  X,
} from 'lucide-react';
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
  const [activeClause, setActiveClause] = useState('1');
  const [progress, setProgress] = useState(0);
  const [copied, setCopied] = useState(false);

  const bodyRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Cada vez que se abre vuelve a la traducción y al principio.
  useEffect(() => {
    if (isOpen) {
      setShowOriginal(false);
      setProgress(0);
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

  // Marca en el índice la cláusula que se está leyendo.
  useEffect(() => {
    const root = bodyRef.current;
    if (!root || !doc?.clauses.length || typeof IntersectionObserver === 'undefined') return;
    const visible = new Map<string, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const number = (entry.target as HTMLElement).dataset.clause as string;
          if (entry.isIntersecting) visible.set(number, entry.boundingClientRect.top);
          else visible.delete(number);
        }
        if (visible.size) setActiveClause([...visible.entries()].sort((a, b) => a[1] - b[1])[0][0]);
      },
      { root, rootMargin: '0px 0px -55% 0px', threshold: 0 },
    );
    root.querySelectorAll<HTMLElement>('[data-clause]').forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [doc]);

  const goToClause = useCallback((number: string) => {
    const target = document.getElementById(`terms-clause-${number}`);
    target?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
    setActiveClause(number);
  }, []);

  const handleScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const element = event.currentTarget;
    const scrollable = element.scrollHeight - element.clientHeight;
    setProgress(scrollable > 0 ? Math.min(1, element.scrollTop / scrollable) : 1);
  };

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
  const summary = [
    {
      icon: Calendar,
      tone: 'text-brand-cyan bg-brand-cyan/10 border-brand-cyan/20',
      label: t('vigenciaAcceso', 'Vigencia Acceso'),
      value: t('legal.renewableMonths', '{{months}} meses renovables', { months: data?.accessPeriodMonths ?? 12 }),
    },
    {
      icon: Lock,
      tone: 'text-brand-purple bg-brand-purple/10 border-brand-purple/20',
      label: t('custodiaDiplomas', 'Custodia Diplomas'),
      value: t('legal.accreditedMonths', '{{months}} meses acreditados', { months: data?.retentionPeriodMonths ?? 24 }),
    },
    {
      icon: Shield,
      tone: 'text-success-light bg-success-light/10 border-success-light/20',
      label: t('privacidadArco', 'Privacidad & ARCO'),
      value: t('garantiaProtegida', 'Garantía Protegida'),
    },
  ];

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center overscroll-contain bg-black/70 p-3 backdrop-blur-md sm:p-6"
      onWheel={(event) => event.stopPropagation()}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="terms-modal-title"
        className="app-dialog flex max-h-[calc(100dvh-1.5rem)] w-full max-w-4xl flex-col overflow-hidden overscroll-contain rounded-3xl border border-line bg-surface text-ink shadow-2xl motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 motion-safe:duration-200 sm:max-h-[min(92dvh,52rem)]"
        onClick={(event) => event.stopPropagation()}
        onWheel={(event) => event.stopPropagation()}
      >
        {/* Cabecera */}
        <header className="relative shrink-0 overflow-hidden">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-gradient-to-br from-brand-cyan/15 via-brand-purple/10 to-transparent"
          />
          <div className="relative flex items-start gap-3 px-4 pb-3 pt-4 sm:gap-4 sm:px-8 sm:pb-4 sm:pt-6">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-brand-cyan to-brand-purple text-white shadow-lg shadow-brand-cyan/20 sm:h-12 sm:w-12">
              <FileCheck aria-hidden="true" className="h-6 w-6" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 id="terms-modal-title" className="text-lg font-bold leading-tight tracking-tight sm:text-2xl">
                {data?.title || t('terminosYCondicionesDeLaPlataforma', 'Términos y Condiciones de la Plataforma')}
              </h2>
              <p className="mt-1 hidden text-sm text-ink-muted sm:block">
                {t('politicasDeServicioPrivacidadYCustodia', 'Políticas de servicio, privacidad y custodia legal de certificaciones')}
              </p>
              {data?.version && (
                <span className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-brand-cyan/25 bg-brand-cyan/10 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-brand-cyan">
                  <ShieldCheck aria-hidden="true" className="h-3 w-3" />
                  {t('legal.version', 'Versión {{version}}', { version: data.version })}
                </span>
              )}
            </div>
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              className="-mr-1 -mt-1 grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-full text-ink-muted transition-colors hover:bg-ink/10 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-cyan"
              aria-label={t('cerrarModal', 'Cerrar modal')}
            >
              <X aria-hidden="true" className="h-5 w-5" />
            </button>
          </div>

          {/* Avance de lectura */}
          <div
            role="progressbar"
            aria-label={t('legal.readingProgress', 'Avance de lectura')}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress * 100)}
            className="relative h-0.5 bg-line"
          >
            <div
              className="h-full bg-gradient-to-r from-brand-cyan to-brand-purple motion-safe:transition-[width] motion-safe:duration-150"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>
        </header>

        {/* Lo esencial, de un vistazo */}
        <section
          aria-label={t('legal.summaryHint', 'Resumen de lo esencial')}
          className="flex shrink-0 snap-x gap-2 overflow-x-auto border-b border-line bg-raised/50 px-4 py-2.5 sm:grid sm:grid-cols-3 sm:gap-3 sm:overflow-visible sm:px-8 sm:py-3"
        >
          {summary.map(({ icon: Icon, tone, label, value }) => (
            <div key={label} className="flex min-w-[13.5rem] shrink-0 snap-start items-center gap-3 rounded-2xl border border-line bg-surface px-3 py-2 sm:min-w-0 sm:py-2.5">
              <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl border ${tone}`}>
                <Icon aria-hidden="true" className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <div className="truncate text-[11px] font-bold uppercase tracking-wider text-ink-muted">{label}</div>
                <div className="truncate text-sm font-semibold text-ink">{value}</div>
              </div>
            </div>
          ))}
        </section>

        {/* Cuerpo: índice + documento */}
        <div className="flex min-h-0 flex-1">
          {doc && doc.clauses.length > 0 && (
            <nav
              aria-label={t('legal.contractSectionsNav', 'Cláusulas del documento')}
              className="hidden w-64 shrink-0 flex-col gap-1 overflow-y-auto border-r border-line bg-raised/40 p-4 md:flex"
            >
              <p className="mb-1 px-2 text-[11px] font-bold uppercase tracking-wider text-ink-muted">
                {t('legal.tocTitle', 'Contenido')}
              </p>
              {doc.clauses.map((clause) => {
                const isActive = activeClause === clause.number;
                return (
                  <button
                    key={clause.number}
                    type="button"
                    onClick={() => goToClause(clause.number)}
                    aria-current={isActive ? 'true' : undefined}
                    className={`flex cursor-pointer items-start gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm transition-colors focus-visible:outline-2 focus-visible:outline-brand-cyan ${
                      isActive
                        ? 'bg-brand-cyan/10 font-semibold text-brand-cyan ring-1 ring-brand-cyan/30'
                        : 'text-ink-soft hover:bg-ink/5 hover:text-ink'
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`mt-px grid h-5 w-5 shrink-0 place-items-center rounded-md text-[11px] font-bold ${
                        isActive ? 'bg-brand-cyan text-canvas' : 'bg-ink/10 text-ink-muted'
                      }`}
                    >
                      {clause.number}
                    </span>
                    <span className="leading-snug">{clause.title}</span>
                  </button>
                );
              })}
            </nav>
          )}

          <div className="flex min-w-0 flex-1 flex-col">
            {/* Índice horizontal en pantallas estrechas */}
            {doc && doc.clauses.length > 0 && (
              <nav
                aria-label={t('legal.contractSectionsNav', 'Cláusulas del documento')}
                className="flex shrink-0 gap-2 overflow-x-auto border-b border-line px-4 py-2.5 md:hidden"
              >
                {doc.clauses.map((clause) => {
                  const isActive = activeClause === clause.number;
                  return (
                    <button
                      key={clause.number}
                      type="button"
                      onClick={() => goToClause(clause.number)}
                      aria-current={isActive ? 'true' : undefined}
                      className={`inline-flex min-h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-colors ${
                        isActive
                          ? 'border-brand-cyan bg-brand-cyan/15 text-brand-cyan'
                          : 'border-line bg-raised text-ink-soft'
                      }`}
                    >
                      <span aria-hidden="true">{clause.number}</span>
                      <span className="max-w-[9rem] truncate">{clause.title}</span>
                    </button>
                  );
                })}
              </nav>
            )}

            <div
              ref={bodyRef}
              onScroll={handleScroll}
              className="min-h-0 flex-1 space-y-5 overflow-y-auto bg-canvas/40 px-4 py-5 sm:px-8 sm:py-6"
            >
              {/* Idioma del texto: traducción de cortesía u original */}
              {data && (translated || (showOriginal && canShowOriginal)) && (
                <div className="flex flex-col gap-3 rounded-2xl border border-brand-cyan/25 bg-brand-cyan/5 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="flex items-start gap-2.5 text-sm leading-relaxed text-ink-soft">
                    <Languages aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-brand-cyan" />
                    <span>
                      {translated
                        ? t('legal.translationNotice', 'Traducción de cortesía. Si hay alguna diferencia, prevalece el texto original en español, que es el que se firma.')
                        : t('legal.originalNotice', 'Estás leyendo el texto original en español, el que se firma y el que fija el sello de integridad.')}
                    </span>
                  </p>
                  {canShowOriginal && (
                    <button
                      type="button"
                      onClick={() => setShowOriginal((value) => !value)}
                      className="inline-flex min-h-10 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-brand-cyan/40 px-3.5 text-xs font-bold text-brand-cyan transition-colors hover:bg-brand-cyan/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-cyan"
                    >
                      {showOriginal
                        ? t('legal.viewTranslation', 'Ver la traducción')
                        : t('legal.viewOriginal', 'Ver el original en español')}
                    </button>
                  )}
                </div>
              )}

              {status === 'loading' && !data ? (
                <div role="status" aria-live="polite" className="space-y-3 py-2">
                  <span className="sr-only">{t('cargandoTerminosOficiales', 'Cargando términos oficiales...')}</span>
                  {[72, 100, 88, 64, 94].map((width, index) => (
                    <div key={index} className="h-4 animate-pulse rounded-md bg-ink/10" style={{ width: `${width}%` }} />
                  ))}
                </div>
              ) : status === 'error' && !data ? (
                <div className="space-y-3 py-10 text-center">
                  <AlertCircle aria-hidden="true" className="mx-auto h-8 w-8 text-warning-light" />
                  <p className="text-sm text-ink-muted">
                    {t('noSePudoSincronizarLaVersionMasReciente', 'No se pudo sincronizar la versión más reciente del contrato.')}
                  </p>
                  <button
                    type="button"
                    onClick={() => setAttempt((value) => value + 1)}
                    className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-xl border border-line px-4 text-sm font-semibold text-ink hover:bg-ink/5"
                  >
                    <RefreshCw aria-hidden="true" className="h-4 w-4" />
                    {t('legal.retry', 'Reintentar')}
                  </button>
                </div>
              ) : data ? (
                <div className={status === 'loading' ? 'opacity-60 transition-opacity' : 'transition-opacity'} aria-busy={status === 'loading'}>
                  <ContractDocument content={data.content} idPrefix="terms" />

                  {/* Sello de integridad */}
                  {data.contractHash && (
                    <section className="mt-5 rounded-2xl border border-success-light/25 bg-gradient-to-br from-success-light/10 to-transparent p-4 sm:p-5">
                      <div className="flex items-start gap-3">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-success-light/25 bg-success-light/10 text-success-light">
                          <ShieldCheck aria-hidden="true" className="h-4 w-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <h3 className="text-sm font-bold text-ink">{t('legal.integrityTitle', 'Sello de integridad')}</h3>
                          <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">
                            {t('legal.integrityHelp', 'Huella SHA-256 del texto original en español. Permite comprobar que el documento que firmaste no ha cambiado.')}
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                        <code className="min-w-0 flex-1 break-all rounded-xl border border-line bg-canvas/70 px-3 py-2 font-mono text-[11px] leading-relaxed text-ink-soft">
                          {data.contractHash}
                        </code>
                        <button
                          type="button"
                          onClick={copySeal}
                          className="inline-flex min-h-10 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-xl border border-line px-3.5 text-xs font-bold text-ink transition-colors hover:bg-ink/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-cyan"
                        >
                          {copied ? <Check aria-hidden="true" className="h-4 w-4 text-success-light" /> : <Copy aria-hidden="true" className="h-4 w-4" />}
                          <span aria-live="polite">{copied ? t('legal.sealCopied', 'Sello copiado') : t('legal.copySeal', 'Copiar sello')}</span>
                        </button>
                      </div>
                    </section>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {/* Pie */}
        <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-line bg-raised/60 px-5 py-3.5 sm:px-8">
          <span className="text-xs text-ink-muted">{t('documentoLegalPublicoTransparente', 'Documento legal público transparente')}</span>
          <button
            type="button"
            onClick={onClose}
            className="btn-brand-primary min-h-11 cursor-pointer rounded-xl px-6 text-sm font-bold shadow-sm"
          >
            {t('entendido', 'Entendido')}
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
};
