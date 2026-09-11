export {
  optionalAuth,
  attachCurrentSession,
} from './current-session-middleware.js';
export {
  requireAuth,
  requireRole,
  type AuthorizationMiddlewareOptions,
} from './authorization-middleware.js';
export {
  createAuthorizationService,
  type AuthorizationService,
  type AuthorizationServiceOptions,
} from './authorization-service.js';
export type { AuthorizationRequestContext } from './authorization-denial.js';
