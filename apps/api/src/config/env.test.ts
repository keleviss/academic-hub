import { describe, expect, it } from 'vitest';

import { parseEnv } from './env.js';

describe('parseEnv', () => {
  it('returns local development defaults for application, storage, session, and CSRF settings', () => {
    expect(parseEnv({})).toMatchObject({
      API_ORIGIN: 'http://localhost:3000',
      API_SERVICE_NAME: 'api',
      CORS_ORIGIN: 'http://localhost:4200',
      CSRF_HEADER_NAME: 'x-csrf-token',
      CSRF_SECRET: 'local-development-csrf-secret-change-me',
      DATABASE_URL:
        'postgresql://uniwa:uniwa_dev_password@localhost:5432/uniwa_thesis',
      NODE_ENV: 'development',
      PORT: 3000,
      S3_ACCESS_KEY_ID: 'minioadmin',
      S3_BUCKET: 'course-materials',
      S3_ENDPOINT: 'http://localhost:9000',
      S3_FORCE_PATH_STYLE: true,
      S3_REGION: 'us-east-1',
      S3_SECRET_ACCESS_KEY: 'minioadmin123',
      SESSION_COOKIE_MAX_AGE_SECONDS: 60 * 60 * 24 * 7,
      SESSION_COOKIE_NAME: 'uniwa_session',
      SESSION_COOKIE_SAME_SITE: 'lax',
      SESSION_COOKIE_SECURE: false,
      SESSION_SECRET: 'local-development-session-secret-change-me',
      WEB_ORIGIN: 'http://localhost:4200',
    });
  });

  it('coerces boolean and numeric environment values explicitly', () => {
    expect(
      parseEnv({
        PORT: '4000',
        S3_FORCE_PATH_STYLE: 'false',
        SESSION_COOKIE_MAX_AGE_SECONDS: '3600',
        SESSION_COOKIE_SECURE: 'true',
      }),
    ).toMatchObject({
      PORT: 4000,
      S3_FORCE_PATH_STYLE: false,
      SESSION_COOKIE_MAX_AGE_SECONDS: 3600,
      SESSION_COOKIE_SECURE: true,
    });
  });

  it('rejects placeholder and weak production secrets', () => {
    expect(() =>
      parseEnv({
        CSRF_SECRET: 'replace-with-local-csrf-secret',
        NODE_ENV: 'production',
        SESSION_COOKIE_SECURE: 'true',
        SESSION_SECRET: 'short',
      }),
    ).toThrow();
  });

  it('requires secure session cookies in production', () => {
    expect(() =>
      parseEnv({
        CSRF_SECRET: 'production-csrf-secret-with-enough-length',
        NODE_ENV: 'production',
        SESSION_COOKIE_SECURE: 'false',
        SESSION_SECRET: 'production-session-secret-with-enough-length',
      }),
    ).toThrow();
  });

  it('accepts strong production secrets and secure session cookies', () => {
    expect(
      parseEnv({
        CSRF_SECRET: 'production-csrf-secret-with-enough-length',
        NODE_ENV: 'production',
        SESSION_COOKIE_SECURE: 'true',
        SESSION_SECRET: 'production-session-secret-with-enough-length',
      }),
    ).toMatchObject({
      CSRF_SECRET: 'production-csrf-secret-with-enough-length',
      NODE_ENV: 'production',
      SESSION_COOKIE_SECURE: true,
      SESSION_SECRET: 'production-session-secret-with-enough-length',
    });
  });
});
