import { useCallback, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import type { ProfessorCourseListItem } from '@web-app/contracts';

import { ApiClientError, fetchProfessorCourses } from '../../../api/client';
import { ErrorNotice } from '../../../components/feedback';
import { getAcademicYearLabel } from '../../../lib/academic-year';
import { normalizeSearch } from '../../../lib/normalize-search';

export const professorCoursesKey = ['professor', 'courses'] as const;

const instructorRoleLabels: Record<
  ProfessorCourseListItem['instructorRole'],
  string
> = {
  owner: 'Υπεύθυνος μαθήματος',
  assistant: 'Συνεργάτης διδάσκων',
};

function messageFor(error: unknown): string {
  if (error instanceof ApiClientError) return error.message;
  return 'Η φόρτωση των μαθημάτων απέτυχε. Δοκίμασε ξανά.';
}

function compareCourses(
  a: ProfessorCourseListItem,
  b: ProfessorCourseListItem,
  direction: 'asc' | 'desc',
): number {
  const diff = (a.semester - b.semester) * (direction === 'asc' ? 1 : -1);
  if (diff !== 0) return diff;
  return a.title.localeCompare(b.title, 'el');
}

function StatusBadge({ isActive }: { isActive: boolean }): React.JSX.Element {
  return (
    <span className={isActive ? 'status-badge is-active' : 'status-badge is-inactive'}>
      {isActive ? 'Ενεργό' : 'Ανενεργό'}
    </span>
  );
}

function CourseCounts({
  course,
}: {
  course: ProfessorCourseListItem;
}): React.JSX.Element {
  return (
    <span className="course-card-counts">
      <span>{course.counts.documentCount} έγγραφα</span>
      <span>{course.counts.visibleDocumentCount} ορατά</span>
    </span>
  );
}

function CourseCard({
  course,
}: {
  course: ProfessorCourseListItem;
}): React.JSX.Element {
  return (
    <Link className="course-card" to={`/app/courses/${course.id}`}>
      <div className="course-card-top">
        <span className="course-card-code">
          {course.code} · {course.semester}ο εξάμηνο
        </span>
        <StatusBadge isActive={course.isActive} />
      </div>
      <h2>{course.title}</h2>
      <p className="course-card-role">{instructorRoleLabels[course.instructorRole]}</p>
      {course.description && (
        <p className="course-card-description">{course.description}</p>
      )}
      <CourseCounts course={course} />
    </Link>
  );
}

function CourseListRow({
  course,
}: {
  course: ProfessorCourseListItem;
}): React.JSX.Element {
  return (
    <Link className="course-list-row" to={`/app/courses/${course.id}`}>
      <span className="course-card-code">
        {course.code} · {course.semester}ο εξάμηνο
      </span>
      <strong>{course.title}</strong>
      <span className="course-card-role">
        {instructorRoleLabels[course.instructorRole]}
      </span>
      <StatusBadge isActive={course.isActive} />
      <CourseCounts course={course} />
    </Link>
  );
}

export function ProfessorCoursesPage(): React.JSX.Element {
  const [params, setParams] = useSearchParams();
  const search = params.get('search') ?? '';
  const semesterParam = params.get('semester');
  const semester = semesterParam ? Number(semesterParam) : undefined;
  const sort = params.get('sort') === 'desc' ? 'desc' : 'asc';
  const view = params.get('view') === 'list' ? 'list' : 'cards';

  const setFilter = useCallback(
    (next: Record<string, string | undefined>) => {
      const updated = new URLSearchParams(params);
      Object.entries(next).forEach(([key, value]) =>
        value ? updated.set(key, value) : updated.delete(key),
      );
      setParams(updated);
    },
    [params, setParams],
  );

  const query = useQuery({
    queryKey: professorCoursesKey,
    queryFn: ({ signal }) => fetchProfessorCourses(signal),
  });

  const courses = useMemo(() => query.data?.data ?? [], [query.data]);

  const semesterOptions = useMemo(
    () => Array.from(new Set(courses.map((course) => course.semester))).sort(
      (a, b) => a - b,
    ),
    [courses],
  );

  const normalizedSearch = normalizeSearch(search);
  const filtered = useMemo(() => {
    return courses.filter((course) => {
      if (semester && course.semester !== semester) return false;
      if (!normalizedSearch) return true;
      return normalizeSearch(`${course.title} ${course.code}`).includes(
        normalizedSearch,
      );
    });
  }, [courses, semester, normalizedSearch]);

  const sorted = useMemo(
    () => [...filtered].sort((a, b) => compareCourses(a, b, sort)),
    [filtered, sort],
  );

  const hasFilters = !!search || !!semester;
  const clearFilters = () => setFilter({ search: undefined, semester: undefined });

  return (
    <section className="professor-courses-page">
      <header className="course-page-header">
        <div>
          <p className="auth-kicker">
            Ακαδημαϊκό έτος {getAcademicYearLabel()}
          </p>
          <h1>Τα μαθήματά μου</h1>
          <p>Πρόσβαση στα μαθήματα που σου έχουν ανατεθεί και στο υλικό τους.</p>
        </div>
      </header>
      <div className="course-stat-grid">
        <article>
          <span>Ανατεθειμένα μαθήματα</span>
          <strong>{query.data?.summary.assignedCourseCount ?? 0}</strong>
        </article>
      </div>
      {query.isPending && <p role="status">Φόρτωση μαθημάτων…</p>}
      {query.isError && (
        <ErrorNotice>
          {messageFor(query.error)}{' '}
          <button
            className="secondary-button"
            type="button"
            onClick={() => void query.refetch()}
          >
            Δοκίμασε ξανά
          </button>
        </ErrorNotice>
      )}
      {!query.isPending && !query.isError && (
        <div className="course-list-card professor-courses-card">
          <div className="course-filter-row text-sm">
            <input
              aria-label="Αναζήτηση μαθημάτων"
              placeholder="Αναζήτηση τίτλου ή κωδικού…"
              value={search}
              onChange={(event) =>
                setFilter({ search: event.target.value || undefined })
              }
            />
            <select
              aria-label="Φίλτρο εξαμήνου"
              value={semester ?? ''}
              onChange={(event) =>
                setFilter({ semester: event.target.value || undefined })
              }
            >
              <option value="">Όλα τα εξάμηνα</option>
              {semesterOptions.map((item) => (
                <option key={item} value={item}>
                  {item}ο εξάμηνο
                </option>
              ))}
            </select>
            <button
              className="secondary-button"
              type="button"
              onClick={() =>
                setFilter({ sort: sort === 'asc' ? 'desc' : undefined })
              }
            >
              Εξάμηνο {sort === 'asc' ? '↑' : '↓'}
            </button>
            <div className="view-toggle" role="group" aria-label="Προβολή μαθημάτων">
              <button
                type="button"
                aria-pressed={view === 'cards'}
                onClick={() => setFilter({ view: undefined })}
              >
                Κάρτες
              </button>
              <button
                type="button"
                aria-pressed={view === 'list'}
                onClick={() => setFilter({ view: 'list' })}
              >
                Λίστα
              </button>
            </div>
          </div>
          {courses.length === 0 ? (
            <p className="course-empty">Δεν σου έχουν ανατεθεί μαθήματα.</p>
          ) : sorted.length === 0 ? (
            <div className="course-empty">
              <p>Δεν βρέθηκαν μαθήματα για τα επιλεγμένα φίλτρα.</p>
              {hasFilters && (
                <button
                  className="secondary-button"
                  type="button"
                  onClick={clearFilters}
                >
                  Καθαρισμός φίλτρων
                </button>
              )}
            </div>
          ) : view === 'cards' ? (
            <div className="course-card-grid">
              {sorted.map((course) => (
                <CourseCard course={course} key={course.id} />
              ))}
            </div>
          ) : (
            <div className="course-list-rows">
              {sorted.map((course) => (
                <CourseListRow course={course} key={course.id} />
              ))}
            </div>
          )}
        </div>
      )}
      <p className="course-page-footnote">
        Οι αναθέσεις μαθημάτων ορίζονται από τον διαχειριστή.
      </p>
    </section>
  );
}
