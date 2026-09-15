import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Check,
  Copy,
  FileText,
  Pencil,
  MoreHorizontal,
  PanelRightClose,
  PanelRightOpen,
  Trash2,
} from 'lucide-react';
import type {
  AnnotationType,
  AnnotationVisibility,
  CourseDocumentAnnotation,
  UpdateCourseDocumentAnnotationRequest,
} from '@web-app/contracts';

import {
  createCourseDocumentAnnotation,
  deleteCourseDocumentAnnotation,
  fetchCourseDocumentAnnotations,
  updateCourseDocumentAnnotation,
} from '../../../../api/client';
import { useAuthenticatedUser } from '../../../../auth/authenticatedUser';
import { Dialog } from '../../../../components/Dialog';
import { EmptyState } from '../../../../components/EmptyState';
import { ErrorNotice } from '../../../../components/feedback';
import { useNotification } from '../../../../components/notifications';
import { Popover } from '../../../../components/Popover';
import { QueryState } from '../../../../components/QueryState';
import { useNotifyingMutation } from '../../../../hooks/useNotifyingMutation';
import { getErrorMessage } from '../../../../lib/api-error';

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

type AnnotationFilter =
  | 'all'
  | 'question'
  | 'note'
  | 'important'
  | 'mine'
  | 'other';

interface AnnotationEditDraft {
  annotationId: string;
  body: string;
  bodyError: string | null;
  type: AnnotationType;
  visibility: AnnotationVisibility;
}

interface AnnotationUpdateVariables {
  annotationId: string;
  input: UpdateCourseDocumentAnnotationRequest;
}

const annotationFilterOptions = [
  { value: 'all', label: 'Όλα' },
  { value: 'question', label: 'Μόνο ερωτήσεις' },
  { value: 'note', label: 'Μόνο σημειώσεις' },
  { value: 'important', label: 'Μόνο σημαντικά' },
  { value: 'mine', label: 'Δικά μου σχόλια' },
  { value: 'other', label: 'Λοιπά' },
] satisfies Array<{ value: AnnotationFilter; label: string }>;

function annotationsQueryKey(courseId: string, documentId: string) {
  return ['courses', courseId, 'documents', documentId, 'annotations'] as const;
}

function annotationHash(annotationId: string): string {
  return `annotation-${annotationId}`;
}

function annotationIdFromLocationHash(): string | null {
  const hash = window.location.hash.slice(1);
  return hash.startsWith('annotation-')
    ? hash.slice('annotation-'.length)
    : null;
}

