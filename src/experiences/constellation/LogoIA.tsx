import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import {
  EstadoIA,
  EvaluatorId,
  DEFAULT_EVALUATOR_ID,
  InstanciaIA,
  celebrar,
  crearLogo,
  destruirLogo,
  estado as ponerEstado,
  senal,
  silaba,
  toque,
} from './logoIA';

export type { EstadoIA, EvaluatorId };

export interface LogoIAHandle {
  senal: () => void;
  toque: () => void;
  silaba: () => void;
  celebrar: (ms?: number) => void;
}

interface LogoIAProps {
  /** Evaluador que acompaña: tiñe el halo y gira la rueda hacia su color. */
  quien?: EvaluatorId;
  estado?: EstadoIA;
  /** Sin luz ambiente: cabeceras, tarjetas de voz, camino de islas. */
  chico?: boolean;
  /** Dentro de una esfera de vidrio teñida con el color del evaluador. */
  orbe?: boolean;
  /** Las tarjetas de voz no celebran con el resto de la etapa. */
  celebraConTodos?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * El logo de IA vivo «Prisma», el personaje que acompaña en la ruta.
 */
export const LogoIA = forwardRef<LogoIAHandle, LogoIAProps>(function LogoIA(
  { quien = DEFAULT_EVALUATOR_ID, estado = 'reposo', chico = false, orbe = false, celebraConTodos = true, className = '', style }: LogoIAProps,
  ref
) {
  const serRef = useRef<HTMLDivElement>(null);
  const instRef = useRef<InstanciaIA | null>(null);

  useEffect(() => {
    if (!serRef.current) return;
    const inst = crearLogo(serRef.current, { grande: !chico, celebraConTodos });
    instRef.current = inst;
    return () => {
      destruirLogo(inst);
      instRef.current = null;
    };
  }, [chico, celebraConTodos]);

  useEffect(() => {
    if (instRef.current) ponerEstado(instRef.current, estado);
  }, [estado, chico, celebraConTodos]);

  useImperativeHandle(
    ref,
    () => ({
      senal: () => instRef.current && senal(instRef.current),
      toque: () => instRef.current && toque(instRef.current),
      silaba: () => instRef.current && silaba(instRef.current),
      celebrar: (ms?: number) => instRef.current && celebrar(instRef.current, ms),
    }),
    []
  );

  return (
    <div
      ref={serRef}
      className={`ser ${chico ? 'ser-chico' : ''} ${orbe ? 'orbe' : ''} ${className}`}
      data-quien={quien}
      aria-hidden="true"
      style={style}
    />
  );
});
