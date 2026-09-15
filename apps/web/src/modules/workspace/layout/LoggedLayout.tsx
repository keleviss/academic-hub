import {
  lazy,
  Suspense,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
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
import { NotificationProvider } from '../../../components/notifications';
import { Spinner } from '../../../components/Spinner';
import { WorkspaceBreadcrumbProvider } from '../../../components/workspaceBreadcrumb';
import { appPath, useLogoutMutation } from '../../../auth/session';
import { useAuthenticatedUser } from '../../../auth/authenticatedUser';
import { ProfessorCourseDetailPage } from '../../professor/courses/pages/ProfessorCourseDetailPage';
import { StudentCourseDetailPage } from '../../student/courses/pages/StudentCourseDetailPage';
import { workspaceRoutesByRole } from '../routing/workspaceRoutes';
import { WorkspaceToolbar } from '../../../components/WorkspaceToolbar';
import { AdminCourseDetailPage } from '../../admin/courses/pages/AdminCourseDetailPage';

// Pulls in pdfjs-dist, which is heavy; keep it out of the main bundle.
const DocumentViewerPage = lazy(() =>
  import('../documents/pages/DocumentViewerPage').then((module) => ({
    default: module.DocumentViewerPage,
  })),
);

export function LoggedLayout(): React.JSX.Element {
  const user = useAuthenticatedUser();
  const location = useLocation();
  const navigate = useNavigate();
  const logout = useLogoutMutation();
  const contentRef = useRef<HTMLElement>(null);
  const [logoutFailed, setLogoutFailed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const routes = workspaceRoutesByRole[user.role];
  // Only the document viewer manages its own internal scroll areas.
  const isDocumentViewerRoute = /\/documents\/[^/]+\/?$/.test(
    location.pathname,
  );

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
    <WorkspaceBreadcrumbProvider>
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
        <main
          ref={contentRef}
          className={
            isDocumentViewerRoute
              ? 'workspace-content is-document-viewer'
              : 'workspace-content'
          }
          id="main-content"
        >
          <NotificationProvider>
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
              {user.role === 'professor' && (
                <Route
                  path="courses/:courseId"
                  element={<ProfessorCourseDetailPage />}
                />
              )}
              {user.role === 'student' && (
                <Route
                  path="courses/:courseId"
                  element={<StudentCourseDetailPage />}
                />
              )}
              {(user.role === 'professor' || user.role === 'student') && (
                <Route
                  path="courses/:courseId/documents/:documentId"
                  element={
                    <Suspense fallback={<Spinner label="Φόρτωση προβολέα…" />}>
                      <DocumentViewerPage />
                    </Suspense>
                  }
                />
              )}
              <Route path="*" element={<Navigate to={appPath} replace />} />
            </Routes>
          </NotificationProvider>
        </main>
      </div>
    </WorkspaceBreadcrumbProvider>
  );
}
