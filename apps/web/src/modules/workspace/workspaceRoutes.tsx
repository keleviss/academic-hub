import type { UserRole } from '@web-app/contracts';

import { roleLabels } from '../../auth/session';

export interface WorkspaceRoute {
  path: string;
  label: string;
  element: React.JSX.Element;
  nav: boolean;
  end?: boolean;
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

const studentRoutes: WorkspaceRoute[] = [
  {
    path: '',
    label: 'Επισκόπηση',
    element: <WorkspaceHome role="student" />,
    nav: true,
    end: true,
  },
  {
    path: 'courses',
    label: 'Μαθήματα',
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
    element: <WorkspaceHome role="professor" />,
    nav: true,
    end: true,
  },
  {
    path: 'courses',
    label: 'Μαθήματα',
    element: (
      <WorkspacePanel
        eyebrow="Διδάσκων"
        title="Διδασκόμενα μαθήματα"
        body="Οργάνωση υλικού γύρω από concepts, visibility και contextual Q&A."
        items={[
          'Ορατότητα documents',
          'Roadmap και learning objectives',
          'Ερωτήσεις συνδεδεμένες με υλικό',
        ]}
      />
    ),
    nav: true,
  },
  {
    path: 'analytics',
    label: 'Analytics',
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
    element: <WorkspaceHome role="admin" />,
    nav: true,
    end: true,
  },
  {
    path: 'users',
    label: 'Χρήστες',
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
    element: (
      <WorkspacePanel
        eyebrow="Διαχειριστής"
        title="Μαθήματα και εγγραφές"
        body="Διαχειριστική εποπτεία μαθημάτων, αναθέσεων καθηγητών και εγγραφών φοιτητών."
        items={[
          'Δημιουργία και ενημέρωση μαθημάτων',
          'Αναθέσεις διδασκόντων',
          'Εγγραφές φοιτητών',
        ]}
      />
    ),
    nav: true,
  },
];

// The workspace shell imports this registry to build each role's private routes.
// eslint-disable-next-line react-refresh/only-export-components
export const workspaceRoutesByRole: Record<UserRole, WorkspaceRoute[]> = {
  admin: adminRoutes,
  professor: professorRoutes,
  student: studentRoutes,
};
