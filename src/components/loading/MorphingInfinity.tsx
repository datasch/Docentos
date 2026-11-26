/**
 * Indicador de carga «morphing-infinity» de loading-ui
 * (https://www.loading-ui.com · https://github.com/turbostarter/loading-ui).
 *
 * MIT License
 *
 * Copyright (c) 2026 Bartosz Zagrodzki
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 *
 * Cambios de DocentOS: etiqueta en español y duración configurables y, si el
 * sistema pide reducir el movimiento, se muestra quieto (el símbolo de infinito).
 */
import React from 'react';
import { useTranslation } from 'react-i18next';

const circleA =
  'M 12 8 C 14.21 8 16 9.79 16 12 C 16 14.21 14.21 16 12 16 C 9.79 16 8 14.21 8 12 C 8 9.79 9.79 8 12 8 Z';

const infinity =
  'M 12 12 C 14 8.5 19 8.5 19 12 C 19 15.5 14 15.5 12 12 C 10 8.5 5 8.5 5 12 C 5 15.5 10 15.5 12 12 Z';

const circleB =
  'M 12 16 C 14.21 16 16 14.21 16 12 C 16 9.79 14.21 8 12 8 C 9.79 8 8 9.79 8 12 C 8 14.21 9.79 16 12 16 Z';

interface MorphingInfinityProps extends React.ComponentProps<'svg'> {
  label?: string;
  /** Segundos por ciclo completo (círculo → infinito → círculo). El original usa 5. */
  duration?: number;
}

function MorphingInfinity({ label, duration = 5, ...props }: MorphingInfinityProps) {
  const { t } = useTranslation();
  const accessibleLabel = label ?? t('cargando', 'Cargando');
  const reduceMotion =
    typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      role="status"
      aria-label={accessibleLabel}
      {...props}
    >
      {reduceMotion ? (
        <path d={infinity} />
      ) : (
        <path d={circleA}>
          <animate
            attributeName="d"
            values={`${circleA};${infinity};${circleB};${infinity};${circleA}`}
            keyTimes="0;0.25;0.5;0.75;1"
            dur={`${duration}s`}
            calcMode="spline"
            keySplines="0.42 0 0.58 1;0.42 0 0.58 1;0.42 0 0.58 1;0.42 0 0.58 1"
            repeatCount="indefinite"
          />
        </path>
      )}
    </svg>
  );
}

export { MorphingInfinity };
