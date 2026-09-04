import React from 'react';

interface ProgressMeterProps {
  /** Porcentaje completado, 0-100. */
  value: number;
  /** Etiqueta accesible; describe de que es el progreso. */
  label: string;
  /**
   * 'spectrum' descubre el gradiente de marca completo conforme se avanza y se
   * reserva al progreso del curso, que es la unica pista lo bastante ancha para
   * que las seis paradas se distingan. 'accent' pinta un cian plano y es lo que
   * usan las barras de cada modulo.
   */
  tone?: 'spectrum' | 'accent';
  className?: string;
}

/**
 * Barra de progreso.
 *
 * El relleno no escala el gradiente dentro de su ancho —eso mostraria los seis
 * colores desde el 1%— sino que recorta con clip-path un gradiente que siempre
 * ocupa la pista entera. Avanzar destapa espectro: al 100% se ve la marca
 * completa, y eso es exactamente lo que significa terminar el curso.
 */
export const ProgressMeter: React.FC<ProgressMeterProps> = ({
  value,
  label,
  tone = 'spectrum',
  className = '',
}) => {
  const pct = Math.max(0, Math.min(100, Math.round(value)));

  return (
    <div
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={`relative h-1.5 w-full overflow-hidden rounded-full bg-line ${className}`}
    >
      <div
        className={`absolute inset-0 transition-[clip-path] duration-500 ease-out ${
          tone === 'spectrum' ? 'bg-brand-gradient' : 'bg-brand-cyan'
        }`}
        style={{ clipPath: `inset(0 ${100 - pct}% 0 0)` }}
      />
    </div>
  );
};
