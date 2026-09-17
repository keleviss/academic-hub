import { ArrowLeft } from 'lucide-react';
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
      <ArrowLeft aria-hidden="true" size={16} strokeWidth={2} />
      {children}
    </Link>
  );
}
