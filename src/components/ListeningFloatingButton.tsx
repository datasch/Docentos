import React, { useEffect, useId, useRef, useState } from 'react';
import { HeartHandshake } from 'lucide-react';
import { clampFloatingPoint, floatingAnchor, parseFloatingAnchor, pointFromAnchor, type FloatingPoint, type FloatingViewport } from '../lib/floatingPosition';

interface ListeningFloatingButtonProps {
  unreadCount?: number;
  onClick: () => void;
}

const POSITION_KEY = 'docentos_listening_position_v1';

export const ListeningFloatingButton: React.FC<ListeningFloatingButtonProps> = ({ unreadCount = 0, onClick }) => {
  const button = useRef<HTMLButtonElement>(null);
  const instructionsId = useId();
  const [position, setPosition] = useState<FloatingPoint | null>(null);
  const [dragging, setDragging] = useState(false);
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
    <>
      <button
        ref={button}
        type="button"
        className={`lp-listening-floating-btn ${hasUnread ? 'lp-listening-floating-btn--has-unread' : ''} ${position ? 'lp-listening-floating-btn--positioned' : ''}`}
        style={position ? { left: position.x, top: position.y, right: 'auto', bottom: 'auto' } : undefined}
        data-dragging={dragging || undefined}
        data-tooltip-edge={position && position.x > (typeof window !== 'undefined' ? window.innerWidth / 2 - 100 : Infinity) ? 'right' : 'left'}
        data-tooltip-below={position && position.y < 80 || undefined}
        aria-label={hasUnread ? `Abrir Buzón de escucha, tienes ${unreadCount} respuesta${unreadCount > 1 ? 's' : ''} pendiente${unreadCount > 1 ? 's' : ''}` : 'Abrir Buzón de escucha'}
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
        <span className="lp-listening-text">Buzón de escucha</span>
        {hasUnread && <span className="lp-listening-floating-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>}
        <span className="lp-listening-floating-tooltip" aria-hidden="true">
          {hasUnread ? 'Tienes respuestas nuevas · Pulsa para leerlas' : 'Pulsa para abrir · Arrastra para mover'}
        </span>
      </button>
      <span id={instructionsId} className="sr-only">Puedes mover este botón arrastrándolo o con las flechas del teclado. La tecla Inicio restablece su posición.</span>
    </>
  );
};
