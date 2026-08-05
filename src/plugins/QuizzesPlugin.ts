/**
 * Plugin Core: Exámenes, Cuestionarios & Control de Bloqueo de Módulos (`QuizzesPlugin.ts`)
 *
 * Administra el ciclo de vida completo de las evaluaciones de DocentOS:
 * - Control estricto de temporizadores y límite de tiempo.
 * - Evaluación automática e instantánea al enviar respuestas.
 * - Lógica de desbloqueo/bloqueo de módulos basada en la nota obtenida (threshold).
 */

import { AcademiaPlugin, Module, User } from '../types';

export interface QuizQuestion {
  id: string;
  text: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface QuizEvaluationResult {
  scorePercentage: number;
  correctCount: number;
  totalQuestions: number;
  passed: boolean;
  passingScore: number;
  questionDetails: {
    questionId: string;
    userAnswer?: number;
    correctAnswer: number;
    isCorrect: boolean;
    explanation: string;
  }[];
}

export interface UserQuizAttempt {
  moduleId: string;
  userId: string;
  scorePercentage: number;
  passed: boolean;
  timestamp: string;
}

export class QuizzesPluginEngine {
  private userAttemptsStore: Map<string, UserQuizAttempt> = new Map();

  /**
   * Evalúa automáticamente las respuestas enviadas contra las respuestas correctas.
   */
  public evaluateQuiz(
    questions: QuizQuestion[],
    userAnswers: Record<string, number>,
    passingScoreThreshold: number = 80
  ): QuizEvaluationResult {
    let correctCount = 0;
    const details = questions.map((q) => {
      const userAnswer = userAnswers[q.id];
      const isCorrect = userAnswer === q.correctIndex;
      if (isCorrect) correctCount += 1;

      return {
        questionId: q.id,
        userAnswer,
        correctAnswer: q.correctIndex,
        isCorrect,
        explanation: q.explanation,
      };
    });

    const totalQuestions = questions.length;
    const scorePercentage = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
    const passed = scorePercentage >= passingScoreThreshold;

    return {
      scorePercentage,
      correctCount,
      totalQuestions,
      passed,
      passingScore: passingScoreThreshold,
      questionDetails: details,
    };
  }

  /**
   * Verifica si el tiempo del examen ha expirado.
   */
  public isTimeExpired(startTimeMs: number, timeLimitMinutes: number): boolean {
    const elapsedSeconds = (Date.now() - startTimeMs) / 1000;
    return elapsedSeconds >= timeLimitMinutes * 60;
  }

  /**
   * Calcula el tiempo restante en segundos.
   */
  public getTimeRemainingSeconds(startTimeMs: number, timeLimitMinutes: number): number {
    const elapsedSeconds = (Date.now() - startTimeMs) / 1000;
    const remaining = Math.max(0, timeLimitMinutes * 60 - elapsedSeconds);
    return Math.floor(remaining);
  }

  /**
   * Registra el intento de un usuario para un módulo.
   */
  public recordAttempt(userId: string, moduleId: string, scorePercentage: number, passingThreshold: number = 80): UserQuizAttempt {
    const key = `${userId}_${moduleId}`;
    const passed = scorePercentage >= passingThreshold;
    const attempt: UserQuizAttempt = {
      moduleId,
      userId,
      scorePercentage,
      passed,
      timestamp: new Date().toISOString(),
    };

    // Guarda el mejor resultado obtenido
    const previous = this.userAttemptsStore.get(key);
    if (!previous || scorePercentage > previous.scorePercentage) {
      this.userAttemptsStore.set(key, attempt);
    }

    return attempt;
  }

  /**
   * Obtiene la calificación registrada del usuario para un módulo.
   */
  public getUserAttempt(userId: string, moduleId: string): UserQuizAttempt | undefined {
    return this.userAttemptsStore.get(`${userId}_${moduleId}`);
  }

  /**
   * Determina si un módulo está desbloqueado para el usuario.
   * El módulo 0 siempre está desbloqueado.
   * Los módulos posteriores (N > 0) requieren haber aprobado el módulo previo (N - 1)
   * con una calificación >= passingThreshold si el plugin de quizzes está habilitado.
   */
  public isModuleUnlocked(
    modules: Module[],
    moduleIndex: number,
    userId: string,
    passingThreshold: number = 80,
    pluginEnabled: boolean = true
  ): boolean {
    if (!pluginEnabled || moduleIndex <= 0) {
      return true;
    }

    // Verificar si aprobó todos los módulos anteriores
    for (let i = 0; i < moduleIndex; i++) {
      const prevModule = modules[i];
      if (!prevModule) continue;
      const attempt = this.getUserAttempt(userId, prevModule.id);
      if (!attempt || !attempt.passed || attempt.scorePercentage < passingThreshold) {
        return false;
      }
    }

    return true;
  }
}

export const quizzesPluginEngine = new QuizzesPluginEngine();

export const quizzesPlugin: AcademiaPlugin = {
  id: 'interactive-quizzes',
  name: 'Plugin de Exámenes & Evaluaciones Interactivos',
  description: 'Gestiona el ciclo de vida de los exámenes con temporizador, evaluación automática y bloqueo secuencial de módulos.',
  version: '2.1.0',
  enabled: true,
  category: 'quizzes',
  icon: 'CheckSquare',
  config: {
    passingScore: 80,
    timeLimitMinutes: 5,
    maxAttempts: 3,
    enforceModuleLocking: true,
    showExplanations: true,
  },
};
