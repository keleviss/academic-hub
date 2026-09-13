import type { FieldError } from 'react-hook-form';

export function FormField({
  label,
  optional,
  error,
  children,
}: {
  label: React.ReactNode;
  optional?: boolean;
  error?: FieldError;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <>
      <label>
        {label} {optional && <span className="field-optional">Προαιρετική</span>}
        {children}
      </label>
      {error && (
        <p className="field-error" role="alert">
          {error.message}
        </p>
      )}
    </>
  );
}
