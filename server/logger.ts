/**
 * Logger estructurado y observabilidad para DocentOS LMS
 * Provee formato JSON para entornos de producción, formato legible para desarrollo,
 * enmascaramiento automático de campos sensibles y middleware con correlación X-Request-ID.
 */

import { randomBytes } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const SENSITIVE_KEYS = new Set([
  'password',
  'passwordhash',
  'newpassword',
  'oldpassword',
  'token',
  'secret',
  'authorization',
  'cookie',
  'set-cookie',
  'apikey',
  'rawbody',
  'creditcard',
  'stripe_secret_key',
  'stripe_webhook_secret',
  'gemini_api_key',
  'google_drive_private_key',
]);

/**
 * Enmascara valores sensibles de forma recursiva para evitar fugas en registros.
 */
export function redactSensitiveData(data: any): any {
  if (data === null || data === undefined) return data;
  if (typeof data !== 'object') return data;

  if (Array.isArray(data)) {
    return data.map(redactSensitiveData);
  }

  const sanitized: Record<string, any> = {};
  for (const [key, val] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_KEYS.has(lowerKey)) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof val === 'object' && val !== null) {
      sanitized[key] = redactSensitiveData(val);
    } else {
      sanitized[key] = val;
    }
  }
  return sanitized;
}

const isProduction = process.env.NODE_ENV === 'production';

function emitLog(level: LogLevel, message: string, meta?: Record<string, any>) {
  const timestamp = new Date().toISOString();
  const sanitizedMeta = meta ? redactSensitiveData(meta) : undefined;

  if (isProduction) {
    const logEntry = {
      timestamp,
      level,
      message,
      ...(sanitizedMeta || {}),
    };
    const serialized = JSON.stringify(logEntry);
    if (level === 'error') {
      process.stderr.write(serialized + '\n');
    } else {
      process.stdout.write(serialized + '\n');
    }
  } else {
    const prefix = {
      debug: '🔍 [DEBUG]',
      info: 'ℹ️  [INFO]',
      warn: '⚠️  [WARN]',
      error: '❌ [ERROR]',
    }[level];

    const metaStr = sanitizedMeta && Object.keys(sanitizedMeta).length > 0
      ? ' ' + JSON.stringify(sanitizedMeta)
      : '';
    const output = `${timestamp} ${prefix} ${message}${metaStr}`;

    if (level === 'error') {
      console.error(output);
    } else if (level === 'warn') {
      console.warn(output);
    } else {
      console.log(output);
    }
  }
}

export const logger = {
  debug: (msg: string, meta?: Record<string, any>) => emitLog('debug', msg, meta),
  info: (msg: string, meta?: Record<string, any>) => emitLog('info', msg, meta),
  warn: (msg: string, meta?: Record<string, any>) => emitLog('warn', msg, meta),
  error: (msg: string, meta?: Record<string, any>) => emitLog('error', msg, meta),
};

// Contadores de métricas en memoria para monitoreo operativo
let requestCounter = 0;
const requestLatencies: number[] = [];
const MAX_LATENCY_SAMPLES = 200;

export function recordLatency(durationMs: number) {
  requestLatencies.push(durationMs);
  if (requestLatencies.length > MAX_LATENCY_SAMPLES) {
    requestLatencies.shift();
  }
}

export function getMetricsSnapshot() {
  const samples = requestLatencies.length;
  const avgLatency = samples > 0
    ? Math.round(requestLatencies.reduce((acc, curr) => acc + curr, 0) / samples)
    : 0;

  const sorted = [...requestLatencies].sort((a, b) => a - b);
  const p95Latency = samples > 0
    ? sorted[Math.floor(samples * 0.95)] || sorted[samples - 1]
    : 0;

  const mem = process.memoryUsage();

  return {
    uptimeSeconds: Math.round(process.uptime()),
    totalRequests: requestCounter,
    avgLatencyMs: avgLatency,
    p95LatencyMs: p95Latency,
    memory: {
      rssMb: Math.round(mem.rss / 1024 / 1024),
      heapTotalMb: Math.round(mem.heapTotal / 1024 / 1024),
      heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
    },
  };
}

/**
 * Middleware para asignar Request ID y registrar latencia de peticiones.
 */
export function requestTracingMiddleware(req: Request, res: Response, next: NextFunction) {
  requestCounter++;
  const rawHeader = req.headers['x-request-id'];
  const requestId = (typeof rawHeader === 'string' && rawHeader.trim().length > 0)
    ? rawHeader.trim()
    : `req_${randomBytes(8).toString('hex')}`;

  (req as any).requestId = requestId;
  res.setHeader('X-Request-ID', requestId);

  const start = Date.now();

  res.on('finish', () => {
    const durationMs = Date.now() - start;
    recordLatency(durationMs);

    // Omitir logging ruidoso de endpoints de sondeo constante (/api/health, /api/ready) salvo en error
    const isHealthCheck = req.path === '/api/health' || req.path === '/api/ready';
    if (!isHealthCheck || res.statusCode >= 400) {
      const level: LogLevel = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
      logger[level](`${req.method} ${req.originalUrl || req.url} ${res.statusCode} (${durationMs}ms)`, {
        requestId,
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        durationMs,
        ip: req.ip || req.socket.remoteAddress,
      });
    }
  });

  next();
}
