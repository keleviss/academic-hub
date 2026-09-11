import { z } from 'zod';

import { UserRoleSchema } from './enums.js';

export const LoginRequestSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
  password: z.string().min(8).max(256),
});

export const CsrfResponseSchema = z.object({
  csrfToken: z.string().min(1),
});

export const CurrentUserSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  fullName: z.string().min(1),
  role: UserRoleSchema,
  isActive: z.boolean(),
});

export const CurrentSessionSchema = z.object({
  authenticated: z.boolean(),
  user: CurrentUserSchema.nullable(),
  csrfToken: z.string().min(1).optional(),
});

export type LoginRequest = z.infer<typeof LoginRequestSchema>;
export type CsrfResponse = z.infer<typeof CsrfResponseSchema>;
export type CurrentUser = z.infer<typeof CurrentUserSchema>;
export type CurrentSession = z.infer<typeof CurrentSessionSchema>;
