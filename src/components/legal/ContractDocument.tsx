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
  /** Sobre papel claro (términos públicos): usa las clases de `terms-paper.css` en vez del tema oscuro. */
  paper?: boolean;
}

/**
 * El contrato como cláusulas numeradas: cada una con su número, su título y, dentro,
 * los términos con su etiqueta destacada (en vez de un párrafo corrido).
 */
export const ContractDocument: React.FC<ContractDocumentProps> = ({ content, idPrefix = 'contract', showHeading = true, paper = false }) => {
  const { t } = useTranslation();
  const doc = useMemo(() => parseContract(content), [content]);

  if (paper) {
    return (
      <article className="terms-doc">
        {showHeading && doc.title && (
          <header className="terms-doc__head">
            <h3>{doc.title}</h3>
            {doc.subtitle && <p>{doc.subtitle}</p>}
          </header>
        )}
        {doc.intro.map((paragraph, index) => (
          <p key={index} className="terms-doc__text">{paragraph}</p>
        ))}
        {doc.clauses.map((clause) => (
          <section
            key={clause.number}
            id={`${idPrefix}-clause-${clause.number}`}
            data-clause={clause.number}
            aria-labelledby={`${idPrefix}-clause-title-${clause.number}`}
            className="terms-doc__clause"
          >
            <h4 id={`${idPrefix}-clause-title-${clause.number}`}>
              <span aria-hidden="true">{clause.number}.</span>
              <span className="sr-only">{t('legal.clause', 'Cláusula {{number}}', { number: clause.number })}. </span>
              {clause.title}
            </h4>
            <div className="terms-doc__body">
              {clause.items.map((item, index) =>
                item.kind === 'term' ? (
                  <dl key={index}>
                    <dt>{item.label}</dt>
                    <dd>{item.text}</dd>
                  </dl>
                ) : (
                  <p key={index} className="terms-doc__text">{item.text}</p>
                ),
              )}
            </div>
          </section>
        ))}
      </article>
    );
  }

  return (
    <article>
      {(showHeading && doc.title) || doc.intro.length > 0 ? (
        <div className="space-y-3 pb-6">
          {showHeading && doc.title && (
            <header className="space-y-1">
              <h3 className="text-lg font-semibold leading-snug text-ink sm:text-xl">{doc.title}</h3>
              {doc.subtitle && <p className="text-sm text-ink-muted">{doc.subtitle}</p>}
            </header>
          )}
          {doc.intro.map((paragraph, index) => (
            <p key={index} className="font-serif text-[15px] leading-7 text-ink-soft">
              {paragraph}
            </p>
          ))}
        </div>
      ) : null}

      {doc.clauses.map((clause) => (
        <section
          key={clause.number}
          id={`${idPrefix}-clause-${clause.number}`}
          data-clause={clause.number}
          aria-labelledby={`${idPrefix}-clause-title-${clause.number}`}
          className="scroll-mt-4 border-t border-line py-6"
        >
          <header className="flex items-baseline gap-4">
            <span aria-hidden="true" className="w-6 shrink-0 text-sm font-medium tabular-nums text-ink-muted">
              {clause.number}
            </span>
            <h4 id={`${idPrefix}-clause-title-${clause.number}`} className="text-base font-semibold leading-snug text-ink">
              <span className="sr-only">{t('legal.clause', 'Cláusula {{number}}', { number: clause.number })}. </span>
              {clause.title}
            </h4>
          </header>

          <div className="mt-3 space-y-3 sm:pl-10">
            {clause.items.map((item, index) =>
              item.kind === 'term' ? (
                <dl key={index} className="grid gap-1 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-6">
                  <dt className="text-sm font-semibold text-ink">{item.label}</dt>
                  <dd className="font-serif text-[15px] leading-7 text-ink-soft">{item.text}</dd>
                </dl>
              ) : (
                <p key={index} className="font-serif text-[15px] leading-7 text-ink-soft">
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
