import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileText } from 'lucide-react';
import type {
  CourseDocumentMetadata,
  CreateCourseDocumentRequest,
  UpdateCourseDocumentMetadataRequest,
} from '@web-app/contracts';

import {
  ApiClientError,
  createCourseDocument,
  fetchCourseDocuments,
  fetchProfessorCourse,
  updateCourseDocumentMetadata,
} from '../../../api/client';
import { useAuthenticatedUser } from '../../../auth/authenticatedUser';
import { Dialog } from '../../../components/Dialog';
import { ErrorNotice } from '../../../components/feedback';
import { useNotification } from '../../../components/notifications';
import { normalizeSearch } from '../../../lib/normalize-search';
import { DocumentFormDialog, type DocumentFormValues } from '../components/DocumentFormDialog';
import { professorCoursesKey } from './ProfessorCoursesPage';

type Tab = 'documents' | 'details';
type DocumentFilter = 'all' | 'visible' | 'hidden';
type DialogState =
  | { type: 'create' }
  | { type: 'edit'; document: CourseDocumentMetadata }
  | { type: 'visibility'; document: CourseDocumentMetadata }
  | null;

const instructorRoleLabels = {
  owner: 'Υπεύθυνος μαθήματος',
  assistant: 'Συνεργάτης διδάσκων',
} as const;

function messageFor(error: unknown): string {
  if (error instanceof ApiClientError) {
    if (error.status === 403)
      return 'Δεν έχεις πρόσβαση σε αυτό το μάθημα.';
    if (error.status === 404) return 'Το μάθημα δεν βρέθηκε.';
    return error.message;
  }
  return 'Η ενέργεια δεν ολοκληρώθηκε. Δοκίμασε ξανά.';
}

function initialsFor(fullName: string): string {
  const initials = fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('');
  return (initials || '?').toLocaleUpperCase('el-GR');
}

function documentsQueryKey(courseId: string) {
  return ['courses', courseId, 'documents'] as const;
}

function professorCourseKey(courseId: string) {
  return [...professorCoursesKey, courseId] as const;
}

