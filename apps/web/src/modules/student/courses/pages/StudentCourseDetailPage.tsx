import { useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Download, Eye } from 'lucide-react';
import type { StudentDocumentActivitySummary as StudentDocumentActivitySummaryData } from '@web-app/contracts';

import {
  fetchCourseDocumentContent,
  fetchCourseDocuments,
  fetchStudentCourse,
  fetchStudentDocumentActivity,
} from '../../../../api/client';
import { ActionsMenu } from '../../../../components/ActionsMenu';
import { Avatar } from '../../../../components/Avatar';
import { DocumentsTable } from '../../../../components/DocumentsTable';
import { EmptyState } from '../../../../components/EmptyState';
import { QueryState } from '../../../../components/QueryState';
import { Tabs } from '../../../../components/Tabs';
import { useNotifyingMutation } from '../../../../hooks/useNotifyingMutation';
import { CourseForumTab } from '../../../workspace/discussions/components/CourseForumTab';
import { CourseRoadmapTab } from '../../../workspace/roadmap/components/CourseRoadmapTab';
import { downloadBlob } from '../../../../lib/download-file';
import { normalizeSearch } from '../../../../lib/normalize-search';
import { PageLayout } from '../../../../components/PageLayout';
import { useSetWorkspaceBreadcrumb } from '../../../../components/workspaceBreadcrumb';

type Tab = 'documents' | 'roadmap' | 'discussions' | 'details';

const instructorRoleLabels = {
  owner: 'Υπεύθυνος μαθήματος',
  assistant: 'Συνεργάτης διδάσκων',
} as const;

function documentsQueryKey(courseId: string) {
  return ['courses', courseId, 'documents'] as const;
}

function studentCourseKey(courseId: string) {
  return ['student', 'courses', courseId] as const;
}

function studentDocumentActivityKey(courseId: string) {
  return ['student', 'courses', courseId, 'document-activity'] as const;
}

