import { useQuery } from '@tanstack/react-query';
import type { UserRole } from '@web-app/contracts';
import { Menu, UserCircle } from 'lucide-react';
import { Link, useLocation } from 'react-router';

import { appPath } from '../auth/session';
import {
  fetchAdminCourse,
  fetchProfessorCourse,
  fetchStudentCourse,
} from '../api/client';
import { workspaceRoutesByRole } from '../modules/workspace/routing/workspaceRoutes';

type Breadcrumb = {
  label: string;
  to?: string;
};

const workspaceLabels: Record<UserRole, string> = {
  admin: 'Χώρος διαχείρισης',
  professor: 'Χώρος διδασκαλίας',
  student: 'Χώρος μελέτης',
};

function getBreadcrumbs(
  role: UserRole,
  pathname: string,
  courseCode?: string,
): Breadcrumb[] {
  const root: Breadcrumb = { label: workspaceLabels[role], to: appPath };
  const courseDetail = pathname.match(/^\/app\/courses\/[^/]+$/);

  if (courseDetail) {
    return [
      root,
      { label: 'Μαθήματα', to: `${appPath}/courses` },
      { label: courseCode ?? 'Μάθημα' },
    ];
  }

  const matchingRoute = workspaceRoutesByRole[role].find((route) => {
    const target = route.path ? `${appPath}/${route.path}` : appPath;
    return pathname === target;
  });

  if (!matchingRoute) return [{ label: workspaceLabels[role] }];
  if (!matchingRoute.path) return [{ label: workspaceLabels[role] }];

  return [root, { label: matchingRoute.label }];
}

export function WorkspaceToolbar({
  role,
  onOpenSidebar,
}: {
  role: UserRole;
  onOpenSidebar: () => void;
}): React.JSX.Element {
  const location = useLocation();
  const courseId = location.pathname.match(
    /^\/app\/courses\/([^/]+)$/,
  )?.[1];
  const adminCourse = useQuery({
    queryKey: ['admin', 'courses', courseId],
    queryFn: ({ signal }) => fetchAdminCourse(courseId ?? '', signal),
    enabled: !!courseId && role === 'admin',
    staleTime: 30_000,
  });
  const professorCourse = useQuery({
    queryKey: ['professor', 'courses', courseId],
    queryFn: ({ signal }) => fetchProfessorCourse(courseId ?? '', signal),
    enabled: !!courseId && role === 'professor',
    staleTime: 30_000,
  });
  const studentCourse = useQuery({
    queryKey: ['student', 'courses', courseId],
    queryFn: ({ signal }) => fetchStudentCourse(courseId ?? '', signal),
    enabled: !!courseId && role === 'student',
    staleTime: 30_000,
  });
  const course =
    role === 'professor'
      ? professorCourse
      : role === 'student'
        ? studentCourse
        : adminCourse;
  const breadcrumbs = getBreadcrumbs(
    role,
    location.pathname,
    course.data?.data.code,
  );

  return (
    <header className="workspace-toolbar">
      <div className="workspace-toolbar-content">
        <div className="workspace-toolbar-left">
          <button
            aria-label="Άνοιγμα sidebar"
            className="workspace-toolbar-menu"
            type="button"
            onClick={onOpenSidebar}
          >
            <Menu aria-hidden="true" size={20} />
          </button>
          <nav aria-label="Διαδρομή σελίδας" className="workspace-breadcrumbs">
            <ol>
              {breadcrumbs.map((breadcrumb, index) => (
                <li key={`${breadcrumb.label}-${breadcrumb.to ?? 'current'}`}>
                  {breadcrumb.to && index < breadcrumbs.length - 1 ? (
                    <Link to={breadcrumb.to}>{breadcrumb.label}</Link>
                  ) : (
                    <span
                      aria-current={
                        index === breadcrumbs.length - 1 ? 'page' : undefined
                      }
                    >
                      {breadcrumb.label}
                    </span>
                  )}
                </li>
              ))}
            </ol>
          </nav>

        </div>
        <Link
          to={`${appPath}/profile`}
          className="workspace-toolbar-profile"
          aria-label="Προφίλ"
        >
          <UserCircle aria-hidden="true" size={20} />
        </Link>
      </div>
    </header>
  );
}
