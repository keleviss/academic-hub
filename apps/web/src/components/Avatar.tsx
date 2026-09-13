export function getInitials(name: string, fallback = 'U'): string {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('');
  return (initials || fallback).toLocaleUpperCase('el-GR');
}

export function Avatar({
  name,
  fallback,
}: {
  name: string;
  fallback?: string;
}): React.JSX.Element {
  return (
    <span className="profile-avatar" aria-hidden="true">
      {getInitials(name, fallback)}
    </span>
  );
}
