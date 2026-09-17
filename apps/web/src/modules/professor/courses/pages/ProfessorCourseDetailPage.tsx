import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Download, Eye, Pencil } from 'lucide-react';
import type {
  CourseDocumentMetadata,
  UpdateCourseDocumentMetadataRequest,
} from '@web-app/contracts';

import {
  fetchCourseDocumentContent,
  fetchCourseDocuments,
  fetchProfessorCourse,
  updateCourseDocumentMetadata,
  uploadCourseDocument,
} from '../../../../api/client';
import { useAuthenticatedUser } from '../../../../auth/authenticatedUser';
import { ActionsMenu } from '../../../../components/ActionsMenu';
import { Avatar } from '../../../../components/Avatar';
import { Dialog } from '../../../../components/Dialog';
import { DocumentsTable } from '../../../../components/DocumentsTable';
import { EmptyState } from '../../../../components/EmptyState';
import { ErrorNotice } from '../../../../components/feedback';
import { QueryState } from '../../../../components/QueryState';
import { StatusBadge } from '../../../../components/StatusBadge';
import { Tabs } from '../../../../components/Tabs';
import { CourseForumTab } from '../../../workspace/discussions/components/CourseForumTab';
import { useDialogState } from '../../../../hooks/useDialogState';
import { useNotifyingMutation } from '../../../../hooks/useNotifyingMutation';
import { downloadBlob } from '../../../../lib/download-file';
import { getErrorMessage } from '../../../../lib/api-error';
import { normalizeSearch } from '../../../../lib/normalize-search';
import {
  DocumentFormDialog,
  type DocumentFormValues,
} from '../components/DocumentFormDialog';
import { professorCoursesKey } from '../utils/ProfessorCourses.const';
import { PageLayout } from '../../../../components/PageLayout';
import { useSetWorkspaceBreadcrumb } from '../../../../components/workspaceBreadcrumb';

type Tab = 'documents' | 'discussions' | 'details';
type DocumentFilter = 'all' | 'visible' | 'hidden';
type DialogState =
  | { type: 'create' }
  | { type: 'edit'; document: CourseDocumentMetadata }
  | { type: 'visibility'; document: CourseDocumentMetadata };

const instructorRoleLabels = {
  owner: 'Υπεύθυνος μαθήματος',
  assistant: 'Συνεργάτης διδάσκων',
} as const;

function messageFor(error: unknown): string {
  return getErrorMessage(error, {
    statuses: {
      403: 'Δεν έχεις πρόσβαση σε αυτό το μάθημα.',
      404: 'Το μάθημα δεν βρέθηκε.',
    },
  });
}

function documentsQueryKey(courseId: string) {
  return ['courses', courseId, 'documents'] as const;
}

function professorCourseKey(courseId: string) {
  return [...professorCoursesKey, courseId] as const;
}

