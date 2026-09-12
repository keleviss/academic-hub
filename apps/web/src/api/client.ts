import {
  CsrfResponseSchema,
  CourseDetailResponseSchema,
  CourseDocumentResponseSchema,
  CourseDocumentsResponseSchema,
  CourseEnrollmentsResponseSchema,
  CourseInstructorsResponseSchema,
  CourseListResponseSchema,
  CourseMemberCandidatesResponseSchema,
  CourseMutationResponseSchema,
  CurrentSessionSchema,
  HealthResponseSchema,
  LoginRequestSchema,
  ProfessorCourseDetailResponseSchema,
  ProfessorCourseListResponseSchema,
  type CurrentSession,
  type AssignCourseInstructorRequest,
  type CourseCreateRequest,
  type CourseDetailResponse,
  type CourseDocumentResponse,
  type CourseDocumentsResponse,
  type CourseEnrollmentsResponse,
  type CourseInstructorsResponse,
  type CourseListQuery,
  type CourseListResponse,
  type CourseMemberCandidateRole,
  type CourseMemberCandidatesResponse,
  type CourseMutationResponse,
  type CourseUpdateRequest,
  type CreateCourseDocumentRequest,
  type EnrollStudentRequest,
  type HealthResponse,
  type LoginRequest,
  type ProfessorCourseDetailResponse,
  type ProfessorCourseListResponse,
  type UpdateCourseDocumentMetadataRequest,
  type UpdateEnrollmentStatusRequest,
} from '@web-app/contracts';
import { z } from 'zod';

export class ApiClientError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

function getApiBaseUrl(): string {
  const configuredUrl = import.meta.env.VITE_API_BASE_URL?.trim();

  return configuredUrl ? configuredUrl.replace(/\/+$/, '') : '';
}

async function readError(response: Response): Promise<ApiClientError> {
  const fallback = `Request failed with status ${response.status}`;

  try {
    const body = (await response.json()) as unknown;
    const parsed = z
      .object({
        error: z
          .object({
            message: z.string().min(1),
            code: z.string().optional(),
          })
          .optional(),
        message: z.string().min(1).optional(),
      })
      .safeParse(body);

    return new ApiClientError(
      parsed.data?.error?.message ?? parsed.data?.message ?? fallback,
      response.status,
      parsed.data?.error?.code,
    );
  } catch {
    return new ApiClientError(fallback, response.status);
  }
}

async function requestJson<T>(
  path: `/${string}`,
  schema: z.ZodType<T>,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...init.headers,
    },
  });

  if (!response.ok) {
    throw await readError(response);
  }

  return schema.parse(await response.json());
}

export function fetchHealth(): Promise<HealthResponse> {
  return requestJson('/api/health', HealthResponseSchema);
}

export async function fetchCurrentSession(
  signal?: AbortSignal,
): Promise<CurrentSession> {
  const session = await requestJson('/api/auth/session', CurrentSessionSchema, {
    signal,
  });
  return validateSession(session);
}

function validateSession(session: CurrentSession): CurrentSession {
  // The shared schema permits boolean/null independently. Fail closed on an
  // inconsistent response instead of treating a broken API as a guest session.
  if (
    session.authenticated !== (session.user !== null) ||
    session.user?.isActive === false
  ) {
    throw new Error('Invalid session response');
  }
  return session;
}

export function fetchCsrfToken() {
  return requestJson('/api/auth/csrf', CsrfResponseSchema);
}

async function performMutation<T>(
  path: `/${string}`,
  schema: z.ZodType<T>,
  init: RequestInit,
): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    const { csrfToken } = await fetchCsrfToken();
    try {
      return await requestJson(path, schema, {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
          ...init.headers,
        },
      });
    } catch (error) {
      if (
        attempt === 0 &&
        error instanceof ApiClientError &&
        error.status === 403 &&
        error.code === 'CSRF_TOKEN_INVALID'
      )
        continue;
      throw error;
    }
  }
}

