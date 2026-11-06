import type { SharedRateLimitStore } from './rateLimitStore.js';

export interface LoginPolicy {
  freeAttempts: number;
  windowMs: number;
  waits: number[];
}

type Action = 'begin' | 'failure' | 'release' | 'success' | 'reset';
type State = { failures: number; until: number; lease: string; leaseUntil: number; expires: number };
export type LoginGate = { allowed: boolean; retryAfterSeconds: number };
const leaseMs = 60000;

// El reloj y la reserva pertenecen a Redis: dos procesos no pueden verificar
// simultáneamente contraseñas de la misma cuenta saltándose la espera.
const SCRIPT = `
local time = redis.call('TIME')
local now = tonumber(time[1]) * 1000 + tonumber(time[2]) / 1000
local action = ARGV[1]
local ticket = ARGV[2]
local window = tonumber(ARGV[3])
local free = tonumber(ARGV[4])
local state = redis.call('HMGET', KEYS[1], 'failures', 'until', 'lease', 'leaseUntil')
local failures = tonumber(state[1]) or 0
local untilTime = tonumber(state[2]) or 0
if action == 'reset' then redis.call('DEL', KEYS[1]); return {1, 0} end
if action == 'begin' then
  if untilTime > now then return {0, math.ceil((untilTime - now) / 1000)} end
  if (tonumber(state[4]) or 0) > now then return {0, 1} end
  redis.call('HSET', KEYS[1], 'lease', ticket, 'leaseUntil', now + tonumber(ARGV[5]))
  redis.call('PEXPIRE', KEYS[1], math.max(window, tonumber(ARGV[5])))
  return {1, 0}
end
if state[3] ~= ticket then return {0, 1} end
if action == 'success' then redis.call('DEL', KEYS[1]); return {1, 0} end
redis.call('HDEL', KEYS[1], 'lease', 'leaseUntil')
if action == 'release' then
  if failures == 0 then redis.call('DEL', KEYS[1]) end
  return {1, 0}
end
failures = math.min(failures + 1, free + #ARGV - 6)
local delay = 0
if failures >= free then delay = tonumber(ARGV[6 + math.min(failures - free, #ARGV - 6)]) end
redis.call('HSET', KEYS[1], 'failures', failures, 'until', now + delay * 1000)
redis.call('PEXPIRE', KEYS[1], window)
return {1, delay}
`;

export class LocalLoginThrottle {
  private states = new Map<string, State>();
  constructor(private readonly policy: LoginPolicy, private readonly clock = Date.now) {}

  apply(key: string, action: Action, ticket: string): LoginGate {
    const now = this.clock();
    if (action === 'reset') { this.states.delete(key); return { allowed: true, retryAfterSeconds: 0 }; }
    let state = this.states.get(key);
    if (state && state.expires <= now) { this.states.delete(key); state = undefined; }
    if (action === 'begin') {
      if (state?.until > now) return { allowed: false, retryAfterSeconds: Math.ceil((state.until - now) / 1000) };
      if (state?.leaseUntil > now) return { allowed: false, retryAfterSeconds: 1 };
      if (!state) {
        if (this.states.size >= 10000) {
          for (const [entry, value] of this.states) if (value.expires <= now) this.states.delete(entry);
          if (this.states.size >= 10000) throw new Error('LOCAL_LOGIN_CAPACITY');
        }
        state = { failures: 0, until: 0, lease: '', leaseUntil: 0, expires: 0 };
      }
      Object.assign(state, { lease: ticket, leaseUntil: now + leaseMs, expires: now + Math.max(this.policy.windowMs, leaseMs) });
      this.states.set(key, state);
      return { allowed: true, retryAfterSeconds: 0 };
    }
    if (!state || state.lease !== ticket) return { allowed: false, retryAfterSeconds: 1 };
    if (action === 'success') { this.states.delete(key); return { allowed: true, retryAfterSeconds: 0 }; }
    state.lease = '';
    state.leaseUntil = 0;
    if (action === 'release') {
      if (!state.failures) this.states.delete(key);
      return { allowed: true, retryAfterSeconds: 0 };
    }
    state.failures = Math.min(state.failures + 1, this.policy.freeAttempts + this.policy.waits.length - 1);
    const delay = state.failures < this.policy.freeAttempts ? 0 : this.policy.waits[Math.min(state.failures - this.policy.freeAttempts, this.policy.waits.length - 1)];
    state.until = now + delay * 1000;
    state.expires = now + this.policy.windowMs;
    return { allowed: true, retryAfterSeconds: delay };
  }
}

export class LoginThrottle {
  private readonly local: LocalLoginThrottle;
  constructor(private readonly store: SharedRateLimitStore, private readonly policy: LoginPolicy, clock?: () => number) {
    this.local = new LocalLoginThrottle(policy, clock);
  }

  async apply(key: string, action: Action, ticket = ''): Promise<LoginGate> {
    if (!this.store.url) return this.local.apply(key, action, ticket);
    const result = await this.store.command(['EVAL', SCRIPT, '1', key, action, ticket,
      String(this.policy.windowMs), String(this.policy.freeAttempts), String(leaseMs), ...this.policy.waits.map(String)]) as number[];
    return { allowed: result[0] === 1, retryAfterSeconds: result[1] };
  }
}
