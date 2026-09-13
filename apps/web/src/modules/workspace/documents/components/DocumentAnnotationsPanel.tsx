import { useId, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type {
  AnnotationType,
  AnnotationVisibility,
  CourseDocumentAnnotation,
} from '@web-app/contracts';

import {
  createCourseDocumentAnnotation,
  fetchCourseDocumentAnnotations,
} from '../../../../api/client';
import { EmptyState } from '../../../../components/EmptyState';
import { QueryState } from '../../../../components/QueryState';
import { useNotifyingMutation } from '../../../../hooks/useNotifyingMutation';

const annotationTypeOptions = [
  { value: 'highlight', label: 'Highlight' },
  { value: 'note', label: 'Σημείωση' },
  { value: 'question', label: 'Ερώτηση' },
  { value: 'important', label: 'Σημαντικό' },
  { value: 'confusing', label: 'Δυσνόητο' },
] satisfies Array<{ value: AnnotationType; label: string }>;

const annotationVisibilityOptions = [
  { value: 'private', label: 'Ιδιωτικό' },
  { value: 'public', label: 'Δημόσιο' },
  { value: 'instructor_only', label: 'Μόνο διδάσκοντες' },
] satisfies Array<{ value: AnnotationVisibility; label: string }>;

const typeLabels = Object.fromEntries(
  annotationTypeOptions.map((option) => [option.value, option.label]),
) as Record<AnnotationType, string>;

const visibilityLabels = Object.fromEntries(
  annotationVisibilityOptions.map((option) => [option.value, option.label]),
) as Record<AnnotationVisibility, string>;

function annotationsQueryKey(courseId: string, documentId: string) {
  return ['courses', courseId, 'documents', documentId, 'annotations'] as const;
}

export function DocumentAnnotationsPanel({
  courseId,
  documentId,
  pageCount,
}: {
  courseId: string;
  documentId: string;
  pageCount: number | null;
}): React.JSX.Element {
  const formId = useId();
  const [pageNumber, setPageNumber] = useState('1');
  const [type, setType] = useState<AnnotationType>('note');
  const [visibility, setVisibility] = useState<AnnotationVisibility>('private');
  const [selectedText, setSelectedText] = useState('');
  const [body, setBody] = useState('');

  const annotationsQuery = useQuery({
    queryKey: annotationsQueryKey(courseId, documentId),
    queryFn: ({ signal }) =>
      fetchCourseDocumentAnnotations(courseId, documentId, signal),
    enabled: !!courseId && !!documentId,
  });

  const createMutation = useNotifyingMutation({
    mutationFn: () =>
      createCourseDocumentAnnotation(courseId, documentId, {
        pageNumber: Number(pageNumber),
        type,
        visibility,
        body: body.trim() || undefined,
        selectedText: selectedText.trim() || undefined,
      }),
    invalidateKeys: [annotationsQueryKey(courseId, documentId)],
    successMessage: 'Το annotation δημιουργήθηκε.',
    notifyOnError: true,
    onSuccess: () => {
      setBody('');
      setSelectedText('');
    },
  });

  const pending = createMutation.isPending;

  return (
    <aside
      className="document-annotations-panel"
      aria-labelledby="annotations-heading"
    >
      <div className="document-annotations-heading">
        <div>
          <h2 id="annotations-heading">Annotations</h2>
          <p>Σημειώσεις και απορίες για το έγγραφο</p>
        </div>
      </div>

      <form
        className="annotation-form"
        onSubmit={(event) => {
          event.preventDefault();
          createMutation.mutate();
        }}
      >
        <div className="annotation-form-grid">
          <label htmlFor={`${formId}-page`}>
            Σελίδα
            <input
              id={`${formId}-page`}
              type="number"
              min={1}
              max={pageCount ?? undefined}
              required
              value={pageNumber}
              onChange={(event) => setPageNumber(event.target.value)}
              disabled={pending}
            />
          </label>
          <label htmlFor={`${formId}-type`}>
            Τύπος
            <select
              id={`${formId}-type`}
              value={type}
              onChange={(event) =>
                setType(event.target.value as AnnotationType)
              }
              disabled={pending}
            >
              {annotationTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label htmlFor={`${formId}-visibility`}>
          Ορατότητα
          <select
            id={`${formId}-visibility`}
            value={visibility}
            onChange={(event) =>
              setVisibility(event.target.value as AnnotationVisibility)
            }
            disabled={pending}
          >
            {annotationVisibilityOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label htmlFor={`${formId}-selected-text`}>
          Επιλεγμένο κείμενο
          <input
            id={`${formId}-selected-text`}
            type="text"
            maxLength={1000}
            value={selectedText}
            onChange={(event) => setSelectedText(event.target.value)}
            disabled={pending}
          />
        </label>
        <label htmlFor={`${formId}-body`}>
          Περιεχόμενο
          <textarea
            id={`${formId}-body`}
            maxLength={2000}
            rows={4}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            disabled={pending}
          />
        </label>
        <button className="primary-button" type="submit" disabled={pending}>
          {pending ? 'Αποθήκευση…' : 'Προσθήκη annotation'}
        </button>
      </form>

      <QueryState
        query={annotationsQuery}
        loadingLabel="Φόρτωση annotations…"
        onRetry={() => void annotationsQuery.refetch()}
      >
        {(response) =>
          response.data.length === 0 ? (
            <EmptyState message="Δεν υπάρχουν annotations για αυτό το έγγραφο." />
          ) : (
            <div className="annotation-list">
              {response.data.map((annotation) => (
                <AnnotationItem key={annotation.id} annotation={annotation} />
              ))}
            </div>
          )
        }
      </QueryState>
    </aside>
  );
}

function AnnotationItem({
  annotation,
}: {
  annotation: CourseDocumentAnnotation;
}): React.JSX.Element {
  return (
    <article className="annotation-item">
      <div className="annotation-item-header">
        <span>{typeLabels[annotation.type]}</span>
        <span>{visibilityLabels[annotation.visibility]}</span>
      </div>
      <p className="annotation-item-page">
        Σελίδα {annotation.target.pageNumber} - {annotation.author.fullName}
      </p>
      {annotation.target.selectedText && (
        <blockquote>{annotation.target.selectedText}</blockquote>
      )}
      {annotation.body && <p>{annotation.body}</p>}
    </article>
  );
}
