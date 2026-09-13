import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import type { CourseCreateRequest, CourseDetail } from '@web-app/contracts';

import { FormDialog } from '../../../../components/FormDialog';
import { FormField } from '../../../../components/FormField';
import { semesters } from '../utils/AdminCourses.const';

const courseFormSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, 'Ο κωδικός είναι υποχρεωτικός.')
    .max(20, 'Ο κωδικός έχει όριο 20 χαρακτήρων.'),
  title: z
    .string()
    .trim()
    .min(1, 'Ο τίτλος είναι υποχρεωτικός.')
    .max(160, 'Ο τίτλος έχει όριο 160 χαρακτήρων.'),
  semester: z
    .number()
    .int()
    .min(1, 'Επίλεξε εξάμηνο.')
    .max(12, 'Το μέγιστο εξάμηνο είναι το 12ο.'),
  ectsCredits: z
    .number()
    .int()
    .min(1, 'Οι πιστωτικές μονάδες ξεκινούν από 1.')
    .max(60, 'Οι πιστωτικές μονάδες έχουν όριο 60.'),
  description: z
    .string()
    .trim()
    .max(1_500, 'Η περιγραφή έχει όριο 1.500 χαρακτήρων.')
    .optional(),
});

type CourseFormValues = z.infer<typeof courseFormSchema>;

export function CourseForm({
  title,
  initial,
  submitLabel,
  pending,
  error,
  onCancel,
  onSubmit,
}: {
  title: string;
  initial?: CourseDetail;
  submitLabel: string;
  pending: boolean;
  error: string | null;
  onCancel: () => void;
  onSubmit: (value: CourseCreateRequest) => void;
}): React.JSX.Element {
  return (
    <FormDialog<CourseFormValues>
      title={title}
      resolver={zodResolver(courseFormSchema)}
      defaultValues={{
        code: initial?.code ?? '',
        title: initial?.title ?? '',
        semester: initial?.semester ?? 1,
        ectsCredits: initial?.ectsCredits ?? 6,
        description: initial?.description ?? '',
      }}
      pending={pending}
      error={error}
      submitLabel={submitLabel}
      onCancel={onCancel}
      onSubmit={(values) =>
        onSubmit({
          code: values.code.trim().toUpperCase(),
          title: values.title.trim(),
          semester: values.semester,
          ectsCredits: values.ectsCredits,
          description: values.description?.trim() || null,
        })
      }
    >
      {({ register, formState: { errors } }) => (
        <>
          <FormField label="Τίτλος μαθήματος" error={errors.title}>
            <input {...register('title')} readOnly={pending} />
          </FormField>
          <div className="course-form-grid">
            <FormField label="Κωδικός μαθήματος" error={errors.code}>
              <input {...register('code')} readOnly={pending} />
            </FormField>
            <FormField label="Εξάμηνο" error={errors.semester}>
              <select
                {...register('semester', { valueAsNumber: true })}
                disabled={pending}
              >
                {semesters.map((semester) => (
                  <option key={semester} value={semester}>
                    {semester}ο εξάμηνο
                  </option>
                ))}
              </select>
            </FormField>
          </div>
          <FormField label="Πιστωτικές μονάδες (ECTS)" error={errors.ectsCredits}>
            <input
              type="number"
              {...register('ectsCredits', { valueAsNumber: true })}
              readOnly={pending}
            />
          </FormField>
          <FormField label="Περιγραφή" optional error={errors.description}>
            <textarea {...register('description')} readOnly={pending} />
          </FormField>
        </>
      )}
    </FormDialog>
  );
}
