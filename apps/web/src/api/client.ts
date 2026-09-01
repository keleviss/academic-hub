import { HealthResponseSchema, type HealthResponse } from '@web-app/contracts';
import { z } from 'zod';

export class ApiClientError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

function getApiBaseUrl(): string {
  const configuredUrl = import.meta.env.VITE_API_BASE_URL?.trim();

  return configuredUrl ? configuredUrl.replace(/\/+$/, '') : '';
}

async function readErrorMessage(response: Response): Promise<string> {
  const fallback = `Request failed with status ${response.status}`;

  try {
    const body = (await response.json()) as unknown;
    const parsed = z
      .object({
        error: z
          .object({
            message: z.string().min(1),
          })
          .optional(),
        message: z.string().min(1).optional(),
      })
      .safeParse(body);

    return parsed.data?.error?.message ?? parsed.data?.message ?? fallback;
  } catch {
    return fallback;
  }
}

async function getJson<T>(
  path: `/${string}`,
  schema: z.ZodType<T>,
): Promise<T> {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    credentials: 'include',
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new ApiClientError(await readErrorMessage(response), response.status);
  }

  return schema.parse(await response.json());
}

export function fetchHealth(): Promise<HealthResponse> {
  return getJson('/api/health', HealthResponseSchema);
}
