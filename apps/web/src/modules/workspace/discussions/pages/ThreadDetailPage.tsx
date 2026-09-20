import { useId, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  FileText,
  Globe2,
  LockKeyhole,
  MessageSquareText,
  Pencil,
  RotateCcw,
  Send,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import type { ForumPost } from '@web-app/contracts';

import {
  createForumPost,
  deleteForumPost,
  deleteForumThread,
  fetchForumThread,
  forumThreadQueryKey,
  forumThreadsBaseKey,
  reopenForumThread,
  resolveForumThread,
  updateForumPost,
  updateForumThread,
  verifyForumPost,
} from '../../../../api/client';
import { useAuthenticatedUser } from '../../../../auth/authenticatedUser';
import { Dialog } from '../../../../components/Dialog';
import { ErrorNotice } from '../../../../components/feedback';
import { PageLayout } from '../../../../components/PageLayout';
import { QueryState } from '../../../../components/QueryState';
import { useNotifyingMutation } from '../../../../hooks/useNotifyingMutation';
import { getErrorMessage } from '../../../../lib/api-error';
import { formatRelativeDateTime } from '../../../../lib/format-relative-time';
import { forumThreadStatusLabels } from '../../../../lib/forum-thread-status';
import { useSetWorkspaceBreadcrumb } from '../../../../components/workspaceBreadcrumb';
import { useCourseBreadcrumbTrail } from '../../../../hooks/useCourseBreadcrumbTrail';

const visibilityLabels = {
  public: 'Δημόσιο',
  instructor_only: 'Μόνο διδάσκοντες',
} as const;

function threadErrorOptions() {
  return {
    statuses: {
      403: 'Δεν έχεις πρόσβαση σε αυτή τη συζήτηση.',
      404: 'Η συζήτηση δεν βρέθηκε.',
    },
  };
}

export function ThreadDetailPage(): React.JSX.Element {
  const { courseId = '', threadId = '' } = useParams();
  const navigate = useNavigate();
  const currentUser = useAuthenticatedUser();
  const queryClient = useQueryClient();
  const [replyBody, setReplyBody] = useState('');
  const [editingThread, setEditingThread] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editingPostBody, setEditingPostBody] = useState('');

  const threadQuery = useQuery({
    queryKey: forumThreadQueryKey(courseId, threadId),
    queryFn: ({ signal }) => fetchForumThread(courseId, threadId, signal),
    enabled: !!courseId && !!threadId,
  });
  useSetWorkspaceBreadcrumb(
    useCourseBreadcrumbTrail(courseId, threadQuery.data?.data.title),
  );

  const invalidateKeys = [
    forumThreadQueryKey(courseId, threadId),
    forumThreadsBaseKey(courseId),
  ];

  const replyMutation = useNotifyingMutation({
    mutationFn: () =>
      createForumPost(courseId, threadId, { body: replyBody.trim() }),
    invalidateKeys,
    successMessage: 'Η απάντηση δημοσιεύτηκε.',
    notifyOnError: true,
    onSuccess: () => setReplyBody(''),
  });

  const updateThreadMutation = useNotifyingMutation({
    mutationFn: (title: string) =>
      updateForumThread(courseId, threadId, { title }),
    invalidateKeys,
    successMessage: 'Ο τίτλος ενημερώθηκε.',
    notifyOnError: true,
    onSuccess: () => setEditingThread(false),
  });

  const deleteThreadMutation = useNotifyingMutation({
    mutationFn: () => deleteForumThread(courseId, threadId),
    successMessage: 'Η συζήτηση διαγράφηκε.',
    notifyOnError: true,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: forumThreadsBaseKey(courseId),
      });
      navigate(`/app/courses/${courseId}`);
    },
  });

  const resolveMutation = useNotifyingMutation({
    mutationFn: () => resolveForumThread(courseId, threadId),
    invalidateKeys,
    successMessage: 'Η συζήτηση σημειώθηκε ως επιλυμένη.',
    notifyOnError: true,
  });

  const reopenMutation = useNotifyingMutation({
    mutationFn: () => reopenForumThread(courseId, threadId),
    invalidateKeys,
    successMessage: 'Η συζήτηση ανοίχτηκε ξανά.',
    notifyOnError: true,
  });

  const verifyPostMutation = useNotifyingMutation({
    mutationFn: (postId: string) => verifyForumPost(courseId, threadId, postId),
    invalidateKeys,
    successMessage: 'Η απάντηση σημειώθηκε ως επίσημη.',
    notifyOnError: true,
  });

  const updatePostMutation = useNotifyingMutation({
    mutationFn: ({ postId, body }: { postId: string; body: string }) =>
      updateForumPost(courseId, threadId, postId, { body }),
    invalidateKeys,
    successMessage: 'Η απάντηση ενημερώθηκε.',
    notifyOnError: true,
    onSuccess: () => setEditingPostId(null),
  });

  const deletePostMutation = useNotifyingMutation({
    mutationFn: (postId: string) => deleteForumPost(courseId, threadId, postId),
    invalidateKeys,
    successMessage: 'Η απάντηση διαγράφηκε.',
    notifyOnError: true,
  });

  return (
    <QueryState
      query={threadQuery}
      loadingLabel="Φόρτωση συζήτησης…"
      errorOptions={threadErrorOptions()}
    >
      {(response) => {
        const thread = response.data;
        const isAuthor = thread.author.id === currentUser.id;
        const isStaff =
          currentUser.role === 'admin' || currentUser.role === 'professor';
        const canEditThread = isAuthor;
        const canDeleteThread = isAuthor;
        const canChangeThreadStatus = isAuthor || isStaff;
        const hasThreadActions =
          canEditThread || canDeleteThread || canChangeThreadStatus;
        const openingPost =
          thread.openingBody === null ? thread.posts[0] : null;
        const replyPosts = openingPost ? thread.posts.slice(1) : thread.posts;

        return (
          <PageLayout
            title={thread.title}
            subtitle={
              thread.documentTitle
                ? `Συζήτηση για το έγγραφο «${thread.documentTitle}»`
                : 'Συζήτηση μαθήματος'
            }
          >
            <div className="thread-page-content">
              <article className="course-list-card thread-detail-card">
                <div className="thread-detail-topline">
                  <div className="contextual-question-topline">
                    <span className={`question-status is-${thread.status}`}>
                      {forumThreadStatusLabels[thread.status]}
                    </span>
                    <span className="thread-visibility-badge">
                      {thread.visibility === 'instructor_only' ? (
                        <LockKeyhole aria-hidden="true" size={12} />
                      ) : (
                        <Globe2 aria-hidden="true" size={12} />
                      )}
                      {visibilityLabels[thread.visibility]}
                    </span>
                  </div>
                  <span className="thread-author-meta">
                    {thread.author.fullName} ·{' '}
                    {formatRelativeDateTime(thread.createdAt)}
                  </span>
                </div>
                {thread.documentId && (
                  <button
                    className="secondary-button thread-document-link"
                    type="button"
                    onClick={() =>
                      navigate(
                        `/app/courses/${courseId}/documents/${thread.documentId}`,
                      )
                    }
                  >
                    <FileText aria-hidden="true" size={16} />
                    Άνοιγμα εγγράφου
                  </button>
                )}
                {thread.selectedText && (
                  <blockquote className="thread-context-quote">
                    <span>Απόσπασμα</span>
                    {thread.selectedText}
                  </blockquote>
                )}

                {editingThread && canEditThread ? (
                  <form
                    className="annotation-edit-form thread-edit-form"
                    onSubmit={(event) => {
                      event.preventDefault();
                      if (editTitle.trim())
                        updateThreadMutation.mutate(editTitle.trim());
                    }}
                  >
                    <label htmlFor="thread-title-input">
                      Τίτλος
                      <input
                        id="thread-title-input"
                        type="text"
                        maxLength={160}
                        value={editTitle}
                        disabled={updateThreadMutation.isPending}
                        onChange={(event) => setEditTitle(event.target.value)}
                      />
                    </label>
                    <div className="annotation-edit-actions">
                      <button
                        className="primary-button"
                        type="submit"
                        disabled={updateThreadMutation.isPending}
                      >
                        {updateThreadMutation.isPending
                          ? 'Αποθήκευση…'
                          : 'Αποθήκευση'}
                      </button>
                      <button
                        className="secondary-button"
                        type="button"
                        disabled={updateThreadMutation.isPending}
                        onClick={() => setEditingThread(false)}
                      >
                        Άκυρο
                      </button>
                    </div>
                  </form>
                ) : (
                  <p className="thread-opening-body">
                    {thread.openingBody ?? openingPost?.body}
                  </p>
                )}

                {hasThreadActions && (
                  <div className="thread-action-bar">
                    {canEditThread && !editingThread && (
                      <button
                        className="secondary-button"
                        type="button"
                        onClick={() => {
                          setEditTitle(thread.title);
                          setEditingThread(true);
                        }}
                      >
                        <Pencil aria-hidden="true" size={15} />
                        Επεξεργασία τίτλου
                      </button>
                    )}
                    {canChangeThreadStatus &&
                      (thread.status === 'resolved' ? (
                        <button
                          className="secondary-button"
                          type="button"
                          disabled={reopenMutation.isPending}
                          onClick={() => reopenMutation.mutate()}
                        >
                          <RotateCcw aria-hidden="true" size={15} />
                          {reopenMutation.isPending
                            ? 'Άνοιγμα…'
                            : 'Άνοιγμα ξανά'}
                        </button>
                      ) : (
                        <button
                          className="secondary-button"
                          type="button"
                          disabled={resolveMutation.isPending}
                          onClick={() => resolveMutation.mutate()}
                        >
                          <CheckCircle2 aria-hidden="true" size={15} />
                          {resolveMutation.isPending
                            ? 'Ενημέρωση…'
                            : 'Σήμανση ως επιλυμένη'}
                        </button>
                      ))}
                    {canDeleteThread && (
                      <button
                        className="danger-button thread-delete-button"
                        type="button"
                        onClick={() => setDeleteConfirmOpen(true)}
                      >
                        <Trash2 aria-hidden="true" size={15} />
                        Διαγραφή συζήτησης
                      </button>
                    )}
                  </div>
                )}
              </article>

              <section className="course-list-card thread-replies-card">
                <div className="thread-replies-heading">
                  <span className="thread-replies-title">
                    <MessageSquareText aria-hidden="true" size={18} />
                    <h2>Απαντήσεις</h2>
                  </span>
                  <span className="dashboard-widget-count">
                    {replyPosts.length}
                  </span>
                </div>
                {replyPosts.length === 0 ? (
                  <p className="thread-empty-state">
                    Δεν υπάρχουν ακόμα απαντήσεις.
                  </p>
                ) : (
                  <div className="thread-post-list">
                    {replyPosts.map((post) => (
                      <ThreadPostItem
                        key={post.id}
                        post={post}
                        isEditing={editingPostId === post.id}
                        editingBody={editingPostBody}
                        canEdit={post.author.id === currentUser.id}
                        canVerify={
                          isStaff &&
                          !post.isVerified &&
                          (post.author.role === 'admin' ||
                            post.author.role === 'professor')
                        }
                        onChangeEditingBody={setEditingPostBody}
                        onStartEdit={() => {
                          setEditingPostId(post.id);
                          setEditingPostBody(post.body);
                        }}
                        onCancelEdit={() => setEditingPostId(null)}
                        onSubmitEdit={() =>
                          updatePostMutation.mutate({
                            postId: post.id,
                            body: editingPostBody.trim(),
                          })
                        }
                        onDelete={() => deletePostMutation.mutate(post.id)}
                        onVerify={() => verifyPostMutation.mutate(post.id)}
                        isSavingEdit={
                          updatePostMutation.isPending &&
                          updatePostMutation.variables?.postId === post.id
                        }
                        isDeleting={
                          deletePostMutation.isPending &&
                          deletePostMutation.variables === post.id
                        }
                        isVerifying={
                          verifyPostMutation.isPending &&
                          verifyPostMutation.variables === post.id
                        }
                      />
                    ))}
                  </div>
                )}

                <form
                  className="contextual-answer-form thread-reply-composer"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (replyBody.trim()) replyMutation.mutate();
                  }}
                >
                  <label htmlFor="thread-reply-body">
                    Νέα απάντηση
                    <textarea
                      id="thread-reply-body"
                      rows={3}
                      maxLength={4000}
                      placeholder="Γράψε την απάντησή σου…"
                      value={replyBody}
                      disabled={replyMutation.isPending}
                      onChange={(event) => setReplyBody(event.target.value)}
                    />
                  </label>
                  <div className="contextual-answer-actions">
                    <button
                      className="primary-button"
                      type="submit"
                      disabled={replyMutation.isPending || !replyBody.trim()}
                    >
                      <Send aria-hidden="true" size={15} />
                      {replyMutation.isPending ? 'Αποστολή…' : 'Απάντηση'}
                    </button>
                  </div>
                </form>
              </section>
            </div>

            {deleteConfirmOpen && canDeleteThread && (
              <Dialog
                title="Διαγραφή συζήτησης"
                onClose={() => setDeleteConfirmOpen(false)}
              >
                <div className="confirm-dialog">
                  <p>Να διαγραφεί οριστικά αυτή η συζήτηση;</p>
                  {deleteThreadMutation.isError && (
                    <ErrorNotice>
                      {getErrorMessage(deleteThreadMutation.error, {
                        fallback: 'Η συζήτηση δεν διαγράφηκε. Δοκίμασε ξανά.',
                      })}
                    </ErrorNotice>
                  )}
                  <footer className="course-dialog-actions">
                    <button
                      className="secondary-button"
                      type="button"
                      disabled={deleteThreadMutation.isPending}
                      onClick={() => setDeleteConfirmOpen(false)}
                    >
                      Ακύρωση
                    </button>
                    <button
                      className="danger-button"
                      type="button"
                      disabled={deleteThreadMutation.isPending}
                      onClick={() => deleteThreadMutation.mutate()}
                    >
                      {deleteThreadMutation.isPending
                        ? 'Διαγραφή…'
                        : 'Διαγραφή'}
                    </button>
                  </footer>
                </div>
              </Dialog>
            )}
          </PageLayout>
        );
      }}
    </QueryState>
  );
}

