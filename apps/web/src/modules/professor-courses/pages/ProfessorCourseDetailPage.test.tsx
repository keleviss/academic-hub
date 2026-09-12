import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CurrentUser } from '@web-app/contracts';

import { ProfessorCourseDetailPage } from './ProfessorCourseDetailPage';
import { AuthenticatedUserContext } from '../../../auth/authenticatedUser';
import { renderWithProviders } from '../../../test/render';

vi.mock('../../../api/client', () => ({
  ApiClientError: class ApiClientError extends Error {
    status?: number;
    constructor(message: string, status?: number) {
      super(message);
      this.status = status;
    }
  },
  createCourseDocument: vi.fn(),
  fetchCourseDocuments: vi.fn(),
  fetchProfessorCourse: vi.fn(),
  updateCourseDocumentMetadata: vi.fn(),
}));

import {
  ApiClientError,
  createCourseDocument,
  fetchCourseDocuments,
  fetchProfessorCourse,
  updateCourseDocumentMetadata,
} from '../../../api/client';

const courseId = '11111111-1111-4111-8111-111111111111';
const currentUserId = '22222222-2222-4222-8222-222222222222';
const otherProfessorId = '33333333-3333-4333-8333-333333333333';
const lectureDocId = '44444444-4444-4444-8444-444444444444';
const labDocId = '55555555-5555-4555-8555-555555555555';

const currentUser: CurrentUser = {
  id: currentUserId,
  email: 'me@example.edu',
  fullName: 'Δρ. Τεστ',
  role: 'professor',
  isActive: true,
};

const courseDetail = {
  data: {
    id: courseId,
    code: 'CS-201',
    title: 'Αλγόριθμοι',
    description: 'Δομές δεδομένων και αλγόριθμοι.',
    semester: 3,
    ectsCredits: 6,
    isActive: true,
    instructorRole: 'owner' as const,
    counts: { documentCount: 2, visibleDocumentCount: 1 },
    studentCount: 42,
    instructors: [
      {
        id: 'assign-1',
        userId: currentUserId,
        fullName: 'Δρ. Τεστ',
        email: 'me@example.edu',
        role: 'owner' as const,
        assignedAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'assign-2',
        userId: otherProfessorId,
        fullName: 'Άλλος Καθηγητής',
        email: 'other@example.edu',
        role: 'assistant' as const,
        assignedAt: '2026-01-01T00:00:00.000Z',
      },
    ],
  },
};

const lectureDoc = {
  id: lectureDocId,
  title: 'Διάλεξη 1',
  description: null,
  status: 'active' as const,
  visibility: 'hidden_from_students' as const,
  originalFilename: 'lecture1.pdf',
  mimeType: null,
  fileSizeBytes: null,
  pageCount: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
};

const labDoc = {
  id: labDocId,
  title: 'Εργαστήριο',
  description: null,
  status: 'active' as const,
  visibility: 'visible_to_students' as const,
  originalFilename: 'lab.pdf',
  mimeType: null,
  fileSizeBytes: null,
  pageCount: null,
  createdAt: '2026-01-05T00:00:00.000Z',
  updatedAt: '2026-01-06T00:00:00.000Z',
};

function renderDetail(user: CurrentUser = currentUser) {
  return renderWithProviders(
    <AuthenticatedUserContext.Provider value={user}>
      <Routes>
        <Route
          path="/app/courses/:courseId"
          element={<ProfessorCourseDetailPage />}
        />
      </Routes>
    </AuthenticatedUserContext.Provider>,
    [`/app/courses/${courseId}`],
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(fetchProfessorCourse).mockResolvedValue(courseDetail);
  vi.mocked(fetchCourseDocuments).mockResolvedValue({
    data: [lectureDoc, labDoc],
  });
});

