import type { UserRole } from '@web-app/contracts';

import { roleLabels } from '../../../auth/session';
import { ProfessorCoursesPage } from '../../professor/courses/pages/ProfessorCoursesPage';
import { ProfessorDashboardPage } from '../../professor/dashboard/pages/ProfessorDashboardPage';
import { StudentCoursesPage } from '../../student/courses/pages/StudentCoursesPage';
import { StudentDashboardPage } from '../../student/dashboard/pages/StudentDashboardPage';
import { AdminCoursesPage } from '../../admin/courses/pages/AdminCoursesPage';

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

function AccountPanel({
  title,
  body,
  items,
}: {
  title: string;
  body: string;
  items: string[];
}): React.JSX.Element {
  return (
    <WorkspacePanel
      eyebrow="Λογαριασμός"
      title={title}
      body={body}
      items={items}
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
    element: (
      <WorkspacePanel
        eyebrow="Φοιτητής"
        title="Πρόσφατη μελέτη"
        body="Συγκεντρώνει highlights, notes, unresolved questions και πρόσφατες verified απαντήσεις."
        items={[
          'Προσωπικές σημειώσεις',
          'Ανοιχτές απορίες',
          'Έννοιες που χρειάζονται επανάληψη',
        ]}
      />
    ),
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
    keywords: ['teaching action queue', 'signals', 'heatmaps'],
    element: (
      <WorkspacePanel
        eyebrow="Διδάσκων"
        title="Teaching Action Queue"
        body="Τα learning analytics παρουσιάζονται ως ενδείξεις που οδηγούν σε συγκεκριμένες διδακτικές ενέργειες."
        items={[
          'Confusion heatmaps',
          'Progress bottlenecks',
          'Unresolved document threads',
        ]}
      />
    ),
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
    element: (
      <WorkspacePanel
        eyebrow="Workspace"
        title="Ημερολόγιο"
        body="Προσωρινή protected σελίδα για προθεσμίες, συναντήσεις και μελλοντικό study planning."
        items={[
          'Ακαδημαϊκές προθεσμίες',
          'Προγραμματισμένες παρεμβάσεις',
          'Μελλοντική σύνδεση με study plan',
        ]}
      />
    ),
    nav: true,
  },
  {
    path: 'notes',
    label: 'Σημειώσεις',
    icon: 'notes',
    keywords: ['notes', 'annotations', 'highlights'],
    element: (
      <WorkspacePanel
        eyebrow="Workspace"
        title="Σημειώσεις"
        body="Προσωρινή protected σελίδα για προσωπικά notes, highlights και anchored annotations."
        items={[
          'Προσωπικές σημειώσεις',
          'Highlights πάνω στο υλικό',
          'Σύνδεση με έννοιες και απορίες',
        ]}
      />
    ),
    nav: true,
  },
];

const commonAccountRoutes: WorkspaceRoute[] = [
  {
    path: 'profile',
    label: 'Προφίλ',
    icon: 'users',
    keywords: ['account', 'profile', 'λογαριασμός'],
    element: (
      <AccountPanel
        title="Προφίλ χρήστη"
        body="Προσωρινή protected σελίδα για τα βασικά στοιχεία του συνδεδεμένου χρήστη."
        items={[
          'Ονοματεπώνυμο και ακαδημαϊκό email',
          'Ρόλος πρόσβασης στο workspace',
          'Μελλοντικές προσωπικές προτιμήσεις',
        ]}
      />
    ),
    nav: false,
  },
  {
    path: 'settings',
    label: 'Ρυθμίσεις',
    icon: 'settings',
    keywords: ['settings', 'preferences', 'ρυθμίσεις'],
    element: (
      <AccountPanel
        title="Ρυθμίσεις λογαριασμού"
        body="Προσωρινή protected σελίδα για μελλοντικές ρυθμίσεις ειδοποιήσεων, γλώσσας και προσβασιμότητας."
        items={[
          'Προτιμήσεις ειδοποιήσεων',
          'Γλώσσα και εμφάνιση',
          'Ρυθμίσεις ιδιωτικότητας μαθησιακών δεδομένων',
        ]}
      />
    ),
    nav: false,
  },
];

// The workspace shell imports this registry to build each role's private routes.
export const workspaceRoutesByRole: Record<UserRole, WorkspaceRoute[]> = {
  admin: [...adminRoutes, ...commonToolRoutes, ...commonAccountRoutes],
  professor: [...professorRoutes, ...commonToolRoutes, ...commonAccountRoutes],
  student: [...studentRoutes, ...commonToolRoutes, ...commonAccountRoutes],
};
