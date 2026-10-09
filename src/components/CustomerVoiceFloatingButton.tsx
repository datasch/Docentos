/**
 * Botón Flotante de Escucha Activa (`CustomerVoiceFloatingButton.tsx`)
 * DocentOS / Academia Giantucchi
 *
 * Acceso permanente y cercano para que cualquier estudiante pueda
 * expresar cómo se siente o enviar inquietudes en cualquier momento.
 */

import React from 'react';
import { HeartHandshake, Sparkles } from 'lucide-react';

interface CustomerVoiceFloatingButtonProps {
  onClick: () => void;
  unresolvedCount?: number;
}

export const CustomerVoiceFloatingButton: React.FC<CustomerVoiceFloatingButtonProps> = ({
  onClick,
  unresolvedCount = 0,
}) => {
  return (
    <div className="fixed bottom-6 right-6 z-40">
      <button
        onClick={onClick}
        aria-label="Abrir buzón de escucha activa"
        className="group relative flex items-center gap-2.5 px-4 py-3 rounded-full bg-slate-900/90 hover:bg-slate-800 text-white border border-cyan-500/40 shadow-xl shadow-cyan-950/50 backdrop-blur-md transition-all duration-300 hover:scale-105 hover:shadow-cyan-500/25 active:scale-95 cursor-pointer"
      >
        {/* Glow animado */}
        <div className="absolute -inset-0.5 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 opacity-30 group-hover:opacity-75 blur-sm transition duration-300 pointer-events-none" />

        <div className="relative flex items-center justify-center w-7 h-7 rounded-full bg-gradient-to-tr from-cyan-500 to-blue-600 text-slate-950 font-bold shadow-md shadow-cyan-500/30">
          <HeartHandshake className="w-4 h-4 text-white" />
          {/* Pulso discreto */}
          <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping opacity-75" />
          <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-cyan-400" />
        </div>

        <div className="relative flex flex-col text-left pr-1">
          <div className="flex items-center gap-1.5 text-xs font-bold text-white tracking-tight">
            <span>Te escuchamos</span>
            <Sparkles className="w-3 h-3 text-cyan-400" />
          </div>
          <span className="text-[10px] text-cyan-300/80 font-medium -mt-0.5">
            ¿Cómo te sientes hoy?
          </span>
        </div>

        {unresolvedCount > 0 && (
          <span className="relative ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-cyan-500 text-slate-950">
            {unresolvedCount}
          </span>
        )}
      </button>
    </div>
  );
};
