import { describe, expect, it, vi } from 'vitest';

import {
  checkDatabaseReadiness,
  type DatabaseReadinessClient,
} from './database-readiness.js';

describe('checkDatabaseReadiness', () => {
  it('reports ok after a non-mutating query succeeds', async () => {
    const queryRaw = vi.fn().mockResolvedValue([{ '?column?': 1 }]);
    const client: DatabaseReadinessClient = { $queryRaw: queryRaw };

    await expect(checkDatabaseReadiness(client)).resolves.toEqual({
      status: 'ok',
    });

    expect(queryRaw).toHaveBeenCalledOnce();
    expect(queryRaw.mock.calls[0]?.[0].join('')).toBe('SELECT 1');
  });

  it('normalizes query failures without exposing their details', async () => {
    const client: DatabaseReadinessClient = {
      $queryRaw: () => Promise.reject(new Error('password rejected')),
    };

    await expect(checkDatabaseReadiness(client)).resolves.toEqual({
      reason: 'database_unavailable',
      status: 'degraded',
    });
  });

  it('reports degraded when the query exceeds its timeout', async () => {
    vi.useFakeTimers();
    const client: DatabaseReadinessClient = {
      $queryRaw: () => new Promise(() => undefined),
    };
    const readiness = checkDatabaseReadiness(client, { timeoutMs: 50 });

    await vi.advanceTimersByTimeAsync(50);
    await expect(readiness).resolves.toEqual({
      reason: 'database_unavailable',
      status: 'degraded',
    });
    vi.useRealTimers();
  });
});
