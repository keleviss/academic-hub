export type PdfZoomMode =
  | 'automatic'
  | 'actual-size'
  | 'page-fit'
  | 'page-width'
  | number;

export const PDF_ZOOM_NUMERIC_PRESETS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3];

export const PDF_ZOOM_MENU_OPTIONS: Array<{
  value: PdfZoomMode;
  label: string;
}> = [
  { value: 'automatic', label: 'Αυτόματη προσαρμογή' },
  { value: 'actual-size', label: 'Πραγματικό μέγεθος' },
  { value: 'page-fit', label: 'Προσαρμογή σελίδας' },
  { value: 'page-width', label: 'Πλάτος σελίδας' },
  ...PDF_ZOOM_NUMERIC_PRESETS.map((scale) => ({
    value: scale,
    label: `${Math.round(scale * 100)}%`,
  })),
];

export function pdfZoomLabel(mode: PdfZoomMode): string {
  if (typeof mode === 'number') return `${Math.round(mode * 100)}%`;
  return (
    PDF_ZOOM_MENU_OPTIONS.find((option) => option.value === mode)?.label ??
    mode
  );
}

/** Steps through the numeric presets; non-numeric modes (fit/width/automatic) step from an assumed 100% baseline. */
export function stepPdfZoom(mode: PdfZoomMode, direction: 'in' | 'out'): PdfZoomMode {
  const reference = typeof mode === 'number' ? mode : 1;

  if (direction === 'in') {
    const next = PDF_ZOOM_NUMERIC_PRESETS.find(
      (preset) => preset > reference + 0.001,
    );
    return next ?? PDF_ZOOM_NUMERIC_PRESETS[PDF_ZOOM_NUMERIC_PRESETS.length - 1];
  }

  const previous = [...PDF_ZOOM_NUMERIC_PRESETS]
    .reverse()
    .find((preset) => preset < reference - 0.001);
  return previous ?? PDF_ZOOM_NUMERIC_PRESETS[0];
}

const PAGE_MEASURE_PADDING_PX = 32;

/** Resolves a zoom mode to an actual page render scale given the first page's intrinsic size and the visible container size. */
export function resolvePdfPageScale(
  mode: PdfZoomMode,
  basePageSize: { width: number; height: number } | null,
  containerSize: { width: number; height: number } | null,
): number {
  if (typeof mode === 'number') return mode;
  if (!basePageSize || !containerSize || containerSize.width <= 0) return 1;

  const availableWidth = Math.max(
    containerSize.width - PAGE_MEASURE_PADDING_PX,
    1,
  );

  if (mode === 'actual-size') return 1;
  if (mode === 'page-width') return availableWidth / basePageSize.width;
  if (mode === 'page-fit') {
    const availableHeight = Math.max(
      containerSize.height - PAGE_MEASURE_PADDING_PX,
      1,
    );
    return Math.min(
      availableWidth / basePageSize.width,
      availableHeight / basePageSize.height,
    );
  }

  // 'automatic' approximates pdf.js's default: fit to width, but never zoom in past 100%.
  return Math.min(availableWidth / basePageSize.width, 1);
}
