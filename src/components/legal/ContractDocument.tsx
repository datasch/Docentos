import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { parseContract } from '../../lib/contractMarkdown';

interface ContractDocumentProps {
  /** Texto del contrato en el Markdown sencillo que entrega el servidor. */
  content: string;
  /** Prefijo de los ids de las cláusulas, para enlazarlas desde un índice. */
  idPrefix?: string;
  /** Muestra el título y el subtítulo del propio documento antes de las cláusulas. */
  showHeading?: boolean;
}

/**
 * El contrato como cláusulas numeradas: cada una con su número, su título y, dentro,
 * los términos con su etiqueta destacada (en vez de un párrafo corrido).
 */
export const ContractDocument: React.FC<ContractDocumentProps> = ({ content, idPrefix = 'contract', showHeading = true }) => {
  const { t } = useTranslation();
  const doc = useMemo(() => parseContract(content), [content]);

  return (
    <article className="space-y-4">
      {showHeading && doc.title && (
        <header className="space-y-1">
          <h3 className="text-lg font-bold leading-snug tracking-tight text-ink sm:text-xl">{doc.title}</h3>
          {doc.subtitle && <p className="text-sm font-semibold text-brand-cyan">{doc.subtitle}</p>}
        </header>
      )}

      {doc.intro.map((paragraph, index) => (
        <p key={index} className="text-sm leading-relaxed text-ink-soft">
          {paragraph}
        </p>
      ))}

      {doc.clauses.map((clause) => (
        <section
          key={clause.number}
          id={`${idPrefix}-clause-${clause.number}`}
          data-clause={clause.number}
          aria-labelledby={`${idPrefix}-clause-title-${clause.number}`}
          className="scroll-mt-4 rounded-2xl border border-line bg-raised/50 p-4 sm:p-5"
        >
          <header className="flex items-start gap-3">
            <span
              aria-hidden="true"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-cyan to-brand-purple text-sm font-bold text-white shadow-sm"
            >
              {clause.number}
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
                {t('legal.clause', 'Cláusula {{number}}', { number: clause.number })}
              </p>
              <h4 id={`${idPrefix}-clause-title-${clause.number}`} className="text-base font-semibold leading-snug text-ink">
                {clause.title}
              </h4>
            </div>
          </header>

          <div className="mt-3 space-y-2.5 sm:pl-12">
            {clause.items.map((item, index) =>
              item.kind === 'term' ? (
                <dl key={index} className="rounded-xl border border-line bg-canvas/50 px-3.5 py-3">
                  <dt className="text-xs font-bold text-brand-cyan">{item.label}</dt>
                  <dd className="mt-1 text-sm leading-relaxed text-ink-soft">{item.text}</dd>
                </dl>
              ) : (
                <p key={index} className="text-sm leading-relaxed text-ink-soft">
                  {item.text}
                </p>
              ),
            )}
          </div>
        </section>
      ))}
    </article>
  );
};
