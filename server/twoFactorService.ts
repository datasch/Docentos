/**
 * Verificacion en dos pasos: alta, confirmacion, retiro y el tramo del login.
 *
 * El diseno se resume en tres decisiones:
 *
 *  1. **El secreto se cifra, no se hashea.** Hay que leerlo entero en cada
 *     comprobacion (`server/crypto.ts` explica por que eso obliga a cifrar).
 *  2. **Un secreto no confirmado no protege nada.** Se guarda al empezar el
 *     alta, pero la cuenta no exige segundo factor hasta que el usuario teclea
 *     un codigo valido. Si no, quien escanee mal el QR se queda fuera de su
 *     propia cuenta.
 *  3. **La sesion no nace a medias.** Con la contrasena correcta y segundo
 *     factor activo no se crea sesion: se crea un reto de vida corta. Asi no
 *     existe en ningun instante una sesion a medio autenticar que el middleware
 *     pudiera aceptar por error.
 */
import { createHash, createHmac, randomBytes } from 'node:crypto';
import type { Request } from 'express';
import QRCode from 'qrcode';
import { prisma } from './prisma.js';
import { config } from './config.js';
import { cifrar, decodificarClave, descifrar } from './crypto.js';
import { construirUriOtpauth, generarSecreto, verificarCodigo } from './totp.js';

/** Diez codigos es el numero que usan GitHub y Google: bastantes para no quedarse sin ellos, pocos para imprimirlos. */
const CODIGOS_RECUPERACION = 10;
/**
 * Intentos por reto antes de invalidarlo.
 *
 * El limitador de peticiones ya frena la fuerza bruta por IP; esto frena la que
 * llega repartida entre muchas IP contra una sola cuenta. Con cinco intentos,
 * acertar un codigo de seis digitos por azar es 5 entre un millon.
 */
const MAX_INTENTOS_RETO = 5;

export function hashDeToken(valor: string) {
  return createHash('sha256').update(valor).digest('hex');
}

/**
 * Deja un codigo de recuperacion en su forma canonica.
 *
 * Quien lo copia de un papel trae guiones, espacios y minusculas indistintas.
 * Nada de eso deberia decidir si entra o no.
 */
export function normalizarCodigoRecuperacion(codigo: string) {
  return codigo.replace(/[^0-9a-zA-Z]/g, '').toUpperCase();
}

function generarCodigoRecuperacion() {
  const bruto = randomBytes(10).toString('hex').toUpperCase();
  return bruto.match(/.{1,5}/g)!.join('-');
}

export function hashCodigoRecuperacion(codigo: string) {
  const maestra = config.DOCENTOS_ENCRYPTION_KEY
    ? decodificarClave(config.DOCENTOS_ENCRYPTION_KEY)
    : createHash('sha256').update('docentos-clave-de-desarrollo-no-usar-en-produccion').digest();
  const clave = createHmac('sha256', maestra).update('docentos:recovery-code:v2').digest();
  return createHmac('sha256', clave).update(normalizarCodigoRecuperacion(codigo)).digest('hex');
}

export type EstadoDosFactores = {
  activo: boolean;
  configuracionPendiente: boolean;
  activadoEl: Date | null;
  codigosDisponibles: number;
};

export async function estadoDeUsuario(userId: string): Promise<EstadoDosFactores> {
  const usuario = await prisma.user.findUnique({
    where: { id: userId },
    select: { twoFactorSecret: true, twoFactorEnabledAt: true },
  });
  if (!usuario) throw new Error('La cuenta no existe.');

  const codigosDisponibles = usuario.twoFactorEnabledAt
    ? await prisma.twoFactorRecoveryCode.count({ where: { userId, usedAt: null } })
    : 0;

  return {
    activo: Boolean(usuario.twoFactorEnabledAt),
    configuracionPendiente: Boolean(usuario.twoFactorSecret) && !usuario.twoFactorEnabledAt,
    activadoEl: usuario.twoFactorEnabledAt,
    codigosDisponibles,
  };
}

/**
 * Primer paso del alta: genera el secreto y devuelve el QR.
 *
 * Cada llamada genera un secreto nuevo y descarta el anterior mientras el
 * segundo factor no este activo. Es deliberado: quien abre la pantalla dos
 * veces se queda con el QR que tiene delante, no con uno viejo que ya no
 * aparece en ninguna pantalla.
 */
