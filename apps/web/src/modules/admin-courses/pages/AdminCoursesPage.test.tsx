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
  updateAdminCourse,
} from '../../../api/client';

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

    expect(await screen.findByRole('heading', { name: 'Μαθήματα' })).toBeInTheDocument();
    expect(await screen.findByText('Δομές Δεδομένων')).toBeInTheDocument();
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '+ Νέο μάθημα' }));

    expect(screen.getByRole('dialog', { name: 'Νέο μάθημα' })).toBeInTheDocument();
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
        <Route path="/app/courses/:courseId" element={<AdminCourseDetailPage />} />
      </Routes>,
      ['/app/courses/11111111-1111-4111-8111-111111111111'],
    );

    await userEvent.click(await screen.findByRole('button', { name: 'Ενεργοποίηση' }));
    expect(screen.getByRole('dialog', { name: 'Ενεργοποίηση μαθήματος' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Επιβεβαίωση' }));

    await waitFor(() =>
      expect(updateAdminCourse).toHaveBeenCalledWith(
        '11111111-1111-4111-8111-111111111111',
        { isActive: true },
      ),
    );
  });
});
