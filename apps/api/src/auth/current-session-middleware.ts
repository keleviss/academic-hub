import type { Request, RequestHandler } from 'express';

import { asyncHandler } from '../lib/async-handler.js';
import { env, type Env } from '../config/env.js';
import {
  createSessionService,
  type ActiveSession,
  type SessionService,
} from './session.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      currentSession?: ActiveSession | null;
    }
  }
}

export function attachCurrentSession(
  sessionService: SessionService = createSessionService(),
  cookieName: Env['SESSION_COOKIE_NAME'] = env.SESSION_COOKIE_NAME,
): RequestHandler {
  return asyncHandler(async (request, _response, next) => {
    await resolveCurrentSession(request, sessionService, cookieName);
    next();
  });
}

export const optionalAuth = attachCurrentSession;

// undefined means not checked; null is an already checked anonymous request.
export async function resolveCurrentSession(
  request: Request,
  sessionService: SessionService,
  cookieName: string,
): Promise<ActiveSession | null> {
  if (request.currentSession === undefined) {
    const token = request.cookies?.[cookieName] as string | undefined;
    request.currentSession = await sessionService.getSession(token);
  }
  return request.currentSession;
}
