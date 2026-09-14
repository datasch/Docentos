/**
 * Foto de perfil por defecto.
 *
 * Quien no ha subido foto sale con el logo de la escuela, no con un retrato de
 * banco de imagenes: una cara inventada hace pensar que ahi hay una persona
 * concreta cuando no la hay.
 *
 * `avatarSrc` tambien reemplaza los retratos de archivo que quedaron guardados
 * en la base de datos de instalaciones anteriores. Se resuelve al pintar en vez
 * de reescribir la base: asi no se toca la foto real de nadie y deshacerlo es
 * cambiar este archivo.
 */

export const DEFAULT_AVATAR = '/logo.avif';

/**
 * Los retratos de archivo que dejaron el sembrado y las versiones anteriores
 * salen todos del mismo banco de imagenes. Se descarta el dominio entero en vez
 * de ir listando fotos una por una: nadie aloja ahi su foto de perfil de
 * verdad, y cada instalacion vieja traia unas distintas.
 */
const BANCO_DE_IMAGENES = 'images.unsplash.com';

export function avatarSrc(url?: string | null): string {
  const value = String(url ?? '').trim();
  if (!value) return DEFAULT_AVATAR;
  if (value.includes(BANCO_DE_IMAGENES)) return DEFAULT_AVATAR;
  return value;
}
