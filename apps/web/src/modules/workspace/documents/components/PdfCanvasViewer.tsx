import { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentProxy } from 'pdfjs-dist';

import { ErrorNotice } from '../../../../components/feedback';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

const PAGE_SCALE = 1.25;
const PAGE_VISIBILITY_THRESHOLDS = [0, 0.25, 0.5, 0.75, 1];

/** Renders each PDF page into its own canvas, stacked in a continuous scroll, ready for future per-page annotation overlays. */
export function PdfCanvasViewer({
  data,
  onVisiblePageChange,
  title,
}: {
  data: ArrayBuffer;
  onVisiblePageChange?: (pageNumber: number) => void;
  title: string;
}): React.JSX.Element {
  const [pdfDocument, setPdfDocument] = useState<PDFDocumentProxy | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const canvasRefs = useRef(new Map<number, HTMLCanvasElement>());
  const pageWrapperRefs = useRef(new Map<number, HTMLDivElement>());
  const lastVisiblePageRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    // pdfjs takes ownership of the buffer it receives, so hand it a copy.
    const loadingTask = pdfjsLib.getDocument({ data: data.slice(0) });

    loadingTask.promise
      .then((doc) => {
        if (cancelled) return;
        setError(null);
        setPdfDocument(doc);
        setPageCount(doc.numPages);
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
    if (!pdfDocument) return;
    let cancelled = false;

    async function renderPages(doc: PDFDocumentProxy) {
      for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
        if (cancelled) return;
        const canvas = canvasRefs.current.get(pageNumber);
        if (!canvas) continue;

        const page = await doc.getPage(pageNumber);
        if (cancelled) return;

        const viewport = page.getViewport({ scale: PAGE_SCALE });
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        await page.render({ canvas, viewport }).promise;
      }
    }

    void renderPages(pdfDocument).catch((renderError: unknown) => {
      if (cancelled) return;
      console.error('Failed to render PDF pages', renderError);
      setError('Το έγγραφο δεν μπόρεσε να αποδοθεί για προβολή.');
    });

    return () => {
      cancelled = true;
    };
  }, [pdfDocument]);

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
        root: null,
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
  }, [onVisiblePageChange, pageCount]);

  if (error) return <ErrorNotice>{error}</ErrorNotice>;
  if (!pdfDocument) return <p role="status">Φόρτωση προβολέα…</p>;

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
