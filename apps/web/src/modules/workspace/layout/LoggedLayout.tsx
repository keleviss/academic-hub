import { useState } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router';

import {
  AppSidebar,
  MobileSidebarDrawer,
} from '../../../components/AppSidebar';
import { ErrorNotice } from '../../../components/feedback';
import { appPath, useLogoutMutation } from '../../../auth/session';
import { useAuthenticatedUser } from '../../../auth/authenticatedUser';
import { AdminCourseDetailPage } from '../../admin-courses/pages/AdminCoursesPage';
import { workspaceRoutesByRole } from '../routing/workspaceRoutes';
import { WorkspaceToolbar } from './WorkspaceToolbar';

export function LoggedLayout(): React.JSX.Element {
  const user = useAuthenticatedUser();
  const navigate = useNavigate();
  const logout = useLogoutMutation();
  const [logoutFailed, setLogoutFailed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const routes = workspaceRoutesByRole[user.role];

  async function signOut() {
    if (logout.isPending) return;
    setLogoutFailed(false);
    try {
      await logout.mutateAsync();
      setMobileSidebarOpen(false);
      navigate('/', { replace: true });
    } catch {
      setLogoutFailed(true);
    } finally {
      logout.reset();
    }
  }

  return (
    <div className="workspace-shell">
      <div className="workspace-sidebar-desktop">
        <AppSidebar
          state="logged"
          user={user}
          navItems={routes}
          logoutPending={logout.isPending}
          onLogout={() => void signOut()}
        />
      </div>
      <WorkspaceToolbar
        role={user.role}
        onOpenSidebar={() => setMobileSidebarOpen(true)}
      />
      <MobileSidebarDrawer
        open={mobileSidebarOpen}
        onClose={() => setMobileSidebarOpen(false)}
      >
        <AppSidebar
          state="logged"
          user={user}
          navItems={routes}
          logoutPending={logout.isPending}
          onLogout={() => void signOut()}
          onNavigate={() => setMobileSidebarOpen(false)}
        />
      </MobileSidebarDrawer>
      <main className="workspace-content" id="main-content">
        {logoutFailed && (
          <ErrorNotice>
            Η αποσύνδεση δεν ολοκληρώθηκε. Δοκίμασε ξανά.
          </ErrorNotice>
        )}
        <Routes>
          {routes.map((route) => (
            <Route
              key={route.path || 'index'}
              index={route.path === ''}
              path={route.path || undefined}
              element={route.element}
            />
          ))}
          {user.role === 'admin' && (
            <Route
              path="courses/:courseId"
              element={<AdminCourseDetailPage />}
            />
          )}
          <Route path="*" element={<Navigate to={appPath} replace />} />
        </Routes>
      </main>
    </div>
  );
}
