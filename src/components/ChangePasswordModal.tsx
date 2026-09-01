import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, Lock, X } from 'lucide-react';
import { api } from '../lib/api';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onChanged: (message: string) => void;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({
  isOpen,
  onClose,
  onChanged,
}) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setError(null);
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (newPassword.length < 8) {
      setError('La nueva contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Las contraseñas nuevas no coinciden.');
      return;
    }

    setLoading(true);
    try {
      const response = await api.changePassword(currentPassword, newPassword);
      onChanged(response.message);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se pudo cambiar la contraseña.');
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[110] bg-black/85 backdrop-blur-md flex items-center justify-center p-4" onMouseDown={onClose}>
      <div
        className="relative w-full max-w-md rounded-2xl border border-[#262626] bg-[#0a0a0f] p-6 shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="change-password-title"
      >
        <button type="button" onClick={onClose} className="absolute right-4 top-4 p-2 text-slate-400 hover:text-white" aria-label="Cerrar">
          <X className="h-4 w-4" />
        </button>
        <h2 id="change-password-title" className="text-xl font-extrabold text-white">Cambiar Contraseña</h2>
        <p className="mt-1 text-xs text-slate-400">Al guardar se cerrarán todas las sesiones por seguridad.</p>

        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">
            <AlertCircle className="h-4 w-4 shrink-0" /> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {[
            { label: 'Contraseña actual', value: currentPassword, setter: setCurrentPassword, autoComplete: 'current-password' },
            { label: 'Nueva contraseña', value: newPassword, setter: setNewPassword, autoComplete: 'new-password' },
            { label: 'Confirmar nueva contraseña', value: confirmPassword, setter: setConfirmPassword, autoComplete: 'new-password' },
          ].map((field) => (
            <label key={field.label} className="block text-[11px] font-bold uppercase tracking-wider text-slate-300">
              {field.label}
              <span className="relative mt-1 block">
                <Lock className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
                <input
                  type="password"
                  value={field.value}
                  onChange={(event) => field.setter(event.target.value)}
                  autoComplete={field.autoComplete}
                  minLength={field.label === 'Contraseña actual' ? 1 : 8}
                  required
                  className="w-full rounded-xl border border-[#262626] bg-black py-2.5 pl-10 pr-4 text-xs text-white outline-none focus:border-[#06b6d4]"
                />
              </span>
            </label>
          ))}
          <button type="submit" disabled={loading} className="btn-brand-primary w-full py-3 text-sm font-extrabold disabled:opacity-60">
            {loading ? 'Guardando...' : 'Cambiar Contraseña'}
          </button>
        </form>
      </div>
    </div>,
    document.body,
  );
};
