import {
  CsrfResponseSchema,
  CourseDocumentAnnotationResponseSchema,
  CourseDocumentAnnotationsResponseSchema,
  CourseDetailResponseSchema,
  CourseDocumentResponseSchema,
  CourseDocumentsResponseSchema,
  CourseEnrollmentsResponseSchema,
  CourseInstructorsResponseSchema,
  CourseListResponseSchema,
  CourseMemberCandidatesResponseSchema,
  CourseMutationResponseSchema,
  CurrentSessionSchema,
  ForumThreadResponseSchema,
  ForumThreadsResponseSchema,
  HealthResponseSchema,
  LoginRequestSchema,
  ProfessorCourseDetailResponseSchema,
  ProfessorCourseListResponseSchema,
  ProfessorDashboardResponseSchema,
  RoadmapNodeDeleteResponseSchema,
  RoadmapNodeMutationResponseSchema,
  RoadmapResponseSchema,
  StudentDocumentActivitySummaryResponseSchema,
  StudentCourseDetailResponseSchema,
  StudentCourseListResponseSchema,
  StudentDashboardResponseSchema,
  type CurrentSession,
  type AssignCourseInstructorRequest,
  type CourseCreateRequest,
  type CourseDetailResponse,
  type CourseDocumentAnnotationResponse,
  type CourseDocumentAnnotationsResponse,
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
  type CreateCourseDocumentAnnotationRequest,
  type CreateForumPostRequest,
  type CreateForumThreadRequest,
  type EnrollStudentRequest,
  type ForumThreadFilter,
  type ForumThreadResponse,
  type ForumThreadsResponse,
  type HealthResponse,
  type LoginRequest,
  type ProfessorCourseDetailResponse,
  type ProfessorCourseListResponse,
  type ProfessorDashboardResponse,
  type RoadmapNodeDeleteResponse,
  type RoadmapNodeMutationResponse,
  type RoadmapResponse,
  type StudentDocumentActivitySummaryResponse,
  type StudentCourseDetailResponse,
  type StudentCourseListResponse,
  type StudentDashboardResponse,
  type UpdateCourseDocumentAnnotationRequest,
  type UpdateCourseDocumentMetadataRequest,
  type UpdateEnrollmentStatusRequest,
  type UpdateForumPostRequest,
  type UpdateForumThreadRequest,
  type UpdateRoadmapProgressRequest,
  type UpsertRoadmapNodeRequest,
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

async function performEmptyMutation(
  path: `/${string}`,
  init: RequestInit,
): Promise<void> {
  for (let attempt = 0; ; attempt += 1) {
    const { csrfToken } = await fetchCsrfToken();
    const response = await fetch(`${getApiBaseUrl()}${path}`, {
      ...init,
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'x-csrf-token': csrfToken,
        ...init.headers,
      },
    });

    if (response.ok) return;

    const error = await readError(response);
    if (
      attempt === 0 &&
      error.status === 403 &&
      error.code === 'CSRF_TOKEN_INVALID'
    )
      continue;
    throw error;
  }
}

