import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AdminCourseDetailPage, AdminCoursesPage } from './AdminCoursesPage';
import { renderWithProviders } from '../../../test/render';

vi.mock('../../../api/client', () => ({
  assignCourseInstructor: vi.fn(),
  createAdminCourse: vi.fn(),
  enrollCourseStudent: vi.fn(),
  fetchAdminCourse: vi.fn(),
  fetchAdminCourses: vi.fn(),
  fetchCourseMemberCandidates: vi.fn(),
  removeCourseInstructor: vi.fn(),
  updateAdminCourse: vi.fn(),
  updateCourseEnrollmentStatus: vi.fn(),
}));

import {
  fetchAdminCourse,
  fetchAdminCourses,
  fetchCourseMemberCandidates,
  updateAdminCourse,
  updateCourseEnrollmentStatus,
} from '../../../api/client';

const courseDetail = {
  data: {
    id: '11111111-1111-4111-8111-111111111111',
    code: 'CS-101',
    title: 'Δομές Δεδομένων',
    description: 'Βασικό μάθημα για δομές και αλγορίθμους.',
    semester: 3,
    ectsCredits: 6,
    isActive: true,
    counts: { documentCount: 0, instructorCount: 0, studentCount: 2 },
    primaryInstructor: null,
    createdAt: '2026-09-12T00:00:00.000Z',
    updatedAt: '2026-09-12T00:00:00.000Z',
    instructors: [],
    enrollments: [
      {
        id: '33333333-3333-4333-8333-333333333333',
        studentId: '44444444-4444-4444-8444-444444444444',
        fullName: 'Ada Lovelace',
        email: 'ada@example.edu',
        status: 'active' as const,
        enrolledAt: '2026-09-12T00:00:00.000Z',
        updatedAt: '2026-09-12T00:00:00.000Z',
      },
      {
        id: '55555555-5555-4555-8555-555555555555',
        studentId: '66666666-6666-4666-8666-666666666666',
        fullName: 'Grace Hopper',
        email: 'grace@example.edu',
        status: 'inactive' as const,
        enrolledAt: '2026-09-12T00:00:00.000Z',
        updatedAt: '2026-09-12T00:00:00.000Z',
      },
    ],
    documents: [],
  },
};

