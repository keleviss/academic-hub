const courseListKey = ['admin', 'courses'] as const;
const semesters = Array.from({ length: 12 }, (_, index) => index + 1);

export { courseListKey, semesters };
