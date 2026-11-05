import type { QuizAttemptStatus } from '../src/lib/quizAttemptStatus.js';
import { randomInt } from 'node:crypto';
import { descifrarSiHaceFalta } from './crypto.js';
import { prisma } from './prisma.js';

export const QUIZ_POLICY_DEFAULTS = {
  maxAttempts: 3,
  cooldownMinMinutes: 15,
  cooldownMaxMinutes: 30,
  resetTimeZone: 'America/Lima',
};

export function validateQuizPolicy(config: Record<string, unknown>) {
  for (const key of ['maxAttempts', 'cooldownMinMinutes', 'cooldownMaxMinutes']) {
    const value = config[key];
    if (!Number.isInteger(value) || (value as number) < 1 || (value as number) > (key === 'maxAttempts' ? 100 : 1440)) {
      throw new Error(`${key}: debe ser un entero entre 1 y ${key === 'maxAttempts' ? 100 : 1440}.`);
    }
  }
  if (Number(config.cooldownMinMinutes) > Number(config.cooldownMaxMinutes)) {
    throw new Error('La espera mínima no puede superar la máxima.');
  }
  if (typeof config.resetTimeZone !== 'string' || !config.resetTimeZone.trim()) throw new Error('Zona horaria inválida.');
  try { new Intl.DateTimeFormat('en', { timeZone: config.resetTimeZone }).format(); }
  catch { throw new Error('Zona horaria inválida.'); }
}

export function readQuizPolicy(config: Record<string, unknown>) {
  const policy = { ...QUIZ_POLICY_DEFAULTS, ...config };
  validateQuizPolicy(policy);
  return policy as typeof QUIZ_POLICY_DEFAULTS & Record<string, unknown>;
}

export async function loadQuizSettings() {
  const plugin = await prisma.plugin.findUnique({ where: { id: 'interactive-quizzes' }, select: { configJson: true } });
  const saved = JSON.parse(descifrarSiHaceFalta(plugin?.configJson || '{}'));
  return readQuizPolicy(saved);
}

export function quizDayKey(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  return ['year', 'month', 'day'].map(type => parts.find(p => p.type === type)!.value).join('-');
}

export function cooldownDeadline(now: Date, minMinutes: number, maxMinutes: number, draw: (min: number, max: number) => number = randomInt): Date {
  return new Date(now.getTime() + draw(minMinutes, maxMinutes + 1) * 60_000);
}


// tx uses the same advisory lock as submission, so parallel requests cannot spend
// the last free attempt or the next cooled-down attempt twice.
export async function getQuizAttemptStatus(tx: any, userId: string, moduleId: string, settings: typeof QUIZ_POLICY_DEFAULTS, now = new Date()): Promise<QuizAttemptStatus> {
  const [recent, latest, approved] = await Promise.all([
    tx.quizAttempt.findMany({ where: { userId, moduleId, createdAt: { gte: new Date(now.getTime() - 48 * 3600_000) } }, select: { createdAt: true } }),
    tx.quizAttempt.findFirst({ where: { userId, moduleId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], select: { cooldownUntil: true } }),
    tx.quizAttempt.findFirst({ where: { userId, moduleId, passed: true }, orderBy: { scorePercentage: 'desc' }, select: { id: true, scorePercentage: true } }),
  ]);
  const dayKey = quizDayKey(now, settings.resetTimeZone);
  const attemptsUsed = recent.filter((a: { createdAt: Date }) => quizDayKey(a.createdAt, settings.resetTimeZone) === dayKey).length;
  const cooldownUntil = !approved && latest?.cooldownUntil && latest.cooldownUntil > now ? latest.cooldownUntil.toISOString() : null;
  return {
    attemptsUsed,
    initialAttemptsRemaining: Math.max(0, settings.maxAttempts - attemptsUsed),
    maxAttempts: settings.maxAttempts,
    passed: Boolean(approved),
    ...(approved ? { scorePercentage: approved.scorePercentage } : {}),
    cooldownUntil,
    retryAfterSeconds: cooldownUntil ? Math.ceil((new Date(cooldownUntil).getTime() - now.getTime()) / 1000) : 0,
    serverNow: now.toISOString(), dayKey, resetTimeZone: settings.resetTimeZone,
  };
}
