/**
 * Componente de Evaluación e Interacción de Módulo (`ModuleQuizCard.tsx`)
 * Plugin Core: Exámenes & Cuestionarios
 *
 * El examen ocupa el escenario principal —donde estaba el video— y solo cuando
 * el alumno lo abre desde el temario. Montado bajo el reproductor, como estaba
 * antes, el cronómetro de cinco minutos arrancaba mientras se veía la clase: al
 * cabo de ese rato el examen se entregaba solo, en blanco, y consumía un
 * intento sin que nadie lo hubiera leído.
 */

import React, { useState, useEffect } from 'react';
import { CheckSquare, Award, RefreshCw, CheckCircle2, AlertCircle, Clock, ArrowLeft, Loader2 } from 'lucide-react';
import { Module, User } from '../types';
import { getModuleQuestions, setModuleQuiz, quizzesPluginEngine, QuizQuestion } from '../plugins/QuizzesPlugin';
import { api } from '../lib/api';
import { pluginManager } from '../plugins/PluginManager';

interface ModuleQuizCardProps {
  module: Module;
  user?: User;
  passingScore?: number;
  hasTimer?: boolean;
  timeLimitMinutes?: number;
  maxAttempts?: number;
  onPassed?: (score: number) => void;
  /** Vuelve a la clase. Sin él, el examen no ofrece salida. */
  onExit?: () => void;
}

