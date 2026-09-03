/**
 * Componente de Muro de Pago & Pase VIP
 * DocentOS LMS
 *
 * Muestra las opciones de pago seguro mediante Stripe Checkout
 * y la información de membresía institucional VIP.
 */

import React, { useState } from 'react';
import { Lock, Crown, CheckCircle2, ShieldCheck, CreditCard, Sparkles, Zap, RefreshCw, AlertCircle } from 'lucide-react';
import { api } from '../lib/api';
import { UserRole } from '../types';

interface PaywallModalProps {
  userRole: UserRole;
  courseTitle: string;
  courseId?: string;
  price: number;
  onPaymentSuccess: () => void;
  onVipActivated?: () => void;
}

export const PaywallModal: React.FC<PaywallModalProps> = ({
  userRole,
  courseTitle,
  courseId = 'course-giantucchi-mastery',
  price,
  onPaymentSuccess,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [devCheckoutData, setDevCheckoutData] = useState<{ paymentId: string; checkoutUrl: string } | null>(null);

  const handleCheckout = async () => {
    setIsProcessing(true);
    setErrorMessage(null);
    try {
      const res = await api.checkoutCourse(courseId);
      if (res.isDevSimulation && res.paymentId) {
        setDevCheckoutData({ paymentId: res.paymentId, checkoutUrl: res.checkoutUrl || '' });
        setIsProcessing(false);
        return;
      }
      if (res.checkoutUrl) {
        window.location.href = res.checkoutUrl;
      } else {
        setIsProcessing(false);
        onPaymentSuccess();
      }
    } catch (error: any) {
      console.error('Error al procesar checkout:', error);
      setErrorMessage(error.message || 'Error al conectar con la pasarela de pago');
      setIsProcessing(false);
    }
  };

  const handleConfirmDevPayment = async () => {
    if (!devCheckoutData) return;
    setIsProcessing(true);
    setErrorMessage(null);
    try {
      await api.simulateDevPayment(devCheckoutData.paymentId);
      setIsProcessing(false);
      setDevCheckoutData(null);
      onPaymentSuccess();
    } catch (error: any) {
      console.error('Error confirmando pago dev:', error);
      setErrorMessage(error.message || 'Error al completar el pago simulado');
      setIsProcessing(false);
    }
  };

  return (
    <div className="relative overflow-hidden rounded-xl bg-[#141420] border border-[#2d2d44] p-6 md:p-10 shadow-2xl text-white my-6">
      {/* Decorative Glow Elements */}
      <div className="absolute top-0 right-0 -mt-12 -mr-12 w-64 h-64 bg-[#06b6d4]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 -mb-12 -ml-12 w-64 h-64 bg-[#a855f7]/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 max-w-3xl mx-auto text-center space-y-6">
        {/* Header Icon & Title */}
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-xl bg-brand-gradient text-white mb-2 shadow-lg shadow-[#06b6d4]/20">
          <Lock className="w-8 h-8" />
        </div>

        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#1a1a2e] border border-[#2d2d44] text-[#06b6d4] text-xs font-bold uppercase tracking-wider mb-3">
            <Sparkles className="w-3.5 h-3.5 text-[#06b6d4]" /> Contenido Protegido - Matrícula Requerida
          </div>
          <h2 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
            Acceso a {courseTitle}
          </h2>
          <p className="text-slate-400 text-sm md:text-base mt-2 max-w-2xl mx-auto">
            Adquiere tu matrícula individual para desbloquear todas las lecciones en alta definición,
            descarga de recursos exclusivos y emisión de certificado oficial al completar el programa.
          </p>
        </div>

        {errorMessage && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-xs text-red-300 flex items-center justify-center gap-2 max-w-md mx-auto">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Benefits Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left bg-[#1a1a2e] p-5 rounded-xl border border-[#2d2d44] my-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-[#06b6d4] shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-white">Streaming Protegido HD</p>
              <p className="text-xs text-slate-400">Videos de alta resolución con enlaces seguros y reproductor sin interrupciones.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-[#06b6d4] shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-white">Material y Recursos Descargables</p>
              <p className="text-xs text-slate-400">Guías, plantillas de código y archivos complementarios protegidos.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-[#06b6d4] shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-white">Certificado Oficial Verificable</p>
              <p className="text-xs text-slate-400">Diploma persistente con código público de validación para tu currículum.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-[#06b6d4] shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-white">Bandeja de Mentoría Directa</p>
              <p className="text-xs text-slate-400">Consultas prioritarias respondidas directamente por el equipo docente.</p>
            </div>
          </div>
        </div>

        {/* Development Simulation Card (when Stripe live keys are not set) */}
        {devCheckoutData ? (
          <div className="bg-[#1a1a2e] border-2 border-[#06b6d4] rounded-xl p-6 text-left space-y-4 max-w-md mx-auto shadow-2xl animate-fade-in">
            <div className="flex items-center gap-2 text-[#06b6d4] font-bold text-sm border-b border-[#2d2d44] pb-3">
              <CreditCard className="w-5 h-5" /> Entorno de Desarrollo • Stripe Mock Activo
            </div>
            <p className="text-xs text-slate-300">
              Se ha generado la sesión de pago <span className="font-mono text-[#06b6d4]">{devCheckoutData.paymentId}</span> en estado <span className="font-semibold text-amber-400">PENDING</span>.
            </p>
            <p className="text-xs text-slate-400">
              Al confirmar, el sistema disparará el evento de webhook <code className="text-[#06b6d4]">checkout.session.completed</code> con idempotencia real y activará tu matrícula.
            </p>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setDevCheckoutData(null)}
                className="flex-1 py-2.5 px-3 rounded-lg bg-[#0a0a0f] border border-[#2d2d44] text-xs font-semibold text-slate-300 hover:text-white"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmDevPayment}
                disabled={isProcessing}
                className="flex-1 btn-brand-primary py-2.5 px-3 text-xs font-extrabold flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isProcessing ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Zap className="w-4 h-4 fill-white" />
                    Acreditar Pago
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch pt-2">
            {/* Option 1: Stripe Checkout */}
            <div className="bg-[#1a1a2e] border border-[#2d2d44] rounded-xl p-5 flex flex-col justify-between hover:border-[#06b6d4] transition-all text-left shadow-lg">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Matrícula Completa</span>
                  <span className="text-xs bg-[#3b82f6]/20 text-[#3b82f6] px-2 py-0.5 rounded-lg font-bold border border-[#3b82f6]/30">Pago Único</span>
                </div>
                <div className="text-3xl font-black text-white mb-1">
                  ${price} <span className="text-xs text-slate-400 font-normal">USD</span>
                </div>
                <p className="text-xs text-slate-400 mb-4">Acceso inmediato con pasarela segura Stripe Checkout.</p>
              </div>

              <button
                onClick={handleCheckout}
                disabled={isProcessing}
                className="w-full py-3 px-4 rounded-lg bg-[#3b82f6] hover:bg-[#3b82f6]/90 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-[#3b82f6]/25 transition-all disabled:opacity-50"
              >
                {isProcessing ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <CreditCard className="w-4 h-4" />
                    Pagar con Stripe (${price} USD)
                  </>
                )}
              </button>
            </div>

            {/* Option 2: VIP / Institutional Access */}
            <div className="bg-[#1a1a2e] border border-[#a855f7]/50 rounded-xl p-5 flex flex-col justify-between text-left relative overflow-hidden shadow-lg">
              <div className="absolute top-2 right-2 bg-brand-gradient text-white font-extrabold text-[10px] px-2.5 py-0.5 rounded-lg shadow-sm">
                INSTITUCIONAL
              </div>
              <div>
                <div className="flex items-center gap-1.5 text-[#eab308] text-xs font-bold mb-2">
                  <Crown className="w-4 h-4" /> PASE VIP O ASIGNACIÓN
                </div>
                <div className="text-xl font-bold text-white mb-1">
                  Membresía Institucional
                </div>
                <p className="text-xs text-slate-300 mb-4">
                  Las becas, pases VIP y cuentas corporativas se asignan de forma directa por el director o administrador desde el panel institucional.
                </p>
              </div>

              <div className="p-3 bg-[#0a0a0f] rounded-lg border border-[#2d2d44] text-[11px] text-slate-400 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#a855f7] shrink-0" />
                <span>Si tienes un código o asignación pendiente, contacta al soporte docente.</span>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-center gap-2 text-xs text-slate-400 pt-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          Encriptación SSL de 256 bits • Pasarela verificada Stripe
        </div>
      </div>
    </div>
  );
};
