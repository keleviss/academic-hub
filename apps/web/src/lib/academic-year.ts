// The Greek academic year runs September through August.
export function getAcademicYearLabel(date: Date = new Date()): string {
  const year = date.getFullYear();
  const startYear = date.getMonth() >= 8 ? year : year - 1;
  return `${startYear}-${startYear + 1}`;
}
