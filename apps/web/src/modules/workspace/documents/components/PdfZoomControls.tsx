import { Check, MoreHorizontal, ZoomIn, ZoomOut } from 'lucide-react';

import { Popover } from '../../../../components/Popover';
import { PDF_ZOOM_MENU_OPTIONS, stepPdfZoom, type PdfZoomMode } from './pdfZoom';

export function PdfZoomControls({
  zoomMode,
  onZoomModeChange,
}: {
  zoomMode: PdfZoomMode;
  onZoomModeChange: (mode: PdfZoomMode) => void;
}): React.JSX.Element {
  return (
    <div
      className="document-viewer-zoom-toolbar"
      role="group"
      aria-label="Επίπεδο εστίασης εγγράφου"
    >
      <button
        aria-label="Σμίκρυνση"
        className="document-viewer-zoom-button"
        type="button"
        onClick={() => onZoomModeChange(stepPdfZoom(zoomMode, 'out'))}
      >
        <ZoomOut aria-hidden="true" size={16} />
      </button>
      <button
        aria-label="Μεγέθυνση"
        className="document-viewer-zoom-button"
        type="button"
        onClick={() => onZoomModeChange(stepPdfZoom(zoomMode, 'in'))}
      >
        <ZoomIn aria-hidden="true" size={16} />
      </button>
      <Popover
        align="end"
        panelClassName="document-viewer-zoom-popover"
        renderTrigger={({ open, triggerRef, toggle }) => (
          <button
            aria-expanded={open}
            aria-haspopup="menu"
            aria-label="Επιλογές επιπέδου εστίασης"
            className="document-viewer-zoom-button"
            ref={triggerRef}
            type="button"
            onClick={toggle}
          >
            <MoreHorizontal aria-hidden="true" size={16} />
          </button>
        )}
      >
        {(close) =>
          PDF_ZOOM_MENU_OPTIONS.map((option) => (
            <button
              key={option.label}
              role="menuitemradio"
              aria-checked={zoomMode === option.value}
              type="button"
              onClick={() => {
                onZoomModeChange(option.value);
                close();
              }}
            >
              <Check
                aria-hidden="true"
                className="document-viewer-zoom-check"
                size={14}
              />
              <span>{option.label}</span>
            </button>
          ))
        }
      </Popover>
    </div>
  );
}
