import type { QuizAttemptStatus } from '../lib/quizAttemptStatus';
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

import React, { useState, useEffect, useRef } from 'react';
import { CheckSquare, Award, RefreshCw, CheckCircle2, AlertCircle, Clock, ArrowLeft, Loader2 } from 'lucide-react';
import { Module, User } from '../types';
import { getModuleQuestions, setModuleQuiz, quizzesPluginEngine, QuizQuestion } from '../plugins/QuizzesPlugin';
import { api } from '../lib/api';
import { ApiRequestError, retryDelayMs } from '../lib/apiRequest';
import { pluginManager } from '../plugins/PluginManager';

interface ModuleQuizCardProps {
  module: Module;
  courseId?: string;
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
  courseId,
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
  const [questionsError, setQuestionsError] = useState(false);
  const [questionReload, setQuestionReload] = useState(0);
  const [questionRetryAt, setQuestionRetryAt] = useState(0);
  /** El cronómetro y las preguntas no aparecen hasta que se pulsa «Comenzar». */
  const [iniciado, setIniciado] = useState<boolean>(false);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const answersRef = useRef<Record<string, number>>({});
  const sendingRef = useRef(false);
  const [submitted, setSubmitted] = useState<boolean>(false);
  const [sending, setSending] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [passed, setPassed] = useState(false);
  const [canReviewAnswers, setCanReviewAnswers] = useState(false);
  const [scorePercentage, setScorePercentage] = useState<number>(0);
  const [attemptsUsed, setAttemptsUsed] = useState<number>(0);
  const [timeLeft, setTimeLeft] = useState<number>(timeLimitMinutes * 60);

  const [attemptStatus, setAttemptStatus] = useState<QuizAttemptStatus | null>(null);
  const [statusReady, setStatusReady] = useState(!user);
  const [clockNow, setClockNow] = useState(Date.now());
  const serverOffset = useRef(0);
  const refreshControl = useRef({ pending: false, nextAt: 0, failures: 0, permanent: false });
  const statusIdentity = useRef({ moduleId: module.id, userId: user?.id });
  statusIdentity.current = { moduleId: module.id, userId: user?.id };

  const applyStatus = (status: QuizAttemptStatus) => {
    serverOffset.current = new Date(status.serverNow).getTime() - Date.now();
    setClockNow(Date.now() + serverOffset.current);
    setAttemptStatus(status);
    setAttemptsUsed(status.attemptsUsed);
    setPassed(status.passed);
    if (status.passed && status.scorePercentage !== undefined) setScorePercentage(status.scorePercentage);
    setStatusReady(true);
  };

  const refreshStatus = async () => {
    const requestedModule = module.id;
    const requestedUser = user?.id;
    const status = await api.getQuizAttemptStatus(requestedModule);
    if (statusIdentity.current.moduleId !== requestedModule || statusIdentity.current.userId !== requestedUser) return null;
    applyStatus(status);
    return status;
  };

  useEffect(() => {
    let active = true;
    const control = { pending: true, nextAt: 0, failures: 0, permanent: false };
    refreshControl.current = control;
    setAttemptStatus(null);
    setAttemptsUsed(0);
    setPassed(false);
    setSubmitted(false);
    setIniciado(false);
    setSubmitError(null);
    setStatusReady(!user);
    if (user) api.getQuizAttemptStatus(module.id).then(status => {
      if (active) applyStatus(status);
    }).catch(error => {
      if (!active) return;
      control.failures++;
      control.permanent = error instanceof ApiRequestError && [401, 403, 404].includes(error.status);
      control.nextAt = Date.now() + retryDelayMs(error, control.failures);
      setSubmitError('No se pudo verificar el examen. Reintentaremos en unos momentos.');
    }).finally(() => { control.pending = false; });
    return () => { active = false; };
  }, [module.id, user?.id]);

