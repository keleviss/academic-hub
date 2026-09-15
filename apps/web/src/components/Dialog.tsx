import { X } from 'lucide-react';
import { useEffect, useRef } from 'react';

export function Dialog({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}): React.JSX.Element {
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const focusable = panelRef.current?.querySelector<HTMLElement>(
      'input, textarea, select, button:not([aria-label="Κλείσιμο"])',
    );
    (focusable ?? panelRef.current)?.focus();

    return () => {
      previouslyFocused?.focus();
    };
  }, []);

  return (
    <div
      className="course-dialog-layer"
      role="presentation"
      onMouseDown={onClose}
    >
      <section
        ref={panelRef}
        aria-modal="true"
        aria-labelledby="course-dialog-title"
        className="course-dialog"
        role="dialog"
        tabIndex={-1}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="course-dialog-header">
          <h2 id="course-dialog-title">{title}</h2>
          <button
            aria-label="Κλείσιμο"
            className="icon-button"
            type="button"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}
