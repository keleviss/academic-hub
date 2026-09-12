import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { CourseDocumentMetadata, DocumentVisibility } from '@web-app/contracts';

import { Dialog } from '../../../components/Dialog';
import { ErrorNotice } from '../../../components/feedback';
import { normalizeSearch } from '../../../lib/normalize-search';

export interface DocumentFormValues {
  title: string;
  originalFilename: string;
  visibility: DocumentVisibility;
  description: string;
}

// Prototype validation rules kept client-side only; shared contracts stay looser.
function buildDocumentFormSchema(otherNormalizedFilenames: string[]) {
  return z.object({
    title: z
      .string()
      .trim()
      .min(1, 'Ο τίτλος είναι υποχρεωτικός.')
      .max(120, 'Ο τίτλος έχει όριο 120 χαρακτήρων.'),
    originalFilename: z
      .string()
      .trim()
      .min(1, 'Το όνομα αρχείου είναι υποχρεωτικό.')
      .max(180, 'Το όνομα αρχείου έχει όριο 180 χαρακτήρων.')
      .refine(
        (value) => /\.pdf$/i.test(value),
        'Το αρχείο πρέπει να έχει κατάληξη .pdf.',
      )
      .refine(
        (value) => !/[/\\]/.test(value),
        'Το όνομα αρχείου δεν πρέπει να περιέχει διαδρομή φακέλου.',
      )
      .refine(
        (value) => !otherNormalizedFilenames.includes(normalizeSearch(value)),
        'Υπάρχει ήδη έγγραφο με αυτό το όνομα αρχείου σε αυτό το μάθημα.',
      ),
    visibility: z.enum(['visible_to_students', 'hidden_from_students']),
    description: z
      .string()
      .trim()
      .max(1_500, 'Η περιγραφή έχει όριο 1.500 χαρακτήρων.')
      .optional(),
  });
}

export function DocumentFormDialog({
  mode,
  courseCode,
  courseTitle,
  initial,
  existingDocuments,
  pending,
  error,
  onCancel,
  onSubmit,
}: {
  mode: 'create' | 'edit';
  courseCode: string;
  courseTitle: string;
  initial?: CourseDocumentMetadata;
  existingDocuments: CourseDocumentMetadata[];
  pending: boolean;
  error: string | null;
  onCancel: () => void;
  onSubmit: (values: DocumentFormValues) => void;
}): React.JSX.Element {
  const otherNormalizedFilenames = useMemo(
    () =>
      existingDocuments
        .filter((document) => document.id !== initial?.id)
        .map((document) => normalizeSearch(document.originalFilename ?? '')),
    [existingDocuments, initial?.id],
  );
  const schema = useMemo(
    () => buildDocumentFormSchema(otherNormalizedFilenames),
    [otherNormalizedFilenames],
  );
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<DocumentFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: initial?.title ?? '',
      originalFilename: initial?.originalFilename ?? '',
      visibility: initial?.visibility ?? 'hidden_from_students',
      description: initial?.description ?? '',
    },
  });

  return (
    <Dialog
      title={mode === 'create' ? 'Νέο έγγραφο' : 'Επεξεργασία εγγράφου'}
      onClose={onCancel}
    >
      <form
        className="course-form"
        noValidate
        onSubmit={(event) => void handleSubmit(onSubmit)(event)}
      >
        <p className="document-form-course">
          {courseCode} · {courseTitle}
        </p>
        <label>
          Τίτλος εγγράφου
          <input
            {...register('title')}
            readOnly={pending}
            aria-invalid={!!errors.title}
          />
        </label>
        {errors.title && (
          <p className="field-error" role="alert">
            {errors.title.message}
          </p>
        )}
        <label>
          Όνομα αρχείου (PDF)
          <input
            {...register('originalFilename')}
            readOnly={pending}
            aria-invalid={!!errors.originalFilename}
          />
        </label>
        {errors.originalFilename && (
          <p className="field-error" role="alert">
            {errors.originalFilename.message}
          </p>
        )}
        <label>
          Ορατότητα
          <select {...register('visibility')} disabled={pending}>
            <option value="hidden_from_students">Κρυφό</option>
            <option value="visible_to_students">Ορατό στους φοιτητές</option>
          </select>
        </label>
        <label>
          Περιγραφή <span className="field-optional">Προαιρετική</span>
          <textarea {...register('description')} readOnly={pending} />
        </label>
        {errors.description && (
          <p className="field-error" role="alert">
            {errors.description.message}
          </p>
        )}
        {error && <ErrorNotice>{error}</ErrorNotice>}
        <footer className="course-dialog-actions">
          <button className="secondary-button" type="button" onClick={onCancel}>
            Ακύρωση
          </button>
          <button className="primary-button" disabled={pending} type="submit">
            {pending
              ? 'Αποθήκευση…'
              : mode === 'create'
                ? 'Δημιουργία εγγράφου'
                : 'Αποθήκευση αλλαγών'}
          </button>
        </footer>
      </form>
    </Dialog>
  );
}
