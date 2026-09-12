import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router';

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
  const location = useLocation();
  const navigate = useNavigate();
  const logout = useLogoutMutation();
  const contentRef = useRef<HTMLElement>(null);
  const [logoutFailed, setLogoutFailed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const routes = workspaceRoutesByRole[user.role];

  useEffect(() => {
    const previousRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';

    return () => {
      window.history.scrollRestoration = previousRestoration;
    };
  }, []);

  useLayoutEffect(() => {
    const content = contentRef.current;
    if (!content) return;

    content.scrollTop = 0;
    content.scrollLeft = 0;
    content.scrollTo?.({ top: 0, left: 0, behavior: 'auto' });
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (!mobileSidebarOpen) return;

    const root = document.documentElement;
    const body = document.body;
    const previousRootOverflow = root.style.overflow;
    const previousBodyOverflow = body.style.overflow;
    const previousBodyTouchAction = body.style.touchAction;

    root.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    body.style.touchAction = 'none';

    return () => {
      root.style.overflow = previousRootOverflow;
      body.style.overflow = previousBodyOverflow;
      body.style.touchAction = previousBodyTouchAction;
    };
  }, [mobileSidebarOpen]);

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
    <div
      className={
        mobileSidebarOpen
          ? 'workspace-shell is-mobile-sidebar-open'
          : 'workspace-shell'
      }
    >
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
      <main ref={contentRef} className="workspace-content" id="main-content">
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
