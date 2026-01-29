import type React from 'react';
import { useEffect, useRef, useState } from 'react';

type ZoomableImageProps = {
  src: string;
  alt?: string;
  maxScale?: number;
  className?: string;
};

type Point = { x: number; y: number };
type ViewState = { scale: number; offset: Point };

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function ZoomableImage({ src, alt, maxScale = 4, className }: Readonly<ZoomableImageProps>) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pointersRef = useRef<Map<number, Point>>(new Map());
  const pinchStartDistanceRef = useRef<number | null>(null);
  const pinchStartViewRef = useRef<ViewState>({ scale: 1, offset: { x: 0, y: 0 } });
  const lastPanRef = useRef<Point | null>(null);

  const [view, setView] = useState<ViewState>({ scale: 1, offset: { x: 0, y: 0 } });
  const viewRef = useRef<ViewState>(view);

  const setViewState = (updater: (prev: ViewState) => ViewState) => {
    setView((prev) => {
      const next = updater(prev);
      viewRef.current = next;
      return next;
    });
  };

  useEffect(() => {
    setViewState(() => ({ scale: 1, offset: { x: 0, y: 0 } }));
  }, [src]);

  const clampOffset = (x: number, y: number, scale: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { x, y };
    const maxX = ((scale - 1) * rect.width) / 2;
    const maxY = ((scale - 1) * rect.height) / 2;
    return {
      x: clamp(x, -maxX, maxX),
      y: clamp(y, -maxY, maxY),
    };
  };

  const getPointerArray = () => Array.from(pointersRef.current.values());

  const getDistance = () => {
    const [a, b] = getPointerArray();
    if (!a || !b) return 0;
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.hypot(dx, dy);
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointersRef.current.size === 2) {
      pinchStartDistanceRef.current = getDistance();
      pinchStartViewRef.current = viewRef.current;
    }

    if (pointersRef.current.size === 1 && viewRef.current.scale > 1) {
      lastPanRef.current = { x: event.clientX, y: event.clientY };
    }
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!pointersRef.current.has(event.pointerId)) return;
    if (event.pointerType === 'touch') event.preventDefault();
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointersRef.current.size === 2 && pinchStartDistanceRef.current) {
      const distance = getDistance();
      const ratio = distance / pinchStartDistanceRef.current;
      const nextScale = clamp(pinchStartViewRef.current.scale * ratio, 1, maxScale);
      setViewState((prev) => {
        const clampedOffset = clampOffset(prev.offset.x, prev.offset.y, nextScale);
        return { scale: nextScale, offset: clampedOffset };
      });
      return;
    }

    if (pointersRef.current.size === 1 && viewRef.current.scale > 1) {
      const current = pointersRef.current.values().next().value as Point;
      const last = lastPanRef.current ?? current;
      const dx = current.x - last.x;
      const dy = current.y - last.y;
      lastPanRef.current = current;

      setViewState((prev) => {
        const nextOffset = clampOffset(prev.offset.x + dx, prev.offset.y + dy, prev.scale);
        return { scale: prev.scale, offset: nextOffset };
      });
    }
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    pointersRef.current.delete(event.pointerId);
    lastPanRef.current = null;

    if (pointersRef.current.size < 2) {
      pinchStartDistanceRef.current = null;
    }

    if (pointersRef.current.size === 0 && viewRef.current.scale < 1.02) {
      setViewState(() => ({ scale: 1, offset: { x: 0, y: 0 } }));
    }
  };

  const resetView = () => setViewState(() => ({ scale: 1, offset: { x: 0, y: 0 } }));

  return (
    <div
      ref={containerRef}
      className={['bw-photo-zoomable', className].filter(Boolean).join(' ')}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onDoubleClick={resetView}
      role="presentation"
    >
      <img
        src={src}
        alt={alt ?? ''}
        style={{
          transform: `translate3d(${view.offset.x}px, ${view.offset.y}px, 0) scale(${view.scale})`,
        }}
        draggable={false}
      />
      {view.scale > 1.05 && (
        <button type="button" className="bw-photo-reset" onClick={resetView} aria-label="Restablecer zoom">
          ×
        </button>
      )}
    </div>
  );
}