export async function iniciarConfiguracion(userId: string) {
  const usuario = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, twoFactorEnabledAt: true },
  });
  if (!usuario) throw new Error('La cuenta no existe.');
  if (usuario.twoFactorEnabledAt) {
    throw new Error('La verificación en dos pasos ya está activa en esta cuenta.');
  }

  const secreto = generarSecreto();
  await prisma.user.update({
    where: { id: userId },
    data: { twoFactorSecret: cifrar(secreto), twoFactorLastStep: null },
  });

  const uri = construirUriOtpauth({ secreto, cuenta: usuario.email, emisor: config.APP_NAME });
  // El QR se genera en el servidor y viaja como imagen embebida. Asi el secreto
  // no pasa por ninguna biblioteca de terceros en el navegador ni por un
  // servicio externo de codigos QR, que es como se filtran estos secretos.
  const qr = await QRCode.toDataURL(uri, { errorCorrectionLevel: 'M', margin: 1, width: 240 });

  return { secreto, uri, qr };
}

/**
 * Segundo paso del alta: confirma con un codigo y entrega los de recuperacion.
 *
 * Los codigos se devuelven **una sola vez**. Guardarlos legibles para poder
 * volver a ensenarlos seria guardar diez contrasenas en claro.
 */
export async function activar(userId: string, codigo: string) {
  const usuario = await prisma.user.findUnique({
    where: { id: userId },
    select: { twoFactorSecret: true, twoFactorEnabledAt: true },
  });
  if (!usuario) throw new Error('La cuenta no existe.');
  if (usuario.twoFactorEnabledAt) throw new Error('La verificación en dos pasos ya está activa.');
  if (!usuario.twoFactorSecret) throw new Error('No hay una configuración en curso. Vuelve a empezar.');

  const paso = verificarCodigo(descifrar(usuario.twoFactorSecret), codigo);
  if (paso === null) return null;

  const codigos = Array.from({ length: CODIGOS_RECUPERACION }, generarCodigoRecuperacion);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabledAt: new Date(), twoFactorLastStep: paso },
    }),
    prisma.twoFactorRecoveryCode.deleteMany({ where: { userId } }),
    prisma.twoFactorRecoveryCode.createMany({
      data: codigos.map((codigoClaro) => ({
        userId,
        codeHash: hashCodigoRecuperacion(codigoClaro),
      })),
    }),
  ]);

  return { codigos };
}

/** Retira el segundo factor y borra todo su rastro: secreto, codigos y retos vivos. */
export async function desactivar(userId: string) {
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { twoFactorSecret: null, twoFactorEnabledAt: null, twoFactorLastStep: null },
    }),
    prisma.twoFactorRecoveryCode.deleteMany({ where: { userId } }),
    prisma.twoFactorChallenge.deleteMany({ where: { userId } }),
  ]);
}

/** Vuelve a emitir los codigos de recuperacion, invalidando los anteriores. */
export async function regenerarCodigos(userId: string) {
  const codigos = Array.from({ length: CODIGOS_RECUPERACION }, generarCodigoRecuperacion);
  await prisma.$transaction([
    prisma.twoFactorRecoveryCode.deleteMany({ where: { userId } }),
    prisma.twoFactorRecoveryCode.createMany({
      data: codigos.map((codigoClaro) => ({
        userId,
        codeHash: hashCodigoRecuperacion(codigoClaro),
      })),
    }),
  ]);
  return codigos;
}

export async function crearReto(userId: string, req: Request) {
  const token = randomBytes(32).toString('base64url');
  // Los retos caducados de esta cuenta se van aqui. No hay tarea programada que
  // limpie la tabla, y el sitio natural para hacerlo es justo cuando se crea
  // otro.
  await prisma.twoFactorChallenge.deleteMany({
    where: { userId, OR: [{ expiresAt: { lte: new Date() } }, { consumedAt: { not: null } }] },
  });

  const reto = await prisma.twoFactorChallenge.create({
    data: {
      userId,
      tokenHash: hashDeToken(token),
      expiresAt: new Date(Date.now() + config.TWO_FACTOR_CHALLENGE_TTL_MINUTES * 60 * 1000),
      ipAddress: req.ip?.slice(0, 100),
      userAgent: req.get('user-agent')?.slice(0, 500),
    },
  });

  return { token, reto };
}

