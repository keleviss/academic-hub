import { useMemo } from 'react';
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import type { StudentCourseListItem } from '@web-app/contracts';

import { fetchStudentCourses } from '../../../../api/client';
import { CourseResultsPanel } from '../../../../components/CourseResultsPanel';
import { EmptyState } from '../../../../components/EmptyState';
import { QueryState } from '../../../../components/QueryState';
import { useUrlFilters } from '../../../../hooks/useUrlFilters';
import { getAcademicYearLabel } from '../../../../lib/academic-year';
import { normalizeSearch } from '../../../../lib/normalize-search';
import { PageLayout } from '../../../../components/PageLayout';
import { studentCoursesKey } from '../utils/StudentCourses.const';
import { compareCourses } from '../utils/StudentCoursesUtils';

function PrimaryInstructor({
  course,
}: {
  course: StudentCourseListItem;
}): React.JSX.Element {
  return (
    <span className="course-card-role">
      {course.primaryInstructor?.fullName ?? 'Δεν έχει οριστεί διδάσκων'}
    </span>
  );
}

function CourseCard({
  course,
}: {
  course: StudentCourseListItem;
}): React.JSX.Element {
  return (
    <Link className="course-card" to={`/app/courses/${course.id}`}>
      <h2>{course.title}</h2>
      <PrimaryInstructor course={course} />
      <div className="course-card-top">
        <span className="course-card-code">
          {course.code} · {course.semester}ο εξάμηνο
        </span>
      </div>
    </Link>
  );
}

function CourseListRow({
  course,
}: {
  course: StudentCourseListItem;
}): React.JSX.Element {
  return (
    <div className="course-list-row justify-between">
      <div className="flex flex-col gap-1">
        <div className="flex items-baseline gap-1">
          <Link to={`/app/courses/${course.id}`} className="hover:underline">
            <strong>{course.title}</strong>
          </Link>
          <span className="course-card-code">
            · {course.code} · {course.semester}ο εξάμηνο
          </span>
        </div>
        <PrimaryInstructor course={course} />
      </div>
    </div>
  );
}

export function StudentCoursesPage(): React.JSX.Element {
  const { params, setFilter } = useUrlFilters();
  const search = params.get('search') ?? '';
  const semesterParam = params.get('semester');
  const semester = semesterParam ? Number(semesterParam) : undefined;
  const sort = params.get('sort') === 'desc' ? 'desc' : 'asc';
  const view = params.get('view') === 'list' ? 'list' : 'cards';

  const query = useQuery({
    queryKey: studentCoursesKey,
    queryFn: ({ signal }) => fetchStudentCourses(signal),
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
      subtitle="Το σημείο εκκίνησης για μελέτη: ενεργές εγγραφές και διαθέσιμο υλικό."
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
        {(data) =>
          data.summary.enrolledCourseCount === 0 ? (
            <EmptyState message="Δεν είσαι εγγεγραμμένος/η σε κάποιο ενεργό μάθημα αυτή τη στιγμή." />
          ) : (
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
                  <p>Εγγεγραμμένα μαθήματα</p>
                  <span>
                    {data.summary.enrolledCourseCount}{' '}
                    {data.summary.enrolledCourseCount === 1
                      ? 'μάθημα'
                      : 'μαθήματα'}
                  </span>
                </div>
              }
              emptyState={
                sorted.length === 0 ? (
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
          )
        }
      </QueryState>
    </PageLayout>
  );
}
