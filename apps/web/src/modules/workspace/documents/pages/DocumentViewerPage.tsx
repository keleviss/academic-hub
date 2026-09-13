import { useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';

import {
  fetchCourseDocument,
  fetchCourseDocumentContent,
} from '../../../../api/client';
import { PageLayout } from '../../../../components/PageLayout';
import { QueryState } from '../../../../components/QueryState';
import { useSetWorkspaceBreadcrumb } from '../../../../components/workspaceBreadcrumb';
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

export function DocumentViewerPage(): React.JSX.Element {
  const { courseId = '', documentId = '' } = useParams();
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

  return (
    <QueryState
      query={documentQuery}
      loadingLabel="Φόρτωση εγγράφου…"
      errorOptions={accessErrorOptions}
    >
      {(document) => {
        const detail = document.data;
        return (
          <PageLayout
            title={detail.title}
            subtitle={detail.description ?? 'Προβολή εγγράφου μαθήματος'}
            backlink={{
              href: `/app/courses/${courseId}`,
              text: 'Επιστροφή στο μάθημα',
            }}
          >
            <div className="document-viewer">
              <QueryState
                query={contentQuery}
                loadingLabel="Φόρτωση περιεχομένου…"
                errorOptions={accessErrorOptions}
                onRetry={() => void contentQuery.refetch()}
              >
                {(buffer) => (
                  <PdfCanvasViewer data={buffer} title={detail.title} />
                )}
              </QueryState>
            </div>
          </PageLayout>
        );
      }}
    </QueryState>
  );
}
