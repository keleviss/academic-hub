import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ProfessorCoursesPage } from './ProfessorCoursesPage';
import { renderWithProviders } from '../../../test/render';

vi.mock('../../../api/client', () => ({
  ApiClientError: class ApiClientError extends Error {},
  fetchProfessorCourses: vi.fn(),
}));

import { fetchProfessorCourses } from '../../../api/client';

const algorithms = {
  id: '11111111-1111-4111-8111-111111111111',
  code: 'CS-201',
  title: 'Αλγόριθμοι',
  description: 'Δομές δεδομένων και αλγόριθμοι.',
  semester: 3,
  ectsCredits: 6,
  isActive: true,
  instructorRole: 'owner' as const,
  counts: { documentCount: 5, visibleDocumentCount: 3 },
};

const electronics = {
  id: '22222222-2222-4222-8222-222222222222',
  code: 'ICE-101',
  title: 'Ηλεκτρονική',
  description: 'Βασικά ηλεκτρονικά κυκλώματα.',
  semester: 1,
  ectsCredits: 5,
  isActive: false,
  instructorRole: 'assistant' as const,
  counts: { documentCount: 0, visibleDocumentCount: 0 },
};

function mockCourses(data: typeof algorithms extends infer T ? T[] : never) {
  vi.mocked(fetchProfessorCourses).mockResolvedValue({
    data,
    summary: { assignedCourseCount: data.length },
  });
}

describe('ProfessorCoursesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders only assigned courses with role, status, and document counts', async () => {
    mockCourses([algorithms, electronics]);

    renderWithProviders(<ProfessorCoursesPage />, ['/app/courses']);

    expect(await screen.findByRole('heading', { name: 'Τα μαθήματά μου' })).toBeInTheDocument();
    expect(await screen.findByText('Αλγόριθμοι')).toBeInTheDocument();
    expect(screen.getByText('Ηλεκτρονική')).toBeInTheDocument();
    expect(screen.getByText('Υπεύθυνος μαθήματος')).toBeInTheDocument();
    expect(screen.getByText('Συνεργάτης διδάσκων')).toBeInTheDocument();
    expect(screen.getByText('5 έγγραφα')).toBeInTheDocument();
    expect(screen.getByText('3 ορατά')).toBeInTheDocument();

    const card = screen.getByText('Αλγόριθμοι').closest('a');
    expect(card).toHaveAttribute('href', `/app/courses/${algorithms.id}`);
  });

  it('filters by search across title and code, ignoring accents/case', async () => {
    mockCourses([algorithms, electronics]);
    const user = userEvent.setup();

    renderWithProviders(<ProfessorCoursesPage />, ['/app/courses']);

    await screen.findByText('Αλγόριθμοι');
    await user.type(
      screen.getByLabelText('Αναζήτηση μαθημάτων'),
      'ΗΛΕΚΤΡΟΝΙΚΉ',
    );

    expect(screen.getByText('Ηλεκτρονική')).toBeInTheDocument();
    expect(screen.queryByText('Αλγόριθμοι')).not.toBeInTheDocument();
  });

  it('combines the semester filter with sort direction toggling', async () => {
    mockCourses([algorithms, electronics]);
    const user = userEvent.setup();

    renderWithProviders(<ProfessorCoursesPage />, ['/app/courses']);

    await screen.findByText('Αλγόριθμοι');
    const sortButton = screen.getByRole('button', { name: /Εξάμηνο/ });
    expect(sortButton).toHaveTextContent('↑');

    const cardsBefore = screen.getAllByRole('heading', { level: 2 });
    expect(cardsBefore.map((heading) => heading.textContent)).toEqual([
      'Ηλεκτρονική',
      'Αλγόριθμοι',
    ]);

    await user.click(sortButton);
    expect(sortButton).toHaveTextContent('↓');
    const cardsAfter = screen.getAllByRole('heading', { level: 2 });
    expect(cardsAfter.map((heading) => heading.textContent)).toEqual([
      'Αλγόριθμοι',
      'Ηλεκτρονική',
    ]);

    await user.selectOptions(
      screen.getByLabelText('Φίλτρο εξαμήνου'),
      '1',
    );
    expect(screen.getByText('Ηλεκτρονική')).toBeInTheDocument();
    expect(screen.queryByText('Αλγόριθμοι')).not.toBeInTheDocument();
  });

  it('toggles between card and list views without refetching data', async () => {
    mockCourses([algorithms, electronics]);
    const user = userEvent.setup();

    renderWithProviders(<ProfessorCoursesPage />, ['/app/courses']);

    await screen.findByText('Αλγόριθμοι');
    expect(fetchProfessorCourses).toHaveBeenCalledTimes(1);

    const cardsButton = screen.getByRole('button', { name: 'Κάρτες' });
    const listButton = screen.getByRole('button', { name: 'Λίστα' });
    expect(cardsButton).toHaveAttribute('aria-pressed', 'true');
    expect(listButton).toHaveAttribute('aria-pressed', 'false');

    await user.click(listButton);

    expect(listButton).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Αλγόριθμοι')).toBeInTheDocument();
    expect(screen.getByText('Ηλεκτρονική')).toBeInTheDocument();
    expect(fetchProfessorCourses).toHaveBeenCalledTimes(1);
  });

  it('shows a distinct empty state when no courses are assigned', async () => {
    mockCourses([]);

    renderWithProviders(<ProfessorCoursesPage />, ['/app/courses']);

    expect(
      await screen.findByText('Δεν σου έχουν ανατεθεί μαθήματα.'),
    ).toBeInTheDocument();
  });

  it('shows a clear-filters empty state when search matches nothing', async () => {
    mockCourses([algorithms, electronics]);
    const user = userEvent.setup();

    renderWithProviders(<ProfessorCoursesPage />, ['/app/courses']);

    await screen.findByText('Αλγόριθμοι');
    await user.type(
      screen.getByLabelText('Αναζήτηση μαθημάτων'),
      'no-such-course',
    );

    expect(
      await screen.findByText('Δεν βρέθηκαν μαθήματα για τα επιλεγμένα φίλτρα.'),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Καθαρισμός φίλτρων' }));

    await waitFor(() =>
      expect(screen.getByLabelText('Αναζήτηση μαθημάτων')).toHaveValue(''),
    );
    expect(screen.getByText('Αλγόριθμοι')).toBeInTheDocument();
  });

  it('shows an error state with retry on load failure', async () => {
    vi.mocked(fetchProfessorCourses).mockRejectedValue(new Error('offline'));

    renderWithProviders(<ProfessorCoursesPage />, ['/app/courses']);

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Δοκίμασε ξανά' }),
    ).toBeInTheDocument();
  });
});
