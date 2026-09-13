import type { UserRole } from '@web-app/contracts';
import { Menu, UserCircle } from 'lucide-react';
import { Link, useLocation } from 'react-router';

import { appPath } from '../auth/session';
import { workspaceRoutesByRole } from '../modules/workspace/routing/workspaceRoutes';
import {
  useWorkspaceBreadcrumb,
  type WorkspaceBreadcrumb as Breadcrumb,
} from './workspaceBreadcrumb';

const workspaceLabels: Record<UserRole, string> = {
  admin: 'Χώρος διαχείρισης',
  professor: 'Χώρος διδασκαλίας',
  student: 'Χώρος μελέτης',
};

/** Structural fallback (no data) used until the current page publishes its own breadcrumb trail. */
function getBreadcrumbs(role: UserRole, pathname: string): Breadcrumb[] {
  const root: Breadcrumb = { label: workspaceLabels[role], to: appPath };
  const courseDetail = pathname.match(/^\/app\/courses\/[^/]+$/);
  const documentDetail = pathname.match(
    /^\/app\/courses\/([^/]+)\/documents\/[^/]+$/,
  );

  if (documentDetail) {
    const courseId = documentDetail[1];
    return [
      root,
      { label: 'Μαθήματα', to: `${appPath}/courses` },
      { label: 'Μάθημα', to: `${appPath}/courses/${courseId}` },
      { label: 'Έγγραφο' },
    ];
  }

  if (courseDetail) {
    return [
      root,
      { label: 'Μαθήματα', to: `${appPath}/courses` },
      { label: 'Μάθημα' },
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
  const overrideTrail = useWorkspaceBreadcrumb();
  const breadcrumbs = overrideTrail
    ? [{ label: workspaceLabels[role], to: appPath }, ...overrideTrail]
    : getBreadcrumbs(role, location.pathname);

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
