import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { FileText } from 'lucide-react';

import {
  fetchCourseDocuments,
  fetchStudentCourse,
} from '../../../../api/client';
import { Avatar } from '../../../../components/Avatar';
import { EmptyState } from '../../../../components/EmptyState';
import { QueryState } from '../../../../components/QueryState';
import { Tabs } from '../../../../components/Tabs';
import { normalizeSearch } from '../../../../lib/normalize-search';
import { PageLayout } from '../../../../components/PageLayout';

type Tab = 'documents' | 'details';

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

export function StudentCourseDetailPage(): React.JSX.Element {
  const { courseId = '' } = useParams();
  const [tab, setTab] = useState<Tab>('documents');
  const [docSearch, setDocSearch] = useState('');

  useEffect(() => {
    return () => {
      setDocSearch('');
      setTab('documents');
    };
  }, []);

  const courseQuery = useQuery({
    queryKey: studentCourseKey(courseId),
    queryFn: ({ signal }) => fetchStudentCourse(courseId, signal),
    enabled: !!courseId,
  });
  const documentsQuery = useQuery({
    queryKey: documentsQueryKey(courseId),
    queryFn: ({ signal }) => fetchCourseDocuments(courseId, signal),
    enabled: !!courseId,
  });

  const documents = documentsQuery.data?.data ?? [];
  const totalDocuments = documents.length;

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
            <div className="course-detail-layout">
              <div className="course-list-card">
                <Tabs
                  value={tab}
                  onChange={setTab}
                  items={[
                    {
                      value: 'documents',
                      label: `Υλικό (${totalDocuments})`,
                    },
                    { value: 'details', label: 'Στοιχεία μαθήματος' },
                  ]}
                />
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
                      <ul className="document-list">
                        {filteredDocuments.map((document) => (
                          <li className="document-row" key={document.id}>
                            <FileText aria-hidden="true" size={20} />
                            <div className="document-row-main">
                              <span className="document-row-title">
                                {document.title}
                              </span>
                              <span>{document.originalFilename}</span>
                            </div>
                            <span className="document-row-date">
                              {new Date(document.updatedAt).toLocaleDateString(
                                'el-GR',
                                {
                                  day: '2-digit',
                                  month: '2-digit',
                                  year: 'numeric',
                                },
                              )}
                            </span>
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
              <div className="course-detail-sidebar">
                <aside className="course-summary" aria-label="Σύνοψη μαθήματος">
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
                  <h2>Roadmap &amp; Πρόοδος</h2>
                  <p>
                    Σύντομα εδώ θα εμφανίζεται η μαθησιακή σου πορεία ανά έννοια
                    πάνω στο υλικό του μαθήματος.
                  </p>
                </div>
              </div>
            </div>
          </PageLayout>
        );
      }}
    </QueryState>
  );
}