describe('ProfessorCourseDetailPage', () => {
  it('renders the header, default documents tab, summary and instructors', async () => {
    renderDetail();

    expect(await screen.findByRole('heading', { name: 'Αλγόριθμοι' })).toBeInTheDocument();
    expect(screen.getByText('CS-201 · 3ο εξάμηνο')).toBeInTheDocument();
    expect(screen.getByText(/Υπεύθυνος μαθήματος · 6 ECTS/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Έγγραφα (2)' })).toHaveClass(
      'is-active',
    );
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('Δρ. Τεστ · Εσείς')).toBeInTheDocument();
    expect(screen.getByText('Άλλος Καθηγητής')).toBeInTheDocument();
  });

  it('shows read-only course details without a department field', async () => {
    renderDetail();
    await screen.findByRole('heading', { name: 'Αλγόριθμοι' });

    await userEvent.click(
      screen.getByRole('button', { name: 'Στοιχεία μαθήματος' }),
    );

    expect(screen.getByText('CS-201')).toBeInTheDocument();
    expect(screen.getByText('6 ECTS')).toBeInTheDocument();
    expect(screen.getByText('Δομές δεδομένων και αλγόριθμοι.')).toBeInTheDocument();
    expect(screen.queryByText('Τμήμα')).not.toBeInTheDocument();
  });

  it('lists documents with filename, formatted date, and visibility', async () => {
    renderDetail();

    expect(await screen.findByText('Διάλεξη 1')).toBeInTheDocument();
    expect(screen.getByText('lecture1.pdf')).toBeInTheDocument();
    expect(screen.getByText('02/01/2026')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Κρυφό' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ορατό' })).toBeInTheDocument();
    expect(screen.getByText('2 από 2 έγγραφα')).toBeInTheDocument();
  });

  it('combines document search and visibility filter with a live counter', async () => {
    const user = userEvent.setup();
    renderDetail();

    await screen.findByText('Διάλεξη 1');
    await user.selectOptions(
      screen.getByLabelText('Φίλτρο ορατότητας εγγράφων'),
      'visible',
    );

    expect(screen.getByText('1 από 2 έγγραφα')).toBeInTheDocument();
    expect(screen.getByText('Εργαστήριο')).toBeInTheDocument();
    expect(screen.queryByText('Διάλεξη 1')).not.toBeInTheDocument();

    await user.selectOptions(
      screen.getByLabelText('Φίλτρο ορατότητας εγγράφων'),
      'all',
    );
    await user.type(screen.getByLabelText('Αναζήτηση εγγράφων'), 'διαλεξη');

    expect(screen.getByText('1 από 2 έγγραφα')).toBeInTheDocument();
    expect(screen.getByText('Διάλεξη 1')).toBeInTheDocument();
  });

  it('opens the edit modal from either the title or the edit action, not a PDF', async () => {
    const user = userEvent.setup();
    renderDetail();

    await screen.findByText('Διάλεξη 1');
    await user.click(screen.getByRole('button', { name: 'Διάλεξη 1' }));

    expect(
      screen.getByRole('dialog', { name: 'Επεξεργασία εγγράφου' }),
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue('lecture1.pdf')).toBeInTheDocument();
  });

  it('creates a document, defaults to hidden, and resets the tab and filters on success', async () => {
    vi.mocked(createCourseDocument).mockResolvedValue({
      data: { ...lectureDoc, id: 'new-doc', title: 'Νέα διάλεξη' },
    });
    const user = userEvent.setup();
    renderDetail();

    await screen.findByText('Διάλεξη 1');
    await user.type(screen.getByLabelText('Αναζήτηση εγγράφων'), 'διαλεξη');
    await user.click(screen.getByRole('button', { name: '+ Νέο έγγραφο' }));

    expect(screen.getByRole('dialog', { name: 'Νέο έγγραφο' })).toBeInTheDocument();
    expect(screen.getByLabelText('Ορατότητα')).toHaveValue('hidden_from_students');

    await user.type(screen.getByLabelText('Τίτλος εγγράφου'), 'Νέα διάλεξη');
    await user.type(screen.getByLabelText('Όνομα αρχείου (PDF)'), 'new-lecture.pdf');
    await user.click(screen.getByRole('button', { name: 'Δημιουργία εγγράφου' }));

    await waitFor(() => expect(createCourseDocument).toHaveBeenCalledWith(courseId, {
      title: 'Νέα διάλεξη',
      originalFilename: 'new-lecture.pdf',
      visibility: 'hidden_from_students',
      description: null,
    }));

    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'Νέο έγγραφο' }),
      ).not.toBeInTheDocument(),
    );
    expect(screen.getByLabelText('Αναζήτηση εγγράφων')).toHaveValue('');
  });

  it('rejects a duplicate filename (case-insensitive) within the same course', async () => {
    const user = userEvent.setup();
    renderDetail();

    await screen.findByText('Διάλεξη 1');
    await user.click(screen.getByRole('button', { name: '+ Νέο έγγραφο' }));

    await user.type(screen.getByLabelText('Τίτλος εγγράφου'), 'Αντίγραφο');
    await user.type(
      screen.getByLabelText('Όνομα αρχείου (PDF)'),
      'LECTURE1.pdf',
    );
    await user.click(screen.getByRole('button', { name: 'Δημιουργία εγγράφου' }));

    expect(
      await screen.findByText(
        'Υπάρχει ήδη έγγραφο με αυτό το όνομα αρχείου σε αυτό το μάθημα.',
      ),
    ).toBeInTheDocument();
    expect(createCourseDocument).not.toHaveBeenCalled();
  });

  it('closes the create modal via Cancel without saving', async () => {
    const user = userEvent.setup();
    renderDetail();

    await screen.findByText('Διάλεξη 1');
    await user.click(screen.getByRole('button', { name: '+ Νέο έγγραφο' }));
    await user.click(screen.getByRole('button', { name: 'Ακύρωση' }));

    expect(
      screen.queryByRole('dialog', { name: 'Νέο έγγραφο' }),
    ).not.toBeInTheDocument();
    expect(createCourseDocument).not.toHaveBeenCalled();
  });

  it('opens a confirmation before changing visibility and keeps filters after confirming', async () => {
    vi.mocked(updateCourseDocumentMetadata).mockResolvedValue({
      data: { ...lectureDoc, visibility: 'visible_to_students' },
    });
    const user = userEvent.setup();
    renderDetail();

    await screen.findByText('Διάλεξη 1');
    await user.selectOptions(
      screen.getByLabelText('Φίλτρο ορατότητας εγγράφων'),
      'hidden',
    );
    await user.click(screen.getByRole('button', { name: 'Κρυφό' }));

    const dialog = screen.getByRole('dialog', { name: 'Εμφάνιση εγγράφου' });
    expect(within(dialog).getByText(/Διάλεξη 1/)).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Επιβεβαίωση' }));

    await waitFor(() =>
      expect(updateCourseDocumentMetadata).toHaveBeenCalledWith(
        courseId,
        lectureDocId,
        { visibility: 'visible_to_students' },
      ),
    );
    expect(screen.getByLabelText('Φίλτρο ορατότητας εγγράφων')).toHaveValue(
      'hidden',
    );
  });

  it('shows an empty-course-material state with a create action', async () => {
    vi.mocked(fetchCourseDocuments).mockResolvedValue({ data: [] });
    renderDetail();

    expect(await screen.findByText('Το πρώτο υλικό ξεκινά εδώ.')).toBeInTheDocument();
    expect(
      screen.getAllByRole('button', { name: 'Νέο έγγραφο' }).length,
    ).toBeGreaterThan(0);
  });

  it('surfaces an access error for a professor without an assignment', async () => {
    vi.mocked(fetchProfessorCourse).mockRejectedValue(
      new ApiClientError('Access denied', 403),
    );

    renderDetail();

    expect(
      await screen.findByText('Δεν έχεις πρόσβαση σε αυτό το μάθημα.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Τα μαθήματά μου/ })).toBeInTheDocument();
  });
});
