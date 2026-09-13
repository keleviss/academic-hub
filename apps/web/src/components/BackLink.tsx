import { Link } from 'react-router';

export function BackLink({
  to,
  children,
}: {
  to: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <Link className="back-link" to={to}>
      ← {children}
    </Link>
  );
}
