/**
 * Componente de Evaluación e Interacción de Módulo (`ModuleQuizCard.tsx`)
 * Plugin Core: Exámenes & Cuestionarios
 */

import React, { useState, useEffect } from 'react';
import { CheckSquare, Award, RefreshCw, CheckCircle2, AlertCircle, HelpCircle, Clock } from 'lucide-react';
import { Module, User } from '../types';
import { getModuleQuestions, quizzesPluginEngine } from '../plugins/QuizzesPlugin';
import { pluginManager } from '../plugins/PluginManager';

interface ModuleQuizCardProps {
  module: Module;
  user?: User;
  passingScore?: number;
  hasTimer?: boolean;
  timeLimitMinutes?: number;
  maxAttempts?: number;
  onPassed?: (score: number) => void;
}

export const ModuleQuizCard: React.FC<ModuleQuizCardProps> = ({
  module,
  user,
  passingScore = 80,
  hasTimer = true,
  timeLimitMinutes = 5,
  maxAttempts = 3,
  onPassed,
}) => {
  const questions = getModuleQuestions(module.id);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitted, setSubmitted] = useState<boolean>(false);
  const [scorePercentage, setScorePercentage] = useState<number>(0);
  const [attemptsUsed, setAttemptsUsed] = useState<number>(0);
  const [timeLeft, setTimeLeft] = useState<number>(timeLimitMinutes * 60);

  useEffect(() => {
    if (!hasTimer || submitted || questions.length === 0) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          triggerAutoSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [hasTimer, submitted, questions.length]);

  const triggerAutoSubmit = () => {
    // Usar la lógica centralizada de evaluación automática del QuizzesPluginEngine
    const result = quizzesPluginEngine.evaluateQuiz(questions, answers, passingScore);
    setScorePercentage(result.scorePercentage);
    setSubmitted(true);
    setAttemptsUsed((prev) => prev + 1);

    const activeUserId = user?.id || 'current-user';
    quizzesPluginEngine.recordAttempt(activeUserId, module.id, result.scorePercentage, passingScore);

    if (result.passed) {
      if (user) {
        pluginManager.onQuizPass(user, module.id, result.scorePercentage);
      }
      if (onPassed) {
        onPassed(result.scorePercentage);
      }
    }
  };

  const handleSelectOption = (qId: string, optionIdx: number) => {
    if (submitted) return;
    setAnswers((prev) => ({ ...prev, [qId]: optionIdx }));
  };

  const handleSubmitQuiz = (e: React.FormEvent) => {
    e.preventDefault();
    triggerAutoSubmit();
  };

  const handleResetQuiz = () => {
    if (attemptsUsed >= maxAttempts) return;
    setAnswers({});
    setSubmitted(false);
    setScorePercentage(0);
    setTimeLeft(timeLimitMinutes * 60);
  };

  const isPassed = scorePercentage >= passingScore;
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const formattedTime = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

  // Un módulo sin preguntas no muestra examen. Antes se caía a un cuestionario
  // de ejemplo sobre el propio DocentOS, que aparecía dentro de cualquier curso
  // —inglés, derecho— sin tener nada que ver con su contenido.
  if (questions.length === 0) return null;

  return (
    <div className="bg-[#141420] border border-[#2d2d44] rounded-2xl p-6 shadow-xl space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-[#2d2d44] pb-4 gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-[#a855f7]/10 border border-[#a855f7]/30 rounded-xl text-[#a855f7]">
            <CheckSquare className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-extrabold text-base text-white">
              Examen de Validación: {module.title}
            </h3>
            <p className="text-xs text-slate-400">
              Aprobación: {passingScore}% • Intentos: {attemptsUsed}/{maxAttempts}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {hasTimer && !submitted && (
            <div className={`px-3 py-1 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 border ${
              timeLeft < 60 ? 'bg-red-500/10 border-red-500/30 text-red-400 animate-pulse' : 'bg-[#06b6d4]/10 border-[#06b6d4]/30 text-[#06b6d4]'
            }`}>
              <Clock className="w-3.5 h-3.5" />
              <span>{formattedTime}</span>
            </div>
          )}

          {submitted && (
            <span className={`px-3 py-1 rounded-xl text-xs font-black flex items-center gap-1.5 border ${
              isPassed ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-red-500/10 border-red-500/30 text-red-400'
            }`}>
              {isPassed ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              {isPassed ? `¡Aprobado! (${scorePercentage}%)` : `Reprobado (${scorePercentage}%)`}
            </span>
          )}
        </div>
      </div>

      {/* Quiz Form */}
      <form onSubmit={handleSubmitQuiz} className="space-y-6">
        {questions.map((q, idx) => {
          const selectedOption = answers[q.id];
          const isQuestionCorrect = submitted && selectedOption === q.correctIndex;
          const isQuestionWrong = submitted && selectedOption !== undefined && selectedOption !== q.correctIndex;

          return (
            <div
              key={q.id}
              className={`p-4 rounded-xl border transition-all ${
                submitted
                  ? isQuestionCorrect
                    ? 'bg-emerald-950/20 border-emerald-500/40'
                    : isQuestionWrong
                    ? 'bg-red-950/20 border-red-500/40'
                    : 'bg-[#1a1a2e] border-[#2d2d44]'
                  : 'bg-[#1a1a2e] border-[#2d2d44]'
              }`}
            >
              <div className="flex items-start gap-2 mb-3">
                <span className="font-mono text-xs font-bold text-[#06b6d4] bg-[#06b6d4]/10 px-2 py-0.5 rounded-md border border-[#06b6d4]/20">
                  {idx + 1}
                </span>
                <h4 className="font-bold text-xs text-white leading-relaxed">
                  {q.text}
                </h4>
              </div>

              <div className="space-y-2 pl-6">
                {q.options.map((opt, optIdx) => {
                  const isChoiceSelected = selectedOption === optIdx;
                  let optStyle = 'bg-[#0a0a0f] border-[#2d2d44] text-slate-300 hover:border-[#06b6d4]';

                  if (submitted) {
                    if (optIdx === q.correctIndex) {
                      optStyle = 'bg-emerald-500/20 border-emerald-500 text-emerald-300 font-bold';
                    } else if (isChoiceSelected && optIdx !== q.correctIndex) {
                      optStyle = 'bg-red-500/20 border-red-500 text-red-300 font-bold';
                    } else {
                      optStyle = 'bg-[#0a0a0f] border-[#2d2d44] text-slate-500 opacity-60';
                    }
                  } else if (isChoiceSelected) {
                    optStyle = 'bg-[#06b6d4]/20 border-[#06b6d4] text-[#06b6d4] font-bold';
                  }

                  return (
                    <button
                      type="button"
                      key={optIdx}
                      onClick={() => handleSelectOption(q.id, optIdx)}
                      disabled={submitted}
                      className={`w-full text-left p-3 rounded-xl border text-xs transition-all flex items-center justify-between ${optStyle}`}
                    >
                      <span>{opt}</span>
                      {isChoiceSelected && !submitted && (
                        <span className="w-2 h-2 rounded-full bg-[#06b6d4]" />
                      )}
                    </button>
                  );
                })}
              </div>

              {submitted && (
                <p className="mt-3 text-[11px] text-slate-400 italic pl-6 border-l-2 border-[#a855f7]">
                  Explicación: {q.explanation}
                </p>
              )}
            </div>
          );
        })}

        {/* Action Controls */}
        <div className="flex items-center justify-between pt-2 border-t border-[#2d2d44]">
          {submitted ? (
            <button
              type="button"
              onClick={handleResetQuiz}
              className="px-4 py-2 bg-[#1a1a2e] hover:bg-[#2d2d44] border border-[#2d2d44] text-white text-xs font-bold rounded-xl flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4 text-[#06b6d4]" />
              <span>Reintentar Examen</span>
            </button>
          ) : (
            <div />
          )}

          {!submitted && (
            <button
              type="submit"
              disabled={Object.keys(answers).length < questions.length}
              className="btn-brand-primary px-6 py-2.5 text-xs font-extrabold flex items-center gap-2 disabled:opacity-50"
            >
              <Award className="w-4 h-4 text-[#eab308]" />
              <span>Enviar y Calificar Examen</span>
            </button>
          )}
        </div>
      </form>
    </div>
  );
};
