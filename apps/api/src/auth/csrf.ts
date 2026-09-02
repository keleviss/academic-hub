import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, RequestHandler, Response } from 'express';

import { env, type Env } from '../config/env.js';
import { HttpError } from '../lib/http-error.js';

const CSRF_NONCE_BYTE_LENGTH = 32;

type CsrfEnv = Pick<
  Env,
  | 'CSRF_COOKIE_NAME'
  | 'CSRF_HEADER_NAME'
  | 'CSRF_SECRET'
  | 'SESSION_COOKIE_MAX_AGE_SECONDS'
  | 'SESSION_COOKIE_SAME_SITE'
  | 'SESSION_COOKIE_SECURE'
>;

export function generateCsrfNonce(
  randomNonceBytes: (size: number) => Buffer = randomBytes,
): string {
  return randomNonceBytes(CSRF_NONCE_BYTE_LENGTH).toString('base64url');
}

export function computeCsrfToken(nonce: string, secret: string): string {
  return createHmac('sha256', secret).update(nonce).digest('base64url');
}

export function setCsrfCookie(
  response: Response,
  nonce: string,
  cookieEnv: CsrfEnv = env,
): void {
  response.cookie(cookieEnv.CSRF_COOKIE_NAME, nonce, {
    httpOnly: true,
    maxAge: cookieEnv.SESSION_COOKIE_MAX_AGE_SECONDS * 1000,
    path: '/',
    sameSite: cookieEnv.SESSION_COOKIE_SAME_SITE,
    secure: cookieEnv.SESSION_COOKIE_SECURE,
  });
}

export function requireCsrf(cookieEnv: CsrfEnv = env): RequestHandler {
  return (request: Request, _response: Response, next: NextFunction) => {
    void _response;

    const nonce = request.cookies?.[cookieEnv.CSRF_COOKIE_NAME] as
      | string
      | undefined;
    const headerToken = request.get(cookieEnv.CSRF_HEADER_NAME);

    if (!isValidCsrfPair(nonce, headerToken, cookieEnv.CSRF_SECRET)) {
      next(
        new HttpError(
          403,
          'Invalid or missing CSRF token',
          undefined,
          'CSRF_TOKEN_INVALID',
        ),
      );
      return;
    }

    next();
  };
}

function isValidCsrfPair(
  nonce: string | undefined,
  headerToken: string | undefined,
  secret: string,
): boolean {
  if (!nonce || !headerToken) {
    return false;
  }

  const expectedBuffer = Buffer.from(computeCsrfToken(nonce, secret));
  const providedBuffer = Buffer.from(headerToken);

  if (expectedBuffer.length !== providedBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, providedBuffer);
}
