import type { UserRole } from '@web-app/contracts';

import { roleLabels } from '../../../auth/session';
import { AdminCoursesPage } from '../../admin/pages/AdminCoursesPage';
import { ProfessorCoursesPage } from '../../professor/courses/pages/ProfessorCoursesPage';

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

export function WorkspaceHome({ role }: { role: UserRole }): React.JSX.Element {
  const label = roleLabels[role];

  const copy: Record<
    UserRole,
    { title: string; body: string; items: string[] }
  > = {
    admin: {
      title: 'Διαχειριστικό workspace',
      body: 'Η αρχική περιοχή για χρήστες, μαθήματα, εγγραφές και audit-oriented εποπτεία.',
      items: [
        'Διαχείριση ενεργών χρηστών και ρόλων',
        'Οργάνωση μαθημάτων και αναθέσεων',
        'Παρακολούθηση κρίσιμων ενεργειών',
      ],
    },
    professor: {
      title: 'Teaching Intelligence workspace',
      body: 'Η αρχική περιοχή για σήματα δυσκολίας, contextual απορίες και διδακτικές παρεμβάσεις.',
      items: [
        'Confusion signals ανά μάθημα και έννοια',
        'Unresolved document thread queue',
        'Επόμενες διδακτικές ενέργειες',
      ],
    },
    student: {
      title: 'Φοιτητικό workspace',
      body: 'Η αρχική περιοχή για πρόοδο, προτεινόμενη επόμενη ενέργεια και πρόσφατη αλληλεπίδραση με το υλικό.',
      items: [
        'Προτεινόμενο επόμενο βήμα μελέτης',
        'Ενεργά μαθήματα και concept progress',
        'Πρόσφατες απαντήσεις και προσωπικές σημειώσεις',
      ],
    },
  };

  return (
    <WorkspacePanel
      eyebrow={label}
      title={copy[role].title}
      body={copy[role].body}
      items={copy[role].items}
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
    element: <WorkspaceHome role="student" />,
    nav: true,
    end: true,
  },
  {
    path: 'courses',
    label: 'Μαθήματα',
    icon: 'courses',
    keywords: ['courses', 'υλικό', 'roadmap', 'concepts'],
    children: [
      {
        path: 'courses?course=algorithms',
        label: 'Αλγόριθμοι και Πολυπλοκότητα',
        keywords: ['algorithms', 'complexity'],
      },
      {
        path: 'courses?course=electronics',
        label: 'Ηλεκτρονική',
        keywords: ['electronics'],
      },
      {
        path: 'courses?course=thesis',
        label: 'Διπλωματική εργασία',
        keywords: ['thesis'],
      },
    ],
    element: (
      <WorkspacePanel
        eyebrow="Φοιτητής"
        title="Τα μαθήματά μου"
        body="Πρόσβαση στα ενεργά μαθήματα, στο υλικό και στην πρόοδο ανά μαθησιακή έννοια."
        items={[
          'Visible εκπαιδευτικό υλικό',
          'Roadmap nodes και prerequisites',
          'Συνδεδεμένες απορίες και απαντήσεις',
        ]}
      />
    ),
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
    element: <WorkspaceHome role="professor" />,
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
    element: <WorkspaceHome role="admin" />,
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
    path: 'messages',
    label: 'Μηνύματα',
    icon: 'messages',
    keywords: ['messages', 'inbox', 'threads', 'questions'],
    element: (
      <WorkspacePanel
        eyebrow="Workspace"
        title="Μηνύματα"
        body="Προσωρινή protected σελίδα για contextual συζητήσεις, απαντήσεις και ειδοποιήσεις μαθημάτων."
        items={[
          'Contextual Q&A threads',
          'Απαντήσεις διδασκόντων',
          'Μελλοντικές ειδοποιήσεις συστήματος',
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
// eslint-disable-next-line react-refresh/only-export-components
export const workspaceRoutesByRole: Record<UserRole, WorkspaceRoute[]> = {
  admin: [...adminRoutes, ...commonToolRoutes, ...commonAccountRoutes],
  professor: [...professorRoutes, ...commonToolRoutes, ...commonAccountRoutes],
  student: [...studentRoutes, ...commonToolRoutes, ...commonAccountRoutes],
};
