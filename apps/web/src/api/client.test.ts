import { describe, expect, it, vi, afterEach } from 'vitest';

import { createAdminCourse, fetchHealth } from './client';

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

  it('sends course writes with a freshly issued CSRF token', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ csrfToken: 'csrf-token' }), { status: 200 }),
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              data: {
                id: '11111111-1111-4111-8111-111111111111',
                code: 'CS-101',
                title: 'Δομές Δεδομένων',
                description: null,
                semester: 3,
                ectsCredits: 6,
                isActive: true,
                counts: { documentCount: 0, instructorCount: 0, studentCount: 0 },
                primaryInstructor: null,
                createdAt: '2026-09-12T00:00:00.000Z',
                updatedAt: '2026-09-12T00:00:00.000Z',
                instructors: [],
                enrollments: [],
                documents: [],
              },
            }),
            { status: 201 },
          ),
        ),
    );

    await expect(
      createAdminCourse({
        code: 'CS-101',
        title: 'Δομές Δεδομένων',
        description: null,
        semester: 3,
        ectsCredits: 6,
      }),
    ).resolves.toMatchObject({ data: { code: 'CS-101' } });

    expect(fetch).toHaveBeenLastCalledWith('/api/admin/courses', {
      method: 'POST',
      body: JSON.stringify({
        code: 'CS-101',
        title: 'Δομές Δεδομένων',
        description: null,
        semester: 3,
        ectsCredits: 6,
      }),
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'x-csrf-token': 'csrf-token',
      },
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
