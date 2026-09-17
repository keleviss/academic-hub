import { useCallback, useRef, useState } from 'react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';

import {
  fetchCourseDocument,
  fetchCourseDocumentContent,
} from '../../../../api/client';
import { QueryState } from '../../../../components/QueryState';
import { useSetWorkspaceBreadcrumb } from '../../../../components/workspaceBreadcrumb';
import { DocumentAnnotationsPanel } from '../components/DocumentAnnotationsPanel';
import { PdfCanvasViewer } from '../components/PdfCanvasViewer';
import { PdfZoomControls } from '../components/PdfZoomControls';
import type { PdfZoomMode } from '../components/pdfZoom';

function documentQueryKey(courseId: string, documentId: string) {
  return ['courses', courseId, 'documents', documentId] as const;
}

const accessErrorOptions = {
  statuses: {
    403: 'Δεν έχεις πρόσβαση σε αυτό το έγγραφο.',
    404: 'Το έγγραφο δεν βρέθηκε.',
  },
};

const contentErrorOptions = {
  codes: {
    DOCUMENT_CONTENT_UNAVAILABLE:
      'Το περιεχόμενο του εγγράφου δεν είναι προσωρινά διαθέσιμο.',
  },
  statuses: accessErrorOptions.statuses,
  fallback: 'Η φόρτωση του περιεχομένου απέτυχε. Δοκίμασε ξανά.',
};

export function DocumentViewerPage(): React.JSX.Element {
  const { courseId = '', documentId = '' } = useParams();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const requestedPage = Number(searchParams.get('page'));
  const initialPage =
    Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const [visiblePage, setVisiblePage] = useState(initialPage);
  const [pageScrollTarget, setPageScrollTarget] = useState<{
    pageNumber: number;
    requestId: number;
  } | null>(initialPage > 1 ? { pageNumber: initialPage, requestId: 1 } : null);
  const [annotationsPanelCollapsed, setAnnotationsPanelCollapsed] =
    useState(false);
  const [zoomMode, setZoomMode] = useState<PdfZoomMode>('automatic');
  const canvasScrollRef = useRef<HTMLDivElement>(null);
  const documentQuery = useQuery({
    queryKey: documentQueryKey(courseId, documentId),
    queryFn: ({ signal }) => fetchCourseDocument(courseId, documentId, signal),
    enabled: !!courseId && !!documentId,
  });
  useSetWorkspaceBreadcrumb(
    documentQuery.data
      ? [
          { label: 'Μαθήματα', to: '/app/courses' },
          { label: 'Μάθημα', to: `/app/courses/${courseId}` },
          { label: documentQuery.data.data.title },
        ]
      : null,
  );
  const contentQuery = useQuery({
    queryKey: [...documentQueryKey(courseId, documentId), 'content'],
    queryFn: ({ signal }) =>
      fetchCourseDocumentContent(courseId, documentId, signal),
    enabled: !!courseId && !!documentId,
  });
  const handleNavigateToPage = useCallback((pageNumber: number) => {
    setVisiblePage(pageNumber);
    setPageScrollTarget((current) => ({
      pageNumber,
      requestId: (current?.requestId ?? 0) + 1,
    }));
  }, []);

  const courseBackLink =
    (location.state as { courseTab?: string } | null)?.courseTab === 'roadmap'
      ? `/app/courses/${courseId}?tab=roadmap`
      : `/app/courses/${courseId}`;

  return (
    <section className="document-viewer-page">
      <QueryState
        query={documentQuery}
        loadingLabel="Φόρτωση εγγράφου…"
        errorOptions={accessErrorOptions}
      >
        {(document) => {
          const detail = document.data;
          return (
            <>
              <header className="document-viewer-toolbar">
                <Link
                  aria-label="Επιστροφή στο μάθημα"
                  className="document-viewer-back-link"
                  to={courseBackLink}
                >
                  <ArrowLeft aria-hidden="true" size={16} />
                </Link>
                <div className="document-viewer-title-block">
                  <h1>{detail.title}</h1>
                  {detail.description && <p>{detail.description}</p>}
                </div>
              </header>
              <div
                className={
                  annotationsPanelCollapsed
                    ? 'document-viewer is-annotations-collapsed'
                    : 'document-viewer'
                }
              >
                <div className="document-viewer-canvas-area">
                  <div
                    className="document-viewer-canvas-scroll"
                    ref={canvasScrollRef}
                  >
                    <QueryState
                      query={contentQuery}
                      loadingLabel="Φόρτωση περιεχομένου…"
                      errorOptions={contentErrorOptions}
                      onRetry={() => void contentQuery.refetch()}
                    >
                      {(buffer) => (
                        <PdfCanvasViewer
                          data={buffer}
                          title={detail.title}
                          onVisiblePageChange={setVisiblePage}
                          scrollToPage={pageScrollTarget}
                          scrollContainerRef={canvasScrollRef}
                          zoomMode={zoomMode}
                        />
                      )}
                    </QueryState>
                  </div>
                  {contentQuery.data && (
                    <PdfZoomControls
                      zoomMode={zoomMode}
                      onZoomModeChange={setZoomMode}
                    />
                  )}
                </div>
                <DocumentAnnotationsPanel
                  courseId={courseId}
                  currentPage={visiblePage}
                  documentId={documentId}
                  onNavigateToPage={handleNavigateToPage}
                  collapsed={annotationsPanelCollapsed}
                  onCollapsedChange={setAnnotationsPanelCollapsed}
                  pageCount={detail.pageCount}
                />
              </div>
            </>
          );
        }}
      </QueryState>
    </section>
  );
}
