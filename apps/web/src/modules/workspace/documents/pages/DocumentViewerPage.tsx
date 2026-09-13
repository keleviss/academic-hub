import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';

import {
  fetchCourseDocument,
  fetchCourseDocumentContent,
} from '../../../../api/client';
import { ErrorNotice } from '../../../../components/feedback';
import { PageLayout } from '../../../../components/PageLayout';
import { QueryState } from '../../../../components/QueryState';
import { getErrorMessage } from '../../../../lib/api-error';

function documentQueryKey(courseId: string, documentId: string) {
  return ['courses', courseId, 'documents', documentId] as const;
}

function messageFor(error: unknown): string {
  return getErrorMessage(error, {
    statuses: {
      403: 'Δεν έχεις πρόσβαση σε αυτό το έγγραφο.',
      404: 'Το έγγραφο δεν βρέθηκε.',
    },
  });
}

export function DocumentViewerPage(): React.JSX.Element {
  const { courseId = '', documentId = '' } = useParams();
  const documentQuery = useQuery({
    queryKey: documentQueryKey(courseId, documentId),
    queryFn: ({ signal }) => fetchCourseDocument(courseId, documentId, signal),
    enabled: !!courseId && !!documentId,
  });
  const [contentUrl, setContentUrl] = useState<string | null>(null);
  const [contentError, setContentError] = useState<string | null>(null);

  // The object URL is only valid for this mount; revoke it on cleanup to avoid leaking memory.
  useEffect(() => {
    if (!courseId || !documentId) return;

    setContentUrl(null);
    setContentError(null);
    let objectUrl: string | null = null;
    const controller = new AbortController();

    fetchCourseDocumentContent(courseId, documentId, controller.signal)
      .then((buffer) => {
        objectUrl = URL.createObjectURL(
          new Blob([buffer], { type: 'application/pdf' }),
        );
        setContentUrl(objectUrl);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setContentError(messageFor(error));
      });

    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [courseId, documentId]);

  return (
    <QueryState
      query={documentQuery}
      loadingLabel="Φόρτωση εγγράφου…"
      errorOptions={{
        statuses: {
          403: 'Δεν έχεις πρόσβαση σε αυτό το έγγραφο.',
          404: 'Το έγγραφο δεν βρέθηκε.',
        },
      }}
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
              {contentError && <ErrorNotice>{contentError}</ErrorNotice>}
              {!contentError && !contentUrl && (
                <p role="status">Φόρτωση περιεχομένου…</p>
              )}
              {contentUrl && (
                <iframe
                  className="document-viewer-frame"
                  src={contentUrl}
                  title={detail.title}
                />
              )}
            </div>
          </PageLayout>
        );
      }}
    </QueryState>
  );
}