export function ProfessorCourseDetailPage(): React.JSX.Element {
  const { courseId = '' } = useParams();
  const navigate = useNavigate();
  const user = useAuthenticatedUser();
  const [tab, setTab] = useState<Tab>('documents');
  const { dialog, openDialog, closeDialog } = useDialogState<DialogState>();
  const [docSearch, setDocSearch] = useState('');
  const [docFilter, setDocFilter] = useState<DocumentFilter>('all');

  useEffect(() => {
    return () => {
      setDocSearch('');
      setDocFilter('all');
      setTab('documents');
    };
  }, []);

  const courseQuery = useQuery({
    queryKey: professorCourseKey(courseId),
    queryFn: ({ signal }) => fetchProfessorCourse(courseId, signal),
    enabled: !!courseId,
  });
  useSetWorkspaceBreadcrumb(
    courseQuery.data
      ? [
          { label: 'Μαθήματα', to: '/app/courses' },
          { label: courseQuery.data.data.code },
        ]
      : null,
  );
  const documentsQuery = useQuery({
    queryKey: documentsQueryKey(courseId),
    queryFn: ({ signal }) => fetchCourseDocuments(courseId, signal),
    enabled: !!courseId,
  });

  const invalidateKeys = [
    professorCoursesKey,
    professorCourseKey(courseId),
    documentsQueryKey(courseId),
  ];

  const createMutation = useNotifyingMutation({
    mutationFn: (formData: FormData) =>
      uploadCourseDocument(courseId, formData),
    invalidateKeys,
    successMessage: 'Το έγγραφο δημιουργήθηκε.',
    onSuccess: () => {
      closeDialog();
      setTab('documents');
      setDocSearch('');
      setDocFilter('all');
    },
  });
  const saveMutation = useNotifyingMutation({
    mutationFn: ({
      documentId,
      input,
    }: {
      documentId: string;
      input: UpdateCourseDocumentMetadataRequest;
    }) => updateCourseDocumentMetadata(courseId, documentId, input),
    invalidateKeys,
    successMessage: 'Οι αλλαγές αποθηκεύτηκαν.',
    onSuccess: () => {
      closeDialog();
      setTab('documents');
      setDocSearch('');
      setDocFilter('all');
    },
  });
  const visibilityMutation = useNotifyingMutation({
    mutationFn: ({
      documentId,
      input,
    }: {
      documentId: string;
      input: UpdateCourseDocumentMetadataRequest;
    }) => updateCourseDocumentMetadata(courseId, documentId, input),
    invalidateKeys,
    successMessage: 'Η ορατότητα του εγγράφου ενημερώθηκε.',
    onSuccess: closeDialog,
  });
  const downloadMutation = useNotifyingMutation({
    mutationFn: (document: CourseDocumentMetadata) =>
      fetchCourseDocumentContent(courseId, document.id).then((buffer) =>
        downloadBlob(
          buffer,
          document.mimeType ?? 'application/pdf',
          document.originalFilename ?? document.title,
        ),
      ),
    successMessage: 'Το έγγραφο κατέβηκε.',
    notifyOnError: true,
  });

  const documents = documentsQuery.data?.data ?? [];
  const totalDocuments = documents.length;

  const filteredDocuments = useMemo(() => {
    const sorted = [...documents].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    const normalizedSearch = normalizeSearch(docSearch);
    return sorted.filter((document) => {
      if (
        docFilter === 'visible' &&
        document.visibility !== 'visible_to_students'
      )
        return false;
      if (
        docFilter === 'hidden' &&
        document.visibility !== 'hidden_from_students'
      )
        return false;
      if (!normalizedSearch) return true;
      return normalizeSearch(
        `${document.title} ${document.originalFilename ?? ''}`,
      ).includes(normalizedSearch);
    });
  }, [documents, docSearch, docFilter]);

  const clearDocumentFilters = () => {
    setDocSearch('');
    setDocFilter('all');
  };

  const openEdit = (document: CourseDocumentMetadata) =>
    openDialog({ type: 'edit', document });
  const toggleVisibility = (document: CourseDocumentMetadata) =>
    openDialog({ type: 'visibility', document });
  const viewDocument = (document: CourseDocumentMetadata) =>
    navigate(`/app/courses/${courseId}/documents/${document.id}`);

  return (
    <QueryState
      query={courseQuery}
      loadingLabel="Φόρτωση μαθήματος…"
      errorOptions={{
        statuses: {
          403: 'Δεν έχεις πρόσβαση σε αυτό το μάθημα.',
          404: 'Το μάθημα δεν βρέθηκε.',
        },
      }}
    >
      {(course) => {
        const detail = course.data;
        return (
          <PageLayout
            title={detail.title}
            subtitle={`Έγγραφα και στοιχεία για το μάθημα ${detail.title}`}
            backlink={{ href: '/app/courses', text: 'Τα μαθήματά μου' }}
            actions={
              <button
                className="primary-button"
                type="button"
                onClick={() => openDialog({ type: 'create' })}
              >
                + Νέο έγγραφο
              </button>
            }
          >
            <div className="course-detail-layout">
              <div className="course-list-card">
                <Tabs
                  value={tab}
                  onChange={setTab}
                  items={[
                    {
                      value: 'documents',
                      label: `Έγγραφα`,
                    },
                    { value: 'discussions', label: 'Συζητήσεις' },
                    { value: 'details', label: 'Στοιχεία μαθήματος' },
                  ]}
                />
                {tab === 'discussions' && <CourseForumTab courseId={courseId} />}
                {tab === 'documents' && (
                  <div className="course-members">
                    <div className="course-filter-row text-sm">
                      <input
                        aria-label="Αναζήτηση εγγράφων"
                        placeholder="Αναζήτηση τίτλου ή αρχείου…"
                        value={docSearch}
                        onChange={(event) => setDocSearch(event.target.value)}
                      />
                      <select
                        aria-label="Φίλτρο ορατότητας εγγράφων"
                        value={docFilter}
                        onChange={(event) =>
                          setDocFilter(event.target.value as DocumentFilter)
                        }
                      >
                        <option value="all">Όλα τα έγγραφα</option>
                        <option value="visible">Ορατά στους φοιτητές</option>
                        <option value="hidden">Κρυφά από τους φοιτητές</option>
                      </select>
                    </div>
                    <p className="document-count">
                      {filteredDocuments.length} από {totalDocuments} έγγραφα
                    </p>
                    {totalDocuments === 0 ? (
                      <EmptyState
                        message="Το πρώτο υλικό ξεκινά εδώ."
                        action={{
                          label: 'Νέο έγγραφο',
                          onClick: () => openDialog({ type: 'create' }),
                        }}
                      />
                    ) : filteredDocuments.length === 0 ? (
                      <EmptyState
                        message="Δεν βρέθηκαν έγγραφα για τα επιλεγμένα φίλτρα."
                        action={{
                          label: 'Καθαρισμός φίλτρων',
                          onClick: clearDocumentFilters,
                        }}
                      />
                    ) : (
                      <DocumentsTable
                        documents={filteredDocuments}
                        onDocTitleClick={(document) => viewDocument(document)}
                        renderVisibility={(document) => (
                          <button
                            className={
                              document.visibility === 'visible_to_students'
                                ? 'status-badge is-active document-visibility-badge'
                                : 'status-badge is-inactive document-visibility-badge'
                            }
                            type="button"
                            onClick={() => toggleVisibility(document)}
                          >
                            {document.visibility === 'visible_to_students'
                              ? 'Ορατό'
                              : 'Κρυφό'}
                          </button>
                        )}
                        renderActions={(document) => (
                          <ActionsMenu
                            label={`Ενέργειες για ${document.title}`}
                            items={[
                              {
                                label: 'Προβολή',
                                icon: Eye,
                                onSelect: () => viewDocument(document),
                              },
                              {
                                label: 'Επεξεργασία',
                                icon: Pencil,
                                onSelect: () => openEdit(document),
                              },
                              {
                                label: 'Κατέβασμα',
                                icon: Download,
                                onSelect: () =>
                                  downloadMutation.mutate(document),
                              },
                            ]}
                          />
                        )}
                      />
                    )}
                  </div>
                )}
                {tab === 'details' && (
                  <div className="course-details">
                    <div className="course-section-heading">
                      <h2>Στοιχεία μαθήματος</h2>
                    </div>
                    <dl>
                      <div>
                        <dt>Κωδικός</dt>
                        <dd>{detail.code}</dd>
                      </div>
                      <div>
                        <dt>Πιστωτικές μονάδες</dt>
                        <dd>{detail.ectsCredits} ECTS</dd>
                      </div>
                      <div>
                        <dt>Εξάμηνο</dt>
                        <dd>{detail.semester}ο εξάμηνο</dd>
                      </div>
                    </dl>
                    <section
                      className="course-description-section"
                      aria-labelledby="professor-course-description-heading"
                    >
                      <h2 id="professor-course-description-heading">
                        Περιγραφή
                      </h2>
                      <p>
                        {detail.description ?? 'Δεν έχει προστεθεί περιγραφή.'}
                      </p>
                    </section>
                  </div>
                )}
              </div>
              <div className="course-detail-sidebar">
                <aside className="course-summary" aria-label="Σύνοψη μαθήματος">
                  <h2>Σύνοψη</h2>
                  <dl>
                    <div>
                      <dt>Κατάσταση</dt>
                      <dd>
                        <StatusBadge
                          active={detail.isActive}
                          activeLabel="Ενεργό"
                          inactiveLabel="Ανενεργό"
                        />
                      </dd>
                    </div>
                    <div>
                      <dt>Εξάμηνο</dt>
                      <dd>{detail.semester}ο εξάμηνο</dd>
                    </div>
                    <div>
                      <dt>Εγγεγραμμένοι φοιτητές</dt>
                      <dd>{detail.studentCount}</dd>
                    </div>
                    <div>
                      <dt>Ορατά / συνολικά έγγραφα</dt>
                      <dd>
                        {detail.counts.visibleDocumentCount} /{' '}
                        {detail.counts.documentCount}
                      </dd>
                    </div>
                  </dl>
                </aside>
                <div className="course-list-card">
                  <div className="course-members">
                    <h2>Διδάσκοντες</h2>
                    {detail.instructors.map((instructor) => (
                      <div
                        className="member-row instructor-row"
                        key={instructor.id}
                      >
                        <Avatar name={instructor.fullName} fallback="?" />
                        <div>
                          <strong>
                            {instructor.fullName}
                            {instructor.userId === user.id && ' · Εσείς'}
                          </strong>
                          <span>{instructorRoleLabels[instructor.role]}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            {(dialog?.type === 'create' || dialog?.type === 'edit') && (
              <DocumentFormDialog
                mode={dialog.type}
                courseCode={detail.code}
                courseTitle={detail.title}
                initial={dialog.type === 'edit' ? dialog.document : undefined}
                existingDocuments={documents}
                pending={createMutation.isPending || saveMutation.isPending}
                error={
                  createMutation.isError
                    ? messageFor(createMutation.error)
                    : saveMutation.isError
                      ? messageFor(saveMutation.error)
                      : null
                }
                onCancel={closeDialog}
                onSubmit={(values: DocumentFormValues) => {
                  if (dialog.type === 'create') {
                    const formData = new FormData();
                    formData.set('title', values.title);
                    formData.set('visibility', values.visibility);
                    const trimmedDescription = values.description.trim();
                    if (trimmedDescription) {
                      formData.set('description', trimmedDescription);
                    }
                    const file = values.file?.item(0);
                    if (file) formData.set('file', file);
                    createMutation.mutate(formData);
                  } else {
                    saveMutation.mutate({
                      documentId: dialog.document.id,
                      input: {
                        title: values.title,
                        visibility: values.visibility,
                        description: values.description.trim() || null,
                      },
                    });
                  }
                }}
              />
            )}
            {dialog?.type === 'visibility' && (
              <Dialog
                title={
                  dialog.document.visibility === 'visible_to_students'
                    ? 'Απόκρυψη εγγράφου'
                    : 'Εμφάνιση εγγράφου'
                }
                onClose={closeDialog}
              >
                <div className="confirm-dialog">
                  <p>
                    «{dialog.document.title}» —{' '}
                    {dialog.document.visibility === 'visible_to_students'
                      ? 'θα κρυφτεί από τους φοιτητές και θα παραμείνει διαθέσιμο στους διδάσκοντες του μαθήματος.'
                      : 'θα γίνει διαθέσιμο σε όλους τους εγγεγραμμένους φοιτητές.'}
                  </p>
                  {visibilityMutation.isError && (
                    <ErrorNotice>
                      {messageFor(visibilityMutation.error)}
                    </ErrorNotice>
                  )}
                  <footer className="course-dialog-actions">
                    <button
                      className="secondary-button"
                      type="button"
                      onClick={closeDialog}
                    >
                      Ακύρωση
                    </button>
                    <button
                      className="primary-button"
                      disabled={visibilityMutation.isPending}
                      type="button"
                      onClick={() =>
                        visibilityMutation.mutate({
                          documentId: dialog.document.id,
                          input: {
                            visibility:
                              dialog.document.visibility ===
                              'visible_to_students'
                                ? 'hidden_from_students'
                                : 'visible_to_students',
                          },
                        })
                      }
                    >
                      Επιβεβαίωση
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

