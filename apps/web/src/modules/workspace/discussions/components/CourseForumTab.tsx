import { useId, useState } from 'react';
import { useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Plus, ShieldCheck } from 'lucide-react';
import type {
  ForumThreadFilter,
  ForumThreadListItem,
  ForumThreadVisibility,
} from '@web-app/contracts';

import {
  createForumThread,
  fetchForumThreads,
  forumThreadsBaseKey,
  forumThreadsQueryKey,
} from '../../../../api/client';
import { Dialog } from '../../../../components/Dialog';
import { EmptyState } from '../../../../components/EmptyState';
import { ErrorNotice } from '../../../../components/feedback';
import { QueryState } from '../../../../components/QueryState';
import { Tabs } from '../../../../components/Tabs';
import { useNotifyingMutation } from '../../../../hooks/useNotifyingMutation';
import { getErrorMessage } from '../../../../lib/api-error';
import { formatRelativeDateTime } from '../../../../lib/format-relative-time';
import { forumThreadStatusLabels } from '../../../../lib/forum-thread-status';

const filterItems: { value: ForumThreadFilter; label: string }[] = [
  { value: 'all', label: 'Όλες' },
  { value: 'general', label: 'Γενικές' },
  { value: 'document', label: 'Από έγγραφα' },
  { value: 'unanswered', label: 'Αναπάντητες' },
  { value: 'resolved', label: 'Επιλυμένες' },
];

const visibilityOptions: { value: ForumThreadVisibility; label: string }[] = [
  { value: 'public', label: 'Δημόσιο' },
  { value: 'instructor_only', label: 'Μόνο διδάσκοντες' },
];

export function CourseForumTab({
  courseId,
}: {
  courseId: string;
}): React.JSX.Element {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<ForumThreadFilter>('all');
  const [createOpen, setCreateOpen] = useState(false);

  const threadsQuery = useQuery({
    queryKey: forumThreadsQueryKey(courseId, filter),
    queryFn: ({ signal }) => fetchForumThreads(courseId, filter, undefined, signal),
    enabled: !!courseId,
  });

  return (
    <div className="course-members">
      <div className="course-forum-toolbar">
        <Tabs
          ariaLabel="Φίλτρα συζητήσεων"
          value={filter}
          onChange={setFilter}
          items={filterItems}
        />
        <button
          className="primary-button"
          type="button"
          onClick={() => setCreateOpen(true)}
        >
          <Plus aria-hidden="true" size={16} />
          Νέα συζήτηση
        </button>
      </div>
      <QueryState
        query={threadsQuery}
        loadingLabel="Φόρτωση συζητήσεων…"
        onRetry={() => void threadsQuery.refetch()}
      >
        {(response) =>
          response.data.length === 0 ? (
            <EmptyState message="Δεν υπάρχουν συζητήσεις για αυτό το φίλτρο." />
          ) : (
            <div className="contextual-question-list">
              {response.data.map((thread) => (
                <ForumThreadListRow
                  key={thread.id}
                  thread={thread}
                  onOpen={() =>
                    navigate(`/app/courses/${courseId}/discussions/${thread.id}`)
                  }
                />
              ))}
            </div>
          )
        }
      </QueryState>
      {createOpen && (
        <CreateThreadDialog
          courseId={courseId}
          onClose={() => setCreateOpen(false)}
          onCreated={(threadId) => {
            setCreateOpen(false);
            navigate(`/app/courses/${courseId}/discussions/${threadId}`);
          }}
        />
      )}
    </div>
  );
}

function ForumThreadListRow({
  thread,
  onOpen,
}: {
  thread: ForumThreadListItem;
  onOpen: () => void;
}): React.JSX.Element {
  return (
    <article className="contextual-question-item">
      <div className="contextual-question-topline">
        <span className={`question-status is-${thread.status}`}>
          {forumThreadStatusLabels[thread.status]}
        </span>
        {thread.verifiedPostId && (
          <span className="verified-answer-label">
            <ShieldCheck aria-hidden="true" size={14} />
            Επίσημη απάντηση
          </span>
        )}
      </div>
      <h4>
        <button className="forum-thread-title-link" type="button" onClick={onOpen}>
          {thread.title}
        </button>
      </h4>
      <p className="contextual-question-meta">
        {thread.author.fullName} · {formatRelativeDateTime(thread.updatedAt)}
        {thread.documentTitle && <> · {thread.documentTitle}</>}
        {' · '}
        {thread.postCount} {thread.postCount === 1 ? 'απάντηση' : 'απαντήσεις'}
      </p>
    </article>
  );
}

function CreateThreadDialog({
  courseId,
  onClose,
  onCreated,
}: {
  courseId: string;
  onClose: () => void;
  onCreated: (threadId: string) => void;
}): React.JSX.Element {
  const formId = useId();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [visibility, setVisibility] = useState<ForumThreadVisibility>('public');
  const [validationError, setValidationError] = useState<string | null>(null);

  const createMutation = useNotifyingMutation({
    mutationFn: () =>
      createForumThread(courseId, {
        title: title.trim(),
        body: body.trim(),
        visibility,
      }),
    invalidateKeys: [forumThreadsBaseKey(courseId)],
    successMessage: 'Η συζήτηση δημιουργήθηκε.',
    onSuccess: (response) => onCreated(response.data.id),
  });

  return (
    <Dialog title="Νέα συζήτηση" onClose={onClose}>
      <form
        className="annotation-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (!title.trim() || !body.trim()) {
            setValidationError('Συμπλήρωσε τίτλο και μήνυμα.');
            return;
          }
          setValidationError(null);
          createMutation.mutate();
        }}
      >
        <label htmlFor={`${formId}-title`}>
          Τίτλος
          <input
            id={`${formId}-title`}
            type="text"
            maxLength={160}
            required
            value={title}
            disabled={createMutation.isPending}
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>
        <label htmlFor={`${formId}-body`}>
          Μήνυμα
          <textarea
            id={`${formId}-body`}
            rows={4}
            maxLength={4000}
            required
            value={body}
            disabled={createMutation.isPending}
            onChange={(event) => setBody(event.target.value)}
          />
        </label>
        <label htmlFor={`${formId}-visibility`}>
          Ορατότητα
          <select
            id={`${formId}-visibility`}
            value={visibility}
            disabled={createMutation.isPending}
            onChange={(event) =>
              setVisibility(event.target.value as ForumThreadVisibility)
            }
          >
            {visibilityOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        {(validationError || createMutation.isError) && (
          <ErrorNotice>
            {validationError ??
              getErrorMessage(createMutation.error, {
                fallback: 'Η συζήτηση δεν δημιουργήθηκε. Δοκίμασε ξανά.',
              })}
          </ErrorNotice>
        )}
        <div className="annotation-form-actions">
          <button
            className="primary-button"
            type="submit"
            disabled={createMutation.isPending}
          >
            {createMutation.isPending ? 'Δημιουργία…' : 'Δημιουργία'}
          </button>
          <button
            className="secondary-button"
            type="button"
            disabled={createMutation.isPending}
            onClick={onClose}
          >
            Άκυρο
          </button>
        </div>
      </form>
    </Dialog>
  );
}