export function DocumentAnnotationsPanel({
  collapsed,
  courseId,
  currentPage,
  documentId,
  onNavigateToPage,
  onCollapsedChange,
  pageCount,
}: {
  collapsed: boolean;
  courseId: string;
  currentPage: number;
  documentId: string;
  onNavigateToPage: (pageNumber: number) => void;
  onCollapsedChange: (collapsed: boolean) => void;
  pageCount: number | null;
}): React.JSX.Element {
  const formId = useId();
  const currentUser = useAuthenticatedUser();
  const { notify } = useNotification();
  const annotationItemRefs = useRef(new Map<string, HTMLElement>());
  const highlightTimeoutRef = useRef<number | null>(null);
  const [type, setType] = useState<AnnotationType>('note');
  const [visibility, setVisibility] = useState<AnnotationVisibility>('private');
  const [selectedText, setSelectedText] = useState('');
  const [body, setBody] = useState('');
  const [formExpanded, setFormExpanded] = useState(false);
  const [bodyError, setBodyError] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<AnnotationEditDraft | null>(null);
  const [annotationPendingDelete, setAnnotationPendingDelete] =
    useState<CourseDocumentAnnotation | null>(null);
  const [annotationFilter, setAnnotationFilter] =
    useState<AnnotationFilter>('all');
  const [highlightedAnnotationId, setHighlightedAnnotationId] = useState(() =>
    annotationIdFromLocationHash(),
  );

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

  const updateMutation = useNotifyingMutation({
    mutationFn: ({ annotationId, input }: AnnotationUpdateVariables) =>
      updateCourseDocumentAnnotation(courseId, documentId, annotationId, input),
    invalidateKeys: [annotationsQueryKey(courseId, documentId)],
    successMessage: 'Το σχόλιο ενημερώθηκε.',
    notifyOnError: true,
    onSuccess: () => setEditDraft(null),
  });

  const deleteMutation = useNotifyingMutation({
    mutationFn: (annotationId: string) =>
      deleteCourseDocumentAnnotation(courseId, documentId, annotationId),
    invalidateKeys: [annotationsQueryKey(courseId, documentId)],
    successMessage: 'Το σχόλιο διαγράφηκε.',
    notifyOnError: true,
    onSuccess: (_data, annotationId) => {
      if (editDraft?.annotationId === annotationId) setEditDraft(null);
      setAnnotationPendingDelete(null);
    },
  });

  const pending = createMutation.isPending;
  const deletingAnnotationId = deleteMutation.isPending
    ? deleteMutation.variables
    : null;
  const bodyErrorId = `${formId}-body-error`;
  const annotations = annotationsQuery.data?.data;

  const registerAnnotationElement = useCallback(
    (annotationId: string, element: HTMLElement | null) => {
      if (element) annotationItemRefs.current.set(annotationId, element);
      else annotationItemRefs.current.delete(annotationId);
    },
    [],
  );

  const handleCopyAnnotationLink = useCallback(
    async (annotation: CourseDocumentAnnotation) => {
      const url = new URL(window.location.href);
      url.hash = annotationHash(annotation.id);

      try {
        await navigator.clipboard.writeText(url.toString());
        notify({
          kind: 'success',
          message: 'Ο σύνδεσμος του σχολίου αντιγράφηκε.',
        });
      } catch {
        notify({
          kind: 'error',
          message: 'Δεν ήταν δυνατή η αντιγραφή του συνδέσμου.',
        });
      }
    },
    [notify],
  );

  const handleStartEdit = useCallback(
    (annotation: CourseDocumentAnnotation) => {
      setFormExpanded(false);
      setEditDraft({
        annotationId: annotation.id,
        body: annotation.body ?? '',
        bodyError: null,
        type: annotation.type,
        visibility: annotation.visibility,
      });
    },
    [],
  );

  const handleCancelEdit = useCallback(() => {
    setEditDraft(null);
  }, []);

  const handleSubmitEdit = useCallback(() => {
    if (!editDraft || updateMutation.isPending) return;

    if (!editDraft.body.trim()) {
      setEditDraft({ ...editDraft, bodyError: 'Συμπλήρωσε περιεχόμενο.' });
      return;
    }

    updateMutation.mutate({
      annotationId: editDraft.annotationId,
      input: {
        body: editDraft.body.trim(),
        type: editDraft.type,
        visibility: editDraft.visibility,
      },
    });
  }, [editDraft, updateMutation]);

  const handleDeleteAnnotation = useCallback(
    (annotation: CourseDocumentAnnotation) => {
      setAnnotationPendingDelete(annotation);
    },
    [],
  );

  const handleConfirmDelete = useCallback(() => {
    if (!annotationPendingDelete || deleteMutation.isPending) return;
    deleteMutation.mutate(annotationPendingDelete.id);
  }, [annotationPendingDelete, deleteMutation]);

  const handleCloseDeleteDialog = useCallback(() => {
    if (deleteMutation.isPending) return;
    setAnnotationPendingDelete(null);
    deleteMutation.reset();
  }, [deleteMutation]);

  useEffect(() => {
    function handleHashChange() {
      setHighlightedAnnotationId(annotationIdFromLocationHash());
    }

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    if (!highlightedAnnotationId || !annotations) return;

    const annotation = annotations.find(
      (item) => item.id === highlightedAnnotationId,
    );
    if (!annotation) return;

    onNavigateToPage(annotation.target.pageNumber);
    window.requestAnimationFrame(() => {
      annotationItemRefs.current.get(highlightedAnnotationId)?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    });

    if (highlightTimeoutRef.current) {
      window.clearTimeout(highlightTimeoutRef.current);
    }
    highlightTimeoutRef.current = window.setTimeout(() => {
      setHighlightedAnnotationId(null);
      highlightTimeoutRef.current = null;
    }, 3_200);
  }, [annotations, highlightedAnnotationId, onNavigateToPage]);

  useEffect(
    () => () => {
      if (highlightTimeoutRef.current) {
        window.clearTimeout(highlightTimeoutRef.current);
      }
    },
    [],
  );

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
    <>
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
            <Popover
              align="end"
              panelClassName="annotation-panel-menu-popover"
              renderTrigger={({ open, triggerRef, toggle }) => (
                <button
                  aria-expanded={open}
                  aria-haspopup="menu"
                  aria-label="Ενέργειες σχολίων"
                  className="annotation-panel-menu-trigger"
                  ref={triggerRef}
                  type="button"
                  onClick={toggle}
                >
                  <MoreHorizontal aria-hidden="true" size={18} />
                </button>
              )}
            >
              {(close) => (
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
                        close();
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
              )}
            </Popover>
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
              Επιλεγμένο κείμενο (προεραιτικό)
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
              <p
                className="annotation-form-error"
                id={bodyErrorId}
                role="alert"
              >
                {bodyError}
              </p>
            )}
            <div className="annotation-form-actions">
              <button
                className="primary-button"
                type="submit"
                disabled={pending}
              >
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
                currentUser.id,
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
                        currentUserId={currentUser.id}
                        editDraft={editDraft}
                        isDeleting={deletingAnnotationId === annotation.id}
                        isHighlighted={
                          annotation.id === highlightedAnnotationId
                        }
                        isSavingEdit={
                          updateMutation.isPending &&
                          updateMutation.variables?.annotationId ===
                          annotation.id
                        }
                        onCancelEdit={handleCancelEdit}
                        onCopyLink={handleCopyAnnotationLink}
                        onDelete={handleDeleteAnnotation}
                        onEditDraftChange={setEditDraft}
                        onNavigateToPage={onNavigateToPage}
                        onStartEdit={handleStartEdit}
                        onSubmitEdit={handleSubmitEdit}
                        registerElement={registerAnnotationElement}
                      />
                    ))}
                  </div>
                </>
              );
            }}
          </QueryState>
        </div>
      </aside>
      {annotationPendingDelete && (
        <Dialog title="Διαγραφή σχολίου" onClose={handleCloseDeleteDialog}>
          <div className="confirm-dialog">
            <p>
              Να διαγραφεί οριστικά αυτό το σχόλιο από τη λίστα; Η ενέργεια δεν
              θα εμφανίζει πλέον το σχόλιο στο έγγραφο.
            </p>
            {deleteMutation.isError && (
              <ErrorNotice>
                {getErrorMessage(deleteMutation.error, {
                  fallback: 'Το σχόλιο δεν διαγράφηκε. Δοκίμασε ξανά.',
                })}
              </ErrorNotice>
            )}
            <footer className="course-dialog-actions">
              <button
                className="secondary-button"
                type="button"
                disabled={deleteMutation.isPending}
                onClick={handleCloseDeleteDialog}
              >
                Ακύρωση
              </button>
              <button
                className="danger-button"
                type="button"
                disabled={deleteMutation.isPending}
                onClick={handleConfirmDelete}
              >
                {deleteMutation.isPending ? 'Διαγραφή…' : 'Διαγραφή'}
              </button>
            </footer>
          </div>
        </Dialog>
      )}
    </>
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
  currentUserId: string,
): CourseDocumentAnnotation[] {
  if (filter === 'all') return annotations;
  if (filter === 'mine') {
    return annotations.filter(
      (annotation) => annotation.author.id === currentUserId,
    );
  }
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
  currentUserId,
  editDraft,
  isDeleting,
  isHighlighted,
  isSavingEdit,
  onCancelEdit,
  onCopyLink,
  onDelete,
  onEditDraftChange,
  onNavigateToPage,
  onStartEdit,
  onSubmitEdit,
  registerElement,
}: {
  annotation: CourseDocumentAnnotation;
  currentUserId: string;
  editDraft: AnnotationEditDraft | null;
  isDeleting: boolean;
  isHighlighted: boolean;
  isSavingEdit: boolean;
  onCancelEdit: () => void;
  onCopyLink: (annotation: CourseDocumentAnnotation) => void;
  onDelete: (annotation: CourseDocumentAnnotation) => void;
  onEditDraftChange: Dispatch<SetStateAction<AnnotationEditDraft | null>>;
  onNavigateToPage: (pageNumber: number) => void;
  onStartEdit: (annotation: CourseDocumentAnnotation) => void;
  onSubmitEdit: () => void;
  registerElement: (annotationId: string, element: HTMLElement | null) => void;
}): React.JSX.Element {
  const editFormId = useId();
  const isOwner = annotation.author.id === currentUserId;
  const isEditing = editDraft?.annotationId === annotation.id;

  return (
    <article
      className={
        isHighlighted ? 'annotation-item is-highlighted' : 'annotation-item'
      }
      id={annotationHash(annotation.id)}
      ref={(element) => registerElement(annotation.id, element)}
    >
      <div className="annotation-item-topline">
        <div className="annotation-item-header">
          <span>{typeLabels[annotation.type]}</span>
          <span>{visibilityLabels[annotation.visibility]}</span>
        </div>
        <AnnotationItemActionsMenu
          annotation={annotation}
          isBusy={isDeleting || isSavingEdit}
          isEditing={isEditing}
          isOwner={isOwner}
          onCopyLink={onCopyLink}
          onDelete={onDelete}
          onStartEdit={onStartEdit}
          onNavigateToPage={onNavigateToPage}
        />
      </div>
      <p className="annotation-item-page">
        Σελίδα {annotation.target.pageNumber} - {annotation.author.fullName}
      </p>
      {annotation.target.selectedText && (
        <blockquote>{annotation.target.selectedText}</blockquote>
      )}
      {isEditing && editDraft ? (
        <form
          className="annotation-edit-form"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmitEdit();
          }}
        >
          <div className="annotation-form-grid">
            <label htmlFor={`${editFormId}-type`}>
              Τύπος
              <select
                id={`${editFormId}-type`}
                value={editDraft.type}
                onChange={(event) =>
                  onEditDraftChange((draft) =>
                    draft?.annotationId === annotation.id
                      ? {
                        ...draft,
                        type: event.target.value as AnnotationType,
                      }
                      : draft,
                  )
                }
                disabled={isSavingEdit}
              >
                {annotationTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label htmlFor={`${editFormId}-visibility`}>
              Ορατότητα
              <select
                id={`${editFormId}-visibility`}
                value={editDraft.visibility}
                onChange={(event) =>
                  onEditDraftChange((draft) =>
                    draft?.annotationId === annotation.id
                      ? {
                        ...draft,
                        visibility: event.target
                          .value as AnnotationVisibility,
                      }
                      : draft,
                  )
                }
                disabled={isSavingEdit}
              >
                {annotationVisibilityOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label htmlFor={`${editFormId}-body`}>
            Περιεχόμενο
            <textarea
              id={`${editFormId}-body`}
              aria-describedby={
                editDraft.bodyError ? `${editFormId}-body-error` : undefined
              }
              aria-invalid={editDraft.bodyError ? true : undefined}
              maxLength={2000}
              rows={3}
              value={editDraft.body}
              onChange={(event) =>
                onEditDraftChange((draft) =>
                  draft?.annotationId === annotation.id
                    ? {
                      ...draft,
                      body: event.target.value,
                      bodyError: event.target.value.trim()
                        ? null
                        : draft.bodyError,
                    }
                    : draft,
                )
              }
              disabled={isSavingEdit}
            />
          </label>
          {editDraft.bodyError && (
            <p
              className="annotation-form-error"
              id={`${editFormId}-body-error`}
              role="alert"
            >
              {editDraft.bodyError}
            </p>
          )}
          <div className="annotation-edit-actions">
            <button
              className="primary-button"
              type="submit"
              disabled={isSavingEdit}
            >
              {isSavingEdit ? 'Αποθήκευση…' : 'Αποθήκευση αλλαγών'}
            </button>
            <button
              className="secondary-button"
              type="button"
              disabled={isSavingEdit}
              onClick={onCancelEdit}
            >
              Άκυρο
            </button>
          </div>
        </form>
      ) : (
        annotation.body && <p>{annotation.body}</p>
      )}
    </article>
  );
}

