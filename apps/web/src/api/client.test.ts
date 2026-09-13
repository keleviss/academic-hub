import { describe, expect, it, vi, afterEach } from 'vitest';

import {
  createAdminCourse,
  fetchCourseDocumentContent,
  fetchHealth,
  uploadCourseDocument,
} from './client';

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

  it('uploads a document as multipart form data without a manual content-type', async () => {
    const documentId = '11111111-1111-4111-8111-111111111111';
    const courseId = '22222222-2222-4222-8222-222222222222';
    const formData = new FormData();
    formData.set('title', 'Lecture 1');
    formData.set('file', new File(['%PDF-1.4'], 'lecture.pdf'));

    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ csrfToken: 'csrf-token' }), {
            status: 200,
          }),
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              data: {
                id: documentId,
                title: 'Lecture 1',
                description: null,
                status: 'active',
                visibility: 'hidden_from_students',
                originalFilename: 'lecture.pdf',
                mimeType: 'application/pdf',
                fileSizeBytes: 8,
                pageCount: 1,
                createdAt: '2026-09-13T00:00:00.000Z',
                updatedAt: '2026-09-13T00:00:00.000Z',
              },
            }),
            { status: 201 },
          ),
        ),
    );

    await expect(
      uploadCourseDocument(courseId, formData),
    ).resolves.toMatchObject({ data: { id: documentId } });

    expect(fetch).toHaveBeenLastCalledWith(
      `/api/courses/${courseId}/documents`,
      {
        method: 'POST',
        body: formData,
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          'x-csrf-token': 'csrf-token',
        },
      },
    );
  });

  it('fetches protected document content as an array buffer', async () => {
    const documentId = '11111111-1111-4111-8111-111111111111';
    const courseId = '22222222-2222-4222-8222-222222222222';
    const bytes = new TextEncoder().encode('%PDF-1.4');

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(bytes, { status: 200 })));

    const buffer = await fetchCourseDocumentContent(courseId, documentId);

    expect(Array.from(new Uint8Array(buffer))).toEqual(Array.from(bytes));
    expect(fetch).toHaveBeenCalledWith(
      `/api/courses/${courseId}/documents/${documentId}/content`,
      { credentials: 'include', signal: undefined },
    );
  });
});
