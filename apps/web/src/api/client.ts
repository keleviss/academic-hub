import {
  CsrfResponseSchema,
  CurrentSessionSchema,
  HealthResponseSchema,
  LoginRequestSchema,
  type CurrentSession,
  type HealthResponse,
  type LoginRequest,
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