// Every CSRF token fetch rotates the matching cookie. Keep write pairs in this
// tab ordered, as the authentication client already does for login/logout.
let mutationQueue: Promise<unknown> = Promise.resolve();
function requestMutation<T>(
  path: `/${string}`,
  schema: z.ZodType<T>,
  init: RequestInit,
): Promise<T> {
  const result = mutationQueue.then(
    () => performMutation(path, schema, init),
    () => performMutation(path, schema, init),
  );
  mutationQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

function courseQueryString(query: Partial<CourseListQuery>): string {
  const params = new URLSearchParams();
  if (query.page) params.set('page', String(query.page));
  if (query.pageSize) params.set('pageSize', String(query.pageSize));
  if (query.search) params.set('search', query.search);
  if (query.semester) params.set('semester', String(query.semester));
  if (query.status) params.set('status', query.status);
  const value = params.toString();
  return value ? `?${value}` : '';
}

export function fetchAdminCourses(
  query: Partial<CourseListQuery> = {},
  signal?: AbortSignal,
): Promise<CourseListResponse> {
  return requestJson(
    `/api/admin/courses${courseQueryString(query)}`,
    CourseListResponseSchema,
    { signal },
  );
}

export function fetchAdminCourse(
  courseId: string,
  signal?: AbortSignal,
): Promise<CourseDetailResponse> {
  return requestJson(`/api/admin/courses/${courseId}`, CourseDetailResponseSchema, {
    signal,
  });
}

export function fetchCourseMemberCandidates(
  courseId: string,
  role: CourseMemberCandidateRole,
  search: string,
  signal?: AbortSignal,
): Promise<CourseMemberCandidatesResponse> {
  const params = new URLSearchParams({ role, search });
  return requestJson(
    `/api/admin/courses/${courseId}/member-candidates?${params.toString()}`,
    CourseMemberCandidatesResponseSchema,
    { signal },
  );
}

export function createAdminCourse(
  input: CourseCreateRequest,
): Promise<CourseMutationResponse> {
  return requestMutation('/api/admin/courses', CourseMutationResponseSchema, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateAdminCourse(
  courseId: string,
  input: CourseUpdateRequest,
): Promise<CourseMutationResponse> {
  return requestMutation(
    `/api/admin/courses/${courseId}`,
    CourseMutationResponseSchema,
    { method: 'PATCH', body: JSON.stringify(input) },
  );
}

export function assignCourseInstructor(
  courseId: string,
  input: AssignCourseInstructorRequest,
): Promise<CourseInstructorsResponse> {
  return requestMutation(
    `/api/admin/courses/${courseId}/instructors`,
    CourseInstructorsResponseSchema,
    { method: 'POST', body: JSON.stringify(input) },
  );
}

export function removeCourseInstructor(
  courseId: string,
  userId: string,
): Promise<CourseInstructorsResponse> {
  return requestMutation(
    `/api/admin/courses/${courseId}/instructors/${userId}`,
    CourseInstructorsResponseSchema,
    { method: 'DELETE' },
  );
}

export function enrollCourseStudent(
  courseId: string,
  input: EnrollStudentRequest,
): Promise<CourseEnrollmentsResponse> {
  return requestMutation(
    `/api/admin/courses/${courseId}/enrollments`,
    CourseEnrollmentsResponseSchema,
    { method: 'POST', body: JSON.stringify(input) },
  );
}

export function updateCourseEnrollmentStatus(
  courseId: string,
  userId: string,
  input: UpdateEnrollmentStatusRequest,
): Promise<CourseEnrollmentsResponse> {
  return requestMutation(
    `/api/admin/courses/${courseId}/enrollments/${userId}`,
    CourseEnrollmentsResponseSchema,
    { method: 'PATCH', body: JSON.stringify(input) },
  );
}

export function fetchProfessorCourses(
  signal?: AbortSignal,
): Promise<ProfessorCourseListResponse> {
  return requestJson(
    '/api/professor/courses',
    ProfessorCourseListResponseSchema,
    { signal },
  );
}

export function fetchProfessorCourse(
  courseId: string,
  signal?: AbortSignal,
): Promise<ProfessorCourseDetailResponse> {
  return requestJson(
    `/api/professor/courses/${courseId}`,
    ProfessorCourseDetailResponseSchema,
    { signal },
  );
}

export function fetchCourseDocuments(
  courseId: string,
  signal?: AbortSignal,
): Promise<CourseDocumentsResponse> {
  return requestJson(
    `/api/courses/${courseId}/documents`,
    CourseDocumentsResponseSchema,
    { signal },
  );
}

export function createCourseDocument(
  courseId: string,
  input: CreateCourseDocumentRequest,
): Promise<CourseDocumentResponse> {
  return requestMutation(
    `/api/courses/${courseId}/documents`,
    CourseDocumentResponseSchema,
    { method: 'POST', body: JSON.stringify(input) },
  );
}

export function updateCourseDocumentMetadata(
  courseId: string,
  documentId: string,
  input: UpdateCourseDocumentMetadataRequest,
): Promise<CourseDocumentResponse> {
  return requestMutation(
    `/api/courses/${courseId}/documents/${documentId}`,
    CourseDocumentResponseSchema,
    { method: 'PATCH', body: JSON.stringify(input) },
  );
}

async function postAuth(
  path: '/api/auth/login' | '/api/auth/logout',
  body?: LoginRequest,
): Promise<CurrentSession> {
  for (let attempt = 0; ; attempt += 1) {
    const { csrfToken } = await fetchCsrfToken();
    try {
      const session = validateSession(
        await requestJson(path, CurrentSessionSchema, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-csrf-token': csrfToken,
          },
          body: JSON.stringify(body ?? {}),
        }),
      );
      if (session.authenticated !== (path === '/api/auth/login')) {
        throw new Error('Unexpected authentication response');
      }
      return session;
    } catch (error) {
      if (
        attempt === 0 &&
        error instanceof ApiClientError &&
        error.status === 403 &&
        error.code === 'CSRF_TOKEN_INVALID'
      )
        continue;
      throw error;
    }
  }
}

// Serialize the CSRF-cookie/POST pairs in this tab, since every CSRF GET rotates
// the cookie. Another tab can still rotate it; the bounded retry handles that.
let authQueue: Promise<unknown> = Promise.resolve();
function enqueueAuth(
  action: () => Promise<CurrentSession>,
): Promise<CurrentSession> {
  const result = authQueue.then(action, action);
  authQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

export function login(input: LoginRequest): Promise<CurrentSession> {
  const body = LoginRequestSchema.parse(input);
  return enqueueAuth(() => postAuth('/api/auth/login', body));
}

export function logout(): Promise<CurrentSession> {
  return enqueueAuth(() => postAuth('/api/auth/logout'));
}