export const ModuleQuizCard: React.FC<ModuleQuizCardProps> = ({
  module,
  user,
  passingScore = pluginManager.getQuizPassingScore(),
  hasTimer = true,
  timeLimitMinutes = 5,
  maxAttempts = pluginManager.getQuizMaxAttempts(),
  onPassed,
  onExit,
}) => {
  const [questions, setQuestions] = useState<QuizQuestion[]>(() => getModuleQuestions(module.id));
  /**
   * Solo se espera cuando no hay nada que pintar. El gestor de cursos y el
   * panel del mentor ya traen el banco completo: hacerles ver un cargador para
   * volver a lo que ya tienen es parpadeo sin información.
   */
  const [cargando, setCargando] = useState<boolean>(() => getModuleQuestions(module.id).length === 0);
  /** El cronómetro y las preguntas no aparecen hasta que se pulsa «Comenzar». */
  const [iniciado, setIniciado] = useState<boolean>(false);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitted, setSubmitted] = useState<boolean>(false);
  const [scorePercentage, setScorePercentage] = useState<number>(0);
  const [attemptsUsed, setAttemptsUsed] = useState<number>(0);
  const [timeLeft, setTimeLeft] = useState<number>(timeLimitMinutes * 60);

  useEffect(() => {
    let isMounted = true;
    setCargando(getModuleQuestions(module.id).length === 0);
    api.getModuleQuiz(module.id)
      .then((res) => {
        if (!isMounted) return;
        if (res.success && res.questions && res.questions.length > 0) {
          setModuleQuiz(module.id, res.questions);
          setQuestions(res.questions);
        } else {
          setQuestions(getModuleQuestions(module.id) || []);
        }
      })
      .catch(() => {
        if (!isMounted) return;
        setQuestions(getModuleQuestions(module.id) || []);
      })
      .finally(() => {
        if (isMounted) setCargando(false);
      });
    return () => {
      isMounted = false;
    };
  }, [module.id]);

  useEffect(() => {
    if (!iniciado || !hasTimer || submitted || questions.length === 0) return;
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
  }, [iniciado, hasTimer, submitted, questions.length]);

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

  const handleStartQuiz = () => {
    setAnswers({});
    setSubmitted(false);
    setScorePercentage(0);
    setTimeLeft(timeLimitMinutes * 60);
    setIniciado(true);
  };

  /** Volver a la portada, no al examen: el reloj no corre mientras se decide. */
  const handleResetQuiz = () => {
    if (attemptsUsed >= maxAttempts) return;
    setAnswers({});
    setSubmitted(false);
    setScorePercentage(0);
    setTimeLeft(timeLimitMinutes * 60);
    setIniciado(false);
  };

  const isPassed = scorePercentage >= passingScore;
  const intentosAgotados = attemptsUsed >= maxAttempts;
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const formattedTime = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

  const botonVolver = onExit ? (
    <button
      type="button"
      onClick={onExit}
      className="flex items-center gap-1.5 rounded-lg bg-raised px-3 py-2 text-meta font-medium text-ink-soft transition-colors hover:bg-line hover:text-ink"
    >
      <ArrowLeft aria-hidden className="h-4 w-4" />
      Volver a la clase
    </button>
  ) : null;

  // Sin `onExit` la tarjeta no es el escenario, sino un añadido: ahí lo correcto
  // mientras no hay preguntas sigue siendo no ocupar sitio.
  if (cargando) {
    if (!onExit) return null;
    return (
      <div className="flex min-h-60 flex-col items-center justify-center gap-3 rounded-2xl border border-line bg-surface p-6">
        <Loader2 aria-hidden className="h-6 w-6 animate-spin text-ink-muted" />
        <p className="text-meta text-ink-muted">Cargando el examen del módulo…</p>
        {/* La salida acompaña también a la espera: si la carga se atasca, el
            alumno no se queda encerrado en una pantalla que gira. */}
        {botonVolver}
      </div>
    );
  }

  // Un módulo sin preguntas no muestra examen. Antes se caía a un cuestionario
  // de ejemplo sobre el propio DocentOS, que aparecía dentro de cualquier curso
  // —inglés, derecho— sin tener nada que ver con su contenido.
  if (questions.length === 0) {
    if (!onExit) return null;
    return (
      <div className="flex min-h-60 flex-col items-center justify-center gap-4 rounded-2xl border border-line bg-surface p-6 text-center">
        <CheckSquare aria-hidden className="h-7 w-7 text-ink-muted" />
        <div>
          <h2 className="text-section font-semibold text-ink">Este módulo todavía no tiene examen</h2>
          <p className="mx-auto mt-1.5 max-w-sm text-meta leading-relaxed text-ink-muted">
            Cuando el mentor publique la evaluación aparecerá aquí.
          </p>
        </div>
        {botonVolver}
      </div>
    );
  }

  // --- Portada: el examen no empieza hasta que el alumno dice que empieza ----
  if (!iniciado) {
    return (
      <div className="flex flex-col gap-5 rounded-2xl border border-line bg-surface p-6">
        <div className="flex items-start gap-3">
          <span className="rounded-xl border border-brand-violet/30 bg-brand-violet/10 p-2.5 text-brand-violet-light">
            <CheckSquare aria-hidden className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h2 className="text-section font-semibold text-ink">Examen de validación</h2>
            <p className="mt-0.5 text-meta text-ink-muted">{module.title}</p>
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { etiqueta: 'Preguntas', valor: String(questions.length) },
            { etiqueta: 'Para aprobar', valor: `${passingScore}%` },
            { etiqueta: 'Tiempo', valor: hasTimer ? `${timeLimitMinutes} min` : 'Sin límite' },
            { etiqueta: 'Intentos', valor: `${attemptsUsed}/${maxAttempts}` },
          ].map((dato) => (
            <div key={dato.etiqueta} className="rounded-xl border border-line bg-raised px-3 py-2.5">
              <dt className="text-micro text-ink-muted">{dato.etiqueta}</dt>
              <dd className="mt-0.5 text-row font-semibold text-ink tabular-nums">{dato.valor}</dd>
            </div>
          ))}
        </dl>

        {hasTimer && (
          <p className="flex items-start gap-2 text-meta leading-relaxed text-ink-soft">
            <Clock aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-brand-cyan" />
            <span>
              El cronómetro arranca al pulsar «Comenzar examen» y no se detiene. Al agotarse, el examen se
              entrega con lo que haya contestado.
            </span>
          </p>
        )}

        {submitted && (
          <p className="text-meta text-ink-soft">
            Último resultado: <span className="font-semibold text-ink tabular-nums">{scorePercentage}%</span>.
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          {botonVolver || <span />}
          <button
            type="button"
            onClick={handleStartQuiz}
            disabled={intentosAgotados}
            className="btn-brand-primary flex items-center gap-2 px-6 py-2.5 text-meta font-semibold disabled:opacity-50"
          >
            <Award aria-hidden className="h-4 w-4" />
            {intentosAgotados ? 'Sin intentos disponibles' : attemptsUsed > 0 ? 'Reintentar examen' : 'Comenzar examen'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 rounded-2xl border border-line bg-surface p-6">
      {/* Cabecera */}
      <div className="flex flex-col items-start justify-between gap-3 border-b border-line pb-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <span className="rounded-xl border border-brand-violet/30 bg-brand-violet/10 p-2.5 text-brand-violet-light">
            <CheckSquare aria-hidden className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h2 className="text-section font-semibold text-ink">Examen de validación: {module.title}</h2>
            <p className="text-micro text-ink-muted">
              Aprobación: {passingScore}% • Intentos: {attemptsUsed}/{maxAttempts}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {hasTimer && !submitted && (
            <span
              role="timer"
              aria-live="off"
              className={`flex items-center gap-1.5 rounded-xl border px-3 py-1 font-mono text-meta font-semibold tabular-nums ${
                timeLeft < 60
                  ? 'border-danger/30 bg-danger/10 text-danger-light'
                  : 'border-brand-cyan/30 bg-brand-cyan/10 text-brand-cyan'
              }`}
            >
              <Clock aria-hidden className="h-3.5 w-3.5" />
              {formattedTime}
            </span>
          )}

          {submitted && (
            <span
              role="status"
              className={`flex items-center gap-1.5 rounded-xl border px-3 py-1 text-meta font-semibold ${
                isPassed
                  ? 'border-success/30 bg-success/10 text-success-light'
                  : 'border-danger/30 bg-danger/10 text-danger-light'
              }`}
            >
              {isPassed ? (
                <CheckCircle2 aria-hidden className="h-4 w-4" />
              ) : (
                <AlertCircle aria-hidden className="h-4 w-4" />
              )}
              {isPassed ? `¡Aprobado! (${scorePercentage}%)` : `Reprobado (${scorePercentage}%)`}
            </span>
          )}
        </div>
      </div>

      {/* Preguntas */}
      <form onSubmit={handleSubmitQuiz} className="space-y-6">
        {questions.map((q, idx) => {
          const selectedOption = answers[q.id];
          const isQuestionCorrect = submitted && selectedOption === q.correctIndex;
          const isQuestionWrong = submitted && selectedOption !== undefined && selectedOption !== q.correctIndex;

          return (
            <fieldset
              key={q.id}
              className={`rounded-xl border p-4 transition-colors ${
                isQuestionCorrect
                  ? 'border-success/40 bg-success/5'
                  : isQuestionWrong
                    ? 'border-danger/40 bg-danger/5'
                    : 'border-line bg-raised'
              }`}
            >
              <legend className="sr-only">Pregunta {idx + 1}</legend>
              <div className="mb-3 flex items-start gap-2">
                <span className="rounded-md border border-brand-cyan/20 bg-brand-cyan/10 px-2 py-0.5 font-mono text-micro font-semibold text-brand-cyan">
                  {idx + 1}
                </span>
                <h3 className="text-row font-semibold leading-relaxed text-ink">{q.text}</h3>
              </div>

              <div className="space-y-2 pl-6">
                {q.options.map((opt, optIdx) => {
                  const isChoiceSelected = selectedOption === optIdx;
                  let optStyle = 'border-line bg-canvas text-ink-soft hover:border-brand-cyan';

                  if (submitted) {
                    if (optIdx === q.correctIndex) {
                      optStyle = 'border-success bg-success/20 text-success-light font-semibold';
                    } else if (isChoiceSelected) {
                      optStyle = 'border-danger bg-danger/20 text-danger-light font-semibold';
                    } else {
                      optStyle = 'border-line bg-canvas text-ink-faint';
                    }
                  } else if (isChoiceSelected) {
                    optStyle = 'border-brand-cyan bg-brand-cyan/20 text-brand-cyan font-semibold';
                  }

                  return (
                    <button
                      type="button"
                      key={optIdx}
                      onClick={() => handleSelectOption(q.id, optIdx)}
                      disabled={submitted}
                      aria-pressed={isChoiceSelected}
                      className={`flex w-full items-center justify-between rounded-xl border p-3 text-left text-meta transition-colors disabled:cursor-default ${optStyle}`}
                    >
                      <span>{opt}</span>
                      {isChoiceSelected && !submitted && (
                        <span aria-hidden className="h-2 w-2 shrink-0 rounded-full bg-brand-cyan" />
                      )}
                    </button>
                  );
                })}
              </div>

              {submitted && (
                <p className="mt-3 border-l-2 border-brand-violet pl-6 text-micro italic text-ink-muted">
                  Explicación: {q.explanation}
                </p>
              )}
            </fieldset>
          );
        })}

        {/* Controles */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          {submitted ? (
            <div className="flex flex-wrap items-center gap-2">
              {botonVolver}
              <button
                type="button"
                onClick={handleResetQuiz}
                disabled={intentosAgotados}
                className="flex items-center gap-2 rounded-xl border border-line bg-raised px-4 py-2 text-meta font-semibold text-ink transition-colors hover:bg-line disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RefreshCw aria-hidden className="h-4 w-4 text-brand-cyan" />
                {intentosAgotados ? 'Sin intentos disponibles' : 'Reintentar examen'}
              </button>
            </div>
          ) : (
            botonVolver || <span />
          )}

          {!submitted && (
            <button
              type="submit"
              disabled={Object.keys(answers).length < questions.length}
              className="btn-brand-primary flex items-center gap-2 px-6 py-2.5 text-meta font-semibold disabled:opacity-50"
            >
              <Award aria-hidden className="h-4 w-4" />
              Enviar y calificar examen
            </button>
          )}
        </div>
      </form>
    </div>
  );
};
