import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';

const POPOVER_GAP_PX = 6;
const POPOVER_VIEWPORT_MARGIN_PX = 16;

/** Shared trigger+portal+positioning behavior for every action/filter/zoom popup menu in the app. */
export function Popover({
  align = 'end',
  panelClassName,
  renderTrigger,
  children,
}: {
  align?: 'start' | 'end';
  panelClassName?: string;
  renderTrigger: (state: {
    open: boolean;
    triggerRef: RefObject<HTMLButtonElement | null>;
    toggle: () => void;
  }) => ReactNode;
  children: (close: () => void) => ReactNode;
}): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const close = () => setOpen(false);

  useLayoutEffect(() => {
    if (!open) return;

    function updatePosition() {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const triggerRect = trigger.getBoundingClientRect();
      const popoverWidth = popoverRef.current?.offsetWidth ?? 0;
      const naturalLeft =
        align === 'end' ? triggerRect.right - popoverWidth : triggerRect.left;

      setPosition({
        top: triggerRect.bottom + POPOVER_GAP_PX,
        left: Math.min(
          Math.max(POPOVER_VIEWPORT_MARGIN_PX, naturalLeft),
          window.innerWidth - popoverWidth - POPOVER_VIEWPORT_MARGIN_PX,
        ),
      });
    }

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open, align]);

  useEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        popoverRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    }

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('pointerdown', handlePointerDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [open]);

  return (
    <>
      {renderTrigger({
        open,
        triggerRef,
        toggle: () => setOpen((value) => !value),
      })}
      {open &&
        createPortal(
          <div
            className={panelClassName}
            ref={popoverRef}
            role="menu"
            style={{
              position: 'fixed',
              top: position?.top ?? 0,
              left: position?.left ?? 0,
              visibility: position ? 'visible' : 'hidden',
            }}
          >
            {children(close)}
          </div>,
          document.body,
        )}
    </>
  );
}
