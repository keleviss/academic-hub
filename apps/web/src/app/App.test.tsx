import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  QueryClient,
  focusManager,
  onlineManager,
} from '@tanstack/react-query';
import { useLocation } from 'react-router';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import type { CurrentSession, UserRole } from '@web-app/contracts';

import { App } from './App';
import {
  ApiClientError,
  fetchCurrentSession,
  fetchProfessorDashboard,
  fetchStudentDashboard,
  login,
  logout,
} from '../api/client';
import { renderWithProviders } from '../test/render';
import { deferred, guest, signedIn } from '../auth/test-fixtures';
import { sessionKey } from '../auth/session';

vi.mock('../api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/client')>()),
  fetchCurrentSession: vi.fn(),
  fetchProfessorDashboard: vi.fn(),
  fetchStudentDashboard: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
}));

const emptyStudentDashboard = {
  data: {
    courses: [],
    recentNotes: [],
    openQuestions: [],
    verifiedAnswers: [],
    activeDiscussions: [],
    continueLearning: null,
  },
};

const emptyProfessorDashboard = {
  data: {
    courses: [],
    unansweredThreads: [],
    answeredThreads: [],
    confusionPoints: [],
    perCourseCounters: [],
    courseAnalytics: [],
  },
};

function Location() {
  return <output aria-label="Διαδρομή">{useLocation().pathname}</output>;
}

const clients: QueryClient[] = [];

function renderApp(
  path = '/',
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  }),
) {
  clients.push(client);
  return {
    client,
    ...renderWithProviders(
      <>
        <App />
        <Location />
      </>,
      [path],
      client,
    ),
  };
}

async function fillLogin() {
  const user = userEvent.setup();
  await user.type(
    await screen.findByLabelText('Email', { exact: true }),
    'student@example.com',
  );
  await user.type(
    screen.getByLabelText('Κωδικός', { exact: true }),
    'test-password',
  );
  return user;
}

async function openProfileMenu() {
  await userEvent.click(
    await screen.findByRole('button', { name: /Μενού χρήστη/ }),
  );
  return screen.findByRole('menu');
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(fetchCurrentSession).mockResolvedValue(guest);
  vi.mocked(login).mockResolvedValue(signedIn());
  vi.mocked(logout).mockResolvedValue(guest);
  vi.mocked(fetchStudentDashboard).mockResolvedValue(emptyStudentDashboard);
  vi.mocked(fetchProfessorDashboard).mockResolvedValue(emptyProfessorDashboard);
});

afterEach(() => {
  for (const client of clients.splice(0)) client.clear();
  focusManager.setFocused(undefined);
  onlineManager.setOnline(true);
});

