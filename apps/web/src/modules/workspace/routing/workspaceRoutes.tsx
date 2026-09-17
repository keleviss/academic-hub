import type { UserRole } from '@web-app/contracts';

import { roleLabels } from '../../../auth/session';
import { ProfessorAnalyticsPage } from '../../professor/analytics/pages/ProfessorAnalyticsPage';
import { ProfessorCoursesPage } from '../../professor/courses/pages/ProfessorCoursesPage';
import { ProfessorDashboardPage } from '../../professor/dashboard/pages/ProfessorDashboardPage';
import { StudentActivityPage } from '../../student/activity/pages/StudentActivityPage';
import { StudentCoursesPage } from '../../student/courses/pages/StudentCoursesPage';
import { StudentDashboardPage } from '../../student/dashboard/pages/StudentDashboardPage';
import { AdminCoursesPage } from '../../admin/courses/pages/AdminCoursesPage';
import { AccountProfilePage } from '../account/pages/AccountProfilePage';
import { AccountSettingsPage } from '../account/pages/AccountSettingsPage';
import { CalendarPage } from '../calendar/pages/CalendarPage';
import { NotesPage } from '../notes/pages/NotesPage';

export type WorkspaceNavIcon =
  | 'activity'
  | 'analytics'
  | 'calendar'
  | 'courses'
  | 'home'
  | 'messages'
  | 'notes'
  | 'settings'
  | 'shield'
  | 'users';

export interface WorkspaceNavItem {
  path: string;
  label: string;
  icon?: WorkspaceNavIcon;
  keywords?: string[];
  end?: boolean;
  children?: WorkspaceNavItem[];
}

export interface WorkspaceRoute extends WorkspaceNavItem {
  element: React.JSX.Element;
  nav: boolean;
}

function WorkspacePanel({
  eyebrow,
  title,
  body,
  items,
}: {
  eyebrow: string;
  title: string;
  body: string;
  items: string[];
}): React.JSX.Element {
  return (
    <section className="workspace-panel">
      <p className="auth-kicker">{eyebrow}</p>
      <h2>{title}</h2>
      <p>{body}</p>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

// Admin has no dedicated dashboard yet (out of scope for the forum/dashboards
// feature); students and professors get real dashboards below instead.
function AdminWorkspaceHome(): React.JSX.Element {
  return (
    <WorkspacePanel
      eyebrow={roleLabels.admin}
      title="Διαχειριστικό workspace"
      body="Η αρχική περιοχή για χρήστες, μαθήματα, εγγραφές και audit-oriented εποπτεία."
      items={[
        'Διαχείριση ενεργών χρηστών και ρόλων',
        'Οργάνωση μαθημάτων και αναθέσεων',
        'Παρακολούθηση κρίσιμων ενεργειών',
      ]}
    />
  );
}

const studentRoutes: WorkspaceRoute[] = [
  {
    path: '',
    label: 'Επισκόπηση',
    icon: 'home',
    keywords: ['αρχική', 'dashboard', 'workspace'],
    element: <StudentDashboardPage />,
    nav: true,
    end: true,
  },
  {
    path: 'courses',
    label: 'Μαθήματα',
    icon: 'courses',
    keywords: ['courses', 'υλικό', 'roadmap', 'concepts'],
    element: <StudentCoursesPage />,
    nav: true,
  },
  {
    path: 'activity',
    label: 'Δραστηριότητα',
    icon: 'activity',
    keywords: ['study', 'notes', 'questions', 'highlights'],
    element: <StudentActivityPage />,
    nav: true,
  },
];

const professorRoutes: WorkspaceRoute[] = [
  {
    path: '',
    label: 'Επισκόπηση',
    icon: 'home',
    keywords: ['αρχική', 'dashboard', 'workspace'],
    element: <ProfessorDashboardPage />,
    nav: true,
    end: true,
  },
  {
    path: 'courses',
    label: 'Μαθήματα',
    icon: 'courses',
    keywords: ['courses', 'υλικό', 'roadmap', 'concepts'],
    element: <ProfessorCoursesPage />,
    nav: true,
  },
  {
    path: 'analytics',
    label: 'Analytics',
    icon: 'analytics',
    keywords: ['teaching action queue', 'signals', 'confusion points'],
    element: <ProfessorAnalyticsPage />,
    nav: true,
  },
];

const adminRoutes: WorkspaceRoute[] = [
  {
    path: '',
    label: 'Επισκόπηση',
    icon: 'home',
    keywords: ['αρχική', 'dashboard', 'workspace'],
    element: <AdminWorkspaceHome />,
    nav: true,
    end: true,
  },
  {
    path: 'users',
    label: 'Χρήστες',
    icon: 'users',
    keywords: ['users', 'roles', 'accounts'],
    element: (
      <WorkspacePanel
        eyebrow="Διαχειριστής"
        title="Χρήστες και ρόλοι"
        body="Διαχείριση λογαριασμών, ενεργής κατάστασης και βασικών αλλαγών ρόλων."
        items={['Ενεργοί χρήστες', 'Ρόλοι πρόσβασης', 'Audit trail αλλαγών']}
      />
    ),
    nav: true,
  },
  {
    path: 'courses',
    label: 'Μαθήματα',
    icon: 'courses',
    keywords: ['courses', 'enrollments', 'assignments'],
    children: [
      {
        path: 'courses',
        label: 'Όλα τα μαθήματα',
        keywords: ['all courses'],
      },
      {
        path: 'courses?status=active',
        label: 'Ενεργά μαθήματα',
        keywords: ['active courses'],
      },
      {
        path: 'courses?status=inactive',
        label: 'Ανενεργά μαθήματα',
        keywords: ['inactive courses'],
      },
    ],
    element: <AdminCoursesPage />,
    nav: true,
  },
];

const commonToolRoutes: WorkspaceRoute[] = [
  {
    path: 'calendar',
    label: 'Ημερολόγιο',
    icon: 'calendar',
    keywords: ['calendar', 'deadlines', 'events'],
    element: <CalendarPage />,
    nav: true,
  },
  {
    path: 'notes',
    label: 'Σημειώσεις',
    icon: 'notes',
    keywords: ['notes', 'annotations', 'highlights'],
    element: <NotesPage />,
    nav: true,
  },
];

const commonAccountRoutes: WorkspaceRoute[] = [
  {
    path: 'profile',
    label: 'Προφίλ',
    icon: 'users',
    keywords: ['account', 'profile', 'λογαριασμός'],
    element: <AccountProfilePage />,
    nav: false,
  },
  {
    path: 'settings',
    label: 'Ρυθμίσεις',
    icon: 'settings',
    keywords: ['settings', 'preferences', 'ρυθμίσεις'],
    element: <AccountSettingsPage />,
    nav: false,
  },
];

// The workspace shell imports this registry to build each role's private routes.
export const workspaceRoutesByRole: Record<UserRole, WorkspaceRoute[]> = {
  admin: [...adminRoutes, ...commonToolRoutes, ...commonAccountRoutes],
  professor: [...professorRoutes, ...commonToolRoutes, ...commonAccountRoutes],
  student: [...studentRoutes, ...commonToolRoutes, ...commonAccountRoutes],
};
