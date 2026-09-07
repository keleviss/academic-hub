import { describe, expect, it, vi, afterEach } from 'vitest';

import { fetchHealth } from './client';

describe('api client', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('parses the shared health response contract', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            status: 'ok',
            service: 'api-test',
            timestamp: '2026-08-27T00:00:00.000Z',
            version: '0.0.0-test',
          }),
          {
            headers: {
              'Content-Type': 'application/json',
            },
            status: 200,
          },
        ),
      ),
    );

    await expect(fetchHealth()).resolves.toMatchObject({
      service: 'api-test',
      status: 'ok',
    });

    expect(fetch).toHaveBeenCalledWith('/api/health', {
      credentials: 'include',
      headers: {
        Accept: 'application/json',
      },
    });
  });

  it('uses VITE_API_BASE_URL as an explicit request URL override', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'http://api.test.local/');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            status: 'ok',
            service: 'api-test',
            timestamp: '2026-08-27T00:00:00.000Z',
          }),
          {
            headers: {
              'Content-Type': 'application/json',
            },
            status: 200,
          },
        ),
      ),
    );

    await fetchHealth();

    expect(fetch).toHaveBeenCalledWith('http://api.test.local/api/health', {
      credentials: 'include',
      headers: {
        Accept: 'application/json',
      },
    });
  });

  it('throws a typed error for failed responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: {
              message: 'Service unavailable',
            },
          }),
          {
            headers: {
              'Content-Type': 'application/json',
            },
            status: 503,
          },
        ),
      ),
    );

    await expect(fetchHealth()).rejects.toMatchObject({
      message: 'Service unavailable',
      status: 503,
    });
  });

  it('rejects invalid health payloads', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ status: 'missing-service' }), {
          headers: {
            'Content-Type': 'application/json',
          },
          status: 200,
        }),
      ),
    );

    await expect(fetchHealth()).rejects.toThrow();
  });
});