describe('public login route', () => {
  it('uses / as the canonical login route for guests', async () => {
    renderApp('/');

    expect(
      await screen.findByRole('form', { name: 'Σύνδεση στο Academic Hub' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Academic Hub')).toHaveTextContent(
      'Ο χώρος σου για μελέτη και αλληλεπίδραση.',
    );
    expect(screen.getByLabelText('Διαδρομή')).toHaveTextContent('/');
    expect(
      screen.queryByRole('navigation', { name: 'Κύρια πλοήγηση' }),
    ).not.toBeInTheDocument();
  });

  it('redirects the legacy /login route back to /', async () => {
    renderApp('/login');

    expect(
      await screen.findByRole('form', { name: 'Σύνδεση στο Academic Hub' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Διαδρομή')).toHaveTextContent('/');
  });

  it('redirects unknown public paths to /', async () => {
    renderApp('/missing');

    expect(await screen.findByRole('form')).toBeInTheDocument();
    expect(screen.getByLabelText('Διαδρομή')).toHaveTextContent('/');
  });

  it('validates fields without sending credentials and supports password visibility', async () => {
    renderApp();

    await screen.findByRole('form');
    await userEvent.click(
      screen.getByRole('button', { name: 'Σύνδεση στο Academic Hub' }),
    );

    expect(
      await screen.findByText('Συμπλήρωσε ένα έγκυρο email.'),
    ).toBeInTheDocument();
    expect(login).not.toHaveBeenCalled();

    const input = screen.getByLabelText('Κωδικός', { exact: true });
    expect(input).toHaveAttribute('type', 'password');

    await userEvent.click(
      screen.getByRole('button', { name: 'Εμφάνιση κωδικού' }),
    );

    expect(input).toHaveAttribute('type', 'text');
    expect(
      screen.getByRole('button', { name: 'Απόκρυψη κωδικού' }),
    ).toHaveAttribute('aria-pressed', 'true');
  });

  it.each<UserRole>(['admin', 'professor', 'student'])(
    'logs in as %s and lands at the neutral /app route',
    async (role) => {
      vi.mocked(login).mockResolvedValue(signedIn(role));
      const { client } = renderApp();

      const user = await fillLogin();
      await user.click(
        screen.getByRole('button', { name: 'Σύνδεση στο Academic Hub' }),
      );

      await waitFor(() =>
        expect(screen.getByLabelText('Διαδρομή')).toHaveTextContent('/app'),
      );
      expect(client.getQueryData(sessionKey)).toEqual(signedIn(role));
      expect(client.getMutationCache().getAll()).toHaveLength(0);
    },
  );

  it('blocks duplicate submits while login is pending', async () => {
    const request = deferred<CurrentSession>();
    vi.mocked(login).mockReturnValue(request.promise);
    renderApp();

    const user = await fillLogin();
    await user.dblClick(
      screen.getByRole('button', { name: 'Σύνδεση στο Academic Hub' }),
    );

    expect(
      screen.getByRole('button', { name: 'Γίνεται σύνδεση…' }),
    ).toBeDisabled();
    expect(login).toHaveBeenCalledTimes(1);

    await act(async () => request.resolve(signedIn()));

    expect(
      await screen.findByText(
        'Τα μαθήματά σου και ό,τι χρειάζεται την προσοχή σου.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Διαδρομή')).toHaveTextContent('/app');
  });

  it('shows safe credential errors, clears the password/cache and permits retry', async () => {
    vi.mocked(login).mockRejectedValueOnce(
      new ApiClientError('Internal account detail', 401, 'INVALID_CREDENTIALS'),
    );
    const { client } = renderApp();

    const user = await fillLogin();
    await user.click(
      screen.getByRole('button', { name: 'Σύνδεση στο Academic Hub' }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Έλεγξε το email και τον κωδικό σου.',
    );
    expect(
      screen.queryByText('Internal account detail'),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText('Κωδικός', { exact: true })).toHaveValue('');
    expect(screen.getByLabelText('Email', { exact: true })).toHaveValue(
      'student@example.com',
    );
    expect(client.getMutationCache().getAll()).toHaveLength(0);

    await user.type(
      screen.getByLabelText('Κωδικός', { exact: true }),
      'test-password',
    );
    await user.click(
      screen.getByRole('button', { name: 'Σύνδεση στο Academic Hub' }),
    );

    expect(
      await screen.findByText(
        'Τα μαθήματά σου και ό,τι χρειάζεται την προσοχή σου.',
      ),
    ).toBeInTheDocument();
  });

  it('shows a generic login network error', async () => {
    vi.mocked(login).mockRejectedValue(new TypeError('Network internals'));
    renderApp();

    await fillLogin();
    await userEvent.click(
      screen.getByRole('button', { name: 'Σύνδεση στο Academic Hub' }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Η σύνδεση δεν ολοκληρώθηκε.',
    );
  });
});

describe('session, routing and role workspaces', () => {
  it('waits for session resolution on protected routes before redirecting guests', async () => {
    const request = deferred<CurrentSession>();
    vi.mocked(fetchCurrentSession).mockReturnValue(request.promise);
    renderApp('/app/courses');

    expect(screen.getByText('Έλεγχος σύνδεσης…')).toBeInTheDocument();
    expect(screen.getByLabelText('Διαδρομή')).toHaveTextContent('/app/courses');

    await act(async () => request.resolve(guest));

    expect(await screen.findByRole('form')).toBeInTheDocument();
    expect(screen.getByLabelText('Διαδρομή')).toHaveTextContent('/');
  });

  it.each(['/app', '/app/courses', '/app/analytics'])(
    'redirects guests at %s to /',
    async (path) => {
      renderApp(path);

      expect(await screen.findByRole('form')).toBeInTheDocument();
      expect(screen.getByLabelText('Διαδρομή')).toHaveTextContent('/');
    },
  );

  it.each([
    ['admin', 'Διαχειριστικό workspace'],
    ['professor', 'Η εικόνα των μαθημάτων σου και ό,τι χρειάζεται παρέμβαση.'],
    ['student', 'Τα μαθήματά σου και ό,τι χρειάζεται την προσοχή σου.'],
  ] as const)('renders %s content at /app', async (role, heading) => {
    vi.mocked(fetchCurrentSession).mockResolvedValue(signedIn(role));

    renderApp('/app');

    expect(await screen.findByText(heading)).toBeInTheDocument();
    expect(screen.getByLabelText('Διαδρομή')).toHaveTextContent('/app');
  });

  it('renders the role-specific sidebar without role-prefixed links', async () => {
    vi.mocked(fetchCurrentSession).mockResolvedValue(signedIn('student'));

    renderApp('/app');

    expect(
      await screen.findByText(
        'Τα μαθήματά σου και ό,τι χρειάζεται την προσοχή σου.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('navigation', { name: 'Πλοήγηση workspace' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Μαθήματα/ })).toHaveAttribute(
      'href',
      '/app/courses',
    );
    expect(
      screen.queryByRole('link', { name: /Χρήστες/ }),
    ).not.toBeInTheDocument();

    const hrefs = screen
      .getAllByRole('link')
      .map((link) => link.getAttribute('href') ?? '');
    expect(
      hrefs.every((href) => !/^\/(admin|professor|student)/.test(href)),
    ).toBe(true);
  });

  it('filters sidebar navigation to the current role pages', async () => {
    vi.mocked(fetchCurrentSession).mockResolvedValue(signedIn('professor'));

    renderApp('/app');

    await screen.findByText(
      'Η εικόνα των μαθημάτων σου και ό,τι χρειάζεται παρέμβαση.',
    );
    await userEvent.type(
      screen.getByLabelText('Αναζήτηση διαθέσιμων σελίδων'),
      'analytics',
    );

    expect(screen.getByRole('link', { name: 'Analytics' })).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: /Μαθήματα/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: /Χρήστες/ }),
    ).not.toBeInTheDocument();
  });

  it('preserves active state for sidebar subitems', async () => {
    vi.mocked(fetchCurrentSession).mockResolvedValue(signedIn('admin'));

    renderApp('/app/courses?status=active');

    expect(
      await screen.findByRole('heading', { name: 'Μαθήματα' }),
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('button', { name: 'Εμφάνιση υποστοιχείων Μαθήματα' }),
    );
    expect(
      screen.getByRole('link', { name: 'Ενεργά μαθήματα' }),
    ).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: /Μαθήματα/ })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('toggles sidebar subitems from grouped navigation rows', async () => {
    vi.mocked(fetchCurrentSession).mockResolvedValue(signedIn('admin'));

    renderApp('/app/courses');

    expect(
      await screen.findByRole('heading', { name: 'Μαθήματα' }),
    ).toBeInTheDocument();
    const toggle = screen.getByRole('button', {
      name: 'Εμφάνιση υποστοιχείων Μαθήματα',
    });

    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(
      screen.queryByRole('link', { name: 'Ενεργά μαθήματα' }),
    ).not.toBeInTheDocument();

    await userEvent.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(
      screen.getByRole('link', { name: 'Ενεργά μαθήματα' }),
    ).toBeInTheDocument();

    await userEvent.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(
      screen.queryByRole('link', { name: 'Ενεργά μαθήματα' }),
    ).not.toBeInTheDocument();
  });

  it('keeps the sidebar parent active when a feature route has search params', async () => {
    vi.mocked(fetchCurrentSession).mockResolvedValue(signedIn('student'));

    renderApp('/app/courses?search=eme');

    expect(await screen.findByText('Τα μαθήματά μου')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Μαθήματα/ })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it.each([
    ['/app/profile', 'Προφίλ'],
    ['/app/settings', 'Ρυθμίσεις'],
  ])('renders common account route %s', async (path, heading) => {
    vi.mocked(fetchCurrentSession).mockResolvedValue(signedIn('admin'));

    renderApp(path);

    expect(
      await screen.findByRole('heading', { name: heading }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Διαδρομή')).toHaveTextContent(path);
  });

  it.each(['/', '/login'])(
    'redirects an authenticated student from %s to /app',
    async (path) => {
      vi.mocked(fetchCurrentSession).mockResolvedValue(signedIn());

      renderApp(path);

      expect(
        await screen.findByText(
          'Τα μαθήματά σου και ό,τι χρειάζεται την προσοχή σου.',
        ),
      ).toBeInTheDocument();
      expect(screen.getByLabelText('Διαδρομή')).toHaveTextContent('/app');
    },
  );

  it('redirects unsupported role feature paths back to /app', async () => {
    vi.mocked(fetchCurrentSession).mockResolvedValue(signedIn('student'));

    renderApp('/app/users');

    expect(
      await screen.findByText(
        'Τα μαθήματά σου και ό,τι χρειάζεται την προσοχή σου.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Διαδρομή')).toHaveTextContent('/app');
    expect(screen.queryByText('Χρήστες και ρόλοι')).not.toBeInTheDocument();
  });

  it('renders common feature paths with role-specific content', async () => {
    vi.mocked(fetchCurrentSession).mockResolvedValue(signedIn('professor'));

    renderApp('/app/courses');

    expect(
      await screen.findByRole('heading', { name: 'Τα μαθήματά μου' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Διαδρομή')).toHaveTextContent('/app/courses');
  });

  it('resets workspace content scroll after route changes', async () => {
    vi.mocked(fetchCurrentSession).mockResolvedValue(signedIn('student'));

    renderApp('/app');

    expect(
      await screen.findByText(
        'Τα μαθήματά σου και ό,τι χρειάζεται την προσοχή σου.',
      ),
    ).toBeInTheDocument();
    const workspaceContent = document.getElementById('main-content');
    expect(workspaceContent).not.toBeNull();
    workspaceContent!.scrollTop = 480;

    await userEvent.click(screen.getByRole('link', { name: /Μαθήματα/ }));

    expect(await screen.findByText('Τα μαθήματά μου')).toBeInTheDocument();
    await waitFor(() =>
      expect(workspaceContent).toHaveProperty('scrollTop', 0),
    );
  });

  it('fetches the existing server session after a fresh mount', async () => {
    vi.mocked(fetchCurrentSession).mockResolvedValue(signedIn());
    const first = renderApp('/app');

    await screen.findByText(
      'Τα μαθήματά σου και ό,τι χρειάζεται την προσοχή σου.',
    );
    first.unmount();
    renderApp('/app');

    expect(
      await screen.findByText(
        'Τα μαθήματά σου και ό,τι χρειάζεται την προσοχή σου.',
      ),
    ).toBeInTheDocument();
    expect(fetchCurrentSession).toHaveBeenCalledTimes(2);
    expect(login).not.toHaveBeenCalled();
  });

  it('distinguishes a failed session lookup from a guest and supports retry', async () => {
    vi.mocked(fetchCurrentSession)
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue(signedIn());
    renderApp('/app');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Δεν ήταν δυνατός ο έλεγχος',
    );
    expect(screen.getByLabelText('Διαδρομή')).toHaveTextContent('/app');

    await userEvent.click(
      screen.getByRole('button', { name: 'Επανάληψη ελέγχου' }),
    );

    expect(
      await screen.findByText(
        'Τα μαθήματά σου και ό,τι χρειάζεται την προσοχή σου.',
      ),
    ).toBeInTheDocument();
  });

  it('clears previous-user queries and cached mutations on logout', async () => {
    vi.mocked(fetchCurrentSession).mockResolvedValue(signedIn());
    const { client } = renderApp('/app');

    await screen.findByText(
      'Τα μαθήματά σου και ό,τι χρειάζεται την προσοχή σου.',
    );
    client.setQueryData(['private-notes'], ['private data']);
    await client
      .getMutationCache()
      .build(client, {
        mutationKey: ['old-user'],
        mutationFn: async () => 'private',
      })
      .execute('private');

    await openProfileMenu();
    await userEvent.click(screen.getByRole('menuitem', { name: 'Αποσύνδεση' }));

    expect(await screen.findByRole('form')).toBeInTheDocument();
    expect(logout).toHaveBeenCalledTimes(1);
    expect(client.getQueryData(['private-notes'])).toBeUndefined();
    expect(client.getMutationCache().getAll()).toHaveLength(0);
    expect(client.getQueryData(sessionKey)).toEqual(guest);
    expect(screen.getByLabelText('Διαδρομή')).toHaveTextContent('/');
  });

  it('keeps the session after logout failure and allows retry', async () => {
    vi.mocked(fetchCurrentSession).mockResolvedValue(signedIn());
    vi.mocked(logout).mockRejectedValueOnce(new Error('offline'));
    renderApp('/app');

    await openProfileMenu();
    await userEvent.click(screen.getByRole('menuitem', { name: 'Αποσύνδεση' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Η αποσύνδεση δεν ολοκληρώθηκε.',
    );
    expect(
      screen.getByText('Τα μαθήματά σου και ό,τι χρειάζεται την προσοχή σου.'),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('menuitem', { name: 'Αποσύνδεση' }));

    expect(await screen.findByRole('form')).toBeInTheDocument();
  });

  it('ignores an old session response arriving after logout', async () => {
    const stale = deferred<CurrentSession>();
    vi.mocked(fetchCurrentSession)
      .mockResolvedValueOnce(signedIn())
      .mockReturnValueOnce(stale.promise);
    const { client } = renderApp('/app');

    await screen.findByText(
      'Τα μαθήματά σου και ό,τι χρειάζεται την προσοχή σου.',
    );
    let oldRequest!: Promise<void>;
    act(() => {
      oldRequest = client.refetchQueries({ queryKey: sessionKey });
    });
    await waitFor(() => expect(fetchCurrentSession).toHaveBeenCalledTimes(2));
    const signal = vi.mocked(fetchCurrentSession).mock.calls[1][0];

    await openProfileMenu();
    await userEvent.click(screen.getByRole('menuitem', { name: 'Αποσύνδεση' }));
    await screen.findByRole('form');

    expect(signal?.aborted).toBe(true);
    await act(async () => {
      stale.resolve(signedIn());
      await oldRequest;
    });
    expect(client.getQueryData(sessionKey)).toEqual(guest);
    expect(screen.getByLabelText('Διαδρομή')).toHaveTextContent('/');
  });

  it('ignores an old guest response arriving after login', async () => {
    const stale = deferred<CurrentSession>();
    vi.mocked(fetchCurrentSession)
      .mockResolvedValueOnce(guest)
      .mockReturnValueOnce(stale.promise);
    const { client } = renderApp();

    await fillLogin();
    act(() => {
      void client.refetchQueries({ queryKey: sessionKey });
    });
    await waitFor(() => expect(fetchCurrentSession).toHaveBeenCalledTimes(2));
    await userEvent.click(
      screen.getByRole('button', { name: 'Σύνδεση στο Academic Hub' }),
    );
    await screen.findByText(
      'Τα μαθήματά σου και ό,τι χρειάζεται την προσοχή σου.',
    );

    await act(async () => stale.resolve(guest));

    expect(client.getQueryData(sessionKey)).toEqual(signedIn());
  });

  it('rechecks on focus and clears private cache when the server reports expiry', async () => {
    vi.mocked(fetchCurrentSession)
      .mockResolvedValueOnce(signedIn())
      .mockResolvedValue(guest);
    const { client } = renderApp('/app');

    await screen.findByText(
      'Τα μαθήματά σου και ό,τι χρειάζεται την προσοχή σου.',
    );
    client.setQueryData(['private-notes'], ['private']);
    act(() => {
      focusManager.setFocused(false);
      focusManager.setFocused(true);
    });

    expect(await screen.findByRole('form')).toBeInTheDocument();
    await waitFor(() =>
      expect(client.getQueryData(['private-notes'])).toBeUndefined(),
    );
  });

  it('rechecks on reconnect and preserves identity during an API outage', async () => {
    vi.mocked(fetchCurrentSession)
      .mockResolvedValueOnce(signedIn())
      .mockRejectedValueOnce(new Error('offline'));
    const { client } = renderApp('/app');

    await screen.findByText(
      'Τα μαθήματά σου και ό,τι χρειάζεται την προσοχή σου.',
    );
    act(() => {
      onlineManager.setOnline(false);
      onlineManager.setOnline(true);
    });

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Δεν ήταν δυνατός ο έλεγχος',
    );
    expect(client.getQueryData(sessionKey)).toEqual(signedIn());
    expect(screen.getByLabelText('Διαδρομή')).toHaveTextContent('/app');
  });
});
