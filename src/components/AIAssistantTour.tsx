import React, { useState, useEffect } from 'react';
import { Sparkles, X, ChevronRight, Star, Send, Volume2, CheckCircle2, Bot, Compass } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ttsService } from '../lib/ttsService';
import { api } from '../lib/api';
import { siteConfig } from '../config/theme';

interface AIAssistantTourProps {
  onHighlightTab?: (tab: 'courses' | 'drive' | 'admin' | 'vip') => void;
  onClose?: () => void;
}

export const AIAssistantTour: React.FC<AIAssistantTourProps> = ({ onHighlightTab, onClose }) => {
  const { t } = useTranslation();
  const assistantName = siteConfig.assistantName;

  const [currentStep, setCurrentStep] = useState(0); // 0: Welcome, 1: Courses, 2: Drive Search, 3: Mentorship/VIP, 4: Feedback Modal
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const steps = [
    {
      id: 'welcome',
      tab: 'courses' as const,
      title: t('tour.welcomeTitle', { name: assistantName }),
      subtitle: t('tour.welcomeSubtitle'),
      audioText: `¡Hola! Soy ${assistantName}, tu asistente virtual de la Academia. Te acompañaré en este recorrido de 30 segundos para que conozcas los módulos clave.`,
    },
    {
      id: 'courses',
      tab: 'courses' as const,
      title: t('tour.step1Title'),
      subtitle: t('tour.step1Desc'),
      audioText: `En la pestaña de Cursos encontrarás todo el material de estudio organizado por módulos. Podrás ver videos, escuchar guías de voz y descargar recursos.`,
    },
    {
      id: 'drive',
      tab: 'drive' as const,
      title: t('tour.step2Title'),
      subtitle: t('tour.step2Desc'),
      audioText: `El Buscador de Google Drive te permite encontrar clases indexadas en tiempo real sin salir de la plataforma.`,
    },
    {
      id: 'vip',
      tab: 'vip' as const,
      title: t('tour.step3Title'),
      subtitle: t('tour.step3Desc'),
      audioText: `En la Zona VIP y Muro de Mentoría podrás hacer preguntas técnicas directamente a los profesores e interactuar con la comunidad.`,
    },
    {
      id: 'feedback',
      tab: 'courses' as const,
      title: t('tour.step4Title'),
      subtitle: t('tour.step4Desc'),
      audioText: `¡Excelente! Has completado el recorrido inicial. Por favor regálanos tu opinión para seguir mejorando la plataforma.`,
    },
  ];

  // Se marca como visto en cuanto se muestra: si el usuario cierra la pestaña a
  // medias, el tour no debe volver a lanzarse ni mover su ruta en el proximo acceso.
  useEffect(() => {
    localStorage.setItem('giantucchi_tour_completed', 'true');
  }, []);

  useEffect(() => {
    // Play voice greeting for step
    playStepVoice(currentStep);
    if (onHighlightTab && steps[currentStep]) {
      onHighlightTab(steps[currentStep].tab);
    }
  }, [currentStep]);

  const playStepVoice = (stepIndex: number) => {
    const stepData = steps[stepIndex];
    if (!stepData) return;

    setIsPlayingAudio(true);
    ttsService.speak({
      text: stepData.audioText,
      voiceId: 'es-ES-Carlos',
      speed: 1.05,
      onEnd: () => setIsPlayingAudio(false),
      onError: () => setIsPlayingAudio(false),
    });
  };

  const handleNextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleCloseTour = () => {
    ttsService.stop();
    localStorage.setItem('giantucchi_tour_completed', 'true');
    if (onClose) onClose();
  };

  const handleSubmitFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await api.submitFeedback({
        rating: feedbackRating,
        comment: feedbackComment,
      });
      setFeedbackSubmitted(true);
      setTimeout(() => {
        handleCloseTour();
      }, 2000);
    } catch (err) {
      console.error('Error submitting tour feedback:', err);
      handleCloseTour();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end max-w-sm sm:max-w-md w-full animate-fade-in pointer-events-auto">
      
      {/* JARVIS STYLE FLOATING DIALOG CARD */}
      <div className="bg-[#141420]/95 backdrop-blur-xl border border-[#06b6d4]/40 rounded-2xl p-5 shadow-2xl shadow-[#06b6d4]/20 text-white space-y-4 w-full relative overflow-hidden">
        
        {/* Glow Ring & Close Button */}
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-[#06b6d4]/20 rounded-full blur-2xl pointer-events-none" />
        
        <div className="flex items-center justify-between border-b border-[#2d2d44] pb-3">
          <div className="flex items-center gap-2.5">
            {/* Glowing Assistant Avatar */}
            <div className="relative">
              <div className={`w-9 h-9 rounded-full bg-brand-gradient p-0.5 shadow-lg ${isPlayingAudio ? 'ring-2 ring-[#06b6d4] animate-pulse' : ''}`}>
                <div className="w-full h-full bg-[#0a0a0f] rounded-full flex items-center justify-center">
                  <Bot className="w-5 h-5 text-[#06b6d4]" />
                </div>
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-[#06b6d4] rounded-full border-2 border-[#141420]" />
            </div>

            <div>
              <div className="flex items-center gap-1.5">
                <h4 className="font-extrabold text-xs text-white uppercase tracking-wider">{assistantName} AI</h4>
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#06b6d4]/10 text-[#06b6d4] border border-[#06b6d4]/30">
                  ONBOARDING
                </span>
              </div>
              <p className="text-[10px] text-slate-400">Asistente Virtual Interactivo</p>
            </div>
          </div>

          <button
            onClick={handleCloseTour}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-[#1a1a2e] transition-all"
            title={t('tour.skipTour')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* STEP CONTENT OR FEEDBACK MODAL */}
        {currentStep < 4 ? (
          <div className="space-y-3">
            <div>
              <h5 className="font-bold text-sm text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#eab308]" />
                {steps[currentStep].title}
              </h5>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                {steps[currentStep].subtitle}
              </p>
            </div>

            {/* Audio Waveform Equalizer */}
            <div className="bg-[#0a0a0f] p-2.5 rounded-xl border border-[#2d2d44] flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-slate-400">
                <Volume2 className={`w-4 h-4 ${isPlayingAudio ? 'text-[#06b6d4] animate-bounce' : ''}`} />
                <span className="text-[11px] font-mono">{isPlayingAudio ? 'Hablando...' : 'Audio Pausado'}</span>
              </div>
              <button
                onClick={() => playStepVoice(currentStep)}
                className="text-[10px] font-bold text-[#06b6d4] hover:underline"
              >
                Replay Audio
              </button>
            </div>

            {/* Tour Navigation Controls */}
            <div className="flex items-center justify-between pt-2">
              <div className="flex gap-1">
                {[0, 1, 2, 3].map((idx) => (
                  <div
                    key={idx}
                    className={`h-1.5 rounded-full transition-all ${
                      idx === currentStep ? 'w-6 bg-[#06b6d4]' : 'w-2 bg-[#2d2d44]'
                    }`}
                  />
                ))}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleCloseTour}
                  className="px-3 py-1.5 text-[11px] font-bold text-slate-400 hover:text-white"
                >
                  {t('tour.skipTour')}
                </button>
                <button
                  onClick={handleNextStep}
                  className="btn-brand-primary px-4 py-1.5 text-xs font-bold flex items-center gap-1 shadow-md"
                >
                  {t('tour.next')} <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* STEP 4: FEEDBACK MODAL */
          <div className="space-y-3">
            {feedbackSubmitted ? (
              <div className="p-4 bg-[#06b6d4]/10 border border-[#06b6d4]/30 text-[#06b6d4] text-xs rounded-xl flex items-center gap-2 font-bold animate-fade-in">
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                <span>¡Muchas gracias! Tu opinión ha sido guardada con éxito.</span>
              </div>
            ) : (
              <form onSubmit={handleSubmitFeedback} className="space-y-3">
                <div>
                  <h5 className="font-bold text-sm text-white flex items-center gap-2">
                    <Compass className="w-4 h-4 text-[#06b6d4]" />
                    {t('tour.feedbackTitle')}
                  </h5>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Califica tu experiencia inicial en la Academia Giantucchi.
                  </p>
                </div>

                {/* Star Rating Selection */}
                <div className="flex items-center justify-center gap-2 py-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setFeedbackRating(star)}
                      className="p-1 transition-transform hover:scale-110"
                    >
                      <Star
                        className={`w-6 h-6 ${
                          star <= feedbackRating ? 'text-[#eab308] fill-[#eab308]' : 'text-slate-600'
                        }`}
                      />
                    </button>
                  ))}
                </div>

                {/* Optional Comment Textarea */}
                <textarea
                  rows={2}
                  placeholder={t('tour.feedbackPlaceholder')}
                  value={feedbackComment}
                  onChange={(e) => setFeedbackComment(e.target.value)}
                  className="w-full bg-[#0a0a0f] border border-[#2d2d44] rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-[#06b6d4]"
                />

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full btn-brand-primary py-2 text-xs font-extrabold flex items-center justify-center gap-2 shadow-lg shadow-[#06b6d4]/20"
                >
                  <Send className="w-3.5 h-3.5" />
                  {isSubmitting ? t('common.loading') : t('tour.feedbackSubmit')}
                </button>
              </form>
            )}
          </div>
        )}

      </div>
    </div>
  );
};
