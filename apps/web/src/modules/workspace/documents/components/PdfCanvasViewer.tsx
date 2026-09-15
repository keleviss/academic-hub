import { useEffect, useMemo, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist';

import { ErrorNotice } from '../../../../components/feedback';
import { Spinner } from '../../../../components/Spinner';
import { resolvePdfPageScale, type PdfZoomMode } from './pdfZoom';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

const PAGE_VISIBILITY_THRESHOLDS = [0, 0.25, 0.5, 0.75, 1];

/** Renders each PDF page into its own canvas, stacked in a continuous scroll, ready for future per-page annotation overlays. */
export function PdfCanvasViewer({
  data,
  onVisiblePageChange,
  scrollContainerRef,
  scrollToPage,
  title,
  zoomMode,
}: {
  data: ArrayBuffer;
  onVisiblePageChange?: (pageNumber: number) => void;
  scrollContainerRef?: React.RefObject<HTMLDivElement | null>;
  scrollToPage?: { pageNumber: number; requestId: number } | null;
  title: string;
  zoomMode: PdfZoomMode;
}): React.JSX.Element {
  const [pdfDocument, setPdfDocument] = useState<PDFDocumentProxy | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [basePageSize, setBasePageSize] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [containerSize, setContainerSize] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const canvasRefs = useRef(new Map<number, HTMLCanvasElement>());
  const pageWrapperRefs = useRef(new Map<number, HTMLDivElement>());
  const lastVisiblePageRef = useRef<number | null>(null);
  const renderTasksRef = useRef(new Map<number, RenderTask>());

  const scale = useMemo(
    () => resolvePdfPageScale(zoomMode, basePageSize, containerSize),
    [zoomMode, basePageSize, containerSize],
  );

  useEffect(() => {
    let cancelled = false;
    // pdfjs takes ownership of the buffer it receives, so hand it a copy.
    const loadingTask = pdfjsLib.getDocument({ data: data.slice(0) });

    loadingTask.promise
      .then(async (doc) => {
        if (cancelled) return;
        setError(null);
        setPdfDocument(doc);
        setPageCount(doc.numPages);

        const firstPage = await doc.getPage(1);
        if (cancelled) return;
        const baseViewport = firstPage.getViewport({ scale: 1 });
        setBasePageSize({
          width: baseViewport.width,
          height: baseViewport.height,
        });
      })
      .catch((loadError: unknown) => {
        if (cancelled) return;
        console.error('Failed to load PDF document', loadError);
        setError('Το έγγραφο δεν μπόρεσε να φορτωθεί για προβολή.');
      });

    return () => {
      cancelled = true;
      void loadingTask.destroy();
    };
  }, [data]);

  useEffect(() => {
    const container = scrollContainerRef?.current;
    if (!container) return;

    let frameId: number | null = null;

    function measure() {
      if (!container) return;
      setContainerSize({
        width: container.clientWidth,
        height: container.clientHeight,
      });
    }

    // Coalesce rapid resize events (e.g. dragging the window edge) into one measurement per frame.
    function scheduleMeasure() {
      if (frameId !== null) return;
      frameId = window.requestAnimationFrame(() => {
        frameId = null;
        measure();
      });
    }

    measure();
    const observer = new ResizeObserver(scheduleMeasure);
    observer.observe(container);
    return () => {
      observer.disconnect();
      if (frameId !== null) window.cancelAnimationFrame(frameId);
    };
  }, [scrollContainerRef]);

  useEffect(() => {
    if (!pdfDocument) return;
    let cancelled = false;
    const renderTasks = renderTasksRef.current;

    async function renderPages(doc: PDFDocumentProxy) {
      for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
        if (cancelled) return;
        const canvas = canvasRefs.current.get(pageNumber);
        if (!canvas) continue;

        const page = await doc.getPage(pageNumber);
        if (cancelled) return;

        // A previous render for this page may still be in flight (e.g. a fast resize); pdf.js
        // refuses to render into a canvas that's already rendering, so cancel it first.
        renderTasks.get(pageNumber)?.cancel();

        const viewport = page.getViewport({ scale });
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        const renderTask = page.render({ canvas, viewport });
        renderTasks.set(pageNumber, renderTask);
        try {
          await renderTask.promise;
        } finally {
          if (renderTasks.get(pageNumber) === renderTask) {
            renderTasks.delete(pageNumber);
          }
        }
      }
    }

    void renderPages(pdfDocument).catch((renderError: unknown) => {
      if (renderError instanceof pdfjsLib.RenderingCancelledException) return;
      if (cancelled) return;
      console.error('Failed to render PDF pages', renderError);
      setError('Το έγγραφο δεν μπόρεσε να αποδοθεί για προβολή.');
    });

    return () => {
      cancelled = true;
      for (const task of renderTasks.values()) task.cancel();
      renderTasks.clear();
    };
  }, [pdfDocument, scale]);

  useEffect(() => {
    if (!onVisiblePageChange || pageCount === 0) return;

    const ratios = new Map<number, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const pageNumber = Number(
            (entry.target as HTMLElement).dataset.pageNumber,
          );
          if (!Number.isInteger(pageNumber)) continue;
          ratios.set(
            pageNumber,
            entry.isIntersecting ? entry.intersectionRatio : 0,
          );
        }

        let nextPage: number | null = null;
        let nextRatio = 0;
        for (const [pageNumber, ratio] of ratios) {
          if (ratio > nextRatio) {
            nextPage = pageNumber;
            nextRatio = ratio;
          }
        }

        if (nextPage !== null && nextPage !== lastVisiblePageRef.current) {
          lastVisiblePageRef.current = nextPage;
          onVisiblePageChange(nextPage);
        }
      },
      {
        root: scrollContainerRef?.current ?? null,
        rootMargin: '-10% 0px -30% 0px',
        threshold: PAGE_VISIBILITY_THRESHOLDS,
      },
    );

    for (const wrapper of pageWrapperRefs.current.values()) {
      observer.observe(wrapper);
    }

    return () => {
      observer.disconnect();
    };
  }, [onVisiblePageChange, pageCount, scrollContainerRef]);

  useEffect(() => {
    if (!scrollToPage) return;

    pageWrapperRefs.current.get(scrollToPage.pageNumber)?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  }, [scrollToPage]);

  if (error) return <ErrorNotice>{error}</ErrorNotice>;
  if (!pdfDocument) return <Spinner label="Φόρτωση προβολέα…" />;

  return (
    <div
      className="document-viewer-pages"
      role="document"
      aria-label={`Προβολή ${title}`}
    >
      {Array.from({ length: pageCount }, (_, index) => index + 1).map(
        (pageNumber) => (
          <div
            key={pageNumber}
            className="document-viewer-page-wrapper"
            data-page-number={pageNumber}
            ref={(element) => {
              if (element) pageWrapperRefs.current.set(pageNumber, element);
              else pageWrapperRefs.current.delete(pageNumber);
            }}
          >
            <canvas
              className="document-viewer-page-canvas"
              aria-label={`Σελίδα ${pageNumber}`}
              ref={(element) => {
                if (element) canvasRefs.current.set(pageNumber, element);
                else canvasRefs.current.delete(pageNumber);
              }}
            />
          </div>
        ),
      )}
    </div>
  );
}
