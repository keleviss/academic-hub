import { ProfessorCourseListItem } from "@web-app/contracts";

export const professorCoursesKey = ['professor', 'courses'] as const;

export const instructorRoleLabels: Record<
  ProfessorCourseListItem['instructorRole'],
  string
> = {
  owner: 'Υπεύθυνος μαθήματος',
  assistant: 'Συνεργάτης διδάσκων',
};
