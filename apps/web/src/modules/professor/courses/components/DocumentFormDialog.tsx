import { useMemo } from 'react';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  MAX_COURSE_DOCUMENT_UPLOAD_BYTES,
  type CourseDocumentMetadata,
  type DocumentVisibility,
} from '@web-app/contracts';

import { FormDialog } from '../../../../components/FormDialog';
import { FormField } from '../../../../components/FormField';
import { normalizeSearch } from '../../../../lib/normalize-search';

export interface DocumentFormValues {
  title: string;
  visibility: DocumentVisibility;
  description: string;
  file?: FileList;
}

const MAX_UPLOAD_MB = Math.floor(MAX_COURSE_DOCUMENT_UPLOAD_BYTES / (1024 * 1024));

// Prototype validation rules kept client-side only; shared contracts stay looser.
// The file field is always optional at the schema level (so its inferred type
// matches both modes); create-mode file requirements are enforced below.
function buildDocumentFormSchema(
  mode: 'create' | 'edit',
  otherNormalizedFilenames: string[],
) {
  return z
    .object({
      title: z
        .string()
        .trim()
        .min(1, 'Ο τίτλος είναι υποχρεωτικός.')
        .max(120, 'Ο τίτλος έχει όριο 120 χαρακτήρων.'),
      visibility: z.enum(['visible_to_students', 'hidden_from_students']),
      description: z
        .string()
        .trim()
        .max(1_500, 'Η περιγραφή έχει όριο 1.500 χαρακτήρων.'),
      file: z.instanceof(FileList).optional(),
    })
    .superRefine((value, ctx) => {
      if (mode !== 'create') return;

      const file = value.file?.item(0);
      if (!file || value.file!.length !== 1) {
        ctx.addIssue({
          code: 'custom',
          path: ['file'],
          message: 'Επίλεξε ένα αρχείο PDF.',
        });
        return;
      }
      if (!(file.type === 'application/pdf' || /\.pdf$/i.test(file.name))) {
        ctx.addIssue({
          code: 'custom',
          path: ['file'],
          message: 'Το αρχείο πρέπει να είναι PDF.',
        });
      }
      if (file.size > MAX_COURSE_DOCUMENT_UPLOAD_BYTES) {
        ctx.addIssue({
          code: 'custom',
          path: ['file'],
          message: `Το αρχείο δεν πρέπει να ξεπερνά τα ${MAX_UPLOAD_MB}MB.`,
        });
      }
      if (otherNormalizedFilenames.includes(normalizeSearch(file.name))) {
        ctx.addIssue({
          code: 'custom',
          path: ['file'],
          message:
            'Υπάρχει ήδη έγγραφο με αυτό το όνομα αρχείου σε αυτό το μάθημα.',
        });
      }
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
    () => buildDocumentFormSchema(mode, otherNormalizedFilenames),
    [mode, otherNormalizedFilenames],
  );

  return (
    <FormDialog<DocumentFormValues>
      title={mode === 'create' ? 'Νέο έγγραφο' : 'Επεξεργασία εγγράφου'}
      resolver={zodResolver(schema)}
      defaultValues={{
        title: initial?.title ?? '',
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
          {mode === 'create' ? (
            <FormField
              label={`Αρχείο (PDF, έως ${MAX_UPLOAD_MB}MB)`}
              error={errors.file}
            >
              <input
                type="file"
                accept="application/pdf"
                {...register('file')}
                disabled={pending}
              />
            </FormField>
          ) : (
            <FormField label="Όνομα αρχείου (PDF)">
              <input
                className="document-form-readonly-field"
                value={initial?.originalFilename ?? ''}
                readOnly
                disabled
              />
            </FormField>
          )}
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