function ThreadPostItem({
  post,
  isEditing,
  editingBody,
  canEdit,
  canVerify,
  isSavingEdit,
  isDeleting,
  isVerifying,
  onChangeEditingBody,
  onStartEdit,
  onCancelEdit,
  onSubmitEdit,
  onDelete,
  onVerify,
}: {
  post: ForumPost;
  isEditing: boolean;
  editingBody: string;
  canEdit: boolean;
  canVerify: boolean;
  isSavingEdit: boolean;
  isDeleting: boolean;
  isVerifying: boolean;
  onChangeEditingBody: (value: string) => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSubmitEdit: () => void;
  onDelete: () => void;
  onVerify: () => void;
}): React.JSX.Element {
  const bodyId = useId();

  return (
    <article className={`thread-post${post.isVerified ? ' is-verified' : ''}`}>
      <div className="thread-post-header">
        <div className="thread-post-author">
          <strong>{post.author.fullName}</strong>
          {post.isVerified && (
            <span className="verified-answer-label">
              <ShieldCheck aria-hidden="true" size={14} />
              Επίσημη απάντηση
            </span>
          )}
        </div>
        <span className="thread-post-time">
          {formatRelativeDateTime(post.createdAt)}
        </span>
      </div>
      {isEditing ? (
        <form
          className="annotation-edit-form thread-edit-form"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmitEdit();
          }}
        >
          <label htmlFor={bodyId}>
            Περιεχόμενο
            <textarea
              id={bodyId}
              rows={3}
              maxLength={4000}
              value={editingBody}
              disabled={isSavingEdit}
              onChange={(event) => onChangeEditingBody(event.target.value)}
            />
          </label>
          <div className="annotation-edit-actions">
            <button
              className="primary-button"
              type="submit"
              disabled={isSavingEdit}
            >
              {isSavingEdit ? 'Αποθήκευση…' : 'Αποθήκευση'}
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
        <p className="thread-post-body">{post.body}</p>
      )}
      {(canEdit || canVerify) && !isEditing && (
        <div className="thread-post-actions">
          {canEdit && (
            <>
              <button
                className="secondary-button"
                type="button"
                onClick={onStartEdit}
              >
                <Pencil aria-hidden="true" size={14} />
                Επεξεργασία
              </button>
              <button
                className="secondary-button"
                type="button"
                disabled={isDeleting}
                onClick={onDelete}
              >
                <Trash2 aria-hidden="true" size={14} />
                {isDeleting ? 'Διαγραφή…' : 'Διαγραφή'}
              </button>
            </>
          )}
          {canVerify && (
            <button
              className="secondary-button"
              type="button"
              disabled={isVerifying}
              onClick={onVerify}
            >
              <ShieldCheck aria-hidden="true" size={14} />
              {isVerifying ? 'Επαλήθευση…' : 'Σήμανση ως επίσημη'}
            </button>
          )}
        </div>
      )}
    </article>
  );
}
