import { useEffect } from 'react';

/**
 * Gestor Centralizado de Bloqueo de Scroll (Body Scroll Lock)
 * 
 * Previene el scroll del fondo (background scroll leaking) cuando se abren modales
 * o vistas superpuestas. Cuenta con:
 * 1. Contador de referencia (lockCount): maneja modales anidados con precisión.
 * 2. Compensación de ancho de scrollbar: evita el layout shift (salto horizontal)
 *    en navegadores de escritorio (Windows/Linux).
 * 3. Limpieza segura: restaura el estilo original al desmontarse el último diálogo.
 */

let lockCount = 0;
let originalBodyOverflow = '';
let originalHtmlOverflow = '';
let originalBodyPaddingRight = '';
let originalBodyOverscroll = '';
let originalHtmlOverscroll = '';

export function isBodyScrollLocked(): boolean {
  return lockCount > 0;
}

export function lockBodyScroll() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  if (lockCount === 0) {
    const documentElement = document.documentElement;
    const body = document.body;

    originalBodyOverflow = body.style.overflow;
    originalHtmlOverflow = documentElement.style.overflow;
    originalBodyPaddingRight = body.style.paddingRight;
    originalBodyOverscroll = body.style.overscrollBehavior;
    originalHtmlOverscroll = documentElement.style.overscrollBehavior;

    // Calcular el ancho de la barra de desplazamiento para evitar que la página "salte"
    const scrollBarWidth = window.innerWidth - documentElement.clientWidth;
    if (scrollBarWidth > 0) {
      body.style.paddingRight = `${scrollBarWidth}px`;
    }

    // Bloquear el scroll en ambos elementos raíz (html y body) para cubrir todos los motores de navegador
    body.style.overflow = 'hidden';
    documentElement.style.overflow = 'hidden';
    body.style.overscrollBehavior = 'none';
    documentElement.style.overscrollBehavior = 'none';
  }

  lockCount++;
}

export function unlockBodyScroll() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  lockCount = Math.max(0, lockCount - 1);

  if (lockCount === 0) {
    const documentElement = document.documentElement;
    const body = document.body;

    body.style.overflow = originalBodyOverflow;
    documentElement.style.overflow = originalHtmlOverflow;
    body.style.paddingRight = originalBodyPaddingRight;
    body.style.overscrollBehavior = originalBodyOverscroll;
    documentElement.style.overscrollBehavior = originalHtmlOverscroll;
  }
}

/**
 * Resetea el contador y estado para tests unitarios aislados
 */
export function _resetScrollLockForTesting() {
  lockCount = 0;
  originalBodyOverflow = '';
  originalHtmlOverflow = '';
  originalBodyPaddingRight = '';
  originalBodyOverscroll = '';
  originalHtmlOverscroll = '';
}

/**
 * Hook reactivo para bloquear el scroll de la página mientras el componente esté activo
 * @param isLocked Indica si el scroll debe estar bloqueado (por defecto true)
 */
export function useBodyScrollLock(isLocked: boolean = true) {
  useEffect(() => {
    if (!isLocked) return;

    lockBodyScroll();

    return () => {
      unlockBodyScroll();
    };
  }, [isLocked]);
}
