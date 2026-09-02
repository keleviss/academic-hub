import { describe, expect, it } from 'vitest';

import { hashPassword, verifyPassword } from './password.js';

describe('password hashing', () => {
  it('hashes passwords with Argon2id and verifies the original password', async () => {
    const password = 'AcademicHubDemo2026!';
    const hash = await hashPassword(password);

    expect(hash).toMatch(/^\$argon2id\$/);
    expect(hash).not.toContain(password);
    await expect(verifyPassword(hash, password)).resolves.toBe(true);
  });

  it('rejects a wrong password', async () => {
    const hash = await hashPassword('AcademicHubDemo2026!');

    await expect(verifyPassword(hash, 'wrong-password')).resolves.toBe(false);
  });

  it('returns false for malformed hashes', async () => {
    await expect(
      verifyPassword('not-an-argon2-hash', 'AcademicHubDemo2026!'),
    ).resolves.toBe(false);
  });
});