function AnnotationItemActionsMenu({
  annotation,
  isBusy,
  isEditing,
  isOwner,
  onCopyLink,
  onDelete,
  onNavigateToPage,
  onStartEdit,
}: {
  annotation: CourseDocumentAnnotation;
  isBusy: boolean;
  isEditing: boolean;
  isOwner: boolean;
  onCopyLink: (annotation: CourseDocumentAnnotation) => void;
  onDelete: (annotation: CourseDocumentAnnotation) => void;
  onNavigateToPage: (pageNumber: number) => void;
  onStartEdit: (annotation: CourseDocumentAnnotation) => void;
}): React.JSX.Element {
  return (
    <Popover
      align="end"
      panelClassName="annotation-item-menu-popover"
      renderTrigger={({ open, triggerRef, toggle }) => (
        <button
          aria-expanded={open}
          aria-haspopup="menu"
          aria-label="Ενέργειες σχολίου"
          className="annotation-item-menu-trigger"
          ref={triggerRef}
          type="button"
          onClick={toggle}
        >
          <MoreHorizontal aria-hidden="true" size={16} />
        </button>
      )}
    >
      {(close) => (
        <>
          {isOwner && (
            <button
              disabled={isBusy || isEditing}
              role="menuitem"
              type="button"
              onClick={() => {
                close();
                onStartEdit(annotation);
              }}
            >
              <Pencil aria-hidden="true" size={14} />
              <span>Επεξεργασία</span>
            </button>
          )}
          <button
            role="menuitem"
            type="button"
            onClick={() => {
              close();
              onNavigateToPage(annotation.target.pageNumber);
            }}
          >
            <FileText aria-hidden="true" size={14} />
            <span>Μετάβαση στη σελίδα</span>
          </button>
          <button
            role="menuitem"
            type="button"
            onClick={() => {
              close();
              onCopyLink(annotation);
            }}
          >
            <Copy aria-hidden="true" size={14} />
            <span>Αντιγραφή συνδέσμου</span>
          </button>
          {isOwner && (
            <button
              className="annotation-item-menu-danger"
              disabled={isBusy}
              role="menuitem"
              type="button"
              onClick={() => {
                close();
                onDelete(annotation);
              }}
            >
              <Trash2 aria-hidden="true" size={14} />
              <span>Διαγραφή</span>
              {isBusy && (
                <span className="annotation-item-menu-status">Σε εξέλιξη</span>
              )}
            </button>
          )}
        </>
      )}
    </Popover>
  );
}
