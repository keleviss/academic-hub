import { ApiClientError } from '../api/client';

export function getErrorMessage(
  error: unknown,
  options?: {
    codes?: Record<string, string>;
    statuses?: Record<number, string>;
    fallback?: string;
  },
): string {
  const fallback = options?.fallback ?? 'Η ενέργεια δεν ολοκληρώθηκε. Δοκίμασε ξανά.';

  if (error instanceof ApiClientError) {
    const codeMessage = error.code ? options?.codes?.[error.code] : undefined;
    if (codeMessage) return codeMessage;

    const statusMessage = error.status
      ? options?.statuses?.[error.status]
      : undefined;
    if (statusMessage) return statusMessage;

    return error.message;
  }

  return fallback;
}
