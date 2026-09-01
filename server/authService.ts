import { createHash, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { NextFunction, Request, Response } from 'express';
import { prisma } from './prisma.js';
import { AuthenticatedUser } from './authMiddleware.js';

const SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME?.trim() || 'docentos_session';
const BCRYPT_ROUNDS = 12;
const DEFAULT_SESSION_TTL_DAYS = 7;
const DEFAULT_PASSWORD_RESET_TTL_MINUTES = 30;

function getSessionTtlMs() {
  const configuredDays = Number(process.env.SESSION_TTL_DAYS || DEFAULT_SESSION_TTL_DAYS);
  const safeDays =
    Number.isFinite(configuredDays) && configuredDays > 0
      ? Math.min(configuredDays, 30)
      : DEFAULT_SESSION_TTL_DAYS;
  return safeDays * 24 * 60 * 60 * 1000;
}

function useSecureCookie() {
  if (process.env.SESSION_COOKIE_SECURE === 'true') return true;
  if (process.env.SESSION_COOKIE_SECURE === 'false') return false;
  return Boolean(process.env.APP_URL?.startsWith('https://'));
}

function cookieOptions() {
  return {
    httpOnly: true,
    secure: useSecureCookie(),
    sameSite: 'lax' as const,
    path: '/',
    maxAge: getSessionTtlMs(),
  };
}

function parseCookies(cookieHeader?: string) {
  if (!cookieHeader) return new Map<string, string>();

  const safeDecode = (value: string) => {
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  };

  return new Map(
    cookieHeader
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const separator = part.indexOf('=');
        const name = separator >= 0 ? part.slice(0, separator) : part;
        const value = separator >= 0 ? part.slice(separator + 1) : '';
        return [safeDecode(name), safeDecode(value)];
      }),
  );
}

export function hashSessionToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(password: string, passwordHash: string) {
  return bcrypt.compare(password, passwordHash);
}

export async function createPasswordResetToken(userId: string) {
  const configuredMinutes = Number(
    process.env.PASSWORD_RESET_TTL_MINUTES || DEFAULT_PASSWORD_RESET_TTL_MINUTES,
  );
  const ttlMinutes =
    Number.isFinite(configuredMinutes) && configuredMinutes > 0
      ? Math.min(configuredMinutes, 120)
      : DEFAULT_PASSWORD_RESET_TTL_MINUTES;
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

  await prisma.passwordResetToken.deleteMany({
    where: {
      userId,
      OR: [{ expiresAt: { lte: new Date() } }, { usedAt: { not: null } }],
    },
  });
  await prisma.passwordResetToken.updateMany({
    where: { userId, usedAt: null, expiresAt: { gt: new Date() } },
    data: { usedAt: new Date() },
  });
  await prisma.passwordResetToken.create({
    data: { userId, tokenHash: hashSessionToken(token), expiresAt },
  });

  return { token, expiresAt };
}

export async function recordAuditEvent(
  req: Request,
  event: {
    action: string;
    targetType: string;
    targetId?: string | null;
    actorUserId?: string | null;
    metadata?: Record<string, unknown>;
  },
) {
  return prisma.auditLog.create({
    data: {
      actorUserId: event.actorUserId === undefined ? req.user?.id : event.actorUserId,
      action: event.action,
      targetType: event.targetType,
      targetId: event.targetId,
      metadataJson: JSON.stringify(event.metadata || {}),
      ipAddress: req.ip?.slice(0, 100),
      userAgent: req.get('user-agent')?.slice(0, 500),
    },
  });
}

export async function createUserSession(userId: string, req: Request) {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + getSessionTtlMs());

  await prisma.session.deleteMany({
    where: {
      userId,
      OR: [{ expiresAt: { lte: new Date() } }, { revokedAt: { not: null } }],
    },
  });

  const session = await prisma.session.create({
    data: {
      userId,
      tokenHash: hashSessionToken(token),
      expiresAt,
      userAgent: req.get('user-agent')?.slice(0, 500),
      ipAddress: req.ip?.slice(0, 100),
    },
  });

  return { token, session };
}

export function setSessionCookie(res: Response, token: string) {
  res.cookie(SESSION_COOKIE_NAME, token, cookieOptions());
}

export function clearSessionCookie(res: Response) {
  const { maxAge: _maxAge, ...options } = cookieOptions();
  res.clearCookie(SESSION_COOKIE_NAME, options);
}

export async function resolveRequestSession(req: Request) {
  const token = parseCookies(req.headers.cookie).get(SESSION_COOKIE_NAME);
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    include: { user: true },
  });

  if (!session || session.revokedAt || session.expiresAt <= new Date() || !session.user.isActive) {
    if (session && !session.revokedAt) {
      await prisma.session.update({
        where: { id: session.id },
        data: { revokedAt: new Date() },
      });
    }
    return null;
  }

  await prisma.session.update({
    where: { id: session.id },
    data: { lastUsedAt: new Date() },
  });

  const user: AuthenticatedUser = {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    role: session.user.role,
    avatarUrl: session.user.avatarUrl,
    strikes: session.user.strikes,
    isActive: session.user.isActive,
  };

  return {
    user,
    session: {
      id: session.id,
      expiresAt: session.expiresAt,
    },
  };
}

export async function revokeRequestSession(req: Request) {
  if (!req.authSession) return;
  await prisma.session.updateMany({
    where: { id: req.authSession.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function revokeAllUserSessions(userId: string) {
  await prisma.session.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export function requireSameOrigin(req: Request, res: Response, next: NextFunction) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();

  const fetchSite = req.get('sec-fetch-site');
  if (fetchSite === 'cross-site') {
    return res.status(403).json({ error: 'Solicitud entre sitios rechazada.' });
  }

  const origin = req.get('origin');
  if (!origin) return next();

  const expectedOrigins = new Set<string>();
  const host = req.get('host');
  if (host) expectedOrigins.add(`${req.protocol}://${host}`);
  if (process.env.APP_URL?.startsWith('http')) expectedOrigins.add(process.env.APP_URL.replace(/\/$/, ''));
  if (process.env.ALLOWED_ORIGIN?.startsWith('http')) {
    expectedOrigins.add(process.env.ALLOWED_ORIGIN.replace(/\/$/, ''));
  }

  if (!expectedOrigins.has(origin.replace(/\/$/, ''))) {
    return res.status(403).json({ error: 'Origen de solicitud no autorizado.' });
  }

  next();
}
