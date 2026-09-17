/**
 * Que parte de la configuracion de un plugin puede ver quien no es
 * administrador.
 *
 * `/api/plugins` esta abierto a cualquier cuenta autenticada, porque el panel
 * del alumno necesita saber que plugins hay activos. Pero la configuracion de
 * un plugin puede contener una credencial: una URL de webhook de Discord es,
 * por si sola, permiso para publicar en ese canal.
 *
 * Antes esto se resolvia enmascarando un plugin concreto por su id
 * (`discord-slack-bridge`). Dos problemas medidos:
 *
 *   1. `discord-webhooks`, que guarda exactamente el mismo tipo de URL, no
 *      estaba en la lista y se servia entero.
 *   2. Enmascarar con `'***'` deja un valor *verdadero*: el cliente creia
 *      tener webhook y lanzaba la peticion igual, contra una URL invalida.
 *
 * Aqui la regla es por forma del dato, no por id: si la clave parece una
 * credencial y su valor es una cadena con contenido, **la clave desaparece**.
 * Asi el cliente ve que no hay webhook y no lo intenta.
 */

/** Fragmentos que delatan una credencial en el nombre de la clave. */
const SECRET_KEY_HINTS = [
  'webhook',
  'apikey',
  'api_key',
  'token',
  'secret',
  'password',
  'passphrase',
  'privatekey',
  'private_key',
  'credential',
];

export function isSecretConfigKey(key: string): boolean {
  // Se normalizan los separadores en los dos lados: sin quitar el guion bajo
  // de la clave, `api_key` no casaba con la pista `apikey` y pasaba entera.
  const limpia = (valor: string) => valor.toLowerCase().replace(/[\s_-]/g, '');
  const normalized = limpia(key);
  return SECRET_KEY_HINTS.some((hint) => normalized.includes(limpia(hint)));
}

/**
 * Devuelve la configuracion tal cual para administracion, y sin las
 * credenciales para todos los demas.
 *
 * Solo se retiran valores de tipo cadena no vacia: `apiKeyConfigured: true` es
 * un indicador de estado, no una clave, y el panel lo necesita para saber si
 * la integracion esta lista.
 */
export function redactPluginConfig(
  config: Record<string, unknown>,
  isAdmin: boolean,
): Record<string, unknown> {
  if (isAdmin) return config;
  const visible: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(config)) {
    if (isSecretConfigKey(key) && typeof value === 'string' && value.trim() !== '') continue;
    visible[key] = value;
  }
  return visible;
}