function requestEmptyMutation(
  path: `/${string}`,
  init: RequestInit,
): Promise<void> {
  const result = mutationQueue.then(
    () => performEmptyMutation(path, init),
    () => performEmptyMutation(path, init),
  );
  mutationQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

// FormData bodies must not get a manual Content-Type: the browser sets the
// multipart boundary itself.
async function performMultipartMutation<T>(
  path: `/${string}`,
  schema: z.ZodType<T>,
  init: { body: FormData; method: string },
): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    const { csrfToken } = await fetchCsrfToken();
    try {
      return await requestJson(path, schema, {
        ...init,
        headers: { 'x-csrf-token': csrfToken },
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

function requestMultipartMutation<T>(
  path: `/${string}`,
  schema: z.ZodType<T>,
  init: { body: FormData; method: string },
): Promise<T> {
  const result = mutationQueue.then(
    () => performMultipartMutation(path, schema, init),
    () => performMultipartMutation(path, schema, init),
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
  return requestJson(
    `/api/admin/courses/${courseId}`,
    CourseDetailResponseSchema,
    {
      signal,
    },
  );
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

export function fetchStudentCourses(
  signal?: AbortSignal,
): Promise<StudentCourseListResponse> {
  return requestJson('/api/student/courses', StudentCourseListResponseSchema, {
    signal,
  });
}

export function fetchStudentCourse(
  courseId: string,
  signal?: AbortSignal,
): Promise<StudentCourseDetailResponse> {
  return requestJson(
    `/api/student/courses/${courseId}`,
    StudentCourseDetailResponseSchema,
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

export function fetchCourseDocument(
  courseId: string,
  documentId: string,
  signal?: AbortSignal,
): Promise<CourseDocumentResponse> {
  return requestJson(
    `/api/courses/${courseId}/documents/${documentId}`,
    CourseDocumentResponseSchema,
    { signal },
  );
}

export function fetchCourseDocumentAnnotations(
  courseId: string,
  documentId: string,
  signal?: AbortSignal,
): Promise<CourseDocumentAnnotationsResponse> {
  return requestJson(
    `/api/courses/${courseId}/documents/${documentId}/annotations`,
    CourseDocumentAnnotationsResponseSchema,
    { signal },
  );
}

export function createCourseDocumentAnnotation(
  courseId: string,
  documentId: string,
  input: CreateCourseDocumentAnnotationRequest,
): Promise<CourseDocumentAnnotationResponse> {
  return requestMutation(
    `/api/courses/${courseId}/documents/${documentId}/annotations`,
    CourseDocumentAnnotationResponseSchema,
    { method: 'POST', body: JSON.stringify(input) },
  );
}

export function updateCourseDocumentAnnotation(
  courseId: string,
  documentId: string,
  annotationId: string,
  input: UpdateCourseDocumentAnnotationRequest,
): Promise<CourseDocumentAnnotationResponse> {
  return requestMutation(
    `/api/courses/${courseId}/documents/${documentId}/annotations/${annotationId}`,
    CourseDocumentAnnotationResponseSchema,
    { method: 'PATCH', body: JSON.stringify(input) },
  );
}

export function deleteCourseDocumentAnnotation(
  courseId: string,
  documentId: string,
  annotationId: string,
): Promise<void> {
  return requestEmptyMutation(
    `/api/courses/${courseId}/documents/${documentId}/annotations/${annotationId}`,
    { method: 'DELETE' },
  );
}

export function fetchStudentDocumentActivity(
  courseId: string,
  signal?: AbortSignal,
): Promise<StudentDocumentActivitySummaryResponse> {
  return requestJson(
    `/api/courses/${courseId}/documents/activity`,
    StudentDocumentActivitySummaryResponseSchema,
    { signal },
  );
}

export function roadmapQueryKey(courseId: string) {
  return ['courses', courseId, 'roadmap'] as const;
}

export function fetchCourseRoadmap(
  courseId: string,
  signal?: AbortSignal,
): Promise<RoadmapResponse> {
  return requestJson(
    `/api/courses/${courseId}/roadmap`,
    RoadmapResponseSchema,
    { signal },
  );
}

export function createRoadmapNode(
  courseId: string,
  input: UpsertRoadmapNodeRequest,
): Promise<RoadmapNodeMutationResponse> {
  return requestMutation(
    `/api/courses/${courseId}/roadmap/nodes`,
    RoadmapNodeMutationResponseSchema,
    { method: 'POST', body: JSON.stringify(input) },
  );
}

export function updateRoadmapNode(
  courseId: string,
  nodeId: string,
  input: UpsertRoadmapNodeRequest,
): Promise<RoadmapNodeMutationResponse> {
  return requestMutation(
    `/api/courses/${courseId}/roadmap/nodes/${nodeId}`,
    RoadmapNodeMutationResponseSchema,
    { method: 'PATCH', body: JSON.stringify(input) },
  );
}

export function deleteRoadmapNode(
  courseId: string,
  nodeId: string,
): Promise<RoadmapNodeDeleteResponse> {
  return requestMutation(
    `/api/courses/${courseId}/roadmap/nodes/${nodeId}`,
    RoadmapNodeDeleteResponseSchema,
    { method: 'DELETE' },
  );
}

export function updateRoadmapProgress(
  courseId: string,
  nodeId: string,
  input: UpdateRoadmapProgressRequest,
): Promise<RoadmapNodeMutationResponse> {
  return requestMutation(
    `/api/courses/${courseId}/roadmap/nodes/${nodeId}/progress`,
    RoadmapNodeMutationResponseSchema,
    { method: 'PATCH', body: JSON.stringify(input) },
  );
}

// A prefix of every forumThreadsQueryKey(courseId, ...) variant, for
// invalidating all cached filters/documentIds of a course's thread list at once.
export function forumThreadsBaseKey(courseId: string) {
  return ['courses', courseId, 'forum', 'threads'] as const;
}

export function forumThreadsQueryKey(
  courseId: string,
  filter: ForumThreadFilter,
  documentId?: string,
) {
  return [
    ...forumThreadsBaseKey(courseId),
    filter,
    documentId ?? null,
  ] as const;
}

export function forumThreadQueryKey(courseId: string, threadId: string) {
  return ['courses', courseId, 'forum', 'threads', threadId] as const;
}

export function studentDashboardQueryKey() {
  return ['student', 'dashboard'] as const;
}

export function professorDashboardQueryKey() {
  return ['professor', 'dashboard'] as const;
}

function forumThreadsQueryString(
  filter: ForumThreadFilter,
  documentId?: string,
): string {
  const params = new URLSearchParams({ filter });
  if (documentId) params.set('documentId', documentId);
  return `?${params.toString()}`;
}

export function fetchForumThreads(
  courseId: string,
  filter: ForumThreadFilter,
  documentId?: string,
  signal?: AbortSignal,
): Promise<ForumThreadsResponse> {
  return requestJson(
    `/api/courses/${courseId}/forum/threads${forumThreadsQueryString(filter, documentId)}`,
    ForumThreadsResponseSchema,
    { signal },
  );
}

export function fetchForumThread(
  courseId: string,
  threadId: string,
  signal?: AbortSignal,
): Promise<ForumThreadResponse> {
  return requestJson(
    `/api/courses/${courseId}/forum/threads/${threadId}`,
    ForumThreadResponseSchema,
    { signal },
  );
}

export function createForumThread(
  courseId: string,
  input: CreateForumThreadRequest,
): Promise<ForumThreadResponse> {
  return requestMutation(
    `/api/courses/${courseId}/forum/threads`,
    ForumThreadResponseSchema,
    { method: 'POST', body: JSON.stringify(input) },
  );
}

export function updateForumThread(
  courseId: string,
  threadId: string,
  input: UpdateForumThreadRequest,
): Promise<ForumThreadResponse> {
  return requestMutation(
    `/api/courses/${courseId}/forum/threads/${threadId}`,
    ForumThreadResponseSchema,
    { method: 'PATCH', body: JSON.stringify(input) },
  );
}

export function deleteForumThread(
  courseId: string,
  threadId: string,
): Promise<void> {
  return requestEmptyMutation(
    `/api/courses/${courseId}/forum/threads/${threadId}`,
    { method: 'DELETE' },
  );
}

export function createForumPost(
  courseId: string,
  threadId: string,
  input: CreateForumPostRequest,
): Promise<ForumThreadResponse> {
  return requestMutation(
    `/api/courses/${courseId}/forum/threads/${threadId}/posts`,
    ForumThreadResponseSchema,
    { method: 'POST', body: JSON.stringify(input) },
  );
}

export function updateForumPost(
  courseId: string,
  threadId: string,
  postId: string,
  input: UpdateForumPostRequest,
): Promise<ForumThreadResponse> {
  return requestMutation(
    `/api/courses/${courseId}/forum/threads/${threadId}/posts/${postId}`,
    ForumThreadResponseSchema,
    { method: 'PATCH', body: JSON.stringify(input) },
  );
}

export function deleteForumPost(
  courseId: string,
  threadId: string,
  postId: string,
): Promise<void> {
  return requestEmptyMutation(
    `/api/courses/${courseId}/forum/threads/${threadId}/posts/${postId}`,
    { method: 'DELETE' },
  );
}

export function verifyForumPost(
  courseId: string,
  threadId: string,
  postId: string,
): Promise<ForumThreadResponse> {
  return requestMutation(
    `/api/courses/${courseId}/forum/threads/${threadId}/posts/${postId}/verify`,
    ForumThreadResponseSchema,
    { method: 'PATCH' },
  );
}

export function resolveForumThread(
  courseId: string,
  threadId: string,
): Promise<ForumThreadResponse> {
  return requestMutation(
    `/api/courses/${courseId}/forum/threads/${threadId}/resolve`,
    ForumThreadResponseSchema,
    { method: 'PATCH' },
  );
}

export function reopenForumThread(
  courseId: string,
  threadId: string,
): Promise<ForumThreadResponse> {
  return requestMutation(
    `/api/courses/${courseId}/forum/threads/${threadId}/reopen`,
    ForumThreadResponseSchema,
    { method: 'PATCH' },
  );
}

export function fetchStudentDashboard(
  signal?: AbortSignal,
): Promise<StudentDashboardResponse> {
  return requestJson('/api/student/dashboard', StudentDashboardResponseSchema, {
    signal,
  });
}

export function fetchProfessorDashboard(
  signal?: AbortSignal,
): Promise<ProfessorDashboardResponse> {
  return requestJson(
    '/api/professor/dashboard',
    ProfessorDashboardResponseSchema,
    { signal },
  );
}

export function uploadCourseDocument(
  courseId: string,
  formData: FormData,
): Promise<CourseDocumentResponse> {
  return requestMultipartMutation(
    `/api/courses/${courseId}/documents`,
    CourseDocumentResponseSchema,
    { method: 'POST', body: formData },
  );
}

export async function fetchCourseDocumentContent(
  courseId: string,
  documentId: string,
  signal?: AbortSignal,
): Promise<ArrayBuffer> {
  const response = await fetch(
    `${getApiBaseUrl()}/api/courses/${courseId}/documents/${documentId}/content`,
    { credentials: 'include', signal },
  );

  if (!response.ok) {
    throw await readError(response);
  }

  return response.arrayBuffer();
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
