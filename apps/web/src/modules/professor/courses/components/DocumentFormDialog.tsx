import { useMemo } from 'react';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import type { CourseDocumentMetadata, DocumentVisibility } from '@web-app/contracts';

import { FormDialog } from '../../../../components/FormDialog';
import { FormField } from '../../../../components/FormField';
import { normalizeSearch } from '../../../../lib/normalize-search';

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
      .max(1_500, 'Η περιγραφή έχει όριο 1.500 χαρακτήρων.'),
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

  return (
    <FormDialog<DocumentFormValues>
      title={mode === 'create' ? 'Νέο έγγραφο' : 'Επεξεργασία εγγράφου'}
      resolver={zodResolver(schema)}
      defaultValues={{
        title: initial?.title ?? '',
        originalFilename: initial?.originalFilename ?? '',
        visibility: initial?.visibility ?? 'hidden_from_students',
        description: initial?.description ?? '',
      }}
      pending={pending}
      error={error}
      submitLabel={mode === 'create' ? 'Δημιουργία εγγράφου' : 'Αποθήκευση αλλαγών'}
      onCancel={onCancel}
      onSubmit={onSubmit}
    >
      {({ register, formState: { errors } }) => (
        <>
          <p className="document-form-course">
            {courseCode} · {courseTitle}
          </p>
          <FormField label="Τίτλος εγγράφου" error={errors.title}>
            <input {...register('title')} readOnly={pending} />
          </FormField>
          <FormField label="Όνομα αρχείου (PDF)" error={errors.originalFilename}>
            <input {...register('originalFilename')} readOnly={pending} />
          </FormField>
          <FormField label="Ορατότητα">
            <select {...register('visibility')} disabled={pending}>
              <option value="hidden_from_students">Κρυφό</option>
              <option value="visible_to_students">Ορατό στους φοιτητές</option>
            </select>
          </FormField>
          <FormField label="Περιγραφή" optional error={errors.description}>
            <textarea {...register('description')} readOnly={pending} />
          </FormField>
        </>
      )}
    </FormDialog>
  );
}
