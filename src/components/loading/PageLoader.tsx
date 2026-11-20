/** Carga de un módulo o pantalla: el mismo símbolo que el reproductor, centrado y con su etiqueta. */
import React from 'react';
import { MorphingInfinity } from './MorphingInfinity';

export const PageLoader: React.FC<{ label: string; className?: string }> = ({ label, className = '' }) => (
  <div className={`page-loader ${className}`} role="status" aria-live="polite">
    <MorphingInfinity label={label} duration={2.4} aria-hidden="true" />
    <p>{label}</p>
  </div>
);
