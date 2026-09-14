import { LoaderCircle } from 'lucide-react';

/** Accessible loading indicator: animated spinner icon plus a status message. */
export function Spinner({
  label,
  size = 20,
}: {
  label?: React.ReactNode;
  size?: number;
}): React.JSX.Element {
  return (
    <div className="flex items-center gap-2" role="status">
      <LoaderCircle
        className="text-hub-teal animate-spin"
        size={size}
        aria-hidden="true"
      />
      {label && <span>{label}</span>}
    </div>
  );
}
