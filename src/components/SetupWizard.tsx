import React, { useState } from 'react';
import { Shield, Sparkles, CheckCircle2, Lock, User, Mail, Building, ArrowRight, Server, Globe } from 'lucide-react';

interface SetupWizardProps {
  onSetupComplete: (user: any, appName: string) => void;
}

export const SetupWizard: React.FC<SetupWizardProps> = ({ onSetupComplete }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [appName, setAppName] = useState('DocentOS');
  const [consentTelemetry, setConsentTelemetry] = useState(true);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!name.trim() || !email.trim() || !password.trim() || !appName.trim()) {
      setErrorMessage('Por favor completa todos los campos del formulario.');
      return;
    }

    if (!consentTelemetry) {
      setErrorMessage('Debes aceptar el consentimiento de registro para finalizar la instalación.');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          password: password.trim(),
          appName: appName.trim(),
          consentTelemetry,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al completar la instalación inicial.');
      }

      // Success
      onSetupComplete(data.user, data.appName || appName);
    } catch (error: any) {
      setErrorMessage(error.message || 'Ocurrió un error inesperado al configurar la instancia.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white flex items-center justify-center p-4 sm:p-6 lg:p-8 animate-fade-in">
      <div className="w-full max-w-xl space-y-6">
        
        {/* Header Badge & Title */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#1a1a2e] border border-[#2d2d44] text-[#06b6d4] text-xs font-bold uppercase tracking-wider shadow-md">
            <Sparkles className="w-4 h-4 text-[#06b6d4]" />
            First Run Setup Guard • DocentOS
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Asistente de Instalación Inicial
          </h1>
          <p className="text-sm text-slate-400 max-w-md mx-auto">
            Configura el superadministrador inicial y establece la identidad de tu instancia de DocentOS en menos de 1 minuto.
          </p>
        </div>

        {/* Form Container */}
        <div className="bg-[#141420] border border-[#2d2d44] rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
          
          {errorMessage && (
            <div className="p-4 bg-red-500/10 border border-red-500/30 text-red-400 text-xs rounded-xl flex items-center gap-2">
              <Shield className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Academy Name */}
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                Nombre de la Academia / Instancia DocentOS
              </label>
              <div className="relative">
                <Building className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  required
                  placeholder="Ej. DocentOS Academy"
                  value={appName}
                  onChange={(e) => setAppName(e.target.value)}
                  className="w-full bg-[#0a0a0f] border border-[#2d2d44] rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#06b6d4] transition-colors"
                />
              </div>
            </div>

            {/* Admin Full Name */}
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                Nombre Completo del Administrador
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  required
                  placeholder="Ej. Jose Luis Hernandez"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-[#0a0a0f] border border-[#2d2d44] rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#06b6d4] transition-colors"
                />
              </div>
            </div>

            {/* Admin Email */}
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                Correo Electrónico del Administrador
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="email"
                  required
                  placeholder="admin@tu-academia.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-[#0a0a0f] border border-[#2d2d44] rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#06b6d4] transition-colors"
                />
              </div>
            </div>

            {/* Admin Password */}
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                Contraseña Segura de Acceso
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="password"
                  required
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#0a0a0f] border border-[#2d2d44] rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#06b6d4] transition-colors"
                />
              </div>
            </div>

            {/* Telemetry Consent Checkbox */}
            <div className="pt-2">
              <label className="flex items-start gap-3 p-3.5 rounded-xl bg-[#0a0a0f] border border-[#2d2d44] cursor-pointer hover:border-[#06b6d4]/50 transition-colors">
                <input
                  type="checkbox"
                  checked={consentTelemetry}
                  onChange={(e) => setConsentTelemetry(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-[#2d2d44] bg-[#141420] text-[#06b6d4] focus:ring-[#06b6d4] accent-[#06b6d4]"
                />
                <span className="text-xs text-slate-300 leading-relaxed">
                  Registrar mi instancia de DocentOS para emitir la licencia comunitaria gratuita y recibir actualizaciones de seguridad.
                </span>
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full btn-brand-primary py-3 px-6 text-sm font-extrabold flex items-center justify-center gap-2 shadow-lg shadow-[#06b6d4]/20 transition-all disabled:opacity-50 mt-4"
            >
              {isSubmitting ? (
                <>
                  <Server className="w-4 h-4 animate-spin" />
                  Inicializando Sistema y Telemetría...
                </>
              ) : (
                <>
                  Finalizar Instalación y Crear Superadmin
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Infrastructure Specs Footer */}
          <div className="pt-4 border-t border-[#2d2d44] flex items-center justify-between text-[11px] text-slate-400">
            <span className="flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5 text-[#06b6d4]" /> PostgreSQL + Express API
            </span>
            <span className="flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-[#a855f7]" /> Open Source MIT License
            </span>
          </div>
        </div>

        {/* Footer Attribution */}
        <p className="text-center text-xs text-slate-500">
          Powered by <strong className="text-white">DocentOS</strong> • Built by Giantucchi
        </p>
      </div>
    </div>
  );
};
