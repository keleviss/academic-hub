import type { DatabaseReadinessCheck } from '@web-app/contracts';

export interface DatabaseReadinessClient {
  $queryRaw<T = unknown>(query: TemplateStringsArray): Promise<T>;
}

export interface DatabaseReadinessOptions {
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 2_000;

export async function checkDatabaseReadiness(
  client: DatabaseReadinessClient,
  options: DatabaseReadinessOptions = {},
): Promise<DatabaseReadinessCheck> {
  try {
    await queryWithTimeout(
      client.$queryRaw`SELECT 1`,
      options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    );

    return { status: 'ok' };
  } catch {
    return {
      reason: 'database_unavailable',
      status: 'degraded',
    };
  }
}

function queryWithTimeout<T>(query: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Database readiness check timed out'));
    }, timeoutMs);

    void query.then(
      (result) => {
        clearTimeout(timeout);
        resolve(result);
      },
      (error: unknown) => {
        clearTimeout(timeout);
        reject(error);
      },
    );
  });
}
