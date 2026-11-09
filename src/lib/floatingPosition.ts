export interface FloatingPoint { x: number; y: number }
export interface FloatingViewport {
  width: number; height: number; buttonWidth: number; buttonHeight: number;
  left?: number; top?: number;
  insets?: { left: number; right: number; top: number; bottom: number };
}

function limits(viewport: FloatingViewport) {
  const inset = viewport.insets || { left: 12, right: 12, top: 12, bottom: 12 };
  const minX = (viewport.left || 0) + inset.left;
  const minY = (viewport.top || 0) + inset.top;
  return { minX, minY,
    maxX: Math.max(minX, (viewport.left || 0) + viewport.width - viewport.buttonWidth - inset.right),
    maxY: Math.max(minY, (viewport.top || 0) + viewport.height - viewport.buttonHeight - inset.bottom) };
}

export function clampFloatingPoint(point: FloatingPoint, viewport: FloatingViewport): FloatingPoint {
  const { minX, minY, maxX, maxY } = limits(viewport);
  return { x: Math.max(minX, Math.min(Number.isFinite(point.x) ? point.x : minX, maxX)),
    y: Math.max(minY, Math.min(Number.isFinite(point.y) ? point.y : minY, maxY)) };
}

export function floatingAnchor(point: FloatingPoint, viewport: FloatingViewport): FloatingPoint {
  const bounded = clampFloatingPoint(point, viewport);
  const { minX, minY, maxX, maxY } = limits(viewport);
  return { x: maxX > minX ? (bounded.x - minX) / (maxX - minX) : 0,
    y: maxY > minY ? (bounded.y - minY) / (maxY - minY) : 0 };
}

export function pointFromAnchor(anchor: FloatingPoint, viewport: FloatingViewport): FloatingPoint {
  const { minX, minY, maxX, maxY } = limits(viewport);
  return clampFloatingPoint({ x: minX + anchor.x * (maxX - minX), y: minY + anchor.y * (maxY - minY) }, viewport);
}

export function parseFloatingAnchor(raw: string | null): FloatingPoint | null {
  try {
    const value = JSON.parse(raw || 'null');
    return value?.version === 1 && Number.isFinite(value.x) && Number.isFinite(value.y)
      && value.x >= 0 && value.x <= 1 && value.y >= 0 && value.y <= 1 ? { x: value.x, y: value.y } : null;
  } catch { return null; }
}
