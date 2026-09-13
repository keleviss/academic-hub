import { getErrorMessage } from '../../../../lib/api-error';

export function messageFor(error: unknown): string {
  return getErrorMessage(error, {
    codes: {
      COURSE_CODE_ALREADY_EXISTS: 'Υπάρχει ήδη μάθημα με αυτόν τον κωδικό.',
      COURSE_INSTRUCTOR_ALREADY_ASSIGNED: 'Ο διδάσκων είναι ήδη ανατεθειμένος.',
      STUDENT_ALREADY_ENROLLED: 'Ο φοιτητής είναι ήδη εγγεγραμμένος.',
    },
  });
}
