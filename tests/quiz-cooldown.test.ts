import test from 'node:test';
import assert from 'node:assert/strict';
import { QUIZ_POLICY_DEFAULTS, readQuizPolicy, quizDayKey, cooldownDeadline, getQuizAttemptStatus } from '../server/quizCooldown.js';

const settings = { ...QUIZ_POLICY_DEFAULTS };
function fake(attempts: { createdAt: Date; cooldownUntil?: Date | null; passed?: boolean }[]) {
  const rows = [...attempts].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return { quizAttempt: {
    findMany: async () => rows,
    findFirst: async (q: any) => q.where.passed ? rows.find(a => a.passed) || null : rows[0] || null,
  } };
}

test('quiz policy merges old settings and validates configurable ranges', () => {
  assert.equal(readQuizPolicy({ passingScore: 70 }).cooldownMinMinutes, 15);
  assert.equal(readQuizPolicy({ cooldownMinMinutes: 5, cooldownMaxMinutes: 10 }).cooldownMaxMinutes, 10);
  for (const bad of [{ maxAttempts: 0 }, { cooldownMinMinutes: -1 }, { cooldownMinMinutes: 20, cooldownMaxMinutes: 10 }, { cooldownMaxMinutes: 1.5 }, { resetTimeZone: 'Invalid/Zone' }]) {
    assert.throws(() => readQuizPolicy(bad));
  }
});
test('random wait supports inclusive bounds, fixed waits and different ranges', () => {
  const now = new Date('2026-11-04T23:00:00Z');
  assert.equal(cooldownDeadline(now, 15, 30, (lo, hi) => { assert.equal(hi, 31); return lo; }).getTime() - now.getTime(), 15 * 60_000);
  assert.equal(cooldownDeadline(now, 5, 10, (_lo, hi) => hi - 1).getTime() - now.getTime(), 10 * 60_000);
  assert.equal(cooldownDeadline(now, 5, 5).getTime() - now.getTime(), 5 * 60_000);
});
test('daily reset uses Lima midnight, not UTC midnight or 24 hours after first attempt', () => {
  assert.equal(quizDayKey(new Date('2026-11-05T04:59:59Z'), 'America/Lima'), '2026-11-04');
  assert.equal(quizDayKey(new Date('2026-11-05T05:00:00Z'), 'America/Lima'), '2026-11-05');
});
test('three initial attempts, one extra per wait, no reset after cooldown expires', async () => {
  const now = new Date('2026-11-04T23:00:00Z');
  const rows = [1, 2, 3].map(n => ({ createdAt: new Date(now.getTime() - (4 - n) * 60_000) }));
  rows[2] = { ...rows[2], cooldownUntil: new Date(now.getTime() + 20 * 60_000) } as any;
  const blocked = await getQuizAttemptStatus(fake(rows), 'u', 'm', settings, now);
  assert.equal(blocked.initialAttemptsRemaining, 0);
  assert.equal(blocked.retryAfterSeconds, 1200);
  const expired = await getQuizAttemptStatus(fake(rows), 'u', 'm', settings, new Date(now.getTime() + 20 * 60_000));
  assert.equal(expired.cooldownUntil, null);
  assert.equal(expired.initialAttemptsRemaining, 0);
  assert.equal(expired.attemptsUsed, 3);
});
test('midnight renews three initial attempts without cancelling a pending wait', async () => {
  const rows = [1, 2, 3].map(n => ({ createdAt: new Date(`2026-11-05T04:5${n}:00Z`), cooldownUntil: n === 3 ? new Date('2026-11-05T05:15:00Z') : null }));
  const status = await getQuizAttemptStatus(fake(rows), 'u', 'm', settings, new Date('2026-11-05T05:00:00Z'));
  assert.equal(status.initialAttemptsRemaining, 3);
  assert.equal(status.retryAfterSeconds, 900);
  const expired = await getQuizAttemptStatus(fake(rows), 'u', 'm', settings, new Date('2026-11-05T05:15:00Z'));
  assert.equal(expired.initialAttemptsRemaining, 3);
  assert.equal(expired.cooldownUntil, null);
});
test('approval remains recorded across days and removes waiting', async () => {
  const rows = [{ createdAt: new Date('2026-11-04T23:00:00Z'), passed: true, scorePercentage: 100 }];
  const status = await getQuizAttemptStatus(fake(rows), 'u', 'm', settings, new Date('2026-11-06T23:00:00Z'));
  assert.equal(status.passed, true);
  assert.equal(status.cooldownUntil, null);
});
