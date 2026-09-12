import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { WorkspaceToolbar } from './WorkspaceToolbar';
import { renderWithProviders } from '../../../test/render';

vi.mock('../../../api/client', () => ({
  fetchAdminCourse: vi.fn(),
}));

import { fetchAdminCourse } from '../../../api/client';

describe('WorkspaceToolbar', () => {
  beforeEach(() => {
    vi.mocked(fetchAdminCourse).mockResolvedValue({
      data: {
        code: 'CS-101',
      },
    } as Awaited<ReturnType<typeof fetchAdminCourse>>);
  });

  it('links breadcrumb ancestors on the course list', () => {
    renderWithProviders(
      <WorkspaceToolbar role="admin" onOpenSidebar={vi.fn()} />,
      ['/app/courses'],
    );

    expect(
      screen.getByRole('link', { name: 'Χώρος διαχείρισης' }),
    ).toHaveAttribute('href', '/app');
    expect(screen.getByText('Μαθήματα')).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('shows the fetched course code as the current detail breadcrumb', async () => {
    renderWithProviders(
      <WorkspaceToolbar role="admin" onOpenSidebar={vi.fn()} />,
      ['/app/courses/11111111-1111-4111-8111-111111111111'],
    );

    expect(await screen.findByText('CS-101')).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('link', { name: 'Μαθήματα' })).toHaveAttribute(
      'href',
      '/app/courses',
    );
  });
});
