export interface QuizAttemptStatus {
  attemptsUsed: number;
  initialAttemptsRemaining: number;
  maxAttempts: number;
  passed: boolean;
  scorePercentage?: number;
  cooldownUntil: string | null;
  retryAfterSeconds: number;
  serverNow: string;
  dayKey: string;
  resetTimeZone: string;
}