describe('AdminCoursesPage', () => {
  beforeEach(() => {
    vi.mocked(fetchAdminCourses).mockResolvedValue({
      data: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          code: 'CS-101',
          title: 'Δομές Δεδομένων',
          description: 'Βασικό μάθημα',
          semester: 3,
          ectsCredits: 6,
          isActive: true,
          counts: { documentCount: 2, instructorCount: 1, studentCount: 12 },
          primaryInstructor: {
            id: '22222222-2222-4222-8222-222222222222',
            fullName: 'Ada Lovelace',
          },
        },
      ],
      meta: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 },
      summary: { totalCourses: 1, activeCourses: 1, unassignedCourses: 0 },
    });
  });

  it('renders API-backed course summary and opens the create dialog', async () => {
    renderWithProviders(<AdminCoursesPage />, ['/app/courses']);

    expect(
      await screen.findByRole('heading', { name: 'Μαθήματα' }),
    ).toBeInTheDocument();
    expect(await screen.findByText('Δομές Δεδομένων')).toBeInTheDocument();
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '+ Νέο μάθημα' }));

    expect(
      screen.getByRole('dialog', { name: 'Νέο μάθημα' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Τίτλος μαθήματος')).toBeInTheDocument();
  });

  it('confirms activation for an inactive course', async () => {
    const detail = {
      data: {
        id: '11111111-1111-4111-8111-111111111111',
        code: 'CS-101',
        title: 'Δομές Δεδομένων',
        description: null,
        semester: 3,
        ectsCredits: 6,
        isActive: false,
        counts: { documentCount: 0, instructorCount: 0, studentCount: 0 },
        primaryInstructor: null,
        createdAt: '2026-09-12T00:00:00.000Z',
        updatedAt: '2026-09-12T00:00:00.000Z',
        instructors: [],
        enrollments: [],
        documents: [],
      },
    };
    vi.mocked(fetchAdminCourse).mockResolvedValue(detail);
    vi.mocked(updateAdminCourse).mockResolvedValue(detail);

    renderWithProviders(
      <Routes>
        <Route
          path="/app/courses/:courseId"
          element={<AdminCourseDetailPage />}
        />
      </Routes>,
      ['/app/courses/11111111-1111-4111-8111-111111111111'],
    );

    await userEvent.click(
      await screen.findByRole('button', { name: 'Ενεργοποίηση' }),
    );
    expect(
      screen.getByRole('dialog', { name: 'Ενεργοποίηση μαθήματος' }),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Επιβεβαίωση' }));

    await waitFor(() =>
      expect(updateAdminCourse).toHaveBeenCalledWith(
        '11111111-1111-4111-8111-111111111111',
        { isActive: true },
      ),
    );
  });

  it('places the description under the core course facts', async () => {
    vi.mocked(fetchAdminCourse).mockResolvedValue(courseDetail);

    renderWithProviders(
      <Routes>
        <Route
          path="/app/courses/:courseId"
          element={<AdminCourseDetailPage />}
        />
      </Routes>,
      ['/app/courses/11111111-1111-4111-8111-111111111111'],
    );

    expect(
      await screen.findByRole('heading', { name: 'Βασικά στοιχεία' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Περιγραφή' }),
    ).toBeInTheDocument();
    expect(screen.getByText(courseDetail.data.description)).toBeInTheDocument();
  });

  it('filters enrolled students by name or email and updates enrollment status', async () => {
    vi.mocked(fetchAdminCourse).mockResolvedValue(courseDetail);
    vi.mocked(updateCourseEnrollmentStatus).mockResolvedValue(courseDetail);

    renderWithProviders(
      <Routes>
        <Route
          path="/app/courses/:courseId"
          element={<AdminCourseDetailPage />}
        />
      </Routes>,
      ['/app/courses/11111111-1111-4111-8111-111111111111'],
    );

    await userEvent.click(
      await screen.findByRole('button', { name: 'Φοιτητές (2)' }),
    );
    await userEvent.type(
      screen.getByRole('textbox', { name: 'Αναζήτηση εγγεγραμμένων φοιτητών' }),
      'grace@example.edu',
    );

    expect(screen.getByText('Grace Hopper')).toBeInTheDocument();
    expect(screen.queryByText('Ada Lovelace')).not.toBeInTheDocument();

    await userEvent.selectOptions(
      screen.getByLabelText('Κατάσταση εγγραφής Grace Hopper'),
      'completed',
    );

    await waitFor(() =>
      expect(updateCourseEnrollmentStatus).toHaveBeenCalledWith(
        '11111111-1111-4111-8111-111111111111',
        '66666666-6666-4666-8666-666666666666',
        { status: 'completed' },
      ),
    );
  });

  it('closes candidate results after selecting a student', async () => {
    vi.mocked(fetchAdminCourse).mockResolvedValue(courseDetail);
    vi.mocked(fetchCourseMemberCandidates).mockResolvedValue({
      data: [
        {
          id: '77777777-7777-4777-8777-777777777777',
          fullName: 'Katherine Johnson',
          email: 'katherine@example.edu',
          role: 'student',
        },
      ],
    });

    renderWithProviders(
      <Routes>
        <Route
          path="/app/courses/:courseId"
          element={<AdminCourseDetailPage />}
        />
      </Routes>,
      ['/app/courses/11111111-1111-4111-8111-111111111111'],
    );

    await userEvent.click(
      await screen.findByRole('button', { name: 'Φοιτητές (2)' }),
    );
    await userEvent.click(
      screen.getByRole('button', { name: '+ Εγγραφή φοιτητή' }),
    );
    await userEvent.type(screen.getByLabelText('Αναζήτηση φοιτητή'), 'kat');
    await userEvent.click(
      await screen.findByRole('button', { name: /Katherine Johnson/ }),
    );

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(screen.getByText(/Επιλογή:/)).toHaveTextContent('Katherine Johnson');
  });
});
