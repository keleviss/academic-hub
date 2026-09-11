import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchCurrentSession, login, logout } from './client';
import { deferred, guest, signedIn } from '../auth/test-fixtures';

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
function csrf(token = 'csrf-first') {
  return response({ csrfToken: token });
}
function failure(code = 'CSRF_TOKEN_INVALID', status = 403) {
  return response({ error: { message: 'Request rejected', code } }, status);
}
const credentials = {
  email: ' STUDENT@Example.com ',
  password: 'test-password',
};
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('auth client', () => {
  it('fetches guest/session payloads with cookies and cancellation', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(response(guest))
      .mockResolvedValueOnce(response(signedIn()));
    vi.stubGlobal('fetch', fetch);
    const signal = new AbortController().signal;
    expect(await fetchCurrentSession(signal)).toEqual(guest);
    expect(await fetchCurrentSession()).toEqual(signedIn());
    expect(fetch).toHaveBeenNthCalledWith(
      1,
      '/api/auth/session',
      expect.objectContaining({ credentials: 'include', signal }),
    );
  });
  it('normalizes input and obtains a fresh CSRF token before each login/logout', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(csrf())
      .mockResolvedValueOnce(response(signedIn()))
      .mockResolvedValueOnce(csrf('csrf-logout'))
      .mockResolvedValueOnce(response(guest));
    vi.stubGlobal('fetch', fetch);
    await login(credentials);
    await logout();
    expect(fetch.mock.calls.map(([path]) => path)).toEqual([
      '/api/auth/csrf',
      '/api/auth/login',
      '/api/auth/csrf',
      '/api/auth/logout',
    ]);
    for (const [, init] of fetch.mock.calls)
      expect(init.credentials).toBe('include');
    expect(fetch.mock.calls[1][1]).toMatchObject({
      method: 'POST',
      headers: {
        'x-csrf-token': 'csrf-first',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'student@example.com',
        password: 'test-password',
      }),
    });
    expect(fetch.mock.calls[3][1]).toMatchObject({
      method: 'POST',
      headers: { 'x-csrf-token': 'csrf-logout' },
      body: '{}',
    });
  });
  it('retries a rejected CSRF pair once using a new token', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(csrf())
      .mockResolvedValueOnce(failure())
      .mockResolvedValueOnce(csrf('csrf-new'))
      .mockResolvedValueOnce(response(signedIn()));
    vi.stubGlobal('fetch', fetch);
    await expect(login(credentials)).resolves.toEqual(signedIn());
    expect(fetch).toHaveBeenCalledTimes(4);
    expect(fetch.mock.calls[3][1].headers['x-csrf-token']).toBe('csrf-new');
  });
  it('stops after the second CSRF rejection', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(csrf())
      .mockResolvedValueOnce(failure())
      .mockResolvedValueOnce(csrf())
      .mockResolvedValueOnce(failure());
    vi.stubGlobal('fetch', fetch);
    await expect(logout()).rejects.toMatchObject({
      status: 403,
      code: 'CSRF_TOKEN_INVALID',
    });
    expect(fetch).toHaveBeenCalledTimes(4);
  });
  it.each([
    [401, 'INVALID_CREDENTIALS'],
    [403, 'FORBIDDEN'],
    [500, 'INTERNAL_ERROR'],
  ])('does not retry %s / %s', async (status, code) => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(csrf())
      .mockResolvedValueOnce(failure(String(code), Number(status)));
    vi.stubGlobal('fetch', fetch);
    await expect(login(credentials)).rejects.toMatchObject({ status, code });
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it('does not replay a POST after a network failure', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(csrf())
      .mockRejectedValueOnce(new TypeError('offline'));
    vi.stubGlobal('fetch', fetch);
    await expect(logout()).rejects.toThrow('offline');
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it('does not send credentials if CSRF retrieval fails validation', async () => {
    const fetch = vi.fn().mockResolvedValue(response({ csrfToken: '' }));
    vi.stubGlobal('fetch', fetch);
    await expect(login(credentials)).rejects.toThrow();
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it.each([
    { authenticated: true, user: null },
    { authenticated: false, user: signedIn().user },
    { authenticated: true, user: { ...signedIn().user, isActive: false } },
    { authenticated: true, user: { role: 'admin' } },
  ])('rejects inconsistent or invalid sessions', async (payload) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(payload)));
    await expect(fetchCurrentSession()).rejects.toThrow();
  });
  it('rejects a successful login response that contains a guest session', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(csrf())
        .mockResolvedValueOnce(response(guest)),
    );
    await expect(login(credentials)).rejects.toThrow(
      'Unexpected authentication response',
    );
  });
  it('honors the configured API base for every auth request', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.test/');
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(csrf())
      .mockResolvedValueOnce(response(guest));
    vi.stubGlobal('fetch', fetch);
    await logout();
    expect(fetch.mock.calls.map(([path]) => path)).toEqual([
      'https://api.example.test/api/auth/csrf',
      'https://api.example.test/api/auth/logout',
    ]);
  });
  it('serializes concurrent auth operations so CSRF cookies cannot race within this tab', async () => {
    const pendingCsrf = deferred<Response>();
    const fetch = vi
      .fn()
      .mockReturnValueOnce(pendingCsrf.promise)
      .mockResolvedValueOnce(response(signedIn()))
      .mockResolvedValueOnce(csrf())
      .mockResolvedValueOnce(response(guest));
    vi.stubGlobal('fetch', fetch);
    const first = login(credentials);
    const second = logout();
    await Promise.resolve();
    expect(fetch).toHaveBeenCalledTimes(1);
    pendingCsrf.resolve(csrf());
    await Promise.all([first, second]);
    expect(fetch.mock.calls.map(([path]) => path)).toEqual([
      '/api/auth/csrf',
      '/api/auth/login',
      '/api/auth/csrf',
      '/api/auth/logout',
    ]);
  });
});
