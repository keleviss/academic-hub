import { useMemo } from 'react';
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import type { ProfessorCourseListItem } from '@web-app/contracts';

import { fetchProfessorCourses } from '../../../../api/client';
import { CourseResultsPanel } from '../../../../components/CourseResultsPanel';
import { EmptyState } from '../../../../components/EmptyState';
import { QueryState } from '../../../../components/QueryState';
import { StatusBadge } from '../../../../components/StatusBadge';
import { useUrlFilters } from '../../../../hooks/useUrlFilters';
import { getAcademicYearLabel } from '../../../../lib/academic-year';
import { normalizeSearch } from '../../../../lib/normalize-search';
import { PageLayout } from '../../../../components/PageLayout';
import {
  instructorRoleLabels,
  professorCoursesKey,
} from '../utils/ProfessorCourses.const';
import { compareCourses } from '../utils/ProfessorCoursesUtils';

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
        <StatusBadge
          active={course.isActive}
          activeLabel="Ενεργό"
          inactiveLabel="Ανενεργό"
        />
      </div>
      <h2>{course.title}</h2>
      <p className="course-card-role">
        {instructorRoleLabels[course.instructorRole]}
      </p>
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
    <div className="course-list-row">
      <span className="course-card-code">
        {course.code} · {course.semester}ο εξάμηνο
      </span>
      <Link to={`/app/courses/${course.id}`} className="hover:underline">
        <strong>{course.title}</strong>
      </Link>
      <span className="course-card-role">
        {instructorRoleLabels[course.instructorRole]}
      </span>
      <StatusBadge
        active={course.isActive}
        activeLabel="Ενεργό"
        inactiveLabel="Ανενεργό"
      />
      <CourseCounts course={course} />
    </div>
  );
}

export function ProfessorCoursesPage(): React.JSX.Element {
  const { params, setFilter } = useUrlFilters();
  const search = params.get('search') ?? '';
  const semesterParam = params.get('semester');
  const semester = semesterParam ? Number(semesterParam) : undefined;
  const sort = params.get('sort') === 'desc' ? 'desc' : 'asc';
  const view = params.get('view') === 'list' ? 'list' : 'cards';

  const query = useQuery({
    queryKey: professorCoursesKey,
    queryFn: ({ signal }) => fetchProfessorCourses(signal),
  });

  const courses = useMemo(() => query.data?.data ?? [], [query.data]);

  const semesterOptions = useMemo(
    () =>
      Array.from(new Set(courses.map((course) => course.semester))).sort(
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
  const clearFilters = () =>
    setFilter({ search: undefined, semester: undefined });

  return (
    <PageLayout
      title="Τα μαθήματά μου"
      subtitle="Πρόσβαση στα μαθήματα που σου έχουν ανατεθεί και στο υλικό τους."
      actions={
        <div className="flex flex-col items-end">
          <p className="text-hub-muted text-xs">Ακαδημαϊκό έτος</p>
          <p className="text-hub-teal-dark text-[15px] font-semibold">
            {getAcademicYearLabel()}
          </p>
        </div>
      }
    >
      <QueryState
        query={query}
        loadingLabel="Φόρτωση μαθημάτων…"
        errorOptions={{
          fallback: 'Η φόρτωση των μαθημάτων απέτυχε. Δοκίμασε ξανά.',
        }}
        onRetry={() => void query.refetch()}
      >
        {() => (
          <CourseResultsPanel
            view={view}
            items={sorted}
            getKey={(course) => course.id}
            renderCard={(course) => <CourseCard course={course} />}
            renderRow={(course) => <CourseListRow course={course} />}
            filters={
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
                <div
                  className="view-toggle"
                  role="group"
                  aria-label="Προβολή μαθημάτων"
                >
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
            }
            header={
              <div className="course-results-header">
                <p>Ανατεθειμένα μαθήματα</p>
                <span>
                  {query.data?.summary.assignedCourseCount ?? 0}{' '}
                  {(query.data?.summary.assignedCourseCount ?? 0) === 1
                    ? 'μάθημα'
                    : 'μαθήματα'}
                </span>
              </div>
            }
            emptyState={
              courses.length === 0 ? (
                <EmptyState message="Δεν σου έχουν ανατεθεί μαθήματα." />
              ) : sorted.length === 0 ? (
                <EmptyState
                  message="Δεν βρέθηκαν μαθήματα για τα επιλεγμένα φίλτρα."
                  action={
                    hasFilters
                      ? { label: 'Καθαρισμός φίλτρων', onClick: clearFilters }
                      : undefined
                  }
                />
              ) : undefined
            }
          />
        )}
      </QueryState>
      <p className="course-page-footnote">
        Οι αναθέσεις μαθημάτων ορίζονται από τον διαχειριστή.
      </p>
    </PageLayout>
  );
}
