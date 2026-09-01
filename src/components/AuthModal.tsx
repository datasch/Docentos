/**
 * Componente Modal de Autenticación (Login & Registro)
 * Academia Giantucchi
 *
 * Soporta:
 * - Tarjeta flotante minimalista en tema oscuro (#000000, superficies #0a0a0f, bordes #262626)
 * - Campos de email / password con validación
 * - Selección de rol (Público General, Solicitud Mentee, Mentor)
 * - Redirección inteligente al autenticarse
 */

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Lock, Mail, User as UserIcon, Shield, Sparkles, X, ArrowRight, CheckCircle, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { User, UserRole } from '../types';

interface AuthModalProps {
  isOpen: boolean;
  initialMode?: 'login' | 'register';
  onClose: () => void;
  onSuccess: (user: User, redirectPath: string) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  initialMode = 'login',
  onClose,
  onSuccess,
}) => {
  const { t } = useTranslation();
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  
  // Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole>('PUBLIC_USER');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setError(null);
    }
  }, [initialMode, isOpen]);

  useEffect(() => {
    if (!isOpen) return;

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === 'login') {
        if (!email.trim() || !password) {
          throw new Error('Ingresa tu email y contraseña');
        }
        const res = await api.login(email.trim(), password);
        onSuccess(res.user, res.redirectPath);
        onClose();
      } else {
        if (!name.trim() || !email.trim() || !password) {
          throw new Error('Todos los campos son obligatorios');
        }
        if (password.length < 4) {
          throw new Error('La contraseña debe tener al menos 4 caracteres');
        }
        const res = await api.register(name.trim(), email.trim(), password, selectedRole);
        onSuccess(res.user, res.redirectPath);
        onClose();
      }
    } catch (err: any) {
      setError(err.message || 'Error al autenticar');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoFill = (role: UserRole) => {
    setError(null);
    if (role === 'ADMIN') {
      setEmail('giantucchi@academia.com');
      setPassword('admin123');
      setName('Prof. Giantucchi');
    } else if (role === 'MENTOR') {
      setEmail('sofia.mentor@giantucchi.com');
      setPassword('mentor123');
      setName('Ing. Sofia Ruiz');
    } else if (role === 'MENTEE') {
      setEmail('carlos.vip@giantucchi.com');
      setPassword('vip123');
      setName('Carlos Mendoza');
    } else {
      setEmail('estudiante@gmail.com');
      setPassword('user123');
      setName('Ana Silva');
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[100] overflow-y-auto overscroll-contain bg-black/85 backdrop-blur-md animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <div className="flex min-h-full items-center justify-center p-4 sm:p-6" onMouseDown={onClose}>
        <div
          className="relative my-auto max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto overscroll-contain bg-[#0a0a0f] border border-[#262626] rounded-2xl shadow-2xl p-6 sm:p-8"
          onMouseDown={(event) => event.stopPropagation()}
        >
        
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white bg-[#141420] hover:bg-[#1a1a2e] rounded-full transition-colors"
          aria-label="Cerrar ventana de autenticación"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#06b6d4]/10 border border-[#06b6d4]/30 text-[#06b6d4] text-xs font-bold mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            <span>DocentOS Engine</span>
          </div>
          <h2 id="auth-modal-title" className="text-2xl font-extrabold text-white tracking-tight">
            {mode === 'login' ? 'Iniciar Sesión' : 'Crear Cuenta Institucional'}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {mode === 'login'
              ? 'Accede a tus programas de mentoría y clases grabadas'
              : 'Únete a la comunidad educativa de alto nivel'}
          </p>
        </div>

        {/* Mode Switcher Tabs */}
        <div className="grid grid-cols-2 gap-1 bg-[#141420] p-1 rounded-xl mb-6 border border-[#262626]">
          <button
            type="button"
            onClick={() => { setMode('login'); setError(null); }}
            className={`py-2 text-xs font-bold rounded-lg transition-all ${
              mode === 'login'
                ? 'bg-[#06b6d4] text-black shadow-lg font-extrabold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Iniciar Sesión
          </button>
          <button
            type="button"
            onClick={() => { setMode('register'); setError(null); }}
            className={`py-2 text-xs font-bold rounded-lg transition-all ${
              mode === 'register'
                ? 'bg-[#06b6d4] text-black shadow-lg font-extrabold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Registrarse
          </button>
        </div>

        {/* Error Notification */}
        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-2.5 text-red-400 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Auth Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <div>
              <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1">
                Nombre Completo
              </label>
              <div className="relative">
                <UserIcon className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej. Carlos Mendoza"
                  className="w-full pl-10 pr-4 py-2.5 bg-[#000000] border border-[#262626] focus:border-[#06b6d4] rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none transition-all"
                  required={mode === 'register'}
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1">
              Correo Electrónico
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com"
                className="w-full pl-10 pr-4 py-2.5 bg-[#000000] border border-[#262626] focus:border-[#06b6d4] rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none transition-all"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1">
              Contraseña
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-4 py-2.5 bg-[#000000] border border-[#262626] focus:border-[#06b6d4] rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none transition-all"
                required
              />
            </div>
          </div>

          {mode === 'register' && (
            <div>
              <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                Tipo de Membresía / Rol
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { role: 'PUBLIC_USER' as UserRole, label: 'Público General', sub: 'Acceso Catálogo' },
                  { role: 'MENTEE' as UserRole, label: 'Mentee VIP', sub: 'Pase Directo' },
                  { role: 'MENTOR' as UserRole, label: 'Mentor Tutor', sub: 'Panel Docente' },
                ].map((item) => (
                  <button
                    key={item.role}
                    type="button"
                    onClick={() => setSelectedRole(item.role)}
                    className={`p-2 rounded-xl text-left border transition-all ${
                      selectedRole === item.role
                        ? 'bg-[#06b6d4]/10 border-[#06b6d4] text-white'
                        : 'bg-[#141420] border-[#262626] text-slate-400 hover:text-white'
                    }`}
                  >
                    <div className="text-[10px] font-bold">{item.label}</div>
                    <div className="text-[9px] text-slate-500">{item.sub}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-gradient-to-r from-[#06b6d4] to-[#a855f7] hover:opacity-90 text-black font-extrabold rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 mt-2"
          >
            {loading ? (
              <span className="animate-pulse">Procesando...</span>
            ) : (
              <>
                <span>{mode === 'login' ? 'Entrar a la Academia' : 'Completar Registro'}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Quick Demo Autofill Section */}
        <div className="mt-6 pt-5 border-t border-[#262626]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Cargar Credenciales de Prueba (Demo RBAC)
            </span>
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {[
              { role: 'ADMIN' as UserRole, label: 'Admin', color: 'hover:border-[#06b6d4] text-[#06b6d4]' },
              { role: 'MENTOR' as UserRole, label: 'Mentor', color: 'hover:border-[#a855f7] text-[#a855f7]' },
              { role: 'MENTEE' as UserRole, label: 'Mentee', color: 'hover:border-emerald-400 text-emerald-400' },
              { role: 'PUBLIC_USER' as UserRole, label: 'Público', color: 'hover:border-slate-400 text-slate-300' },
            ].map((btn) => (
              <button
                key={btn.role}
                type="button"
                onClick={() => handleDemoFill(btn.role)}
                className={`py-1.5 bg-[#141420] border border-[#262626] rounded-lg text-[10px] font-bold transition-all ${btn.color}`}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>

        </div>
      </div>
    </div>,
    document.body,
  );
};
