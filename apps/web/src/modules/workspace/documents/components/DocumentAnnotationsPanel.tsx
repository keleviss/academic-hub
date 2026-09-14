import { useEffect, useId, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Check,
  MoreHorizontal,
  PanelRightClose,
  PanelRightOpen,
} from 'lucide-react';
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
  { value: 'highlight', label: 'Επισήμανση' },
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

type AnnotationFilter = 'all' | 'question' | 'note' | 'important' | 'other';

const annotationFilterOptions = [
  { value: 'all', label: 'Όλα' },
  { value: 'question', label: 'Μόνο ερωτήσεις' },
  { value: 'note', label: 'Μόνο σημειώσεις' },
  { value: 'important', label: 'Μόνο σημαντικά' },
  { value: 'other', label: 'Λοιπά' },
] satisfies Array<{ value: AnnotationFilter; label: string }>;

function annotationsQueryKey(courseId: string, documentId: string) {
  return ['courses', courseId, 'documents', documentId, 'annotations'] as const;
}

export function DocumentAnnotationsPanel({
  collapsed,
  courseId,
  currentPage,
  documentId,
  onCollapsedChange,
  pageCount,
}: {
  collapsed: boolean;
  courseId: string;
  currentPage: number;
  documentId: string;
  onCollapsedChange: (collapsed: boolean) => void;
  pageCount: number | null;
}): React.JSX.Element {
  const formId = useId();
  const menuRef = useRef<HTMLDivElement>(null);
  const [type, setType] = useState<AnnotationType>('note');
  const [visibility, setVisibility] = useState<AnnotationVisibility>('private');
  const [selectedText, setSelectedText] = useState('');
  const [body, setBody] = useState('');
  const [formExpanded, setFormExpanded] = useState(false);
  const [bodyError, setBodyError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [annotationFilter, setAnnotationFilter] =
    useState<AnnotationFilter>('all');

  const annotationsQuery = useQuery({
    queryKey: annotationsQueryKey(courseId, documentId),
    queryFn: ({ signal }) =>
      fetchCourseDocumentAnnotations(courseId, documentId, signal),
    enabled: !!courseId && !!documentId,
  });

  const createMutation = useNotifyingMutation({
    mutationFn: () =>
      createCourseDocumentAnnotation(courseId, documentId, {
        pageNumber: currentPage,
        type,
        visibility,
        body: body.trim(),
        selectedText: selectedText.trim() || undefined,
      }),
    invalidateKeys: [annotationsQueryKey(courseId, documentId)],
    successMessage: 'Το σχόλιο δημιουργήθηκε.',
    notifyOnError: true,
    onSuccess: () => {
      setBody('');
      setBodyError(null);
      setFormExpanded(false);
      setSelectedText('');
    },
  });

  const pending = createMutation.isPending;
  const bodyErrorId = `${formId}-body-error`;

  useEffect(() => {
    if (!menuOpen) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (!menuRef.current?.contains(target)) setMenuOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setMenuOpen(false);
    }

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuOpen]);

  if (collapsed) {
    return (
      <aside
        className="document-annotations-panel is-collapsed"
        aria-label="Σχόλια εγγράφου"
      >
        <button
          aria-label="Εμφάνιση πάνελ σχολίων"
          className="annotation-panel-show-button"
          type="button"
          onClick={() => onCollapsedChange(false)}
        >
          <PanelRightOpen aria-hidden="true" size={18} />
        </button>
      </aside>
    );
  }

  return (
    <aside
      className="document-annotations-panel"
      aria-labelledby="annotations-heading"
    >
      <div className="document-annotations-heading">
        <div>
          <h2 id="annotations-heading">Σχόλια</h2>
          <p>Σημειώσεις και απορίες για το έγγραφο</p>
        </div>
        <div className="annotation-panel-actions">
          <button
            aria-label="Απόκρυψη πάνελ σχολίων"
            className="annotation-panel-collapse-button"
            type="button"
            onClick={() => onCollapsedChange(true)}
          >
            <PanelRightClose aria-hidden="true" size={18} />
          </button>
          <div className="annotation-panel-menu" ref={menuRef}>
            <button
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              aria-label="Ενέργειες σχολίων"
              className="annotation-panel-menu-trigger"
              type="button"
              onClick={() => setMenuOpen((value) => !value)}
            >
              <MoreHorizontal aria-hidden="true" size={18} />
            </button>
            {menuOpen && (
              <div className="annotation-panel-menu-popover" role="menu">
                <div className="annotation-panel-menu-section">
                  <p>Φίλτρο σχολίων</p>
                  {annotationFilterOptions.map((option) => (
                    <button
                      key={option.value}
                      role="menuitemradio"
                      aria-checked={annotationFilter === option.value}
                      type="button"
                      onClick={() => {
                        setAnnotationFilter(option.value);
                        setMenuOpen(false);
                      }}
                    >
                      <Check
                        aria-hidden="true"
                        className="annotation-panel-menu-check"
                        size={14}
                      />
                      <span>{option.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {formExpanded ? (
        <form
          className="annotation-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (!body.trim()) {
              setBodyError('Συμπλήρωσε περιεχόμενο για το σχόλιο.');
              return;
            }
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
                value={currentPage}
                readOnly
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
              aria-describedby={bodyError ? bodyErrorId : undefined}
              aria-invalid={bodyError ? true : undefined}
              maxLength={2000}
              rows={3}
              value={body}
              onChange={(event) => {
                setBody(event.target.value);
                if (bodyError && event.target.value.trim()) {
                  setBodyError(null);
                }
              }}
              disabled={pending}
            />
          </label>
          {bodyError && (
            <p className="annotation-form-error" id={bodyErrorId} role="alert">
              {bodyError}
            </p>
          )}
          <div className="annotation-form-actions">
            <button className="primary-button" type="submit" disabled={pending}>
              {pending ? 'Αποθήκευση…' : 'Αποθήκευση'}
            </button>
            <button
              className="secondary-button"
              type="button"
              disabled={pending}
              onClick={() => {
                setBodyError(null);
                setFormExpanded(false);
              }}
            >
              Άκυρο
            </button>
          </div>
        </form>
      ) : (
        <button
          className="primary-button annotation-form-toggle"
          type="button"
          onClick={() => setFormExpanded(true)}
        >
          Προσθήκη σχολίου
        </button>
      )}

      <div className="document-annotations-results">
        <QueryState
          query={annotationsQuery}
          loadingLabel="Φόρτωση σχολίων…"
          onRetry={() => void annotationsQuery.refetch()}
        >
          {(response) => {
            const filteredAnnotations = filterAnnotations(
              response.data,
              annotationFilter,
            );

            if (response.data.length === 0) {
              return (
                <EmptyState message="Δεν υπάρχουν σχόλια για αυτό το έγγραφο." />
              );
            }

            const filterLabel = labelForAnnotationFilter(annotationFilter);
            const hasActiveFilter = annotationFilter !== 'all';

            if (filteredAnnotations.length === 0) {
              return (
                <>
                  <AnnotationCountSummary totalCount={response.data.length} />
                  {hasActiveFilter && (
                    <AnnotationFilterSummary
                      label={filterLabel}
                      onReset={() => setAnnotationFilter('all')}
                    />
                  )}
                  <EmptyState message="Δεν υπάρχουν σχόλια για αυτό το φίλτρο." />
                </>
              );
            }

            return (
              <>
                <AnnotationCountSummary totalCount={response.data.length} />
                {hasActiveFilter && (
                  <AnnotationFilterSummary
                    label={filterLabel}
                    onReset={() => setAnnotationFilter('all')}
                  />
                )}
                <div className="annotation-list">
                  {filteredAnnotations.map((annotation) => (
                    <AnnotationItem
                      key={annotation.id}
                      annotation={annotation}
                    />
                  ))}
                </div>
              </>
            );
          }}
        </QueryState>
      </div>
    </aside>
  );
}

function labelForAnnotationFilter(filter: AnnotationFilter): string {
  return (
    annotationFilterOptions.find((option) => option.value === filter)?.label ??
    'Όλα'
  );
}

function AnnotationFilterSummary({
  label,
  onReset,
}: {
  label: string;
  onReset: () => void;
}): React.JSX.Element {
  return (
    <div className="annotation-filter-summary">
      <span>Φίλτρο: {label}</span>
      <button type="button" onClick={onReset}>
        Επαναφορά
      </button>
    </div>
  );
}

function AnnotationCountSummary({
  totalCount,
}: {
  totalCount: number;
}): React.JSX.Element {
  return (
    <p className="annotation-count-summary">Σχόλια αρχείου: {totalCount}</p>
  );
}

function filterAnnotations(
  annotations: CourseDocumentAnnotation[],
  filter: AnnotationFilter,
): CourseDocumentAnnotation[] {
  if (filter === 'all') return annotations;
  if (filter === 'other') {
    return annotations.filter(
      (annotation) =>
        annotation.type !== 'question' &&
        annotation.type !== 'note' &&
        annotation.type !== 'important',
    );
  }
  return annotations.filter((annotation) => annotation.type === filter);
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
