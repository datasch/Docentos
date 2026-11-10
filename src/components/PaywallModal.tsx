/**
 * Componente de Muro de Pago & Pase Mentee
 * DocentOS LMS
 *
 * Muestra las opciones de pago seguro mediante Stripe Checkout
 * y la información de membresía institucional VIP.
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Lock, Crown, CheckCircle2, ShieldCheck, CreditCard, Sparkles, Zap, RefreshCw, AlertCircle, BookOpen, GraduationCap } from 'lucide-react';
import { siteConfig } from '../config/theme';
import { api } from '../lib/api';
import { UserRole } from '../types';
import { useBodyScrollLock } from '../lib/useBodyScrollLock';

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
  const { t } = useTranslation();
  useBodyScrollLock(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [devCheckoutData, setDevCheckoutData] = useState<{ paymentId: string; checkoutUrl: string } | null>(null);

  if (userRole === 'MENTEE') {
    return (
      <div className="relative overflow-hidden rounded-xl bg-surface border border-line p-6 md:p-10 shadow-2xl text-ink my-6 text-center space-y-6">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-xl bg-purple-600/20 text-brand-violet-light border border-purple-500/30 mb-2">
          <GraduationCap className="w-8 h-8" />
        </div>
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/30 text-brand-violet-light text-xs font-bold uppercase tracking-wider mb-3">
            <Sparkles className="w-3.5 h-3.5 text-brand-violet-light" /> {t('paywall.menteeTag', 'Cuenta Mentee • Sin Cobros')}
          </div>
          <h2 className="text-2xl md:text-3xl font-extrabold text-ink tracking-tight">
            {t('paywall.menteeTitle', 'Acceso gestionado por mentoría')}
          </h2>
          <p className="text-ink-muted text-sm md:text-base mt-2 max-w-xl mx-auto">
            {t('paywall.menteeDesc', { title: courseTitle, defaultValue: `Los usuarios con rol de Mentee no requieren pagar matrículas en la plataforma. Tu acceso al programa "${courseTitle}" es habilitado directamente por tu mentor asignado o la administración.` })}
          </p>
        </div>
        <div className="p-4 bg-raised rounded-xl border border-line max-w-md mx-auto text-sm text-ink-soft flex items-center justify-center gap-2">
          <ShieldCheck className="w-5 h-5 text-brand-violet-light shrink-0" />
          <span>{t('paywall.menteeContact', 'Comunícate con tu mentor para activar este curso en tu plan.')}</span>
        </div>
      </div>
    );
  }

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
        // Ninguna respuesta válida llega sin enlace de pago: antes se cerraba el
        // muro como si se hubiera pagado y el alumno creía estar matriculado.
        setIsProcessing(false);
        setErrorMessage('No se pudo iniciar el pago. Inténtalo de nuevo en unos minutos.');
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
    <div className="relative overflow-hidden rounded-xl bg-surface border border-line p-6 md:p-10 shadow-2xl text-white my-6">
      {/* Decorative Glow Elements */}
      <div className="absolute top-0 right-0 -mt-12 -mr-12 w-64 h-64 bg-brand-cyan/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 -mb-12 -ml-12 w-64 h-64 bg-brand-purple/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 max-w-3xl mx-auto text-center space-y-6">
        {/* Header Icon & Title */}
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-xl bg-brand-gradient text-on-brand mb-2 shadow-lg shadow-brand-cyan/20">
          <Lock className="w-8 h-8" />
        </div>

        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-raised border border-line text-brand-cyan text-xs font-bold uppercase tracking-wider mb-3">
            <Sparkles className="w-3.5 h-3.5 text-brand-cyan" /> {t('paywall.protectedContent', 'Contenido Protegido - Matrícula Requerida')}
          </div>
          <h2 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
            {t('paywall.accessTo', { title: courseTitle, defaultValue: `Acceso a ${courseTitle}` })}
          </h2>
          <p className="text-slate-400 text-sm md:text-base mt-2 max-w-2xl mx-auto">
            {t('paywall.paywallDesc', 'Adquiere tu matrícula individual para desbloquear todas las lecciones en alta definición, descarga de recursos exclusivos y emisión de certificado oficial al completar el programa.')}
          </p>
        </div>

        {errorMessage && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-xs text-red-300 flex items-center justify-center gap-2 max-w-md mx-auto">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Benefits Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left bg-raised p-5 rounded-xl border border-line my-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-brand-cyan shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-white">{t('paywall.benefit1Title', 'Streaming Protegido HD')}</p>
              <p className="text-xs text-slate-400">{t('paywall.benefit1Desc', 'Videos de alta resolución con enlaces seguros y reproductor sin interrupciones.')}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-brand-cyan shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-white">{t('paywall.benefit2Title', 'Material y Recursos Descargables')}</p>
              <p className="text-xs text-slate-400">{t('paywall.benefit2Desc', 'Guías, plantillas de código y archivos complementarios protegidos.')}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-brand-cyan shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-white">{t('paywall.benefit3Title', 'Certificado Oficial Verificable')}</p>
              <p className="text-xs text-slate-400">{t('paywall.benefit3Desc', 'Diploma persistente con código público de validación para tu currículum.')}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-brand-cyan shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-white">{t('paywall.benefit4Title', 'Bandeja de Mentoría Directa')}</p>
              <p className="text-xs text-slate-400">{t('paywall.benefit4Desc', 'Consultas prioritarias respondidas directamente por el equipo docente.')}</p>
            </div>
          </div>
        </div>

        {/* Development Simulation Card (when Stripe live keys are not set) */}
        {devCheckoutData ? (
          <div className="bg-raised border-2 border-brand-cyan rounded-xl p-6 text-left space-y-4 max-w-md mx-auto shadow-2xl animate-fade-in">
            <div className="flex items-center gap-2 text-brand-cyan font-bold text-sm border-b border-line pb-3">
              <CreditCard className="w-5 h-5" /> Entorno de Desarrollo • Stripe Mock Activo
            </div>
            <p className="text-xs text-slate-300">
              Se ha generado la sesión de pago <span className="font-mono text-brand-cyan">{devCheckoutData.paymentId}</span> en estado <span className="font-semibold text-amber-400">PENDING</span>.
            </p>
            <p className="text-xs text-slate-400">
              Al confirmar, el sistema disparará el evento de webhook <code className="text-brand-cyan">checkout.session.completed</code> con idempotencia real y activará tu matrícula.
            </p>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setDevCheckoutData(null)}
                className="flex-1 py-2.5 px-3 rounded-lg bg-canvas border border-line text-xs font-semibold text-slate-300 hover:text-white"
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
            <div className="bg-raised border border-line rounded-xl p-5 flex flex-col justify-between hover:border-brand-cyan transition-all text-left shadow-lg">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t('paywall.fullTuition', 'Matrícula Completa')}</span>
                  <span className="text-xs bg-brand-blue/20 text-brand-blue px-2 py-0.5 rounded-lg font-bold border border-brand-blue/30">{t('paywall.oneTimePayment', 'Pago Único')}</span>
                </div>
                <div className="text-3xl font-black text-white mb-1">
                  ${price} <span className="text-xs text-slate-400 font-normal">USD</span>
                </div>
                <p className="text-xs text-slate-400 mb-4">{t('paywall.immediateAccess', 'Acceso inmediato con pasarela segura Stripe Checkout.')}</p>
              </div>

              <button
                onClick={handleCheckout}
                disabled={isProcessing}
                className="w-full py-3 px-4 rounded-lg bg-brand-blue hover:bg-brand-blue/90 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-brand-blue/25 transition-all disabled:opacity-50"
              >
                {isProcessing ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <CreditCard className="w-4 h-4" />
                    {t('paywall.payWithStripe', { price, defaultValue: `Pagar con Stripe ($${price} USD)` })}
                  </>
                )}
              </button>
            </div>

            {/* Option 2: VIP / Institutional Access */}
            <div className="bg-raised border border-brand-purple/50 rounded-xl p-5 flex flex-col justify-between text-left relative overflow-hidden shadow-lg">
              <div className="absolute top-2 right-2 bg-brand-gradient text-on-brand font-extrabold text-[10px] px-2.5 py-0.5 rounded-lg shadow-sm">
                {t('paywall.institutional', 'INSTITUCIONAL')}
              </div>
              <div>
                <div className="flex items-center gap-1.5 text-[#eab308] text-xs font-bold mb-2">
                  <Crown className="w-4 h-4" /> {t('paywall.menteePassOrAssigment', 'PASE MENTEE O ASIGNACIÓN')}
                </div>
                <div className="text-xl font-bold text-white mb-1">
                  {t('paywall.institutionalMembership', 'Membresía Institucional')}
                </div>
                <p className="text-xs text-slate-300 mb-4">
                  {t('paywall.institutionalDesc', 'Las becas, pases VIP y cuentas corporativas se asignan de forma directa por el director o administrador desde el panel institucional.')}
                </p>
              </div>

              <div className="p-3 bg-canvas rounded-lg border border-line text-[11px] text-slate-400 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-brand-purple shrink-0" />
                <span>{t('paywall.institutionalSupport', 'Si tienes un código o asignación pendiente, contacta al soporte docente.')}</span>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-center gap-2 text-xs text-slate-400 pt-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          {t('paywall.sslEncryption', 'Encriptación SSL de 256 bits • Pasarela verificada Stripe')}
        </div>

        {siteConfig.complaintsBookUrl && (
          <a
            href={siteConfig.complaintsBookUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-1.5 text-xs text-slate-400 underline-offset-4 hover:text-white hover:underline"
          >
            <BookOpen aria-hidden className="w-3.5 h-3.5" />
            {t('paywall.complaintsBook', 'Libro de Reclamaciones')}
          </a>
        )}
      </div>
    </div>
  );
};
