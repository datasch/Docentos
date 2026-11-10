import { createHmac, randomUUID } from 'node:crypto';
import type { Request, RequestHandler, Response } from 'express';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { config } from './config.js';
import { logger } from './logger.js';
import { LocalBucketStore, SharedRateLimitStore } from './rateLimitStore.js';
import { LoginThrottle } from './loginThrottle.js';

const minute = 60000;

class RecoverableRedisStore extends RedisStore {
  private lastRefundWarning = 0;

  async init(options: Parameters<RedisStore['init']>[0]) {
    // El adaptador reintenta cargar los scripts al recuperar Redis. Un fallo
    // inicial se responde por petición con 503, sin volcar errores del cliente.
    try { await super.init(options); } catch { /* La petición sigue cerrada ante el fallo. */ }
  }

  async decrement(key: string) {
    try { await super.decrement(key); }
    catch {
      // La respuesta correcta ya salió. Conservar el intento es más seguro
      // que perder la cuota; un error de devolución no debe tumbar el proceso.
      if (Date.now() - this.lastRefundWarning > minute) {
        this.lastRefundWarning = Date.now();
        logger.warn('rate_limit.refund_unavailable');
      }
    }
  }
}

export function createSecurityLimits(options: {
  redisUrl?: string; namespace?: string; apiBurst?: number; apiPerMinute?: number; anonymousPerMinute?: number;
  writeBurst?: number; writePerMinute?: number; loginClock?: () => number;
} = {}) {
  const shared = new SharedRateLimitStore(options.redisUrl ?? config.REDIS_URL);
  const prefix = `${options.namespace || config.RATE_LIMIT_NAMESPACE}:${config.DOCENTOS_ENV}:`;
  const fallback = new LocalBucketStore();
  const apiBurst = options.apiBurst ?? config.RATE_LIMIT_API_BURST;
  const apiPerMinute = options.apiPerMinute ?? config.RATE_LIMIT_API_PER_MINUTE;
  const anonymousPerMinute = options.anonymousPerMinute ?? config.RATE_LIMIT_ANON_PER_MINUTE;
  const login = new LoginThrottle(shared, {
    freeAttempts: config.LOGIN_FREE_ATTEMPTS,
    windowMs: config.LOGIN_FAILURE_WINDOW_MINUTES * minute,
    waits: [1, 2, 4, Infinity].map(multiplier => Math.min(config.LOGIN_BACKOFF_MAX_SECONDS, config.LOGIN_BACKOFF_INITIAL_SECONDS * multiplier)),
  }, options.loginClock);
  let lastWarning = 0;
  const blockedPolicies = new Map<string, { total: number; lastLog: number }>();
  const digest = (identity: string) => createHmac('sha256', config.DOCENTOS_ENCRYPTION_KEY || 'docentos-rate-limit-development').update(identity).digest('hex');
  const ip = (req: Request) => ipKeyGenerator(req.ip || req.socket.remoteAddress || 'unknown');
  const field = (req: Request, name: string, max: number) => typeof req.body?.[name] === 'string' && req.body[name].length <= max ? req.body[name] as string : `invalid:${ip(req)}`;
  const account = (req: Request) => digest(field(req, 'email', 255).trim().toLowerCase());
  const user = (req: Request) => digest(req.user!.id);
  const loginKey = (email: string) => `${prefix}login-backoff:${digest(email.trim().toLowerCase())}`;

  function unavailable(res: Response) {
    return res.set('Retry-After', '30').status(503).json({ code: 'RATE_LIMIT_UNAVAILABLE', error: 'No se pudo verificar la protección de esta operación. Reintenta en unos momentos.', retryAfterSeconds: 30 });
  }

  function blocked(res: Response, seconds: number) {
    const retryAfterSeconds = Math.max(1, seconds);
    return res.set('Retry-After', String(retryAfterSeconds)).status(429).json({ code: 'RATE_LIMITED', error: 'Has realizado varias solicitudes seguidas. Espera un momento antes de reintentar.', retryAfterSeconds });
  }

  function recordBlocked(policy: string) {
    const state = blockedPolicies.get(policy) || { total: 0, lastLog: 0 };
    state.total++;
    if (Date.now() - state.lastLog > minute) {
      logger.warn('rate_limit.blocked', { policy, total: state.total });
      state.lastLog = Date.now();
    }
    blockedPolicies.set(policy, state);
  }

  function warnUnavailable(policy: string) {
    if (Date.now() - lastWarning > minute) {
      lastWarning = Date.now();
      logger.warn('rate_limit.store_unavailable', { policy });
    }
  }

  function fixed(name: string, limit: number, windowMs: number, key: (req: Request) => string, failuresOnly = false, localOnly = false): RequestHandler {
    const limiter = rateLimit({
      windowMs, limit, keyGenerator: key, skipSuccessfulRequests: failuresOnly,
      standardHeaders: false, legacyHeaders: false,
      validate: { xForwardedForHeader: false, trustProxy: false },
      ...(shared.url && !localOnly ? { store: new RecoverableRedisStore({ prefix: `${prefix}${name}:`, sendCommand: (...args) => shared.command(args) }) } : {}),
      handler(req, res) {
        recordBlocked(name);
        const reset = (req as Request & { rateLimit?: { resetTime?: Date } }).rateLimit?.resetTime;
        blocked(res, Math.ceil(((reset?.getTime() || Date.now() + windowMs) - Date.now()) / 1000));
      },
    });
    return (req, res, next) => {
      void limiter(req, res, (error?: unknown) => {
        if (!error) return next();
        warnUnavailable(name);
        unavailable(res);
      });
    };
  }

  const api: RequestHandler = async (req, res, next) => {
    // Estas operaciones tienen su propia protección, independiente de navegar.
    if ((req.method === 'POST' && ['/auth/login', '/auth/register', '/auth/logout', '/auth/2fa/verify', '/auth/2fa/setup', '/auth/2fa/activate', '/auth/2fa/recovery-codes', '/auth/password/forgot', '/auth/password/reset'].includes(req.path))
      || (req.method === 'PUT' && req.path === '/auth/password') || (req.method === 'DELETE' && req.path === '/auth/2fa')
      || req.path.startsWith('/integrations/') || req.path === '/payments/webhook'
      || req.path.endsWith('/stream')) return next();
    const authenticated = Boolean(req.user && req.authSession);
    const reading = ['GET', 'HEAD'].includes(req.method);
    const policy = reading ? 'api-read' : 'api-write';
    const key = `${prefix}${policy}:${authenticated ? `user:${user(req)}` : `ip:${digest(ip(req))}`}`;
    const capacity = authenticated ? (reading ? apiBurst : options.writeBurst ?? config.RATE_LIMIT_WRITE_BURST) : (reading ? anonymousPerMinute : config.RATE_LIMIT_WRITE_BURST);
    const perMinute = authenticated ? (reading ? apiPerMinute : options.writePerMinute ?? config.RATE_LIMIT_WRITE_PER_MINUTE) : (reading ? anonymousPerMinute : config.RATE_LIMIT_WRITE_PER_MINUTE);
    try {
      let result;
      try { result = await shared.consume(key, capacity, perMinute); }
      catch {
        if (Date.now() - lastWarning > minute) {
          lastWarning = Date.now();
          logger.warn('rate_limit.store_unavailable', { policy: 'api', readFallback: ['GET', 'HEAD'].includes(req.method) });
        }
        if (!['GET', 'HEAD'].includes(req.method)) return void unavailable(res);
        // Degradación acotada por instancia para conservar lecturas y sesiones.
        result = fallback.consume(key, capacity, perMinute);
      }
      res.set('RateLimit-Remaining', String(result.remaining));
      if (!result.allowed) {
        recordBlocked(policy);
        return void blocked(res, result.retryAfterSeconds);
      }
      next();
    } catch { unavailable(res); }
  };

  const loginIp = fixed('login-ip', 500, 15 * minute, ip);
  const compose = (...handlers: RequestHandler[]): RequestHandler => (req, res, next) => {
    let index = 0;
    const run = (error?: unknown) => error ? next(error) : index === handlers.length ? next() : handlers[index++](req, res, run);
    run();
  };

  return {
    api,
    ingress: fixed('ingress', config.RATE_LIMIT_IP_PER_MINUTE, minute, ip, false, true),
    login: loginIp,
    async beginLogin(email: string, res: Response) {
      const ticket = randomUUID();
      try {
        const result = await login.apply(loginKey(email), 'begin', ticket);
        if (!result.allowed) { recordBlocked('login-backoff'); blocked(res, result.retryAfterSeconds); return; }
        return ticket;
      } catch { warnUnavailable('login-backoff'); unavailable(res); }
    },
    async finishLogin(email: string, ticket: string, outcome: 'failure' | 'success', res: Response) {
      try {
        const result = await login.apply(loginKey(email), outcome, ticket);
        if (result.allowed) return true;
      } catch { warnUnavailable('login-backoff'); }
      unavailable(res);
      return false;
    },
    async releaseLogin(email: string, ticket: string) {
      try { await login.apply(loginKey(email), 'release', ticket); }
      catch { warnUnavailable('login-backoff'); }
    },
    async resetLogin(email: string) {
      // Solo se llama después de una prueba válida de segundo factor o de
      // recuperar la contraseña; nunca con un correo recibido sin verificar.
      try { await login.apply(loginKey(email), 'reset'); }
      catch { warnUnavailable('login-backoff'); }
    },
    register: compose(fixed('register-ip', 300, 60 * minute, ip), fixed('register-account', 5, 60 * minute, account)),
    forgot: compose(fixed('forgot-ip', 100, 15 * minute, ip), fixed('forgot-account', 5, 60 * minute, account)),
    reset: compose(fixed('reset-ip', 100, 15 * minute, ip), fixed('reset-token', 10, 15 * minute, req => digest(field(req, 'token', 256)), true)),
    twoFactor: compose(fixed('two-factor-ip', 500, 15 * minute, ip), fixed('two-factor-token', 5, 15 * minute, req => digest(field(req, 'challengeToken', 256)))),
    async allowChallenge(req: Request, res: Response) {
      try {
        const result = await shared.consume(`${prefix}challenge-issue:${account(req)}`, 6, 0.6);
        if (!result.allowed) blocked(res, result.retryAfterSeconds);
        return result.allowed;
      } catch { unavailable(res); return false; }
    },
    password: fixed('password-check', 5, 15 * minute, user, true),
    drive: fixed('drive-import', 20, 15 * minute, user),
    expensive: fixed('expensive', config.RATE_LIMIT_EXPENSIVE_PER_15_MINUTES, 15 * minute, user),
    checkout: fixed('checkout', 10, 15 * minute, user),
    service: fixed('service-callback', 600, minute, ip),
    forbidden: fixed('forbidden', 20, 5 * minute, user),
    setup: fixed('setup', 5, 15 * minute, ip),
    health: fixed('health', 120, minute, ip, false, true),
    snapshot: () => Object.fromEntries([...blockedPolicies].map(([policy, state]) => [policy, state.total])),
    async isReady() {
      if (!shared.url) return true;
      try { return await shared.command(['PING']) === 'PONG'; } catch { return false; }
    },
    close: () => shared.close(),
  };
}

export const securityLimits = createSecurityLimits();
