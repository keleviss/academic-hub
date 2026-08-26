import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { App } from './App';
import { fetchHealth } from '../api/client';
import { renderWithProviders } from '../test/render';

vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client')>();

  return {
    ...actual,
    fetchHealth: vi.fn(),
  };
});

describe('App', () => {
  beforeEach(() => {
    vi.mocked(fetchHealth).mockResolvedValue({
      status: 'ok',
      service: 'api-test',
      timestamp: '2026-08-27T00:00:00.000Z',
      version: '0.0.0-test',
    });
  });

  it('renders the home shell and API health state', async () => {
    renderWithProviders(<App />);

    expect(
      screen.getByRole('heading', {
        name: 'Πρωτότυπο μαθησιακής πλατφόρμας',
      }),
    ).toBeInTheDocument();

    expect(await screen.findByText('API ενεργό')).toBeInTheDocument();
    expect(screen.getByText('api-test')).toBeInTheDocument();
  });

  it('renders the login placeholder route', () => {
    renderWithProviders(<App />, ['/login']);

    expect(
      screen.getByRole('heading', {
        name: 'Η αυθεντικοποίηση θα προστεθεί στο επόμενο βήμα.',
      }),
    ).toBeInTheDocument();
  });

  it('navigates between the initial routes', async () => {
    const user = userEvent.setup();

    renderWithProviders(<App />);

    await user.click(screen.getByRole('link', { name: 'Σύνδεση' }));

    expect(
      screen.getByRole('heading', {
        name: 'Η αυθεντικοποίηση θα προστεθεί στο επόμενο βήμα.',
      }),
    ).toBeInTheDocument();
  });
});
