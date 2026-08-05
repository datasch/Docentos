/**
 * Componente de Muro de Pago & Pase VIP
 * Academia Giantucchi
 *
 * Muestra las opciones de pago (Stripe) y el Bypass VIP para acceso inmediato
 */

import React, { useState } from 'react';
import { Lock, Crown, CheckCircle2, ShieldCheck, CreditCard, Sparkles, ArrowRight, Zap, RefreshCw } from 'lucide-react';
import { api } from '../lib/api';
import { UserRole } from '../types';

interface PaywallModalProps {
  userRole: UserRole;
  courseTitle: string;
  price: number;
  onPaymentSuccess: () => void;
  onVipActivated: () => void;
}

export const PaywallModal: React.FC<PaywallModalProps> = ({
  userRole,
  courseTitle,
  price,
  onPaymentSuccess,
  onVipActivated,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [stripeView, setStripeView] = useState(false);
  const [cardNumber, setCardNumber] = useState('4242 •••• •••• 4242');
  const [cardHolder, setCardHolder] = useState('Estudiante Giantucchi');

  const handleCheckout = async () => {
    setIsProcessing(true);
    try {
      await api.checkoutCourse('course-giantucchi-mastery');
      setIsProcessing(false);
      onPaymentSuccess();
    } catch (error) {
      console.error(error);
      setIsProcessing(false);
    }
  };

  const handleActivateVip = async () => {
    setIsProcessing(true);
    try {
      await api.activateVipPass();
      setIsProcessing(false);
      onVipActivated();
    } catch (error) {
      console.error(error);
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
            <Sparkles className="w-3.5 h-3.5 text-[#06b6d4]" /> Muro de Pago Activo - Contenido Protegido
          </div>
          <h2 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
            Acceso Exclusivo a {courseTitle}
          </h2>
          <p className="text-slate-400 text-sm md:text-base mt-2 max-w-2xl mx-auto">
            Este módulo forma parte del programa avanzado de mentoría de la Academia Giantucchi.
            Adquiere tu pase de acceso o activa tu Pase VIP para desbloquear todos los contenidos.
          </p>
        </div>

        {/* Benefits Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left bg-[#1a1a2e] p-5 rounded-xl border border-[#2d2d44] my-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-[#06b6d4] shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-white">Streaming HD en Google Drive</p>
              <p className="text-xs text-slate-400">Videos de alta resolución alojados directamente en Google Drive sin interrupciones.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-[#06b6d4] shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-white">Mentoría Directa Giantucchi</p>
              <p className="text-xs text-slate-400">Caja de preguntas prioritarias responida personalmente por el equipo mentor.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-[#06b6d4] shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-white">Acceso De Por Vida</p>
              <p className="text-xs text-slate-400">Accede a las actualizaciones del temario y nuevos módulos sin costos adicionales.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-[#06b6d4] shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-white">Bypass VIP Incluido</p>
              <p className="text-xs text-slate-400">Socios VIP disfrutan de exención total de cuotas en toda la plataforma.</p>
            </div>
          </div>
        </div>

        {/* Payment Action Box */}
        {!stripeView ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch pt-2">
            
            {/* Option 1: External Purchase via Stripe */}
            <div className="bg-[#1a1a2e] border border-[#2d2d44] rounded-xl p-5 flex flex-col justify-between hover:border-[#06b6d4] transition-all text-left shadow-lg">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Acceso Externo</span>
                  <span className="text-xs bg-[#3b82f6]/20 text-[#3b82f6] px-2 py-0.5 rounded-lg font-bold border border-[#3b82f6]/30">Pago Único</span>
                </div>
                <div className="text-3xl font-black text-white mb-1">
                  ${price} <span className="text-xs text-slate-400 font-normal">USD</span>
                </div>
                <p className="text-xs text-slate-400 mb-4">Acceso inmediato con pasarela segura Stripe Checkout.</p>
              </div>

              <button
                onClick={() => setStripeView(true)}
                className="w-full py-3 px-4 rounded-lg bg-[#3b82f6] hover:bg-[#3b82f6]/90 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-[#3b82f6]/25 transition-all"
              >
                <CreditCard className="w-4 h-4" />
                Pagar Curso con Stripe (${price} USD)
              </button>
            </div>

            {/* Option 2: VIP Pass Bypass */}
            <div className="bg-[#1a1a2e] border border-[#a855f7]/50 rounded-xl p-5 flex flex-col justify-between text-left relative overflow-hidden shadow-lg">
              <div className="absolute top-2 right-2 bg-brand-gradient text-white font-extrabold text-[10px] px-2.5 py-0.5 rounded-lg shadow-sm">
                RECOMENDADO
              </div>
              <div>
                <div className="flex items-center gap-1.5 text-[#eab308] text-xs font-bold mb-2">
                  <Crown className="w-4 h-4" /> PASE VIP GIANTUCCHI
                </div>
                <div className="text-3xl font-black text-white mb-1">
                  $0 <span className="text-xs text-slate-300 font-normal">Bypass VIP</span>
                </div>
                <p className="text-xs text-slate-300 mb-4">
                  Salta la pasarela de pago al convertirte en Socio VIP Giantucchi.
                </p>
              </div>

              <button
                onClick={handleActivateVip}
                disabled={isProcessing}
                className="w-full btn-brand-primary py-3 px-4 text-sm flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isProcessing ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Zap className="w-4 h-4 fill-white text-white" />
                    Activar Pase VIP (Bypass Directo)
                  </>
                )}
              </button>
            </div>

          </div>
        ) : (
          /* Simulated Stripe Checkout View */
          <div className="bg-[#1a1a2e] border border-[#2d2d44] rounded-xl p-6 text-left space-y-4 max-w-md mx-auto shadow-2xl animate-fade-in">
            <div className="flex justify-between items-center border-b border-[#2d2d44] pb-3">
              <div className="flex items-center gap-2 text-[#06b6d4] font-bold text-sm">
                <CreditCard className="w-5 h-5" /> Pasarela de Pago Segura (Stripe)
              </div>
              <button
                onClick={() => setStripeView(false)}
                className="text-xs text-slate-400 hover:text-white"
              >
                Cancelar
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 font-medium block mb-1">Titular de la Tarjeta</label>
                <input
                  type="text"
                  value={cardHolder}
                  onChange={(e) => setCardHolder(e.target.value)}
                  className="w-full bg-[#0a0a0f] border border-[#2d2d44] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#06b6d4]"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 font-medium block mb-1">Número de Tarjeta</label>
                <input
                  type="text"
                  value={cardNumber}
                  onChange={(e) => setCardNumber(e.target.value)}
                  className="w-full bg-[#0a0a0f] border border-[#2d2d44] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#06b6d4]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 font-medium block mb-1">MM/AA</label>
                  <input
                    type="text"
                    defaultValue="12/28"
                    className="w-full bg-[#0a0a0f] border border-[#2d2d44] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#06b6d4]"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 font-medium block mb-1">CVC</label>
                  <input
                    type="text"
                    defaultValue="888"
                    className="w-full bg-[#0a0a0f] border border-[#2d2d44] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#06b6d4]"
                  />
                </div>
              </div>
            </div>

            <button
              onClick={handleCheckout}
              disabled={isProcessing}
              className="w-full mt-2 btn-brand-primary py-3 text-sm flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isProcessing ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  Pagar Curso (${price} USD)
                </>
              )}
            </button>
          </div>
        )}

        <div className="flex items-center justify-center gap-2 text-xs text-slate-400 pt-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          Encriptación SSL de 256 bits • Garantía de Devolución Giantucchi
        </div>

      </div>
    </div>
  );
};
