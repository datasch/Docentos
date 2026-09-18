/**
 * Contrasenas de un solo uso por tiempo (TOTP), RFC 6238 sobre HOTP (RFC 4226).
 *
 * Es lo que hablan Google Authenticator, Aegis, 1Password y el resto: un
 * secreto compartido en base32, un contador que avanza cada 30 segundos y un
 * HMAC-SHA1 truncado a seis digitos. No hace falta biblioteca: son cuarenta
 * lineas de `node:crypto` y asi no entra una dependencia mas en el camino de la
 * autenticacion, que es justo donde menos conviene.
 *
 * SHA-1 aqui no es una debilidad heredada: el algoritmo esta fijado por la
 * norma y por lo que aceptan las aplicaciones de movil. HOTP no depende de la
 * resistencia a colisiones de SHA-1, sino de HMAC, que sigue siendo solido.
 */
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/** Segundos que dura cada codigo. 30 es el valor por omision de la norma y el unico que asumen las aplicaciones. */
export const PASO_SEGUNDOS = 30;
export const DIGITOS = 6;
/** 20 bytes = 160 bits, el tamano que recomienda la RFC 4226 para el secreto. */
const BYTES_SECRETO = 20;

const ALFABETO_BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function codificarBase32(datos: Buffer): string {
  let bits = 0;
  let valor = 0;
  let salida = '';
  for (const byte of datos) {
    valor = (valor << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      salida += ALFABETO_BASE32[(valor >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) salida += ALFABETO_BASE32[(valor << (5 - bits)) & 31];
  return salida;
}

export function decodificarBase32(texto: string): Buffer {
  // Las aplicaciones muestran el secreto en grupos de cuatro y con minusculas;
  // quien lo teclee a mano puede traer espacios y el relleno '=' de la norma.
  const limpio = texto.toUpperCase().replace(/[\s=]/g, '');
  let bits = 0;
  let valor = 0;
  const bytes: number[] = [];
  for (const caracter of limpio) {
    const indice = ALFABETO_BASE32.indexOf(caracter);
    if (indice === -1) throw new Error('El secreto TOTP no es base32 valido.');
    valor = (valor << 5) | indice;
    bits += 5;
    if (bits >= 8) {
      bytes.push((valor >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

export function generarSecreto(): string {
  return codificarBase32(randomBytes(BYTES_SECRETO));
}

/** Numero de intervalo de 30 segundos transcurridos desde el epoch. */
export function pasoActual(ahoraMs: number = Date.now()): number {
  return Math.floor(ahoraMs / 1000 / PASO_SEGUNDOS);
}

export function calcularCodigo(secretoBase32: string, paso: number): string {
  const contador = Buffer.alloc(8);
  // El contador viaja como entero de 64 bits big-endian. Se escribe en dos
  // mitades de 32 bits porque `writeUInt32BE` no llega a 64 y `BigInt64` obliga
  // a convertir; el resultado es identico.
  contador.writeUInt32BE(Math.floor(paso / 2 ** 32), 0);
  contador.writeUInt32BE(paso >>> 0, 4);

  const hmac = createHmac('sha1', decodificarBase32(secretoBase32)).update(contador).digest();
  // Truncamiento dinamico de la RFC 4226 §5.3: los 4 bits bajos del ultimo byte
  // eligen desde donde se leen los 31 bits que forman el codigo.
  const desplazamiento = hmac[hmac.length - 1] & 0x0f;
  const binario =
    ((hmac[desplazamiento] & 0x7f) << 24) |
    ((hmac[desplazamiento + 1] & 0xff) << 16) |
    ((hmac[desplazamiento + 2] & 0xff) << 8) |
    (hmac[desplazamiento + 3] & 0xff);
  return String(binario % 10 ** DIGITOS).padStart(DIGITOS, '0');
}

function igualdadConstante(a: string, b: string): boolean {
  const bufferA = Buffer.from(a, 'utf8');
  const bufferB = Buffer.from(b, 'utf8');
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}

/**
 * Comprueba un codigo y devuelve **el paso con el que caso**, o `null`.
 *
 * Devolver el paso no es un detalle: quien llama lo guarda para no aceptar dos
 * veces el mismo codigo. Sin eso, un codigo interceptado sirve durante los
 * segundos que le queden de vida, y el segundo factor deja de ser de un solo
 * uso.
 *
 * La ventana de un paso hacia cada lado absorbe el desfase de reloj del movil.
 * Es lo que recomienda la RFC 6238 §5.2; ampliarla alarga la vida del codigo
 * robado.
 */
export function verificarCodigo(
  secretoBase32: string,
  codigo: string,
  opciones: { ventana?: number; ahoraMs?: number } = {},
): number | null {
  const limpio = codigo.replace(/\s/g, '');
  if (!/^\d{6}$/.test(limpio)) return null;

  const ventana = opciones.ventana ?? 1;
  const centro = pasoActual(opciones.ahoraMs);
  for (let delta = -ventana; delta <= ventana; delta += 1) {
    const paso = centro + delta;
    if (paso < 0) continue;
    if (igualdadConstante(calcularCodigo(secretoBase32, paso), limpio)) return paso;
  }
  return null;
}

/**
 * Construye el `otpauth://` que se convierte en codigo QR.
 *
 * El emisor va dos veces a proposito: delante de la etiqueta, que es lo que
 * leen las aplicaciones antiguas, y como parametro, que es lo que leen las
 * nuevas. Si solo se pone una, media docena de aplicaciones muestran la cuenta
 * sin decir de que servicio es.
 */
export function construirUriOtpauth(entrada: { secreto: string; cuenta: string; emisor: string }): string {
  const emisor = encodeURIComponent(entrada.emisor);
  const cuenta = encodeURIComponent(entrada.cuenta);
  const parametros = new URLSearchParams({
    secret: entrada.secreto,
    issuer: entrada.emisor,
    algorithm: 'SHA1',
    digits: String(DIGITOS),
    period: String(PASO_SEGUNDOS),
  });
  return `otpauth://totp/${emisor}:${cuenta}?${parametros.toString()}`;
}
