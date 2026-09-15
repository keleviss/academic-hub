import { useCallback, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
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
  const [visiblePage, setVisiblePage] = useState(1);
  const [pageScrollTarget, setPageScrollTarget] = useState<{
    pageNumber: number;
    requestId: number;
  } | null>(null);
  const [annotationsPanelCollapsed, setAnnotationsPanelCollapsed] =
    useState(false);
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

  return (
    <QueryState
      query={documentQuery}
      loadingLabel="Φόρτωση εγγράφου…"
      errorOptions={accessErrorOptions}
    >
      {(document) => {
        const detail = document.data;
        return (
          <section className="document-viewer-page">
            <header className="document-viewer-toolbar">
              <Link
                aria-label="Επιστροφή στο μάθημα"
                className="document-viewer-back-link"
                to={`/app/courses/${courseId}`}
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
                      />
                    )}
                  </QueryState>
                </div>
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
          </section>
        );
      }}
    </QueryState>
  );
}
