import React, { useEffect, useId, useRef, useState } from 'react';
import { HeartHandshake, X } from 'lucide-react';
import { clampFloatingPoint, floatingAnchor, parseFloatingAnchor, pointFromAnchor, type FloatingPoint, type FloatingViewport } from '../lib/floatingPosition';
import { useTranslation } from 'react-i18next'

interface ListeningFloatingButtonProps {
  unreadCount?: number;
  onClick: () => void;
  /** Cierra el botón flotante; el buzón pasa a vivir en el footer. */
  onDismiss?: () => void;
}

const POSITION_KEY = 'docentos_listening_position_v1';
/** Separación entre enlaces del footer (gap-x-6) y ancho aproximado del enlace acoplado. */
const FOOTER_GAP = 24;
const DOCKED_WIDTH = 132;

/**
 * Vuelo del botón hasta su hueco en el footer, a la izquierda de GitHub. Si el
 * footer está fuera de pantalla, se hunde por el borde inferior en esa
 * dirección: el usuario ve hacia dónde se fue aunque no vea dónde aterriza.
 */
function flyToFooter(element: HTMLElement): Animation | null {
  const github = document.querySelector<HTMLElement>('[data-footer-github]');
  if (!github || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return null;
  const from = element.getBoundingClientRect();
  const to = github.getBoundingClientRect();
  const viewportHeight = window.visualViewport?.height || window.innerHeight;
  const targetX = to.left - FOOTER_GAP - DOCKED_WIDTH / 2;
  const targetY = Math.min(to.top + to.height / 2, viewportHeight + from.height);
  const dx = targetX - (from.left + from.width / 2);
  const dy = targetY - (from.top + from.height / 2);
  // Un arco, no una recta: sube un poco antes de caer hacia el destino.
  const lift = Math.min(80, Math.max(32, Math.abs(dx) * 0.08));
  return element.animate([
    { transform: 'translate(0, 0) scale(1)', opacity: 1 },
    { transform: `translate(${dx * 0.3}px, ${dy * 0.3 - lift}px) scale(0.82)`, opacity: 1, offset: 0.35 },
    { transform: `translate(${dx}px, ${dy}px) scale(0.4)`, opacity: 0 },
  ], { duration: 640, easing: 'cubic-bezier(0.45, 0, 0.25, 1)', fill: 'forwards' });
}

export const ListeningFloatingButton: React.FC<ListeningFloatingButtonProps> = ({ unreadCount = 0, onClick, onDismiss }) => {
  const { t } = useTranslation()
  const button = useRef<HTMLButtonElement>(null);
  const dock = useRef<HTMLDivElement>(null);
  const instructionsId = useId();
  const [position, setPosition] = useState<FloatingPoint | null>(null);
  const [dragging, setDragging] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const dismiss = () => {
    if (!onDismiss || leaving) return;
    setLeaving(true);
    const flight = dock.current ? flyToFooter(dock.current) : null;
    if (!flight) { onDismiss(); return; }
    flight.onfinish = () => onDismiss();
    flight.oncancel = () => onDismiss();
  };
  const anchor = useRef<FloatingPoint | null>(null);
  const suppressClick = useRef(false);
  const gesture = useRef<{ id: number; start: FloatingPoint; origin: FloatingPoint; moved: boolean;
    previousPosition: FloatingPoint | null; previousAnchor: FloatingPoint | null } | null>(null);

  const viewport = (): FloatingViewport => {
    const rect = button.current!.getBoundingClientRect();
    const visible = window.visualViewport;
    const style = getComputedStyle(button.current!);
    const inset = (side: string) => Math.max(12, parseFloat(style.getPropertyValue(`scroll-margin-${side}`)) || 0);
    return { width: visible?.width || document.documentElement.clientWidth, height: visible?.height || window.innerHeight,
      left: visible?.offsetLeft || 0, top: visible?.offsetTop || 0, buttonWidth: rect.width, buttonHeight: rect.height,
      insets: { left: inset('left'), right: inset('right'), top: inset('top'), bottom: inset('bottom') } };
  };

  const save = () => {
    try {
      if (anchor.current) localStorage.setItem(POSITION_KEY, JSON.stringify({ version: 1, ...anchor.current }));
      else localStorage.removeItem(POSITION_KEY);
    } catch { /* El botón también funciona sin almacenamiento disponible. */ }
  };

  useEffect(() => {
    try { anchor.current = parseFloatingAnchor(localStorage.getItem(POSITION_KEY)); } catch { /* Posición predeterminada. */ }
    const restore = () => {
      if (button.current && anchor.current && !gesture.current) setPosition(pointFromAnchor(anchor.current, viewport()));
    };
    restore();
    window.addEventListener('resize', restore);
    window.visualViewport?.addEventListener('resize', restore);
    window.visualViewport?.addEventListener('scroll', restore);
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(restore) : null;
    if (button.current) observer?.observe(button.current);
    return () => {
      window.removeEventListener('resize', restore);
      window.visualViewport?.removeEventListener('resize', restore);
      window.visualViewport?.removeEventListener('scroll', restore);
      observer?.disconnect();
    };
  }, []);

  // En su sitio por defecto, el botón se detiene encima del footer en vez de
  // taparlo: así el footer no necesita reservarle espacio vacío debajo.
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const element = dock.current;
      if (!element) return;
      const footer = document.querySelector('footer');
      if (position || !footer) { element.style.translate = ''; return; }
      const viewportHeight = window.visualViewport?.height || window.innerHeight;
      const restingBottom = viewportHeight - (parseFloat(getComputedStyle(element).bottom) || 0);
      const lift = Math.max(0, restingBottom + 16 - footer.getBoundingClientRect().top);
      element.style.translate = lift ? `0 ${-lift}px` : '';
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    update();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, [position]);

  const moveTo = (point: FloatingPoint) => {
    const bounds = viewport();
    const bounded = clampFloatingPoint(point, bounds);
    anchor.current = floatingAnchor(bounded, bounds);
    setPosition(bounded);
  };

  const cancelGesture = (pointerId: number) => {
    const active = gesture.current;
    if (!active || active.id !== pointerId) return;
    gesture.current = null;
    anchor.current = active.previousAnchor;
    setPosition(active.previousPosition);
    setDragging(false);
    suppressClick.current = active.moved;
  };

  const hasUnread = unreadCount > 0;
  return (
    <div
      ref={dock}
      className={`lp-listening-floating ${onDismiss ? 'lp-listening-floating--closable' : ''}`}
      style={position ? { left: position.x, top: position.y, right: 'auto', bottom: 'auto' } : undefined}
      data-dragging={dragging || undefined}
      data-leaving={leaving || undefined}
    >
      <button
        ref={button}
        type="button"
        className={`lp-listening-floating-btn ${hasUnread ? 'lp-listening-floating-btn--has-unread' : ''} ${position ? 'lp-listening-floating-btn--positioned' : ''}`}
        data-dragging={dragging || undefined}
        data-tooltip-edge={position && position.x > (typeof window !== 'undefined' ? window.innerWidth / 2 - 100 : Infinity) ? 'right' : 'left'}
        data-tooltip-below={position && position.y < 80 || undefined}
        aria-label={hasUnread ? t('abrirBuzonRespuestasPendientes', { count: unreadCount, defaultValue_one: 'Abrir Buzón de escucha, tienes {{count}} respuesta pendiente', defaultValue_other: 'Abrir Buzón de escucha, tienes {{count}} respuestas pendientes' }) : t('abrirBuzonDeEscucha', 'Abrir Buzón de escucha')}
        aria-describedby={instructionsId}
        onPointerDown={event => {
          if (!event.isPrimary || event.button !== 0) return;
          const rect = event.currentTarget.getBoundingClientRect();
          suppressClick.current = false;
          gesture.current = { id: event.pointerId, start: { x: event.clientX, y: event.clientY }, origin: { x: rect.left, y: rect.top },
            moved: false, previousPosition: position, previousAnchor: anchor.current };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={event => {
          const active = gesture.current;
          if (!active || active.id !== event.pointerId) return;
          const dx = event.clientX - active.start.x;
          const dy = event.clientY - active.start.y;
          if (!active.moved && Math.hypot(dx, dy) < 6) return;
          active.moved = true;
          suppressClick.current = true;
          setDragging(true);
          moveTo({ x: active.origin.x + dx, y: active.origin.y + dy });
        }}
        onPointerUp={event => {
          const active = gesture.current;
          if (!active || active.id !== event.pointerId) return;
          gesture.current = null;
          setDragging(false);
          if (active.moved) save();
          if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        onPointerCancel={event => cancelGesture(event.pointerId)}
        onLostPointerCapture={event => cancelGesture(event.pointerId)}
        onKeyDown={event => {
          const directions: Record<string, FloatingPoint> = { ArrowLeft: { x: -24, y: 0 }, ArrowRight: { x: 24, y: 0 }, ArrowUp: { x: 0, y: -24 }, ArrowDown: { x: 0, y: 24 } };
          const delta = directions[event.key];
          if (delta) {
            event.preventDefault();
            const rect = event.currentTarget.getBoundingClientRect();
            moveTo({ x: rect.left + delta.x, y: rect.top + delta.y });
            save();
          } else if (event.key === 'Home') {
            event.preventDefault();
            anchor.current = null;
            setPosition(null);
            save();
          }
        }}
        onClick={event => {
          const blocked = suppressClick.current && event.detail !== 0;
          suppressClick.current = false;
          if (!blocked) onClick();
        }}
      >
        <HeartHandshake aria-hidden className="lp-listening-icon" />
        <span className="lp-listening-text">{t('buzonDeEscucha', 'Buzón de escucha')}</span>
        {hasUnread && <span className="lp-listening-floating-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>}
        <span className="lp-listening-floating-tooltip" aria-hidden="true">
          {hasUnread ? t('tienesRespuestasNuevasPulsaParaLeerlas', 'Tienes respuestas nuevas · Pulsa para leerlas') : t('pulsaParaAbrirArrastraParaMover', 'Pulsa para abrir · Arrastra para mover')}
        </span>
      </button>
      {onDismiss && (
        <button
          type="button"
          className="lp-listening-close"
          aria-label={t('cerrarElBotonFlotanteDelBuzonDeEscucha', 'Cerrar el botón flotante del Buzón de escucha. Seguirá disponible en el pie de página.')}
          title={t('cerrar', 'Cerrar')}
          onClick={dismiss}
        >
          <X aria-hidden />
        </button>
      )}
      <span id={instructionsId} className="sr-only">{t('puedesMoverEsteBotonArrastrandoloOConLas', 'Puedes mover este botón arrastrándolo o con las flechas del teclado. La tecla Inicio restablece su posición.')}</span>
    </div>
  );
};
