import {
  useForm,
  type DefaultValues,
  type FieldValues,
  type Resolver,
  type UseFormReturn,
} from 'react-hook-form';

import { Dialog } from './Dialog';
import { ErrorNotice } from './feedback';

/** Dialog + react-hook-form + zod shell shared by all modal forms. */
export function FormDialog<TValues extends FieldValues>({
  title,
  resolver,
  defaultValues,
  pending,
  error,
  submitLabel,
  pendingLabel = 'Αποθήκευση…',
  onCancel,
  onSubmit,
  children,
}: {
  title: string;
  resolver: Resolver<TValues>;
  defaultValues: DefaultValues<TValues>;
  pending: boolean;
  error: string | null;
  submitLabel: string;
  pendingLabel?: string;
  onCancel: () => void;
  onSubmit: (values: TValues) => void;
  children: (form: UseFormReturn<TValues>) => React.ReactNode;
}): React.JSX.Element {
  const form = useForm<TValues>({ resolver, defaultValues });

  return (
    <Dialog title={title} onClose={onCancel}>
      <form
        className="course-form"
        noValidate
        onSubmit={(event) => void form.handleSubmit(onSubmit)(event)}
      >
        {children(form)}
        {error && <ErrorNotice>{error}</ErrorNotice>}
        <footer className="course-dialog-actions">
          <button className="secondary-button" type="button" onClick={onCancel}>
            Ακύρωση
          </button>
          <button className="primary-button" disabled={pending} type="submit">
            {pending ? pendingLabel : submitLabel}
          </button>
        </footer>
      </form>
    </Dialog>
  );
}
