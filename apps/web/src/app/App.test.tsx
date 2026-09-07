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
  fetchHealth,
  fetchCurrentSession,
  login,
  logout,
} from '../api/client';
import { renderWithProviders } from '../test/render';
import { deferred, guest, signedIn } from '../auth/test-fixtures';
import { sessionKey } from '../auth/session';

vi.mock('../api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/client')>()),
  fetchHealth: vi.fn(),
  fetchCurrentSession: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
}));

function Location() {
  return <output aria-label="Διαδρομή">{useLocation().pathname}</output>;
}
const clients: QueryClient[] = [];
function renderApp(
  path = '/login',
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

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(fetchHealth).mockResolvedValue({
    status: 'ok',
    service: 'api-test',
    timestamp: '2026-09-07T00:00:00.000Z',
  });
  vi.mocked(fetchCurrentSession).mockResolvedValue(guest);
  vi.mocked(login).mockResolvedValue(signedIn());
  vi.mocked(logout).mockResolvedValue(guest);
});
afterEach(() => {
  for (const client of clients.splice(0)) client.clear();
  focusManager.setFocused(undefined);
  onlineManager.setOnline(true);
});

describe('public shell and login', () => {
  it('preserves the public home and navigates to the functional login', async () => {
    renderApp('/');
    expect(await screen.findByText('API ενεργό')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('link', { name: 'Σύνδεση' }));
    expect(
      await screen.findByRole('form', { name: 'Σύνδεση στο Academic Hub' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('navigation', { name: 'Κύρια πλοήγηση' }),
    ).not.toBeInTheDocument();
  });
  it('waits for session resolution without showing a login form or redirecting', async () => {
    const request = deferred<CurrentSession>();
    vi.mocked(fetchCurrentSession).mockReturnValue(request.promise);
    renderApp('/student');
    expect(screen.getByText('Έλεγχος σύνδεσης…')).toBeInTheDocument();
    expect(screen.getByLabelText('Διαδρομή')).toHaveTextContent('/student');
    await act(async () => request.resolve(guest));
    expect(await screen.findByRole('form')).toBeInTheDocument();
    expect(screen.getByLabelText('Διαδρομή')).toHaveTextContent('/login');
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
    'logs in and lands at /%s',
    async (role) => {
      vi.mocked(login).mockResolvedValue(signedIn(role));
      const { client } = renderApp();
      const user = await fillLogin();
      await user.click(
        screen.getByRole('button', { name: 'Σύνδεση στο Academic Hub' }),
      );
      expect(
        await screen.findByText('Έχεις συνδεθεί στο Academic Hub.'),
      ).toBeInTheDocument();
      expect(screen.getByLabelText('Διαδρομή')).toHaveTextContent(`/${role}`);
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
      await screen.findByText('Έχεις συνδεθεί στο Academic Hub.'),
    ).toBeInTheDocument();
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
      await screen.findByText('Έχεις συνδεθεί στο Academic Hub.'),
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

describe('session, routing and logout', () => {
  it.each(['/admin', '/professor', '/student'])(
    'redirects guests at %s',
    async (path) => {
      renderApp(path);
      expect(await screen.findByRole('form')).toBeInTheDocument();
      expect(screen.getByLabelText('Διαδρομή')).toHaveTextContent('/login');
    },
  );
  it.each(['/login', '/admin', '/professor'])(
    'redirects an authenticated student from %s to their role',
    async (path) => {
      vi.mocked(fetchCurrentSession).mockResolvedValue(signedIn());
      renderApp(path);
      expect(
        await screen.findByText('Έχεις συνδεθεί στο Academic Hub.'),
      ).toBeInTheDocument();
      expect(screen.getByLabelText('Διαδρομή')).toHaveTextContent('/student');
    },
  );
  it('fetches the existing server session after a fresh mount', async () => {
    vi.mocked(fetchCurrentSession).mockResolvedValue(signedIn());
    const first = renderApp('/student');
    await screen.findByText('Έχεις συνδεθεί στο Academic Hub.');
    first.unmount();
    renderApp('/student');
    expect(
      await screen.findByText('Έχεις συνδεθεί στο Academic Hub.'),
    ).toBeInTheDocument();
    expect(fetchCurrentSession).toHaveBeenCalledTimes(2);
    expect(login).not.toHaveBeenCalled();
  });
  it('distinguishes a failed session lookup from a guest and supports retry', async () => {
    vi.mocked(fetchCurrentSession)
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue(signedIn());
    renderApp('/student');
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Δεν ήταν δυνατός ο έλεγχος',
    );
    expect(screen.getByLabelText('Διαδρομή')).toHaveTextContent('/student');
    await userEvent.click(
      screen.getByRole('button', { name: 'Επανάληψη ελέγχου' }),
    );
    expect(
      await screen.findByText('Έχεις συνδεθεί στο Academic Hub.'),
    ).toBeInTheDocument();
  });
  it('clears previous-user queries and cached mutations on logout', async () => {
    vi.mocked(fetchCurrentSession).mockResolvedValue(signedIn());
    const { client } = renderApp('/student');
    await screen.findByText('Έχεις συνδεθεί στο Academic Hub.');
    client.setQueryData(['private-notes'], ['private data']);
    await client
      .getMutationCache()
      .build(client, {
        mutationKey: ['old-user'],
        mutationFn: async () => 'private',
      })
      .execute('private');
    await userEvent.click(screen.getByRole('button', { name: 'Αποσύνδεση' }));
    expect(await screen.findByRole('form')).toBeInTheDocument();
    expect(logout).toHaveBeenCalledTimes(1);
    expect(client.getQueryData(['private-notes'])).toBeUndefined();
    expect(client.getMutationCache().getAll()).toHaveLength(0);
    expect(client.getQueryData(sessionKey)).toEqual(guest);
  });
  it('keeps the session after logout failure and allows retry', async () => {
    vi.mocked(fetchCurrentSession).mockResolvedValue(signedIn());
    vi.mocked(logout).mockRejectedValueOnce(new Error('offline'));
    renderApp('/student');
    await userEvent.click(
      await screen.findByRole('button', { name: 'Αποσύνδεση' }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Η αποσύνδεση δεν ολοκληρώθηκε.',
    );
    expect(
      screen.getByText('Έχεις συνδεθεί στο Academic Hub.'),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Αποσύνδεση' }));
    expect(await screen.findByRole('form')).toBeInTheDocument();
  });
  it('ignores an old session response arriving after logout', async () => {
    const stale = deferred<CurrentSession>();
    vi.mocked(fetchCurrentSession)
      .mockResolvedValueOnce(signedIn())
      .mockReturnValueOnce(stale.promise);
    const { client } = renderApp('/student');
    await screen.findByText('Έχεις συνδεθεί στο Academic Hub.');
    let oldRequest!: Promise<void>;
    act(() => {
      oldRequest = client.refetchQueries({ queryKey: sessionKey });
    });
    await waitFor(() => expect(fetchCurrentSession).toHaveBeenCalledTimes(2));
    const signal = vi.mocked(fetchCurrentSession).mock.calls[1][0];
    await userEvent.click(screen.getByRole('button', { name: 'Αποσύνδεση' }));
    await screen.findByRole('form');
    expect(signal?.aborted).toBe(true);
    await act(async () => {
      stale.resolve(signedIn());
      await oldRequest;
    });
    expect(client.getQueryData(sessionKey)).toEqual(guest);
    expect(screen.getByLabelText('Διαδρομή')).toHaveTextContent('/login');
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
    await screen.findByText('Έχεις συνδεθεί στο Academic Hub.');
    await act(async () => stale.resolve(guest));
    expect(client.getQueryData(sessionKey)).toEqual(signedIn());
  });
  it('rechecks on focus and clears private cache when the server reports expiry', async () => {
    vi.mocked(fetchCurrentSession)
      .mockResolvedValueOnce(signedIn())
      .mockResolvedValue(guest);
    const { client } = renderApp('/student');
    await screen.findByText('Έχεις συνδεθεί στο Academic Hub.');
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
    const { client } = renderApp('/student');
    await screen.findByText('Έχεις συνδεθεί στο Academic Hub.');
    act(() => {
      onlineManager.setOnline(false);
      onlineManager.setOnline(true);
    });
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Δεν ήταν δυνατός ο έλεγχος',
    );
    expect(client.getQueryData(sessionKey)).toEqual(signedIn());
    expect(screen.getByLabelText('Διαδρομή')).toHaveTextContent('/student');
  });
});
