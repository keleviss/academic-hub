import { CourseCreateRequest, CourseDetail } from "@web-app/contracts";
import { ErrorNotice } from "apps/web/src/components/feedback";
import { useState } from "react";
import { semesters } from "../utils/AdminCourses.const";

type CourseFormValue = CourseCreateRequest;

export function CourseForm({
  initial,
  label,
  pending,
  error,
  onCancel,
  onSubmit,
}: {
  initial?: CourseDetail;
  label: string;
  pending: boolean;
  error: string | null;
  onCancel: () => void;
  onSubmit: (value: CourseFormValue) => void;
}): React.JSX.Element {
  const [value, setValue] = useState<CourseFormValue>(() => ({
    code: initial?.code ?? '',
    title: initial?.title ?? '',
    semester: initial?.semester ?? 1,
    ectsCredits: initial?.ectsCredits ?? 6,
    description: initial?.description ?? null,
  }));
  const set = <K extends keyof CourseFormValue>(
    key: K,
    next: CourseFormValue[K],
  ) => setValue((previous) => ({ ...previous, [key]: next }));

  return (
    <form
      className="course-form"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit({
          ...value,
          code: value.code.trim().toUpperCase(),
          title: value.title.trim(),
        });
      }}
    >
      <label>
        Τίτλος μαθήματος
        <input
          required
          value={value.title}
          onChange={(event) => set('title', event.target.value)}
        />
      </label>
      <div className="course-form-grid">
        <label>
          Κωδικός μαθήματος
          <input
            required
            value={value.code}
            onChange={(event) => set('code', event.target.value)}
          />
        </label>
        <label>
          Εξάμηνο
          <select
            value={value.semester}
            onChange={(event) => set('semester', Number(event.target.value))}
          >
            {semesters.map((semester) => (
              <option key={semester} value={semester}>
                {semester}ο εξάμηνο
              </option>
            ))}
          </select>
        </label>
      </div>
      <label>
        Πιστωτικές μονάδες (ECTS)
        <input
          min="1"
          max="60"
          required
          type="number"
          value={value.ectsCredits}
          onChange={(event) => set('ectsCredits', Number(event.target.value))}
        />
      </label>
      <label>
        Περιγραφή <span className="field-optional">Προαιρετική</span>
        <textarea
          value={value.description ?? ''}
          onChange={(event) => set('description', event.target.value || null)}
        />
      </label>
      {error && <ErrorNotice>{error}</ErrorNotice>}
      <footer className="course-dialog-actions">
        <button className="secondary-button" type="button" onClick={onCancel}>
          Ακύρωση
        </button>
        <button className="primary-button" disabled={pending} type="submit">
          {pending ? 'Αποθήκευση…' : label}
        </button>
      </footer>
    </form>
  );
}