import { ApiClientError } from 'apps/web/src/api/client';

export function messageFor(error: unknown): string {
  if (error instanceof ApiClientError) {
    const messages: Record<string, string> = {
      COURSE_CODE_ALREADY_EXISTS: 'Υπάρχει ήδη μάθημα με αυτόν τον κωδικό.',
      COURSE_INSTRUCTOR_ALREADY_ASSIGNED: 'Ο διδάσκων είναι ήδη ανατεθειμένος.',
      STUDENT_ALREADY_ENROLLED: 'Ο φοιτητής είναι ήδη εγγεγραμμένος.',
    };
    return messages[error.code ?? ''] ?? error.message;
  }
  return 'Η ενέργεια δεν ολοκληρώθηκε. Δοκίμασε ξανά.';
}