export function ProfessorCourseDetailPage(): React.JSX.Element {
  const { courseId = '' } = useParams();
  const user = useAuthenticatedUser();
  const client = useQueryClient();
  const { notify } = useNotification();
  const [tab, setTab] = useState<Tab>('documents');
  const [dialog, setDialog] = useState<DialogState>(null);
  const [docSearch, setDocSearch] = useState('');
  const [docFilter, setDocFilter] = useState<DocumentFilter>('all');

  useEffect(() => {
    setDocSearch('');
    setDocFilter('all');
    setTab('documents');
  }, [courseId]);

  const courseQuery = useQuery({
    queryKey: professorCourseKey(courseId),
    queryFn: ({ signal }) => fetchProfessorCourse(courseId, signal),
    enabled: !!courseId,
  });
  const documentsQuery = useQuery({
    queryKey: documentsQueryKey(courseId),
    queryFn: ({ signal }) => fetchCourseDocuments(courseId, signal),
    enabled: !!courseId,
  });

  const refreshAfterMutation = async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: professorCoursesKey }),
      client.invalidateQueries({ queryKey: professorCourseKey(courseId) }),
      client.invalidateQueries({ queryKey: documentsQueryKey(courseId) }),
    ]);
  };

  const createMutation = useMutation({
    mutationFn: (input: CreateCourseDocumentRequest) =>
      createCourseDocument(courseId, input),
    onSuccess: async () => {
      await refreshAfterMutation();
      setDialog(null);
      setTab('documents');
      setDocSearch('');
      setDocFilter('all');
      notify({ kind: 'success', message: 'Το έγγραφο δημιουργήθηκε.' });
    },
  });
  const saveMutation = useMutation({
    mutationFn: ({
      documentId,
      input,
    }: {
      documentId: string;
      input: UpdateCourseDocumentMetadataRequest;
    }) => updateCourseDocumentMetadata(courseId, documentId, input),
    onSuccess: async () => {
      await refreshAfterMutation();
      setDialog(null);
      setTab('documents');
      setDocSearch('');
      setDocFilter('all');
      notify({ kind: 'success', message: 'Οι αλλαγές αποθηκεύτηκαν.' });
    },
  });
  const visibilityMutation = useMutation({
    mutationFn: ({
      documentId,
      input,
    }: {
      documentId: string;
      input: UpdateCourseDocumentMetadataRequest;
    }) => updateCourseDocumentMetadata(courseId, documentId, input),
    onSuccess: async () => {
      await refreshAfterMutation();
      setDialog(null);
      notify({
        kind: 'success',
        message: 'Η ορατότητα του εγγράφου ενημερώθηκε.',
      });
    },
  });

  const detail = courseQuery.data?.data;
  const documents = documentsQuery.data?.data ?? [];
  const totalDocuments = documents.length;

  const filteredDocuments = useMemo(() => {
    const sorted = [...documents].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    const normalizedSearch = normalizeSearch(docSearch);
    return sorted.filter((document) => {
      if (docFilter === 'visible' && document.visibility !== 'visible_to_students')
        return false;
      if (docFilter === 'hidden' && document.visibility !== 'hidden_from_students')
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

  if (courseQuery.isPending) return <p role="status">Φόρτωση μαθήματος…</p>;
  if (courseQuery.isError || !detail) {
    return (
      <section className="professor-course-detail-page">
        <Link className="back-link" to="/app/courses">
          ← Τα μαθήματά μου
        </Link>
        <ErrorNotice>{messageFor(courseQuery.error)}</ErrorNotice>
      </section>
    );
  }

  const openEdit = (document: CourseDocumentMetadata) =>
    setDialog({ type: 'edit', document });
  const toggleVisibility = (document: CourseDocumentMetadata) =>
    setDialog({ type: 'visibility', document });

  return (
    <section className="professor-course-detail-page">
      <Link className="back-link" to="/app/courses">
        ← Τα μαθήματά μου
      </Link>
      <header className="course-detail-header">
        <div>
          <p className="auth-kicker">
            {detail.code} · {detail.semester}ο εξάμηνο
          </p>
          <h1>{detail.title}</h1>
          <p>
            {instructorRoleLabels[detail.instructorRole]} · {detail.ectsCredits}{' '}
            ECTS
          </p>
        </div>
        <button
          className="primary-button"
          type="button"
          onClick={() => setDialog({ type: 'create' })}
        >
          + Νέο έγγραφο
        </button>
      </header>
      <div className="course-detail-layout">
        <div className="course-list-card">
          <div className="course-filter-tabs" role="tablist">
            {(
              [
                ['documents', `Έγγραφα (${totalDocuments})`],
                ['details', 'Στοιχεία μαθήματος'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                className={tab === value ? 'is-active' : ''}
                type="button"
                onClick={() => setTab(value)}
              >
                {label}
              </button>
            ))}
          </div>
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
                <div className="course-empty">
                  <p>Το πρώτο υλικό ξεκινά εδώ.</p>
                  <button
                    className="primary-button"
                    type="button"
                    onClick={() => setDialog({ type: 'create' })}
                  >
                    Νέο έγγραφο
                  </button>
                </div>
              ) : filteredDocuments.length === 0 ? (
                <div className="course-empty">
                  <p>Δεν βρέθηκαν έγγραφα για τα επιλεγμένα φίλτρα.</p>
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={clearDocumentFilters}
                  >
                    Καθαρισμός φίλτρων
                  </button>
                </div>
              ) : (
                <ul className="document-list">
                  {filteredDocuments.map((document) => (
                    <li className="document-row" key={document.id}>
                      <FileText aria-hidden="true" size={20} />
                      <div className="document-row-main">
                        <button
                          className="document-row-title"
                          type="button"
                          onClick={() => openEdit(document)}
                        >
                          {document.title}
                        </button>
                        <span>{document.originalFilename}</span>
                      </div>
                      <span className="document-row-date">
                        {new Date(document.updatedAt).toLocaleDateString(
                          'el-GR',
                          { day: '2-digit', month: '2-digit', year: 'numeric' },
                        )}
                      </span>
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
                      <button
                        className="secondary-button"
                        type="button"
                        onClick={() => openEdit(document)}
                      >
                        Επεξεργασία
                      </button>
                    </li>
                  ))}
                </ul>
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
                <h2 id="professor-course-description-heading">Περιγραφή</h2>
                <p>{detail.description ?? 'Δεν έχει προστεθεί περιγραφή.'}</p>
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
                  <span
                    className={
                      detail.isActive
                        ? 'status-badge is-active'
                        : 'status-badge is-inactive'
                    }
                  >
                    {detail.isActive ? 'Ενεργό' : 'Ανενεργό'}
                  </span>
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
                <div className="member-row instructor-row" key={instructor.id}>
                  <span className="profile-avatar" aria-hidden="true">
                    {initialsFor(instructor.fullName)}
                  </span>
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
          <div className="visibility-explainer">
            <h2>Ορατότητα εγγράφων</h2>
            <p>
              <strong>Ορατό</strong> σημαίνει διαθέσιμο στους εγγεγραμμένους
              φοιτητές, όχι δημόσιο στο διαδίκτυο.
            </p>
            <p>
              <strong>Κρυφό</strong> σημαίνει κρυμμένο από τους φοιτητές αλλά
              διαθέσιμο στους εξουσιοδοτημένους διδάσκοντες.
            </p>
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
          onCancel={() => setDialog(null)}
          onSubmit={(values: DocumentFormValues) => {
            const input = {
              title: values.title,
              originalFilename: values.originalFilename,
              visibility: values.visibility,
              description: values.description.trim() || null,
            };
            if (dialog.type === 'create') {
              createMutation.mutate(input);
            } else {
              saveMutation.mutate({ documentId: dialog.document.id, input });
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
          onClose={() => setDialog(null)}
        >
          <div className="confirm-dialog">
            <p>
              «{dialog.document.title}» —{' '}
              {dialog.document.visibility === 'visible_to_students'
                ? 'θα κρυφτεί από τους φοιτητές και θα παραμείνει διαθέσιμο στους διδάσκοντες του μαθήματος.'
                : 'θα γίνει διαθέσιμο σε όλους τους εγγεγραμμένους φοιτητές.'}
            </p>
            {visibilityMutation.isError && (
              <ErrorNotice>{messageFor(visibilityMutation.error)}</ErrorNotice>
            )}
            <footer className="course-dialog-actions">
              <button
                className="secondary-button"
                type="button"
                onClick={() => setDialog(null)}
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
                        dialog.document.visibility === 'visible_to_students'
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
    </section>
  );
}
