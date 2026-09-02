import type { RequestHandler } from 'express';

import { asyncHandler } from '../lib/async-handler.js';
import { env, type Env } from '../config/env.js';
import type { ActiveSession, SessionService } from './session.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      currentSession?: ActiveSession | null;
    }
  }
}

export function attachCurrentSession(
  sessionService: SessionService,
  cookieName: Env['SESSION_COOKIE_NAME'] = env.SESSION_COOKIE_NAME,
): RequestHandler {
  return asyncHandler(async (request, _response, next) => {
    const token = request.cookies?.[cookieName] as string | undefined;
    request.currentSession = await sessionService.getSession(token);
    next();
  });
}