export function StudentCourseDetailPage(): React.JSX.Element {
  const { courseId = '' } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const tab: Tab =
    requestedTab === 'roadmap' ||
    requestedTab === 'discussions' ||
    requestedTab === 'details'
      ? requestedTab
      : 'documents';
  const selectedRoadmapNodeId = searchParams.get('node');
  const [docSearch, setDocSearch] = useState('');

  const setTab = (nextTab: Tab) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.set('tab', nextTab);
      if (nextTab !== 'roadmap') next.delete('node');
      return next;
    });
  };

  const setSelectedRoadmapNode = (nodeId: string | null) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.set('tab', 'roadmap');
      if (nodeId) next.set('node', nodeId);
      else next.delete('node');
      return next;
    });
  };

  const courseQuery = useQuery({
    queryKey: studentCourseKey(courseId),
    queryFn: ({ signal }) => fetchStudentCourse(courseId, signal),
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
  const activityQuery = useQuery({
    queryKey: studentDocumentActivityKey(courseId),
    queryFn: ({ signal }) => fetchStudentDocumentActivity(courseId, signal),
    enabled: !!courseId,
  });

  const documents = documentsQuery.data?.data ?? [];
  const totalDocuments = documents.length;

  const downloadMutation = useNotifyingMutation({
    mutationFn: (document: (typeof documents)[number]) =>
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

  const filteredDocuments = useMemo(() => {
    const sorted = [...documents].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    const normalizedSearch = normalizeSearch(docSearch);
    if (!normalizedSearch) return sorted;
    return sorted.filter((document) =>
      normalizeSearch(
        `${document.title} ${document.originalFilename ?? ''}`,
      ).includes(normalizedSearch),
    );
  }, [documents, docSearch]);

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
            subtitle={`Υλικό και στοιχεία για το μάθημα ${detail.title}`}
            backlink={{ href: '/app/courses', text: 'Τα μαθήματά μου' }}
          >
            <div
              className={`course-detail-layout${
                tab === 'roadmap' ? ' is-roadmap' : ''
              }`}
            >
              <div className="course-list-card">
                <Tabs
                  value={tab}
                  onChange={setTab}
                  items={[
                    {
                      value: 'documents',
                      label: `Έγγραφα`,
                    },
                    { value: 'roadmap', label: 'Χάρτης ύλης' },
                    { value: 'discussions', label: 'Συζητήσεις' },
                    { value: 'details', label: 'Στοιχεία μαθήματος' },
                  ]}
                />
                {tab === 'discussions' && (
                  <CourseForumTab courseId={courseId} />
                )}
                {tab === 'roadmap' && (
                  <CourseRoadmapTab
                    courseId={courseId}
                    documents={documents}
                    selectedNodeId={selectedRoadmapNodeId}
                    onSelectedNodeChange={setSelectedRoadmapNode}
                  />
                )}
                {tab === 'documents' && (
                  <div className="course-members">
                    <div className="course-filter-row text-sm">
                      <input
                        aria-label="Αναζήτηση υλικού"
                        placeholder="Αναζήτηση τίτλου ή αρχείου…"
                        value={docSearch}
                        onChange={(event) => setDocSearch(event.target.value)}
                      />
                    </div>
                    {totalDocuments === 0 ? (
                      <EmptyState message="Δεν υπάρχει ορατό υλικό ακόμα." />
                    ) : filteredDocuments.length === 0 ? (
                      <EmptyState
                        message="Δεν βρέθηκε υλικό για την αναζήτηση."
                        action={{
                          label: 'Καθαρισμός αναζήτησης',
                          onClick: () => setDocSearch(''),
                        }}
                      />
                    ) : (
                      <DocumentsTable
                        documents={filteredDocuments}
                        onDocTitleClick={(document) =>
                          navigate(
                            `/app/courses/${courseId}/documents/${document.id}`,
                          )
                        }
                        renderActions={(document) => (
                          <ActionsMenu
                            label={`Ενέργειες για ${document.title}`}
                            items={[
                              {
                                label: 'Προβολή',
                                icon: Eye,
                                onSelect: () =>
                                  navigate(
                                    `/app/courses/${courseId}/documents/${document.id}`,
                                  ),
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
                      aria-labelledby="student-course-description-heading"
                    >
                      <h2 id="student-course-description-heading">Περιγραφή</h2>
                      <p>
                        {detail.description ?? 'Δεν έχει προστεθεί περιγραφή.'}
                      </p>
                    </section>
                  </div>
                )}
              </div>
              {tab !== 'roadmap' && (
                <div className="course-detail-sidebar">
                  <aside
                    className="course-summary"
                    aria-label="Σύνοψη μαθήματος"
                  >
                    <h2>Σύνοψη</h2>
                    <dl>
                      <div>
                        <dt>Εξάμηνο</dt>
                        <dd>{detail.semester}ο εξάμηνο</dd>
                      </div>
                      <div>
                        <dt>Διαθέσιμο υλικό</dt>
                        <dd>{detail.counts.documentCount}</dd>
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
                            <strong>{instructor.fullName}</strong>
                            <span>{instructorRoleLabels[instructor.role]}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="visibility-explainer">
                    <h2>Οι σημειώσεις και απορίες μου</h2>
                    <QueryState
                      query={activityQuery}
                      loadingLabel="Φόρτωση δραστηριότητας…"
                      onRetry={() => void activityQuery.refetch()}
                    >
                      {(activity) => (
                        <StudentDocumentActivitySummary
                          data={activity.data}
                          onOpenDocument={(documentId) =>
                            navigate(
                              `/app/courses/${courseId}/documents/${documentId}`,
                            )
                          }
                        />
                      )}
                    </QueryState>
                  </div>
                </div>
              )}
            </div>
          </PageLayout>
        );
      }}
    </QueryState>
  );
}

function StudentDocumentActivitySummary({
  data,
  onOpenDocument,
}: {
  data: StudentDocumentActivitySummaryData;
  onOpenDocument: (documentId: string) => void;
}): React.JSX.Element {
  const hasActivity =
    data.annotations.length > 0 ||
    data.openQuestions.length > 0 ||
    data.verifiedAnswers.length > 0;

  if (!hasActivity) {
    return <p>Δεν υπάρχουν ακόμα σημειώσεις ή απορίες για αυτό το μάθημα.</p>;
  }

  return (
    <div className="document-activity-summary">
      <ActivityGroup title="Πρόσφατες σημειώσεις">
        {data.annotations.length === 0 ? (
          <span>Δεν υπάρχουν πρόσφατες σημειώσεις.</span>
        ) : (
          data.annotations.map((annotation) => (
            <button
              key={annotation.id}
              type="button"
              onClick={() => onOpenDocument(annotation.documentId)}
            >
              <strong>{annotation.body ?? 'Χωρίς κείμενο'}</strong>
              <span>Σελίδα {annotation.target.pageNumber}</span>
            </button>
          ))
        )}
      </ActivityGroup>
      <ActivityGroup title="Ανοιχτές απορίες">
        {data.openQuestions.length === 0 ? (
          <span>Δεν υπάρχουν ανοιχτές απορίες.</span>
        ) : (
          data.openQuestions.map((question) => (
            <button
              key={question.id}
              type="button"
              disabled={!question.documentId}
              onClick={() => {
                if (question.documentId) onOpenDocument(question.documentId);
              }}
            >
              <strong>{question.title}</strong>
              <span>
                {question.pageNumber
                  ? `Σελίδα ${question.pageNumber}`
                  : 'Χωρίς σελίδα'}
              </span>
            </button>
          ))
        )}
      </ActivityGroup>
      <ActivityGroup title="Πρόσφατες επίσημες απαντήσεις">
        {data.verifiedAnswers.length === 0 ? (
          <span>Δεν υπάρχουν ακόμα επίσημες απαντήσεις.</span>
        ) : (
          data.verifiedAnswers.map((question) => (
            <button
              key={question.id}
              type="button"
              disabled={!question.documentId}
              onClick={() => {
                if (question.documentId) onOpenDocument(question.documentId);
              }}
            >
              <strong>{question.title}</strong>
              <span>Επίσημη απάντηση</span>
            </button>
          ))
        )}
      </ActivityGroup>
    </div>
  );
}

function ActivityGroup({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}): React.JSX.Element {
  return (
    <section className="document-activity-group">
      <h3>{title}</h3>
      <div>{children}</div>
    </section>
  );
}