export type ResultadoReto =
  | { estado: 'ok'; userId: string; via: 'totp' | 'recuperacion' }
  | { estado: 'reto-invalido' }
  | { estado: 'codigo-invalido' }
  | { estado: 'sin-intentos' };

/**
 * Cierra el segundo tramo del login.
 *
 * Acepta tanto un codigo de la aplicacion como uno de recuperacion: para quien
 * ha perdido el movil, exigir el primero equivale a no tener cuenta.
 */
export async function resolverReto(token: string, codigo: string, _req: Request): Promise<ResultadoReto> {
  const reto = await prisma.twoFactorChallenge.findUnique({
    where: { tokenHash: hashDeToken(token) },
    include: { user: { select: { id: true, twoFactorSecret: true, twoFactorEnabledAt: true, isActive: true } } },
  });

  if (!reto || reto.consumedAt || reto.expiresAt <= new Date()) return { estado: 'reto-invalido' };
  if (!reto.user.isActive || !reto.user.twoFactorEnabledAt || !reto.user.twoFactorSecret) {
    return { estado: 'reto-invalido' };
  }
  if (reto.attempts >= MAX_INTENTOS_RETO) {
    await prisma.twoFactorChallenge.update({ where: { id: reto.id }, data: { consumedAt: new Date() } });
    return { estado: 'sin-intentos' };
  }

  const paso = verificarCodigo(descifrar(reto.user.twoFactorSecret), codigo);
  if (paso !== null) {
    const aceptado = await prisma.$transaction(async (tx) => {
      const userClaim = await tx.user.updateMany({
        where: { id: reto.userId, OR: [{ twoFactorLastStep: null }, { twoFactorLastStep: { lt: paso } }] },
        data: { twoFactorLastStep: paso },
      });
      if (userClaim.count !== 1) return false;
      const challengeClaim = await tx.twoFactorChallenge.updateMany({
        where: { id: reto.id, consumedAt: null, expiresAt: { gt: new Date() }, attempts: { lt: MAX_INTENTOS_RETO } },
        data: { consumedAt: new Date() },
      });
      if (challengeClaim.count !== 1) throw new ClaimLostError();
      return true;
    }).catch((error) => {
      if (error instanceof ClaimLostError) return false;
      throw error;
    });
    if (!aceptado) return { estado: 'codigo-invalido' };
    return { estado: 'ok', userId: reto.userId, via: 'totp' };
  }

  const normalizado = normalizarCodigoRecuperacion(codigo);
  if (normalizado.length >= 10) {
    const guardado = await prisma.twoFactorRecoveryCode.findFirst({
      where: { codeHash: { in: [hashCodigoRecuperacion(normalizado), hashDeToken(normalizado)] } },
    });
    if (guardado && guardado.userId === reto.userId && !guardado.usedAt) {
      const aceptado = await prisma.$transaction(async (tx) => {
        const codeClaim = await tx.twoFactorRecoveryCode.updateMany({
          where: { id: guardado.id, usedAt: null }, data: { usedAt: new Date() },
        });
        if (codeClaim.count !== 1) return false;
        const challengeClaim = await tx.twoFactorChallenge.updateMany({
          where: { id: reto.id, consumedAt: null, expiresAt: { gt: new Date() }, attempts: { lt: MAX_INTENTOS_RETO } },
          data: { consumedAt: new Date() },
        });
        if (challengeClaim.count !== 1) throw new ClaimLostError();
        return true;
      }).catch((error) => {
        if (error instanceof ClaimLostError) return false;
        throw error;
      });
      if (!aceptado) return { estado: 'codigo-invalido' };
      return { estado: 'ok', userId: reto.userId, via: 'recuperacion' };
    }
  }

  await prisma.twoFactorChallenge.update({ where: { id: reto.id }, data: { attempts: { increment: 1 } } });
  return { estado: 'codigo-invalido' };
}

class ClaimLostError extends Error {}
