import React, { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface ExpandableDescriptionProps {
  text: string;
  /** Clases del párrafo, sin márgenes ni recorte de líneas. */
  className: string;
  /** Recorte de líneas mientras está plegado (p. ej. `line-clamp-2`). */
  clampClassName: string;
  /** Márgenes y ancho del bloque completo (párrafo + botón). */
  wrapperClassName?: string;
}

/**
 * Descripción de curso recortada a unas pocas líneas, con «Ver más» / «Ver menos».
 *
 * El botón solo aparece cuando el texto de verdad está cortado (se mide, no se
 * adivina por la cantidad de caracteres) y no abre el curso: las tarjetas del
 * catálogo son clicables, así que el clic y las teclas Enter/Espacio del botón
 * no deben llegar a la tarjeta.
 */
export const ExpandableDescription: React.FC<ExpandableDescriptionProps> = ({
  text,
  className,
  clampClassName,
  wrapperClassName = '',
}) => {
  const { t } = useTranslation();
  const id = useId();
  const paragraph = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(false);

  // Un texto distinto empieza plegado.
  useEffect(() => setExpanded(false), [text]);

  useEffect(() => {
    const element = paragraph.current;
    if (!element || expanded) return;
    const measure = () => setOverflowing(element.scrollHeight - element.clientHeight > 1);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    // El ancho cambia al girar el móvil o redimensionar: el recorte cambia con él.
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [text, expanded, clampClassName]);

  return (
    <div className={wrapperClassName}>
      <p id={id} ref={paragraph} className={`${className} ${expanded ? '' : clampClassName}`}>
        {text}
      </p>
      {(overflowing || expanded) && (
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={id}
          onClick={(event) => {
            event.stopPropagation();
            setExpanded((value) => !value);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') event.stopPropagation();
          }}
          className="mt-1 inline-flex min-h-8 items-center rounded-md px-1 -ml-1 text-xs font-semibold text-brand-cyan hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-cyan dark:text-brand-cyan"
        >
          {expanded ? t('catalog.seeLess', 'Ver menos') : t('catalog.seeMore', 'Ver más')}
        </button>
      )}
    </div>
  );
};