  useEffect(() => {
    const timer = setInterval(() => setClockNow(Date.now() + serverOffset.current), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const control = refreshControl.current;
    if (!user || attemptStatus?.passed || control.pending || control.permanent || Date.now() < control.nextAt || document.visibilityState === 'hidden') return;
    const parts = new Intl.DateTimeFormat('en', { timeZone: attemptStatus?.resetTimeZone || 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(clockNow));
    const dayKey = ['year', 'month', 'day'].map(type => parts.find(p => p.type === type)!.value).join('-');
    const expired = attemptStatus?.cooldownUntil && clockNow >= new Date(attemptStatus.cooldownUntil).getTime();
    if (!attemptStatus || expired || dayKey !== attemptStatus.dayKey) {
      control.pending = true;
      control.nextAt = Date.now() + 5000;
      refreshStatus().then(status => {
        if (!status || refreshControl.current !== control) return;
        control.failures = 0;
        setSubmitError(null);
      }).catch(error => {
        if (refreshControl.current !== control) return;
        control.failures++;
        control.permanent = error instanceof ApiRequestError && [401, 403, 404].includes(error.status);
        control.nextAt = Date.now() + retryDelayMs(error, control.failures);
        setSubmitError('No se pudo actualizar la disponibilidad. Reintentando…');
      }).finally(() => { control.pending = false; });
    }
  }, [clockNow, attemptStatus, module.id, user?.id]);

  useEffect(() => {
    let isMounted = true;
    setCargando(getModuleQuestions(module.id).length === 0);
    setQuestionsError(false);
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
      .catch(error => {
        if (!isMounted) return;
        setQuestions(getModuleQuestions(module.id) || []);
        setQuestionsError(true);
        setQuestionRetryAt(Date.now() + retryDelayMs(error, 1));
      })
      .finally(() => {
        if (isMounted) setCargando(false);
      });
    return () => {
      isMounted = false;
    };
  }, [module.id, questionReload]);

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

  const triggerAutoSubmit = async () => {
    if (sendingRef.current || submitted) return;
    sendingRef.current = true;
    setSending(true);
    setSubmitError(null);
    try {
      // La ref contiene las respuestas del último clic incluso si el reloj vence antes del render.
      const submittedAnswers = answersRef.current;
      const indexed = Object.fromEntries(questions.flatMap((question, index) =>
        submittedAnswers[question.id] === undefined ? [] : [[index, submittedAnswers[question.id]]]
      ));
      const result = await quizzesPluginEngine.submitAttempt(module.id, indexed);
      setCanReviewAnswers(Boolean(result.correctIndexes));
      if (result.correctIndexes && result.explanations) {
        setQuestions((prev) => prev.map((question, index) => ({
          ...question,
          correctIndex: result.correctIndexes![index],
          explanation: result.explanations![index],
        })));
      }
      setScorePercentage(result.scorePercentage);
      setPassed(result.passed);
      setSubmitted(true);
      applyStatus(result.attemptStatus);
      if (result.passed) {
        if (user) quizzesPluginEngine.recordAttempt(user.id, module.id, result.scorePercentage, passingScore);
        if (user) pluginManager.onQuizPass(user, module.id, result.scorePercentage);
        onPassed?.(result.scorePercentage);
      }
    } catch (error) {
      if ((error as any)?.attemptStatus) applyStatus((error as any).attemptStatus);
      setSubmitError(error instanceof Error ? error.message : 'No se pudo calificar el examen.');
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  const handleSelectOption = (qId: string, optionIdx: number) => {
    if (submitted) return;
    answersRef.current = { ...answersRef.current, [qId]: optionIdx };
    setAnswers(answersRef.current);
  };

  const handleSubmitQuiz = (e: React.FormEvent) => {
    e.preventDefault();
    triggerAutoSubmit();
  };

  const handleStartQuiz = async () => {
    if (user) {
      try {
        const status = await refreshStatus();
        if (!status || status.passed || status.cooldownUntil) return;
      } catch {
        setSubmitError('No se pudo verificar el examen. Inténtalo nuevamente.');
        return;
      }
    }
    setSubmitError(null);
    setCanReviewAnswers(false);
    setAnswers({});
    answersRef.current = {};
    setSubmitted(false);
    setScorePercentage(0);
    setTimeLeft(timeLimitMinutes * 60);
    setIniciado(true);
  };

  /** Volver a la portada, no al examen: el reloj no corre mientras se decide. */
  const handleResetQuiz = () => {
    if (intentosAgotados) return;
    setCanReviewAnswers(false);
    setAnswers({});
    answersRef.current = {};
    setSubmitted(false);
    setScorePercentage(0);
    setTimeLeft(timeLimitMinutes * 60);
    setIniciado(false);
  };

  const isPassed = passed;
  const waitSeconds = attemptStatus?.cooldownUntil
    ? Math.max(0, Math.ceil((new Date(attemptStatus.cooldownUntil).getTime() - clockNow) / 1000)) : 0;
  const waitTime = `${Math.floor(waitSeconds / 60).toString().padStart(2, '0')}:${(waitSeconds % 60).toString().padStart(2, '0')}`;
  // Keep the button blocked until the server confirms that the wait expired.
  const intentosAgotados = !statusReady || Boolean(attemptStatus?.cooldownUntil) || passed;
  const retryLabel = passed ? 'Examen aprobado' : !statusReady ? 'Verificando intentos…'
    : attemptStatus?.cooldownUntil ? (waitSeconds > 0 ? `Reintentar en ${waitTime}` : 'Verificando disponibilidad…') : 'Reintentar examen';
  const attemptLabel = attemptStatus
    ? `${attemptStatus.initialAttemptsRemaining}/${attemptStatus.maxAttempts} iniciales disponibles`
    : `${Math.max(0, maxAttempts - attemptsUsed)}/${maxAttempts} iniciales disponibles`;
  const waitNotice = attemptStatus?.cooldownUntil ? (
    <div role="status" className="rounded-xl border border-line bg-raised p-4 text-sm text-ink-soft">
      <p className="font-semibold text-ink">Prepárate para tu próximo intento</p>
      <p className="mt-2 leading-relaxed">
        Repasa los temas que te resultaron más difíciles.{' '}
        {waitSeconds > 0 ? (
          <>Podrás volver a intentarlo a las <strong className="font-semibold text-ink">{new Date(attemptStatus.cooldownUntil).toLocaleTimeString('es-PE', { timeZone: attemptStatus.resetTimeZone, hour: 'numeric', minute: '2-digit' })}</strong>.</>
        ) : 'Estamos verificando la disponibilidad de tu próximo intento…'}
      </p>
    </div>
  ) : null;
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
      {attemptStatus?.cooldownUntil ? 'Volver al módulo' : 'Volver a la clase'}
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
          <h2 className="text-section font-semibold text-ink">{questionsError ? 'No pudimos cargar el examen' : 'Este módulo todavía no tiene examen'}</h2>
          <p className="mx-auto mt-1.5 max-w-sm text-meta leading-relaxed text-ink-muted">
            {questionsError ? 'No pudimos cargar la evaluación. Puedes volver a intentarlo en unos momentos.' : 'Cuando el mentor publique la evaluación aparecerá aquí.'}
          </p>
        </div>
        {questionsError && (
          <button type="button" disabled={questionRetryAt > Date.now()} onClick={() => setQuestionReload(value => value + 1)} className="rounded-xl border border-line px-4 py-2 text-meta font-semibold disabled:opacity-50">
            {questionRetryAt > Date.now() ? `Reintentar en ${Math.ceil((questionRetryAt - Date.now()) / 1000)} s` : 'Volver a cargar'}
          </button>
        )}
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
            { etiqueta: 'Intentos', valor: attemptLabel },
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

        {attemptStatus && !passed && !attemptStatus.cooldownUntil && attemptStatus.initialAttemptsRemaining === 0 && (
          <p role="status" className="text-meta text-ink-soft">Tienes un intento adicional disponible. Si no apruebas, habrá una nueva espera.</p>
        )}
        {waitNotice}
        {submitError && <p role="alert" className="text-meta text-danger-light">{submitError}</p>}
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
            {intentosAgotados ? retryLabel : attemptsUsed > 0 ? 'Reintentar examen' : 'Comenzar examen'}
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
              Aprobación: {passingScore}% • Intentos: {attemptLabel}
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

      {waitNotice}
      {/* Preguntas */}
      <form onSubmit={handleSubmitQuiz} className="space-y-6">
        {questions.map((q, idx) => {
          const selectedOption = answers[q.id];
          const canReview = submitted && canReviewAnswers && q.correctIndex !== undefined;
          const isQuestionCorrect = canReview && selectedOption === q.correctIndex;
          const isQuestionWrong = canReview && selectedOption !== undefined && selectedOption !== q.correctIndex;

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

                  if (canReview) {
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

              {canReview && q.explanation && (
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
                {retryLabel}
              </button>
            </div>
          ) : (
            botonVolver || <span />
          )}

          {submitError && <p role="alert" className="text-meta text-danger-light">{submitError}</p>}
          {!submitted && (
            <button
              type="submit"
              disabled={sending || Object.keys(answers).length < questions.length}
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
