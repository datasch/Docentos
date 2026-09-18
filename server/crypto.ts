/**
 * Cifrado simetrico de datos sensibles en reposo.
 *
 * Una contrasena se hashea y no se recupera nunca. Hay datos que no admiten ese
 * trato: el secreto TOTP de un usuario hay que **leerlo entero** en cada inicio
 * de sesion para recalcular el codigo de seis digitos, y una URL de webhook hay
 * que enviarla tal cual. Para esos, hashear no sirve: o se cifran, o viajan en
 * claro dentro de la base.
 *
 * Aqui se cifran con AES-256-GCM, que ademas de ocultar **autentica**: si
 * alguien edita el texto cifrado en la base, el descifrado falla en vez de
 * devolver basura silenciosamente.
 *
 * ## Formato del sobre
 *
 *     enc:v1:<iv-base64>:<tag-base64>:<texto-cifrado-base64>
 *
 * El prefijo cumple dos funciones. Deja ver de un vistazo que una fila esta
 * cifrada, y permite que convivan filas antiguas en claro con filas nuevas
 * cifradas sin migrar datos a mano: `descifrarSiHaceFalta` devuelve tal cual lo
 * que no lleve el prefijo. El `v1` esta para poder cambiar de algoritmo mas
 * adelante sin adivinar que era cada fila.
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { config } from './config.js';

const ALGORITMO = 'aes-256-gcm';
const PREFIJO = 'enc:v1';
/** GCM se usa con 96 bits de vector de inicializacion: es lo que recomienda NIST SP 800-38D. */
const BYTES_IV = 12;
const BYTES_CLAVE = 32;

/**
 * Clave de desarrollo, derivada de una cadena fija.
 *
 * Solo se usa fuera de produccion, y existe para que `npm test` y un `git
 * clone` recien hecho funcionen sin preparar secretos. En produccion la
 * configuracion **se niega a arrancar** sin `DOCENTOS_ENCRYPTION_KEY`
 * (`server/config.ts`), asi que esta rama no puede alcanzarse alli.
 */
const CLAVE_DESARROLLO = createHash('sha256').update('docentos-clave-de-desarrollo-no-usar-en-produccion').digest();

let avisoEmitido = false;

function claveMaestra(): Buffer {
  const declarada = config.DOCENTOS_ENCRYPTION_KEY;
  if (!declarada) {
    if (!avisoEmitido) {
      console.warn(
        'DocentOS: falta DOCENTOS_ENCRYPTION_KEY. Se usa una clave de desarrollo fija y publica: los secretos guardados NO estan protegidos. Ejecuta `npm run secrets:init` antes de usar esto de verdad.',
      );
      avisoEmitido = true;
    }
    return CLAVE_DESARROLLO;
  }
  return decodificarClave(declarada);
}

/**
 * Acepta la clave en base64 o en hexadecimal, y exige 32 bytes.
 *
 * Se valida aqui y no solo en el esquema de configuracion porque el error hay
 * que darlo con el motivo exacto: una clave de 16 bytes es un fallo de
 * operacion, no un texto mal escrito, y "longitud invalida" no dice que hacer.
 */
export function decodificarClave(valor: string): Buffer {
  const limpio = valor.trim();
  const esHex = /^[0-9a-fA-F]+$/.test(limpio) && limpio.length === BYTES_CLAVE * 2;
  const clave = Buffer.from(limpio, esHex ? 'hex' : 'base64');
  if (clave.length !== BYTES_CLAVE) {
    throw new Error(
      `DOCENTOS_ENCRYPTION_KEY debe tener ${BYTES_CLAVE} bytes (256 bits) en base64 o hexadecimal; la recibida tiene ${clave.length}. Genera una con: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`,
    );
  }
  return clave;
}

/** Genera una clave maestra nueva, lista para pegar en el `.env`. */
export function generarClaveMaestra(): string {
  return randomBytes(BYTES_CLAVE).toString('base64');
}

export function estaCifrado(valor: string): boolean {
  return typeof valor === 'string' && valor.startsWith(`${PREFIJO}:`);
}

export function cifrar(textoPlano: string): string {
  const iv = randomBytes(BYTES_IV);
  const cifrador = createCipheriv(ALGORITMO, claveMaestra(), iv);
  const cifrado = Buffer.concat([cifrador.update(textoPlano, 'utf8'), cifrador.final()]);
  const etiqueta = cifrador.getAuthTag();
  return [PREFIJO, iv.toString('base64'), etiqueta.toString('base64'), cifrado.toString('base64')].join(':');
}

export function descifrar(sobre: string): string {
  if (!estaCifrado(sobre)) {
    throw new Error('El valor no viene cifrado por DocentOS: falta el prefijo del sobre.');
  }
  // El texto cifrado en base64 nunca contiene ':', asi que partir en cuatro es
  // seguro; se limita el numero de trozos por si algun dia lo contuviera.
  const partes = sobre.split(':');
  if (partes.length !== 5) {
    throw new Error('Sobre cifrado con un numero de campos inesperado.');
  }
  const [, , ivB64, etiquetaB64, cifradoB64] = partes;
  const descifrador = createDecipheriv(ALGORITMO, claveMaestra(), Buffer.from(ivB64, 'base64'));
  descifrador.setAuthTag(Buffer.from(etiquetaB64, 'base64'));
  return Buffer.concat([descifrador.update(Buffer.from(cifradoB64, 'base64')), descifrador.final()]).toString('utf8');
}

/**
 * Lee un valor que puede venir cifrado o en claro.
 *
 * Es el camino de lectura de los datos que ya existian antes de que hubiera
 * cifrado —la configuracion de los plugins, sin ir mas lejos—. Se reescriben
 * cifrados en cuanto alguien los guarda; mientras tanto se siguen leyendo.
 */
export function descifrarSiHaceFalta(valor: string): string {
  return estaCifrado(valor) ? descifrar(valor) : valor;
}
