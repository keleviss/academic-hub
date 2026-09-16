import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import {
  Check,
  CheckCircle2,
  Copy,
  FileText,
  MessageSquare,
  Pencil,
  MoreHorizontal,
  PanelRightClose,
  PanelRightOpen,
  Reply,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import type {
  AnnotationType,
  AnnotationVisibility,
  ContextualQuestion,
  ContextualQuestionsResponse,
  CourseDocumentAnnotation,
  ForumThreadStatus,
  UpdateCourseDocumentAnnotationRequest,
  UserRole,
} from '@web-app/contracts';

import {
  createContextualQuestionAnswer,
  createCourseDocumentAnnotation,
  deleteCourseDocumentAnnotation,
  fetchCourseDocumentAnnotations,
  fetchCourseDocumentQuestions,
  updateContextualQuestionStatus,
  updateCourseDocumentAnnotation,
  verifyContextualQuestionAnswer,
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

const questionStatusLabels = {
  open: 'Ανοιχτή',
  instructor_answered: 'Απαντήθηκε',
  verified: 'Επαληθευμένη',
  resolved: 'Επιλυμένη',
  archived: 'Αρχειοθετημένη',
} satisfies Record<ForumThreadStatus, string>;

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

interface QuestionAnswerDraft {
  body: string;
  error: string | null;
  threadId: string;
}

interface QuestionAnswerVariables {
  body: string;
  threadId: string;
  verified: boolean;
}

interface QuestionVerifyVariables {
  answerId: string;
  threadId: string;
}

interface QuestionStatusVariables {
  status: 'open' | 'resolved';
  threadId: string;
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

function contextualQuestionsQueryKey(courseId: string, documentId: string) {
  return ['courses', courseId, 'documents', documentId, 'questions'] as const;
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

function formatRelativeDateTime(dateText: string, now = new Date()): string {
  const timestamp = new Date(dateText).getTime();
  if (Number.isNaN(timestamp)) return dateText;

  const elapsedMs = now.getTime() - timestamp;
  if (elapsedMs < 60_000) return 'μόλις τώρα';

  const units = [
    {
      durationMs: 365 * 24 * 60 * 60 * 1000,
      singular: 'χρόνο',
      plural: 'χρόνια',
    },
    { durationMs: 30 * 24 * 60 * 60 * 1000, singular: 'μήνα', plural: 'μήνες' },
    {
      durationMs: 7 * 24 * 60 * 60 * 1000,
      singular: 'εβδομάδα',
      plural: 'εβδομάδες',
    },
    { durationMs: 24 * 60 * 60 * 1000, singular: 'ημέρα', plural: 'ημέρες' },
    { durationMs: 60 * 60 * 1000, singular: 'ώρα', plural: 'ώρες' },
    { durationMs: 60 * 1000, singular: 'λεπτό', plural: 'λεπτά' },
  ];

  const unit =
    units.find((item) => elapsedMs >= item.durationMs) ?? units.at(-1)!;
  const value = Math.floor(elapsedMs / unit.durationMs);
  const label = value === 1 ? unit.singular : unit.plural;

  return `${value} ${label} πριν`;
}

function getAnnotationCreatedAtTime(
  annotation: CourseDocumentAnnotation,
): number {
  const timestamp = new Date(annotation.createdAt).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function sortAnnotationsByNewest(
  annotations: CourseDocumentAnnotation[],
): CourseDocumentAnnotation[] {
  return [...annotations].sort(
    (first, second) =>
      getAnnotationCreatedAtTime(second) - getAnnotationCreatedAtTime(first),
  );
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
  const [answerDraft, setAnswerDraft] = useState<QuestionAnswerDraft | null>(
    null,
  );

  const annotationsQuery = useQuery({
    queryKey: annotationsQueryKey(courseId, documentId),
    queryFn: ({ signal }) =>
      fetchCourseDocumentAnnotations(courseId, documentId, signal),
    enabled: !!courseId && !!documentId,
  });
  const questionsQuery = useQuery({
    queryKey: contextualQuestionsQueryKey(courseId, documentId),
    queryFn: ({ signal }) =>
      fetchCourseDocumentQuestions(courseId, documentId, signal),
    enabled: !!courseId && !!documentId,
  });

  const documentInvalidateKeys = [
    annotationsQueryKey(courseId, documentId),
    contextualQuestionsQueryKey(courseId, documentId),
  ];

  const createMutation = useNotifyingMutation({
    mutationFn: () =>
      createCourseDocumentAnnotation(courseId, documentId, {
        pageNumber: currentPage,
        type,
        visibility,
        body: body.trim(),
        selectedText: selectedText.trim() || undefined,
      }),
    invalidateKeys: documentInvalidateKeys,
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
    invalidateKeys: documentInvalidateKeys,
    successMessage: 'Το σχόλιο ενημερώθηκε.',
    notifyOnError: true,
    onSuccess: () => setEditDraft(null),
  });

  const deleteMutation = useNotifyingMutation({
    mutationFn: (annotationId: string) =>
      deleteCourseDocumentAnnotation(courseId, documentId, annotationId),
    invalidateKeys: documentInvalidateKeys,
    successMessage: 'Το σχόλιο διαγράφηκε.',
    notifyOnError: true,
    onSuccess: (_data, annotationId) => {
      if (editDraft?.annotationId === annotationId) setEditDraft(null);
      setAnnotationPendingDelete(null);
    },
  });

  const answerMutation = useNotifyingMutation({
    mutationFn: ({ body, threadId, verified }: QuestionAnswerVariables) =>
      createContextualQuestionAnswer(courseId, documentId, threadId, {
        body,
        verified,
      }),
    invalidateKeys: documentInvalidateKeys,
    successMessage: 'Η απάντηση αποθηκεύτηκε.',
    notifyOnError: true,
    onSuccess: () => setAnswerDraft(null),
  });

  const verifyMutation = useNotifyingMutation({
    mutationFn: ({ answerId, threadId }: QuestionVerifyVariables) =>
      verifyContextualQuestionAnswer(courseId, documentId, threadId, {
        answerId,
      }),
    invalidateKeys: documentInvalidateKeys,
    successMessage: 'Η απάντηση σημειώθηκε ως επίσημη.',
    notifyOnError: true,
  });

  const statusMutation = useNotifyingMutation({
    mutationFn: ({ status, threadId }: QuestionStatusVariables) =>
      updateContextualQuestionStatus(courseId, documentId, threadId, {
        status,
      }),
    invalidateKeys: documentInvalidateKeys,
    successMessage: 'Η κατάσταση της απορίας ενημερώθηκε.',
    notifyOnError: true,
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

  const handleSubmitAnswer = useCallback(
    (threadId: string, verified: boolean) => {
      if (answerMutation.isPending) return;
      if (!answerDraft || answerDraft.threadId !== threadId) return;

      const trimmedBody = answerDraft.body.trim();
      if (!trimmedBody) {
        setAnswerDraft({
          ...answerDraft,
          error: 'Συμπλήρωσε απάντηση.',
        });
        return;
      }

      answerMutation.mutate({ body: trimmedBody, threadId, verified });
    },
    [answerDraft, answerMutation],
  );

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
          <ContextualQuestionsSection
            answerDraft={answerDraft}
            answerPendingThreadId={
              answerMutation.isPending
                ? answerMutation.variables?.threadId
                : undefined
            }
            currentUserId={currentUser.id}
            currentUserRole={currentUser.role}
            questionsQuery={questionsQuery}
            statusPendingThreadId={
              statusMutation.isPending
                ? statusMutation.variables?.threadId
                : undefined
            }
            verifyPendingThreadId={
              verifyMutation.isPending
                ? verifyMutation.variables?.threadId
                : undefined
            }
            onAnswerDraftChange={setAnswerDraft}
            onNavigateToPage={onNavigateToPage}
            onRetry={() => void questionsQuery.refetch()}
            onSubmitAnswer={handleSubmitAnswer}
            onUpdateStatus={(threadId, status) =>
              statusMutation.mutate({ threadId, status })
            }
            onVerifyAnswer={(threadId, answerId) =>
              verifyMutation.mutate({ answerId, threadId })
            }
          />
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

function ContextualQuestionsSection({
  answerDraft,
  answerPendingThreadId,
  currentUserId,
  currentUserRole,
  questionsQuery,
  statusPendingThreadId,
  verifyPendingThreadId,
  onAnswerDraftChange,
  onNavigateToPage,
  onRetry,
  onSubmitAnswer,
  onUpdateStatus,
  onVerifyAnswer,
}: {
  answerDraft: QuestionAnswerDraft | null;
  answerPendingThreadId?: string;
  currentUserId: string;
  currentUserRole: UserRole;
  questionsQuery: UseQueryResult<ContextualQuestionsResponse>;
  statusPendingThreadId?: string;
  verifyPendingThreadId?: string;
  onAnswerDraftChange: Dispatch<SetStateAction<QuestionAnswerDraft | null>>;
  onNavigateToPage: (pageNumber: number) => void;
  onRetry: () => void;
  onSubmitAnswer: (threadId: string, verified: boolean) => void;
  onUpdateStatus: (threadId: string, status: 'open' | 'resolved') => void;
  onVerifyAnswer: (threadId: string, answerId: string) => void;
}): React.JSX.Element {
  const canAnswer =
    currentUserRole === 'admin' || currentUserRole === 'professor';

  return (
    <section
      className="contextual-questions-section"
      aria-labelledby="contextual-questions-heading"
    >
      <div className="contextual-questions-heading">
        <div>
          <h3 id="contextual-questions-heading">Απορίες εγγράφου</h3>
          <p>Contextual ερωτήσεις που δημιουργήθηκαν από σχόλια.</p>
        </div>
        <MessageSquare aria-hidden="true" size={18} />
      </div>
      <QueryState
        query={questionsQuery}
        loadingLabel="Φόρτωση αποριών…"
        onRetry={onRetry}
      >
        {(response) => {
          if (response.data.length === 0) {
            return <EmptyState message="Δεν υπάρχουν απορίες για αυτό το έγγραφο." />;
          }

          return (
            <div className="contextual-question-list">
              {response.data.map((question) => (
                <ContextualQuestionItem
                  key={question.id}
                  answerDraft={answerDraft}
                  answerPending={answerPendingThreadId === question.id}
                  canAnswer={canAnswer}
                  currentUserId={currentUserId}
                  question={question}
                  statusPending={statusPendingThreadId === question.id}
                  verifyPending={verifyPendingThreadId === question.id}
                  onAnswerDraftChange={onAnswerDraftChange}
                  onNavigateToPage={onNavigateToPage}
                  onSubmitAnswer={onSubmitAnswer}
                  onUpdateStatus={onUpdateStatus}
                  onVerifyAnswer={onVerifyAnswer}
                />
              ))}
            </div>
          );
        }}
      </QueryState>
    </section>
  );
}

function ContextualQuestionItem({
  answerDraft,
  answerPending,
  canAnswer,
  currentUserId,
  question,
  statusPending,
  verifyPending,
  onAnswerDraftChange,
  onNavigateToPage,
  onSubmitAnswer,
  onUpdateStatus,
  onVerifyAnswer,
}: {
  answerDraft: QuestionAnswerDraft | null;
  answerPending: boolean;
  canAnswer: boolean;
  currentUserId: string;
  question: ContextualQuestion;
  statusPending: boolean;
  verifyPending: boolean;
  onAnswerDraftChange: Dispatch<SetStateAction<QuestionAnswerDraft | null>>;
  onNavigateToPage: (pageNumber: number) => void;
  onSubmitAnswer: (threadId: string, verified: boolean) => void;
  onUpdateStatus: (threadId: string, status: 'open' | 'resolved') => void;
  onVerifyAnswer: (threadId: string, answerId: string) => void;
}): React.JSX.Element {
  const answerFormId = useId();
  const isOwner = question.author.id === currentUserId;
  const isAnswering = answerDraft?.threadId === question.id;
  const canResolve = isOwner || canAnswer;
  const canVerify = canAnswer && question.answer && !question.answer.isVerified;
  const questionText = question.question ?? question.title;

  return (
    <article className="contextual-question-item">
      <div className="contextual-question-topline">
        <span className={`question-status is-${question.status}`}>
          {questionStatusLabels[question.status]}
        </span>
        {question.answer?.isVerified && (
          <span className="verified-answer-label">
            <ShieldCheck aria-hidden="true" size={14} />
            Επίσημη απάντηση
          </span>
        )}
      </div>
      <h4>{question.title}</h4>
      <p className="contextual-question-meta">
        {question.author.fullName}
        {question.pageNumber && (
          <>
            {' '}
            · Σελίδα{' '}
            <button
              type="button"
              onClick={() => onNavigateToPage(question.pageNumber!)}
            >
              {question.pageNumber}
            </button>
          </>
        )}
      </p>
      {questionText && <p className="contextual-question-body">{questionText}</p>}
      {question.selectedText && (
        <blockquote>
          <span>Απόσπασμα</span>
          {question.selectedText}
        </blockquote>
      )}
      {question.answer ? (
        <div className="contextual-answer">
          <div className="contextual-answer-heading">
            <CheckCircle2 aria-hidden="true" size={15} />
            <span>Απάντηση διδάσκοντα</span>
          </div>
          <p>{question.answer.body}</p>
          <span>
            {question.answer.author.fullName} ·{' '}
            {formatRelativeDateTime(question.answer.createdAt)}
          </span>
          {canVerify && (
            <button
              className="secondary-button"
              type="button"
              disabled={verifyPending}
              onClick={() => onVerifyAnswer(question.id, question.answer!.id)}
            >
              {verifyPending ? 'Επαλήθευση…' : 'Σήμανση ως επίσημη'}
            </button>
          )}
        </div>
      ) : isAnswering ? (
        <form
          className="contextual-answer-form"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmitAnswer(question.id, false);
          }}
        >
          <label htmlFor={`${answerFormId}-body`}>
            Απάντηση
            <textarea
              id={`${answerFormId}-body`}
              rows={3}
              maxLength={2000}
              value={answerDraft.body}
              aria-invalid={answerDraft.error ? true : undefined}
              aria-describedby={
                answerDraft.error ? `${answerFormId}-error` : undefined
              }
              disabled={answerPending}
              onChange={(event) =>
                onAnswerDraftChange((draft) =>
                  draft?.threadId === question.id
                    ? {
                        ...draft,
                        body: event.target.value,
                        error: event.target.value.trim() ? null : draft.error,
                      }
                    : draft,
                )
              }
            />
          </label>
          {answerDraft.error && (
            <p
              className="annotation-form-error"
              id={`${answerFormId}-error`}
              role="alert"
            >
              {answerDraft.error}
            </p>
          )}
          <div className="contextual-answer-actions">
            <button
              className="primary-button"
              type="submit"
              disabled={answerPending}
            >
              {answerPending ? 'Αποθήκευση…' : 'Απάντηση'}
            </button>
            <button
              className="secondary-button"
              type="button"
              disabled={answerPending}
              onClick={() => onSubmitAnswer(question.id, true)}
            >
              {answerPending ? 'Αποθήκευση…' : 'Απάντηση & επίσημη'}
            </button>
            <button
              className="secondary-button"
              type="button"
              disabled={answerPending}
              onClick={() => onAnswerDraftChange(null)}
            >
              Άκυρο
            </button>
          </div>
        </form>
      ) : (
        canAnswer && (
          <button
            className="secondary-button contextual-answer-start"
            type="button"
            onClick={() =>
              onAnswerDraftChange({
                body: '',
                error: null,
                threadId: question.id,
              })
            }
          >
            <Reply aria-hidden="true" size={14} />
            Απάντηση
          </button>
        )
      )}
      {canResolve && (
        <div className="contextual-question-status-actions">
          {question.status === 'resolved' ? (
            <button
              className="secondary-button"
              type="button"
              disabled={statusPending}
              onClick={() => onUpdateStatus(question.id, 'open')}
            >
              Άνοιγμα ξανά
            </button>
          ) : (
            <button
              className="secondary-button"
              type="button"
              disabled={statusPending}
              onClick={() => onUpdateStatus(question.id, 'resolved')}
            >
              Σήμανση ως επιλυμένη
            </button>
          )}
        </div>
      )}
    </article>
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
  if (filter === 'all') return sortAnnotationsByNewest(annotations);
  if (filter === 'mine') {
    return sortAnnotationsByNewest(
      annotations.filter(
        (annotation) => annotation.author.id === currentUserId,
      ),
    );
  }
  if (filter === 'other') {
    return sortAnnotationsByNewest(
      annotations.filter(
        (annotation) =>
          annotation.type !== 'question' &&
          annotation.type !== 'note' &&
          annotation.type !== 'important',
      ),
    );
  }
  return sortAnnotationsByNewest(
    annotations.filter((annotation) => annotation.type === filter),
  );
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
        <span>
          {annotation.author.fullName} -{' '}
          {formatRelativeDateTime(annotation.createdAt)}
        </span>
      </p>
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
        annotation.body && (
          <p className="annotation-item-content">{annotation.body}</p>
        )
      )}
      <blockquote>
        <span>Σελίδα {annotation.target.pageNumber}</span>
        {annotation.target.selectedText && (
          <span> - {annotation.target.selectedText}</span>
        )}
      </blockquote>
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
