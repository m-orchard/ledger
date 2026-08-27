import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface Props {
  open: boolean;
  onClose: () => void;
  anchor: ReactNode;
  children: ReactNode;
  align?: 'left' | 'right';
}

interface Coords {
  top: number;
  left?: number;
  right?: number;
}

/**
 * A small anchored panel next to its trigger — unlike Modal, no backdrop dimming, doesn't
 * block the rest of the page, and closes on any outside click or Escape. Portals into
 * document.body and positions with `fixed` coordinates (from the trigger's own bounding
 * rect) rather than `absolute`, so it isn't clipped or made scrollable by an `overflow-x-auto`
 * ancestor — e.g. a table wrapper.
 */
export default function Popover({ open, onClose, anchor, children, align = 'left' }: Props) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<Coords | null>(null);

  useLayoutEffect(() => {
    if (!open || !anchorRef.current) return;
    function place() {
      const rect = anchorRef.current!.getBoundingClientRect();
      setCoords(
        align === 'right'
          ? { top: rect.bottom + 4, right: window.innerWidth - rect.right }
          : { top: rect.bottom + 4, left: rect.left }
      );
    }
    place();
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [open, align]);

  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(e: MouseEvent) {
      const target = e.target as Node;
      if (anchorRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('mousedown', onDocMouseDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  return (
    <div className="inline-block" ref={anchorRef}>
      {anchor}
      {open &&
        coords &&
        createPortal(
          <div
            ref={panelRef}
            style={{ position: 'fixed', top: coords.top, left: coords.left, right: coords.right }}
            className="z-50 bg-surface border border-rule rounded-sm p-3 shadow-lg w-44"
          >
            {children}
          </div>,
          document.body
        )}
    </div>
  );
}
