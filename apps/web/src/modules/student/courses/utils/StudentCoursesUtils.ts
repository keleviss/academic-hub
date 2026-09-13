import { StudentCourseListItem } from '@web-app/contracts';

export function compareCourses(
  a: StudentCourseListItem,
  b: StudentCourseListItem,
  direction: 'asc' | 'desc',
): number {
  const diff = (a.semester - b.semester) * (direction === 'asc' ? 1 : -1);
  if (diff !== 0) return diff;
  return a.title.localeCompare(b.title, 'el');
}
