const KILOBYTE = 1024;
const MEGABYTE = KILOBYTE * 1024;

export function formatFileSize(bytes: number | null): string {
  if (bytes === null) return '—';
  if (bytes < KILOBYTE) return `${bytes} B`;
  const unit = bytes < MEGABYTE ? KILOBYTE : MEGABYTE;
  const label = bytes < MEGABYTE ? 'KB' : 'MB';
  const value = (bytes / unit).toFixed(1).replace(/\.0$/, '');
  return `${value} ${label}`;
}
