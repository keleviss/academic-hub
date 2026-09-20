import { useQuery } from '@tanstack/react-query';

import {
  fetchAdminCourse,
  fetchProfessorCourse,
  fetchStudentCourse,
} from '../api/client';
import { useAuthenticatedUser } from '../auth/authenticatedUser';
import type { WorkspaceBreadcrumb } from '../components/workspaceBreadcrumb';

const courseFetchers = {
  admin: fetchAdminCourse,
  professor: fetchProfessorCourse,
  student: fetchStudentCourse,
} as const;

// The three role endpoints return different course shapes; the breadcrumb only
// needs the part they share, so the query is typed down to that.
type CourseCodeResponse = { data: { code: string } };

/**
 * Builds the «Μαθήματα / <κωδικός μαθήματος> / <σελίδα>» trail for the pages that
 * live under a course but are shared by all roles, so they show the same course
 * code as the role-specific course detail pages instead of a generic label.
 *
 * The query key matches the one each role's course detail page already uses, so
 * arriving from that page costs no extra request.
 *
 * Returns `null` until both the course and the page's own data are loaded, which
 * keeps the toolbar on its static fallback trail in the meantime.
 */
export function useCourseBreadcrumbTrail(
  courseId: string,
  leafLabel: string | undefined,
): WorkspaceBreadcrumb[] | null {
  const { role } = useAuthenticatedUser();
  const courseQuery = useQuery({
    queryKey: [role, 'courses', courseId],
    queryFn: ({ signal }): Promise<CourseCodeResponse> =>
      courseFetchers[role](courseId, signal),
    enabled: !!courseId,
  });

  if (!leafLabel || !courseQuery.data) return null;

  return [
    { label: 'Μαθήματα', to: '/app/courses' },
    { label: courseQuery.data.data.code, to: `/app/courses/${courseId}` },
    { label: leafLabel },
  ];
}
